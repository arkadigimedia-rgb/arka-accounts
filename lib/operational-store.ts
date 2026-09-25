import { extractSheetId, GoogleSheetsProvider } from "./google-sheets";

export interface OperationalClient {
  id: number;
  clientCode: string;
  name: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  gstNumber: string;
  service: string;
  serviceDescription: string;
  monthlyFee: number;
  invoiceDay: number;
  paymentTermsDays: number;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

export interface OperationalBillingSchedule {
  id: number;
  clientId: number;
  clientName: string;
  service: string;
  billingType: "RECURRING" | "ONE_TIME";
  billingFrequency: "MONTHLY" | "QUARTERLY";
  amount: number;
  expectedAmount: number;
  currency: string;
  invoiceGenerationDay: number;
  paymentTermsDays: number;
  autoGenerateInvoice: boolean;
  autoSendInvoice: boolean;
  nextInvoiceDate: string;
  nextDueDate: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  createdAt: string;
}

export interface OperationalInvoice {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  clientCode: string;
  service: string;
  issueDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: "GENERATED" | "SENT" | "OVERDUE" | "PAID";
  pdfStorageKey: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface OperationalPayment {
  id: number;
  invoiceId: number | null;
  clientId: number;
  client: string;
  service: string;
  owner: string;
  billingFrom: string | null;
  billingTo: string | null;
  expectedAmount: number;
  paidAmount: number | null;
  dueDate: string;
  status:
    | "PENDING"
    | "UPCOMING"
    | "DUE_TODAY"
    | "OVERDUE"
    | "PROOF_UPLOADED"
    | "VERIFYING"
    | "VERIFIED"
    | "MANUAL_REVIEW"
    | "MISMATCH"
    | "PAID"
    | "REJECTED";
  utr: string | null;
  paymentMode: string | null;
  sourceReference: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  verification?: {
    extractedAmount: number;
    reference: string;
    confidence: string;
    extractedDate?: string;
  };
}

export interface OperationalFollowUp {
  id: number;
  paymentId: number;
  clientId: number;
  clientName: string;
  channel: "PHONE" | "EMAIL" | "WHATSAPP" | "IN_PERSON";
  notes: string;
  scheduledAt: string;
  completedAt: string | null;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  collector: string;
  createdAt: string;
}

export interface OperationalReminder {
  id: number;
  paymentId: number;
  clientName: string;
  recipientEmail: string;
  reminderType: "UPCOMING_REMINDER" | "DUE_TODAY_REMINDER" | "OVERDUE_REMINDER" | "OVERDUE_FOLLOWUP";
  status: "SENT" | "FAILED" | "PENDING";
  sentAt: string;
  channel: string;
}

function parseSheetDate(raw?: string): { iso: string; day: number; month: string; year: string } {
  if (!raw) {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return { iso, day: now.getDate(), month: m, year: y };
  }
  const clean = raw.trim();
  if (/^\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split(/[\.\/\-]/);
    const day = String(Number(d)).padStart(2, "0");
    const month = String(Number(m)).padStart(2, "0");
    return { iso: `${y}-${month}-${day}`, day: Number(d), month, year: y };
  }
  if (/^\d{4}[\.\/\-]\d{1,2}[\.\/\-]\d{1,2}$/.test(clean)) {
    const [y, m, d] = clean.split(/[\.\/\-]/);
    const day = String(Number(d)).padStart(2, "0");
    const month = String(Number(m)).padStart(2, "0");
    return { iso: `${y}-${month}-${day}`, day: Number(d), month, year: y };
  }
  const dt = new Date(clean);
  if (!isNaN(dt.getTime())) {
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return { iso: `${y}-${m}-${d}`, day: dt.getDate(), month: m, year: y };
  }
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return { iso, day: now.getDate(), month: m, year: y };
}

export class OperationalStore {
  private clients: OperationalClient[] = [];
  private schedules: OperationalBillingSchedule[] = [];
  private invoices: OperationalInvoice[] = [];
  private payments: OperationalPayment[] = [];
  private followUps: OperationalFollowUp[] = [];
  private reminders: OperationalReminder[] = [];
  private lastSyncTime: string | null = null;
  private configuredSheetUrl: string | null = null;

