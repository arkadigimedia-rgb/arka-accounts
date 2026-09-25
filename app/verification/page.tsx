"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Eye,
  FileCheck,
  IndianRupee,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

interface VerificationQueueItem {
  id: number;
  clientId: number | null;
  client: string;
  service: string;
  expectedAmount: number;
  paidAmount: number | null;
  dueDate: string;
  status: string;
  utr: string | null;
  createdAt: string;
}

const rupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function VerificationQueuePage() {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const queue = data.filter((p: any) =>
            ["PROOF_UPLOADED", "VERIFYING", "MANUAL_REVIEW", "MISMATCH"].includes(p.status)
          );
          setItems(queue);
        }
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Unable to load verification queue.");
      }
    } catch {
      setError("Network error fetching verification items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" />
              <span>Human-in-the-Loop Gate</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Payment Proof Verification Queue
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Audit uploaded bank transfer receipts, reconcile OCR-extracted amounts and UTRs, and execute atomic approvals.
            </p>
          </div>

          <button
            onClick={loadQueue}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Queue</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Informational Banner */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-4">
          <ShieldAlert className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 space-y-1">
            <p className="font-bold text-sm">Strict Human Approval Policy Active</p>
            <p>
              In ARKA Operations, AI OCR extraction is an intelligence aid. No payment or invoice status ever
              advances to <strong>PAID</strong> without explicit confirmation by an Accounts Manager or Founder.
            </p>
          </div>
        </div>

        {/* Queue Ledger */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Awaiting Verification ({items.length})
            </h2>
            <span className="text-xs text-slate-500">Requires split-screen comparison & sign-off</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading pending verification items...</div>
          ) : items.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Verification Queue is Empty</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                All uploaded transfer proofs have been audited and approved. New proofs uploaded by account
                managers or synced from Google Sheets will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 hover:bg-slate-50/80 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                        PAY-{item.id}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === "MANUAL_REVIEW"
                            ? "bg-amber-100 text-amber-800"
                            : item.status === "MISMATCH"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-slate-900">{item.client}</h3>
                    <p className="text-xs text-slate-500">{item.service}</p>
                    <p className="text-xs text-slate-600">
                      Due Date: <span className="font-mono">{item.dueDate}</span>
                      {item.utr && (
                        <span>
                          {" "}· UTR: <span className="font-mono font-semibold">{item.utr}</span>
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-slate-400 font-semibold uppercase">Expected Amount</p>
                      <p className="text-2xl font-black text-slate-900">{rupees(item.expectedAmount)}</p>
                      {item.paidAmount && (
                        <p className="text-xs text-emerald-600 font-semibold">
                          Detected: {rupees(item.paidAmount)}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/verification/${item.id}`}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition shrink-0"
                    >
                      <ShieldCheck className="h-4 w-4 text-amber-400" />
                      <span>Review & Approve</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ArkaShell>
  );
}
