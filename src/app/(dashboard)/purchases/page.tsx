"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Member {
  id: string;
  name: string;
}

interface GroupMember { id: string; member: Member }
interface MemberGroup { id: string; name: string; members: GroupMember[] }

interface PurchaseSplit {
  id: string;
  amount: number;
  member: Member;
}

interface Purchase {
  id: string;
  description: string;
  totalAmount: number;
  date: string;
  notes: string;
  splits: PurchaseSplit[];
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<MemberGroup[]>([]);

  useEffect(() => {
    loadPurchases();
    fetch("/api/members").then((r) => r.json()).then((m) => {
      setMembers(m.filter((x: Member & { active: boolean }) => x.active));
    });
    fetch("/api/groups").then((r) => r.json()).then(setGroups);
  }, []);

  async function loadPurchases() {
    const res = await fetch("/api/purchases");
    setPurchases(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const total = parseFloat(totalAmount);
      let splits: { memberId: string; amount: number }[];

      if (splitMode === "equal") {
        const perPerson = Math.round((total / selectedMembers.length) * 100) / 100;
        splits = selectedMembers.map((id) => ({ memberId: id, amount: perPerson }));
      } else {
        splits = selectedMembers
          .filter((id) => parseFloat(customSplits[id] || "0") > 0)
          .map((id) => ({ memberId: id, amount: parseFloat(customSplits[id]) }));
      }

      await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, totalAmount: total, date, notes, splits }),
      });
      setShowForm(false);
      setDescription("");
      setTotalAmount("");
      setNotes("");
      setSelectedMembers([]);
      setCustomSplits({});
      loadPurchases();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this purchase?")) return;
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    loadPurchases();
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  const equalSplitAmount = selectedMembers.length > 0 && totalAmount
    ? (parseFloat(totalAmount) / selectedMembers.length).toFixed(2)
    : "0.00";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium text-sm"
        >
          {showForm ? "Cancel" : "New Purchase"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Log Purchase</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  placeholder="What was purchased" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Total Amount (AED)</label>
                <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" />
            </div>

            {/* Split Mode */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Split Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={splitMode === "equal"} onChange={() => setSplitMode("equal")} className="text-emerald-600" />
                  <span className="text-sm text-gray-900 font-medium">Split Equally</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={splitMode === "custom"} onChange={() => setSplitMode("custom")} className="text-emerald-600" />
                  <span className="text-sm text-gray-900 font-medium">Custom Amounts</span>
                </label>
              </div>
            </div>

            {/* Member Selection */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="block text-sm font-semibold text-gray-800">Members</label>
                <div className="flex gap-2 items-center">
                  {groups.length > 0 && (
                    <select onChange={(e) => { if (!e.target.value) return; const g = groups.find((x) => x.id === e.target.value); if (g) setSelectedMembers(g.members.map((gm) => gm.member.id)); e.target.value = ""; }}
                      className="text-xs px-2 py-1 border border-emerald-300 rounded-lg text-emerald-800 font-medium bg-emerald-50">
                      <option value="">Load Group...</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members.length})</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => setSelectedMembers(members.map((m) => m.id))}
                    className="text-sm text-emerald-600 hover:underline font-medium">Select All</button>
                </div>
              </div>

              {splitMode === "equal" ? (
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <label key={m.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium ${
                        selectedMembers.includes(m.id) ? "bg-emerald-50 border-emerald-300 text-emerald-900" : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}>
                      <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={() => toggleMember(m.id)} className="sr-only" />
                      {m.name}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 min-w-[140px]">
                        <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={() => toggleMember(m.id)} className="rounded text-emerald-600" />
                        <span className="text-sm text-gray-900">{m.name}</span>
                      </label>
                      {selectedMembers.includes(m.id) && (
                        <input type="number" step="0.01" value={customSplits[m.id] || ""}
                          onChange={(e) => setCustomSplits((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          className="w-32 px-2 py-1 border rounded text-sm text-gray-900" placeholder="Amount" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedMembers.length > 0 && splitMode === "equal" && totalAmount && (
                <p className="text-sm text-gray-800 mt-2 font-medium">
                  {selectedMembers.length} members — {formatAED(parseFloat(equalSplitAmount))} each
                </p>
              )}
            </div>

            <button type="submit" disabled={selectedMembers.length === 0 || submitting}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
              {submitting ? "Saving..." : "Log Purchase"}
            </button>
          </form>
        </div>
      )}

      {/* Purchases List */}
      <div className="space-y-4">
        {purchases.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900">{p.description}</h3>
                <p className="text-sm text-gray-800">
                  {formatDate(p.date)} — Total: {formatAED(p.totalAmount)} — {p.splits.length} members
                </p>
                {p.notes && <p className="text-sm text-gray-700 mt-1">{p.notes}</p>}
              </div>
              <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-sm font-medium flex-shrink-0">
                Delete
              </button>
            </div>
            <div className="px-4 md:px-6 py-3">
              <div className="flex flex-wrap gap-1.5">
                {p.splits.map((s) => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 font-medium">
                    {s.member.name}: {formatAED(s.amount)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
        {purchases.length === 0 && (
          <div className="text-center text-gray-600 py-12 font-medium">No purchases yet.</div>
        )}
      </div>
    </div>
  );
}
