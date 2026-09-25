"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  PlusCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

type ActionItem = {
  id: string;
  type: string;
  paymentId: number;
  client: string;
  service: string;
  amount: number;
  dueDate: string;
  paymentStatus: string;
  nextAction: string;
  reason: string;
  recommendedAction: string;
  context: string;
};

type SummaryData = {
  counts: {
    dueToday: number;
    upcoming: number;
    overdue: number;
    verification: number;
    paid: number;
  };
  amounts: {
    expected: number | null;
    paid: number;
    pending: number;
    overdue: number;
  };
  invoices: {
    count: number;
    total: number | null;
  };
  role?: "FOUNDER" | "HR";
  user?: {
    id: number;
    name: string;
    email: string;
    role: "FOUNDER" | "HR";
  };
  demoMode: boolean;
};

const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function ActionCenterPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentForFollowUp, setSelectedPaymentForFollowUp] = useState<ActionItem | null>(null);
  const [followUpAction, setFollowUpAction] = useState("Phone Call");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFollowUpDate(tomorrow.toISOString().slice(0, 10));
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, actRes] = await Promise.all([
        fetch("/api/dashboard/summary").then((r) => r.json() as Promise<any>),
        fetch("/api/action-intelligence").then((r) => r.json() as Promise<any>),
      ]);

      if (!sumRes.error) setSummary(sumRes);
      if (actRes.actions) setActions(actRes.actions);
    } catch {
      setStatusMessage("Failed to load live data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForFollowUp) return;
    setSavingFollowUp(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedPaymentForFollowUp.paymentId,
          action: followUpAction,
          notes: followUpNotes,
          followUpDate,
        }),
      });
      if (res.ok) {
        setStatusMessage(`Follow-up saved for ${selectedPaymentForFollowUp.client}.`);
        setSelectedPaymentForFollowUp(null);
        setFollowUpNotes("");
        loadData();
      } else {
        const err = (await res.json()) as any;
        alert(err.error || "Unable to save follow-up.");
      }
    } catch {
      alert("Error saving follow-up.");
    } finally {
      setSavingFollowUp(false);
    }
  };

  const handleQuickReminder = async (paymentId: number, clientName: string) => {
    try {
      const res = await fetch("/api/reminders/process", { method: "POST" });
      const data = (await res.json()) as any;
      if (res.ok) {
        setStatusMessage(`Reminder cycle processed: ${data.sent} sent, ${data.skipped} skipped.`);
      } else {
        setStatusMessage(`Reminder error: ${data.error || "Failed to dispatch."}`);
      }
    } catch {
      setStatusMessage("Network error during reminder dispatch.");
    }
  };

  const verificationItems = actions.filter((a) =>
    ["PAYMENT_PROOF_REVIEW", "PAYMENT_MISMATCH", "PAYMENT_MANUAL_REVIEW", "PAYMENT_VERIFIED_CONFIRMATION"].includes(
      a.type
    )
  );
  const overdueItems = actions.filter((a) => a.type === "PAYMENT_OVERDUE");
  const dueTodayItems = actions.filter((a) => a.type === "PAYMENT_DUE");
  const reminderItems = actions.filter((a) => a.type === "REMINDER_REQUIRED");

  const isHr = summary?.role === "HR" || summary?.amounts?.expected === null;

  return (
    <ArkaShell>
      <div className="space-y-8">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                ACCOUNTS WORKSPACE · ACTION CENTER
              </span>
              {isHr ? (
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-purple-900/80 text-purple-200 border border-purple-600 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-purple-300" /> HR Mode
                </span>
              ) : (
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="h-3 w-3 text-amber-400" /> Founder Mode
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mt-1">What needs attention today?</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              {isHr
                ? "HR & Operations Desk: Monitor confirmed collections, track pending client dues, and trigger operational follow-ups."
                : "Real-time enterprise dashboard for client payment tracking, billing invoices, verification, and automated collection."}
            </p>
          </div>
          <div className="flex gap-2">
            {!isHr && (
              <Link
                href="/invoices"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition"
              >
                <FileText className="h-4 w-4" />
                Invoices
              </Link>
            )}
            <Link
              href="/verification"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              Queue ({summary?.counts?.verification ?? 0})
            </Link>
          </div>
        </div>

        {statusMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="underline text-emerald-700">
              Close
            </button>
          </div>
        )}

        {/* Financial KPI Summary Cards */}
        {isHr ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-purple-700" />
                HR Operations View · Collection & Pending Dues Status
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 1. Total Collected */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span className="text-emerald-800 font-bold">Total Collected</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-3xl font-black text-emerald-700 mt-2">
                  {formatINR(summary?.amounts?.paid ?? 0)}
                </p>
                <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
                  {summary?.counts?.paid ?? 0} confirmed client payments
                </span>
              </div>

              {/* 2. Pending Collection */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span className="text-amber-800 font-bold">Pending Collection</span>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-3xl font-black text-amber-700 mt-2">
                  {formatINR(summary?.amounts?.pending ?? 0)}
                </p>
                <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                  {(summary?.counts?.dueToday ?? 0) + (summary?.counts?.upcoming ?? 0)} upcoming / due accounts
                </span>
              </div>

              {/* 3. Overdue Dues */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span className="text-rose-800 font-bold">Overdue Dues</span>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                </div>
                <p className="text-3xl font-black text-rose-700 mt-2">
                  {formatINR(summary?.amounts?.overdue ?? 0)}
                </p>
                <span className="text-[11px] text-rose-700 font-bold mt-1 block">
                  {summary?.counts?.overdue ?? 0} accounts requiring follow-up
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-600" />
                Founder Portal · Full Billed Value & Revenue Oversight
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Total Billed Value */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm ring-1 ring-amber-400/40">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span className="text-amber-800 font-bold">Total Billed Value</span>
                  <FileText className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">
                  {formatINR(summary?.amounts?.expected ?? 0)}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {summary?.invoices?.count ?? 0} client contracts billed
                </span>
              </div>

              {/* 2. Total Collected */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span className="text-emerald-800 font-bold">Total Collected</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-700 mt-2">
                  {formatINR(summary?.amounts?.paid ?? 0)}
                </p>
                <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
                  {summary?.counts?.paid ?? 0} confirmed paid
                </span>
              </div>

              {/* 3. Pending Collection */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span className="text-amber-800 font-bold">Pending Collection</span>
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-amber-700 mt-2">
                  {formatINR(summary?.amounts?.pending ?? 0)}
                </p>
                <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                  {(summary?.counts?.dueToday ?? 0) + (summary?.counts?.upcoming ?? 0)} upcoming / due
                </span>
              </div>

              {/* 4. Overdue Balance */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span className="text-rose-800 font-bold">Overdue Balance</span>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                </div>
                <p className="text-2xl font-black text-rose-700 mt-2">
                  {formatINR(summary?.amounts?.overdue ?? 0)}
                </p>
                <span className="text-[11px] text-rose-700 font-bold mt-1 block">
                  {summary?.counts?.overdue ?? 0} payments overdue
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: ACTION REQUIRED (Primary operational triage) */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-700">Immediate Triage</span>
              <h3 className="text-lg font-black text-slate-900 mt-0.5">Action Required Items</h3>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              {actions.length} actionable
            </span>
          </div>

          {actions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              All client payments are currently up to date. No actions required.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {actions.map((act) => {
                const isOverdue = act.type === "PAYMENT_OVERDUE";
                const isProof = act.type.startsWith("PAYMENT_PROOF") || act.type === "PAYMENT_MANUAL_REVIEW";
                const isVerified = act.type === "PAYMENT_VERIFIED_CONFIRMATION";

                return (
                  <div key={act.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{act.client}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{act.service}</span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isOverdue
                              ? "bg-rose-100 text-rose-800"
                              : isProof
                              ? "bg-amber-100 text-amber-900"
                              : isVerified
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {act.context}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{act.reason}</p>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Due Date: {act.dueDate} · Expected Amount: <strong className="text-slate-800">{formatINR(act.amount)}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isProof || isVerified ? (
                        <Link
                          href={`/verification/${act.paymentId}`}
                          className="px-4 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                          {act.recommendedAction}
                        </Link>
                      ) : isOverdue || act.type === "PAYMENT_DUE" ? (
                        <button
                          onClick={() => setSelectedPaymentForFollowUp(act)}
                          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition inline-flex items-center gap-1.5"
                        >
                          <UserCheck className="h-3.5 w-3.5 text-amber-400" />
                          Log Follow-Up
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQuickReminder(act.paymentId, act.client)}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold hover:bg-slate-200 transition inline-flex items-center gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send Reminder
                        </button>
                      )}

                      <Link
                        href={`/payments/${act.paymentId}`}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        title="View Payment Detail"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Split columns for Verification Queue & Overdue Follow-ups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Verification Queue Section */}
          <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Verification</span>
                <h3 className="font-extrabold text-base text-slate-900">Proof Verification Queue</h3>
              </div>
              <Link href="/verification" className="text-xs font-bold text-amber-700 hover:underline">
                View all ({verificationItems.length})
              </Link>
            </div>

            {verificationItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No proofs waiting in verification queue.</p>
            ) : (
              <div className="space-y-3">
                {verificationItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{item.client}</p>
                      <p className="text-[11px] text-slate-500">{item.service} · {formatINR(item.amount)}</p>
                    </div>
                    <Link
                      href={`/verification/${item.paymentId}`}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition"
                    >
                      Verify
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Overdue Payments Section */}
          <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Urgent Collections</span>
                <h3 className="font-extrabold text-base text-slate-900">Overdue Payments</h3>
              </div>
              <Link href="/payments?status=OVERDUE" className="text-xs font-bold text-rose-700 hover:underline">
                View all ({overdueItems.length})
              </Link>
            </div>

            {overdueItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Zero overdue payments.</p>
            ) : (
              <div className="space-y-3">
                {overdueItems.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-3.5 rounded-2xl border border-rose-100 bg-rose-50/40 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900">{item.client}</p>
                      <p className="text-[11px] text-rose-700 font-semibold">
                        Due: {item.dueDate} · {formatINR(item.amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedPaymentForFollowUp(item)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                    >
                      Follow Up
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Quick Follow-up Modal */}
        {selectedPaymentForFollowUp && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold uppercase text-amber-600">Accounts Action</span>
                  <h3 className="text-lg font-black text-slate-900">Log Follow-up</h3>
                </div>
                <button onClick={() => setSelectedPaymentForFollowUp(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveFollowUp} className="mt-4 space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 text-xs">
                  <p className="font-bold text-slate-900">{selectedPaymentForFollowUp.client}</p>
                  <p className="text-slate-500">
                    Amount: {formatINR(selectedPaymentForFollowUp.amount)} · Due: {selectedPaymentForFollowUp.dueDate}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Follow-up Action</label>
                  <select
                    value={followUpAction}
                    onChange={(e) => setFollowUpAction(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium"
                  >
                    <option>Phone Call</option>
                    <option>WhatsApp Message</option>
                    <option>Email Follow-up</option>
                    <option>Direct Meeting</option>
                    <option>Accounts Escalation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Client Response</label>
                  <textarea
                    rows={3}
                    required
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    placeholder="e.g. Spoke to accounts manager; promised RTGS transfer tomorrow by 3 PM."
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Next Follow-up Date</label>
                  <input
                    type="date"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentForFollowUp(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingFollowUp}
                    className="px-4 py-2 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingFollowUp ? "Saving..." : "Save Follow-up"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ArkaShell>
  );
}
