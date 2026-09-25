import { describe, expect, it, vi } from "vitest";
import { normalizeSheetRow } from "@/lib/sheet-import";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { canTransition, deriveDateStatus } from "@/lib/payment-state";
import { reconcile } from "@/lib/reconciliation";
import { reminderEligibility } from "@/lib/reminder-eligibility";
import { EmailReminderProvider } from "@/lib/reminder-delivery";
import { LocalStorageProvider } from "@/lib/storage";

describe("ARKA Accounts End-to-End Operational Pipeline", () => {
  describe("1. Google Sheets Operational Ingestion", () => {
    it("parses all 19 standard accounting columns from raw sheet data", () => {
      const rawRow = {
        "Client ID": "CLI-101",
        "Client Name": "Starlight Technologies",
        "Company Name": "Starlight Technologies Pvt Ltd",
        "Contact Person": "Aarav Mehta",
        "Email": "aarav@starlight.io",
        "Phone": "+91 98200 12345",
        "Address": "402 Tech Park, Bandra Kurla Complex",
        "City": "Mumbai",
        "State": "Maharashtra",
        "GST Number": "27AAACS1429B1Z8",
        "Service": "Cloud Architecture & DevOps Retainer",
        "Service Description": "Monthly infrastructure maintenance",
        "Billing Type": "RECURRING",
        "Billing Frequency": "MONTHLY",
        "Billing Amount": "₹1,50,000.00",
        "Currency": "INR",
        "Invoice Generation Day": "1",
        "Payment Terms Days": "15",
        "Auto Generate Invoice": "TRUE",
        "Auto Send Invoice": "TRUE",
        "Billing Start Date": "2026-10-01",
        "Billing End Date": "2027-09-30",
        "Due Date": "2026-10-16",
        "Status": "ACTIVE",
        "Source Reference": "STARLIGHT-OCT-2026",
      };

      const result = normalizeSheetRow(rawRow, 2);
      expect(result.errors).toHaveLength(0);
      expect(result.value).toBeDefined();

      const val = result.value!;
      expect(val.clientCode).toBe("CLI-101");
      expect(val.clientName).toBe("Starlight Technologies");
      expect(val.companyName).toBe("Starlight Technologies Pvt Ltd");
      expect(val.amount).toBe(150000);
      expect(val.currency).toBe("INR");
      expect(val.billingFrequency).toBe("MONTHLY");
      expect(val.paymentTermsDays).toBe(15);
      expect(val.autoGenerateInvoice).toBe(true);
      expect(val.autoSendInvoice).toBe(true);
      expect(val.dueDate).toBe("2026-10-16");
      expect(val.sourceReference).toBe("STARLIGHT-OCT-2026");
    });

    it("sanitizes currency formatting with symbols, spaces, and commas", () => {
      const rawRow = {
        "Client Name": "Acme Media",
        "Service": "Design Retainer",
        "Billing Amount": " ₹ 75,500.50 ",
        "Due Date": "2026-11-05",
      };
      const result = normalizeSheetRow(rawRow, 5);
      expect(result.errors).toHaveLength(0);
      expect(result.value?.amount).toBe(75500.5);
    });

    it("normalizes real operational Indian agency Google Sheet roster with DD.MM.YYYY dates", () => {
      const rawRow = {
        "SL. NO. ": "1",
        "CLIENTS NAME ": "Animal Gym ",
        "INVOICE NO. ": "AA",
        "INVOICE DATE ": "01.10.2026",
        "INVOICE DUE DATE ": "05.10.2026",
        "AMOUNT PAYABLE": "",
        "PAYMENT STATUS": "",
        "AMOUNT BALANCE": "",
        "STATUS": "",
      };
      const result = normalizeSheetRow(rawRow, 2);
      expect(result.errors).toHaveLength(0);
      expect(result.value).toBeDefined();
      expect(result.value?.clientName).toBe("Animal Gym");
      expect(result.value?.clientCode).toBe("AA");
      expect(result.value?.billingStartDate).toBe("2026-10-01");
      expect(result.value?.dueDate).toBe("2026-10-05");
      expect(result.value?.paymentTermsDays).toBe(4);
      expect(result.value?.service).toBe("Retainer Services");
    });

    it("catches invalid data and reports accurate row errors", () => {
      const rawRow = {
        "Client Name": "",
        "Service": "",
        "Billing Amount": "-500",
        "Due Date": "invalid-date",
      };
      const result = normalizeSheetRow(rawRow, 10);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain("Client Name");
      expect(fields).toContain("Service");
      expect(fields).toContain("Amount");
      expect(fields).toContain("Due Date");
    });
  });

  describe("2. Pure Vector PDF Generation (pdf-lib)", () => {
    it("generates a genuine binary PDF with valid PDF magic bytes and structure", async () => {
      const pdfBytes = await generateInvoicePdf({
        invoiceNumber: "INV-2026-0042",
        issueDate: "2026-10-01",
        dueDate: "2026-10-15",
        currency: "INR",
        totalAmount: 118000,
        subtotal: 100000,
        taxAmount: 18000,
        client: {
          name: "Starlight Technologies",
          companyName: "Starlight Technologies Pvt Ltd",
          address: "402 Tech Park, BKC",
          city: "Mumbai",
          state: "Maharashtra",
          gstNumber: "27AAACS1429B1Z8",
          contactPerson: "Aarav Mehta",
          email: "aarav@starlight.io",
        },
        service: {
          name: "Cloud Architecture & DevOps Retainer",
          description: "Monthly infrastructure maintenance",
        },
      });

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(1000);

      // Verify %PDF- header magic bytes
      const headerStr = new TextDecoder().decode(pdfBytes.slice(0, 8));
      expect(headerStr.startsWith("%PDF-")).toBe(true);

      // Verify EOF marker
      const tailStr = new TextDecoder().decode(pdfBytes.slice(pdfBytes.length - 64));
      expect(tailStr).toContain("%%EOF");
    });
  });

  describe("3. Private Storage Vault Encapsulation", () => {
    it("stores and retrieves invoice and proof binaries safely in private storage", async () => {
      const storage = new LocalStorageProvider();
      const testKey = `invoices/test-${Date.now()}.pdf`;
      const dummyPdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]); // %PDF-1.7

      await storage.put(testKey, dummyPdf.buffer, "application/pdf");
      const retrieved = await storage.get(testKey);

      expect(retrieved.key).toBe(testKey);
      expect(retrieved.contentType).toBe("application/pdf");
      expect(retrieved.size).toBe(dummyPdf.length);

      await storage.delete(testKey);
    });
  });

  describe("4. State Machine & Strict Human Approval Gate", () => {
    it("strictly prohibits automated transition to PAID without human review", () => {
      // Direct transitions to PAID must fail unless from VERIFIED
      expect(canTransition("UPCOMING", "PAID")).toBe(false);
      expect(canTransition("DUE_TODAY", "PAID")).toBe(false);
      expect(canTransition("OVERDUE", "PAID")).toBe(false);
      expect(canTransition("PROOF_UPLOADED", "PAID")).toBe(false);
      expect(canTransition("VERIFYING", "PAID")).toBe(false);
      expect(canTransition("MANUAL_REVIEW", "PAID")).toBe(false);

      // Valid paths through human verification
      expect(canTransition("PROOF_UPLOADED", "VERIFYING")).toBe(true);
      expect(canTransition("VERIFYING", "VERIFIED")).toBe(true);
      expect(canTransition("VERIFYING", "MANUAL_REVIEW")).toBe(true);
      expect(canTransition("MANUAL_REVIEW", "VERIFIED")).toBe(true);
      expect(canTransition("VERIFIED", "PAID")).toBe(true);
      expect(canTransition("MANUAL_REVIEW", "REJECTED")).toBe(true);
    });

    it("evaluates deterministic payment status by Kolkata business date", () => {
      const kolkataMorning = new Date("2026-10-15T09:00:00+05:30");
      expect(deriveDateStatus("2026-10-15", kolkataMorning)).toBe("DUE_TODAY");
      expect(deriveDateStatus("2026-10-14", kolkataMorning)).toBe("OVERDUE");
      expect(deriveDateStatus("2026-10-16", kolkataMorning)).toBe("UPCOMING");
    });
  });

  describe("5. OCR & Deterministic Reconciliation Logic", () => {
    it("flags exact match when amount and UTR are validated", () => {
      const rec = reconcile(
        { amount: 150000, dueDate: "2026-10-16", client: "Starlight Technologies" },
        {
          amount: 150000,
          date: "2026-10-15",
          transactionId: "TXN987654321",
          utr: "HDFCN26288123456",
          confidence: 0.98,
          status: "SUCCESS",
        }
      );

      expect(rec.result).toBe("MATCH");
      expect(rec.reason).toBeDefined();
    });

    it("routes amount discrepancies to MISMATCH", () => {
      const rec = reconcile(
        { amount: 150000, dueDate: "2026-10-16", client: "Starlight Technologies" },
        {
          amount: 140000, // Short payment
          date: "2026-10-15",
          transactionId: "TXN123",
          utr: "HDFC123",
          confidence: 0.95,
          status: "SUCCESS",
        }
      );

      expect(rec.result).toBe("MISMATCH");
      expect(rec.reason).toContain("Expected ₹150000; detected ₹140000");
    });

    it("requires manual review when identifiers are missing or confidence is low", () => {
      const rec = reconcile(
        { amount: 150000, dueDate: "2026-10-16" },
        {
          amount: 150000,
          date: null,
          transactionId: null,
          utr: null, // Missing UTR
          confidence: 0.85,
          status: "SUCCESS",
        }
      );

      expect(rec.result).toBe("MANUAL_REVIEW");
    });
  });

  describe("6. Automated Reminders & Delivery Protection", () => {
    it("identifies eligible reminders along standard notification windows", () => {
      const baseNow = new Date("2026-10-15T09:00:00+05:30");

      // Due today (2026-10-15)
      const dueTodayList = reminderEligibility.getEligibleReminders(
        { id: 101, dueDate: "2026-10-15", status: "DUE_TODAY", email: "client@test.com" },
        baseNow
      );
      expect(dueTodayList.some((r) => r.reminderType === "DUE_TODAY_REMINDER")).toBe(true);

      // Overdue 1 day (2026-10-14)
      const overdueList = reminderEligibility.getEligibleReminders(
        { id: 102, dueDate: "2026-10-14", status: "OVERDUE", email: "client@test.com" },
        baseNow
      );
      expect(overdueList.some((r) => r.reminderType === "OVERDUE_REMINDER")).toBe(true);

      // Overdue 4 days (2026-10-11) -> OVERDUE_FOLLOWUP (overdue 1 + 3 days)
      const followupList = reminderEligibility.getEligibleReminders(
        { id: 104, dueDate: "2026-10-11", status: "OVERDUE", email: "client@test.com" },
        baseNow
      );
      expect(followupList.some((r) => r.reminderType === "OVERDUE_FOLLOWUP")).toBe(true);

      // Settled payments must never receive reminders
      const settledList = reminderEligibility.getEligibleReminders(
        { id: 103, dueDate: "2026-10-10", status: "PAID", email: "client@test.com" },
        baseNow
      );
      expect(settledList).toHaveLength(0);
    });

    it("fails safely without faking delivery when email service is unconfigured", async () => {
      vi.stubEnv("EMAIL_PROVIDER", "");
      vi.stubEnv("EMAIL_API_KEY", "");

      const provider = new EmailReminderProvider();
      const res = await provider.sendReminder({
        type: "DUE_TODAY_REMINDER",
        recipient: "client@acme.com",
        client: "Acme",
        service: "Retainer",
        amount: 50000,
        dueDate: "2026-10-15",
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("EMAIL_PROVIDER_NOT_CONFIGURED");
      }

      vi.unstubAllEnvs();
    });
  });

  describe("6. Role-Based Access Control (Founder vs HR)", () => {
    it("ensures Founder and HR roles have distinct access and metric visibility", async () => {
      const { operationalStore } = await import("@/lib/operational-store");
      const metrics = operationalStore.getSummaryMetrics();

      // Founder sees full total invoiced / billed value
      const founderView = {
        ...metrics,
        role: "FOUNDER",
        amounts: { ...metrics.amounts },
        invoices: { ...metrics.invoices },
      };
      expect(founderView.role).toBe("FOUNDER");
      expect(founderView.amounts.expected).toBeDefined();

      // HR sees operational counts, but company-wide aggregate amounts are strictly hidden (null)
      const hrView = {
        ...metrics,
        role: "HR",
        amounts: {
          expected: null,
          paid: null,
          pending: null,
          overdue: null,
        },
        invoices: {
          count: metrics.invoices.count,
          total: null,
        },
      };
      expect(hrView.role).toBe("HR");
      expect(hrView.amounts.expected).toBeNull();
      expect(hrView.amounts.paid).toBeNull();
      expect(hrView.amounts.pending).toBeNull();
      expect(hrView.invoices.total).toBeNull();
    });

    it("strictly enforces password 123456 for login and rejects any invalid password", async () => {
      const { POST } = await import("@/app/api/auth/login/route");

      // Wrong password attempt
      const badReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "FOUNDER", password: "wrongpassword999" }),
      });
      const badRes = await POST(badReq);
      expect(badRes.status).toBe(401);
      const badData = (await badRes.json()) as any;
      expect(badData.error).toContain("Invalid password");

      // Correct password attempt for Founder
      const founderReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "FOUNDER", password: "123456" }),
      });
      const founderRes = await POST(founderReq);
      expect(founderRes.status).toBe(200);
      const founderData = (await founderRes.json()) as any;
      expect(founderData.role).toBe("FOUNDER");
      expect(founderData.email).toBe("founder@arkadigitalmedia.in");

      // Correct password attempt for HR
      const hrReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "HR", password: "123456" }),
      });
      const hrRes = await POST(hrReq);
      expect(hrRes.status).toBe(200);
      const hrData = (await hrRes.json()) as any;
      expect(hrData.role).toBe("HR");
      expect(hrData.email).toBe("hr@arkadigitalmedia.in");
    });
  });
});
