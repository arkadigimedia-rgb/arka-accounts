"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";

interface Client360Data {
  client: {
    id: number;
    clientCode: string | null;
    name: string;
    companyName: string | null;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    gstNumber: string | null;
    status: string;
    createdAt: string;
  };
  services: Array<{
    id: number;
    serviceName: string;
    description: string | null;
    status: string;
  }>;
  billingSchedules: Array<{
    id: number;
    serviceId: number;
    cadence: string;
    amount: number;
    currency: string;
    dayOfMonth: number | null;
    nextBillingDate: string | null;
    isAdvance: boolean;
    status: string;
  }>;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    totalAmount: number;
    currency: string;
    status: string;
    pdfKey: string | null;
  }>;
  payments: Array<{
    id: number;
    invoiceId: number | null;
    expectedAmount: number;
    paidAmount: number | null;
    dueDate: string;
    paymentDate: string | null;
    status: string;
    utrNumber: string | null;
  }>;
  followUps: Array<{
    id: number;
    paymentId: number;
    action: string;
    notes: string | null;
    followUpDate: string;
    status: string;
    createdAt: string;
  }>;
  metrics: {
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    overdue: number;
  };
  timeline: Array<{
    id: number;
    action: string;
    createdAt: string;
    newValue: string | null;
  }>;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function ClientDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.id;

  const [data, setData] = useState<Client360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "schedules" | "followups" | "timeline">(
    "invoices"
  );

  // New Follow-up Modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpPaymentId, setFollowUpPaymentId] = useState<number | "">("");
  const [followUpAction, setFollowUpAction] = useState("PHONE_CALL");
  const [followUpDate, setFollowUpDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  );
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);

  // Edit Client Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    gstNumber: "",
    status: "ACTIVE",
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const loadClientData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const result = (await res.json()) as any;
        setData(result);
        setEditFormData({
          name: result.client.name || "",
          companyName: result.client.companyName || "",
          contactPerson: result.client.contactPerson || "",
          email: result.client.email || "",
          phone: result.client.phone || "",
          address: result.client.address || "",
          city: result.client.city || "",
          state: result.client.state || "",
          gstNumber: result.client.gstNumber || "",
          status: result.client.status || "ACTIVE",
        });
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Client not found.");
      }
    } catch {
      setError("Network error while loading client details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientData();
  }, [clientId]);

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpPaymentId) {
      alert("Please select a payment to follow up on.");
      return;
    }
    setSubmittingFollowUp(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: Number(followUpPaymentId),
          action: followUpAction,
          followUpDate,
          notes: followUpNotes,
        }),
      });
      const result = (await res.json()) as any;
      if (res.ok) {
        setNotice("Follow-up logged successfully.");
        setShowFollowUpModal(false);
        setFollowUpNotes("");
        loadClientData();
        setTimeout(() => setNotice(null), 4000);
      } else {
        alert(result.error || "Failed to log follow-up.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const result = (await res.json()) as any;
      if (res.ok) {
        setNotice("Client updated successfully.");
        setShowEditModal(false);
        loadClientData();
        setTimeout(() => setNotice(null), 4000);
      } else {
        alert(result.error || "Failed to update client.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  if (loading) {
    return (
      <ArkaShell>
        <div className="p-10 text-center text-slate-500">Loading client 360° record...</div>
      </ArkaShell>
    );
  }

  if (error || !data) {
    return (
      <ArkaShell>
        <div className="p-10 max-w-xl mx-auto text-center space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold">
            {error || "Client could not be found."}
          </div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Clients Directory
          </Link>
        </div>
      </ArkaShell>
    );
  }

  const client = data.client;
  const services = data.services || [];
  const billingSchedules = data.billingSchedules || (data as any).schedules || [];
  const invoices = data.invoices || [];
  const payments = data.payments || [];
  const followUps = data.followUps || [];
  const metrics = data.metrics || (data as any).stats || {
    totalInvoiced: invoices.reduce((s, i) => s + (i.totalAmount || 0), 0),
    totalPaid: payments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paidAmount || p.expectedAmount || 0), 0),
    outstanding: payments.filter((p) => p.status !== "PAID").reduce((s, p) => s + p.expectedAmount, 0),
    overdue: payments.filter((p) => p.status === "OVERDUE").reduce((s, p) => s + p.expectedAmount, 0),
  };
  const timeline = data.timeline || [];

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Clients
          </Link>

          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>

        {notice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}

        {/* Client Header Card */}
        <div className="rounded-3xl bg-slate-950 text-white p-6 lg:p-8 relative overflow-hidden shadow-lg">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-400 text-slate-950 uppercase">
                  {client.clientCode || `CLI-${client.id}`}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    client.status === "ACTIVE"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {client.status}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight">{client.name}</h1>
              {client.companyName && client.companyName !== client.name && (
                <p className="text-xs text-slate-400">{client.companyName}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2">
                {client.contactPerson && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-amber-400" />
                    {client.contactPerson}
                  </span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-amber-400" />
                    <a href={`mailto:${client.email}`} className="hover:underline">
                      {client.email}
                    </a>
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-amber-400" />
                    {client.phone}
                  </span>
                )}
                {client.gstNumber && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px] text-slate-300">
                    GST: {client.gstNumber}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowFollowUpModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Log Follow-Up</span>
              </button>
            </div>
          </div>
        </div>

        {/* 360 Financial KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoiced</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{rupees(metrics?.totalInvoiced ?? 0)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{invoices.length} invoices generated</p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Collected Revenue</p>
            <p className="mt-2 text-2xl font-black text-emerald-600">{rupees(metrics?.totalPaid ?? 0)}</p>
            <p className="text-[11px] text-emerald-700/70 mt-1">
              {payments.filter((p) => p.status === "PAID").length} settled payments
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Balance</p>
            <p className="mt-2 text-2xl font-black text-amber-600">{rupees(metrics?.outstanding ?? 0)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Pending collection</p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue Balance</p>
            <p className="mt-2 text-2xl font-black text-rose-600">{rupees(metrics?.overdue ?? 0)}</p>
            <p className="text-[11px] text-rose-600/70 mt-1">
              {payments.filter((p) => p.status === "OVERDUE").length} overdue payments
            </p>
          </div>
        </div>

        {/* Operational Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab("invoices")}
              className={`pb-3 text-sm font-bold border-b-2 transition ${
                activeTab === "invoices"
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`pb-3 text-sm font-bold border-b-2 transition ${
                activeTab === "payments"
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Payments ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab("schedules")}
              className={`pb-3 text-sm font-bold border-b-2 transition ${
                activeTab === "schedules"
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Billing Schedules ({billingSchedules.length})
            </button>
            <button
              onClick={() => setActiveTab("followups")}
              className={`pb-3 text-sm font-bold border-b-2 transition ${
                activeTab === "followups"
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Follow-ups ({followUps.length})
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`pb-3 text-sm font-bold border-b-2 transition ${
                activeTab === "timeline"
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Audit Timeline
            </button>
          </nav>
        </div>

        {/* Tab 1: Invoices */}
        {activeTab === "invoices" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Invoices Generated for {client.name}</h3>
              <Link
                href={`/invoices?clientId=${client.id}`}
                className="text-xs font-semibold text-amber-600 hover:underline"
              >
                Open in Invoices Desk &rarr;
              </Link>
            </div>
            {invoices.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">No invoices generated yet for this client.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Invoice Number</th>
                      <th className="px-6 py-3">Issue Date</th>
                      <th className="px-6 py-3">Due Date</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-6 py-3.5 font-bold font-mono text-slate-900">
                          <Link href={`/invoices/${inv.id}`} className="hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-600">{inv.issueDate}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-600">{inv.dueDate}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">{rupees(inv.totalAmount)}</td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              inv.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : inv.status === "OVERDUE"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                          >
                            <Download className="h-3 w-3" />
                            <span>Download PDF</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Payments */}
        {activeTab === "payments" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Payment Ledger</h3>
              <Link
                href={`/payments?clientId=${client.id}`}
                className="text-xs font-semibold text-amber-600 hover:underline"
              >
                Open in Payments Desk &rarr;
              </Link>
            </div>
            {payments.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">No payment records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">ID / Reference</th>
                      <th className="px-6 py-3">Due Date</th>
                      <th className="px-6 py-3">Expected Amount</th>
                      <th className="px-6 py-3">Paid Amount</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">UTR / Mode</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-6 py-3.5 font-bold font-mono text-slate-900">PAY-{p.id}</td>
                        <td className="px-6 py-3.5 text-xs text-slate-600">{p.dueDate}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">{rupees(p.expectedAmount)}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-700">
                          {p.paidAmount ? rupees(p.paidAmount) : "—"}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "OVERDUE"
                                ? "bg-rose-100 text-rose-800"
                                : p.status === "PROOF_UPLOADED" || p.status === "VERIFYING"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-xs font-mono text-slate-600">{p.utrNumber || "—"}</td>
                        <td className="px-6 py-3.5 text-right">
                          <Link
                            href={`/payments/${p.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                          >
                            <span>Inspect</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Schedules */}
        {activeTab === "schedules" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Contracted Billing Schedules</h3>
              <Link href="/billing" className="text-xs font-semibold text-amber-600 hover:underline">
                Manage Schedules &rarr;
              </Link>
            </div>
            {billingSchedules.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No active billing schedules configured. Add one from the Billing Schedules desk.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {billingSchedules.map((s) => (
                  <div key={s.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{s.cadence} Schedule</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {s.status}
                        </span>
                        {s.isAdvance && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Advance Billing
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Billing cycle on day {s.dayOfMonth || 1} · Next billing date: {s.nextBillingDate || "Not set"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{rupees(s.amount)}</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase">{s.cadence}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Follow-ups */}
        {activeTab === "followups" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Payment Follow-up History</h3>
              <button
                onClick={() => setShowFollowUpModal(true)}
                className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Log New Follow-up</span>
              </button>
            </div>
            {followUps.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No follow-up records found. Click &quot;Log Follow-Up&quot; to add notes.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {followUps.map((f) => (
                  <div key={f.id} className="p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{f.action}</span>
                      <span className="text-slate-400">{f.followUpDate}</span>
                    </div>
                    {f.notes && <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">{f.notes}</p>}
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                      <span>Status: {f.status}</span>
                      <span>·</span>
                      <span>Associated Payment: PAY-{f.paymentId}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Timeline */}
        {activeTab === "timeline" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Client Audit & Activity Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">No activity logged yet.</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-4 py-1">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.action}</p>
                      <p className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")}</p>
                      {item.newValue && (
                        <p className="mt-1 text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded max-w-xl truncate">
                          {item.newValue}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Log Follow-up Modal */}
        {showFollowUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Log Follow-up for {client.name}</h3>
                <button
                  onClick={() => setShowFollowUpModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateFollowUp} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Payment *</label>
                  <select
                    required
                    value={followUpPaymentId}
                    onChange={(e) => setFollowUpPaymentId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  >
                    <option value="">Select a payment record...</option>
                    {payments.map((p) => (
                      <option key={p.id} value={p.id}>
                        PAY-{p.id} · {rupees(p.expectedAmount)} · Due: {p.dueDate} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Action / Channel</label>
                  <select
                    value={followUpAction}
                    onChange={(e) => setFollowUpAction(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  >
                    <option value="PHONE_CALL">Phone Call</option>
                    <option value="WHATSAPP_MESSAGE">WhatsApp Message</option>
                    <option value="EMAIL_FOLLOWUP">Direct Email</option>
                    <option value="IN_PERSON_MEETING">Meeting / In-Person</option>
                    <option value="PAYMENT_PROMISE">Client Promised to Pay</option>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Enter call notes, person contacted, promise date..."
                    value={followUpNotes}
                    onChange={(e) => setFollowUpNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFollowUpModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingFollowUp}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {submittingFollowUp ? "Saving..." : "Save Follow-up"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Client Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Edit Client: {client.name}</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateClient} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Client Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={editFormData.contactPerson}
                      onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GST Number</label>
                    <input
                      type="text"
                      value={editFormData.gstNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, gstNumber: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
                  <textarea
                    rows={2}
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {submittingEdit ? "Saving..." : "Update Profile"}
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
