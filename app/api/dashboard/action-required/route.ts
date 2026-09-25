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

  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  if (!process.env.DATABASE_URL) {
    const rows = operationalStore.getActionRequired();
    return NextResponse.json(paymentLifecycle.actionRequired(rows as any));
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const rows = await getDb().select(paymentFields).from(payments).orderBy(desc(payments.id));
    if (rows.length > 0) {
      return NextResponse.json(paymentLifecycle.actionRequired(rows));
    }
    const storeRows = operationalStore.getActionRequired();
    return NextResponse.json(paymentLifecycle.actionRequired(storeRows as any));
  } catch (error) {
    const rows = operationalStore.getActionRequired();
    return NextResponse.json(paymentLifecycle.actionRequired(rows as any));
  }
}
