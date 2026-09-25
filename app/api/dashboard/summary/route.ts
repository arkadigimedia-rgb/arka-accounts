import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { demoModeEnabled, demoPayments } from "@/lib/demo-mode";
import { operationalStore } from "@/lib/operational-store";

export async function GET() {
  if (demoModeEnabled()) {
    const demos = demoPayments();
    const expected = demos.reduce((s, d) => s + d.expectedAmount, 0);
    return NextResponse.json({
      counts: {
        dueToday: demos.filter((d) => d.status === "DUE_TODAY").length,
        upcoming: demos.filter((d) => d.status === "UPCOMING").length,
        overdue: demos.filter((d) => d.status === "OVERDUE").length,
        verification: demos.filter((d) => ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW"].includes(d.status)).length,
        paid: demos.filter((d) => d.status === "PAID").length,
      },
      amounts: { expected, paid: 0, pending: expected, overdue: 0 },
      invoices: { count: 0, total: 0 },
      demoMode: true,
      generatedAt: new Date().toISOString(),
    });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(operationalStore.getSummaryMetrics());
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const db = getDb();
    const rows = await db
      .select({
        status: payments.status,
        count: sql<number>`count(*)`,
        amount: sql<number>`coalesce(sum(${payments.expectedAmount}), 0)`,
      })
      .from(payments)
      .groupBy(payments.status);

    const byStatus = Object.fromEntries(
      rows.map((row) => [row.status, { count: Number(row.count), amount: Number(row.amount) }])
    );

    const expected = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const paid = byStatus.PAID?.amount ?? 0;

    // Get invoice summary counts
    const [invSummary] = await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      })
      .from(invoices);

    return NextResponse.json({
      counts: {
        dueToday: byStatus.DUE_TODAY?.count ?? 0,
        upcoming: byStatus.UPCOMING?.count ?? 0,
        overdue: byStatus.OVERDUE?.count ?? 0,
        verification:
          (byStatus.PROOF_UPLOADED?.count ?? 0) +
          (byStatus.VERIFYING?.count ?? 0) +
          (byStatus.MANUAL_REVIEW?.count ?? 0) +
          (byStatus.MISMATCH?.count ?? 0),
        paid: byStatus.PAID?.count ?? 0,
      },
      amounts: {
        expected,
        paid,
        pending: expected - paid,
        overdue: byStatus.OVERDUE?.amount ?? 0,
      },
      invoices: {
        count: Number(invSummary?.count ?? 0),
        total: Number(invSummary?.total ?? 0),
      },
      demoMode: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isDatabaseNotConfigured(error)) {
      return NextResponse.json(operationalStore.getSummaryMetrics());
    }
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Authentication required." : msg === "FORBIDDEN" ? "Insufficient permissions." : "Unable to load dashboard summary." },
      { status: msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500 }
    );
  }
}
