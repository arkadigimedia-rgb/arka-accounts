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
  Download,
  Eye,
  FileEdit,
  FileText,
  Filter,
  IndianRupee,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

interface InvoiceItem {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  totalAmount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: string;
  pdfStorageKey: string | null;
  createdAt: string;
}

interface BillingScheduleOption {
  id: number;
  clientName: string;
  expectedAmount: number;
  billingFrequency: string;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function InvoicesPage() {
  const { isHr } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [schedules, setSchedules] = useState<BillingScheduleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick Invoice Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceItem | null>(null);

  // Quick Change Amount Modal
  const [amountModalInvoice, setAmountModalInvoice] = useState<InvoiceItem | null>(null);
  const [newAmountInput, setNewAmountInput] = useState("");
  const [taxMode, setTaxMode] = useState<"direct" | "add_gst" | "inclusive_gst">("direct");
  const [updatingAmount, setUpdatingAmount] = useState(false);

  // Manual Generation Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [targetDate, setTargetDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  );
  const [generating, setGenerating] = useState(false);

  const openAmountModal = (inv: InvoiceItem) => {
    setAmountModalInvoice(inv);
    setNewAmountInput(String(inv.totalAmount || ""));
    setTaxMode("direct");
  };

  const parsedAmt = Number(newAmountInput.replace(/[^0-9.]/g, "")) || 0;
  const computedSubtotal =
    taxMode === "inclusive_gst"
      ? Math.round((parsedAmt / 1.18) * 100) / 100
      : parsedAmt;
  const computedTax =
    taxMode === "add_gst"
      ? Math.round(parsedAmt * 0.18 * 100) / 100
      : taxMode === "inclusive_gst"
      ? Math.round((parsedAmt - computedSubtotal) * 100) / 100
      : 0;
  const computedTotal =
    taxMode === "add_gst" ? parsedAmt + computedTax : parsedAmt;

  const handleSaveAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountModalInvoice || computedTotal <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    setUpdatingAmount(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${amountModalInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal: computedSubtotal,
          taxAmount: computedTax,
          totalAmount: computedTotal,
        }),
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === amountModalInvoice.id ? { ...i, totalAmount: computedTotal } : i
          )
        );
        if (previewInvoice && previewInvoice.id === amountModalInvoice.id) {
          setPreviewInvoice((prev) => (prev ? { ...prev, totalAmount: computedTotal } : null));
        }
        setNotice(
          `Invoice ${amountModalInvoice.invoiceNumber} amount manually updated to ${rupees(
            computedTotal
          )}.`
        );
        setAmountModalInvoice(null);
        setTimeout(() => setNotice(null), 5000);
      } else {
        setError(data.error || "Failed to update invoice amount.");
      }
    } catch {
      setError("Network error while updating amount.");
    } finally {
      setUpdatingAmount(false);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const [invRes, schedRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/billing?status=ACTIVE"),
      ]);

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(Array.isArray(invData) ? invData : []);
      }
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        if (Array.isArray(schedData)) {
          setSchedules(
            schedData.map((s: any) => ({
              id: s.id,
              clientName: s.clientName,
              expectedAmount: s.expectedAmount,
              billingFrequency: s.billingFrequency,
            }))
          );
        }
      }
    } catch {
      setError("Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleId) {
      alert("Please select a billing schedule.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: Number(selectedScheduleId),
          targetDate,
        }),
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        setNotice(
          `Invoice ${data.invoice?.invoiceNumber || ""} successfully generated and PDF rendered.`
        );
        setShowGenerateModal(false);
        loadInvoices();
        setTimeout(() => setNotice(null), 5000);
      } else {
        setError(data.error || "Failed to generate invoice.");
      }
    } catch {
      setError("Network error while generating invoice.");
    } finally {
      setGenerating(false);
    }
  };

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((i) => {
      if (i.dueDate && /^\d{4}-\d{2}/.test(i.dueDate)) set.add(i.dueDate.slice(0, 7));
      if (i.issueDate && /^\d{4}-\d{2}/.test(i.issueDate)) set.add(i.issueDate.slice(0, 7));
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
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        search === "" ||
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
        (inv.companyName && inv.companyName.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === "ALL" ||
        inv.status === statusFilter ||
        (statusFilter === "OVERDUE" && inv.status === "OVERDUE") ||
        (statusFilter === "PAID" && inv.status === "PAID") ||
        (statusFilter === "PENDING" && ["DRAFT", "SENT"].includes(inv.status));

      const matchesMonth =
        monthFilter === "" ||
        inv.issueDate.startsWith(monthFilter) ||
        inv.dueDate.startsWith(monthFilter);

      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [invoices, search, statusFilter, monthFilter]);

  const kpis = useMemo(() => {
    const totalAmount = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
    const paidAmount = invoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + (i.totalAmount || 0), 0);
    const overdueAmount = invoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((s, i) => s + (i.totalAmount || 0), 0);
    const pendingAmount = invoices
      .filter((i) => ["DRAFT", "SENT"].includes(i.status))
      .reduce((s, i) => s + (i.totalAmount || 0), 0);

    return { totalAmount, paidAmount, overdueAmount, pendingAmount };
  }, [invoices]);

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <FileText className="h-4 w-4" />
              <span>Invoicing Operations</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Invoices Desk & PDF Repository
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Audit generated tax invoices, view vector PDFs, track settlement statuses, and trigger manual issuance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/invoices/generate"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Custom Invoice</span>
            </Link>

            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition"
            >
              <Calendar className="h-4 w-4" />
              <span>Generate from Schedule</span>
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
        {isHr ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Settled Invoices</p>
              <p className="mt-2 text-2xl lg:text-3xl font-black text-emerald-600">
                {invoices.filter((i) => i.status === "PAID").length}
              </p>
              <p className="text-[11px] text-emerald-700/70 mt-1">Confirmed client collections</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Invoices</p>
              <p className="mt-2 text-2xl lg:text-3xl font-black text-amber-600">
                {invoices.filter((i) => ["DRAFT", "SENT"].includes(i.status)).length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Active client billing schedules</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue Invoices</p>
              <p className="mt-2 text-2xl lg:text-3xl font-black text-rose-600">
                {invoices.filter((i) => i.status === "OVERDUE").length}
              </p>
              <p className="text-[11px] text-rose-600/70 mt-1">Accounts past payment due date</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Billed</p>
              <p className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">{rupees(kpis.totalAmount)}</p>
              <p className="text-[11px] text-slate-400 mt-1">{invoices.length} invoices in ledger</p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Collected</p>
              <p className="mt-2 text-2xl lg:text-3xl font-black text-emerald-600">{rupees(kpis.paidAmount)}</p>
              <p className="text-[11px] text-emerald-700/70 mt-1">
                {invoices.filter((i) => i.status === "PAID").length} settled invoices
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Due</p>
              <p className="mt-2 text-2xl lg:text-3xl font-black text-amber-600">{rupees(kpis.pendingAmount)}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {invoices.filter((i) => ["DRAFT", "SENT"].includes(i.status)).length} active invoices
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue</p>
              <p className="mt-2 text-2xl lg:text-3xl font-black text-rose-600">{rupees(kpis.overdueAmount)}</p>
              <p className="text-[11px] text-rose-600/70 mt-1">
                {invoices.filter((i) => i.status === "OVERDUE").length} delinquent invoices
              </p>
            </div>
          </div>
        )}

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
              {invoices.length}
            </span>
          </button>
          {availableMonths.map((m) => {
            const count = invoices.filter(
              (i) => i.issueDate.startsWith(m.value) || i.dueDate.startsWith(m.value)
            ).length;
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

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice number or client name..."
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
                <option value="ALL">All Invoices</option>
                <option value="PENDING">Pending (Draft / Sent)</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="PAID">Paid Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Invoices Ledger ({filteredInvoices.length})
            </h2>
            <span className="text-xs text-slate-500">Pure PDF generation via pdf-lib</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading invoice ledger...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center space-y-4 max-w-md mx-auto">
              <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto text-slate-500">
                <FileText className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">
                  {invoices.length === 0 ? "No Invoices Recorded Yet" : "No matching invoices found"}
                </p>
                <p className="text-xs text-slate-500">
                  {invoices.length === 0
                    ? "Invoices will be automatically ingested and generated when you sync your Google Sheet in Settings."
                    : "Try selecting another billing cycle or adjusting your search filter."}
                </p>
              </div>
              {invoices.length === 0 && (
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
                    <th className="px-6 py-3.5">Invoice #</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Issue Date</th>
                    <th className="px-6 py-3.5">Due Date</th>
                    <th className="px-6 py-3.5">Total (₹)</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        <Link href={`/invoices/${inv.id}`} className="hover:text-amber-600 transition">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/clients/${inv.clientId}`}
                          className="font-semibold text-slate-900 hover:text-amber-600 transition"
                        >
                          {inv.clientName}
                        </Link>
                        {inv.companyName && inv.companyName !== inv.clientName && (
                          <p className="text-xs text-slate-500">{inv.companyName}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">{inv.issueDate}</td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">{inv.dueDate}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 group">
                          <button
                            type="button"
                            onClick={() => openAmountModal(inv)}
                            className="font-black text-slate-900 hover:text-emerald-700 transition flex items-center gap-1.5 text-left"
                            title="Click to manually change amount"
                          >
                            <span>{rupees(inv.totalAmount)}</span>
                            <span className="opacity-0 group-hover:opacity-100 p-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 transition">
                              <Pencil className="h-3 w-3" />
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            inv.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : inv.status === "OVERDUE"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openAmountModal(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-bold transition shadow-2xs"
                          title="Manually change this invoice amount"
                        >
                          <IndianRupee className="h-3.5 w-3.5 text-emerald-700" />
                          <span>Amount</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition shadow-2xs"
                          title="Preview invoice PDF and details"
                        >
                          <Eye className="h-3.5 w-3.5 text-amber-600" />
                          <span>Preview</span>
                        </button>

                        <Link
                          href={`/invoices/generate?edit=${inv.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold transition"
                          title="Edit everything on this invoice"
                        >
                          <FileEdit className="h-3.5 w-3.5 text-amber-700" />
                          <span>Edit</span>
                        </Link>

                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                          title="Download invoice PDF"
                        >
                          <Download className="h-3.5 w-3.5 text-amber-400" />
                          <span>PDF</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Generate Single Invoice Modal */}
        {showGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Generate Invoice from Schedule</h3>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateInvoice} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Billing Schedule *
                  </label>
                  <select
                    required
                    value={selectedScheduleId}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  >
                    <option value="">Choose active schedule...</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.clientName} · {rupees(s.expectedAmount)} ({s.billingFrequency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Invoice period and due dates will be calculated from this date.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {generating ? "Generating..." : "Generate & Render"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quick Invoice Preview Modal for HR & Founders */}
        {previewInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-amber-400 text-slate-950 font-bold">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 font-mono">
                        {previewInvoice.invoiceNumber}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          previewInvoice.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : previewInvoice.status === "OVERDUE"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {previewInvoice.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Client: <span className="font-semibold text-slate-800">{previewInvoice.clientName}</span> • Amount:{" "}
                      <span className="font-bold text-emerald-700">{rupees(previewInvoice.totalAmount)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAmountModal(previewInvoice)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs"
                    title="Manually change this invoice amount"
                  >
                    <IndianRupee className="h-4 w-4" />
                    <span>Change Amount</span>
                  </button>

                  <Link
                    href={`/invoices/generate?edit=${previewInvoice.id}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition shadow-xs"
                    title="Edit everything on this invoice"
                  >
                    <FileEdit className="h-4 w-4" />
                    <span>Edit Everything</span>
                  </Link>
                  <a
                    href={`/api/invoices/${previewInvoice.id}/pdf`}
                    download={`${previewInvoice.invoiceNumber}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PDF</span>
                  </a>
                  <button
                    onClick={() => setPreviewInvoice(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Embedded Vector PDF Frame */}
              <div className="flex-1 bg-slate-100 p-2 overflow-hidden min-h-[500px]">
                <iframe
                  src={`/api/invoices/${previewInvoice.id}/pdf?amt=${previewInvoice.totalAmount}#toolbar=1`}
                  className="w-full h-full rounded-2xl border border-slate-200 bg-white"
                  title={`Preview of ${previewInvoice.invoiceNumber}`}
                />
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  <span>Issue: <strong className="text-slate-900">{previewInvoice.issueDate}</strong></span>
                  <span>Due: <strong className="text-slate-900">{previewInvoice.dueDate}</strong></span>
                  <span>Amount: <strong className="text-emerald-700 font-bold">{rupees(previewInvoice.totalAmount)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAmountModal(previewInvoice)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 font-bold text-xs"
                  >
                    Change Amount
                  </button>
                  <Link
                    href={`/invoices/${previewInvoice.id}`}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold"
                  >
                    Detailed View
                  </Link>
                  <Link
                    href={`/invoices/generate?edit=${previewInvoice.id}`}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold"
                  >
                    Edit Everything
                  </Link>
                  <a
                    href={`/api/invoices/${previewInvoice.id}/pdf`}
                    download={`${previewInvoice.invoiceNumber}.pdf`}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 text-white hover:bg-slate-800 font-semibold"
                  >
                    Download Vector PDF
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manually Change Amount Modal */}
        {amountModalInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                    <IndianRupee className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Change Invoice Amount</h3>
                    <p className="text-xs text-slate-500">
                      {amountModalInvoice.clientName} · <span className="font-mono font-bold text-slate-700">{amountModalInvoice.invoiceNumber}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAmountModalInvoice(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAmount} className="mt-6 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      New Amount (₹) *
                    </label>
                    <span className="text-xs text-slate-500">
                      Current: <strong className="text-slate-800">{rupees(amountModalInvoice.totalAmount)}</strong>
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-lg">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      autoFocus
                      placeholder="e.g. 25000"
                      value={newAmountInput}
                      onChange={(e) => setNewAmountInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 text-2xl font-black font-mono border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 text-slate-900 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Quick Preset Amounts:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[11000, 15000, 20000, 22000, 25000, 30000, 35000, 50000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewAmountInput(String(preset))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition border ${
                          Number(newAmountInput) === preset
                            ? "bg-slate-950 text-white border-slate-950"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        ₹{preset.toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tax Option */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    GST / Tax Calculation
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTaxMode("direct")}
                      className={`p-2 rounded-xl border text-xs font-semibold transition text-center ${
                        taxMode === "direct"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>Direct Total</span>
                      <span className="block text-[10px] text-slate-400 font-normal">No GST Added</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode("add_gst")}
                      className={`p-2 rounded-xl border text-xs font-semibold transition text-center ${
                        taxMode === "add_gst"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>+ 18% GST</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Add Tax to Base</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode("inclusive_gst")}
                      className={`p-2 rounded-xl border text-xs font-semibold transition text-center ${
                        taxMode === "inclusive_gst"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>GST Inclusive</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Extract 18% Tax</span>
                    </button>
                  </div>
                </div>

                {/* Calculation Preview Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Base:</span>
                    <span className="font-mono font-semibold">{rupees(computedSubtotal)}</span>
                  </div>
                  {taxMode !== "direct" && (
                    <div className="flex justify-between text-slate-600">
                      <span>GST (18%):</span>
                      <span className="font-mono font-semibold">{rupees(computedTax)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                    <span>New Invoice Total:</span>
                    <span className="font-mono text-base text-emerald-700">{rupees(computedTotal)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAmountModalInvoice(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingAmount || computedTotal <= 0}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {updatingAmount ? (
                      <span>Updating...</span>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        <span>Save Amount ({rupees(computedTotal)})</span>
                      </>
                    )}
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
