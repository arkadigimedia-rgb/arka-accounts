import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { paymentFields } from "@/lib/payment-views";
import { paymentLifecycle } from "@/lib/payment-lifecycle";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { demoModeEnabled, demoPayments } from "@/lib/demo-mode";
import { operationalStore } from "@/lib/operational-store";

export async function GET() {
  if (demoModeEnabled()) {
    const demos = demoPayments();
    return NextResponse.json(paymentLifecycle.actionRequired(demos));
  }

  if (!process.env.DATABASE_URL) {
    const rows = operationalStore.getActionRequired();
    return NextResponse.json(paymentLifecycle.actionRequired(rows as any));
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const rows = await getDb().select(paymentFields).from(payments).orderBy(desc(payments.id));
    return NextResponse.json(paymentLifecycle.actionRequired(rows));
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      const rows = operationalStore.getActionRequired();
      return NextResponse.json(paymentLifecycle.actionRequired(rows as any));
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to load action-required payments." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
