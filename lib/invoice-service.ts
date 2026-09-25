import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, billingSchedules, clients, invoices, notifications, payments, services } from "@/db/schema";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { getStorageProvider } from "@/lib/storage";
import { deriveDateStatus } from "@/lib/payment-state";
import { EmailReminderProvider } from "@/lib/reminder-delivery";

const kolkataToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

const addDays = (dateStr: string, days: number) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const nextBillingDates = (currentDateStr: string, frequency: string, termsDays: number) => {
  const d = new Date(`${currentDateStr}T00:00:00Z`);
  const monthsToAdd = frequency.toUpperCase() === "QUARTERLY" ? 3 : 1;
  d.setUTCMonth(d.getUTCMonth() + monthsToAdd);
  const nextInvoiceDate = d.toISOString().slice(0, 10);
  const nextDueDate = addDays(nextInvoiceDate, termsDays);
  return { nextInvoiceDate, nextDueDate };
};

export class InvoiceService {
  async generateNextInvoiceNumber(): Promise<string> {
    const db = getDb();
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const [latest] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${prefix + "%"}`)
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1);

    let nextSeq = 1;
    if (latest?.invoiceNumber) {
      const parts = latest.invoiceNumber.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastNum)) nextSeq = lastNum + 1;
    }
    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  async generateInvoiceForSchedule(
    scheduleId: number,
    options: { targetDate?: string; actorId?: number } = {}
  ) {
    const db = getDb();
    const [schedule] = await db.select().from(billingSchedules).where(eq(billingSchedules.id, scheduleId));
    if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
    if (!schedule.active || schedule.status !== "ACTIVE") throw new Error("SCHEDULE_INACTIVE");

    const [client] = await db.select().from(clients).where(eq(clients.id, schedule.clientId));
    if (!client) throw new Error("CLIENT_NOT_FOUND");

    const [service] = schedule.serviceId
      ? await db.select().from(services).where(eq(services.id, schedule.serviceId))
      : [null];

    const today = options.targetDate || kolkataToday();
    const terms = schedule.paymentTermsDays ?? 7;
    const dueDate = addDays(today, terms);

    const billingPeriodStart = schedule.billingFrom || today;
    const billingPeriodEnd = schedule.billingTo || addDays(today, schedule.billingFrequency === "QUARTERLY" ? 90 : 30);

    // Prevent duplicate invoices for the same schedule and billing period
    const [existing] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.billingScheduleId, scheduleId),
          eq(invoices.billingPeriodStart, billingPeriodStart),
          eq(invoices.billingPeriodEnd, billingPeriodEnd)
        )
      );

    if (existing) {
      return { invoice: existing, payment: null, duplicate: true };
    }

    const subtotal = schedule.expectedAmount || schedule.amount || 0;
    const taxRate = client.gstNumber ? 0.18 : 0;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const invoiceNumber = await this.generateNextInvoiceNumber();
    const serviceName = service?.name || "Professional Services";
    const serviceDesc = service?.description || `Billing cycle: ${schedule.billingFrequency}`;

    // Generate real PDF binary
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber,
      issueDate: today,
      dueDate,
      billingPeriodStart,
      billingPeriodEnd,
      client: {
        name: client.name,
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        address: client.address,
        city: client.city,
        state: client.state,
        gstNumber: client.gstNumber,
      },
      service: {
        name: serviceName,
        description: serviceDesc,
      },
      subtotal,
      taxAmount,
      totalAmount,
      currency: schedule.currency || "INR",
    });

    // Store PDF in private storage
    const storageKey = `invoices/${invoiceNumber}.pdf`;
    const storage = getStorageProvider();
    await storage.put(storageKey, pdfBytes.buffer as ArrayBuffer, "application/pdf");

    // Atomic DB persistence
    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          invoiceNumber,
          clientId: client.id,
          serviceId: service?.id ?? null,
          billingScheduleId: schedule.id,
          issueDate: today,
          dueDate,
          billingPeriodStart,
          billingPeriodEnd,
          subtotal,
          taxAmount,
          totalAmount,
          currency: schedule.currency || "INR",
          status: "GENERATED",
          pdfStorageKey: storageKey,
        })
        .returning();

      const initialStatus = deriveDateStatus(dueDate);
      const [payment] = await tx
        .insert(payments)
        .values({
          invoiceId: invoice.id,
          clientId: client.id,
          paymentScheduleId: schedule.id,
          client: client.companyName || client.name,
          service: serviceName,
          owner: "Finance Team",
          billingFrom: billingPeriodStart,
          billingTo: billingPeriodEnd,
          expectedAmount: totalAmount,
          dueDate,
          status: initialStatus,
          sourceReference: invoiceNumber,
        })
        .returning();

      // Advance schedule next billing date if recurring
      if (schedule.billingType === "RECURRING") {
        const { nextInvoiceDate, nextDueDate } = nextBillingDates(today, schedule.billingFrequency, terms);
        await tx
          .update(billingSchedules)
          .set({ nextInvoiceDate, nextDueDate, updatedAt: new Date().toISOString() })
          .where(eq(billingSchedules.id, schedule.id));
      }

      await tx.insert(auditLogs).values({
        paymentId: payment.id,
        invoiceId: invoice.id,
        userId: options.actorId ?? null,
        entityType: "invoice",
        entityId: String(invoice.id),
        action: "INVOICE_GENERATED",
        newValue: JSON.stringify({ invoiceNumber, totalAmount, dueDate }),
        metadata: { scheduleId: schedule.id, subtotal, taxAmount },
      });

      await tx.insert(notifications).values({
        userId: options.actorId ?? null,
        paymentId: payment.id,
        invoiceId: invoice.id,
        type: "INVOICE_GENERATED",
        title: `Invoice ${invoiceNumber} generated`,
        message: `Invoice generated for ${client.name} totaling ₹${totalAmount}.`,
      });

      return { invoice, payment, duplicate: false };
    });
  }

  async getInvoice(id: number) {
    const db = getDb();
    const [row] = await db
      .select({
        invoice: invoices,
        client: clients,
        service: services,
        schedule: billingSchedules,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(services, eq(invoices.serviceId, services.id))
      .leftJoin(billingSchedules, eq(invoices.billingScheduleId, billingSchedules.id))
      .where(eq(invoices.id, id));

    if (!row) return null;
    const [payment] = await db.select().from(payments).where(eq(payments.invoiceId, id));
    return { ...row, payment: payment ?? null };
  }

  async listInvoices(filters: { clientId?: number; status?: string; search?: string; limit?: number } = {}) {
    const db = getDb();
    const conditions = [];
    if (filters.clientId) conditions.push(eq(invoices.clientId, filters.clientId));
    if (filters.status) conditions.push(eq(invoices.status, filters.status));

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId,
        clientName: clients.name,
        companyName: clients.companyName,
        totalAmount: invoices.totalAmount,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        pdfStorageKey: invoices.pdfStorageKey,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(invoices.id))
      .limit(filters.limit ?? 100);

    if (filters.search) {
      const q = filters.search.toLowerCase();
      return rows.filter(
        (r) =>
          r.invoiceNumber.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (r.companyName && r.companyName.toLowerCase().includes(q))
      );
    }
    return rows;
  }
}

export const invoiceService = new InvoiceService();
