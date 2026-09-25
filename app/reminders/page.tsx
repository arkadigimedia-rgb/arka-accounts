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
  Mail,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  XCircle,
} from "lucide-react";

interface ReminderItem {
  id: number;
  paymentId: number;
  client: string;
  type: string;
  scheduledFor: string;
  sentAt: string | null;
  channel: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reminders");
      if (res.ok) {
        const data = (await res.json()) as any;
        setReminders(Array.isArray(data) ? data : []);
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Unable to load reminders.");
      }
    } catch {
      setError("Network error fetching reminders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleProcessReminders = async () => {
    setProcessing(true);
    setNotice("Processing and delivering due reminders...");
    try {
      const res = await fetch("/api/reminders/process", { method: "POST" });
      const result = (await res.json()) as any;
      if (res.ok) {
        setNotice(
          `Delivery job completed: ${result.sent || 0} sent, ${result.failed || 0} failed.`
        );
        loadReminders();
      } else {
        setError(result.error || "Delivery processing failed.");
      }
    } catch {
      setError("Network error running reminder engine.");
    } finally {
      setProcessing(false);
      setTimeout(() => {
        setNotice(null);
        setError(null);
      }, 6000);
    }
  };

  const handleRetry = async (id: number) => {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/reminders/${id}/retry`, { method: "POST" });
      const result = (await res.json()) as any;
      if (res.ok) {
        setNotice(`Reminder #${id} retry succeeded.`);
        loadReminders();
      } else {
        setError(result.error || `Retry failed for #${id}.`);
      }
    } catch {
      setError("Network error during retry.");
    } finally {
      setRetryingId(null);
      setTimeout(() => {
        setNotice(null);
        setError(null);
      }, 5000);
    }
  };

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      const matchesType = typeFilter === "ALL" || r.type === typeFilter;
      const matchesSearch =
        search === "" ||
        r.client.toLowerCase().includes(search.toLowerCase()) ||
        r.type.toLowerCase().includes(search.toLowerCase()) ||
        String(r.paymentId).includes(search);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [reminders, statusFilter, typeFilter, search]);

  const kpis = useMemo(() => {
    const total = reminders.length;
    const sent = reminders.filter((r) => r.status === "SENT").length;
    const pending = reminders.filter((r) => r.status === "PENDING").length;
    const failed = reminders.filter((r) => r.status === "FAILED").length;
    return { total, sent, pending, failed };
  }, [reminders]);

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <Clock className="h-4 w-4" />
              <span>Automated Notifications</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Reminders Schedule & Delivery Desk
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Audit automated payment reminder windows (upcoming, due date, overdue followup) and trigger live delivery.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleProcessReminders}
              disabled={processing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Send className={`h-4 w-4 text-amber-400 ${processing ? "animate-pulse" : ""}`} />
              <span>{processing ? "Dispatching..." : "Process Due Reminders Now"}</span>
            </button>
          </div>
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
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Scheduled</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">{kpis.total}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sent Successfully</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-emerald-600">{kpis.sent}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Delivery</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-amber-600">{kpis.pending}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery Failures</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-rose-600">{kpis.failed}</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client or payment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Delivery</option>
              <option value="SENT">Delivered (Sent)</option>
              <option value="FAILED">Failed</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 transition"
            >
              <option value="ALL">All Notification Windows</option>
              <option value="UPCOMING_3_DAYS">Upcoming (3 Days)</option>
              <option value="UPCOMING_1_DAY">Upcoming (1 Day)</option>
              <option value="DUE_TODAY">Due Today</option>
              <option value="OVERDUE_FOLLOWUP">Overdue Follow-up</option>
            </select>
          </div>
        </div>

        {/* Reminders Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Notification Delivery Ledger ({filteredReminders.length})
            </h2>
            <span className="text-xs text-slate-500">Automated retry & rate-limiting enabled</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading reminders ledger...</div>
          ) : filteredReminders.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Clock className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No reminder records match filters.</p>
              <p className="text-xs text-slate-500">
                Reminders are scheduled automatically as payment due dates approach.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Target Payment</th>
                    <th className="px-6 py-3.5">Notification Window</th>
                    <th className="px-6 py-3.5">Channel</th>
                    <th className="px-6 py-3.5">Scheduled For</th>
                    <th className="px-6 py-3.5">Sent At</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReminders.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <Link
                          href={`/payments/${r.paymentId}`}
                          className="font-bold text-slate-900 hover:text-amber-600 transition"
                        >
                          {r.client}
                        </Link>
                        <p className="text-xs font-mono text-slate-400">PAY-{r.paymentId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                          {r.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold uppercase text-slate-600">
                        {r.channel}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">
                        {new Date(r.scheduledFor).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">
                        {r.sentAt ? new Date(r.sentAt).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            r.status === "SENT"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : r.status === "FAILED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.errorMessage && (
                          <p className="text-[10px] text-rose-600 mt-1 max-w-xs truncate" title={r.errorMessage}>
                            {r.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {r.status === "FAILED" && (
                          <button
                            onClick={() => handleRetry(r.id)}
                            disabled={retryingId === r.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition disabled:opacity-50"
                          >
                            <RotateCcw className={`h-3 w-3 ${retryingId === r.id ? "animate-spin" : ""}`} />
                            <span>Retry</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ArkaShell>
  );
}
