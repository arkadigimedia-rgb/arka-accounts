"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArkaShell } from "@/components/arka-shell";
import {
  Building2,
  Calendar,
  CheckCircle,
  ExternalLink,
  Filter,
  IndianRupee,
  Mail,
  Phone,
  Plus,
  Search,
  User,
  Users,
  X,
} from "lucide-react";

interface Client {
  id: number;
  clientCode: string | null;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  gstNumber: string | null;
  status: string;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Client Form State
  const [formData, setFormData] = useState({
    name: "",
    clientCode: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    gstNumber: "",
    address: "",
  });

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      }
    } catch {
      setErrorMessage("Failed to load clients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        search === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.companyName && c.companyName.toLowerCase().includes(search.toLowerCase())) ||
        (c.clientCode && c.clientCode.toLowerCase().includes(search.toLowerCase())) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.phone && c.phone.includes(search));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && c.status === "ACTIVE") ||
        (statusFilter === "INACTIVE" && c.status !== "ACTIVE");

      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setFormSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = (await res.json()) as any;
      if (res.ok) {
        setSuccessMessage(`Client "${data.name}" added successfully.`);
        setShowAddModal(false);
        setFormData({
          name: "",
          clientCode: "",
          companyName: "",
          contactPerson: "",
          email: "",
          phone: "",
          city: "",
          state: "",
          gstNumber: "",
          address: "",
        });
        loadClients();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(data.error || "Failed to create client.");
      }
    } catch {
      setErrorMessage("Network error while creating client.");
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <ArkaShell>
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest">
              <Users className="h-4 w-4" />
              <span>Accounts Directory</span>
            </div>
            <h1 className="mt-1 text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Client Accounts & 360° Profiles
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage client records, contracted schedules, payment histories, and direct billing profiles.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Client</span>
          </button>
        </div>

        {/* Notices */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="font-medium">{successMessage}</p>
          </div>
        )}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {errorMessage}
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Clients</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">{clients.length}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Accounts</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-emerald-600">
              {clients.filter((c) => c.status === "ACTIVE").length}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Corporate / GST Registered</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-slate-900">
              {clients.filter((c) => Boolean(c.gstNumber)).length}
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contact Coverage</p>
            <p className="mt-2 text-2xl lg:text-3xl font-black text-amber-600">
              {clients.length > 0
                ? Math.round(
                    (clients.filter((c) => Boolean(c.email || c.phone)).length / clients.length) * 100
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients by name, code, contact or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="INACTIVE">Inactive / Archived</option>
            </select>
          </div>
        </div>

        {/* Clients Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Clients Ledger ({filteredClients.length})
            </h2>
            <span className="text-xs text-slate-500">Click on any client to open 360° Profile</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading client directory...</div>
          ) : filteredClients.length === 0 ? (
            <div className="p-12 text-center space-y-4 max-w-md mx-auto">
              <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto text-slate-500">
                <Users className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">
                  {clients.length === 0 ? "No Clients Ingested Yet" : "No matching clients found"}
                </p>
                <p className="text-xs text-slate-500">
                  {clients.length === 0
                    ? "Connect your operational Google Spreadsheet in Settings to automatically ingest all active client accounts and contracts."
                    : "Try adjusting your search query or status filter."}
                </p>
              </div>
              {clients.length === 0 && (
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition shadow-xs"
                >
                  <span>Go to Settings & Sync Sheet</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Client & Code</th>
                    <th className="px-6 py-3.5">Primary Contact</th>
                    <th className="px-6 py-3.5">Location</th>
                    <th className="px-6 py-3.5">Tax / GST</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-bold text-slate-900 hover:text-amber-600 transition flex items-center gap-1.5"
                        >
                          {client.name}
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400 inline" />
                        </Link>
                        {client.companyName && client.companyName !== client.name && (
                          <p className="text-xs text-slate-500">{client.companyName}</p>
                        )}
                        {client.clientCode && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600">
                            {client.clientCode}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        {client.contactPerson && (
                          <div className="flex items-center gap-1.5 text-slate-800 text-xs font-medium">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>{client.contactPerson}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <a href={`mailto:${client.email}`} className="hover:underline">
                              {client.email}
                            </a>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {!client.contactPerson && !client.email && !client.phone && (
                          <span className="text-xs text-slate-400 italic">No contact details</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {client.city || client.state ? (
                          <span>
                            {[client.city, client.state].filter(Boolean).join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {client.gstNumber ? (
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-800 font-medium">
                            {client.gstNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-sans text-xs">Unregistered</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            client.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {client.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/clients/${client.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                        >
                          <span>View 360°</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Client Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Add New Client Account</h3>
                    <p className="text-xs text-slate-500">Record client details into ARKA Operations</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Client / Brand Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Corp"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Client Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ACM-01"
                      value={formData.clientCode}
                      onChange={(e) => setFormData({ ...formData, clientCode: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Legal Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Innovations Private Limited"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="accounts@acme.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GST Number
                    </label>
                    <input
                      type="text"
                      placeholder="27AAAAA0000A1Z5"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="Mumbai"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="Maharashtra"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Billing Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Full business address for invoicing..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {formSubmitting ? "Creating Client..." : "Save Client"}
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
