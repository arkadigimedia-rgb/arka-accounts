import { NextResponse } from "next/server";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const subtotal = Number(body.subtotal ?? body.amount ?? 0);
    const taxRate = body.taxRate !== undefined ? Number(body.taxRate) : 0;
    const taxAmount = body.taxAmount !== undefined ? Number(body.taxAmount) : Math.round(subtotal * (taxRate / 100));
    const totalAmount = body.totalAmount !== undefined ? Number(body.totalAmount) : subtotal + taxAmount;

    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: body.invoiceNumber || "INV-PREVIEW",
      issueDate: body.issueDate || new Date().toISOString().slice(0, 10),
      dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
      billingPeriodStart: body.billingPeriodStart || null,
      billingPeriodEnd: body.billingPeriodEnd || null,
      client: {
        name: body.clientName || body.companyName || "Valued Client",
        companyName: body.companyName || body.clientName || "Valued Client",
        contactPerson: body.contactPerson,
        phone: body.phone,
        address: body.address || "Hosakote, Bengaluru, Karnataka",
        city: body.city || "Hosakote",
        state: body.state || "Karnataka",
        gstNumber: body.gstNumber,
      },
      service: {
        name: body.service || "Digital Marketing Service / Google and Meta Ads",
        description: body.serviceDescription || body.service || "Digital Marketing Service / Google and Meta Ads",
      },
      subtotal,
      taxAmount,
      totalAmount,
      currency: "INR",
      paymentInstructions: body.paymentInstructions
        ? {
            accountNumber: body.paymentInstructions.accountNumber || "1322054000000346",
            accountName: body.paymentInstructions.accountName || "ESHWAR SP",
            ifsc: body.paymentInstructions.ifsc || "KVBL0001322",
            bankName: body.paymentInstructions.bankName || body.paymentInstructions.branch || "Hosakote",
          }
        : {
            accountNumber: "1322054000000346",
            accountName: "ESHWAR SP",
            ifsc: "KVBL0001322",
            bankName: "Hosakote",
          },
    });

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBytes.byteLength),
        "Content-Disposition": `inline; filename="${(body.invoiceNumber || "Invoice").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error generating preview PDF:", error);
    const msg = error instanceof Error ? error.message : "Failed to generate preview PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
