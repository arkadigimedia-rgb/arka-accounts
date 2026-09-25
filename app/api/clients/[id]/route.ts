import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditLogs,
  billingSchedules,
  clients,
  followUps,
  invoices,
  payments,
  services,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const id = Number((await params).id);

    if (!process.env.DATABASE_URL) {
      const data = operationalStore.getClientById(id);
      if (!data) return NextResponse.json({ error: "Client not found." }, { status: 404 });
      return NextResponse.json({
        client: data.client,
        services: [
          {
            id,
            name: data.client.service,
            description: data.client.serviceDescription,
            billingAmount: data.client.monthlyFee,
            currency: "INR",
            status: "ACTIVE",
          },
        ],
        schedules: data.schedules,
        billingSchedules: data.schedules,
        invoices: data.invoices,
        payments: data.payments,
        followUps: data.followUps,
        metrics: {
          totalInvoiced: data.metrics.totalBilled,
          totalPaid: data.metrics.totalCollected,
          outstanding: data.metrics.outstanding,
          overdue: data.payments
            .filter((p) => p.status === "OVERDUE")
            .reduce((s, p) => s + p.expectedAmount, 0),
        },
        stats: {
          totalInvoiced: data.metrics.totalBilled,
          totalPaid: data.metrics.totalCollected,
          outstanding: data.metrics.outstanding,
          overdue: data.payments
            .filter((p) => p.status === "OVERDUE")
            .reduce((s, p) => s + p.expectedAmount, 0),
        },
        timeline: [],
      });
    }

    const db = getDb();
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const clientServices = await db.select().from(services).where(eq(services.clientId, id));
    const schedules = await db.select().from(billingSchedules).where(eq(billingSchedules.clientId, id));
    const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, id)).orderBy(desc(invoices.id));
    const clientPayments = await db.select().from(payments).where(eq(payments.clientId, id)).orderBy(desc(payments.id));
    const paymentIds = clientPayments.map((p) => p.id);
    let clientFollowUps: any[] = [];
    if (paymentIds.length > 0) {
      clientFollowUps = await db
        .select()
        .from(followUps)
        .where(sql`${followUps.paymentId} IN ${paymentIds}`)
        .orderBy(desc(followUps.id));
    }

    const totalInvoiced = clientInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalPaid = clientPayments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + (p.paidAmount || p.expectedAmount || 0), 0);

    const outstanding = clientPayments
      .filter((p) => p.status !== "PAID" && p.status !== "REJECTED")
      .reduce((s, p) => s + p.expectedAmount, 0);

    const overdue = clientPayments
      .filter((p) => p.status === "OVERDUE")
      .reduce((s, p) => s + p.expectedAmount, 0);

    const timeline = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, String(id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30);

    return NextResponse.json({
      client,
      services: clientServices,
      schedules,
      billingSchedules: schedules,
      invoices: clientInvoices,
      payments: clientPayments,
      followUps: clientFollowUps,
      metrics: {
        totalInvoiced,
        totalPaid,
        outstanding,
        overdue,
      },
      stats: {
        totalInvoiced,
        totalPaid,
        outstanding,
        overdue,
      },
      timeline,
    });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const id = Number((await params).id);
      const data = operationalStore.getClientById(id);
      if (data) {
        return NextResponse.json({
          client: data.client,
          services: [{ id, name: data.client.service, description: data.client.serviceDescription, billingAmount: data.client.monthlyFee, currency: "INR", status: "ACTIVE" }],
          schedules: data.schedules,
          billingSchedules: data.schedules,
          invoices: data.invoices,
          payments: data.payments,
          followUps: data.followUps,
          metrics: {
            totalInvoiced: data.metrics.totalBilled,
            totalPaid: data.metrics.totalCollected,
            outstanding: data.metrics.outstanding,
            overdue: data.payments.filter((p) => p.status === "OVERDUE").reduce((s, p) => s + p.expectedAmount, 0),
          },
          stats: {
            totalInvoiced: data.metrics.totalBilled,
            totalPaid: data.metrics.totalCollected,
            outstanding: data.metrics.outstanding,
            overdue: data.payments.filter((p) => p.status === "OVERDUE").reduce((s, p) => s + p.expectedAmount, 0),
          },
          timeline: [],
        });
      }
      return databaseNotConfiguredResponse();
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to load client profile." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const id = Number((await params).id);
    const body = (await request.json()) as any;

    if (!process.env.DATABASE_URL) {
      const data = operationalStore.getClientById(id);
      if (!data) return NextResponse.json({ error: "Client not found." }, { status: 404 });
      Object.assign(data.client, body, { updatedAt: new Date().toISOString() });
      return NextResponse.json(data.client);
    }

    const db = getDb();
    const [updated] = await db
      .update(clients)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(clients.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    await db.insert(auditLogs).values({
      userId: user.id,
      entityType: "client",
      entityId: String(id),
      action: "CLIENT_UPDATED",
      newValue: JSON.stringify(body),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to update client." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
