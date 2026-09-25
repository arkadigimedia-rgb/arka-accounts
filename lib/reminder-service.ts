import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, clients, notifications, paymentReminders, payments } from "@/db/schema";
import { EmailReminderProvider, type ReminderDeliveryProvider } from "@/lib/reminder-delivery";
import { reminderEligibility, type ReminderType } from "@/lib/reminder-eligibility";

export class ReminderService {
  constructor(private readonly delivery: ReminderDeliveryProvider = new EmailReminderProvider()) {}

  async processEligibleReminders(actorId?: number) {
    const db = getDb();
    const rows = await db
      .select({
        id: payments.id,
        client: payments.client,
        service: payments.service,
        expectedAmount: payments.expectedAmount,
        dueDate: payments.dueDate,
        status: payments.status,
        email: clients.email,
        reference: payments.sourceReference,
      })
      .from(payments)
      .leftJoin(clients, eq(payments.clientId, clients.id));

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      const candidates = reminderEligibility.getEligibleReminders({ ...row, email: row.email ?? null });
      for (const candidate of candidates) {
        const scheduledFor = `${candidate.scheduledFor}T00:00:00+05:30`;

        try {
          // Check if already sent or processing for this window
          const [existing] = await db
            .select()
            .from(paymentReminders)
            .where(
              and(
                eq(paymentReminders.paymentId, row.id),
                eq(paymentReminders.type, candidate.reminderType),
                eq(paymentReminders.scheduledFor, scheduledFor)
              )
            );

          if (existing) {
            skipped++;
            continue;
          }

          const [reminder] = await db
            .insert(paymentReminders)
            .values({
              paymentId: row.id,
              type: candidate.reminderType,
              scheduledFor,
              channel: "EMAIL",
              status: "PROCESSING",
            })
            .returning();

          processed++;

          const result = await this.delivery.sendReminder({
            type: candidate.reminderType,
            recipient: candidate.recipient,
            client: row.client,
            service: row.service,
            amount: row.expectedAmount,
            dueDate: row.dueDate,
            reference: row.reference,
          });

          if (result.ok) {
            sent++;
            await db.transaction(async (tx) => {
              await tx
                .update(paymentReminders)
                .set({ status: "SENT", sentAt: new Date().toISOString() })
                .where(eq(paymentReminders.id, reminder.id));

              await tx.insert(auditLogs).values({
                paymentId: row.id,
                userId: actorId || null,
                entityType: "reminder",
                entityId: String(reminder.id),
                action: "REMINDER_SENT",
                metadata: { type: candidate.reminderType, recipient: candidate.recipient },
              });

              await tx.insert(notifications).values({
                userId: actorId ?? null,
                paymentId: row.id,
                type: "REMINDER_SENT",
                title: "Payment reminder sent",
                message: `Reminder successfully sent to ${row.client} (${candidate.recipient}).`,
              });
            });
          } else {
            failed++;
            await db.transaction(async (tx) => {
              await tx
                .update(paymentReminders)
                .set({ status: "FAILED", errorMessage: result.code })
                .where(eq(paymentReminders.id, reminder.id));

              await tx.insert(auditLogs).values({
                paymentId: row.id,
                userId: actorId || null,
                entityType: "reminder",
                entityId: String(reminder.id),
                action: "REMINDER_FAILED",
                metadata: { type: candidate.reminderType, error: result.code },
              });
            });
          }
        } catch {
          // Isolate error per reminder candidate to prevent aborting entire batch
          skipped++;
        }
      }
    }

    return { processed, sent, failed, skipped };
  }

  async retryReminder(reminderId: number, actorId?: number) {
    const db = getDb();
    const [row] = await db
      .select({
        reminder: paymentReminders,
        payment: payments,
        client: clients,
      })
      .from(paymentReminders)
      .innerJoin(payments, eq(paymentReminders.paymentId, payments.id))
      .leftJoin(clients, eq(payments.clientId, clients.id))
      .where(eq(paymentReminders.id, reminderId));

    if (!row) throw new Error("REMINDER_NOT_FOUND");
    if (row.reminder.status !== "FAILED") throw new Error("ONLY_FAILED_REMINDERS_RETRIABLE");

    const recipient = row.client?.email;
    if (!recipient) {
      await db
        .update(paymentReminders)
        .set({ status: "FAILED", errorMessage: "CLIENT_EMAIL_MISSING" })
        .where(eq(paymentReminders.id, reminderId));
      return { id: reminderId, status: "FAILED", code: "CLIENT_EMAIL_MISSING" };
    }

    const result = await this.delivery.sendReminder({
      type: row.reminder.type as ReminderType,
      recipient,
      client: row.payment.client,
      service: row.payment.service,
      amount: row.payment.expectedAmount,
      dueDate: row.payment.dueDate,
      reference: row.payment.sourceReference,
    });

    if (result.ok) {
      await db.transaction(async (tx) => {
        await tx
          .update(paymentReminders)
          .set({ status: "SENT", sentAt: new Date().toISOString(), errorMessage: null })
          .where(eq(paymentReminders.id, reminderId));

        await tx.insert(auditLogs).values({
          paymentId: row.payment.id,
          userId: actorId || null,
          entityType: "reminder",
          entityId: String(reminderId),
          action: "REMINDER_RETRIED_SUCCESS",
          metadata: { type: row.reminder.type },
        });
      });
      return { id: reminderId, status: "SENT" };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(paymentReminders)
        .set({ status: "FAILED", errorMessage: result.code })
        .where(eq(paymentReminders.id, reminderId));

      await tx.insert(auditLogs).values({
        paymentId: row.payment.id,
        userId: actorId || null,
        entityType: "reminder",
        entityId: String(reminderId),
        action: "REMINDER_RETRIED_FAILED",
        metadata: { type: row.reminder.type, error: result.code },
      });
    });

    return { id: reminderId, status: "FAILED", code: result.code };
  }

  async listReminders(filters: { status?: string; type?: string; limit?: number } = {}) {
    const db = getDb();
    return db
      .select({
        id: paymentReminders.id,
        paymentId: paymentReminders.paymentId,
        client: payments.client,
        service: payments.service,
        type: paymentReminders.type,
        scheduledFor: paymentReminders.scheduledFor,
        sentAt: paymentReminders.sentAt,
        channel: paymentReminders.channel,
        status: paymentReminders.status,
        errorMessage: paymentReminders.errorMessage,
        createdAt: paymentReminders.createdAt,
      })
      .from(paymentReminders)
      .innerJoin(payments, eq(paymentReminders.paymentId, payments.id))
      .where(filters.status ? eq(paymentReminders.status, filters.status) : undefined)
      .orderBy(desc(paymentReminders.id))
      .limit(filters.limit ?? 50);
  }
}
