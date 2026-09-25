import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, paymentProofs, paymentVerifications, payments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { canAccessPayment } from "@/lib/payment-access";
import { PaymentService } from "@/lib/payment-service";
import { getPaymentProofExtractionProvider } from "@/lib/payment-proof-extraction";
import { PaymentProofReconciliationService } from "@/lib/payment-proof-reconciliation-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { getStorageProvider } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const id = Number((await params).id);
    const access = await canAccessPayment(user, id);
    if (!access.payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const verification = (
      await getDb()
        .select()
        .from(paymentVerifications)
        .where(eq(paymentVerifications.paymentId, id))
        .orderBy(desc(paymentVerifications.createdAt))
    )[0] ?? null;

    return NextResponse.json({ payment: access.payment, verification });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to load payment verification." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const id = Number((await params).id);
    const access = await canAccessPayment(user, id);
    if (!access.payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

    const body = ((await request.json().catch(() => ({}))) as { proofId?: number });
    const [proof] = await getDb()
      .select()
      .from(paymentProofs)
      .where(and(eq(paymentProofs.id, Number(body.proofId)), eq(paymentProofs.paymentId, id)));

    if (!proof) return NextResponse.json({ error: "A private payment proof is required." }, { status: 400 });
    if (access.payment.status !== "PROOF_UPLOADED") {
      return NextResponse.json({ error: "Payment is not ready for extraction." }, { status: 409 });
    }

    // Read stored proof file buffer
    let fileBuffer: ArrayBuffer | undefined;
    try {
      const stored = await getStorageProvider().get(proof.fileKey);
      if (stored.body) {
        const reader = stored.body.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        fileBuffer = merged.buffer;
      }
    } catch {
      // Storage read error handled gracefully
    }

    // Try extraction
    try {
      await new PaymentService().changeStatus(id, "VERIFYING", user.id, "payment-proof-extraction");
      const provider = getPaymentProofExtractionProvider();
      const extracted = await provider.extractPaymentDetails({
        paymentId: id,
        fileBuffer,
        fileName: proof.fileName,
        fileType: proof.fileType,
        expectedAmount: access.payment.expectedAmount,
        expectedClient: access.payment.client,
      });

      const outcome = await new PaymentProofReconciliationService().reconcile(access.payment, extracted);
      const [verification] = await getDb()
        .insert(paymentVerifications)
        .values({
          paymentId: id,
          proofId: proof.id,
          extractedAmount: extracted.amount,
          extractedDate: extracted.paymentDate,
          transactionId: extracted.transactionId,
          utr: extracted.utr,
          referenceNumber: extracted.referenceNumber,
          senderName: extracted.senderName,
          receiverName: extracted.receiverName,
          confidence: extracted.confidence === "high" ? 0.99 : extracted.confidence === "medium" ? 0.75 : 0.4,
          result: outcome.result,
          reason: outcome.reason,
        })
        .returning();

      await getDb().insert(auditLogs).values({
        paymentId: id,
        userId: user.id,
        entityType: "verification",
        entityId: String(verification.id),
        action: "PAYMENT_EXTRACTION_COMPLETED",
        newValue: outcome.result,
        metadata: { provider: extracted.rawText?.startsWith("DEMO") ? "DEMO EXTRACTION" : "vision-provider" },
      });

      const nextPaymentStatus = outcome.result === "MATCH" ? "VERIFIED" : outcome.result;
      await new PaymentService().changeStatus(id, nextPaymentStatus, user.id, "payment-proof-reconciliation");

      return NextResponse.json(
        {
          verification,
          duplicate: outcome.duplicate,
          readyForApproval: outcome.result === "MATCH",
          ocrConfigured: true,
        },
        { status: 201 }
      );
    } catch (extractError) {
      const code = extractError instanceof Error ? extractError.message : "";
      if (code === "OCR_PROVIDER_NOT_CONFIGURED" || code.startsWith("UNSUPPORTED_OCR_PROVIDER")) {
        // As per requirement: "If provider is not configured: return a real configuration state and route the payment to MANUAL_REVIEW. Do not fake OCR."
        const [verification] = await getDb()
          .insert(paymentVerifications)
          .values({
            paymentId: id,
            proofId: proof.id,
            result: "MANUAL_REVIEW",
            reason: "OCR provider is not configured. Routed to manual review by Accounts team.",
            confidence: 0,
          })
          .returning();

        await new PaymentService().changeStatus(id, "MANUAL_REVIEW", user.id, "ocr-unconfigured-fallback");

        return NextResponse.json(
          {
            verification,
            ocrConfigured: false,
            code: "OCR_PROVIDER_NOT_CONFIGURED",
            message: "OCR provider is not configured. Payment proof routed to MANUAL_REVIEW for human verification.",
          },
          { status: 200 }
        );
      }

      // If extraction genuinely failed, rollback status to PROOF_UPLOADED to avoid permanent bricking
      await getDb()
        .update(payments)
        .set({ status: "PROOF_UPLOADED", updatedAt: new Date().toISOString() })
        .where(eq(payments.id, id));

      return NextResponse.json(
        { error: "Payment extraction failed. Payment reverted to PROOF_UPLOADED." },
        { status: 500 }
      );
    }
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to verify payment proof." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
