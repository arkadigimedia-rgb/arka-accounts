import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  clients,
  followUps,
  invoices,
  paymentProofs,
  paymentReminders,
  payments,
  paymentVerifications,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Invalid payment id." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      const data = operationalStore.getPaymentById(id);
      if (!data) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
      return NextResponse.json({
        payment: data.payment,
        client: data.client,
        invoice: data.invoice,
        proofs: data.payment.verification
          ? [
              {
                id: 1,
                paymentId: id,
                extractedAmount: data.payment.verification.extractedAmount,
                extractedReference: data.payment.verification.reference,
                confidence: data.payment.verification.confidence,
                extractedDate: data.payment.verification.extractedDate,
                fileType: "image/png",
                fileSize: 245000,
                createdAt: data.payment.createdAt,
              },
            ]
          : [],
        verifications: data.payment.verification ? [{ id: 1, status: "VERIFIED", matchStatus: "MATCH" }] : [],
        reminders: [],
        followUps: data.followUps,
        timeline: [],
      });
    }

    const db = getDb();
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    let client = null;
    if (payment.clientId) {
      const [c] = await db.select().from(clients).where(eq(clients.id, payment.clientId));
      client = c ?? null;
    }

    let invoice = null;
    if (payment.invoiceId) {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, payment.invoiceId));
      invoice = inv ?? null;
    }

    const proofs = await db
      .select()
      .from(paymentProofs)
      .where(eq(paymentProofs.paymentId, id))
      .orderBy(desc(paymentProofs.id));

    const verifications = await db
      .select()
      .from(paymentVerifications)
      .where(eq(paymentVerifications.paymentId, id))
      .orderBy(desc(paymentVerifications.id));

    const reminders = await db
      .select()
      .from(paymentReminders)
      .where(eq(paymentReminders.paymentId, id))
      .orderBy(desc(paymentReminders.id));

    const clientFollowUps = await db
      .select()
      .from(followUps)
      .where(eq(followUps.paymentId, id))
      .orderBy(desc(followUps.id));

    const timeline = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.paymentId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20);

    return NextResponse.json({
      payment,
      client,
      invoice,
      proofs,
      verifications,
      reminders,
      followUps: clientFollowUps,
      timeline,
    });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const id = Number((await params).id);
      const data = operationalStore.getPaymentById(id);
      if (data) {
        return NextResponse.json({
          payment: data.payment,
          client: data.client,
          invoice: data.invoice,
          proofs: data.payment.verification
            ? [
                {
                  id: 1,
                  paymentId: id,
                  extractedAmount: data.payment.verification.extractedAmount,
                  extractedReference: data.payment.verification.reference,
                  confidence: data.payment.verification.confidence,
                  extractedDate: data.payment.verification.extractedDate,
                  fileType: "image/png",
                  fileSize: 245000,
                  createdAt: data.payment.createdAt,
                },
              ]
            : [],
          verifications: data.payment.verification ? [{ id: 1, status: "VERIFIED", matchStatus: "MATCH" }] : [],
          reminders: [],
          followUps: data.followUps,
          timeline: [],
        });
      }
      return databaseNotConfiguredResponse();
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to retrieve payment." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