  constructor() {
    // Starts completely clean. Data is populated dynamically from Google Sheets.
  }

  clearAllData(): void {
    this.clients = [];
    this.schedules = [];
    this.invoices = [];
    this.payments = [];
    this.followUps = [];
    this.reminders = [];
    this.lastSyncTime = null;
    this.configuredSheetUrl = null;
  }

  getConfiguredSheetUrl(): string | null {
    return (
      this.configuredSheetUrl ||
      process.env.GOOGLE_SHEET_URL ||
      (process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}` : null)
    );
  }

  // --- Live Google Sheets Synchronization ---
  async syncLiveGoogleSheet(customSheetUrlOrId?: string): Promise<{
    processed: number;
    updated: number;
    created: number;
    sheetUrl: string;
    syncedAt: string;
  }> {
    const targetInput =
      customSheetUrlOrId ||
      this.configuredSheetUrl ||
      process.env.GOOGLE_SHEET_URL ||
      process.env.GOOGLE_SHEET_ID ||
      "";

    const sheetId = extractSheetId(targetInput);
    if (!sheetId) {
      throw new Error("No Google Sheet configured. Please enter a valid Google Spreadsheet URL or ID in Settings.");
    }

    if (customSheetUrlOrId) {
      this.configuredSheetUrl = customSheetUrlOrId;
    }

    const provider = new GoogleSheetsProvider(sheetId);
    const rows = await provider.getRows();

    let updated = 0;
    let created = 0;
    let processed = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const normalizedKeys = Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), String(v || "").trim()])
      );

      const clientName =
        normalizedKeys["clientsname"] ||
        normalizedKeys["clientname"] ||
        normalizedKeys["client"] ||
        normalizedKeys["name"] ||
        "";
      if (!clientName) continue;
      processed++;

      const invoiceNo =
        normalizedKeys["invoiceno"] ||
        normalizedKeys["invoice"] ||
        normalizedKeys["clientcode"] ||
        `INV-${new Date().getFullYear()}-${String(processed).padStart(4, "0")}`;
      const contact =
        normalizedKeys["contact"] ||
        normalizedKeys["phone"] ||
        normalizedKeys["mobilenumber"] ||
        "";
      const email =
        normalizedKeys["email"] ||
        normalizedKeys["clientemail"] ||
        `accounts@${clientName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
      const billingCycle = normalizedKeys["billingcycle"] || normalizedKeys["frequency"] || "Monthly";
      const invoiceDateRaw = normalizedKeys["invoicedate"] || normalizedKeys["date"] || "";
      const dueDateRaw = normalizedKeys["invoiceduedate"] || normalizedKeys["duedate"] || "";
      const amountRaw = (normalizedKeys["amountpayable"] || normalizedKeys["amount"] || "0").replace(/[₹,\s]/g, "");
      const amount = Number(amountRaw) || 0;
      const balanceRaw = (normalizedKeys["amountbalance"] || normalizedKeys["balance"] || "").replace(/[₹,\s]/g, "");
      const balance = balanceRaw !== "" ? Number(balanceRaw) : null;

      const paymentStatusRaw = (
        normalizedKeys["paymentstatus"] ||
        normalizedKeys["receivedpending"] ||
        normalizedKeys["status"] ||
        normalizedKeys["remarks"] ||
        ""
      ).toLowerCase();
      const remarks = normalizedKeys["remarks"] || "";

      // Parse dates
      const parsedInvDate = parseSheetDate(invoiceDateRaw) || {
        year: "2026",
        month: "10",
        day: "01",
        iso: "2026-10-01",
      };
      const parsedDueDate = parseSheetDate(dueDateRaw) || {
        year: "2026",
        month: "10",
        day: "05",
        iso: "2026-10-05",
      };

      const isPaid =
        paymentStatusRaw.includes("received") ||
        paymentStatusRaw.includes("paid") ||
        remarks.toLowerCase().includes("paid") ||
        (balance !== null && balance === 0 && amount > 0);
      const isPastDue = new Date(parsedDueDate.iso).getTime() < Date.now();

      // Find or create client
      let client = this.clients.find(
        (c) =>
          c.name.toLowerCase() === clientName.toLowerCase() ||
          (c.clientCode && c.clientCode === invoiceNo)
      );

      const invDay = Number(parsedInvDate.day) || 1;
      const dueDay = Number(parsedDueDate.day) || 5;
      const termsDays = Math.max(dueDay - invDay, 5);

      if (!client) {
        const newClientId = this.clients.length + 1;
        client = {
          id: newClientId,
          clientCode: invoiceNo.includes("/") ? invoiceNo : `CLI-${String(newClientId).padStart(3, "0")}`,
          name: clientName,
          companyName: clientName,
          contactPerson: "Accounts Lead",
          email: email,
          phone: contact,
          address: "Bengaluru, Karnataka",
          city: "Bengaluru",
          state: "Karnataka",
          gstNumber: `29AAACN${String(1000 + newClientId)}A1Z0`,
          service: "Retainer Operations",
          serviceDescription: "Monthly Retainer Operations",
          monthlyFee: amount,
          invoiceDay: invDay,
          paymentTermsDays: termsDays,
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.clients.push(client);

        // Add billing schedule
        this.schedules.push({
          id: this.schedules.length + 1,
          clientId: client.id,
          clientName: client.name,
          service: client.service,
          billingType: "RECURRING",
          billingFrequency: billingCycle.toUpperCase() === "QUARTERLY" ? "QUARTERLY" : "MONTHLY",
          amount: amount,
          expectedAmount: amount,
          currency: "INR",
          invoiceGenerationDay: invDay,
          paymentTermsDays: termsDays,
          autoGenerateInvoice: true,
          autoSendInvoice: true,
          nextInvoiceDate: parsedInvDate.iso,
          nextDueDate: parsedDueDate.iso,
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
        });
        created++;
      } else {
        if (amount > 0) client.monthlyFee = amount;
        if (contact) client.phone = contact;
        if (email) client.email = email;
        client.updatedAt = new Date().toISOString();
        updated++;
      }

      // Check if invoice already exists
      let invoice = this.invoices.find(
        (i) =>
          i.clientId === client!.id &&
          (i.invoiceNumber === invoiceNo || (i.issueDate === parsedInvDate.iso && i.dueDate === parsedDueDate.iso))
      );

      const invStatus = isPaid ? "PAID" : isPastDue ? "OVERDUE" : "GENERATED";
      const payStatus = isPaid ? "PAID" : isPastDue ? "OVERDUE" : "UPCOMING";

      if (!invoice) {
        const invId = this.invoices.length + 1;
        invoice = {
          id: invId,
          invoiceNumber: invoiceNo,
          clientId: client.id,
          clientName: client.name,
          clientCode: client.clientCode,
          service: client.service,
          issueDate: parsedInvDate.iso,
          dueDate: parsedDueDate.iso,
          billingPeriodStart: `${parsedInvDate.year}-${parsedInvDate.month}-01`,
          billingPeriodEnd: `${parsedInvDate.year}-${parsedInvDate.month}-28`,
          subtotal: amount,
          taxAmount: 0,
          totalAmount: amount,
          currency: "INR",
          status: invStatus,
          pdfStorageKey: `invoices/${invId}/${invoiceNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
          paidAt: isPaid ? `${parsedDueDate.iso}T12:00:00Z` : null,
          createdAt: new Date().toISOString(),
        };
        this.invoices.push(invoice);
      } else {
        invoice.totalAmount = amount;
        invoice.subtotal = amount;
        invoice.status = invStatus;
      }

      // Payment record
      let payment = this.payments.find(
        (p) =>
          p.clientId === client!.id &&
          (p.sourceReference === invoiceNo || p.dueDate === parsedDueDate.iso)
      );

      if (!payment) {
        const payId = this.payments.length + 1;
        payment = {
          id: payId,
          invoiceId: invoice.id,
          clientId: client.id,
          client: client.name,
          service: client.service,
          owner: "Accounts Team",
          billingFrom: `${parsedInvDate.year}-${parsedInvDate.month}-01`,
          billingTo: `${parsedInvDate.year}-${parsedInvDate.month}-28`,
          expectedAmount: amount,
          paidAmount: isPaid ? amount : null,
          dueDate: parsedDueDate.iso,
          status: payStatus,
          utr: isPaid ? `HDFC${parsedInvDate.year}${parsedInvDate.month}${String(1000 + client.id)}` : null,
          paymentMode: isPaid ? "NEFT_RTGS" : null,
          sourceReference: invoiceNo,
          notes: remarks || (isPaid ? "Settled via NEFT" : "Imported from Google Sheet"),
          paidAt: isPaid ? `${parsedDueDate.iso}T12:00:00Z` : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.payments.push(payment);

        if (payStatus === "OVERDUE") {
          this.followUps.push({
            id: this.followUps.length + 1,
            paymentId: payId,
            clientId: client.id,
            clientName: client.name,
            channel: "PHONE",
            notes: remarks || "Overdue account follow-up scheduled.",
            scheduledAt: new Date().toISOString(),
            completedAt: null,
            status: "PENDING",
            collector: "Accounts Collections Lead",
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        payment.expectedAmount = amount;
        payment.status = payStatus;
        if (isPaid && !payment.paidAmount) {
          payment.paidAmount = amount;
          payment.paidAt = `${parsedDueDate.iso}T12:00:00Z`;
          payment.utr = payment.utr || `HDFC${parsedInvDate.year}${parsedInvDate.month}${String(1000 + client.id)}`;
        }
        payment.updatedAt = new Date().toISOString();
      }
    }

    this.lastSyncTime = new Date().toISOString();
    return {
      processed,
      updated,
      created,
      sheetUrl: customSheetUrlOrId || `https://docs.google.com/spreadsheets/d/${sheetId}`,
      syncedAt: this.lastSyncTime,
    };
  }

  // --- Client Queries ---
  getClients(params?: { search?: string; status?: string }): OperationalClient[] {
    let list = [...this.clients];
    if (params?.status && params.status !== "ALL") {
      list = list.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.clientCode.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }
    return list;
  }

  getClientById(id: number) {
    const client = this.clients.find((c) => c.id === id);
    if (!client) return null;

    const invoices = this.invoices.filter((i) => i.clientId === id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    const payments = this.payments.filter((p) => p.clientId === id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    const schedules = this.schedules.filter((s) => s.clientId === id);
    const followUps = this.followUps.filter((f) => f.clientId === id);

    const totalBilled = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollected = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paidAmount || p.expectedAmount), 0);
    const overdueCount = payments.filter((p) => p.status === "OVERDUE").length;

    return {
      client,
      invoices,
      payments,
      schedules,
      followUps,
      metrics: {
        totalBilled,
        totalCollected,
        outstanding: totalBilled - totalCollected,
        overdueCount,
      },
    };
  }

  createClient(data: Partial<OperationalClient>): OperationalClient {
    const id = this.clients.length + 1;
    const client: OperationalClient = {
      id,
      clientCode: data.clientCode || `CLI-${id}`,
      name: data.name || `New Client ${id}`,
      companyName: data.companyName || data.name || "",
      contactPerson: data.contactPerson || "",
      email: data.email || "",
      phone: data.phone || "",
      address: data.address || "",
      city: data.city || "Bengaluru",
      state: data.state || "Karnataka",
      gstNumber: data.gstNumber || "",
      service: data.service || "Retainer Operations",
      serviceDescription: data.serviceDescription || "Monthly Operations",
      monthlyFee: Number(data.monthlyFee) || 50000,
      invoiceDay: 1,
      paymentTermsDays: 5,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.clients.unshift(client);
    return client;
  }

  // --- Payment Queries with Month Filtering ---
  getPayments(params?: { month?: string; status?: string; search?: string }): OperationalPayment[] {
    let list = [...this.payments];

    // Month filter (e.g. "2026-10", "2026-09", "2026-08", "2026-07")
    if (params?.month) {
      list = list.filter((p) => p.dueDate.startsWith(params.month!));
    }

    if (params?.status && params.status !== "ALL") {
      if (params.status === "QUEUE") {
        list = list.filter((p) => ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status));
      } else if (params.status === "UNPAID") {
        list = list.filter((p) => ["PENDING", "UPCOMING", "DUE_TODAY", "OVERDUE"].includes(p.status));
      } else {
        list = list.filter((p) => p.status === params.status);
      }
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.client.toLowerCase().includes(q) ||
          p.service.toLowerCase().includes(q) ||
          (p.utr && p.utr.toLowerCase().includes(q)) ||
          String(p.id).includes(q)
      );
    }

    return list.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }

  getPaymentById(id: number) {
    const payment = this.payments.find((p) => p.id === id);
    if (!payment) return null;
    const client = this.clients.find((c) => c.id === payment.clientId);
    const invoice = payment.invoiceId ? this.invoices.find((i) => i.id === payment.invoiceId) : null;
    const followUps = this.followUps.filter((f) => f.paymentId === id);

    return { payment, client, invoice, followUps };
  }

  updatePaymentStatus(id: number, status: OperationalPayment["status"], actorId: number, note?: string) {
    const payment = this.payments.find((p) => p.id === id);
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");

    payment.status = status;
    payment.updatedAt = new Date().toISOString();
    if (note) payment.notes = note;

    if (status === "PAID") {
      payment.paidAmount = payment.expectedAmount;
      payment.paidAt = new Date().toISOString();
      if (!payment.utr) {
        payment.utr = `UPI${Date.now().toString().slice(-8)}`;
      }
      if (payment.invoiceId) {
        const inv = this.invoices.find((i) => i.id === payment.invoiceId);
        if (inv) {
          inv.status = "PAID";
          inv.paidAt = payment.paidAt;
        }
      }
    }

    return payment;
  }

  // --- Invoices ---
  getInvoices(params?: { month?: string; status?: string; clientId?: number }): OperationalInvoice[] {
    let list = [...this.invoices];
    if (params?.month) {
      list = list.filter((i) => i.dueDate.startsWith(params.month!));
    }
    if (params?.status && params.status !== "ALL") {
      list = list.filter((i) => i.status === params.status);
    }
    if (params?.clientId) {
      list = list.filter((i) => i.clientId === params.clientId);
    }
    return list.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }

  getInvoiceById(id: number) {
    const invoice = this.invoices.find((i) => i.id === id);
    if (!invoice) return null;
    const client = this.clients.find((c) => c.id === invoice.clientId);
    const payment = this.payments.find((p) => p.invoiceId === id);
    return { invoice, client, payment };
  }

  // --- Verification Desk Actions ---
  getVerificationQueue() {
    return this.payments
      .filter((p) => ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status))
      .map((p) => {
        const client = this.clients.find((c) => c.id === p.clientId);
        return {
          ...p,
          clientGstin: client?.gstNumber || "29AAACN1234A1Z5",
          clientEmail: client?.email || "",
          clientPhone: client?.phone || "",
        };
      });
  }

  approvePayment(id: number, actorId: number, note?: string) {
    return this.updatePaymentStatus(id, "PAID", actorId, note || "Payment verified and approved by Accounts Manager.");
  }

  rejectProof(id: number, actorId: number, reason: string) {
    const payment = this.payments.find((p) => p.id === id);
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    payment.status = "REJECTED";
    payment.notes = `Proof rejected: ${reason}`;
    payment.updatedAt = new Date().toISOString();
    return payment;
  }

  requestReupload(id: number, actorId: number, note: string) {
    const payment = this.payments.find((p) => p.id === id);
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    payment.status = "MANUAL_REVIEW";
    payment.notes = `Re-upload requested: ${note}`;
    payment.updatedAt = new Date().toISOString();
    return payment;
  }

  // --- KPIs and Summaries ---
  getSummaryMetrics() {
    const expected = this.payments.reduce((s, p) => s + (p.expectedAmount || 0), 0);
    const paid = this.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paidAmount || p.expectedAmount || 0), 0);
    const overduePayments = this.payments.filter((p) => p.status === "OVERDUE");
    const overdue = overduePayments.reduce((s, p) => s + (p.expectedAmount || 0), 0);

    const counts = {
      dueToday: this.payments.filter((p) => p.status === "DUE_TODAY").length,
      upcoming: this.payments.filter((p) => p.status === "UPCOMING").length,
      overdue: overduePayments.length,
      verification: this.payments.filter((p) => ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status)).length,
      paid: this.payments.filter((p) => p.status === "PAID").length,
    };

