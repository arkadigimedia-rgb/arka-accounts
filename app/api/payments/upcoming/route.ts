import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { paymentFields, lifecycleView } from "@/lib/payment-views";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { demoModeEnabled, demoPayments } from "@/lib/demo-mode";
import { operationalStore } from "@/lib/operational-store";

export async function GET() {
  if (demoModeEnabled()) {
    return NextResponse.json(demoPayments().filter((p) => p.status === "UPCOMING"));
  }

  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(operationalStore.getPayments().filter((p) => p.status === "UPCOMING"));
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const rows = (await getDb().select(paymentFields).from(payments).orderBy(desc(payments.id)))
      .map(lifecycleView)
      .filter((p) => p.status === "UPCOMING");
    if (rows.length > 0) {
      return NextResponse.json(rows);
    }
    return NextResponse.json(operationalStore.getPayments().filter((p) => p.status === "UPCOMING"));
  } catch (error) {
    return NextResponse.json(operationalStore.getPayments().filter((p) => p.status === "UPCOMING"));
  }
}
