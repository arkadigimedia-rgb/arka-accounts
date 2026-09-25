import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { invoices, payments } from "@/db/schema";
import { currentUser, requireRole } from "@/lib/auth";
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

  // Ensure store is populated if empty
  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  const user = await currentUser();
  const isHr = user?.role === "HR";

  if (!process.env.DATABASE_URL) {
    const metrics = operationalStore.getSummaryMetrics();
    return NextResponse.json({
      ...metrics,
      role: isHr ? "HR" : "FOUNDER",
      user: {
        id: user?.id ?? (isHr ? 2 : 1),
        name: user?.name ?? (isHr ? "ARKA HR Operations" : "ARKA Founder (Admin)"),
        email: user?.email ?? (isHr ? "hr@arkadigitalmedia.in" : "founder@arkadigitalmedia.in"),
        role: isHr ? "HR" : "FOUNDER",
      },
      amounts: isHr
        ? {
            expected: null,
            paid: null,
            pending: null,
            overdue: null,
          }
        : {
            ...metrics.amounts,
          },
      invoices: {
        count: metrics.invoices?.count ?? 0,
        total: isHr ? null : metrics.invoices?.total ?? 0,
      },
    });
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER", "HR");
    const db = getDb();
    const rows = await db
      .select({
        status: payments.status,
        count: sql<number>`count(*)`,
        amount: sql<number>`coalesce(sum(${payments.expectedAmount}), 0)`,
      })
      .from(payments)
      .groupBy(payments.status);

    // Get invoice summary counts
    const [invSummary] = await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      })
      .from(invoices);

    // If database has records, return database summary!
    if (rows.length > 0 || Number(invSummary?.count ?? 0) > 0) {
      const byStatus = Object.fromEntries(
        rows.map((row) => [row.status, { count: Number(row.count), amount: Number(row.amount) }])
      );
      const expected = rows.reduce((sum, row) => sum + Number(row.amount), 0);
      const paid = byStatus.PAID?.amount ?? 0;

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
        amounts: isHr
          ? {
              expected: null,
              paid: null,
              pending: null,
              overdue: null,
            }
          : {
              expected,
              paid,
              pending: expected - paid,
              overdue: byStatus.OVERDUE?.amount ?? 0,
            },
        invoices: {
          count: Number(invSummary?.count ?? 0),
          total: isHr ? null : Number(invSummary?.total ?? 0),
        },
        role: isHr ? "HR" : "FOUNDER",
        user: {
          id: user?.id ?? (isHr ? 2 : 1),
          name: user?.name ?? (isHr ? "ARKA HR Operations" : "ARKA Founder (Admin)"),
          email: user?.email ?? (isHr ? "hr@arkadigitalmedia.in" : "founder@arkadigitalmedia.in"),
          role: isHr ? "HR" : "FOUNDER",
        },
        demoMode: false,
        generatedAt: new Date().toISOString(),
      });
    }

    // If database has 0 records, return operational store metrics (which are live from Google Sheet)
    const storeMetrics = operationalStore.getSummaryMetrics();
    return NextResponse.json({
      ...storeMetrics,
      role: isHr ? "HR" : "FOUNDER",
      user: {
        id: user?.id ?? (isHr ? 2 : 1),
        name: user?.name ?? (isHr ? "ARKA HR Operations" : "ARKA Founder (Admin)"),
        email: user?.email ?? (isHr ? "hr@arkadigitalmedia.in" : "founder@arkadigitalmedia.in"),
        role: isHr ? "HR" : "FOUNDER",
      },
      amounts: isHr
        ? {
            expected: null,
            paid: null,
            pending: null,
            overdue: null,
          }
        : {
            ...storeMetrics.amounts,
          },
      invoices: {
        count: storeMetrics.invoices?.count ?? 0,
        total: isHr ? null : storeMetrics.invoices?.total ?? 0,
      },
    });
  } catch (error) {
    // Graceful fallback to operational store metrics
    const storeMetrics = operationalStore.getSummaryMetrics();
    return NextResponse.json({
      ...storeMetrics,
      role: isHr ? "HR" : "FOUNDER",
      user: {
        id: user?.id ?? (isHr ? 2 : 1),
        name: user?.name ?? (isHr ? "ARKA HR Operations" : "ARKA Founder (Admin)"),
        email: user?.email ?? (isHr ? "hr@arkadigitalmedia.in" : "founder@arkadigitalmedia.in"),
        role: isHr ? "HR" : "FOUNDER",
      },
      amounts: isHr
        ? {
            expected: null,
            paid: null,
            pending: null,
            overdue: null,
          }
        : {
            ...storeMetrics.amounts,
          },
      invoices: {
        count: storeMetrics.invoices?.count ?? 0,
        total: isHr ? null : storeMetrics.invoices?.total ?? 0,
      },
    });
  }
}
