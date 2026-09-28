"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArkaShell, useAuth } from "@/components/arka-shell";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Download,
  ExternalLink,
  FileCheck,
  FileEdit,
  FileText,
  IndianRupee,
  Layers,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  User,
} from "lucide-react";

interface ClientOption {
  id: number;
  name: string;
  companyName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  gstNumber: string | null;
  monthlyFee: number;
  service: string | null;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

function InvoiceGeneratorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditing = Boolean(editId);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("Hosakote, Bengaluru, Karnataka");
  const [city, setCity] = useState("Hosakote");
  const [state, setState] = useState("Karnataka");
  const [gstNumber, setGstNumber] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  );
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  });
  const [billingPeriodStart, setBillingPeriodStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-28`;
  });

  const [serviceName, setServiceName] = useState("Digital Marketing Service / Google and Meta Ads");
  const [serviceDescription, setServiceDescription] = useState(
    "Digital Marketing Service / Google and Meta Ads"
  );
  const [amount, setAmount] = useState<string>("50000");
  const [taxRate, setTaxRate] = useState<number>(0); // 0% or 18% GST
  const [status, setStatus] = useState<"GENERATED" | "SENT" | "PAID" | "OVERDUE">("GENERATED");

  // Payment details (fixed as per requirements)
  const bankDetails = {
    accountNumber: "1322054000000346",
    accountName: "ESHWAR SP",
    ifsc: "KVBL0001322",
    branch: "Hosakote",
  };

  // Calculations
  const subtotal = Math.max(0, Number(amount) || 0);
  const taxAmount = taxRate > 0 ? Math.round(subtotal * (taxRate / 100)) : 0;
  const totalAmount = subtotal + taxAmount;

  // Load clients and existing invoice if editing
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const clientRes = await fetch("/api/clients");
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          if (Array.isArray(clientData)) {
            setClients(clientData);
          }
        }

        if (editId) {
          const invRes = await fetch(`/api/invoices/${editId}`);
          if (invRes.ok) {
            const data = await invRes.json();
            setInvoiceNumber(data.invoiceNumber || "");
            setSelectedClientId(String(data.clientId || ""));
            setClientName(data.clientName || data.client?.name || "");
            setCompanyName(data.companyName || data.client?.companyName || data.clientName || "");
            setContactPerson(data.client?.contactPerson || "");
            setPhone(data.client?.phone || "");
            setAddress(data.client?.address || "Hosakote, Bengaluru, Karnataka");
            setCity(data.client?.city || "Hosakote");
            setState(data.client?.state || "Karnataka");
            setGstNumber(data.client?.gstNumber || "");

            setServiceName(data.service || "Digital Marketing Service / Google and Meta Ads");
            setServiceDescription(
              data.serviceDescription ||
                data.notes ||
                "Digital Marketing Service / Google and Meta Ads"
            );
            setAmount(String(data.subtotal || data.totalAmount || 0));
            setTaxRate(data.taxAmount > 0 ? 18 : 0);
            setIssueDate(data.issueDate || "");
            setDueDate(data.dueDate || "");
            if (data.billingPeriodStart) setBillingPeriodStart(data.billingPeriodStart);
            if (data.billingPeriodEnd) setBillingPeriodEnd(data.billingPeriodEnd);
            if (data.status) setStatus(data.status);
          }
        } else {
          // Auto-generate invoice number
          const year = new Date().getFullYear();
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          setInvoiceNumber(`INV-${year}-${randomSuffix}`);
        }
      } catch (err) {
        setError("Failed to load invoice or clients data.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [editId]);

  const handleClientSelect = (clientIdStr: string) => {
    setSelectedClientId(clientIdStr);
    if (!clientIdStr) return;

    const found = clients.find((c) => c.id === Number(clientIdStr));
    if (found) {
      setClientName(found.name);
      setCompanyName(found.companyName || found.name);
      setPhone(found.phone || "");
      setAddress(found.address || "Hosakote, Bengaluru, Karnataka");
      setCity(found.city || "Hosakote");
      setState(found.state || "Karnataka");
      setGstNumber(found.gstNumber || "");
      if (found.monthlyFee > 0) {
        setAmount(String(found.monthlyFee));
      }
      if (found.service) {
        setServiceName(found.service);
        setServiceDescription(found.service);
      }
    }
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName && !companyName) {
      alert("Please provide a client name or select a client.");
      return;
    }
    if (subtotal <= 0) {
      alert("Please specify a valid invoice amount.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        invoiceNumber,
        clientId: selectedClientId ? Number(selectedClientId) : undefined,
        clientName: clientName || companyName,
        companyName: companyName || clientName,
        contactPerson,
        phone,
        address,
        city,
        state,
        gstNumber,
        service: serviceName,
        serviceDescription,
        subtotal,
        taxAmount,
        totalAmount,
        issueDate,
        dueDate,
        billingPeriodStart,
        billingPeriodEnd,
        status,
      };

      let res;
      if (isEditing) {
        res = await fetch(`/api/invoices/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/invoices/custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();
      if (res.ok) {
        setNotice(
          `Invoice ${invoiceNumber} saved successfully with total ${rupees(totalAmount)}!`
        );
        setTimeout(() => {
          router.push(isEditing ? `/invoices/${editId}` : `/invoices/${result.invoice?.id || ""}`);
        }, 1200);
      } else {
        setError(result.error || "Failed to save invoice.");
      }
    } catch {
      setError("Network error while saving invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPreviewPdf = async () => {
    try {
      const res = await fetch("/api/invoices/preview-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber,
          clientName: clientName || companyName || "Valued Client",
          companyName: companyName || clientName || "Valued Client",
          contactPerson,
          phone,
          address,
          city,
          state,
          gstNumber,
          service: serviceName,
          serviceDescription,
          subtotal,
          taxAmount,
          totalAmount,
          issueDate,
          dueDate,
          billingPeriodStart,
          billingPeriodEnd,
        }),
      });

      if (!res.ok) {
        alert("Failed to render PDF preview.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber || "Invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error generating PDF.");
    }
  };

  return (
    <ArkaShell>
      <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Invoices Desk</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold">
                <FileEdit className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {isEditing ? `Edit Invoice: ${invoiceNumber}` : "Separate Invoice Generation & Editor"}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Customize amount, client billing details, issue dates, service description, and download live vector PDFs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPreviewPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition shadow-xs"
            >
              <Download className="h-4 w-4 text-slate-600" />
              <span>Download Vector PDF</span>
            </button>
            <button
              type="button"
              onClick={handleSaveInvoice}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4 text-amber-400" />
              <span>{submitting ? "Saving..." : isEditing ? "Save & Update Ledger" : "Generate & Save to Ledger"}</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {notice && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="font-semibold">{notice}</p>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Main Grid: Form on Left, Live Preview on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Form: 7 cols */}
          <div className="lg:col-span-6 space-y-6">
            <form onSubmit={handleSaveInvoice} className="space-y-6">
              {/* Section 1: Client Selection & Physical Address */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Client & Address Details
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400">Physical address replaces email</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Client from Ledger
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 transition"
                  >
                    <option value="">-- Choose Existing Client or Enter Manually Below --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.monthlyFee ? `(₹${c.monthlyFee.toLocaleString("en-IN")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Client / Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Corp"
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        setCompanyName(e.target.value);
                      }}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client Physical Address (Printed on Invoice) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Hosakote, Bengaluru, Karnataka"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Accounts email is omitted. Physical address will be displayed under INVOICE TO.
                  </p>
                </div>
              </div>

              {/* Section 2: Invoice Numbers & Billing Dates */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Invoice Metadata & Dates
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Invoice Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    >
                      <option value="GENERATED">GENERATED (Pending)</option>
                      <option value="SENT">SENT to Client</option>
                      <option value="PAID">PAID (Settled)</option>
                      <option value="OVERDUE">OVERDUE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Issue Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Billing Period From
                    </label>
                    <input
                      type="date"
                      value={billingPeriodStart}
                      onChange={(e) => setBillingPeriodStart(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Billing Period To
                    </label>
                    <input
                      type="date"
                      value={billingPeriodEnd}
                      onChange={(e) => setBillingPeriodEnd(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Product / Service & Amount Editing */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Product / Service & Amount
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Direct Amount Editing
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product / Service Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="Digital Marketing Service / Google and Meta Ads"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default: Digital Marketing Service / Google and Meta Ads
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Description
                  </label>
                  <input
                    type="text"
                    value={serviceDescription}
                    onChange={(e) => setServiceDescription(e.target.value)}
                    placeholder="Digital Marketing Service / Google and Meta Ads"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount (₹ Subtotal) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-lg font-black font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GST / Tax Rate
                    </label>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    >
                      <option value={0}>0% (No GST / Exempt)</option>
                      <option value={18}>18% GST (9% CGST + 9% SGST)</option>
                    </select>
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono font-semibold">{rupees(subtotal)}</span>
                  </div>
                  {taxRate > 0 && (
                    <>
                      <div className="flex justify-between text-slate-500 text-xs">
                        <span>CGST (9%):</span>
                        <span className="font-mono">{rupees(taxAmount / 2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-xs">
                        <span>SGST (9%):</span>
                        <span className="font-mono">{rupees(taxAmount / 2)}</span>
                      </div>
                    </>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900 text-base">
                    <span>Total Amount Payable:</span>
                    <span className="text-emerald-700 font-mono">{rupees(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Confirmed Payment Details Box */}
              <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200/60 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                  <Building2 className="h-4 w-4 text-amber-700" />
                  <span>Configured Payment Details (Printed on Invoice)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 block">Account No.</span>
                    <strong className="font-mono font-bold text-slate-900">{bankDetails.accountNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Beneficiary Name</span>
                    <strong className="font-bold text-slate-900">{bankDetails.accountName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">IFSC Code</span>
                    <strong className="font-mono font-bold text-slate-900">{bankDetails.ifsc}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Branch</span>
                    <strong className="font-bold text-slate-900">{bankDetails.branch}</strong>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPreviewPdf}
                  className="px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold transition"
                >
                  <Download className="h-4 w-4 inline mr-1 text-slate-600" />
                  Download PDF
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {submitting
                    ? "Saving Invoice..."
                    : isEditing
                    ? "Update Invoice & Amount"
                    : "Save Invoice to Ledger"}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Real-Time Invoice Preview (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Live Invoice Vector Preview
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                Interactive Rendering
              </span>
            </div>

            {/* Styled Invoice Paper */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-slate-800">
              {/* Top Banner */}
              <div className="bg-slate-950 text-white p-6 sm:p-7 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-black tracking-wider text-amber-400">
                    ARKA DIGITAL MEDIA
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-0.5">
                    FINANCIAL ACCOUNTS & OPERATIONS
                  </p>
                  <div className="mt-3 text-[11px] text-slate-300 space-y-0.5">
                    <p>Hosakote, Bengaluru, Karnataka</p>
                    <p>Phone: +91 91106 61283</p>
                    <p>GSTIN: 27AABCA1234D1Z5</p>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="inline-block px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 font-black text-xs">
                    TAX INVOICE
                  </div>
                  <p className="text-sm font-mono font-bold text-white pt-2">{invoiceNumber || "INV-XXXX"}</p>
                  <p className="text-[11px] text-slate-400">
                    Date: <span className="text-white">{issueDate || "—"}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Due: <span className="text-amber-300 font-bold">{dueDate || "—"}</span>
                  </p>
                </div>
              </div>

              {/* Client Info / INVOICE TO */}
              <div className="p-6 bg-slate-50/60 border-b border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  INVOICE TO :
                </p>
                <h4 className="text-base font-extrabold text-slate-900 mt-1">
                  {clientName || companyName || "Valued Client"}
                </h4>
                {contactPerson && (
                  <p className="text-xs text-slate-600 mt-0.5">Attn: {contactPerson}</p>
                )}
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {address || "Hosakote, Bengaluru, Karnataka"}
                </p>
                {phone && <p className="text-xs text-slate-500 mt-0.5">Phone: {phone}</p>}
                {gstNumber && (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">GSTIN: {gstNumber}</p>
                )}
              </div>

              {/* Items Table */}
              <div className="p-6">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Product / Service</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Price</th>
                      <th className="py-2.5 px-3 text-right">GST</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-4 px-3">
                        <p className="font-bold text-slate-900 text-xs">{serviceName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{serviceDescription}</p>
                        {billingPeriodStart && billingPeriodEnd && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Cycle: {billingPeriodStart} to {billingPeriodEnd}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-3 text-center text-slate-600">1</td>
                      <td className="py-4 px-3 text-right font-mono text-slate-700">
                        {rupees(subtotal)}
                      </td>
                      <td className="py-4 px-3 text-right font-mono text-slate-700">
                        {taxRate > 0 ? `${rupees(taxAmount)} (18%)` : "₹0"}
                      </td>
                      <td className="py-4 px-3 text-right font-mono font-bold text-slate-900">
                        {rupees(totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Subtotals & Breakdown */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-end space-y-1.5 text-xs">
                  <div className="flex justify-between w-48 text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{rupees(subtotal)}</span>
                  </div>
                  {taxRate > 0 && (
                    <>
                      <div className="flex justify-between w-48 text-slate-500 text-[11px]">
                        <span>CGST (9%):</span>
                        <span className="font-mono">{rupees(taxAmount / 2)}</span>
                      </div>
                      <div className="flex justify-between w-48 text-slate-500 text-[11px]">
                        <span>SGST (9%):</span>
                        <span className="font-mono">{rupees(taxAmount / 2)}</span>
                      </div>
                    </>
                  )}
                  <div className="mt-2 w-full max-w-xs bg-amber-400 text-slate-950 p-3 rounded-xl flex justify-between items-center font-black">
                    <span className="text-xs uppercase tracking-wider">Total Payable:</span>
                    <span className="font-mono text-base">{rupees(totalAmount)}</span>
                  </div>
                </div>

                {/* Payment Details Footer */}
                <div className="mt-6 pt-4 border-t border-dashed border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Payment Details:
                  </p>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px]">Account no. -</span>{" "}
                      <strong className="font-mono font-bold text-slate-900">
                        {bankDetails.accountNumber}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Name:</span>{" "}
                      <strong className="font-bold text-slate-900">{bankDetails.accountName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">IFSC:</span>{" "}
                      <strong className="font-mono font-bold text-slate-900">{bankDetails.ifsc}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Branch:</span>{" "}
                      <strong className="font-bold text-slate-900">{bankDetails.branch}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ArkaShell>
  );
}

export default function InvoiceGeneratorPage() {
  return (
    <Suspense
      fallback={
        <ArkaShell>
          <div className="p-12 text-center text-sm text-slate-500">
            Loading Invoice Generator & Editor...
          </div>
        </ArkaShell>
      }
    >
      <InvoiceGeneratorContent />
    </Suspense>
  );
}
