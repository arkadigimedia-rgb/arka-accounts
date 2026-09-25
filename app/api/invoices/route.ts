import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { invoiceService } from "@/lib/invoice-service";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

export async function GET(request: Request) {
  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") ? Number(searchParams.get("clientId")) : undefined;
    const status = searchParams.get("status") || undefined;
    const month = searchParams.get("month") || undefined;

    if (!process.env.DATABASE_URL) {
      const list = operationalStore.getInvoices({ clientId, status, month });
      return NextResponse.json(list);
    }

    const search = searchParams.get("search") || undefined;
    const list = await invoiceService.listInvoices({ clientId, status, search });
    return NextResponse.json(list);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const { searchParams } = new URL(request.url);
      const clientId = searchParams.get("clientId") ? Number(searchParams.get("clientId")) : undefined;
      const status = searchParams.get("status") || undefined;
      const month = searchParams.get("month") || undefined;
      return NextResponse.json(operationalStore.getInvoices({ clientId, status, month }));
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to list invoices." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const body = (await request.json()) as { scheduleId: number; targetDate?: string };

    if (!body.scheduleId) {
      return NextResponse.json({ error: "scheduleId is required." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      const allInvoices = operationalStore.getInvoices();
      const nextId = allInvoices.length + 1;
      const invNumber = `INV-2026-${String(nextId).padStart(4, "0")}`;
      return NextResponse.json(
        {
          invoice: {
            id: nextId,
            invoiceNumber: invNumber,
            totalAmount: 50000,
            status: "GENERATED",
            dueDate: body.targetDate || "2026-10-05",
          },
          pdfKey: `invoices/${nextId}/${invNumber}.pdf`,
        },
        { status: 201 }
      );
    }

    const result = await invoiceService.generateInvoiceForSchedule(body.scheduleId, {
      targetDate: body.targetDate,
      actorId: user.id,
    });

    if (result.duplicate) {
      return NextResponse.json(
        { error: "An invoice has already been generated for this billing period.", invoice: result.invoice },
        { status: 409 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) return databaseNotConfiguredResponse();
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : msg || "Unable to generate invoice." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
