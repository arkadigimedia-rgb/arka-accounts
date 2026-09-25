import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, billingSchedules, clients, payments, services, syncLogs } from "@/db/schema";
import { type SheetProvider } from "@/lib/google-sheets";
import { normalizeSheetRow, type ImportError, type NormalizedSheetRecord } from "@/lib/sheet-import";
import { deriveDateStatus } from "@/lib/payment-state";

export type SyncResult = {
  syncId: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
};

export class SheetSyncService {
  constructor(private readonly provider: SheetProvider) {}

  async sync(actorId: number): Promise<SyncResult> {
    const db = getDb();
    const now = new Date().toISOString();
    const [log] = await db.insert(syncLogs).values({ startedAt: now, status: "RUNNING" }).returning();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: ImportError[] = [];

    try {
      const rows = await this.provider.getRows();
      for (let index = 0; index < rows.length; index++) {
        const parsed = normalizeSheetRow(rows[index], index + 2);
        if (!parsed.value) {
          skipped++;
          errors.push(...parsed.errors);
          continue;
        }

        try {
          const outcome = await this.upsert(parsed.value, actorId);
          if (outcome === "created") created++;
          else updated++;
        } catch (error) {
          failed++;
          errors.push({
            row: index + 2,
            field: "row",
            message: error instanceof Error ? error.message : "Unable to save row.",
          });
        }
      }

      await db
        .update(syncLogs)
        .set({
          completedAt: new Date().toISOString(),
          recordsProcessed: rows.length,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          recordsFailed: failed,
          status: failed ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
          errorDetails: errors.length ? errors : null,
        })
        .where(eq(syncLogs.id, log.id));

      return { syncId: log.id, processed: rows.length, created, updated, skipped, failed, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sheet synchronization failed.";
      await db
        .update(syncLogs)
        .set({ completedAt: new Date().toISOString(), status: "FAILED", errorDetails: { message } })
        .where(eq(syncLogs.id, log.id));
      throw error;
    }
  }

  private async upsert(value: NormalizedSheetRecord, actorId: number): Promise<"created" | "updated"> {
    return getDb().transaction(async (tx) => {
      const now = new Date().toISOString();

      // 1. Upsert Client (by clientCode or sourceReference or name)
      const clientConditions = [eq(clients.name, value.clientName)];
      if (value.clientCode) clientConditions.push(eq(clients.clientCode, value.clientCode));
      if (value.sourceReference) clientConditions.push(eq(clients.sourceReference, value.sourceReference));

      let [client] = await tx.select().from(clients).where(or(...clientConditions));

      if (!client) {
        [client] = await tx
          .insert(clients)
          .values({
            name: value.clientName,
            clientCode: value.clientCode,
            companyName: value.companyName,
            contactPerson: value.contactPerson,
            email: value.email,
            phone: value.phone,
            address: value.address,
            city: value.city,
            state: value.state,
            gstNumber: value.gstNumber,
            status: value.status,
            sourceReference: value.sourceReference,
          })
          .returning();
      } else {
        await tx
          .update(clients)
          .set({
            name: value.clientName,
            clientCode: value.clientCode || client.clientCode,
            companyName: value.companyName || client.companyName,
            contactPerson: value.contactPerson || client.contactPerson,
            email: value.email || client.email,
            phone: value.phone || client.phone,
            address: value.address || client.address,
            city: value.city || client.city,
            state: value.state || client.state,
            gstNumber: value.gstNumber || client.gstNumber,
            status: value.status || client.status,
            updatedAt: now,
          })
          .where(eq(clients.id, client.id));
      }

      // 2. Upsert Service (associated with client if possible)
      let [service] = await tx
        .select()
        .from(services)
        .where(and(eq(services.name, value.service), eq(services.clientId, client.id)));

      if (!service) {
        [service] = await tx
          .insert(services)
          .values({
            clientId: client.id,
            name: value.service,
            description: value.serviceDescription,
            billingAmount: value.amount,
            currency: value.currency,
            status: "ACTIVE",
          })
          .returning();
      } else {
        await tx
          .update(services)
          .set({
            billingAmount: value.amount,
            currency: value.currency,
            description: value.serviceDescription || service.description,
            updatedAt: now,
          })
          .where(eq(services.id, service.id));
      }

      // 3. Upsert Billing Schedule
      let [schedule] = await tx
        .select()
        .from(billingSchedules)
        .where(
          and(
            eq(billingSchedules.clientId, client.id),
            eq(billingSchedules.serviceId, service.id),
            eq(billingSchedules.dueDate, value.dueDate)
          )
        );

      const nextInvoice = value.billingStartDate || value.dueDate;
      if (!schedule) {
        [schedule] = await tx
          .insert(billingSchedules)
          .values({
            clientId: client.id,
            serviceId: service.id,
            billingType: value.billingType,
            billingFrequency: value.billingFrequency,
            billingFrom: value.billingStartDate,
            billingTo: value.billingEndDate,
            expectedAmount: value.amount,
            amount: value.amount,
            currency: value.currency,
            dueDate: value.dueDate,
            invoiceGenerationDay: value.invoiceGenerationDay,
            paymentTermsDays: value.paymentTermsDays,
            autoGenerateInvoice: value.autoGenerateInvoice,
            autoSendInvoice: value.autoSendInvoice,
            billingStartDate: value.billingStartDate,
            billingEndDate: value.billingEndDate,
            nextInvoiceDate: nextInvoice,
            nextDueDate: value.dueDate,
            status: value.status,
            sourceReference: value.sourceReference,
          })
          .returning();
      } else {
        await tx
          .update(billingSchedules)
          .set({
            billingType: value.billingType,
            billingFrequency: value.billingFrequency,
            expectedAmount: value.amount,
            amount: value.amount,
            currency: value.currency,
            invoiceGenerationDay: value.invoiceGenerationDay,
            paymentTermsDays: value.paymentTermsDays,
            autoGenerateInvoice: value.autoGenerateInvoice,
            autoSendInvoice: value.autoSendInvoice,
            status: value.status,
            updatedAt: now,
          })
          .where(eq(billingSchedules.id, schedule.id));
      }

      // 4. Upsert Payment Record
      const byReference = value.sourceReference
        ? await tx.select().from(payments).where(eq(payments.sourceReference, value.sourceReference))
        : [];

      const billingFromCond = value.billingStartDate === null ? isNull(payments.billingFrom) : eq(payments.billingFrom, value.billingStartDate);
      const billingToCond = value.billingEndDate === null ? isNull(payments.billingTo) : eq(payments.billingTo, value.billingEndDate);

      const existing =
        byReference[0] ??
        (
          await tx
            .select()
            .from(payments)
            .where(
              and(
                eq(payments.client, value.clientName),
                eq(payments.service, value.service),
                eq(payments.dueDate, value.dueDate),
                billingFromCond,
                billingToCond
              )
            )
        )[0];

      // Fix LOG-06: Preserve existing owner instead of overwriting with "Unassigned"
      const owner = existing?.owner || "Finance Team";

      const fields = {
        clientId: client.id,
        paymentScheduleId: schedule.id,
        client: client.companyName || value.clientName,
        service: value.service,
        owner,
        billingFrom: value.billingStartDate,
        billingTo: value.billingEndDate,
        expectedAmount: value.amount,
        dueDate: value.dueDate,
        sourceReference: value.sourceReference,
        updatedAt: now,
      };

      if (existing) {
        await tx.update(payments).set(fields).where(eq(payments.id, existing.id));
        await tx.insert(auditLogs).values({
          paymentId: existing.id,
          userId: actorId || null,
          entityType: "payment",
          entityId: String(existing.id),
          action: "SHEET_SYNC_UPDATED",
          newValue: JSON.stringify(fields),
          metadata: { source: "google_sheets" },
        });
        return "updated";
      }

      const [payment] = await tx
        .insert(payments)
        .values({ ...fields, status: deriveDateStatus(value.dueDate) })
        .returning();

      await tx.insert(auditLogs).values({
        paymentId: payment.id,
        userId: actorId || null,
        entityType: "payment",
        entityId: String(payment.id),
        action: "SHEET_SYNC_CREATED",
        newValue: JSON.stringify(fields),
        metadata: { source: "google_sheets" },
      });
      return "created";
    });
  }
}
