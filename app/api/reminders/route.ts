import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentReminders, payments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(request: Request) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER");

    if (!process.env.DATABASE_URL) {
      const q = new URL(request.url).searchParams;
      let rows = operationalStore.getReminders();
      if (q.get("status")) rows = rows.filter((r) => r.status === q.get("status"));
      if (q.get("type")) rows = rows.filter((r) => r.reminderType === q.get("type"));
      if (q.get("paymentId")) rows = rows.filter((r) => r.paymentId === Number(q.get("paymentId")));
      return NextResponse.json(
        rows.map((r) => ({
          id: r.id,
          paymentId: r.paymentId,
          client: r.clientName,
          type: r.reminderType,
          scheduledFor: r.sentAt || "2026-10-01T09:00:00Z",
          sentAt: r.sentAt,
          channel: r.channel,
          status: r.status,
          errorMessage: null,
          createdAt: r.sentAt || new Date().toISOString(),
        }))
      );
    }

    const q = new URL(request.url).searchParams;
    const conditions = [];
    if (q.get("status")) conditions.push(eq(paymentReminders.status, q.get("status")!));
    if (q.get("type")) conditions.push(eq(paymentReminders.type, q.get("type")!));
    if (q.get("paymentId")) conditions.push(eq(paymentReminders.paymentId, Number(q.get("paymentId"))));
    if (q.get("clientId")) conditions.push(eq(payments.clientId, Number(q.get("clientId"))));
    if (q.get("from")) conditions.push(gte(paymentReminders.scheduledFor, q.get("from")!));
    if (q.get("to")) conditions.push(lte(paymentReminders.scheduledFor, q.get("to")!));
    const limit = Math.min(Number(q.get("limit") ?? 50), 100);

    const rows = await getDb()
      .select({
        id: paymentReminders.id,
        paymentId: paymentReminders.paymentId,
        client: payments.client,
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
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(limit);

    return NextResponse.json(rows);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return NextResponse.json(
        operationalStore.getReminders().map((r) => ({
          id: r.id,
          paymentId: r.paymentId,
          client: r.clientName,
          type: r.reminderType,
          scheduledFor: r.sentAt || "2026-10-01T09:00:00Z",
          sentAt: r.sentAt,
          channel: r.channel,
          status: r.status,
          errorMessage: null,
          createdAt: r.sentAt || new Date().toISOString(),
        }))
      );
    }
    return NextResponse.json({ error: "Unable to list reminders." }, { status: 500 });
  }
}
