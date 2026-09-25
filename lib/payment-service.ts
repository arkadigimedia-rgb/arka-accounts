import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, invoices, notifications, payments } from "@/db/schema";
import { canTransition, type PaymentStatus } from "@/lib/payment-state";

export class PaymentService {
  async changeStatus(paymentId: number, next: PaymentStatus, actorId?: number, source = "payment-service") {
    const db = getDb();
    const current = (await db.select().from(payments).where(eq(payments.id, paymentId)))[0];
    if (!current) throw new Error("PAYMENT_NOT_FOUND");
    if (!canTransition(current.status as PaymentStatus, next)) throw new Error("INVALID_PAYMENT_TRANSITION");
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: next,
          updatedAt: now,
          verifiedAt: next === "PAID" ? now : current.verifiedAt,
          verifiedBy: next === "PAID" ? (actorId ?? null) : current.verifiedBy,
        })
        .where(eq(payments.id, paymentId));

      // Synchronize linked invoice
      if (current.invoiceId) {
        let invoiceStatus: string | null = null;
        if (next === "PAID") invoiceStatus = "PAID";
        else if (next === "OVERDUE") invoiceStatus = "OVERDUE";
        else if (next === "DUE_TODAY") invoiceStatus = "DUE";

        if (invoiceStatus) {
          await tx
            .update(invoices)
            .set({
              status: invoiceStatus,
              paidAt: next === "PAID" ? now : null,
              updatedAt: now,
            })
            .where(eq(invoices.id, current.invoiceId));
        }
      }

      await tx.insert(auditLogs).values({
        paymentId,
        invoiceId: current.invoiceId ?? null,
        userId: actorId ?? null,
        entityType: "payment",
        entityId: String(paymentId),
        action: "PAYMENT_STATUS_CHANGED",
        oldValue: current.status,
        newValue: next,
        metadata: { source },
      });

      await tx.insert(notifications).values({
        userId: actorId ?? null,
        paymentId,
        invoiceId: current.invoiceId ?? null,
        type: "PAYMENT_STATUS_CHANGED",
        title: "Payment status updated",
        message: `${current.client}: ${next}`,
      });
    });

    return { id: paymentId, status: next };
  }

  async timeline(paymentId: number) {
    return getDb().select().from(auditLogs).where(eq(auditLogs.paymentId, paymentId));
  }
}

