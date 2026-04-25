"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Member {
  id: string;
  name: string;
}

interface GroupMember { id: string; member: Member }
interface MemberGroup { id: string; name: string; members: GroupMember[] }
interface EventTemplate { id: string; name: string; type: string; amount: number; amountType: string; groupId: string | null; notes: string }

interface PurchaseSplit {
  id: string;
  amount: number;
  paid: boolean;
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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [defaultShare, setDefaultShare] = useState(50);

  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const data = await (await fetch("/api/purchases/data")).json();
    setPurchases(data.purchases);
    setMembers(data.members);
    setGroups(data.groups);
    setDefaultShare(data.defaultShare || 50);
    setTemplates(data.templates || []);
    setLoading(false);
  }
  function loadPurchases() { loadAll(); }

  function getAmount(memberId: string): number {
    const custom = customAmounts[memberId];
    if (custom !== undefined && custom !== "") return parseFloat(custom) || 0;
    return defaultShare;
  }

  const totalAmount = selectedMembers.reduce((sum, id) => sum + getAmount(id), 0);

  function createFromTemplate(tpl: EventTemplate) {
    const group = tpl.groupId ? groups.find((g) => g.id === tpl.groupId) : null;
    const groupMemberIds = group ? group.members.map((gm) => gm.member.id) : members.map((m) => m.id);

    setShowForm(true);
    setDescription(tpl.name);
    setDate(new Date().toISOString().split("T")[0]);
    setNotes(tpl.notes);
    setSelectedMembers(groupMemberIds);
    setCustomAmounts({});

    // If template has a per-head amount, set it as custom for all members
    if (tpl.amount > 0 && tpl.amountType === "perhead") {
      const amounts: Record<string, string> = {};
      groupMemberIds.forEach((id) => { amounts[id] = String(tpl.amount); });
      setCustomAmounts(amounts);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const splits = selectedMembers.map((id) => ({
        memberId: id,
        amount: getAmount(id),
      }));

      await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, totalAmount, date, notes, splits }),
      });
      setShowForm(false);
      setDescription("");
      setNotes("");
      setSelectedMembers([]);
      setCustomAmounts({});
      loadPurchases();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    const p = purchases.find((x) => x.id === id);
    const msg = p
      ? `⚠️ DELETE this purchase?\n\n"${p.description}" — ${formatAED(p.totalAmount)}\n\nThis will also remove all member shares and cannot be undone.`
      : "Delete this purchase?";
    if (!confirm(msg)) return;
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    loadPurchases();
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  if (loading) return <div className="text-gray-700 font-medium p-4">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Big Ticket Purchases</h1>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) { setDescription(""); setNotes(""); setSelectedMembers([]); setCustomAmounts({}); } }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium text-sm"
        >
          {showForm ? "Cancel" : "New Purchase"}
        </button>
      </div>

      {/* Quick Templates */}
      {!showForm && templates.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-600 mb-2">Quick Templates</p>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => createFromTemplate(tpl)}
                className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-800 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-100 hover:border-purple-300 transition-colors"
              >
                <span>🎫</span>
                <span>{tpl.name}</span>
                {tpl.amount > 0 && (
                  <span className="text-xs bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded-full">
                    {tpl.amountType === "perhead" ? `${formatAED(tpl.amount)}/head` : formatAED(tpl.amount)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Log Purchase</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Description</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  placeholder="What was purchased" required />
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

            {/* Member Selection with per-member amounts */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="block text-sm font-semibold text-gray-800">
                  Members — Default share: {formatAED(defaultShare)} each
                </label>
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

              <div className="space-y-1.5">
                {members.map((m) => {
                  const isSelected = selectedMembers.includes(m.id);
                  const isCustom = customAmounts[m.id] !== undefined && customAmounts[m.id] !== "";
                  return (
                    <div key={m.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border transition-colors ${
                      isSelected ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100"
                    }`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(m.id)}
                        className="rounded text-emerald-600"
                      />
                      <span className={`text-sm font-medium flex-1 ${isSelected ? "text-gray-900" : "text-gray-500"}`}>{m.name}</span>
                      {isSelected && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">AED</span>
                          <input
                            type="number"
                            step="0.01"
                            value={customAmounts[m.id] ?? ""}
                            onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder={String(defaultShare)}
                            className={`w-20 px-2 py-1 border rounded-lg text-sm text-right ${
                              isCustom ? "border-amber-400 bg-amber-50 text-amber-900 font-semibold" : "border-gray-300 text-gray-700"
                            }`}
                          />
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => setCustomAmounts((prev) => { const n = { ...prev }; delete n[m.id]; return n; })}
                              className="text-xs text-gray-400 hover:text-gray-600"
                              title="Reset to default"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedMembers.length > 0 && (
                <div className="mt-3 bg-gray-100 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} selected
                  </span>
                  <span className="font-bold text-gray-900">Total: {formatAED(totalAmount)}</span>
                </div>
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
                  <span key={s.id} className={`text-xs px-2 py-1 rounded-full font-medium ${
                    s.paid ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                  }`}>
                    {s.member.name}: {formatAED(s.amount)} {s.paid ? "✓" : ""}
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
