import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoices, payments } from "@/db/schema";
import { currentUser, requireRole } from "@/lib/auth";
import { databaseNotConfiguredResponse, isDatabaseNotConfigured } from "@/lib/database-config";
import { operationalStore } from "@/lib/operational-store";

const kolkataToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

function computeStoreReport(today: string, isHr = false) {
  const allPayments = operationalStore.getPayments();
  const allInvoices = operationalStore.getInvoices();

  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let dueTodayCount = 0;
  let overdueCount = 0;
  let paidCount = 0;
  let verificationCount = 0;

  const aging = {
    current: 0,
    days1To30: 0,
    days31To60: 0,
    days61Plus: 0,
  };

  const clientOutstandingMap = new Map<string, { client: string; outstanding: number; overdue: number }>();

  for (const p of allPayments) {
    const clientKey = p.client;
    if (!clientOutstandingMap.has(clientKey)) {
      clientOutstandingMap.set(clientKey, { client: clientKey, outstanding: 0, overdue: 0 });
    }
    const clientEntry = clientOutstandingMap.get(clientKey)!;

    if (p.status === "PAID") {
      totalCollected += p.paidAmount || p.expectedAmount || 0;
      paidCount++;
    } else if (p.status !== "REJECTED") {
      totalOutstanding += p.expectedAmount;
      clientEntry.outstanding += p.expectedAmount;

      if (["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status)) {
        verificationCount++;
      }

      if (p.dueDate === today) {
        dueTodayCount++;
      } else if (p.dueDate < today || p.status === "OVERDUE") {
        totalOverdue += p.expectedAmount;
        overdueCount++;
        clientEntry.overdue += p.expectedAmount;

        const diffMs = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${p.dueDate}T00:00:00Z`);
        const daysPast = Math.floor(diffMs / 86400000);
        if (daysPast <= 30) aging.days1To30 += p.expectedAmount;
        else if (daysPast <= 60) aging.days31To60 += p.expectedAmount;
        else aging.days61Plus += p.expectedAmount;
      } else {
        aging.current += p.expectedAmount;
      }
    }
  }

  const clientOutstanding = Array.from(clientOutstandingMap.values())
    .filter((c) => c.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  return {
    summary: {
      totalInvoiced: isHr ? null : allInvoices.reduce((s, i) => s + i.totalAmount, 0),
      invoiceCount: allInvoices.length,
      totalCollected,
      totalOutstanding,
      totalOverdue,
      dueTodayCount,
      overdueCount,
      paidCount,
      verificationCount,
    },
    aging,
    clientOutstanding,
    recentPayments: allPayments.slice(0, 15),
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  if (operationalStore.getClients().length === 0) {
    try {
      await operationalStore.syncLiveGoogleSheet();
    } catch (e) {
      console.error("Auto-sync error on empty store:", e);
    }
  }

  const today = kolkataToday();
  const user = await currentUser();
  const isHr = user?.role === "HR";

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(computeStoreReport(today, isHr));
  }

  try {
    await requireRole("FOUNDER", "ACCOUNTS_MANAGER", "ACCOUNT_MANAGER");
    const db = getDb();

    // 1. Total Invoiced
    const [invSum] = await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
      })
      .from(invoices);

    // 2. All Payments with Client details
    const paymentRows = await db
      .select({
        id: payments.id,
        clientId: payments.clientId,
        client: payments.client,
        service: payments.service,
        expectedAmount: payments.expectedAmount,
        paidAmount: payments.paidAmount,
        dueDate: payments.dueDate,
        status: payments.status,
        paidDate: payments.paidDate,
      })
      .from(payments)
      .orderBy(desc(payments.id));

    if (paymentRows.length === 0) {
      return NextResponse.json(computeStoreReport(today));
    }

    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let verificationCount = 0;

    const aging = {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61Plus: 0,
    };

    const clientOutstandingMap = new Map<string, { client: string; outstanding: number; overdue: number }>();

    for (const p of paymentRows) {
      const clientKey = p.client;
      if (!clientOutstandingMap.has(clientKey)) {
        clientOutstandingMap.set(clientKey, { client: clientKey, outstanding: 0, overdue: 0 });
      }
      const clientEntry = clientOutstandingMap.get(clientKey)!;

      if (p.status === "PAID") {
        totalCollected += p.paidAmount || p.expectedAmount || 0;
        paidCount++;
      } else if (p.status !== "REJECTED") {
        totalOutstanding += p.expectedAmount;
        clientEntry.outstanding += p.expectedAmount;

        if (["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status)) {
          verificationCount++;
        }

        if (p.dueDate === today) {
          dueTodayCount++;
        } else if (p.dueDate < today || p.status === "OVERDUE") {
          totalOverdue += p.expectedAmount;
          overdueCount++;
          clientEntry.overdue += p.expectedAmount;

          const diffMs = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${p.dueDate}T00:00:00Z`);
          const daysPast = Math.floor(diffMs / 86400000);
          if (daysPast <= 30) aging.days1To30 += p.expectedAmount;
          else if (daysPast <= 60) aging.days31To60 += p.expectedAmount;
          else aging.days61Plus += p.expectedAmount;
        } else {
          aging.current += p.expectedAmount;
        }
      }
    }

    const clientOutstanding = Array.from(clientOutstandingMap.values())
      .filter((c) => c.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    return NextResponse.json({
      summary: {
        totalInvoiced: isHr ? null : Number(invSum?.total ?? 0),
        invoiceCount: Number(invSum?.count ?? 0),
        totalCollected,
        totalOutstanding,
        totalOverdue,
        dueTodayCount,
        overdueCount,
        paidCount,
        verificationCount,
      },
      aging,
      clientOutstanding,
      recentPayments: paymentRows.slice(0, 15),
      generatedAt: new Date().toISOString(),
      role: isHr ? "HR" : "FOUNDER",
    });
  } catch (error) {
    return NextResponse.json(computeStoreReport(today, isHr));
  }
}
