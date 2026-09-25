"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle,
  Download,
  FileSpreadsheet,
  IndianRupee,
  PieChart,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";

interface ReportData {
  summary: {
    totalInvoiced: number;
    invoiceCount: number;
    totalCollected: number;
    totalOutstanding: number;
    totalOverdue: number;
    dueTodayCount: number;
    overdueCount: number;
    paidCount: number;
    verificationCount: number;
  };
  aging: {
    current: number;
    days1To30: number;
    days31To60: number;
    days61Plus: number;
  };
  clientOutstanding: Array<{
    client: string;
    outstanding: number;
    overdue: number;
  }>;
  recentPayments: Array<{
    id: number;
    client: string;
    service: string;
    expectedAmount: number;
    paidAmount: number | null;
    dueDate: string;
    status: string;
  }>;
  generatedAt: string;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const report = (await res.json()) as any;
        setData(report);
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Unable to load financial report.");
      }
    } catch {
      setError("Network error fetching reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Client", "Outstanding Balance", "Overdue Balance"],
      ...data.clientOutstanding.map((c) => [c.client, String(c.outstanding), String(c.overdue)]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `arka_accounts_aging_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <BarChart3 className="h-4 w-4" />
              <span>Accounts Intelligence</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Financial Reports & Aging Analysis
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Operational accounts receivable aging, client concentration, collection rates, and cash flow tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCsv}
              disabled={!data || data.clientOutstanding.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={loadReports}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition"
            >
              <RefreshCw className="h-4 w-4 text-amber-400" />
              <span>Refresh Report</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="p-16 text-center text-sm text-slate-500">Generating financial reports...</div>
        ) : (
          <>
            {data.summary.totalInvoiced === 0 && (
              <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                    No Financial Ledger Data Ingested
                  </h3>
                  <p className="text-xs text-amber-800">
                    Financial aging reports and client ledger breakdowns will generate automatically once you connect your Google Sheet in Settings.
                  </p>
                </div>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shrink-0 shadow-xs"
                >
                  <span>Connect Google Sheet</span>
                </Link>
              </div>
            )}

            {/* Top Financial KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Billed</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{rupees(data.summary.totalInvoiced)}</p>
                <p className="text-[11px] text-slate-400 mt-1">{data.summary.invoiceCount} invoices generated</p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Collected</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">{rupees(data.summary.totalCollected)}</p>
                <p className="text-[11px] text-emerald-700/70 mt-1">{data.summary.paidCount} payments settled</p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Outstanding</p>
                <p className="mt-2 text-3xl font-black text-amber-600">{rupees(data.summary.totalOutstanding)}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Collection Rate:{" "}
                  {data.summary.totalInvoiced > 0
                    ? Math.round(
                        (data.summary.totalCollected /
                          (data.summary.totalCollected + data.summary.totalOutstanding)) *
                          100
                      )
                    : 100}
                  %
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delinquent / Overdue</p>
                <p className="mt-2 text-3xl font-black text-rose-600">{rupees(data.summary.totalOverdue)}</p>
                <p className="text-[11px] text-rose-600/70 mt-1">{data.summary.overdueCount} accounts past due</p>
              </div>
            </div>

            {/* Receivables Aging Bracket Strip */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 lg:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Accounts Receivable Aging Brackets</h2>
                  <p className="text-xs text-slate-500">Categorized by days past payment due date</p>
                </div>
                <span className="text-xs text-slate-400">
                  Calculated as of {new Date(data.generatedAt).toLocaleDateString("en-IN")}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Current (Not Overdue)
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{rupees(data.aging.current)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Due in future cycles</p>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/70">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    1 – 30 Days Overdue
                  </p>
                  <p className="mt-2 text-2xl font-black text-amber-900">{rupees(data.aging.days1To30)}</p>
                  <p className="text-[10px] text-amber-700/70 mt-1">Initial follow-up window</p>
                </div>

                <div className="p-5 rounded-2xl bg-orange-50/60 border border-orange-200/70">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-800">
                    31 – 60 Days Overdue
                  </p>
                  <p className="mt-2 text-2xl font-black text-orange-900">{rupees(data.aging.days31To60)}</p>
                  <p className="text-[10px] text-orange-700/70 mt-1">Escalated collection required</p>
                </div>

                <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200/70">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                    61+ Days (High Risk)
                  </p>
                  <p className="mt-2 text-2xl font-black text-rose-900">{rupees(data.aging.days61Plus)}</p>
                  <p className="text-[10px] text-rose-700/70 mt-1">Founder intervention needed</p>
                </div>
              </div>
            </div>

            {/* Client Concentration & Aging Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Client Outstanding Concentration ({data.clientOutstanding.length})
                  </h2>
                  <p className="text-xs text-slate-500">Ranked by total outstanding exposure</p>
                </div>
              </div>

              {data.clientOutstanding.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  No outstanding client balances at this time.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3.5">Client Account</th>
                        <th className="px-6 py-3.5">Total Outstanding</th>
                        <th className="px-6 py-3.5">Overdue Portion</th>
                        <th className="px-6 py-3.5">Risk Rating</th>
                        <th className="px-6 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.clientOutstanding.map((c, i) => {
                        const isSevere = c.overdue > 0 && c.overdue >= c.outstanding * 0.5;
                        return (
                          <tr key={i} className="hover:bg-slate-50/80 transition">
                            <td className="px-6 py-4 font-bold text-slate-900">{c.client}</td>
                            <td className="px-6 py-4 font-mono font-bold text-slate-900">
                              {rupees(c.outstanding)}
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-rose-600">
                              {c.overdue > 0 ? rupees(c.overdue) : "—"}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  isSevere
                                    ? "bg-rose-100 text-rose-800"
                                    : c.overdue > 0
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {isSevere ? "HIGH RISK" : c.overdue > 0 ? "ATTENTION" : "HEALTHY"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Link
                                href={`/follow-ups`}
                                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                              >
                                Follow-up
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ArkaShell>
  );
}
