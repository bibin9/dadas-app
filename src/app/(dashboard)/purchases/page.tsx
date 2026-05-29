"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Member {
  id: string;
  name: string;
  balance?: number; // lifetime Big Ticket balance: positive=owes, negative=credit
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [contribs, setContribs] = useState<Record<string, MemberContribution>>({});
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [defaultShare, setDefaultShare] = useState(50);
  const [search, setSearch] = useState("");

  // Per-row inline pay state (matches the football-match inline pay UX)
  const [inlinePayKey, setInlinePayKey] = useState<string | null>(null); // "purchaseId:memberId"
  const [inlinePayAmount, setInlinePayAmount] = useState("");
  const [inlinePayMethod, setInlinePayMethod] = useState("cash");
  const [inlinePaySubmitting, setInlinePaySubmitting] = useState(false);

  // Bulk-select per purchase: which memberIds are checked in each purchase row
  const [bulkSelected, setBulkSelected] = useState<Record<string, Set<string>>>({});
  const [bulkPayMethod, setBulkPayMethod] = useState<Record<string, string>>({});
  const [bulkPaySubmitting, setBulkPaySubmitting] = useState(false);

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

  function openEdit(p: Purchase) {
    setEditingId(p.id);
    setShowForm(true);
    setDescription(p.description);
    setDate(p.date.split("T")[0]);
    setNotes(p.notes);
    // Populate contribs from existing splits
    const next: Record<string, MemberContribution> = {};
    for (const m of members) {
      const split = p.splits.find((s) => s.member.id === m.id);
      if (split) {
        // existing split — selected, amount, paid status from DB
        next[m.id] = {
          selected: true,
          amount: split.amount !== defaultShare ? String(split.amount) : "",
          paid: split.paid,
          method: "cash", // method isn't stored on split — default to cash on edit
        };
      } else {
        next[m.id] = { selected: false, amount: "", paid: false, method: "cash" };
      }
    }
    setContribs(next);
    setSearch("");
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setDescription("");
    setNotes("");
    setContribs({});
    setSearch("");
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
      const url = editingId ? `/api/purchases/${editingId}` : "/api/purchases";
      const method = editingId ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, totalAmount, date, notes, splits }),
      });
      cancelForm();
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

  // --- Per-row inline pay (matches football inline payment UX) ---
  function startInlinePay(purchaseId: string, memberId: string) {
    setInlinePayKey(`${purchaseId}:${memberId}`);
    setInlinePayMethod("cash");
    setInlinePayAmount("");
  }
  function cancelInlinePay() {
    setInlinePayKey(null);
    setInlinePayAmount("");
  }
  async function recordInlinePay(purchaseId: string, memberId: string) {
    if (inlinePaySubmitting) return;
    setInlinePaySubmitting(true);
    try {
      const body: Record<string, unknown> = {
        memberIds: [memberId],
        method: inlinePayMethod,
      };
      if (inlinePayAmount !== "" && !isNaN(parseFloat(inlinePayAmount))) {
        body.amount = parseFloat(inlinePayAmount);
      }
      const res = await fetch(`/api/purchases/${purchaseId}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Pay failed: ${data.error || data.message || res.statusText}`);
        return;
      }
      cancelInlinePay();
      loadPurchases();
    } finally { setInlinePaySubmitting(false); }
  }

  // --- Bulk select + pay (matches football bulk-pay bar) ---
  function toggleBulk(purchaseId: string, memberId: string) {
    setBulkSelected((prev) => {
      const cur = new Set(prev[purchaseId] || []);
      if (cur.has(memberId)) cur.delete(memberId); else cur.add(memberId);
      return { ...prev, [purchaseId]: cur };
    });
  }
  function toggleBulkAll(purchaseId: string, unpaidIds: string[]) {
    setBulkSelected((prev) => {
      const cur = prev[purchaseId] || new Set();
      const next = cur.size > 0 ? new Set<string>() : new Set(unpaidIds);
      return { ...prev, [purchaseId]: next };
    });
  }
  async function recordBulkPay(purchaseId: string) {
    const selected = bulkSelected[purchaseId];
    if (!selected || selected.size === 0 || bulkPaySubmitting) return;
    setBulkPaySubmitting(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: Array.from(selected),
          method: bulkPayMethod[purchaseId] || "cash",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Bulk pay failed: ${data.error || data.message || res.statusText}`);
        return;
      }
      setBulkSelected((prev) => ({ ...prev, [purchaseId]: new Set() }));
      loadPurchases();
    } finally { setBulkPaySubmitting(false); }
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

  // --- WhatsApp share (matches football match share format) ---
  async function shareText(text: string) {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); }
  }

  async function sharePurchaseWhatsApp(p: Purchase) {
    const paidSplits = p.splits.filter((s) => s.paid);
    const unpaidSplits = p.splits.filter((s) => !s.paid);

    // Pull this purchase's payment records to show method breakdown (cash/bank/credit)
    const paymentByMemberId: Record<string, { amount: number; method: string }> = {};
    try {
      const purchaseDate = new Date(p.date);
      const reference = `${p.description} - ${purchaseDate.toLocaleDateString()}`;
      const r = await fetch(`/api/payments/data?profile=bigticket`);
      if (r.ok) {
        const data = await r.json();
        type PmtRow = { amount: number; method: string; reference: string; member: { id: string } };
        for (const pmt of (data.payments || []) as PmtRow[]) {
          if (pmt.reference === reference) {
            paymentByMemberId[pmt.member.id] = { amount: pmt.amount, method: pmt.method };
          }
        }
      }
    } catch { /* fall back to no method info */ }

    let cashTotal = 0;
    let bankTotal = 0;
    let creditApplied = 0;
    for (const s of paidSplits) {
      const pmt = paymentByMemberId[s.member.id];
      if (pmt?.method === "credit") creditApplied += s.amount;
      else if (pmt?.method === "bank_transfer") bankTotal += (pmt.amount || s.amount);
      else cashTotal += (pmt?.amount ?? s.amount);
    }
    const collected = cashTotal + bankTotal;
    const outstanding = unpaidSplits.reduce((s, x) => s + x.amount, 0);

    const num = (n: number) => n.toFixed(2);
    const allNames = p.splits.map((s) => s.member.name);
    const nameWidth = Math.min(Math.max(...allNames.map((n) => n.length), 6), 14);
    const padName = (n: string) => {
      const t = n.length > nameWidth ? n.slice(0, nameWidth - 1) + "…" : n;
      return t.padEnd(nameWidth);
    };
    const padAmt = (s: string, w = 9) => s.padStart(w);

    let msg = `🎫 *${p.description}*\n`;
    msg += `📅 ${formatDate(p.date)}\n`;
    msg += `💰 Total: ${formatAED(p.totalAmount)} · 👥 ${p.splits.length} members\n\n`;

    // PAID table — member + amount + method (cash/bank/credit)
    if (paidSplits.length > 0) {
      msg += `✅ *Paid (${paidSplits.length})*\n`;
      msg += "```\n";
      msg += `${"MEMBER".padEnd(nameWidth)}${padAmt("AMOUNT")}${padAmt("BY", 8)}\n`;
      msg += `${"─".repeat(nameWidth + 9 + 8)}\n`;
      for (const s of paidSplits) {
        const pmt = paymentByMemberId[s.member.id];
        const by = pmt?.method === "credit" ? "credit"
          : pmt?.method === "bank_transfer" ? "bank" : "cash";
        msg += `${padName(s.member.name)}${padAmt(num(s.amount))}${padAmt(by, 8)}\n`;
      }
      msg += "```\n\n";
    }

    // UNPAID list (the balance)
    if (unpaidSplits.length > 0) {
      msg += `❌ *Unpaid (${unpaidSplits.length})*\n`;
      unpaidSplits.forEach((s) => { msg += `• ${s.member.name} — ${formatAED(s.amount)}\n`; });
      msg += `\n`;
    }

    // Summary — same shape as football match Day Summary
    msg += `📊 *Summary*\n`;
    msg += "```\n";
    msg += `Cash         ${padAmt(num(cashTotal), 10)}\n`;
    msg += `Bank         ${padAmt(num(bankTotal), 10)}\n`;
    msg += `${"─".repeat(22)}\n`;
    msg += `Collected    ${padAmt(num(collected), 10)}\n`;
    if (creditApplied > 0.01) {
      msg += `From Credit  ${padAmt(num(creditApplied), 10)}\n`;
    }
    msg += `Outstanding  ${padAmt(num(outstanding), 10)}\n`;
    msg += "```";

    if (unpaidSplits.length > 0) {
      msg += `\n\n_Please clear your dues at the earliest._`;
    }

    shareText(msg);
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
          onClick={() => { if (showForm) { cancelForm(); } else { setShowForm(true); setEditingId(null); } }}
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
          <h2 className="font-semibold text-gray-900 mb-4">{editingId ? "Edit Purchase" : "Log Purchase & Collect"}</h2>
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
                  const bal = m.balance ?? 0;
                  const splitAmount = c.amount !== "" && !isNaN(parseFloat(c.amount)) ? parseFloat(c.amount) : defaultShare;
                  const hasCredit = bal < -0.01 && Math.abs(bal) >= splitAmount;
                  return (
                    <div key={m.id} className={`flex items-center gap-2 px-3 py-2.5 ${c.selected ? "bg-white" : "bg-gray-50"}`}>
                      <button type="button" onClick={() => setContrib(m.id, { selected: !c.selected })}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.selected ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-300"}`}>
                        {c.selected ? "✓" : ""}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className={`font-semibold text-sm truncate block ${c.selected ? "text-gray-900" : "text-gray-400 line-through"}`}>{m.name}</span>
                        {bal > 0.01 && (
                          <span className="text-xs font-medium text-red-600">Owes {formatAED(bal)}</span>
                        )}
                        {bal < -0.01 && (
                          <span className="text-xs font-medium text-emerald-600">Credit {formatAED(Math.abs(bal))}</span>
                        )}
                      </div>
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
                                {(hasCredit || c.method === "credit") && (
                                  <option value="credit">Credit ({formatAED(Math.abs(bal))})</option>
                                )}
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

            <div className="flex gap-3">
              <button type="submit" disabled={selectedMemberIds.length === 0 || submitting}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
                {submitting ? "Saving..." : editingId ? "Update Purchase" : "Log Purchase & Collection"}
              </button>
              {editingId && (
                <button type="button" onClick={cancelForm}
                  className="px-4 py-2.5 text-gray-700 font-medium text-sm">Cancel</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ========== PURCHASES LIST ========== */}
      <div className="space-y-4">
        {purchases.map((p) => {
          const paidSplits = p.splits.filter((s) => s.paid);
          const unpaidSplits = p.splits.filter((s) => !s.paid);
          const totalPaid = paidSplits.reduce((sum, s) => sum + s.amount, 0);
          const purchaseBulk = bulkSelected[p.id] || new Set<string>();

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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => sharePurchaseWhatsApp(p)}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 flex items-center gap-1">
                      <span>📤</span>
                      <span>Share</span>
                    </button>
                    <button onClick={() => openEdit(p)}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 md:px-6 py-3 space-y-3">
                {/* Paid section */}
                {paidSplits.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-emerald-700 mb-2">Paid ({paidSplits.length})</h4>
                    <div className="space-y-1">
                      {paidSplits.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-gray-900">{s.member.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-emerald-700">{formatAED(s.amount)}</span>
                            <button onClick={() => unmarkPaid(p.id, s.member.id, s.member.name)}
                              title="Click to undo"
                              className="text-xs text-gray-500 hover:text-red-600 font-medium">undo</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unpaid section — inline Mark Paid per row + bulk bar */}
                {unpaidSplits.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-red-600">Unpaid ({unpaidSplits.length})</h4>
                      {unpaidSplits.length > 1 && (
                        <button onClick={() => toggleBulkAll(p.id, unpaidSplits.map((s) => s.member.id))}
                          className="text-xs text-blue-700 font-medium hover:underline">
                          {purchaseBulk.size > 0 ? "Deselect All" : "Select All"}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {unpaidSplits.map((s) => {
                        const rowKey = `${p.id}:${s.member.id}`;
                        const isInline = inlinePayKey === rowKey;
                        const memberBal = (members.find((mm) => mm.id === s.member.id)?.balance) ?? 0;
                        const hasCredit = memberBal < -0.01 && Math.abs(memberBal) >= s.amount;
                        return (
                          <div key={s.id} className="bg-red-50 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={purchaseBulk.has(s.member.id)}
                                  onChange={() => toggleBulk(p.id, s.member.id)}
                                  className="rounded text-emerald-600" />
                                <span className="text-sm font-medium text-gray-900">{s.member.name}</span>
                                {memberBal < -0.01 && (
                                  <span className="text-xs font-semibold text-emerald-700">(cr {formatAED(Math.abs(memberBal))})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-red-600">{formatAED(s.amount)}</span>
                                {isInline ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <input type="number" step="0.01" value={inlinePayAmount}
                                      onChange={(e) => setInlinePayAmount(e.target.value)}
                                      placeholder={String(s.amount)}
                                      className="w-16 text-xs px-1.5 py-1 border rounded-lg text-gray-800 text-right" />
                                    <select value={inlinePayMethod} onChange={(e) => {
                                      const m = e.target.value;
                                      setInlinePayMethod(m);
                                      if (m === "credit") setInlinePayAmount("0");
                                      else if (inlinePayMethod === "credit") setInlinePayAmount("");
                                    }} className="text-xs px-1.5 py-1 border rounded-lg text-gray-800">
                                      <option value="cash">Cash</option>
                                      <option value="bank_transfer">Bank</option>
                                      {hasCredit && (
                                        <option value="credit">Credit ({formatAED(Math.abs(memberBal))})</option>
                                      )}
                                    </select>
                                    <button disabled={inlinePaySubmitting} onClick={() => recordInlinePay(p.id, s.member.id)}
                                      className="bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50">
                                      {inlinePaySubmitting ? "..." : "Pay"}
                                    </button>
                                    <button onClick={cancelInlinePay} className="text-gray-500 text-xs px-1.5 py-1">X</button>
                                  </div>
                                ) : (
                                  <button onClick={() => startInlinePay(p.id, s.member.id)}
                                    className="bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-lg font-semibold">
                                    Mark Paid
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bulk pay bar — appears when checkboxes are ticked */}
                    {purchaseBulk.size > 0 && (
                      <div className="flex items-center gap-2 mt-2 bg-blue-50 rounded-lg px-3 py-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{purchaseBulk.size} selected</span>
                        <select value={bulkPayMethod[p.id] || "cash"}
                          onChange={(e) => setBulkPayMethod((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="text-xs px-1.5 py-1 border rounded-lg text-gray-800">
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank</option>
                          <option value="credit">From Credit</option>
                        </select>
                        <button disabled={bulkPaySubmitting} onClick={() => recordBulkPay(p.id)}
                          className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50">
                          {bulkPaySubmitting ? "Saving..." : `Mark ${purchaseBulk.size} Paid`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
