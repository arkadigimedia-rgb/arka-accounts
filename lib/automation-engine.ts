import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { automationJobs, billingSchedules, followUps, invoices, notifications, payments } from "@/db/schema";
import { invoiceService } from "@/lib/invoice-service";
import { ReminderService } from "@/lib/reminder-service";
import { GoogleSheetsProvider } from "@/lib/google-sheets";
import { SheetSyncService } from "@/lib/sheet-sync";

const kolkataToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

export type JobType =
  | "invoice.generate"
  | "payment.lifecycle.refresh"
  | "reminder.process"
  | "sheet.sync"
  | "followup.check";

export type JobExecutionSummary = {
  jobId: number;
  type: JobType;
  status: "COMPLETED" | "FAILED";
  result?: Record<string, unknown>;
  error?: string;
};

export class AutomationEngine {
  async executeJob(type: JobType, payload: Record<string, unknown> = {}): Promise<JobExecutionSummary> {
    const db = getDb();
    const now = new Date().toISOString();
    const [job] = await db
      .insert(automationJobs)
      .values({
        type,
        status: "PROCESSING",
        scheduledFor: now,
        startedAt: now,
        attempts: 1,
        payload,
      })
      .returning();

    try {
      let result: Record<string, unknown> = {};

      switch (type) {
        case "invoice.generate":
          result = await this.runInvoiceGeneration();
          break;
        case "payment.lifecycle.refresh":
          result = await this.runLifecycleRefresh();
          break;
        case "reminder.process":
          result = await this.runReminderProcess();
          break;
        case "sheet.sync":
          result = await this.runSheetSync();
          break;
        case "followup.check":
          result = await this.runFollowUpCheck();
          break;
        default:
          throw new Error(`UNKNOWN_JOB_TYPE: ${type}`);
      }

      await db
        .update(automationJobs)
        .set({
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
          result,
        })
        .where(eq(automationJobs.id, job.id));

      return { jobId: job.id, type, status: "COMPLETED", result };
    } catch (error) {
      const lastError = error instanceof Error ? error.message : "Unknown automation error.";
      await db
        .update(automationJobs)
        .set({
          status: "FAILED",
          completedAt: new Date().toISOString(),
          lastError,
        })
        .where(eq(automationJobs.id, job.id));

      return { jobId: job.id, type, status: "FAILED", error: lastError };
    }
  }

  async runInvoiceGeneration(): Promise<Record<string, unknown>> {
    const db = getDb();
    const today = kolkataToday();
    const schedules = await db
      .select()
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.status, "ACTIVE"),
          eq(billingSchedules.autoGenerateInvoice, true),
          lte(billingSchedules.nextInvoiceDate, today)
        )
      );

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const schedule of schedules) {
      try {
        const res = await invoiceService.generateInvoiceForSchedule(schedule.id, {
          targetDate: today,
          actorId: 0,
        });
        if (res.duplicate) skipped++;
        else generated++;
      } catch (err) {
        failed++;
        errors.push(`Schedule ${schedule.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { processed: schedules.length, generated, skipped, failed, errors };
  }

  async runLifecycleRefresh(): Promise<Record<string, unknown>> {
    const db = getDb();
    const today = kolkataToday();
    const rows = await db
      .select()
      .from(payments)
      .where(inArray(payments.status, ["UPCOMING", "DUE_TODAY"]));

    let updated = 0;
    for (const payment of rows) {
      let nextStatus: string | null = null;
      let nextInvoiceStatus: string | null = null;

      if (payment.dueDate < today && payment.status !== "OVERDUE") {
        nextStatus = "OVERDUE";
        nextInvoiceStatus = "OVERDUE";
      } else if (payment.dueDate === today && payment.status === "UPCOMING") {
        nextStatus = "DUE_TODAY";
        nextInvoiceStatus = "DUE";
      }

      if (nextStatus) {
        await db
          .update(payments)
          .set({ status: nextStatus, updatedAt: new Date().toISOString() })
          .where(eq(payments.id, payment.id));

        if (payment.invoiceId && nextInvoiceStatus) {
          await db
            .update(invoices)
            .set({ status: nextInvoiceStatus, updatedAt: new Date().toISOString() })
            .where(eq(invoices.id, payment.invoiceId));
        }
        updated++;
      }
    }

    return { evaluated: rows.length, updated };
  }

  async runReminderProcess(): Promise<Record<string, unknown>> {
    const service = new ReminderService();
    return service.processEligibleReminders(0) as unknown as Record<string, unknown>;
  }

  async runSheetSync(): Promise<Record<string, unknown>> {
    const provider = new GoogleSheetsProvider();
    const connection = await provider.testConnection();
    if (connection.state !== "CONNECTED") {
      return { skipped: true, reason: connection.message };
    }
    const syncService = new SheetSyncService(provider);
    return syncService.sync(0) as unknown as Record<string, unknown>;
  }

  async runFollowUpCheck(): Promise<Record<string, unknown>> {
    const db = getDb();
    const today = kolkataToday();
    const dues = await db
      .select()
      .from(followUps)
      .where(and(eq(followUps.status, "PENDING"), lte(followUps.followUpDate, today)));

    for (const f of dues) {
      await db.insert(notifications).values({
        userId: f.userId,
        paymentId: f.paymentId,
        type: "FOLLOW_UP_DUE",
        title: "Client follow-up due",
        message: `Action required: ${f.action} for payment #${f.paymentId}.`,
      });
    }

    return { pendingFollowUps: dues.length };
  }

  async runDailyWorkflow(): Promise<JobExecutionSummary[]> {
    const jobs: JobType[] = [
      "sheet.sync",
      "invoice.generate",
      "payment.lifecycle.refresh",
      "reminder.process",
      "followup.check",
    ];
    const results: JobExecutionSummary[] = [];
    for (const job of jobs) {
      results.push(await this.executeJob(job));
    }
    return results;
  }

  async listRecentJobs(limit = 20) {
    const db = getDb();
    return db.select().from(automationJobs).orderBy(desc(automationJobs.id)).limit(limit);
  }
}

export const automationEngine = new AutomationEngine();
