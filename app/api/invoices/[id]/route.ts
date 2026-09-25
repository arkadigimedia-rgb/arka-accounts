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

  if (!process.env.DATABASE_URL) {
    const data = operationalStore.getInvoiceById(id);
    if (!data) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json({
      ...data.invoice,
      client: data.client,
      payment: data.payment,
    });
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const invoice = await invoiceService.getInvoice(id);
    if (invoice) return NextResponse.json(invoice);

    const data = operationalStore.getInvoiceById(id);
    if (data) {
      return NextResponse.json({
        ...data.invoice,
        client: data.client,
        payment: data.payment,
      });
    }
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  } catch (error) {
    const data = operationalStore.getInvoiceById(id);
    if (data) {
      return NextResponse.json({
        ...data.invoice,
        client: data.client,
        payment: data.payment,
      });
    }
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
}
