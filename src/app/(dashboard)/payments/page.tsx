"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";
import { useProfile } from "@/lib/profile-context";

interface Member { id: string; name: string }
interface Event { id: string; name: string; date: string; type: string }
interface Payment { id: string; amount: number; method: string; reference: string; notes: string; date: string; category?: string; member: Member; event?: Event | null }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventId, setEventId] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterMember, setFilterMember] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterEvent, setFilterEvent] = useState("");

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const { profile } = useProfile();
  const isBigTicket = profile === "bigticket";

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/payments/data?profile=${profile}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        setPayments(data.payments || []);
        setMembers(data.members || []);
        setEvents(data.events || []);
      })
      .catch((e) => { if (e.name !== "AbortError") console.error(e); });
    return () => ctrl.abort();
  }, [profile]);

  function loadAll() {
    fetch(`/api/payments/data?profile=${profile}`).then((r) => r.json()).then((data) => {
      setPayments(data.payments || []);
      setMembers(data.members || []);
      setEvents(data.events || []);
    });
  }


  function resetForm() {
    setMemberId(""); setAmount(""); setMethod("cash");
    setReference(""); setNotes(""); setEventId("");
    setDate(new Date().toISOString().split("T")[0]);
  }

  function openEditForm(p: Payment) {
    setEditingId(p.id);
    setEditingCategory(p.category || (isBigTicket ? "bigticket" : "dadas"));
    setMemberId(p.member.id);
    setAmount(String(p.amount));
    setMethod(p.method);
    setReference(p.reference);
    setNotes(p.notes);
    setDate(p.date.split("T")[0]);
    setEventId(p.event?.id || "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const payload = {
        memberId, amount: parseFloat(amount), method, reference, notes, date,
        eventId: eventId || null,
        // Preserve original category when editing; otherwise use current profile
        category: editingId ? (editingCategory || "dadas") : (isBigTicket ? "bigticket" : "dadas"),
      };

      if (editingId) {
        await fetch(`/api/payments/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false); setEditingId(null); setEditingCategory(null); resetForm(); loadAll();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    const p = payments.find((x) => x.id === id);
    const msg = p
      ? `⚠️ DELETE this payment?\n\n${p.member.name} — ${formatAED(p.amount)} (${formatDate(p.date)})\n\nThis cannot be undone.`
      : "Delete this payment record?";
    if (!confirm(msg)) return;
    await fetch(`/api/payments/${id}`, { method: "DELETE" }); loadAll();
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    const total = payments.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.amount, 0);
    if (!confirm(`⚠️ DELETE ${selected.size} payment(s) totaling ${formatAED(total)}?\n\nThis cannot be undone.`)) return;
    await fetch("/api/payments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    setSelectMode(false);
    loadAll();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredPayments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredPayments.map((p) => p.id)));
    }
  }

  const filteredPayments = payments.filter((p) => {
    if (filterMember && p.member.id !== filterMember) return false;
    const pDate = p.date.split("T")[0];
    if (filterDateFrom && pDate < filterDateFrom) return false;
    if (filterDateTo && pDate > filterDateTo) return false;
    if (filterEvent === "_general" && p.event) return false;
    if (filterEvent && filterEvent !== "_general" && p.event?.id !== filterEvent) return false;
    return true;
  });
  const filteredSum = filteredPayments.reduce((s, p) => s + p.amount, 0);

  const methodLabel = (m: string) => {
    switch (m) {
      case "cash": return "Cash";
      case "bank_transfer": return "Bank Transfer";
      case "company_contribution": return "Company";
      case "credit": return "Credit";
      default: return m;
    }
  };
  const methodColor = (m: string) => {
    switch (m) {
      case "cash": return "bg-amber-100 text-amber-800";
      case "bank_transfer": return "bg-blue-100 text-blue-800";
      case "company_contribution": return "bg-purple-100 text-purple-800";
      case "credit": return "bg-emerald-100 text-emerald-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isBigTicket ? "Big Ticket Payments" : "Payments"}
        </h1>
        <div className="flex gap-2">
          {selectMode ? (
            <>
              <button onClick={handleBulkDelete} disabled={selected.size === 0}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50">
                Delete ({selected.size})
              </button>
              <button onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium text-sm">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setSelectMode(true)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium text-sm">
                Select
              </button>
              <button onClick={() => { if (showForm && !editingId) { setShowForm(false); } else { setShowForm(true); setEditingId(null); resetForm(); } }}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium text-sm">
                {showForm && !editingId ? "Cancel" : "Record Payment"}
              </button>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">{editingId ? "Edit Payment" : "Record Payment"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Member</label>
                <select value={memberId} onChange={(e) => setMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium" required>
                  <option value="">Select member...</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Amount (AED)</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900" required />
              </div>
            </div>
            <div className={`grid grid-cols-1 ${isBigTicket ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-3`}>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Payment Type</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  {!isBigTicket && <option value="company_contribution">To Company Contribution</option>}
                </select>
              </div>
              {!isBigTicket && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">For Event (optional)</label>
                  <select value={eventId} onChange={(e) => setEventId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium">
                    <option value="">General payment</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.name} — {formatDate(ev.date)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Reference</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-semibold disabled:opacity-50">
                {submitting ? "Saving..." : editingId ? "Update Payment" : "Record Payment"}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                  className="px-4 py-2.5 text-gray-700 font-medium">Cancel</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Member</label>
            <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm">
              <option value="">All Members</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {!isBigTicket && (
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Event</label>
              <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm">
                <option value="">All Events</option>
                <option value="_general">General (no event)</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name} — {formatDate(ev.date)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">From</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">To</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm" />
          </div>
          {(filterMember || filterDateFrom || filterDateTo || filterEvent) && (
            <button onClick={() => { setFilterMember(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterEvent(""); }}
              className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 font-medium">Clear</button>
          )}
        </div>
        {filteredPayments.length !== payments.length && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-gray-700">Showing <span className="font-bold">{filteredPayments.length}</span> of {payments.length} payments</span>
            <span className="font-bold text-emerald-700">Total: {formatAED(filteredSum)}</span>
          </div>
        )}
      </div>

      {/* Select All bar */}
      {selectMode && filteredPayments.length > 0 && (
        <div className="bg-gray-100 rounded-lg px-4 py-2 mb-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
            <input type="checkbox" checked={selected.size === filteredPayments.length} onChange={toggleSelectAll}
              className="rounded text-emerald-600" />
            Select All ({filteredPayments.length})
          </label>
          <span className="text-sm text-gray-700">{selected.size} selected</span>
        </div>
      )}

      {/* Payments List - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredPayments.map((p) => (
          <div key={p.id} className={`bg-white rounded-xl shadow-sm border p-4 ${selected.has(p.id) ? "ring-2 ring-emerald-500" : ""}`}>
            <div className="flex items-start gap-3">
              {selectMode && (
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                  className="rounded text-emerald-600 mt-1 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">{p.member.name}</div>
                  <span className="font-bold text-emerald-700">{formatAED(p.amount)}</span>
                </div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${methodColor(p.method)}`}>{methodLabel(p.method)}</span>
                  <span className="text-xs text-gray-700">{formatDate(p.date)}</span>
                </div>
                {p.event && <div className="text-xs text-gray-700 mb-1">For: {p.event.name}</div>}
                {p.reference && <div className="text-xs text-gray-700">Ref: {p.reference}</div>}
                {p.notes && <div className="text-xs text-gray-700">{p.notes}</div>}
                {!selectMode && (
                  <div className="flex gap-3 mt-2">
                    <button onClick={() => openEditForm(p)} className="text-blue-600 text-xs font-medium">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 text-xs font-medium">Delete</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {payments.length === 0 && (
          <div className="text-center text-gray-600 py-8 font-medium">No payments recorded yet.</div>
        )}
      </div>

      {/* Payments List - Desktop Table */}
      <div className="bg-white rounded-xl shadow-sm border hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-700 border-b bg-gray-50">
                {selectMode && <th className="px-4 py-3 w-10"><input type="checkbox" checked={selected.size === filteredPayments.length && filteredPayments.length > 0} onChange={toggleSelectAll} className="rounded text-emerald-600" /></th>}
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Member</th>
                <th className="px-6 py-3 font-semibold text-right">Amount</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                {!isBigTicket && <th className="px-6 py-3 font-semibold">For Event</th>}
                <th className="px-6 py-3 font-semibold">Reference</th>
                <th className="px-6 py-3 font-semibold">Notes</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id} className={`border-b last:border-0 hover:bg-gray-50 ${selected.has(p.id) ? "bg-emerald-50" : ""}`}>
                  {selectMode && (
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded text-emerald-600" /></td>
                  )}
                  <td className="px-6 py-3 text-sm text-gray-800 font-medium">{formatDate(p.date)}</td>
                  <td className="px-6 py-3 font-semibold text-gray-900">{p.member.name}</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-emerald-700">{formatAED(p.amount)}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${methodColor(p.method)}`}>{methodLabel(p.method)}</span>
                  </td>
                  {!isBigTicket && (
                    <td className="px-6 py-3 text-sm text-gray-800">
                      {p.event ? `${p.event.name} (${formatDate(p.event.date)})` : <span className="text-gray-500">-</span>}
                    </td>
                  )}
                  <td className="px-6 py-3 text-sm text-gray-800">{p.reference || <span className="text-gray-500">-</span>}</td>
                  <td className="px-6 py-3 text-sm text-gray-800">{p.notes || <span className="text-gray-500">-</span>}</td>
                  <td className="px-6 py-3 text-right space-x-2">
                    {!selectMode && (
                      <>
                        <button onClick={() => openEditForm(p)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={selectMode ? (isBigTicket ? 8 : 9) : (isBigTicket ? 7 : 8)} className="px-6 py-8 text-center text-gray-600 font-medium">No payments recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
