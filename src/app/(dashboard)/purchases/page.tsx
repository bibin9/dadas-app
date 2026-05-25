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

// Per-member state in the create form
interface MemberContribution {
  selected: boolean;
  amount: string; // empty = use default share
  paid: boolean;
  method: string; // cash or bank_transfer
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [contribs, setContribs] = useState<Record<string, MemberContribution>>({});
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [defaultShare, setDefaultShare] = useState(50);
  const [search, setSearch] = useState("");

  // Inline collect state per purchase (which purchase is being collected from)
  const [collectingPurchaseId, setCollectingPurchaseId] = useState<string | null>(null);
  const [collectMethod, setCollectMethod] = useState("cash");
  const [collectSelected, setCollectSelected] = useState<Set<string>>(new Set());
  const [collecting, setCollecting] = useState(false);

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

  function getContrib(id: string): MemberContribution {
    return contribs[id] || { selected: false, amount: "", paid: false, method: "cash" };
  }

  function setContrib(id: string, patch: Partial<MemberContribution>) {
    setContribs((prev) => ({ ...prev, [id]: { ...getContrib(id), ...patch } }));
  }

  function getAmount(id: string): number {
    const c = getContrib(id);
    if (c.amount !== "" && !isNaN(parseFloat(c.amount))) return parseFloat(c.amount);
    return defaultShare;
  }

  const selectedMemberIds = Object.entries(contribs)
    .filter(([, c]) => c.selected)
    .map(([id]) => id);

  const totalAmount = selectedMemberIds.reduce((sum, id) => sum + getAmount(id), 0);
  const paidCount = selectedMemberIds.filter((id) => contribs[id]?.paid).length;
  const paidTotal = selectedMemberIds
    .filter((id) => contribs[id]?.paid)
    .reduce((sum, id) => sum + getAmount(id), 0);

  function loadGroup(groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const ids = new Set(g.members.map((gm) => gm.member.id));
    const next: Record<string, MemberContribution> = {};
    for (const m of members) {
      next[m.id] = { ...getContrib(m.id), selected: ids.has(m.id) };
    }
    setContribs(next);
  }

  function selectAll() {
    const next: Record<string, MemberContribution> = {};
    for (const m of members) next[m.id] = { ...getContrib(m.id), selected: true };
    setContribs(next);
  }
  function clearSelection() { setContribs({}); }

  function markAllPaid() {
    const next: Record<string, MemberContribution> = { ...contribs };
    for (const id of selectedMemberIds) {
      next[id] = { ...next[id], paid: true };
    }
    setContribs(next);
  }
  function markNonePaid() {
    const next: Record<string, MemberContribution> = { ...contribs };
    for (const id of selectedMemberIds) {
      next[id] = { ...next[id], paid: false };
    }
    setContribs(next);
  }

