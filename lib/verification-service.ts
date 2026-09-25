import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, invoices, notifications, paymentVerifications, payments } from "@/db/schema";

export class VerificationService {
  async approve(verificationId: number, actor: { id: number; role: string }) {
    if (!["FOUNDER", "ACCOUNTS_MANAGER"].includes(actor.role)) {
      throw new Error("FORBIDDEN");
    }
    const db = getDb();
    const [verification] = await db
      .select()
      .from(paymentVerifications)
      .where(eq(paymentVerifications.id, verificationId));

    if (!verification) throw new Error("VERIFICATION_NOT_FOUND");
    if (!["MATCH", "MANUAL_REVIEW"].includes(verification.result ?? "")) {
      throw new Error("VERIFICATION_NOT_APPROVABLE");
    }

    const [currentPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, verification.paymentId));

    if (!currentPayment) throw new Error("PAYMENT_NOT_FOUND");
    if (!["VERIFIED", "MANUAL_REVIEW"].includes(currentPayment.status)) {
      throw new Error("VERIFICATION_NOT_APPROVABLE");
    }

    const now = new Date().toISOString();
    const paidDate = verification.extractedDate || now.slice(0, 10);
    const paidAmount = verification.extractedAmount || currentPayment.expectedAmount;

    // Execute atomic approval across verification, payment, and invoice in ONE transaction
    await db.transaction(async (tx) => {
      // 1. Update verification record
      await tx
        .update(paymentVerifications)
        .set({
          result: "APPROVED",
          reviewedBy: actor.id,
          reviewedAt: now,
        })
        .where(eq(paymentVerifications.id, verificationId));

      // 2. Update payment record to PAID
      await tx
        .update(payments)
        .set({
          status: "PAID",
          paidAmount,
          paidDate,
          transactionId: verification.transactionId,
          utr: verification.utr,
          detectedAmount: verification.extractedAmount,
          verifiedAt: now,
          verifiedBy: actor.id,
          updatedAt: now,
        })
        .where(eq(payments.id, currentPayment.id));

      // 3. Update linked invoice to PAID
      if (currentPayment.invoiceId) {
        await tx
          .update(invoices)
          .set({
            status: "PAID",
            paidAt: now,
            updatedAt: now,
          })
          .where(eq(invoices.id, currentPayment.invoiceId));
      }

      // 4. Record audit log
      await tx.insert(auditLogs).values({
        paymentId: currentPayment.id,
        invoiceId: currentPayment.invoiceId ?? null,
        userId: actor.id,
        entityType: "payment",
        entityId: String(currentPayment.id),
        action: "PAYMENT_APPROVED",
        oldValue: currentPayment.status,
        newValue: "PAID",
        metadata: {
          verificationId,
          paidAmount,
          utr: verification.utr,
          transactionId: verification.transactionId,
        },
      });

      // 5. Create notification
      await tx.insert(notifications).values({
        userId: actor.id,
        paymentId: currentPayment.id,
        invoiceId: currentPayment.invoiceId ?? null,
        type: "PAYMENT_APPROVED",
        title: "Payment Approved & Marked Paid",
        message: `Payment of ₹${paidAmount} for ${currentPayment.client} was verified and approved by accounts.`,
      });
    });

    return { paymentId: currentPayment.id, status: "PAID" };
  }

  async reject(verificationId: number, actor: { id: number; role: string }, reason: string) {
    if (!["FOUNDER", "ACCOUNTS_MANAGER"].includes(actor.role)) {
      throw new Error("FORBIDDEN");
    }
    if (!reason.trim()) throw new Error("REJECTION_REASON_REQUIRED");
    const db = getDb();
    const [v] = await db.select().from(paymentVerifications).where(eq(paymentVerifications.id, verificationId));
    if (!v) throw new Error("VERIFICATION_NOT_FOUND");

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx
        .update(paymentVerifications)
        .set({
          result: "REJECTED",
          reason,
          reviewedBy: actor.id,
          reviewedAt: now,
        })
        .where(eq(paymentVerifications.id, verificationId));

      await tx
        .update(payments)
        .set({ status: "REJECTED", updatedAt: now })
        .where(eq(payments.id, v.paymentId));

      await tx.insert(auditLogs).values({
        paymentId: v.paymentId,
        userId: actor.id,
        entityType: "verification",
        entityId: String(verificationId),
        action: "PAYMENT_VERIFICATION_REJECTED",
        newValue: reason,
      });

      await tx.insert(notifications).values({
        userId: actor.id,
        paymentId: v.paymentId,
        type: "PAYMENT_VERIFICATION_REJECTED",
        title: "Payment proof rejected",
        message: reason,
      });
    });

    return { paymentId: v.paymentId, status: "REJECTED" };
  }

  async requestReupload(verificationId: number, actor: { id: number; role: string }, reason: string) {
    if (!["FOUNDER", "ACCOUNTS_MANAGER"].includes(actor.role)) {
      throw new Error("FORBIDDEN");
    }
    if (!reason.trim()) throw new Error("REUPLOAD_REASON_REQUIRED");
    const db = getDb();
    const [v] = await db.select().from(paymentVerifications).where(eq(paymentVerifications.id, verificationId));
    if (!v) throw new Error("VERIFICATION_NOT_FOUND");

    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx
        .update(paymentVerifications)
        .set({
          reuploadReason: reason,
          reuploadRequestedBy: actor.id,
          reuploadRequestedAt: now,
        })
        .where(eq(paymentVerifications.id, verificationId));

      // Transition payment to REJECTED so replacement proof can be uploaded
      await tx
        .update(payments)
        .set({ status: "REJECTED", updatedAt: now })
        .where(eq(payments.id, v.paymentId));

      await tx.insert(auditLogs).values({
        paymentId: v.paymentId,
        userId: actor.id,
        entityType: "verification",
        entityId: String(verificationId),
        action: "PAYMENT_PROOF_REUPLOAD_REQUESTED",
        newValue: reason,
      });

      await tx.insert(notifications).values({
        userId: actor.id,
        paymentId: v.paymentId,
        type: "PAYMENT_PROOF_REUPLOAD_REQUESTED",
        title: "New payment proof requested",
        message: reason,
      });
    });

    return { paymentId: v.paymentId, status: "REJECTED" };
  }
}
