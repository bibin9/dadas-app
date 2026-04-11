"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Member { id: string; name: string }
interface Event { id: string; name: string; date: string; type: string }
interface Payment { id: string; amount: number; method: string; reference: string; notes: string; date: string; member: Member; event?: Event | null }

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

  useEffect(() => {
    loadPayments();
    fetch("/api/members").then((r) => r.json()).then((m) => setMembers(m.filter((x: Member & { active: boolean }) => x.active)));
    fetch("/api/events").then((r) => r.json()).then(setEvents);
  }, []);

  async function loadPayments() {
    setPayments(await (await fetch("/api/payments")).json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId, amount: parseFloat(amount), method, reference, notes, date,
        eventId: eventId || null,
      }),
    });
    setShowForm(false); setMemberId(""); setAmount(""); setMethod("cash");
    setReference(""); setNotes(""); setEventId("");
    loadPayments();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment record?")) return;
    await fetch(`/api/payments/${id}`, { method: "DELETE" }); loadPayments();
  }

  const methodLabel = (m: string) => {
    switch (m) {
      case "cash": return "Cash";
      case "bank_transfer": return "Bank Transfer";
      case "company_contribution": return "Company Contribution";
      default: return m;
    }
  };
  const methodColor = (m: string) => {
    switch (m) {
      case "cash": return "bg-amber-100 text-amber-800";
      case "bank_transfer": return "bg-blue-100 text-blue-800";
      case "company_contribution": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium">
          {showForm ? "Cancel" : "Record Payment"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">Record Payment</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Payment Type</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="company_contribution">To Company Contribution</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">For Event (optional)</label>
                <select value={eventId} onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900 font-medium">
                  <option value="">General payment</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {formatDate(ev.date)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Reference</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Transaction ref (optional)" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" />
            </div>
            <button type="submit" className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 font-semibold">
              Record Payment
            </button>
          </form>
        </div>
      )}

      {/* Payments List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-700 border-b bg-gray-50">
                <th className="px-6 py-3 font-semibold">Date</th>
                <th className="px-6 py-3 font-semibold">Member</th>
                <th className="px-6 py-3 font-semibold text-right">Amount</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold">For Event</th>
                <th className="px-6 py-3 font-semibold">Reference</th>
                <th className="px-6 py-3 font-semibold">Notes</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-800 font-medium">{formatDate(p.date)}</td>
                  <td className="px-6 py-3 font-semibold text-gray-900">{p.member.name}</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-emerald-700">{formatAED(p.amount)}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${methodColor(p.method)}`}>
                      {methodLabel(p.method)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {p.event ? `${p.event.name} (${formatDate(p.event.date)})` : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{p.reference || <span className="text-gray-400">-</span>}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{p.notes || <span className="text-gray-400">-</span>}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500 font-medium">No payments recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
