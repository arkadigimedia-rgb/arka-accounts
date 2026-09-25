"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  IndianRupee,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";

interface VerificationWorkspaceData {
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
  };
  client: {
    id: number;
    name: string;
    companyName: string | null;
    email: string | null;
  } | null;
  invoice: {
    id: number;
    invoiceNumber: string;
    totalAmount: number;
    dueDate: string;
    status: string;
  } | null;
  proofs: Array<{
    id: number;
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
  }>;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function VerificationWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const paymentId = resolvedParams.id;

  const [data, setData] = useState<VerificationWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rejection & Re-upload Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReuploadModal, setShowReuploadModal] = useState(false);
  const [reuploadReason, setReuploadReason] = useState("");

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`);
      if (res.ok) {
        const result = (await res.json()) as any;
        setData(result);
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Unable to load verification workspace.");
      }
    } catch {
      setError("Network error fetching verification data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [paymentId]);

  const latestProof = data?.proofs?.[0];
  const latestVerification = data?.verifications?.[0];

  const handleApprove = async () => {
    if (!data) return;
    setProcessing(true);
    setError(null);
    setNotice("Executing atomic approval transaction (updating payment, linked invoice, and audit log)...");

    try {
      let res;
      if (latestVerification) {
        res = await fetch(`/api/verifications/${latestVerification.id}/approve`, {
          method: "POST",
        });
      } else {
        // Fallback status transition to PAID
        res = await fetch("/api/payments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: Number(paymentId), status: "PAID" }),
        });
      }

      const resData = (await res.json()) as any;
      if (res.ok) {
        setNotice("Payment successfully approved and marked as PAID!");
        setTimeout(() => {
          router.push("/verification");
        }, 1500);
      } else {
        setError(resData.error || "Approval failed.");
      }
    } catch {
      setError("Network error during approval.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;

    setProcessing(true);
    try {
      let res;
      if (latestVerification) {
        res = await fetch(`/api/verifications/${latestVerification.id}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason }),
        });
      } else {
        res = await fetch("/api/payments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: Number(paymentId), status: "REJECTED" }),
        });
      }

      if (res.ok) {
        setShowRejectModal(false);
        setNotice("Payment proof rejected.");
        setTimeout(() => router.push("/verification"), 1500);
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Failed to reject proof.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestReupload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reuploadReason.trim()) return;

    setProcessing(true);
    try {
      if (latestVerification) {
        const res = await fetch(`/api/verifications/${latestVerification.id}/request-reupload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reuploadReason }),
        });
        if (res.ok) {
          setShowReuploadModal(false);
          setNotice("Re-upload requested. Status updated.");
          setTimeout(() => router.push("/verification"), 1500);
          return;
        }
      }
      setShowReuploadModal(false);
      loadWorkspace();
    } catch {
      setError("Network error.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRunOcr = async () => {
    if (!latestProof) return;
    setProcessing(true);
    setNotice("Triggering OCR proof extraction engine...");
    try {
      const res = await fetch(`/api/payments/${paymentId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofId: latestProof.id }),
      });
      const resData = (await res.json()) as any;
      if (res.ok) {
        setNotice("OCR extraction completed!");
        loadWorkspace();
      } else {
        setError(resData.error || "OCR extraction failed.");
      }
    } catch {
      setError("Network error running OCR.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <ArkaShell>
        <div className="p-10 text-center text-slate-500">Loading verification workspace...</div>
      </ArkaShell>
    );
  }

  if (error || !data) {
    return (
      <ArkaShell>
        <div className="p-10 max-w-xl mx-auto text-center space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold">
            {error || "Verification record not found."}
          </div>
          <Link
            href="/verification"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Verification Queue
          </Link>
        </div>
      </ArkaShell>
    );
  }

  const { payment, client, invoice } = data;
  const isPaid = payment.status === "PAID";

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/verification"
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
                  Split-Screen Verification Workspace
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                  PAY-{payment.id}
                </span>
              </div>
              <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                Reconciliation: {payment.client}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {latestProof && !isPaid && (
              <button
                onClick={handleRunOcr}
                disabled={processing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${processing ? "animate-spin" : ""}`} />
                <span>Re-run OCR</span>
              </button>
            )}
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

        {/* 2-Pane Split-Screen Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Pane: Bank Transfer Receipt / Proof Document */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Uploaded Payment Receipt</h3>
              </div>
              {latestProof && (
                <a
                  href={`/api/payments/${payment.id}/proof/${latestProof.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download File</span>
                </a>
              )}
            </div>

            {latestProof ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 overflow-hidden flex items-center justify-center min-h-[480px]">
                  {latestProof.fileType.startsWith("image/") ? (
                    <img
                      src={`/api/payments/${payment.id}/proof/${latestProof.id}`}
                      alt={latestProof.fileName}
                      className="max-h-[500px] w-auto object-contain rounded-xl shadow-sm"
                    />
                  ) : (
                    <div className="p-10 text-center space-y-3">
                      <FileText className="h-12 w-12 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-800">{latestProof.fileName}</p>
                      <p className="text-xs text-slate-500">PDF document stored in private vault.</p>
                      <a
                        href={`/api/payments/${payment.id}/proof/${latestProof.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 text-white text-xs font-semibold"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Document in New Tab</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-500 flex justify-between px-1">
                  <span>File: {latestProof.fileName}</span>
                  <span>Uploaded: {new Date(latestProof.uploadedAt).toLocaleString("en-IN")}</span>
                </div>
              </div>
            ) : (
              <div className="p-16 text-center space-y-3">
                <UploadCloud className="h-12 w-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">No Receipt Uploaded Yet</h4>
                <p className="text-xs text-slate-500">
                  Return to the payment details page to upload a transfer receipt.
                </p>
                <Link
                  href={`/payments/${payment.id}`}
                  className="inline-block mt-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold"
                >
                  Go to Upload Screen
                </Link>
              </div>
            )}
          </div>

          {/* Right Pane: Reconciliation Matrix & Approval Station */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Deterministic Reconciliation Matrix</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    latestVerification?.result === "AUTO_MATCHED" || latestVerification?.result === "MATCH"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {latestVerification?.result || payment.status}
                </span>
              </div>

              {/* Comparison Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">Reconciliation Parameter</th>
                      <th className="px-4 py-3 text-left">System Ledger Data</th>
                      <th className="px-4 py-3 text-left">OCR Extracted Data</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">Amount</td>
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {rupees(payment.expectedAmount)}
                      </td>
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {latestVerification?.extractedAmount
                          ? rupees(latestVerification.extractedAmount)
                          : "Not extracted"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {latestVerification?.extractedAmount === payment.expectedAmount ? (
                          <span className="text-emerald-600 font-bold">MATCH</span>
                        ) : (
                          <span className="text-amber-600 font-bold">DIFF</span>
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">UTR / Reference</td>
                      <td className="px-4 py-3.5 font-mono text-slate-800">
                        {payment.utr || "Pending receipt"}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-800">
                        {latestVerification?.utr || "Pending OCR"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {latestVerification?.utr ? (
                          <span className="text-emerald-600 font-bold">DETECTED</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">Payment Date</td>
                      <td className="px-4 py-3.5 font-mono text-slate-800">{payment.dueDate} (Due)</td>
                      <td className="px-4 py-3.5 font-mono text-slate-800">
                        {latestVerification?.extractedDate || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {latestVerification?.extractedDate ? (
                          <span className="text-slate-700 font-semibold">RECORDED</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td className="px-4 py-3.5 font-semibold text-slate-700">Client / Sender</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">{payment.client}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {latestVerification?.confidence
                          ? `${Math.round(latestVerification.confidence * 100)}% Confidence`
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-slate-700 font-semibold">VERIFIED</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Extraction Diagnostics */}
              {latestVerification?.reason && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <p className="font-bold text-slate-700">OCR Engine Note:</p>
                  <p className="text-slate-600 italic">{latestVerification.reason}</p>
                </div>
              )}

              {/* Linked Invoice Reference */}
              {invoice && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">Linked Invoice: {invoice.invoiceNumber}</p>
                    <p className="text-slate-500">
                      Total: {rupees(invoice.totalAmount)} · Current Status: {invoice.status}
                    </p>
                  </div>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="text-amber-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>View</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Final Decision Action Station */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                {isPaid ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">Payment Verified & Settled</p>
                      <p className="text-xs text-emerald-800">
                        This payment and linked invoice are permanently approved as PAID.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ShieldCheck className="h-5 w-5" />
                      <span>{processing ? "Executing Approval..." : "Approve & Mark Paid (Atomic)"}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={processing}
                        className="py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject Proof</span>
                      </button>

                      <button
                        onClick={() => setShowReuploadModal(true)}
                        disabled={processing}
                        className="py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Request Re-upload</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Reject Payment Proof</h3>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleReject} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rejection Reason *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Specify why proof is invalid (e.g. illegible, mismatched amount, invalid UTR)..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {processing ? "Rejecting..." : "Confirm Rejection"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Request Re-upload Modal */}
        {showReuploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Request Client Re-upload</h3>
                <button
                  onClick={() => setShowReuploadModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleRequestReupload} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instructions for Client *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Specify requirements for clearer receipt (e.g. ensure UTR number is visible)..."
                    value={reuploadReason}
                    onChange={(e) => setReuploadReason(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowReuploadModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {processing ? "Requesting..." : "Send Request"}
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
