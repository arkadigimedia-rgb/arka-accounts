"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Crown,
  UserCheck,
  ArrowRight,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"FOUNDER" | "HR">("FOUNDER");
  const [email, setEmail] = useState("founder@arkadigitalmedia.in");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<any>)
      .then((data: any) => {
        if (!data.error && data.id) {
          router.push("/");
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSelectRole = (role: "FOUNDER" | "HR") => {
    setSelectedRole(role);
    setErrorMessage(null);
    if (role === "FOUNDER") {
      setEmail("founder@arkadigitalmedia.in");
      setPassword("123456");
    } else {
      setEmail("hr@arkadigitalmedia.in");
      setPassword("123456");
    }
  };

  const handleLogin = async (overrideRole?: "FOUNDER" | "HR") => {
    const roleToLogin = overrideRole || selectedRole;
    const pwdToSubmit = password || "123456";
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleToLogin,
          email: overrideRole === "HR" ? "hr@arkadigitalmedia.in" : overrideRole === "FOUNDER" ? "founder@arkadigitalmedia.in" : email,
          password: pwdToSubmit,
        }),
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        // Successful login
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(data.error || "Authentication failed. Password is 123456.");
      }
    } catch {
      setErrorMessage("Network error during login. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full z-10 space-y-8">
        {/* Brand Crest & Heading */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-400 text-slate-950 font-black text-3xl shadow-xl shadow-amber-400/20 ring-4 ring-amber-400/20">
            A
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              ARKA DIGITAL MEDIA
            </h1>
            <p className="text-xs uppercase tracking-widest text-amber-400 font-bold mt-1">
              FINANCE & OPERATIONS PORTAL
            </p>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Select your assigned organizational role to authenticate and enter your operational workspace.
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 backdrop-blur-md">
          <button
            type="button"
            onClick={() => handleSelectRole("FOUNDER")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedRole === "FOUNDER"
                ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Crown className="h-4 w-4" />
            <span>Founder Portal</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectRole("HR")}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              selectedRole === "HR"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>HR & Operations</span>
          </button>
        </div>

        {/* Card Body */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          {/* Active Role Description */}
          {selectedRole === "FOUNDER" ? (
            <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/25 text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-400">
                <Crown className="h-4 w-4" />
                <span>Founder / Management Authorization</span>
              </div>
              <p className="text-xs text-slate-300">
                Full enterprise financial dashboard: Total Invoiced value, complete contracts oversight, collected funds, and pending cash flow.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/25 text-purple-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-purple-400">
                <UserCheck className="h-4 w-4" />
                <span>HR & Operations Authorization</span>
              </div>
              <p className="text-xs text-slate-300">
                Operations & Collections Desk: View Total Collected, Pending dues, follow-ups, and client coordination. <em>(Total Billed contract values remain confidential)</em>.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition"
                  placeholder={selectedRole === "FOUNDER" ? "founder@arkadigitalmedia.in" : "hr@arkadigitalmedia.in"}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">Password</label>
                <span className="text-[11px] font-mono text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                  Password: 123456
                </span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 transition"
                  placeholder="123456"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50 ${
                selectedRole === "FOUNDER"
                  ? "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20"
                  : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25"
              }`}
            >
              <span>{loading ? "Authenticating..." : `Sign In as ${selectedRole === "FOUNDER" ? "Founder" : "HR"}`}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick 1-Click Access Buttons */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block text-center">
              Quick 1-Click Role Access
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleLogin("FOUNDER")}
                disabled={loading}
                className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-400/30 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Enter Founder</span>
              </button>

              <button
                type="button"
                onClick={() => handleLogin("HR")}
                disabled={loading}
                className="py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-purple-500/30 text-purple-400 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Enter HR Desk</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500">
          ARKA Digital Media Finance & Operations Engine · Role-Based Access Control
        </p>
      </div>
    </div>
  );
}
