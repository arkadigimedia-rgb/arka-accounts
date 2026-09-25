"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArkaShell, useAuth } from "@/components/arka-shell";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  Filter,
  IndianRupee,
  Search,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

interface PaymentItem {
  id: number;
  clientId: number | null;
  client: string;
  service: string;
  expectedAmount: number;
  paidAmount: number | null;
  dueDate: string;
  status: string;
  utr: string | null;
  paymentMode: string | null;
  notes: string | null;
  createdAt: string;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatStatus = (val: string) =>
  val
    .split("_")
    .map((s) => s.charAt(0) + s.slice(1).toLowerCase())
    .join(" ");

export default function PaymentsPage() {
  const { isHr } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      if (res.ok) {
        const data = (await res.json()) as any;
        setPayments(Array.isArray(data) ? data : []);
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Unable to load payments ledger.");
      }
    } catch {
      setError("Network error fetching payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => {
      if (p.dueDate && /^\d{4}-\d{2}/.test(p.dueDate)) set.add(p.dueDate.slice(0, 7));
    });
    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((ym) => {
        const [y, m] = ym.split("-");
        const dt = new Date(Number(y), Number(m) - 1, 1);
        return {
          value: ym,
          label: isNaN(dt.getTime()) ? ym : dt.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        };
      });
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.client.toLowerCase().includes(search.toLowerCase()) ||
        p.service.toLowerCase().includes(search.toLowerCase()) ||
        (p.utr && p.utr.toLowerCase().includes(search.toLowerCase())) ||
        String(p.id).includes(search);

      const matchesStatus =
        statusFilter === "ALL" ||
        p.status === statusFilter ||
        (statusFilter === "QUEUE" &&
          ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status)) ||
        (statusFilter === "UNPAID" &&
          ["DUE", "DUE_TODAY", "OVERDUE", "PENDING"].includes(p.status));

      const matchesMonth = monthFilter === "" || p.dueDate.startsWith(monthFilter);

      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [payments, search, statusFilter, monthFilter]);

  const kpis = useMemo(() => {
    const totalExpected = payments.reduce((s, p) => s + (p.expectedAmount || 0), 0);
    const totalCollected = payments
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + (p.paidAmount || p.expectedAmount || 0), 0);
    const overdueCount = payments.filter((p) => p.status === "OVERDUE").length;
    const verificationQueueCount = payments.filter((p) =>
      ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status)
    ).length;

    return { totalExpected, totalCollected, overdueCount, verificationQueueCount };
  }, [payments]);

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <CreditCard className="h-4 w-4" />
              <span>Receivables Ledger</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Payment Operations & Reconciliation Desk
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Track incoming settlements, verify proof of transfers, audit UTRs, and advance payment statuses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/verification"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold shadow-sm transition"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Verification Queue ({kpis.verificationQueueCount})</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isHr ? "Pending Accounts" : "Total Receivables"}
            </p>
            <p className={`mt-2 text-2xl lg:text-3xl font-black ${isHr ? "text-amber-600" : "text-slate-900"}`}>
              {isHr
                ? payments.filter((p) => p.status !== "PAID" && p.status !== "REJECTED").length
                : rupees(kpis.totalExpected)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {isHr ? "Active client dues to recover" : `${payments.length} scheduled payments`}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isHr ? "Settled Accounts" : "Collected & Settled"}
            </p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-emerald-600">
              {isHr
                ? payments.filter((p) => p.status === "PAID").length
                : rupees(kpis.totalCollected)}
            </p>
            <p className="text-[11px] text-emerald-700/70 mt-1">
              {payments.filter((p) => p.status === "PAID").length} verified transactions
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delinquent / Overdue</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-rose-600">{kpis.overdueCount}</p>
            <p className="text-[11px] text-rose-600/70 mt-1">Payments past due date</p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Verification Queue</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-amber-500">{kpis.verificationQueueCount}</p>
            <p className="text-[11px] text-amber-700/70 mt-1">Proofs awaiting human sign-off</p>
          </div>
        </div>

        {/* Month Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-500 shrink-0 mr-1">Billing Cycle:</span>
          <button
            type="button"
            onClick={() => setMonthFilter("")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              monthFilter === ""
                ? "bg-slate-950 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span>All Cycles</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                monthFilter === "" ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-600"
              }`}
            >
              {payments.length}
            </span>
          </button>
          {availableMonths.map((m) => {
            const count = payments.filter((p) => p.dueDate.startsWith(m.value)).length;
            const active = monthFilter === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMonthFilter(m.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  active
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{m.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    active ? "bg-amber-400 text-slate-950" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search client, service, or UTR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
              {monthFilter && (
                <button
                  onClick={() => setMonthFilter("")}
                  className="text-[10px] text-slate-400 hover:text-slate-700 underline"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 transition"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="QUEUE">Verification Queue (Proofs)</option>
                <option value="UNPAID">Pending & Overdue</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="PAID">Paid & Settled</option>
                <option value="MANUAL_REVIEW">Manual Review</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Payments Ledger ({filteredPayments.length})
            </h2>
            <span className="text-xs text-slate-500">Atomic transactions & verification tracking</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading payments ledger...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center space-y-4 max-w-md mx-auto">
              <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto text-slate-500">
                <CreditCard className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">
                  {payments.length === 0 ? "No Payments Recorded Yet" : "No matching payment records found"}
                </p>
                <p className="text-xs text-slate-500">
                  {payments.length === 0
                    ? "Connect your operational Google Spreadsheet in Settings to populate your live payment ledger."
                    : "Try adjusting your search query, status, or cycle filter."}
                </p>
              </div>
              {payments.length === 0 && (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition shadow-xs"
                >
                  <span>Go to Settings & Sync Sheet</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Ref ID</th>
                    <th className="px-6 py-3.5">Client & Service</th>
                    <th className="px-6 py-3.5">Due Date</th>
                    <th className="px-6 py-3.5">Expected (₹)</th>
                    <th className="px-6 py-3.5">Received (₹)</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">UTR / Reference</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((p) => {
                    const isQueue = [
                      "PROOF_UPLOADED",
                      "VERIFYING",
                      "MANUAL_REVIEW",
                      "MISMATCH",
                    ].includes(p.status);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">
                          <Link href={`/payments/${p.id}`} className="hover:underline">
                            PAY-{p.id}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          {p.clientId ? (
                            <Link
                              href={`/clients/${p.clientId}`}
                              className="font-bold text-slate-900 hover:text-amber-600 transition"
                            >
                              {p.client}
                            </Link>
                          ) : (
                            <span className="font-bold text-slate-900">{p.client}</span>
                          )}
                          <p className="text-xs text-slate-500">{p.service}</p>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-600">{p.dueDate}</td>
                        <td className="px-6 py-4 font-black text-slate-900">{rupees(p.expectedAmount)}</td>
                        <td className="px-6 py-4 font-semibold text-slate-700">
                          {p.paidAmount ? rupees(p.paidAmount) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              p.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : p.status === "OVERDUE"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : isQueue
                                ? "bg-amber-50 text-amber-700 border border-amber-200 font-bold"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {formatStatus(p.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-600">
                          {p.utr ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                              {p.utr}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Link
                            href={`/payments/${p.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Details</span>
                          </Link>

                          {isQueue && (
                            <Link
                              href={`/verification/${p.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition shadow-sm"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Review</span>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ArkaShell>
  );
}
