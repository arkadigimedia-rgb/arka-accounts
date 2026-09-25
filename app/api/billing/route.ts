import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, billingSchedules, clients, services } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(request: Request) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    if (!process.env.DATABASE_URL) {
      const rows = operationalStore.getBillingSchedules();
      let filtered = rows;
      if (clientId) filtered = filtered.filter((s) => s.clientId === Number(clientId));
      if (status) filtered = filtered.filter((s) => s.status === status);
      return NextResponse.json(filtered);
    }

    const db = getDb();
    const conditions = [];
    if (clientId) conditions.push(eq(billingSchedules.clientId, Number(clientId)));
    if (status) conditions.push(eq(billingSchedules.status, status));

    const rows = await db
      .select({
        id: billingSchedules.id,
        clientId: billingSchedules.clientId,
        clientName: clients.name,
        companyName: clients.companyName,
        serviceId: billingSchedules.serviceId,
        serviceName: services.name,
        billingType: billingSchedules.billingType,
        billingFrequency: billingSchedules.billingFrequency,
        expectedAmount: billingSchedules.expectedAmount,
        currency: billingSchedules.currency,
        invoiceGenerationDay: billingSchedules.invoiceGenerationDay,
        paymentTermsDays: billingSchedules.paymentTermsDays,
        nextInvoiceDate: billingSchedules.nextInvoiceDate,
        nextDueDate: billingSchedules.nextDueDate,
        autoGenerateInvoice: billingSchedules.autoGenerateInvoice,
        autoSendInvoice: billingSchedules.autoSendInvoice,
        status: billingSchedules.status,
        createdAt: billingSchedules.createdAt,
      })
      .from(billingSchedules)
      .innerJoin(clients, eq(billingSchedules.clientId, clients.id))
      .leftJoin(services, eq(billingSchedules.serviceId, services.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(billingSchedules.id));

    return NextResponse.json(rows);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const { searchParams } = new URL(request.url);
      const clientId = searchParams.get("clientId");
      const status = searchParams.get("status");
      let filtered = operationalStore.getBillingSchedules();
      if (clientId) filtered = filtered.filter((s) => s.clientId === Number(clientId));
      if (status) filtered = filtered.filter((s) => s.status === status);
      return NextResponse.json(filtered);
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to load billing schedules." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const body = (await request.json()) as {
      clientId: number;
      serviceId?: number;
      billingType?: string;
      billingFrequency?: string;
      expectedAmount: number;
      currency?: string;
      invoiceGenerationDay?: number;
      paymentTermsDays?: number;
      nextInvoiceDate?: string;
      nextDueDate?: string;
      autoGenerateInvoice?: boolean;
      autoSendInvoice?: boolean;
    };

    if (!body.clientId || !body.expectedAmount) {
      return NextResponse.json({ error: "clientId and expectedAmount are required." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          id: Date.now(),
          ...body,
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
        },
        { status: 201 }
      );
    }

    const db = getDb();
    const [schedule] = await db
      .insert(billingSchedules)
      .values({
        clientId: body.clientId,
        serviceId: body.serviceId || null,
        billingType: body.billingType || "RECURRING",
        billingFrequency: body.billingFrequency || "MONTHLY",
        expectedAmount: body.expectedAmount,
        amount: body.expectedAmount,
        currency: body.currency || "INR",
        dueDate: body.nextDueDate || "2026-10-05",
        invoiceGenerationDay: body.invoiceGenerationDay || 1,
        paymentTermsDays: body.paymentTermsDays || 7,
        nextInvoiceDate: body.nextInvoiceDate || null,
        nextDueDate: body.nextDueDate || null,
        autoGenerateInvoice: body.autoGenerateInvoice ?? true,
        autoSendInvoice: body.autoSendInvoice ?? false,
        status: "ACTIVE",
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      entityType: "billing_schedule",
      entityId: String(schedule.id),
      action: "BILLING_SCHEDULE_CREATED",
      newValue: JSON.stringify({ clientId: schedule.clientId, amount: schedule.expectedAmount }),
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to create billing schedule." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
