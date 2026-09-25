export type SheetRow = Record<string, unknown>;

export type ImportError = {
  row: number;
  field: string;
  message: string;
};

export type NormalizedSheetRecord = {
  clientCode: string | null;
  clientName: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  gstNumber: string | null;
  service: string;
  serviceDescription: string | null;
  billingType: "RECURRING" | "ONE_TIME";
  billingFrequency: "MONTHLY" | "QUARTERLY";
  amount: number;
  currency: string;
  invoiceGenerationDay: number;
  paymentTermsDays: number;
  autoGenerateInvoice: boolean;
  autoSendInvoice: boolean;
  billingStartDate: string | null;
  billingEndDate: string | null;
  dueDate: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  sourceReference: string | null;
};

// Export alias NormalizedPayment for backward compatibility with existing tests
export type NormalizedPayment = {
  client: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  service: string;
  billingType: string;
  billingFrom: string | null;
  billingTo: string | null;
  amount: number;
  dueDate: string;
  reference: string | null;
};

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

const read = (row: SheetRow, ...possibleKeys: string[]): string => {
  const rowKeys = Object.keys(row);
  for (const target of possibleKeys) {
    const targetNorm = normalizeKey(target);
    const matchingKey = rowKeys.find((k) => normalizeKey(k) === targetNorm);
    if (matchingKey && row[matchingKey] != null) {
      const val = row[matchingKey];
      return typeof val === "string" ? val.trim() : String(val).trim();
    }
  }
  return "";
};

const parseDate = (val: string): string | null => {
  if (!val) return null;
  // Handle DD/MM/YYYY, DD.MM.YYYY, or DD-MM-YYYY
  if (/^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4}$/.test(val)) {
    const [d, m, y] = val.split(/[\/\.\-]/);
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? null : iso;
  }
  const dt = new Date(val);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
};

const parseBoolean = (val: string, fallback = false): boolean => {
  if (!val) return fallback;
  const lower = val.toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1" || lower === "y";
};