    return {
      counts,
      amounts: {
        expected,
        paid,
        pending: expected - paid,
        overdue,
      },
      invoices: {
        count: this.invoices.length,
        total: this.invoices.reduce((s, i) => s + i.totalAmount, 0),
      },
      lastSync: this.lastSyncTime,
      totalClients: this.clients.length,
    };
  }

  getActionRequired() {
    return this.payments
      .filter((p) => ["OVERDUE", "DUE_TODAY", "PROOF_UPLOADED", "MANUAL_REVIEW", "MISMATCH"].includes(p.status))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  getFollowUps() {
    return this.followUps.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  }

  getReminders() {
    return this.reminders.sort((a, b) => b.id - a.id);
  }

  getBillingSchedules() {
    return this.schedules;
  }

  // Aging Reports
  getAgingReports() {
    const now = Date.now();
    const brackets = {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      days90Plus: 0,
    };

    this.payments
      .filter((p) => p.status !== "PAID")
      .forEach((p) => {
        const dueTime = new Date(`${p.dueDate}T00:00:00Z`).getTime();
        const diffDays = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));
        const amount = p.expectedAmount || 0;

        if (diffDays <= 0) brackets.current += amount;
        else if (diffDays <= 30) brackets.days1To30 += amount;
        else if (diffDays <= 60) brackets.days31To60 += amount;
        else if (diffDays <= 90) brackets.days61To90 += amount;
        else brackets.days90Plus += amount;
      });

