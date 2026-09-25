import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/lib/payment-state";
import { PaymentService } from "@/lib/payment-service";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { demoModeEnabled, demoPayments } from "@/lib/demo-mode";
import { operationalStore } from "@/lib/operational-store";

export async function GET(request: Request) {
  if (demoModeEnabled()) return NextResponse.json(demoPayments());

  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;

  if (!process.env.DATABASE_URL) {
    const rows = operationalStore.getPayments({ month, status, search });
    return NextResponse.json(rows);
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const rows = await getDb().select().from(payments).orderBy(desc(payments.id));
    if (rows.length > 0) {
      let filtered = rows;
      if (month) {
        filtered = filtered.filter((p) => p.dueDate.startsWith(month));
      }
      if (status && status !== "ALL") {
        filtered = filtered.filter((p) => p.status === status);
      }
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.client.toLowerCase().includes(q) ||
            p.service.toLowerCase().includes(q) ||
            (p.sourceReference && p.sourceReference.toLowerCase().includes(q))
        );
      }
      return NextResponse.json(filtered);
    }

    return NextResponse.json(operationalStore.getPayments({ month, status, search }));
  } catch (error) {
    return NextResponse.json(operationalStore.getPayments({ month, status, search }));
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole("FOUNDER", "ACCOUNTS_MANAGER");
    const body = ((await request.json()) as { id: number; status: string; note?: string });

    if (!Number.isInteger(body.id) || !PAYMENT_STATUSES.includes(body.status as PaymentStatus)) {
      return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });
    }

    if (!process.env.DATABASE_URL) {
      const updated = operationalStore.updatePaymentStatus(body.id, body.status as any, user.id, body.note);
      return NextResponse.json(updated);
    }

    const updated = await new PaymentService().changeStatus(
      body.id,
      body.status as PaymentStatus,
      user.id,
      body.note || "manual-status-update"
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const body = ((await request.json().catch(() => ({}))) as { id: number; status: string; note?: string });
      if (body?.id && body?.status) {
        return NextResponse.json(operationalStore.updatePaymentStatus(body.id, body.status as any, 1, body.note));
      }
      return databaseNotConfiguredResponse();
    }
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          code === "UNAUTHORIZED"
            ? "Authentication required."
            : code === "FORBIDDEN"
            ? "Insufficient permissions."
            : code === "PAYMENT_NOT_FOUND"
            ? "Payment not found."
            : code === "INVALID_PAYMENT_TRANSITION"
            ? "This payment status transition is not allowed."
            : "Unable to update payment.",
      },
      {
        status:
          code === "UNAUTHORIZED"
            ? 401
            : code === "FORBIDDEN"
            ? 403
            : code === "PAYMENT_NOT_FOUND"
            ? 404
            : code === "INVALID_PAYMENT_TRANSITION"
            ? 409
            : 500,
      }
    );
  }
}
