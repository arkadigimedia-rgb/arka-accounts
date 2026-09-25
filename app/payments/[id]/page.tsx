"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  IndianRupee,
  MessageSquare,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  User,
  X,
} from "lucide-react";

interface PaymentDetailData {
  payment: {
    id: number;
    clientId: number | null;
    invoiceId: number | null;
    client: string;
    service: string;
    expectedAmount: number;
    paidAmount: number | null;
    dueDate: string;
    paymentDate: string | null;
    status: string;
    utr: string | null;
    paymentMode: string | null;
    source: string;
    sourceReference: string | null;
    notes: string | null;
    createdAt: string;
  };
  client: {
    id: number;
    name: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  invoice: {
    id: number;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    totalAmount: number;
    status: string;
  } | null;
  proofs: Array<{
    id: number;
    fileKey: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
  }>;
  verifications: Array<{
    id: number;
    extractedAmount: number | null;
    extractedDate: string | null;
    utr: string | null;
    confidence: number | null;
    result: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  reminders: Array<{
    id: number;
    type: string;
    scheduledFor: string;
    sentAt: string | null;
    status: string;
    errorMessage: string | null;
  }>;
  followUps: Array<{
    id: number;
    action: string;
    notes: string | null;
    followUpDate: string;
    status: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: number;
    action: string;
    newValue: string | null;
    createdAt: string;
  }>;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const paymentId = resolvedParams.id;

  const [data, setData] = useState<PaymentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Proof Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Follow-up Modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpAction, setFollowUpAction] = useState("PHONE_CALL");
  const [followUpDate, setFollowUpDate] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  );
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`);
      if (res.ok) {
        const result = (await res.json()) as any;
        setData(result);
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Unable to load payment details.");
      }
    } catch {
      setError("Network error fetching payment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [paymentId]);

  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setNotice("Uploading proof to private storage and initiating OCR extraction...");
    try {
      const form = new FormData();
      form.append("file", uploadFile);

      const res = await fetch(`/api/payments/${paymentId}/proof`, {
        method: "POST",
        body: form,
      });

      const resData = (await res.json()) as any;
      if (res.ok) {
        setNotice("Proof uploaded successfully. Extraction queued.");
        setUploadFile(null);
        loadData();
      } else {
        setError(resData.error || "Failed to upload proof.");
      }
    } catch {
      setError("Network error during file upload.");
    } finally {
      setUploading(false);
      setTimeout(() => {
        setNotice(null);
        setError(null);
      }, 6000);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFollowUp(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: Number(paymentId),
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
        loadData();
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

  if (loading) {
    return (
      <ArkaShell>
        <div className="p-10 text-center text-slate-500">Loading payment record...</div>
      </ArkaShell>
    );
  }

  if (error || !data) {
    return (
      <ArkaShell>
        <div className="p-10 max-w-xl mx-auto text-center space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold">
            {error || "Payment not found."}
          </div>
          <Link
            href="/payments"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payments Ledger
          </Link>
        </div>
      </ArkaShell>
    );
  }

  const { payment, client, invoice, proofs, verifications, reminders, followUps, auditLogs } = data;
  const isQueue = ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(payment.status);

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/payments"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Payments Ledger
          </Link>

          {isQueue && (
            <Link
              href={`/verification/${payment.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow-sm transition"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Open Verification & Approval Desk &rarr;</span>
            </Link>
          )}
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

        {/* Payment Summary Header */}
        <div className="rounded-3xl bg-slate-950 text-white p-6 lg:p-8 relative overflow-hidden shadow-lg">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-400 text-slate-950 uppercase">
                  PAY-{payment.id}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    payment.status === "PAID"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : payment.status === "OVERDUE"
                      ? "bg-rose-950 text-rose-400 border border-rose-800"
                      : isQueue
                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {payment.status}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight">{payment.client}</h1>
              <p className="text-sm text-slate-400">{payment.service}</p>
            </div>

            <div className="text-left lg:text-right space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expected Amount</p>
              <p className="text-3xl font-black text-amber-400">{rupees(payment.expectedAmount)}</p>
              {payment.paidAmount && (
                <p className="text-xs text-emerald-400">Paid: {rupees(payment.paidAmount)}</p>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Operational Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Metadata & Proof Upload */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Specifications */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
                Payment Specifications
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Due Date:</span>
                  <span className="font-semibold font-mono text-slate-800">{payment.dueDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Settlement Date:</span>
                  <span className="font-semibold font-mono text-slate-800">{payment.paymentDate || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">UTR / Txn Ref:</span>
                  <span className="font-semibold font-mono text-slate-800">{payment.utr || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Mode:</span>
                  <span className="font-semibold text-slate-800">{payment.paymentMode || "Direct Transfer"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Data Source:</span>
                  <span className="font-semibold uppercase text-slate-800">{payment.source}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Linked Invoice:</span>
                  {invoice ? (
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-bold text-amber-600 hover:underline flex items-center gap-1"
                    >
                      <span>{invoice.invoiceNumber}</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-slate-400 italic">Direct Schedule</span>
                  )}
                </div>
              </div>
            </div>

            {/* Proof Upload Component */}
            {payment.status !== "PAID" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Upload Payment Proof Receipt</h3>
                  </div>
                  <span className="text-[11px] text-slate-400">PNG, JPG, PDF up to 10MB</span>
                </div>

                <form onSubmit={handleUploadProof} className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-slate-400 transition bg-slate-50">
                    <input
                      type="file"
                      id="proof-file"
                      accept=".png,.jpg,.jpeg,.pdf"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="proof-file" className="cursor-pointer space-y-2 block">
                      <FileCheck className="h-8 w-8 text-slate-400 mx-auto" />
                      {uploadFile ? (
                        <p className="text-xs font-bold text-slate-800">{uploadFile.name}</p>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-slate-700">
                            Click to select bank receipt or drag & drop
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Uploaded proofs undergo deterministic OCR verification
                          </p>
                        </div>
                      )}
                    </label>
                  </div>

                  {uploadFile && (
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      {uploading ? "Uploading & Extracting..." : "Submit Proof for Verification"}
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* Uploaded Proofs & OCR Verifications */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
                Uploaded Proofs & Verification History ({proofs.length})
              </h3>
              {proofs.length === 0 ? (
                <p className="text-xs text-slate-500">No payment receipts have been uploaded yet.</p>
              ) : (
                <div className="space-y-4">
                  {proofs.map((proof, idx) => {
                    const verif = verifications[idx];
                    return (
                      <div key={proof.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{proof.fileName}</span>
                          <span className="text-slate-400">
                            {new Date(proof.uploadedAt).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Size: {Math.round(proof.fileSize / 1024)} KB · Format: {proof.fileType}
                        </div>

                        {verif && (
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1 text-xs">
                            <div className="flex items-center justify-between font-semibold">
                              <span>OCR Result:</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                                  verif.result === "AUTO_MATCHED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {verif.result}
                              </span>
                            </div>
                            {verif.extractedAmount && (
                              <p className="text-slate-600">
                                Extracted Amount:{" "}
                                <span className="font-bold font-mono">{rupees(verif.extractedAmount)}</span>
                              </p>
                            )}
                            {verif.utr && (
                              <p className="text-slate-600">
                                Extracted UTR: <span className="font-mono">{verif.utr}</span>
                              </p>
                            )}
                            {verif.reason && <p className="text-[11px] text-slate-500 italic">{verif.reason}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Actions, Follow-ups, Audit Log */}
          <div className="space-y-6">
            {/* Quick Actions Panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">Operations</h3>

              {isQueue && (
                <Link
                  href={`/verification/${payment.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition shadow-sm"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify Payment Proof</span>
                </Link>
              )}

              <button
                onClick={() => setShowFollowUpModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Log Collection Follow-up</span>
              </button>

              {client && (
                <Link
                  href={`/clients/${client.id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                >
                  <User className="h-4 w-4" />
                  <span>View Client Profile</span>
                </Link>
              )}
            </div>

            {/* Follow-up Notes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Follow-up History</h3>
                <span className="text-xs text-slate-400">{followUps.length}</span>
              </div>
              {followUps.length === 0 ? (
                <p className="text-xs text-slate-500">No follow-ups recorded.</p>
              ) : (
                <div className="space-y-3">
                  {followUps.map((f) => (
                    <div key={f.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>{f.action}</span>
                        <span className="text-[10px] text-slate-400">{f.followUpDate}</span>
                      </div>
                      {f.notes && <p className="text-slate-600">{f.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit Logs */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">Audit Trail</h3>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No events logged.</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="text-xs border-l-2 border-slate-300 pl-3 py-1">
                      <p className="font-bold text-slate-800">{log.action}</p>
                      <p className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Follow-up Modal */}
        {showFollowUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Log Follow-up Note</h3>
                <button
                  onClick={() => setShowFollowUpModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateFollowUp} className="mt-6 space-y-4">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter discussion notes or promised payment date..."
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
                    {submittingFollowUp ? "Saving..." : "Save Note"}
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
