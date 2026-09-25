import { and, desc, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, followUps, notifications, payments, users } from "@/db/schema";

export type CreateFollowUpInput = {
  paymentId: number;
  userId: number;
  action: string;
  notes?: string | null;
  followUpDate: string;
};

export class FollowUpService {
  async createFollowUp(input: CreateFollowUpInput) {
    const db = getDb();
    const [payment] = await db.select().from(payments).where(eq(payments.id, input.paymentId));
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");

    return db.transaction(async (tx) => {
      const [followUp] = await tx
        .insert(followUps)
        .values({
          paymentId: input.paymentId,
          userId: input.userId,
          action: input.action,
          notes: input.notes ?? null,
          followUpDate: input.followUpDate,
          status: "PENDING",
        })
        .returning();

      await tx.insert(auditLogs).values({
        paymentId: input.paymentId,
        userId: input.userId,
        entityType: "follow_up",
        entityId: String(followUp.id),
        action: "FOLLOW_UP_CREATED",
        newValue: JSON.stringify({ action: input.action, followUpDate: input.followUpDate }),
        metadata: { notes: input.notes },
      });

      return followUp;
    });
  }

  async listFollowUps(filters: { paymentId?: number; status?: string; dueBefore?: string; limit?: number } = {}) {
    const db = getDb();
    const conditions = [];
    if (filters.paymentId) conditions.push(eq(followUps.paymentId, filters.paymentId));
    if (filters.status) conditions.push(eq(followUps.status, filters.status));
    if (filters.dueBefore) conditions.push(lte(followUps.followUpDate, filters.dueBefore));

    return db
      .select({
        id: followUps.id,
        paymentId: followUps.paymentId,
        client: payments.client,
        service: payments.service,
        amount: payments.expectedAmount,
        dueDate: payments.dueDate,
        paymentStatus: payments.status,
        action: followUps.action,
        notes: followUps.notes,
        followUpDate: followUps.followUpDate,
        status: followUps.status,
        creatorName: users.name,
        createdAt: followUps.createdAt,
      })
      .from(followUps)
      .innerJoin(payments, eq(followUps.paymentId, payments.id))
      .leftJoin(users, eq(followUps.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(followUps.followUpDate))
      .limit(filters.limit ?? 50);
  }

  async completeFollowUp(id: number, userId: number) {
    const db = getDb();
    const [existing] = await db.select().from(followUps).where(eq(followUps.id, id));
    if (!existing) throw new Error("FOLLOW_UP_NOT_FOUND");

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(followUps)
        .set({ status: "COMPLETED" })
        .where(eq(followUps.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        paymentId: existing.paymentId,
        userId,
        entityType: "follow_up",
        entityId: String(id),
        action: "FOLLOW_UP_COMPLETED",
      });

      return updated;
    });
  }
}

export const followUpService = new FollowUpService();
