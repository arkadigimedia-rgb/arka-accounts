"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  IndianRupee,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";

interface FollowUpItem {
  id: number;
  paymentId: number;
  userId: number;
  action: string;
  notes: string | null;
  followUpDate: string;
  status: string;
  createdAt: string;
  clientName?: string;
  expectedAmount?: number;
}

interface PaymentOption {
  id: number;
  client: string;
  expectedAmount: number;
  dueDate: string;
  status: string;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [payments, setPayments] = useState<PaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Follow-up Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetPaymentId, setTargetPaymentId] = useState("");
  const [actionChannel, setActionChannel] = useState("PHONE_CALL");
  const [followUpDate, setFollowUpDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [followRes, payRes] = await Promise.all([
        fetch("/api/follow-ups"),
        fetch("/api/payments"),
      ]);

      let loadedPayments: PaymentOption[] = [];
      if (payRes.ok) {
        const payData = await payRes.json();
        if (Array.isArray(payData)) {
          loadedPayments = payData;
          setPayments(payData);
        }
      }

      if (followRes.ok) {
        const followData = await followRes.json();
        if (Array.isArray(followData)) {
          // Augment with client name and amount
          const payMap = new Map(loadedPayments.map((p) => [p.id, p]));
          const augmented = followData.map((f: FollowUpItem) => {
            const p = payMap.get(f.paymentId);
            return {
              ...f,
              clientName: p?.client || `Payment #${f.paymentId}`,
              expectedAmount: p?.expectedAmount || 0,
            };
          });
          setFollowUps(augmented);
        }
      }
    } catch {
      setError("Unable to load follow-ups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPaymentId) {
      alert("Please select a target payment.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: Number(targetPaymentId),
          action: actionChannel,
          followUpDate,
          notes,
        }),
      });

      const resData = (await res.json()) as any;
      if (res.ok) {
        setNotice("Follow-up logged successfully.");
        setShowAddModal(false);
        setNotes("");
        setTargetPaymentId("");
        loadData();
        setTimeout(() => setNotice(null), 4000);
      } else {
        setError(resData.error || "Failed to create follow-up.");
      }
    } catch {
      setError("Network error creating follow-up.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async (id: number) => {
    try {
      const res = await fetch("/api/follow-ups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "COMPLETED" }),
      });
      if (res.ok) {
        setNotice("Follow-up marked as completed.");
        loadData();
        setTimeout(() => setNotice(null), 3000);
      }
    } catch {
      setError("Failed to update status.");
    }
  };

  const filteredFollowUps = useMemo(() => {
    return followUps.filter((f) => {
      const matchesStatus =
        statusFilter === "ALL" || f.status === statusFilter;

      const matchesSearch =
        search === "" ||
        (f.clientName && f.clientName.toLowerCase().includes(search.toLowerCase())) ||
        (f.notes && f.notes.toLowerCase().includes(search.toLowerCase())) ||
        f.action.toLowerCase().includes(search.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [followUps, statusFilter, search]);

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <UserCheck className="h-4 w-4" />
              <span>Accounts Collections</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Collections & Follow-Up Desk
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Track communication with delinquent clients, schedule payment calls, and record payment promises.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Log Follow-up</span>
          </button>
        </div>

        {/* Notices */}
        {notice && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="font-medium">{notice}</p>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Actions</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-amber-600">
              {followUps.filter((f) => f.status === "PENDING").length}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completed Actions</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-emerald-600">
              {followUps.filter((f) => f.status === "COMPLETED").length}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Calls Logged</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">
              {followUps.filter((f) => f.action === "PHONE_CALL").length}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Promises</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-indigo-600">
              {followUps.filter((f) => f.action === "PAYMENT_PROMISE").length}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 transition"
            >
              <option value="PENDING">Pending Follow-ups</option>
              <option value="COMPLETED">Completed</option>
              <option value="ALL">All Records</option>
            </select>
          </div>
        </div>

        {/* Follow-ups Ledger */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Follow-Up Activity Log ({filteredFollowUps.length})
            </h2>
            <span className="text-xs text-slate-500">Accounts communications record</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading follow-ups...</div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <MessageSquare className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No follow-ups match current filter.</p>
              <p className="text-xs text-slate-500">
                Log a collection call, WhatsApp note, or payment promise above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFollowUps.map((f) => (
                <div
                  key={f.id}
                  className="p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-6 hover:bg-slate-50/80 transition"
                >
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {f.action}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          f.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {f.status}
                      </span>
                      <span className="text-xs text-slate-400">Scheduled: {f.followUpDate}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {f.clientName}
                      {f.expectedAmount ? (
                        <span className="text-sm font-normal text-slate-500 ml-2">
                          ({rupees(f.expectedAmount)})
                        </span>
                      ) : null}
                    </h3>

                    {f.notes && (
                      <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {f.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <Link
                        href={`/payments/${f.paymentId}`}
                        className="hover:text-amber-600 underline font-mono"
                      >
                        Target: PAY-{f.paymentId}
                      </Link>
                      <span>·</span>
                      <span>Logged: {new Date(f.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {f.status === "PENDING" && (
                      <button
                        onClick={() => handleMarkComplete(f.id)}
                        className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold transition"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* New Follow-up Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Log Follow-up</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Payment *</label>
                  <select
                    required
                    value={targetPaymentId}
                    onChange={(e) => setTargetPaymentId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  >
                    <option value="">Choose payment to follow up...</option>
                    {payments.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.client} · {rupees(p.expectedAmount)} (Due: {p.dueDate})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Communication Channel</label>
                  <select
                    value={actionChannel}
                    onChange={(e) => setActionChannel(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  >
                    <option value="PHONE_CALL">Phone Call</option>
                    <option value="WHATSAPP_MESSAGE">WhatsApp Message</option>
                    <option value="EMAIL_FOLLOWUP">Direct Email</option>
                    <option value="PAYMENT_PROMISE">Client Payment Promise</option>
                    <option value="IN_PERSON">In-Person Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    required
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Commitments</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter discussion summary, promise amount, promised date..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Record"}
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
