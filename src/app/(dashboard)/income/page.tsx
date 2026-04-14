"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Event { id: string; name: string; date: string }
interface Income {
  id: string; description: string; amount: number; category: string;
  date: string; reference: string; notes: string; eventId: string | null;
  event?: { id: string; name: string; date: string } | null;
}

const categories = [
  { value: "sponsorship", label: "Sponsorship", color: "bg-purple-100 text-purple-800" },
  { value: "donation", label: "Donation", color: "bg-blue-100 text-blue-800" },
  { value: "prize", label: "Prize Money", color: "bg-amber-100 text-amber-800" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-800" },
];

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("sponsorship");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [eventId, setEventId] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const data = await (await fetch("/api/income/data")).json();
    setIncomes(data.incomes);
    setEvents(data.events);
    setLoading(false);
  }

  function loadIncomes() { loadAll(); }

  function resetForm() {
    setDescription(""); setAmount(""); setCategory("sponsorship");
    setDate(new Date().toISOString().split("T")[0]);
    setReference(""); setNotes(""); setEventId("");
  }

  function openEdit(income: Income) {
    setEditingId(income.id);
    setDescription(income.description);
    setAmount(String(income.amount));
    setCategory(income.category);
    setDate(income.date.split("T")[0]);
    setReference(income.reference);
    setNotes(income.notes);
    setEventId(income.eventId || "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const payload = { description, amount: parseFloat(amount), category, date, reference, notes, eventId: eventId || null };
      if (editingId) {
        await fetch(`/api/income/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/income", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setShowForm(false); setEditingId(null); resetForm(); loadIncomes();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this income record?")) return;
    await fetch(`/api/income/${id}`, { method: "DELETE" });
    loadIncomes();
  }

  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const getCatInfo = (cat: string) => categories.find((c) => c.value === cat) || categories[3];

  if (loading) return <div className="text-gray-700 font-medium p-4">Loading...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Income</h1>
          <p className="text-sm text-gray-700">Sponsorships, donations, prize money & other income</p>
        </div>
        <button onClick={() => { if (showForm && !editingId) setShowForm(false); else { setShowForm(true); setEditingId(null); resetForm(); } }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium text-sm">
          {showForm && !editingId ? "Cancel" : "Record Income"}
        </button>
      </div>

      {/* Total Summary */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-purple-800">Total Company Income</span>
          <span className="text-xl font-bold text-purple-900">{formatAED(totalIncome)}</span>
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          {categories.map((cat) => {
            const catTotal = incomes.filter((i) => i.category === cat.value).reduce((s, i) => s + i.amount, 0);
            if (catTotal === 0) return null;
            return <span key={cat.value} className="text-xs text-purple-700">{cat.label}: {formatAED(catTotal)}</span>;
          })}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">{editingId ? "Edit Income" : "Record Income"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  placeholder="e.g. Tournament 2025 - XYZ Corp Sponsorship" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Amount (AED)</label>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">For Event (optional)</label>
                <select value={eventId} onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                  <option value="">Not linked to event</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name} — {formatDate(ev.date)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Reference</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Receipt/ref number (optional)" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50">
                {submitting ? "Saving..." : editingId ? "Update" : "Record Income"}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                  className="px-4 py-2.5 text-gray-700 font-medium">Cancel</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Income List */}
      <div className="space-y-3">
        {incomes.map((inc) => {
          const catInfo = getCatInfo(inc.category);
          return (
            <div key={inc.id} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{inc.description}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${catInfo.color}`}>{catInfo.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700 flex-wrap">
                    <span>{formatDate(inc.date)}</span>
                    {inc.event && <span className="text-blue-700">For: {inc.event.name}</span>}
                    {inc.reference && <span>Ref: {inc.reference}</span>}
                    {inc.notes && <span>{inc.notes}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-purple-700 text-lg">{formatAED(inc.amount)}</div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => openEdit(inc)} className="text-blue-600 text-xs font-medium">Edit</button>
                    <button onClick={() => handleDelete(inc.id)} className="text-red-600 text-xs font-medium">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {incomes.length === 0 && (
          <div className="text-center text-gray-600 py-12 font-medium">No income recorded yet. Record sponsorships, donations, and prize money above.</div>
        )}
      </div>
    </div>
  );
}
