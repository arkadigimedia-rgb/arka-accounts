"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
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
  FileText,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
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

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { isHr } = useAuth();
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Invoice not found.");
        return res.json() as Promise<any>;
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

  const { invoice, client, service, schedule, payment } = data;

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

          <div className="flex items-center gap-3">
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
                  <h2 className="font-extrabold text-slate-900 tracking-wider text-base">ARKA OPERATIONS</h2>
                  <p className="text-[11px] text-slate-400">FINANCIAL ACCOUNTS & BILLING</p>
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500 space-y-0.5">
                <p>Arka Operations Hub</p>
                <p>Tax Reg / GSTIN: 27AABCA1234D1Z5</p>
                <p>accounts@arkaoperations.com</p>
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
                <Link href={`/clients/${client.id}`} className="hover:text-amber-600 underline decoration-slate-300">
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
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Amount:</span>
                  <span className="font-bold text-slate-900">{isHr ? "Confidential (Founder Only)" : rupees(invoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-semibold text-slate-800">{payment?.status || "PENDING"}</span>
                </div>
                {payment && (
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-slate-500">Linked Payment:</span>
                    <Link
                      href={`/payments/${payment.id}`}
                      className="font-bold text-amber-600 hover:underline flex items-center gap-1"
                    >
                      <span>PAY-{payment.id}</span>
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
                      {service?.name || "Professional Retainer Services"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {invoice.notes ||
                        schedule?.billingFrequency + " billing cycle as per client engagement contract."}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-center text-xs text-slate-600">1</td>
                  <td className="px-6 py-4 text-right text-xs font-mono text-slate-700">
                    {isHr ? "—" : rupees(invoice.subtotal || invoice.totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {isHr ? "Confidential" : rupees(invoice.subtotal || invoice.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Calculation */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4">
            <div className="max-w-md text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Payment Instructions:</p>
              <p>Direct Bank Transfer / NEFT / RTGS</p>
              <p>Bank: HDFC Bank · A/C: 50200012345678 · IFSC: HDFC0000240</p>
              <p>Please share UTR receipt upon transfer for instant verification.</p>
            </div>

            <div className="w-full sm:w-72 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 text-xs">
                <span>Subtotal:</span>
                <span className="font-mono">{isHr ? "—" : rupees(invoice.subtotal || invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-xs">
                <span>GST (18% included/applicable):</span>
                <span className="font-mono">{isHr ? "—" : rupees(invoice.taxAmount || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-900">
                <span>Total Due:</span>
                <span>{isHr ? "Confidential (Founder Only)" : rupees(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* PDF Viewer Frame */}
          <div className="pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Invoice PDF Document Preview</h3>
              {!isHr && (
                <a
                  href={`/api/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1"
                >
                  <span>Open PDF in new tab</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {isHr ? (
              <div className="p-6 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-600 shrink-0" />
                <span>Invoice PDF document details containing billed contract value are restricted to Founder authorization.</span>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden h-[600px]">
                <iframe
                  src={`/api/invoices/${invoice.id}/pdf`}
                  className="w-full h-full"
                  title={`PDF ${invoice.invoiceNumber}`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </ArkaShell>
  );
}
