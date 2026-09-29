import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { invoiceService } from "@/lib/invoice-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  const id = Number((await params).id);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
  }

  const formatResponse = (data: { invoice: any; client: any; payment: any }) => ({
    invoice: data.invoice,
    client: data.client,
    service: {
      id: data.invoice.id,
      name: data.invoice.service || "Digital Marketing Service / Google and Meta Ads",
      description: data.invoice.serviceDescription || data.invoice.notes || "Digital Marketing Service / Google and Meta Ads",
    },
    schedule: null,
    payment: data.payment,
    ...data.invoice,
  });

  if (!process.env.DATABASE_URL) {
    const data = operationalStore.getInvoiceById(id);
    if (!data) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json(formatResponse(data));
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const invoice = await invoiceService.getInvoice(id);
    if (invoice) {
      return NextResponse.json({
        ...invoice,
        ...(invoice.invoice || {}),
      });
    }

    const data = operationalStore.getInvoiceById(id);
    if (data) {
      return NextResponse.json(formatResponse(data));
    }
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  } catch (error) {
    const data = operationalStore.getInvoiceById(id);
    if (data) {
      return NextResponse.json(formatResponse(data));
    }
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    const body = await request.json();

    const updated = operationalStore.updateInvoice(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to update invoice";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(request, { params });
}