export function normalizeSheetRow(
  row: SheetRow,
  rowNumber: number
): { value?: NormalizedSheetRecord & { client: string; billingFrom: string | null; billingTo: string | null; reference: string | null }; errors: ImportError[] } {
  const errors: ImportError[] = [];

  const clientCode =
    read(row, "Client ID", "Client Code", "client_code", "ClientID", "Invoice No", "INVOICE NO.", "invoice_no") || null;
  const clientName = read(
    row,
    "Client Name",
    "CLIENTS NAME",
    "Clients Name",
    "Client's Name",
    "Client",
    "client_name",
    "client"
  );
  const companyName = read(row, "Company Name", "Company", "company_name") || null;
  const contactPerson = read(row, "Contact Person", "Contact", "contact_person") || null;
  const email = read(row, "Email", "Client Email", "email") || null;
  const phone = read(row, "Phone", "Mobile", "Contact Number", "phone") || null;
  const address = read(row, "Address", "address") || null;
  const city = read(row, "City", "city") || null;
  const state = read(row, "State", "state") || null;
  const gstNumber = read(row, "GST Number", "GST", "gst_number", "GSTIN") || null;

  const hasServiceColumn = Object.keys(row).some((k) => normalizeKey(k).includes("service"));
  let service = read(row, "Service", "Service Name", "service_name", "service");
  if (!service && !hasServiceColumn) {
    service = "Retainer Services";
  }

  const serviceDescription = read(row, "Service Description", "Description", "description") || null;

  const rawBillingType = read(row, "Billing Type", "Type", "billing_type").toUpperCase();
  const billingType: "RECURRING" | "ONE_TIME" =
    rawBillingType === "ONE_TIME" || rawBillingType === "ONETIME" ? "ONE_TIME" : "RECURRING";

  const rawFrequency = read(row, "Billing Frequency", "Frequency", "billing_frequency").toUpperCase();
  const billingFrequency: "MONTHLY" | "QUARTERLY" = rawFrequency === "QUARTERLY" ? "QUARTERLY" : "MONTHLY";

  // Clean currency using proper regex `/[₹,\s]/g`
  const rawAmount = read(
    row,
    "Billing Amount",
    "Amount",
    "expected_amount",
    "amount",
    "Amount Payable",
    "AMOUNT PAYABLE",
    "amount_payable"
  );
  const cleanedAmountStr = rawAmount.replace(/[₹,\s]/g, "");
  let amount = Number(cleanedAmountStr);
  const isAmountOmitted = rawAmount === "";
  if (isAmountOmitted) {
    amount = 0;
  }

  const currency = read(row, "Currency", "currency") || "INR";

  const billingStartDate = parseDate(
    read(
      row,
      "Billing Start Date",
      "Billing From",
      "billing_start_date",
      "billing_from",
      "Invoice Date",
      "INVOICE DATE",
      "invoice_date"
    )
  );
  const billingEndDate = parseDate(read(row, "Billing End Date", "Billing To", "billing_end_date", "billing_to"));

  const rawGenDay = read(row, "Invoice Generation Day", "Invoice Day", "invoice_generation_day");
  let invoiceGenerationDay = Number(rawGenDay) >= 1 && Number(rawGenDay) <= 31 ? Number(rawGenDay) : 1;
  if (!rawGenDay && billingStartDate) {
    const day = Number(billingStartDate.split("-")[2]);
    if (day >= 1 && day <= 31) invoiceGenerationDay = day;
  }

  const rawTerms = read(row, "Payment Terms Days", "Terms", "payment_terms_days");
  let paymentTermsDays = Number(rawTerms) >= 0 ? Number(rawTerms) : 7;

  const autoGenerateInvoice = parseBoolean(
    read(row, "Auto Generate Invoice", "Auto Generate", "auto_generate_invoice"),
    true
  );
  const autoSendInvoice = parseBoolean(read(row, "Auto Send Invoice", "Auto Send", "auto_send_invoice"), false);

  const rawDueDate = read(row, "Due Date", "due_date", "Invoice Due Date", "INVOICE DUE DATE", "invoice_due_date");
  let dueDate: string | null = null;
  if (rawDueDate) {
    dueDate = parseDate(rawDueDate);
  } else {
    if (billingStartDate) {
      const d = new Date(`${billingStartDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + paymentTermsDays);
      dueDate = d.toISOString().slice(0, 10);
    } else {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + paymentTermsDays);
      dueDate = d.toISOString().slice(0, 10);
    }
  }

  if (!rawTerms && billingStartDate && dueDate) {
    const start = new Date(`${billingStartDate}T00:00:00Z`).getTime();
    const end = new Date(`${dueDate}T00:00:00Z`).getTime();
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) paymentTermsDays = diffDays;
  }

  const rawStatus = read(row, "Status", "status").toUpperCase();
  const status: "ACTIVE" | "PAUSED" | "CANCELLED" =
    rawStatus === "PAUSED" ? "PAUSED" : rawStatus === "CANCELLED" ? "CANCELLED" : "ACTIVE";

  const sourceReference =
    read(
      row,
      "Source Reference",
      "Payment Reference",
      "Reference",
      "source_reference",
      "Invoice No",
      "INVOICE NO.",
      "invoice_no"
    ) || null;

  // Validation
  if (!clientName) {
    errors.push({ row: rowNumber, field: "Client Name", message: "Client name is required." });
  }
  if (!service) {
    errors.push({ row: rowNumber, field: "Service", message: "Service is required." });
  }
  if (!isAmountOmitted && (!Number.isFinite(amount) || amount <= 0)) {
    errors.push({ row: rowNumber, field: "Amount", message: "Amount must be a positive number." });
  }
  if (!dueDate) {
    errors.push({ row: rowNumber, field: "Due Date", message: "Due date is invalid or missing." });
  }

  if (errors.length || !dueDate) {
    return { errors };
  }

  const record = {
    clientCode,
    clientName,
    companyName,
    contactPerson,
    email,
    phone,
    address,
    city,
    state,
    gstNumber,
    service,
    serviceDescription,
    billingType,
    billingFrequency,
    amount,
    currency,
    invoiceGenerationDay,
    paymentTermsDays,
    autoGenerateInvoice,
    autoSendInvoice,
    billingStartDate,
    billingEndDate,
    dueDate,
    status,
    sourceReference,
    // Aliases for compatibility
    client: clientName,
    billingFrom: billingStartDate,
    billingTo: billingEndDate,
    reference: sourceReference,
  };

  return { errors, value: record };
}
