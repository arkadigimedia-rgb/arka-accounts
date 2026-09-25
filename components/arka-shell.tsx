"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

export function ArkaShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [automating, setAutomating] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchSummary = () => {
    fetch("/api/dashboard/summary")
      .then((r) => r.json() as Promise<any>)
      .then((data: any) => {
        if (!data.error) setSummary(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, []);

  const runSync = async () => {
    setSyncing(true);
    setActionNotice("Syncing with Google Sheets...");
    try {
      const res = await fetch("/api/sheets/sync", { method: "POST" });
      const data = (await res.json()) as any;
      if (res.ok) {
        setActionNotice(`Sync complete: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped.`);
        fetchSummary();
      } else {
        setActionNotice(`Sync error: ${data.error || data.connection?.message || "Check credentials."}`);
      }
    } catch {
      setActionNotice("Network error during sheet sync.");
    } finally {
      setSyncing(false);
      setTimeout(() => setActionNotice(null), 8000);
    }
  };

  const runAutomation = async () => {
    setAutomating(true);
    setActionNotice("Running ARKA automation workflow...");
    try {
      const res = await fetch("/api/automation/run", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = (await res.json()) as any;
      if (res.ok) {
        setActionNotice("Daily automation workflow executed successfully.");
        fetchSummary();
      } else {
        setActionNotice(`Automation error: ${data.error || "Unable to run."}`);
      }
    } catch {
      setActionNotice("Network error during automation run.");
    } finally {
      setAutomating(false);
      setTimeout(() => setActionNotice(null), 8000);
    }
  };

  const navItems = [
    { label: "Action Center", href: "/", icon: LayoutDashboard },
    { label: "Clients", href: "/clients", icon: Users },
    { label: "Billing Schedules", href: "/billing", icon: CalendarClock },
    { label: "Invoices", href: "/invoices", icon: FileText, badge: summary?.invoices?.count },
    { label: "Payments Ledger", href: "/payments", icon: CreditCard },
    {
      label: "Verification Queue",
      href: "/verification",
      icon: ShieldCheck,
      badge: summary?.counts?.verification,
      badgeColor: "bg-amber-400 text-slate-950 font-bold",
    },
    { label: "Follow-ups", href: "/follow-ups", icon: UserCheck },
    { label: "Reminders", href: "/reminders", icon: Clock },
    { label: "Financial Reports", href: "/reports", icon: BarChart3 },
    { label: "System & Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-72 bg-slate-950 text-slate-300 p-5 flex flex-col shrink-0 lg:min-h-screen border-r border-slate-800">
        <div className="flex items-center gap-3 mb-8">
          <b className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-xl font-black text-slate-950">A</b>
          <div>
            <h1 className="font-extrabold tracking-widest text-white text-base">ARKA</h1>
            <p className="text-[10px] tracking-widest text-amber-400 font-semibold">ACCOUNTS OPERATIONS</p>
          </div>
        </div>

        {/* Quick Operations Triggers */}
        <div className="mb-6 space-y-2">
          <button
            onClick={runSync}
            disabled={syncing}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-emerald-400 disabled:opacity-50 transition"
          >
            <span className="flex items-center gap-2">
              <FileSpreadsheet className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing Sheet..." : "Sync Google Sheet"}
            </span>
            <RefreshCw className="h-3 w-3 opacity-60" />
          </button>

          <button
            onClick={runAutomation}
            disabled={automating}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-amber-400 disabled:opacity-50 transition"
          >
            <span className="flex items-center gap-2">
              <Play className={`h-4 w-4 ${automating ? "animate-pulse" : ""}`} />
              {automating ? "Running..." : "Run Automation"}
            </span>
            <CheckCircle2 className="h-3 w-3 opacity-60" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                  active ? "bg-amber-400/10 text-amber-400 font-bold border border-amber-400/30" : "hover:bg-slate-900 hover:text-white text-slate-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${active ? "text-amber-400" : "text-slate-400"}`} />
                  {item.label}
                </div>
                {item.badge != null && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${item.badgeColor || "bg-slate-800 text-slate-300"}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* System Summary Info */}
        <div className="mt-auto pt-6 border-t border-slate-900 text-[11px] text-slate-500 space-y-1">
          <p className="flex justify-between">
            <span>Timezone:</span> <span className="text-slate-400 font-mono">Asia/Kolkata</span>
          </p>
          <p className="flex justify-between">
            <span>Database:</span>{" "}
            <span className={summary?.demoMode ? "text-amber-400 font-medium" : "text-emerald-400 font-medium"}>
              {summary?.demoMode ? "Demo Mode" : "Neon Postgres"}
            </span>
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {pathname === "/" ? "Action Center" : pathname.replace("/", "").replace(/-/g, " ").toUpperCase()}
            </span>
            {summary?.counts?.overdue > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                <AlertCircle className="h-3 w-3" />
                {summary.counts.overdue} Overdue
              </span>
            )}
            {summary?.counts?.dueToday > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                <Clock className="h-3 w-3" />
                {summary.counts.dueToday} Due Today
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs">
            {summary?.demoMode && (
              <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold border border-amber-300">
                DEMO MODE
              </span>
            )}
            <span className="text-slate-500 hidden sm:inline">
              Today: <strong className="text-slate-800 font-mono">{new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</strong>
            </span>
          </div>
        </header>

        {/* Global Action Banner */}
        {actionNotice && (
          <div className="bg-slate-900 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-between">
            <span>{actionNotice}</span>
            <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
