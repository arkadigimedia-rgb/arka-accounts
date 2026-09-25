import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { invoiceService } from "@/lib/invoice-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
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

    const invoice = await invoiceService.getInvoice(id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const id = Number((await params).id);
      const data = operationalStore.getInvoiceById(id);
      if (data) {
        return NextResponse.json({
          ...data.invoice,
          client: data.client,
          payment: data.payment,
        });
      }
      return databaseNotConfiguredResponse();
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to load invoice." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
