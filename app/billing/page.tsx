"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle,
  Clock,
  Filter,
  IndianRupee,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";

interface BillingSchedule {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string | null;
  serviceId: number | null;
  serviceName: string | null;
  billingType: string;
  billingFrequency: string;
  expectedAmount: number;
  currency: string;
  invoiceGenerationDay: number | null;
  paymentTermsDays: number | null;
  nextInvoiceDate: string | null;
  nextDueDate: string | null;
  autoGenerateInvoice: boolean;
  autoSendInvoice: boolean;
  status: string;
  createdAt: string;
}

interface ClientOption {
  id: number;
  name: string;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function BillingSchedulesPage() {
  const [schedules, setSchedules] = useState<BillingSchedule[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Schedule Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    clientId: "",
    billingFrequency: "MONTHLY",
    expectedAmount: "",
    invoiceGenerationDay: "1",
    paymentTermsDays: "7",
    billingStartDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
    autoGenerateInvoice: true,
    autoSendInvoice: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedRes, clientRes] = await Promise.all([
        fetch("/api/billing"),
        fetch("/api/clients"),
      ]);

      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setSchedules(Array.isArray(schedData) ? schedData : []);
      }
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        if (Array.isArray(clientData)) {
          setClients(clientData.map((c: any) => ({ id: c.id, name: c.name })));
        }
      }
    } catch {
      setError("Unable to load billing data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunInvoicing = async () => {
    setGeneratingInvoices(true);
    setNotice("Generating due invoices from schedules...");
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "invoice.generate" }),
      });
      const data = (await res.json()) as any;
      if (res.ok) {
        setNotice(
          `Invoicing job completed: ${data.details?.generatedCount || 0} invoice(s) generated.`
        );
        loadData();
      } else {
        setError(data.error || "Invoice generation failed.");
      }
    } catch {
      setError("Network error running invoicing automation.");
    } finally {
      setGeneratingInvoices(false);
      setTimeout(() => {
        setNotice(null);
        setError(null);
      }, 6000);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.expectedAmount) {
      alert("Please select a client and specify amount.");
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(formData.clientId),
          expectedAmount: Number(formData.expectedAmount),
          billingFrequency: formData.billingFrequency,
          invoiceGenerationDay: Number(formData.invoiceGenerationDay),
          paymentTermsDays: Number(formData.paymentTermsDays),
          billingStartDate: formData.billingStartDate,
          autoGenerateInvoice: formData.autoGenerateInvoice,
          autoSendInvoice: formData.autoSendInvoice,
        }),
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        setNotice("Billing schedule registered successfully.");
        setShowAddModal(false);
        setFormData({
          clientId: "",
          billingFrequency: "MONTHLY",
          expectedAmount: "",
          invoiceGenerationDay: "1",
          paymentTermsDays: "7",
          billingStartDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
          autoGenerateInvoice: true,
          autoSendInvoice: false,
        });
        loadData();
        setTimeout(() => setNotice(null), 5000);
      } else {
        setError(data.error || "Failed to create schedule.");
      }
    } catch {
      setError("Network error creating schedule.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const matchesSearch =
        search === "" ||
        s.clientName.toLowerCase().includes(search.toLowerCase()) ||
        (s.serviceName && s.serviceName.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && s.status === "ACTIVE") ||
        (statusFilter === "PAUSED" && s.status !== "ACTIVE");

      return matchesSearch && matchesStatus;
    });
  }, [schedules, search, statusFilter]);

  const monthlyRunRate = useMemo(() => {
    return schedules
      .filter((s) => s.status === "ACTIVE")
      .reduce((sum, s) => {
        if (s.billingFrequency === "MONTHLY") return sum + (s.expectedAmount || 0);
        if (s.billingFrequency === "QUARTERLY") return sum + (s.expectedAmount || 0) / 3;
        return sum;
      }, 0);
  }, [schedules]);

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <CalendarClock className="h-4 w-4" />
              <span>Recurring Operations</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Billing Schedules & Automation
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage client billing schedules, automated invoice cycles, and run scheduled billing on demand.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRunInvoicing}
              disabled={generatingInvoices}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold shadow-sm transition disabled:opacity-50"
            >
              <Play className={`h-4 w-4 ${generatingInvoices ? "animate-pulse" : ""}`} />
              <span>{generatingInvoices ? "Generating Invoices..." : "Run Due Invoicing Now"}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              <span>New Schedule</span>
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

        {/* Financial KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Schedules</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">
              {schedules.filter((s) => s.status === "ACTIVE").length}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Run Rate</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-emerald-600">
              {rupees(monthlyRunRate)}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auto-Generate Enabled</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">
              {schedules.filter((s) => s.autoGenerateInvoice).length}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auto-Send Configured</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-amber-600">
              {schedules.filter((s) => s.autoSendInvoice).length}
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search schedule by client or service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Schedules</option>
              <option value="PAUSED">Paused Schedules</option>
            </select>
          </div>
        </div>

        {/* Schedules Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Contracted Billing Schedules ({filteredSchedules.length})
            </h2>
            <span className="text-xs text-slate-500">Auto-invoice engine runs daily at 09:00 IST</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading billing schedules...</div>
          ) : filteredSchedules.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <CalendarClock className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-700">No billing schedules configured yet.</p>
              <p className="text-xs text-slate-500">
                Create a recurring schedule or sync from your Google Sheets Billing tab.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Client & Service</th>
                    <th className="px-6 py-3.5">Billing Cadence</th>
                    <th className="px-6 py-3.5">Amount</th>
                    <th className="px-6 py-3.5">Next Invoice Date</th>
                    <th className="px-6 py-3.5">Next Due Date</th>
                    <th className="px-6 py-3.5">Automation</th>
                    <th className="px-6 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedules.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <Link
                          href={`/clients/${schedule.clientId}`}
                          className="font-bold text-slate-900 hover:text-amber-600 transition"
                        >
                          {schedule.clientName}
                        </Link>
                        {schedule.serviceName && (
                          <p className="text-xs text-slate-500">{schedule.serviceName}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                          {schedule.billingFrequency}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-1">
                          Day {schedule.invoiceGenerationDay || 1} of month
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-900 text-base">
                        {rupees(schedule.expectedAmount)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-700">
                        {schedule.nextInvoiceDate || "—"}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-700">
                        {schedule.nextDueDate || "—"}
                        <span className="block text-[10px] text-slate-400">
                          {schedule.paymentTermsDays || 7} days terms
                        </span>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              schedule.autoGenerateInvoice ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                          <span className="text-[11px] text-slate-600">Auto-Gen</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              schedule.autoSendInvoice ? "bg-amber-500" : "bg-slate-300"
                            }`}
                          />
                          <span className="text-[11px] text-slate-600">Auto-Email</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            schedule.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {schedule.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Schedule Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">New Billing Schedule</h3>
                    <p className="text-xs text-slate-500">Configure recurring invoice parameters</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Client *</label>
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  >
                    <option value="">Choose a client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Billing Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 50000"
                      value={formData.expectedAmount}
                      onChange={(e) => setFormData({ ...formData, expectedAmount: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cadence</label>
                    <select
                      value={formData.billingFrequency}
                      onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="ONE_TIME">One Time</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Invoice Day of Month
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={formData.invoiceGenerationDay}
                      onChange={(e) => setFormData({ ...formData, invoiceGenerationDay: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Terms (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.paymentTermsDays}
                      onChange={(e) => setFormData({ ...formData, paymentTermsDays: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.billingStartDate}
                    onChange={(e) => setFormData({ ...formData, billingStartDate: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.autoGenerateInvoice}
                      onChange={(e) => setFormData({ ...formData, autoGenerateInvoice: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-950"
                    />
                    <span>Automatically generate PDF invoices on cycle date</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.autoSendInvoice}
                      onChange={(e) => setFormData({ ...formData, autoSendInvoice: e.target.checked })}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-950"
                    />
                    <span>Automatically email invoice PDF to client upon generation</span>
                  </label>
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
                    disabled={formSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {formSubmitting ? "Creating..." : "Save Schedule"}
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
