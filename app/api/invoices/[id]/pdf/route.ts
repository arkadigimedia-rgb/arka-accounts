import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  const id = Number((await params).id);

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");

    if (process.env.DATABASE_URL) {
      try {
        const db = getDb();
        const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));

        if (inv && inv.pdfStorageKey) {
          const storage = getStorageProvider();
          const file = await storage.get(inv.pdfStorageKey);
          return new Response(file.body, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Length": String(file.size),
              "Content-Disposition": `inline; filename="${inv.invoiceNumber}.pdf"`,
              "Cache-Control": "private, no-store",
            },
          });
        }
      } catch (dbErr) {
        // Fall through to operational store generator
      }
    }

    const data = operationalStore.getInvoiceById(id);
    if (!data) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    const { invoice: inv, client } = data;
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      billingPeriodStart: inv.billingPeriodStart,
      billingPeriodEnd: inv.billingPeriodEnd,
      client: {
        name: client?.name || inv.clientName,
        companyName: client?.companyName || inv.clientName,
        contactPerson: client?.contactPerson,
        email: client?.email,
        phone: client?.phone,
        address: client?.address,
        city: client?.city,
        state: client?.state,
        gstNumber: client?.gstNumber,
      },
      service: {
        name: inv.service,
        description: "Monthly Accounts & Operations Retainer",
      },
      subtotal: inv.subtotal,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount,
      currency: inv.currency,
    });

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBytes.byteLength),
        "Content-Disposition": `inline; filename="${inv.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const data = operationalStore.getInvoiceById(id);
    if (data) {
      const { invoice: inv, client } = data;
      const pdfBytes = await generateInvoicePdf({
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        billingPeriodStart: inv.billingPeriodStart,
        billingPeriodEnd: inv.billingPeriodEnd,
        client: {
          name: client?.name || inv.clientName,
          companyName: client?.companyName || inv.clientName,
          contactPerson: client?.contactPerson,
          email: client?.email,
          phone: client?.phone,
          address: client?.address,
          city: client?.city,
          state: client?.state,
          gstNumber: client?.gstNumber,
        },
        service: {
          name: inv.service,
          description: "Monthly Accounts & Operations Retainer",
        },
        subtotal: inv.subtotal,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
      });

      return new Response(pdfBytes as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(pdfBytes.byteLength),
          "Content-Disposition": `inline; filename="${inv.invoiceNumber}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return NextResponse.json({ error: "Unable to retrieve invoice PDF." }, { status: 500 });
  }
}
