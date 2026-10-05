"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArkaShell, useAuth } from "@/components/arka-shell";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileEdit,
  FileText,
  IndianRupee,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

interface InvoiceDetail {
  invoice: {
    id: number;
    invoiceNumber: string;
    clientId: number;
    billingScheduleId: number | null;
    serviceId: number | null;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency: string;
    status: string;
    notes: string | null;
    paymentInstructions?: {
      accountNumber?: string;
      accountName?: string;
      ifsc?: string;
      bankName?: string;
    } | null;
    pdfStorageKey: string | null;
    createdAt: string;
  };
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
  };
  service: {
    id: number;
    name: string;
    description: string | null;
  } | null;
  schedule: {
    id: number;
    billingFrequency: string;
    expectedAmount: number;
  } | null;
  payment: {
    id: number;
    status: string;
    expectedAmount: number;
    paidAmount: number | null;
    dueDate: string;
    paymentDate: string | null;
    utrNumber: string | null;
  } | null;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function InvoiceDetailPage({
  params,
}: {
  params?: Promise<{ id: string }> | { id: string };
}) {
  const { isHr } = useAuth();
  const routeParams = useParams();

  // Safely resolve invoiceId whether via useParams or route params Promise/object
  let invoiceId = "";
  if (routeParams?.id) {
    invoiceId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  } else if (params) {
    try {
      if (typeof (params as any)?.then === "function") {
        const unwrapped = use(params as Promise<{ id: string }>);
        invoiceId = unwrapped?.id || "";
      } else {
        invoiceId = (params as any)?.id || "";
      }
    } catch {
      invoiceId = "";
    }
  }

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Quick Amount Modal State
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [newAmountInput, setNewAmountInput] = useState("");
  const [taxMode, setTaxMode] = useState<"direct" | "add_gst" | "inclusive_gst">("direct");
  const [updatingAmount, setUpdatingAmount] = useState(false);

  const openAmountModal = () => {
    setNewAmountInput(String(data?.invoice?.totalAmount || data?.totalAmount || ""));
    setTaxMode("direct");
    setShowAmountModal(true);
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
    if (!invoiceId || computedTotal <= 0) return;

    setUpdatingAmount(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtotal: computedSubtotal,
          taxAmount: computedTax,
          totalAmount: computedTotal,
        }),
      });

      const resJson = (await res.json()) as any;
      if (res.ok) {
        setData((prev: any) => ({
          ...prev,
          totalAmount: computedTotal,
          subtotal: computedSubtotal,
          taxAmount: computedTax,
          invoice: {
            ...(prev?.invoice || {}),
            totalAmount: computedTotal,
            subtotal: computedSubtotal,
            taxAmount: computedTax,
          },
          payment: prev?.payment ? { ...prev.payment, expectedAmount: computedTotal } : null,
        }));
        setNotice(`Invoice amount successfully updated to ${rupees(computedTotal)}.`);
        setShowAmountModal(false);
        setTimeout(() => setNotice(null), 5000);
      } else {
        setError(resJson.error || "Failed to update amount.");
      }
    } catch {
      setError("Network error while updating amount.");
    } finally {
      setUpdatingAmount(false);
    }
  };

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    fetch(`/api/invoices/${invoiceId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as any;
          throw new Error(errData?.error || `Invoice #${invoiceId} not found.`);
        }
        return res.json();
      })
      .then((resData: any) => setData(resData))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) {
    return (
      <ArkaShell>
        <div className="p-10 text-center text-slate-500">Loading invoice details...</div>
      </ArkaShell>
    );
  }

  if (error || !data) {
    return (
      <ArkaShell>
        <div className="p-10 max-w-xl mx-auto text-center space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold">
            {error || "Invoice not found."}
          </div>
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices Desk
          </Link>
        </div>
      </ArkaShell>
    );
  }

  // Robust fallback handling whether API returned wrapped { invoice, client, ... } or flat object
  const invoice = data.invoice || {
    id: data.id || Number(invoiceId) || 0,
    invoiceNumber: data.invoiceNumber || `INV-${invoiceId}`,
    clientId: data.clientId || 0,
    clientName: data.clientName || "",
    issueDate: data.issueDate || "—",
    dueDate: data.dueDate || "—",
    subtotal: data.subtotal || data.totalAmount || 0,
    taxAmount: data.taxAmount || 0,
    totalAmount: data.totalAmount || 0,
    currency: data.currency || "INR",
    status: data.status || "GENERATED",
    notes: data.notes || null,
    paymentInstructions: data.paymentInstructions || null,
    service: data.service || "Digital Marketing Service / Google and Meta Ads",
  };

  const client = data.client || {
    id: invoice.clientId || 0,
    name: data.clientName || invoice.clientName || "Valued Client",
    companyName: data.companyName || null,
    contactPerson: data.contactPerson || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || "Hosakote, Bengaluru, Karnataka",
    city: data.city || "Hosakote",
    state: data.state || "Karnataka",
    gstNumber: data.gstNumber || null,
    clientCode: null,
  };

  const service = data.service || {
    id: 1,
    name: invoice.service || "Digital Marketing Service / Google and Meta Ads",
    description: invoice.serviceDescription || invoice.notes || "Digital Marketing Service / Google and Meta Ads",
  };

  const schedule = data.schedule || null;
  const payment = data.payment || null;

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Invoices Desk
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openAmountModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition"
              title="Manually change invoice amount"
            >
              <IndianRupee className="h-4 w-4" />
              <span>Change Amount</span>
            </button>
            <Link
              href={`/invoices/generate?edit=${invoice.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow-sm transition"
            >
              <FileEdit className="h-4 w-4" />
              <span>Edit Everything</span>
            </Link>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
            >
              <Download className="h-4 w-4" />
              <span>Download Vector PDF</span>
            </a>
          </div>
        </div>

        {notice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Invoice Container Card (Simulated Pro Invoice Layout) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-8 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-400 grid place-items-center text-slate-950 font-black">
                  A
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-900 tracking-wider text-base">ARKA DIGITAL MEDIA</h2>
                  <p className="text-[11px] text-slate-400">FINANCIAL ACCOUNTS & BILLING</p>
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500 space-y-0.5">
                <p className="font-bold text-slate-800">Arka Digital Media</p>
                <p>Address: Hosakote, Bengaluru, Karnataka</p>
                <p>Phone: +91 91106 61283</p>
                <p>GSTIN: 27AABCA1234D1Z5</p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-2">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  invoice.status === "PAID"
                    ? "bg-emerald-100 text-emerald-800"
                    : invoice.status === "OVERDUE"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {invoice.status}
              </span>
              <h1 className="text-2xl font-black font-mono text-slate-900">{invoice.invoiceNumber}</h1>
              <div className="text-xs text-slate-600 space-y-1 pt-1">
                <p>
                  <span className="text-slate-400">Issue Date:</span>{" "}
                  <span className="font-semibold text-slate-800">{invoice.issueDate}</span>
                </p>
                <p>
                  <span className="text-slate-400">Due Date:</span>{" "}
                  <span className="font-semibold text-slate-800">{invoice.dueDate}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Client & Billing Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Billed To</p>
              <h3 className="text-base font-bold text-slate-900">
                <Link
                  href={client.id ? `/clients/${client.id}` : "/clients"}
                  className="hover:text-amber-600 underline decoration-slate-300"
                >
                  {client.name}
                </Link>
              </h3>
              {client.companyName && client.companyName !== client.name && (
                <p className="text-xs text-slate-500 mt-0.5">{client.companyName}</p>
              )}
              {client.address && <p className="text-xs text-slate-600 mt-2">{client.address}</p>}
              {(client.city || client.state) && (
                <p className="text-xs text-slate-600">
                  {[client.city, client.state].filter(Boolean).join(", ")}
                </p>
              )}
              {client.gstNumber && (
                <p className="text-xs font-mono text-slate-600 mt-2 font-semibold">
                  GSTIN: {client.gstNumber}
                </p>
              )}
              {client.contactPerson && (
                <p className="text-xs text-slate-500 mt-1">Attn: {client.contactPerson}</p>
              )}
            </div>

            <div className="sm:text-right space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Summary</p>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Invoice Amount:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{rupees(invoice.totalAmount)}</span>
                    <button
                      type="button"
                      onClick={openAmountModal}
                      className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                      title="Manually change amount"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-semibold text-slate-800">{payment?.status || "PENDING"}</span>
                </div>
                {payment && (
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-slate-500">Linked Payment:</span>
                    <Link
                      href={payment.id ? `/payments/${payment.id}` : "/payments"}
                      className="font-bold text-amber-600 hover:underline flex items-center gap-1"
                    >
                      <span>PAY-{payment.id || ""}</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Description / Service</th>
                  <th className="px-6 py-3.5 text-center">Qty / Period</th>
                  <th className="px-6 py-3.5 text-right">Unit Rate</th>
                  <th className="px-6 py-3.5 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">
                      {service?.name || "Digital Marketing Service / Google and Meta Ads"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {invoice.notes || "Digital Marketing Service / Google and Meta Ads"}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-center text-xs text-slate-600">1</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-slate-700">
                    {rupees(invoice.subtotal || invoice.totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {rupees(invoice.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Calculation & User Payment Details */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4">
            <div className="max-w-md text-xs text-slate-600 space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Payment Details</p>
              <p>
                <span className="text-slate-500">Account no. -</span>{" "}
                <strong className="font-mono font-bold text-slate-900">
                  {invoice.paymentInstructions?.accountNumber || "1322054000000346"}
                </strong>
              </p>
              <p>
                <span className="text-slate-500">Name:</span>{" "}
                <strong className="font-bold text-slate-900">
                  {invoice.paymentInstructions?.accountName || "ESHWAR SP"}
                </strong>
              </p>
              <p>
                <span className="text-slate-500">IFSC:</span>{" "}
                <strong className="font-mono font-bold text-slate-900">
                  {invoice.paymentInstructions?.ifsc || "KVBL0001322"}
                </strong>
              </p>
              <p>
                <span className="text-slate-500">Branch:</span>{" "}
                <strong className="font-bold text-slate-900">
                  {invoice.paymentInstructions?.bankName || "Hosakote"}
                </strong>
              </p>
              {invoice.notes && (
                <div className="mt-3 pt-2 border-t border-slate-200 text-[11px]">
                  <span className="text-slate-500 font-semibold block">Notes & Terms:</span>
                  <p className="text-slate-700 whitespace-pre-wrap mt-0.5">{invoice.notes}</p>
                </div>
              )}
            </div>

            <div className="w-full sm:w-72 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 text-xs">
                <span>Subtotal:</span>
                <span className="font-mono">{rupees(invoice.subtotal || invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-xs">
                <span>GST (18% included/applicable):</span>
                <span className="font-mono">{rupees(invoice.taxAmount || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-900">
                <span>Total Due:</span>
                <span className="text-emerald-700 font-mono">{rupees(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* PDF Viewer Frame */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Invoice PDF Document Preview</h3>
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1"
              >
                <span>Open PDF in new tab</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden h-[600px]">
              <iframe
                src={`/api/invoices/${invoice.id}/pdf?amt=${invoice.totalAmount}`}
                className="w-full h-full"
                title={`PDF ${invoice.invoiceNumber}`}
              />
            </div>
          </div>
        </div>

        {/* Manually Change Amount Modal */}
        {showAmountModal && (
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
                      {client.name} · <span className="font-mono font-bold text-slate-700">{invoice.invoiceNumber}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAmountModal(false)}
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
                      Current: <strong className="text-slate-800">{rupees(invoice.totalAmount)}</strong>
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
                    onClick={() => setShowAmountModal(false)}
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
