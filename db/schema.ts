import { boolean, date, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const createdAt = () => timestamp({ withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`);
export const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

export const users = pgTable("users", {
  id: serial().primaryKey(),
  name: varchar({ length: 160 }).notNull(),
  email: varchar({ length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar({ length: 64 }).notNull(),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const clients = pgTable("clients", {
  id: serial().primaryKey(),
  clientCode: varchar("client_code", { length: 64 }),
  externalId: varchar("external_id", { length: 160 }),
  name: varchar({ length: 240 }).notNull(),
  companyName: varchar("company_name", { length: 240 }),
  contactPerson: varchar("contact_person", { length: 240 }),
  email: varchar({ length: 320 }),
  phone: varchar({ length: 64 }),
  address: text("address"),
  city: varchar({ length: 120 }),
  state: varchar({ length: 120 }),
  gstNumber: varchar("gst_number", { length: 32 }),
  status: varchar({ length: 32 }).notNull().default("ACTIVE"),
  sourceReference: varchar("source_reference", { length: 240 }),
  accountOwnerId: integer("account_owner_id").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const services = pgTable("services", {
  id: serial().primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  name: varchar({ length: 240 }).notNull(),
  description: text(),
  billingAmount: money("billing_amount"),
  currency: varchar({ length: 16 }).notNull().default("INR"),
  status: varchar({ length: 32 }).notNull().default("ACTIVE"),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const billingSchedules = pgTable("billing_schedules", {
  id: serial().primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  serviceId: integer("service_id").references(() => services.id),
  billingType: varchar("billing_type", { length: 64 }).notNull().default("RECURRING"),
  billingFrequency: varchar("billing_frequency", { length: 64 }).notNull().default("MONTHLY"),
  billingFrom: date("billing_from", { mode: "string" }),
  billingTo: date("billing_to", { mode: "string" }),
  expectedAmount: money("expected_amount").notNull(),
  amount: money("amount"),
  currency: varchar({ length: 16 }).notNull().default("INR"),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  invoiceGenerationDay: integer("invoice_generation_day").default(1),
  paymentTermsDays: integer("payment_terms_days").default(7),
  billingStartDate: date("billing_start_date", { mode: "string" }),
  billingEndDate: date("billing_end_date", { mode: "string" }),
  autoGenerateInvoice: boolean("auto_generate_invoice").notNull().default(true),
  autoSendInvoice: boolean("auto_send_invoice").notNull().default(false),
  nextInvoiceDate: date("next_invoice_date", { mode: "string" }),
  nextDueDate: date("next_due_date", { mode: "string" }),
  recurrence: varchar({ length: 64 }),
  status: varchar({ length: 32 }).notNull().default("ACTIVE"),
  sourceReference: varchar("source_reference", { length: 240 }),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export const paymentSchedules = billingSchedules;

export const invoices = pgTable("invoices", {
  id: serial().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 64 }).notNull().unique(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  serviceId: integer("service_id").references(() => services.id),
  billingScheduleId: integer("billing_schedule_id").references(() => billingSchedules.id),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  billingPeriodStart: date("billing_period_start", { mode: "string" }),
  billingPeriodEnd: date("billing_period_end", { mode: "string" }),
  subtotal: money("subtotal").notNull(),
  taxAmount: money("tax_amount").notNull().default(0),
  totalAmount: money("total_amount").notNull(),
  currency: varchar({ length: 16 }).notNull().default("INR"),
  status: varchar({ length: 32 }).notNull().default("GENERATED"),
  pdfStorageKey: text("pdf_storage_key"),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => [
  uniqueIndex("invoice_schedule_period").on(t.billingScheduleId, t.billingPeriodStart, t.billingPeriodEnd),
]);

export const payments = pgTable("payments", {
  id: serial().primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  clientId: integer("client_id").references(() => clients.id),
  paymentScheduleId: integer("payment_schedule_id").references(() => billingSchedules.id),
  client: varchar({ length: 240 }).notNull(),
  service: varchar({ length: 240 }).notNull(),
  owner: varchar({ length: 240 }).notNull(),
  billingFrom: date("billing_from", { mode: "string" }),
  billingTo: date("billing_to", { mode: "string" }),
  expectedAmount: money("expected_amount").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: varchar({ length: 32 }).notNull(),
  sourceReference: varchar("source_reference", { length: 240 }),
  paidAmount: money("paid_amount"),
  paidDate: date("paid_date", { mode: "string" }),
  transactionId: varchar("transaction_id", { length: 240 }),
  utr: varchar({ length: 240 }),
  detectedAmount: money("detected_amount"),
  verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),
  verifiedBy: integer("verified_by").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: createdAt(),
}, (t) => [
  uniqueIndex("payment_dedupe").on(t.client, t.service, t.billingFrom, t.billingTo, t.dueDate),
  uniqueIndex("payment_source_reference").on(t.sourceReference),
]);

export const paymentProofs = pgTable("payment_proofs", {
  id: serial().primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => payments.id),
  fileKey: text("file_key").notNull(),
  fileName: varchar("file_name", { length: 512 }).notNull(),
  fileType: varchar("file_type", { length: 128 }).notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  uploadedAt: createdAt(),
});

export const paymentVerifications = pgTable("payment_verifications", {
  id: serial().primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => payments.id),
  proofId: integer("proof_id").references(() => paymentProofs.id),
  extractedAmount: money("extracted_amount"),
  extractedDate: date("extracted_date", { mode: "string" }),
  transactionId: varchar("transaction_id", { length: 240 }),
  utr: varchar({ length: 240 }),
  referenceNumber: varchar("reference_number", { length: 240 }),
  senderName: varchar("sender_name", { length: 240 }),
  receiverName: varchar("receiver_name", { length: 240 }),
  extractedStatus: varchar("extracted_status", { length: 64 }),
  confidence: numeric({ precision: 5, scale: 4, mode: "number" }),
  result: varchar({ length: 64 }),
  reason: text(),
  reuploadReason: text("reupload_reason"),
  reuploadRequestedBy: integer("reupload_requested_by").references(() => users.id),
  reuploadRequestedAt: timestamp("reupload_requested_at", { withTimezone: true, mode: "string" }),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
  createdAt: createdAt(),
});

export const paymentReminders = pgTable("payment_reminders", {
  id: serial().primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => payments.id),
  type: varchar({ length: 64 }).notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "string" }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
  channel: varchar({ length: 64 }).notNull(),
  status: varchar({ length: 64 }).notNull(),
  errorMessage: text("error_message"),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("reminder_window_once").on(t.paymentId, t.type, t.scheduledFor),
]);

export const followUps = pgTable("follow_ups", {
  id: serial().primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => payments.id),
  userId: integer("user_id").notNull().references(() => users.id),
  action: varchar({ length: 96 }).notNull(),
  notes: text(),
  followUpDate: date("follow_up_date", { mode: "string" }).notNull(),
  status: varchar({ length: 32 }).notNull().default("PENDING"),
  createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: serial().primaryKey(),
  userId: integer("user_id").references(() => users.id),
  paymentId: integer("payment_id").references(() => payments.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  type: varchar({ length: 64 }).notNull(),
  title: varchar({ length: 240 }).notNull(),
  message: text().notNull(),
  read: boolean().notNull().default(false),
  createdAt: createdAt(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial().primaryKey(),
  paymentId: integer("payment_id").references(() => payments.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  userId: integer("user_id").references(() => users.id),
  entityType: varchar("entity_type", { length: 64 }).notNull().default("payment"),
  entityId: varchar("entity_id", { length: 240 }),
  action: varchar({ length: 96 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  metadata: jsonb(),
  createdAt: createdAt(),
});

export const syncLogs = pgTable("sync_logs", {
  id: serial().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  recordsProcessed: integer("records_processed").notNull().default(0),
  recordsCreated: integer("records_created").notNull().default(0),
  recordsUpdated: integer("records_updated").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  status: varchar({ length: 64 }).notNull(),
  errorDetails: jsonb("error_details"),
});

export const automationJobs = pgTable("automation_jobs", {
  id: serial().primaryKey(),
  type: varchar({ length: 64 }).notNull(),
  status: varchar({ length: 32 }).notNull().default("SCHEDULED"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "string" }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  attempts: integer().notNull().default(0),
  lastError: text("last_error"),
  payload: jsonb(),
  result: jsonb(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
});

export type SheetRow = Record<string, unknown>;