  function createFromTemplate(tpl: EventTemplate) {
    const group = tpl.groupId ? groups.find((g) => g.id === tpl.groupId) : null;
    const groupMemberIds = group ? group.members.map((gm) => gm.member.id) : members.map((m) => m.id);
    setShowForm(true);
    setDescription(tpl.name);
    setDate(new Date().toISOString().split("T")[0]);
    setNotes(tpl.notes);

    const next: Record<string, MemberContribution> = {};
    for (const m of members) {
      const inGroup = groupMemberIds.includes(m.id);
      next[m.id] = {
        selected: inGroup,
        amount: tpl.amount > 0 && tpl.amountType === "perhead" ? String(tpl.amount) : "",
        paid: false,
        method: "cash",
      };
    }
    setContribs(next);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const splits = selectedMemberIds.map((id) => ({
        memberId: id,
        amount: getAmount(id),
        paid: contribs[id]?.paid || false,
        method: contribs[id]?.method || "cash",
      }));
      await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, totalAmount, date, notes, splits }),
      });
      setShowForm(false);
      setDescription("");
      setNotes("");
      setContribs({});
      setSearch("");
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

  // --- Collect Mode (mark splits as paid for an existing purchase) ---
  function startCollect(purchaseId: string) {
    setCollectingPurchaseId(purchaseId);
    setCollectSelected(new Set());
    setCollectMethod("cash");
  }
  function cancelCollect() {
    setCollectingPurchaseId(null);
    setCollectSelected(new Set());
  }
  function toggleCollect(memberId: string) {
    setCollectSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId); else next.add(memberId);
      return next;
    });
  }
  function selectAllUnpaid(purchase: Purchase) {
    const unpaid = purchase.splits.filter((s) => !s.paid).map((s) => s.member.id);
    setCollectSelected(new Set(unpaid));
  }
  async function submitCollect(purchaseId: string) {
    if (collectSelected.size === 0 || collecting) return;
    setCollecting(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: Array.from(collectSelected), method: collectMethod }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Collect failed: ${data.error || data.message || res.statusText}`);
        return;
      }
      cancelCollect();
      loadPurchases();
    } finally { setCollecting(false); }
  }
  async function unmarkPaid(purchaseId: string, memberId: string, memberName: string) {
    if (!confirm(`Undo payment for ${memberName}?`)) return;
    const res = await fetch(`/api/purchases/${purchaseId}/collect`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    if (!res.ok) { alert("Undo failed"); return; }
    loadPurchases();
  }

  const filteredMembers = search
    ? members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : members;

  if (loading) return <div className="text-gray-700 font-medium p-4">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Big Ticket Purchases</h1>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) { setDescription(""); setNotes(""); setContribs({}); setSearch(""); } }}
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

      {/* ========== CREATE FORM ========== */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Log Purchase & Collect</h2>
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

            {/* Member contribution list — match the football match form layout */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="block text-sm font-bold text-gray-900">
                  Members & Collection — Default {formatAED(defaultShare)}/head
                </label>
                <div className="flex gap-2 items-center text-xs flex-wrap">
                  {groups.length > 0 && (
                    <select onChange={(e) => { if (!e.target.value) return; loadGroup(e.target.value); e.target.value = ""; }}
                      className="px-2 py-1 border border-emerald-300 rounded-lg text-emerald-800 font-medium bg-emerald-50">
                      <option value="">Load Group...</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members.length})</option>)}
                    </select>
                  )}
                  <button type="button" onClick={selectAll} className="text-emerald-700 font-medium hover:underline">All</button>
                  <button type="button" onClick={clearSelection} className="text-gray-700 font-medium hover:underline">None</button>
                  <span className="text-gray-400">|</span>
                  <button type="button" onClick={markAllPaid} className="text-emerald-700 font-medium hover:underline">All Paid</button>
                  <button type="button" onClick={markNonePaid} className="text-gray-700 font-medium hover:underline">None Paid</button>
                </div>
              </div>

              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-gray-900 text-sm"
                placeholder="Search members..." />

              <div className="bg-white rounded-lg border border-gray-200 divide-y max-h-[400px] overflow-y-auto">
                {filteredMembers.map((m) => {
                  const c = getContrib(m.id);
                  return (
                    <div key={m.id} className={`flex items-center gap-2 px-3 py-2.5 ${c.selected ? "bg-white" : "bg-gray-50"}`}>
                      <button type="button" onClick={() => setContrib(m.id, { selected: !c.selected })}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.selected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-300"}`}>
                        {c.selected ? "✓" : ""}
                      </button>
                      <span className={`flex-1 font-semibold text-sm min-w-0 truncate ${c.selected ? "text-gray-900" : "text-gray-400 line-through"}`}>{m.name}</span>
                      {c.selected && (
                        <>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input type="number" step="0.01" value={c.amount}
                              onChange={(e) => setContrib(m.id, { amount: e.target.value })}
                              placeholder={String(defaultShare)}
                              className={`w-16 text-sm text-right px-1.5 py-1 border rounded-lg ${c.amount !== "" ? "border-amber-400 bg-amber-50 text-amber-900 font-semibold" : "border-gray-300 text-gray-800"}`} />
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button type="button" onClick={() => setContrib(m.id, { paid: !c.paid })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${c.paid ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-red-300 text-red-600"}`}>
                              {c.paid ? "Paid" : "Unpaid"}
                            </button>
                            {c.paid && (
                              <select value={c.method} onChange={(e) => setContrib(m.id, { method: e.target.value })}
                                className="text-xs px-1.5 py-1 border border-gray-300 rounded-lg text-gray-800 font-medium">
                                <option value="cash">Cash</option>
                                <option value="bank_transfer">Bank</option>
                              </select>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedMemberIds.length > 0 && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-gray-700">Members</span><div className="font-bold text-gray-900 text-base">{selectedMemberIds.length}</div></div>
                  <div><span className="text-gray-700">Total Due</span><div className="font-bold text-gray-900 text-base">{formatAED(totalAmount)}</div></div>
                  <div><span className="text-gray-700">Paid Now</span><div className="font-bold text-emerald-700 text-base">{paidCount} / {selectedMemberIds.length}</div></div>
                  <div><span className="text-gray-700">Collected</span><div className="font-bold text-emerald-700 text-base">{formatAED(paidTotal)}</div></div>
                </div>
              )}
            </div>

            <button type="submit" disabled={selectedMemberIds.length === 0 || submitting}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
              {submitting ? "Saving..." : "Log Purchase & Collection"}
            </button>
          </form>
        </div>
      )}

      {/* ========== PURCHASES LIST ========== */}
      <div className="space-y-4">
        {purchases.map((p) => {
          const paidSplits = p.splits.filter((s) => s.paid);
          const unpaidSplits = p.splits.filter((s) => !s.paid);
          const totalPaid = paidSplits.reduce((sum, s) => sum + s.amount, 0);
          const isCollecting = collectingPurchaseId === p.id;

          return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{p.description}</h3>
                    <p className="text-sm text-gray-700">
                      {formatDate(p.date)} · {formatAED(p.totalAmount)} · {p.splits.length} members
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Collected: <span className="font-semibold text-emerald-700">{formatAED(totalPaid)}</span>
                      {" · "}
                      Outstanding: <span className="font-semibold text-red-600">{formatAED(p.totalAmount - totalPaid)}</span>
                    </p>
                    {p.notes && <p className="text-sm text-gray-700 mt-1">{p.notes}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!isCollecting && unpaidSplits.length > 0 && (
                      <button onClick={() => startCollect(p.id)}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-700">
                        Collect ({unpaidSplits.length})
                      </button>
                    )}
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Collect mode: bulk-select unpaid + method + Collect button */}
              {isCollecting && (
                <div className="bg-emerald-50 border-b border-emerald-200 px-4 md:px-6 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="font-semibold text-gray-800">Collect from {collectSelected.size} of {unpaidSplits.length} unpaid</span>
                      <button type="button" onClick={() => selectAllUnpaid(p)}
                        className="text-xs text-emerald-700 font-semibold hover:underline">Select All Unpaid</button>
                      <button type="button" onClick={() => setCollectSelected(new Set())}
                        className="text-xs text-gray-700 hover:underline">None</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={collectMethod} onChange={(e) => setCollectMethod(e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-300 rounded-lg text-gray-800 font-medium bg-white">
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                      <button onClick={() => submitCollect(p.id)} disabled={collectSelected.size === 0 || collecting}
                        className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
                        {collecting ? "Collecting..." : `Mark ${collectSelected.size} Paid`}
                      </button>
                      <button onClick={cancelCollect} className="text-gray-700 text-xs font-medium hover:underline">Cancel</button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border divide-y max-h-[300px] overflow-y-auto">
                    {unpaidSplits.map((s) => {
                      const checked = collectSelected.has(s.member.id);
                      return (
                        <label key={s.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" checked={checked} onChange={() => toggleCollect(s.member.id)}
                            className="rounded text-emerald-600" />
                          <span className="flex-1 text-sm font-semibold text-gray-900">{s.member.name}</span>
                          <span className="text-sm font-bold text-red-600">{formatAED(s.amount)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Splits list — visible when not collecting */}
              {!isCollecting && (
                <div className="px-4 md:px-6 py-3">
                  {paidSplits.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">✅ Paid ({paidSplits.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {paidSplits.map((s) => (
                          <span key={s.id}
                            onClick={() => unmarkPaid(p.id, s.member.id, s.member.name)}
                            title="Click to undo"
                            className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-800 cursor-pointer hover:bg-emerald-200">
                            {s.member.name}: {formatAED(s.amount)} ✓
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {unpaidSplits.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1">❌ Unpaid ({unpaidSplits.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {unpaidSplits.map((s) => (
                          <span key={s.id} className="text-xs px-2 py-1 rounded-full font-medium bg-red-50 text-red-800 border border-red-200">
                            {s.member.name}: {formatAED(s.amount)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {purchases.length === 0 && (
          <div className="text-center text-gray-600 py-12 font-medium">No purchases yet.</div>
        )}
      </div>
    </div>
  );
}
