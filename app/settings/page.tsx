"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  Database,
  DollarSign,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  HardDrive,
  Info,
  Key,
  Layers,
  Link2,
  Mail,
  PieChart,
  Play,
  RefreshCw,
  ScanText,
  Server,
  Settings,
  Shield,
  Trash2,
  Users,
  Zap,
} from "lucide-react";

interface SettingsData {
  environment: string;
  demoMode: boolean;
  integrations: {
    database: {
      provider: string;
      status: string;
      configured: boolean;
      latencyMs: number;
    };
    googleSheets: {
      provider: string;
      status: string;
      message: string;
      sheetUrl?: string | null;
      sheetId: string | null;
      tab: string | null;
      lastSync?: string | null;
      loadedClients?: number;
    };
    email: {
      provider: string;
      configured: boolean;
      status: string;
      from: string;
    };
    ocr: {
      provider: string;
      configured: boolean;
      status: string;
    };
    storage: {
      provider: string;
      configured: boolean;
      status: string;
    };
  };
  systemTime: string;
  businessTimezone: string;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const result = (await res.json()) as SettingsData;
        setData(result);
        if (result.integrations?.googleSheets?.sheetUrl) {
          setSheetUrlInput(result.integrations.googleSheets.sheetUrl);
        }
      } else {
        const err = (await res.json()) as any;
        setError(err.error || "Unable to load settings.");
      }
    } catch {
      setError("Network error fetching settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSyncSheets = async (overrideUrl?: string) => {
    setSyncing(true);
    const targetUrl = overrideUrl || sheetUrlInput;
    setActionNotice("Testing Google Sheets connection and synchronizing records...");
    try {
      const res = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: targetUrl || undefined }),
      });
      const result = (await res.json()) as any;
      if (res.ok) {
        setActionNotice(
          `Sync successful: ${result.created || 0} created, ${result.updated || 0} updated, ${result.processed || 0} records processed.`
        );
        loadSettings();
      } else {
        setActionNotice(`Sync error: ${result.error || result.connection?.message || "Check spreadsheet sharing permissions."}`);
      }
    } catch {
      setActionNotice("Network error during sheet sync.");
    } finally {
      setSyncing(false);
      setTimeout(() => setActionNotice(null), 8000);
    }
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to clear all operational records? This resets clients, invoices, and payments to an empty slate.")) {
      return;
    }
    setClearing(true);
    setActionNotice("Clearing all operational data...");
    try {
      const res = await fetch("/api/sheets/clear", { method: "POST" });
      const result = (await res.json()) as any;
      if (res.ok) {
        setActionNotice("Operational data wiped clean. Ready for a fresh Google Sheet sync.");
        setSheetUrlInput("");
        loadSettings();
      } else {
        setActionNotice(`Clear error: ${result.error || "Unable to clear data."}`);
      }
    } catch {
      setActionNotice("Network error while clearing data.");
    } finally {
      setClearing(false);
      setTimeout(() => setActionNotice(null), 8000);
    }
  };

  const handleRunAutomation = async () => {
    setRunningAutomation(true);
    setActionNotice("Running full ARKA daily automation pipeline...");
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = (await res.json()) as any;
      if (res.ok) {
        setActionNotice("Automation executed successfully across all schedules.");
      } else {
        setActionNotice(`Automation error: ${result.error || "Unable to run."}`);
      }
    } catch {
      setActionNotice("Network error during automation.");
    } finally {
      setRunningAutomation(false);
      setTimeout(() => setActionNotice(null), 8000);
    }
  };

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <Settings className="h-4 w-4" />
              <span>Operations Infrastructure</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              System Settings & Integration Diagnostics
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Live health monitor for Neon PostgreSQL, Google Sheets sync API, Resend email delivery, OCR vision, and R2 storage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSyncSheets()}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition disabled:opacity-50"
            >
              <FileSpreadsheet className={`h-4 w-4 text-emerald-600 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Syncing..." : "Sync Sheets Now"}</span>
            </button>

            <button
              onClick={handleRunAutomation}
              disabled={runningAutomation}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Play className={`h-4 w-4 text-amber-400 ${runningAutomation ? "animate-pulse" : ""}`} />
              <span>{runningAutomation ? "Executing..." : "Run Daily Automation"}</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {actionNotice && (
          <div className="p-4 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-between shadow-lg">
            <span>{actionNotice}</span>
            <button
              onClick={() => setActionNotice(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="p-16 text-center text-sm text-slate-500">Checking system diagnostics...</div>
        ) : (
          <div className="space-y-6">
            {/* Environment Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-bold text-slate-700">
                  <Server className="h-4 w-4 text-slate-400" />
                  Environment: <span className="font-mono font-semibold uppercase">{data.environment}</span>
                </span>
                <span className="flex items-center gap-1.5 font-bold text-slate-700">
                  <Globe className="h-4 w-4 text-slate-400" />
                  Business Timezone:{" "}
                  <span className="font-mono text-emerald-700 font-semibold">{data.businessTimezone}</span>
                </span>
              </div>
              <span className="text-slate-400">
                Server Time: {new Date(data.systemTime).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Google Sheets Manual Connection & Live Ingestion Hub */}
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                      <FileSpreadsheet className="h-5 w-5" />
                    </span>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">
                      Google Sheets Live Operations Ingestion
                    </h2>
                  </div>
                  <p className="text-sm text-slate-600 max-w-3xl">
                    Connect your operational Google Spreadsheet to automatically ingest clients, billing schedules, invoices, and payment ledgers. No mock or hardcoded business records.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
                      data.integrations.googleSheets.status === "CONNECTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Status: {data.integrations.googleSheets.status || "CHECKING"}
                  </span>
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {data.integrations.googleSheets.loadedClients ?? 0} Clients Loaded
                  </span>
                </div>
              </div>

              {/* Sync Input Form */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Google Spreadsheet Link or Sheet ID
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Link2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={sheetUrlInput}
                      onChange={(e) => setSheetUrlInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/1k1SwuFxywG67CHJWAe5vq7yDwDpBfk-0H8J2vxZ9JQ8/edit?usp=sharing"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                    />
                  </div>

                  <button
                    onClick={() => handleSyncSheets()}
                    disabled={syncing || !sheetUrlInput.trim()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50 shadow-sm shrink-0"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                    <span>{syncing ? "Ingesting Data..." : "Save & Sync Sheet"}</span>
                  </button>

                  <button
                    onClick={handleClearData}
                    disabled={clearing}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-sm font-semibold transition disabled:opacity-50 shrink-0"
                    title="Reset all client and payment records back to 0"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                    <span>{clearing ? "Clearing..." : "Clear All Records"}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const url = "https://docs.google.com/spreadsheets/d/1k1SwuFxywG67CHJWAe5vq7yDwDpBfk-0H8J2vxZ9JQ8/edit?usp=sharing";
                      setSheetUrlInput(url);
                      handleSyncSheets(url);
                    }}
                    className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Click here to auto-fill & sync with the ARKA live spreadsheet</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>

                  <span>
                    Last Synced:{" "}
                    <strong className="text-slate-700">
                      {data.integrations.googleSheets.lastSync
                        ? new Date(data.integrations.googleSheets.lastSync).toLocaleString("en-IN")
                        : "Never (Empty Store)"}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Where Updates Appear Guide */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Where Updates Appear Across ARKA
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link
                    href="/"
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-200/60 block space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-white shadow-xs text-indigo-600">
                        <PieChart className="h-4 w-4" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Executive Dashboard (/)</h4>
                    <p className="text-xs text-slate-600">
                      Live expected billing, total collections, pending collections, overdue alert banners, and action-required queues.
                    </p>
                  </Link>

                  <Link
                    href="/clients"
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-200/60 block space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-white shadow-xs text-emerald-600">
                        <Users className="h-4 w-4" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Clients Desk (/clients)</h4>
                    <p className="text-xs text-slate-600">
                      Master client roster, active monthly retainer contracts, contact details, GSTIN, and individual 360° financial histories.
                    </p>
                  </Link>

                  <Link
                    href="/invoices"
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-200/60 block space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-white shadow-xs text-blue-600">
                        <FileText className="h-4 w-4" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Invoices Desk (/invoices)</h4>
                    <p className="text-xs text-slate-600">
                      Generated invoices matching spreadsheet invoice numbers, issue dates, due dates, and dynamically rendered vector PDFs.
                    </p>
                  </Link>

                  <Link
                    href="/payments"
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-200/60 block space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-white shadow-xs text-amber-600">
                        <DollarSign className="h-4 w-4" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Payment Operations (/payments)</h4>
                    <p className="text-xs text-slate-600">
                      Full payment ledger showing PAID (Received), UPCOMING, and OVERDUE states, NEFT UTR numbers, and manual status updates.
                    </p>
                  </Link>

                  <Link
                    href="/verification"
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-200/60 block space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-white shadow-xs text-purple-600">
                        <ScanText className="h-4 w-4" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Verification Desk (/verification)</h4>
                    <p className="text-xs text-slate-600">
                      Review bank transfer screenshots, OCR confidence scores, UTR matching, and Accounts Manager one-click approvals.
                    </p>
                  </Link>

                  <Link
                    href="/reports"
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-200/60 block space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-xl bg-white shadow-xs text-rose-600">
                        <Layers className="h-4 w-4" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Reports & Aging (/reports)</h4>
                    <p className="text-xs text-slate-600">
                      Dynamic month-over-month ledger breakdown, client concentration percentages, and overdue aging brackets (0-30d, 31-60d, 90d+).
                    </p>
                  </Link>
                </div>
              </div>

              {/* Column Reference */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Expected Google Sheets Columns Ingested Automatically
                </div>
                <p className="text-slate-600">
                  ARKA dynamically extracts the following columns from your sheet:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 font-mono text-[11px] text-slate-700">
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Invoice No</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Clients Name</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Contact</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Email</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Billing cycle</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Invoice date</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Invoice Due Date</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Amount Payable</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Received / Pending</span>
                  <span className="p-2 bg-white rounded-lg border border-slate-200">• Remarks</span>
                </div>
              </div>
            </div>

            {/* Integration Health Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 1. Neon Database */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                    <Database className="h-6 w-6" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      data.integrations.database.status === "CONNECTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {data.integrations.database.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{data.integrations.database.provider}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Production source of truth for clients, invoices, schedules, and payments.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>Configured: {data.integrations.database.configured ? "Yes" : "No"}</p>
                  <p>Query Latency: {data.integrations.database.latencyMs} ms</p>
                </div>
              </div>

              {/* 2. Google Sheets */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      data.integrations.googleSheets.status === "CONNECTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {data.integrations.googleSheets.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Google Sheets Operations Sync</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    External data entry source mapping 19 standard accounting columns.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>Target Sheet: {data.integrations.googleSheets.sheetId || "Not set"}</p>
                  <p>Tab: {data.integrations.googleSheets.tab || "All tabs / Default"}</p>
                  <p className="text-[11px] text-slate-500 italic mt-1">
                    {data.integrations.googleSheets.message}
                  </p>
                </div>
              </div>

              {/* 3. Email Dispatcher */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                    <Mail className="h-6 w-6" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      data.integrations.email.configured
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {data.integrations.email.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Email Dispatcher</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sends invoice PDFs and automated payment reminder emails to clients.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>Provider: {data.integrations.email.provider}</p>
                  <p>Sender: {data.integrations.email.from}</p>
                </div>
              </div>

              {/* 4. AI OCR Proof Extraction */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                    <ScanText className="h-6 w-6" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      data.integrations.ocr.configured
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {data.integrations.ocr.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Receipt OCR & Vision Engine</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Extracts UTR numbers, settlement amounts, and transaction dates from proofs.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>Provider: {data.integrations.ocr.provider}</p>
                  <p>Autonomous Match: Disabled (Strict Human Approval Required)</p>
                </div>
              </div>

              {/* 5. Private Storage Vault */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      data.integrations.storage.configured
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {data.integrations.storage.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Storage Vault (PDFs & Proofs)</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Private encrypted storage for vector PDFs and client payment receipts.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>Provider: {data.integrations.storage.provider.toUpperCase()}</p>
                  <p>Access Mode: Private Authenticated Streaming Only</p>
                </div>
              </div>

              {/* 6. Security & Cron Runner */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-slate-100 text-slate-800">
                    <Shield className="h-6 w-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    ACTIVE
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Security & Automation Scheduler</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Internal cron worker secured by Bearer CRON_SECRET authentication.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <p>RBAC: FOUNDER, ACCOUNTS_MANAGER, ACCOUNT_MANAGER</p>
                  <p>Timing Attack Guards: Active Constant-Time Buffers</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ArkaShell>
  );
}
