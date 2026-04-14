"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Event { id: string; name: string; date: string }
interface Expense {
  id: string; description: string; amount: number; category: string;
  date: string; reference: string; notes: string; eventId: string | null;
  event?: { id: string; name: string; date: string } | null;
}

const categories = [
  { value: "venue", label: "Venue", color: "bg-blue-100 text-blue-800" },
  { value: "equipment", label: "Equipment", color: "bg-emerald-100 text-emerald-800" },
  { value: "referee", label: "Referee", color: "bg-amber-100 text-amber-800" },
  { value: "transport", label: "Transport", color: "bg-indigo-100 text-indigo-800" },
  { value: "food", label: "Food & Drinks", color: "bg-orange-100 text-orange-800" },
  { value: "trophy", label: "Trophy/Medals", color: "bg-yellow-100 text-yellow-800" },
  { value: "medical", label: "Medical", color: "bg-red-100 text-red-800" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-800" },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterEvent, setFilterEvent] = useState("");

  // Form fields
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("venue");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [eventId, setEventId] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const data = await (await fetch("/api/expenses/data")).json();
    setExpenses(data.expenses);
    setEvents(data.events);
    setLoading(false);
  }

  function loadExpenses() { loadAll(); }

  function resetForm() {
    setDescription(""); setAmount(""); setCategory("venue");
    setDate(new Date().toISOString().split("T")[0]);
    setReference(""); setNotes(""); setEventId("");
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setDate(expense.date.split("T")[0]);
    setReference(expense.reference);
    setNotes(expense.notes);
    setEventId(expense.eventId || "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const payload = { description, amount: parseFloat(amount), category, date, reference, notes, eventId: eventId || null };
      if (editingId) {
        await fetch(`/api/expenses/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setShowForm(false); setEditingId(null); resetForm(); loadExpenses();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense record?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    loadExpenses();
  }

  const filteredExpenses = filterEvent
    ? filterEvent === "__none__"
      ? expenses.filter((e) => !e.eventId)
      : expenses.filter((e) => e.eventId === filterEvent)
    : expenses;

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const getCatInfo = (cat: string) => categories.find((c) => c.value === cat) || categories[7];

  if (loading) return <div className="text-gray-700 font-medium p-4">Loading...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-700">Event expenses — venue, equipment, referee, transport & more</p>
        </div>
        <button onClick={() => { if (showForm && !editingId) setShowForm(false); else { setShowForm(true); setEditingId(null); resetForm(); } }}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium text-sm">
          {showForm && !editingId ? "Cancel" : "Record Expense"}
        </button>
      </div>

      {/* Total Summary */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-red-800">Total Expenses{filterEvent ? " (Filtered)" : ""}</span>
          <span className="text-xl font-bold text-red-900">{formatAED(totalExpenses)}</span>
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          {categories.map((cat) => {
            const catTotal = filteredExpenses.filter((e) => e.category === cat.value).reduce((s, e) => s + e.amount, 0);
            if (catTotal === 0) return null;
            return <span key={cat.value} className="text-xs text-red-700">{cat.label}: {formatAED(catTotal)}</span>;
          })}
        </div>
      </div>

      {/* Event Filter */}
      <div className="mb-6">
        <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm">
          <option value="">All Events</option>
          <option value="__none__">General (no event)</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name} — {formatDate(ev.date)}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">{editingId ? "Edit Expense" : "Record Expense"}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  placeholder="e.g. Ground Rental - Zabeel Park" required />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Receipt/invoice number (optional)" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50">
                {submitting ? "Saving..." : editingId ? "Update" : "Record Expense"}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}
                  className="px-4 py-2.5 text-gray-700 font-medium">Cancel</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      <div className="space-y-3">
        {filteredExpenses.map((exp) => {
          const catInfo = getCatInfo(exp.category);
          return (
            <div key={exp.id} className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{exp.description}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${catInfo.color}`}>{catInfo.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700 flex-wrap">
                    <span>{formatDate(exp.date)}</span>
                    {exp.event && <span className="text-blue-700">For: {exp.event.name}</span>}
                    {exp.reference && <span>Ref: {exp.reference}</span>}
                    {exp.notes && <span>{exp.notes}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-red-700 text-lg">{formatAED(exp.amount)}</div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => openEdit(exp)} className="text-blue-600 text-xs font-medium">Edit</button>
                    <button onClick={() => handleDelete(exp.id)} className="text-red-600 text-xs font-medium">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredExpenses.length === 0 && (
          <div className="text-center text-gray-600 py-12 font-medium">No expenses recorded yet. Record venue, equipment, and other event costs above.</div>
        )}
      </div>
    </div>
  );
}
