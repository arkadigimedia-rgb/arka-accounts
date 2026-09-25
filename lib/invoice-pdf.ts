import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { ARKA_INVOICE_TEMPLATE_BASE64 } from "./assets/arka-invoice-template-base64";

export type InvoicePdfData = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  client: {
    name: string;
    companyName?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    gstNumber?: string | null;
  };
  service: {
    name: string;
    description?: string | null;
  };
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency?: string;
  paymentInstructions?: {
    accountName?: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
  };
};

function formatDateDisplay(d?: string): string {
  if (!d) return "-";
  const trimmed = d.trim();
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, day] = trimmed.split("-");
    return `${day}.${m}.${y}`;
  }
  return trimmed;
}

function formatCurrency(amount: number, currency = "INR"): string {
  const prefix = currency === "INR" ? "INR " : `${currency} `;
  return `${prefix}${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  let doc: PDFDocument;

  try {
    const templateBytes = Buffer.from(ARKA_INVOICE_TEMPLATE_BASE64, "base64");
    doc = await PDFDocument.load(templateBytes);
  } catch {
    // Graceful fallback if template cannot be read
    doc = await PDFDocument.create();
    doc.addPage([595.5, 842.25]);
  }

  const page = doc.getPage(0);
  const { width } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const dark = rgb(0.12, 0.15, 0.18);
  const muted = rgb(0.38, 0.42, 0.46);
  const white = rgb(1, 1, 1);

  // Helper for right-aligned text placement
  const drawTextRight = (
    text: string,
    rightX: number,
    y: number,
    font = fontRegular,
    size = 9.5,
    color = dark
  ) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightX - textWidth, y, size, font, color });
  };

  // 1. Invoice Metadata (Top Right)
  // Aligned immediately after the template's colons (which sit at x = 506)
  page.drawText(data.invoiceNumber || "INV-0001", {
    x: 518,
    y: 676,
    size: 9.5,
    font: fontBold,
    color: dark,
  });

  page.drawText(formatDateDisplay(data.issueDate), {
    x: 518,
    y: 651,
    size: 9.5,
    font: fontRegular,
    color: dark,
  });

  page.drawText(formatDateDisplay(data.dueDate), {
    x: 518,
    y: 624,
    size: 9.5,
    font: fontBold,
    color: dark,
  });

  // 2. Client Details (Left, below "INVOICE TO :")
  let cy = 582;
  const clientName = data.client.companyName || data.client.name || "Valued Client";
  page.drawText(clientName.slice(0, 45), {
    x: 60,
    y: cy,
    size: 11,
    font: fontBold,
    color: dark,
  });
  cy -= 14;

  const contactLine = [
    data.client.contactPerson && data.client.contactPerson !== data.client.name
      ? `Attn: ${data.client.contactPerson}`
      : null,
    data.client.phone || null,
  ]
    .filter(Boolean)
    .join(" | ");

  if (contactLine) {
    page.drawText(contactLine.slice(0, 50), {
      x: 60,
      y: cy,
      size: 8.5,
      font: fontRegular,
      color: muted,
    });
    cy -= 12;
  }

  if (data.client.email) {
    page.drawText(data.client.email.slice(0, 50), {
      x: 60,
      y: cy,
      size: 8.5,
      font: fontRegular,
      color: muted,
    });
    cy -= 12;
  }

  const rawAddr = (data.client.address || "").trim();
  const parts: string[] = [];
  if (rawAddr) parts.push(rawAddr);
  if (data.client.city && !rawAddr.toLowerCase().includes(data.client.city.toLowerCase())) {
    parts.push(data.client.city);
  }
  if (data.client.state && !rawAddr.toLowerCase().includes(data.client.state.toLowerCase())) {
    parts.push(data.client.state);
  }
  const addressLine = parts.join(", ");
  if (addressLine) {
    page.drawText(addressLine.slice(0, 55), {
      x: 60,
      y: cy,
      size: 8.5,
      font: fontRegular,
      color: muted,
    });
    cy -= 12;
  }

  if (data.client.gstNumber) {
    page.drawText(`GSTIN: ${data.client.gstNumber}`, {
      x: 60,
      y: cy,
      size: 8.5,
      font: fontBold,
      color: dark,
    });
  }

  // 3. Table Line Items (Banner is y = 457 to 488; separator line is at y = 384)
  const itemY = 432;
  const serviceName = data.service.name || "Retainer Operations";
  page.drawText(serviceName.slice(0, 40), {
    x: 26,
    y: itemY,
    size: 10,
    font: fontBold,
    color: dark,
  });

  const serviceDesc =
    data.service.description || "Monthly Media & Digital Operations Retainer";
  page.drawText(serviceDesc.slice(0, 60), {
    x: 26,
    y: itemY - 14,
    size: 8.5,
    font: fontOblique,
    color: muted,
  });

  if (data.billingPeriodStart && data.billingPeriodEnd) {
    const periodText = `Billing Period: ${formatDateDisplay(data.billingPeriodStart)} to ${formatDateDisplay(data.billingPeriodEnd)}`;
    page.drawText(periodText, {
      x: 26,
      y: itemY - 26,
      size: 8,
      font: fontRegular,
      color: muted,
    });
  }

  // Column values
  const priceFormatted = formatCurrency(data.subtotal, data.currency);
  const gstFormatted =
    data.taxAmount > 0
      ? `${formatCurrency(data.taxAmount, data.currency)} (18%)`
      : "0.00";
  const totalFormatted = formatCurrency(data.totalAmount, data.currency);

  drawTextRight(priceFormatted, 335, itemY, fontRegular, 9.5, dark);
  drawTextRight(gstFormatted, 445, itemY, fontRegular, 9, dark);
  drawTextRight(totalFormatted, 562, itemY, fontBold, 10, dark);

  // 4. Totals Breakdown (Right-aligned below table divider)
  const subtotalFormatted = formatCurrency(data.subtotal, data.currency);
  const cgstAmount = data.taxAmount > 0 ? data.taxAmount / 2 : 0;
  const sgstAmount = data.taxAmount > 0 ? data.taxAmount / 2 : 0;

  drawTextRight(subtotalFormatted, 562, 353, fontRegular, 9.5, dark);
  drawTextRight(formatCurrency(cgstAmount, data.currency), 562, 327, fontRegular, 9.5, dark);
  drawTextRight(formatCurrency(sgstAmount, data.currency), 562, 301, fontRegular, 9.5, dark);

  // 5. Total Banner (Inside Golden Bar y = 238 to 269)
  drawTextRight(totalFormatted, 560, 250, fontBold, 12, white);

  // 6. Payment Details (Bottom Left)
  const instructions = data.paymentInstructions || {};
  const acctNo = instructions.accountNumber || "9110661283001";
  const acctName = instructions.accountName || "Arka Digital Media";
  const ifsc = instructions.ifsc || "HDFC0001234";
  const branch = instructions.bankName || "Hoskote Branch, Bengaluru";

  page.drawText(acctNo, { x: 145, y: 158, size: 9.5, font: fontBold, color: dark });
  page.drawText(acctName, { x: 145, y: 138, size: 9.5, font: fontRegular, color: dark });
  page.drawText(ifsc, { x: 145, y: 119, size: 9.5, font: fontRegular, color: dark });
  page.drawText(branch, { x: 145, y: 100, size: 9.5, font: fontRegular, color: dark });

  return doc.save();
}
