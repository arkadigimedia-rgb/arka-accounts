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
    return NextResponse.json(demoPayments().filter((p) => p.status === "OVERDUE"));
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(operationalStore.getPayments().filter((p) => p.status === "OVERDUE"));
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const rows = (await getDb().select(paymentFields).from(payments).orderBy(desc(payments.id)))
      .map(lifecycleView)
      .filter((p) => p.status === "OVERDUE");
    return NextResponse.json(rows);
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return NextResponse.json(operationalStore.getPayments().filter((p) => p.status === "OVERDUE"));
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to list payments." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
