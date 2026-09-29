import { NextResponse } from "next/server";
import { operationalStore } from "@/lib/operational-store";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export async function POST(request: Request) {
  try {
    if (operationalStore.getClients().length === 0) {
      try {
        await operationalStore.syncLiveGoogleSheet();
      } catch (e) {
        console.error("Auto-sync error on empty store:", e);
      }
    }

    const body = await request.json();

    if (!body.clientName && !body.companyName) {
      return NextResponse.json({ error: "Client Name or Company Name is required." }, { status: 400 });
    }

    const subtotal = Number(body.subtotal ?? body.amount ?? 0);
    const taxRate = body.taxRate !== undefined ? Number(body.taxRate) : 0;
    const taxAmount = body.taxAmount !== undefined ? Number(body.taxAmount) : Math.round(subtotal * (taxRate / 100));
    const totalAmount = body.totalAmount !== undefined ? Number(body.totalAmount) : subtotal + taxAmount;

    const result = operationalStore.createCustomInvoice({
      invoiceNumber: body.invoiceNumber,
      clientId: body.clientId ? Number(body.clientId) : undefined,
      clientName: body.clientName || body.companyName,
      companyName: body.companyName || body.clientName,
      contactPerson: body.contactPerson,
      phone: body.phone,
      email: body.email,
      address: body.address || "Hosakote, Bengaluru, Karnataka",
      city: body.city || "Hosakote",
      state: body.state || "Karnataka",
      gstNumber: body.gstNumber,
      service: body.service || "Digital Marketing Service / Google and Meta Ads",
      serviceDescription: body.serviceDescription || "Digital Marketing Service / Google and Meta Ads",
      subtotal,
      taxAmount,
      totalAmount,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      billingPeriodStart: body.billingPeriodStart,
      billingPeriodEnd: body.billingPeriodEnd,
      status: body.status || "GENERATED",
      notes: body.notes || null,
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

    return NextResponse.json(
      {
        success: true,
        invoice: result.invoice,
        client: result.client,
        payment: result.payment,
        pdfUrl: `/api/invoices/${result.invoice.id}/pdf`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating custom invoice:", error);
    const msg = error instanceof Error ? error.message : "Failed to create invoice";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