    const totalInv = this.invoices.reduce((s, i) => s + i.totalAmount, 0) || 1;
    const clientConcentration = this.clients.slice(0, 10).map((c) => {
      const clientTotal = this.payments
        .filter((p) => p.clientId === c.id)
        .reduce((s, p) => s + (p.expectedAmount || 0), 0);
      return {
        id: c.id,
        name: c.name,
        code: c.clientCode,
        totalBilled: clientTotal,
        percentage: Number(((clientTotal / totalInv) * 100).toFixed(1)),
      };
    });

    const monthsMap = new Map<string, { billed: number; collected: number; pending: number }>();
    for (const p of this.payments) {
      const ym = p.dueDate ? p.dueDate.slice(0, 7) : "Unknown";
      const existing = monthsMap.get(ym) || { billed: 0, collected: 0, pending: 0 };
      existing.billed += p.expectedAmount || 0;
      if (p.status === "PAID") {
        existing.collected += p.paidAmount || p.expectedAmount || 0;
      } else {
        existing.pending += p.expectedAmount || 0;
      }
      monthsMap.set(ym, existing);
    }

    const monthlyBreakdown = Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthCode, data]) => {
        const [year, month] = monthCode.split("-");
        const dateObj = new Date(Number(year), Number(month) - 1, 1);
        const label = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        return {
          month: isNaN(dateObj.getTime()) ? monthCode : label,
          billed: data.billed,
          collected: data.collected,
          pending: data.pending,
        };
      });

    return {
      brackets,
      clientConcentration,
      monthlyBreakdown,
    };
  }
}

// Global Singleton for Local Preview & Fallback
declare global {
  var __arka_operational_store__: OperationalStore | undefined;
}

export const operationalStore =
  globalThis.__arka_operational_store__ || (globalThis.__arka_operational_store__ = new OperationalStore());
