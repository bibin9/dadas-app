"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Member { id: string; name: string; isGuest?: boolean; balance?: number }
interface EventDue { id: string; amount: number; paid: boolean; member: Member }
interface EventPayment { id: string; amount: number; method: string; member: Member }
interface Event { id: string; name: string; type: string; date: string; perHeadFee: number; totalCost: number; notes: string; dues: EventDue[]; payments?: EventPayment[] }
interface Settings { defaultMatchFee: number; groupName: string }
interface PlayerPayment { playing: boolean; paid: boolean; method: string; customAmount?: string }
interface GroupMember { id: string; member: Member }
interface MemberGroup { id: string; name: string; members: GroupMember[] }
interface EventTemplate { id: string; name: string; type: string; amount: number; amountType: string; groupId: string | null; notes: string }

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>({ defaultMatchFee: 20, groupName: "Company" });
  const [showForm, setShowForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Inline payment recording
  const [inlinePayMemberId, setInlinePayMemberId] = useState<string | null>(null);
  const [inlinePayMethod, setInlinePayMethod] = useState("cash");
  const [inlinePayAmount, setInlinePayAmount] = useState("");
  const [inlinePaySubmitting, setInlinePaySubmitting] = useState(false);

  // Bulk pay
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkPayMethod, setBulkPayMethod] = useState("cash");
  const [bulkPaySubmitting, setBulkPaySubmitting] = useState(false);

  // Event form
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventTotalCost, setEventTotalCost] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [eventSearch, setEventSearch] = useState("");

  // Quick Match state
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [matchFee, setMatchFee] = useState("");
  const [matchCost, setMatchCost] = useState("");
  const [matchNotes, setMatchNotes] = useState("");
  const [playerPayments, setPlayerPayments] = useState<Record<string, PlayerPayment>>({});
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [matchSearch, setMatchSearch] = useState("");
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);

  useEffect(() => { loadAll(); }, []);

  function loadAll() {
    fetch("/api/events/data").then((r) => r.json()).then((data) => {
      setEvents(data.events);
      setMembers(data.members);
      setSettings(data.settings);
      setMatchFee(String(data.settings.defaultMatchFee || 20));
      setGroups(data.groups);
      setTemplates(data.templates);
    });
  }

  function createFromTemplate(tpl: EventTemplate) {
    const group = tpl.groupId ? groups.find((g) => g.id === tpl.groupId) : null;
    const groupMemberIds = group ? group.members.map((gm) => gm.member.id) : members.map((m) => m.id);

    if (tpl.type === "match") {
      setShowMatchForm(true); setShowForm(false); setEditingEvent(null);
      setMatchDate(new Date().toISOString().split("T")[0]);
      setMatchFee(tpl.amountType === "perhead" && tpl.amount > 0 ? String(tpl.amount) : String(settings.defaultMatchFee || 20));
      setMatchCost(tpl.amountType === "total" && tpl.amount > 0 ? String(tpl.amount) : "");
      setMatchNotes(tpl.notes); setGuestNames([]); setMatchSearch("");
      const map: Record<string, PlayerPayment> = {};
      members.forEach((m) => { map[m.id] = { playing: groupMemberIds.includes(m.id), paid: false, method: "cash" }; });
      setPlayerPayments(map);
    } else {
      setShowForm(true); setShowMatchForm(false); setEditingEvent(null);
      setName(tpl.name);
      setDate(new Date().toISOString().split("T")[0]);
      setEventTotalCost(tpl.amountType === "total" && tpl.amount > 0 ? String(tpl.amount) : tpl.amountType === "perhead" && tpl.amount > 0 ? String(tpl.amount * groupMemberIds.length) : "");
      setNotes(tpl.notes); setEventSearch("");
      setSelectedMembers(groupMemberIds);
    }
  }

  async function loadEvents() { setEvents(await (await fetch("/api/events")).json()); }

  // --- Player payment helpers ---
  function initAllPlayers() { const map: Record<string, PlayerPayment> = {}; members.forEach((m) => { map[m.id] = { playing: true, paid: false, method: "cash" }; }); setPlayerPayments(map); }
  function togglePlaying(id: string) { setPlayerPayments((p) => ({ ...p, [id]: { ...p[id], playing: !p[id]?.playing, paid: p[id]?.playing ? false : p[id]?.paid } })); }
  function togglePaid(id: string) { setPlayerPayments((p) => ({ ...p, [id]: { ...p[id], paid: !p[id]?.paid } })); }
  function setMethod(id: string, m: string) { setPlayerPayments((p) => ({ ...p, [id]: { ...p[id], method: m } })); }
  function markAllPaid() { setPlayerPayments((p) => { const u = { ...p }; Object.keys(u).forEach((id) => { if (u[id].playing) u[id] = { ...u[id], paid: true }; }); return u; }); }
  function markAllUnpaid() { setPlayerPayments((p) => { const u = { ...p }; Object.keys(u).forEach((id) => { u[id] = { ...u[id], paid: false }; }); return u; }); }

  // --- Guest helpers ---
  function addGuest() { setGuestNames([...guestNames, ""]); }
  function updateGuest(i: number, v: string) { const g = [...guestNames]; g[i] = v; setGuestNames(g); }
  function removeGuest(i: number) { setGuestNames(guestNames.filter((_, j) => j !== i)); }

  // --- Event form ---
  function openEventForm() { setShowForm(true); setShowMatchForm(false); setEditingEvent(null); setName(""); setEventTotalCost(""); setNotes(""); setSelectedMembers(members.map((m) => m.id)); setDate(new Date().toISOString().split("T")[0]); setEventSearch(""); }
  function openEventEdit(ev: Event) { setEditingEvent(ev); setShowForm(true); setShowMatchForm(false); setName(ev.name); setDate(ev.date.split("T")[0]); setEventTotalCost(String(ev.totalCost || ev.perHeadFee * ev.dues.length)); setNotes(ev.notes); setSelectedMembers(ev.dues.map((d) => d.member.id)); setEventSearch(""); }
  function openMatchEdit(ev: Event) {
    setEditingEvent(ev); setShowMatchForm(true); setShowForm(false); setMatchDate(ev.date.split("T")[0]); setMatchFee(String(ev.perHeadFee)); setMatchCost(String(ev.totalCost || "")); setMatchNotes(ev.notes);
    const map: Record<string, PlayerPayment> = {}; members.forEach((m) => { map[m.id] = { playing: false, paid: false, method: "cash" }; }); ev.dues.forEach((d) => { map[d.member.id] = { playing: true, paid: false, method: "cash" }; }); setPlayerPayments(map); setGuestNames([]); setMatchSearch("");
  }

  const eventPerHead = selectedMembers.length > 0 && eventTotalCost ? parseFloat(eventTotalCost) / selectedMembers.length : 0;

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const total = parseFloat(eventTotalCost); const perHead = Math.round((total / selectedMembers.length) * 100) / 100;
      if (editingEvent) { await fetch(`/api/events/${editingEvent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, date, perHeadFee: perHead, totalCost: total, notes, memberIds: selectedMembers }) }); }
      else { await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, date, perHeadFee: perHead, totalCost: total, notes, memberIds: selectedMembers, type: "event" }) }); }
      setShowForm(false); setEditingEvent(null); setEventSearch(""); loadEvents();
    } finally { setSubmitting(false); }
  }

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault(); if (submitting) return; setSubmitting(true);
    try {
      const fee = parseFloat(matchFee);
      const playingIds = Object.entries(playerPayments).filter(([, v]) => v.playing).map(([id]) => id);
      const paidPlayers = Object.entries(playerPayments).filter(([, v]) => v.playing && v.paid).map(([id, v]) => ({ memberId: id, amount: v.customAmount ? parseFloat(v.customAmount) : fee, method: v.method }));
      const cost = parseFloat(matchCost || "0"); const collected = fee * (playingIds.length + guestNames.filter((g) => g.trim()).length); const surplus = collected - cost;
      if (editingEvent) { await fetch(`/api/events/${editingEvent.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingEvent.name, date: matchDate, perHeadFee: fee, totalCost: cost, notes: matchNotes, memberIds: playingIds, guestNames: guestNames.filter((g) => g.trim()) }) }); }
      else {
        const res = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Football Match", date: matchDate, perHeadFee: fee, totalCost: cost, notes: matchNotes || (surplus > 0 ? `Surplus ${formatAED(surplus)} to ${settings.groupName} fund` : ""), memberIds: playingIds, type: "match", payments: paidPlayers, guestNames: guestNames.filter((g) => g.trim()) }) });
        if (!res.ok) { const err = await res.json(); alert(err.error || "Failed to create match"); return; }
      }
      setShowMatchForm(false); setEditingEvent(null); setGuestNames([]); setMatchSearch(""); loadAll();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    const ev = events.find((x) => x.id === id);
    const msg = ev
      ? `⚠️ DELETE this ${ev.type === "match" ? "match" : "event"}?\n\n"${ev.name}" — ${formatDate(ev.date)}\n${ev.dues.length} player(s) • ${formatAED(ev.totalCost || ev.perHeadFee * ev.dues.length)}\n\nAll dues and linked payments will be removed. This cannot be undone.`
      : "Delete this event?";
    if (!confirm(msg)) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" });
    loadEvents();
  }

  // --- Inline payment for event detail ---
  async function recordInlinePayment(eventId: string, memberId: string, defaultAmount: number, eventDate: string) {
    if (inlinePaySubmitting) return; setInlinePaySubmitting(true);
    const payAmount = inlinePayAmount ? parseFloat(inlinePayAmount) : defaultAmount;
    try {
      await fetch("/api/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, amount: payAmount, method: inlinePayMethod, date: eventDate.split("T")[0], eventId, reference: payAmount !== defaultAmount ? `Adjusted: ${payAmount > defaultAmount ? "+" : ""}${(payAmount - defaultAmount).toFixed(2)} carry forward` : "", notes: "" }),
      });
      setInlinePayMemberId(null); setInlinePayMethod("cash"); setInlinePayAmount(""); loadEvents();
    } finally { setInlinePaySubmitting(false); }
  }

  async function recordBulkPayment(eventId: string, unpaidDues: EventDue[], eventDate: string) {
    if (bulkPaySubmitting || bulkSelected.size === 0) return; setBulkPaySubmitting(true);
    try {
      const duesPaying = unpaidDues.filter((d) => bulkSelected.has(d.member.id));
      await Promise.all(duesPaying.map((d) =>
        fetch("/api/payments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: d.member.id, amount: d.amount, method: bulkPayMethod, date: eventDate.split("T")[0], eventId, reference: "", notes: "" }),
        })
      ));
      setBulkSelected(new Set()); loadEvents();
    } finally { setBulkPaySubmitting(false); }
  }

  // --- WhatsApp share for event ---
  function shareEventWhatsApp(event: Event) {
    const paidMemberIds = new Set((event.payments || []).map((p) => p.member.id));
    const paidDues = event.dues.filter((d) => paidMemberIds.has(d.member.id));
    const unpaidDues = event.dues.filter((d) => !paidMemberIds.has(d.member.id));
    const totalDue = event.dues.reduce((s, d) => s + d.amount, 0);
    const totalPaid = (event.payments || []).reduce((s, p) => s + p.amount, 0);

    let msg = `*${event.name}*\n`;
    msg += `Date: ${formatDate(event.date)}\n`;
    msg += `Fee: ${formatAED(event.perHeadFee)}/head | Players: ${event.dues.length}\n`;
    msg += `Total Due: ${formatAED(totalDue)} | Collected: ${formatAED(totalPaid)}\n\n`;

    if (paidDues.length > 0) {
      msg += `*Paid (${paidDues.length}):*\n`;
      paidDues.forEach((d) => { msg += `  ${d.member.name} - ${formatAED(d.amount)}\n`; });
      msg += `\n`;
    }
    if (unpaidDues.length > 0) {
      msg += `*Unpaid (${unpaidDues.length}):*\n`;
      unpaidDues.forEach((d) => { msg += `  ${d.member.name} - ${formatAED(d.amount)}\n`; });
    }
    if (event.totalCost > 0) {
      const surplus = totalDue - event.totalCost;
      msg += `\nCost: ${formatAED(event.totalCost)} | ${surplus >= 0 ? "Surplus" : "Deficit"}: ${formatAED(Math.abs(surplus))}`;
    }

    shareText(msg);
  }

  async function shareText(text: string) {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); } catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); }
  }

  function toggleBulkSelect(memberId: string) {
    setBulkSelected((prev) => { const next = new Set(prev); if (next.has(memberId)) next.delete(memberId); else next.add(memberId); return next; });
  }

  const playingMembers = Object.entries(playerPayments).filter(([, v]) => v.playing);
  const guestCount = guestNames.filter((g) => g.trim()).length;
  const totalPlayers = playingMembers.length + guestCount;
  const paidCount = playingMembers.filter(([, v]) => v.paid).length;
  const matchCollected = totalPlayers * parseFloat(matchFee || "0");
  const matchActualCost = parseFloat(matchCost || "0");
  const matchSurplus = matchCollected - matchActualCost;
  const matchFilteredMembers = matchSearch ? members.filter((m) => m.name.toLowerCase().includes(matchSearch.toLowerCase())) : members;
  const eventFilteredMembers = eventSearch ? members.filter((m) => m.name.toLowerCase().includes(eventSearch.toLowerCase())) : members;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events & Matches</h1>
        <div className="flex gap-2 flex-wrap">
          {templates.length > 0 && (
            <select onChange={(e) => { if (e.target.value) { createFromTemplate(templates.find((t) => t.id === e.target.value)!); e.target.value = ""; } }}
              className="px-3 py-2 border border-purple-300 rounded-lg text-purple-800 font-medium text-sm bg-purple-50">
              <option value="">From Template...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <button onClick={() => { setShowMatchForm(!showMatchForm); setShowForm(false); setEditingEvent(null); if (!showMatchForm) { initAllPlayers(); setGuestNames([]); setMatchSearch(""); } }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm">
            {showMatchForm && !editingEvent ? "Cancel" : "Quick Match"}
          </button>
          <button onClick={() => { if (showForm && !editingEvent) { setShowForm(false); } else { openEventForm(); } }}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium text-sm">
            {showForm && !editingEvent ? "Cancel" : "New Event"}
          </button>
        </div>
      </div>

      {/* ========== QUICK MATCH FORM ========== */}
      {showMatchForm && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 md:p-6 mb-6">
          <h2 className="font-bold text-blue-900 text-lg mb-1">{editingEvent ? `Edit: ${editingEvent.name}` : "Log Football Match"}</h2>
          <p className="text-sm text-blue-800 mb-4">Fee: {formatAED(settings.defaultMatchFee)}/player. Select who played, mark payments.</p>
          <form onSubmit={handleCreateMatch} className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="block text-sm font-semibold text-gray-800 mb-1">Date</label><input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900" required /></div>
              <div><label className="block text-sm font-semibold text-gray-800 mb-1">Fee/Player</label><input type="number" step="0.01" value={matchFee} onChange={(e) => setMatchFee(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900" required /></div>
              <div><label className="block text-sm font-semibold text-gray-800 mb-1">Ground Cost</label><input type="number" step="0.01" value={matchCost} onChange={(e) => setMatchCost(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" /></div>
              <div><label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label><input type="text" value={matchNotes} onChange={(e) => setMatchNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" /></div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <label className="block text-sm font-bold text-gray-900">Players & Payments</label>
                <div className="flex gap-3 flex-wrap text-sm items-center">
                  {groups.length > 0 && (
                    <select onChange={(e) => { if (!e.target.value) return; const g = groups.find((x) => x.id === e.target.value); if (g) { const map: Record<string, PlayerPayment> = {}; members.forEach((m) => { map[m.id] = { playing: false, paid: false, method: "cash" }; }); g.members.forEach((gm) => { map[gm.member.id] = { playing: true, paid: false, method: "cash" }; }); setPlayerPayments(map); } e.target.value = ""; }}
                      className="text-xs px-2 py-1 border border-blue-300 rounded-lg text-blue-800 font-medium bg-blue-50">
                      <option value="">Load Group...</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members.length})</option>)}
                    </select>
                  )}
                  <button type="button" onClick={initAllPlayers} className="text-blue-700 hover:underline font-medium">All Playing</button>
                  <button type="button" onClick={() => setPlayerPayments((p) => { const u = { ...p }; Object.keys(u).forEach((id) => { u[id] = { ...u[id], playing: false, paid: false }; }); return u; })} className="text-blue-700 hover:underline font-medium">None</button>
                  <span className="text-gray-400">|</span>
                  <button type="button" onClick={markAllPaid} className="text-emerald-700 hover:underline font-medium">All Paid</button>
                  <button type="button" onClick={markAllUnpaid} className="text-gray-700 hover:underline font-medium">None Paid</button>
                </div>
              </div>
              <input type="text" value={matchSearch} onChange={(e) => setMatchSearch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-gray-900 text-sm" placeholder="Search members..." />
              <div className="bg-white rounded-lg border border-gray-200 divide-y max-h-[400px] overflow-y-auto">
                {matchFilteredMembers.map((m) => {
                  const pp = playerPayments[m.id] || { playing: false, paid: false, method: "cash" };
                  const bal = m.balance ?? 0;
                  return (
                    <div key={m.id} className={`flex items-center gap-3 px-3 py-2.5 ${pp.playing ? "bg-white" : "bg-gray-50"}`}>
                      <button type="button" onClick={() => togglePlaying(m.id)} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${pp.playing ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-300"}`}>{pp.playing ? "✓" : ""}</button>
                      <div className="flex-1 min-w-0">
                        <span className={`font-semibold text-sm truncate block ${pp.playing ? "text-gray-900" : "text-gray-400 line-through"}`}>{m.name}</span>
                        {Math.abs(bal) >= 0.01 && (
                          <span className={`text-xs font-medium ${bal > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {bal > 0 ? `Owes ${formatAED(bal)}` : `Credit ${formatAED(Math.abs(bal))}`}
                          </span>
                        )}
                      </div>
                      {pp.playing && !pp.paid && <span className="text-sm font-medium flex-shrink-0 text-gray-800">{formatAED(parseFloat(matchFee || "0"))}</span>}
                      {pp.playing && pp.paid && (
                        <input type="number" step="0.01" value={pp.customAmount ?? ""} onChange={(e) => setPlayerPayments((p) => ({ ...p, [m.id]: { ...p[m.id], customAmount: e.target.value } }))}
                          placeholder={matchFee || "0"} className="w-16 text-sm text-right px-1.5 py-1 border border-emerald-300 rounded-lg text-gray-800 font-medium flex-shrink-0" />
                      )}
                      {pp.playing && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => togglePaid(m.id)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${pp.paid ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-red-300 text-red-600"}`}>{pp.paid ? "Paid" : "Unpaid"}</button>
                          {pp.paid && (<select value={pp.method} onChange={(e) => setMethod(m.id, e.target.value)} className="text-xs px-1.5 py-1 border border-gray-300 rounded-lg text-gray-800 font-medium"><option value="cash">Cash</option><option value="bank_transfer">Bank</option></select>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2"><label className="block text-sm font-bold text-gray-900">Guest Players</label><button type="button" onClick={addGuest} className="text-sm text-blue-700 hover:underline font-medium">+ Add Guest</button></div>
              {guestNames.length > 0 && (<div className="space-y-2">{guestNames.map((g, i) => (<div key={i} className="flex items-center gap-2"><input type="text" value={g} onChange={(e) => updateGuest(i, e.target.value)} placeholder="Guest name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium text-sm" /><span className="text-sm font-medium text-gray-800 flex-shrink-0">{formatAED(parseFloat(matchFee || "0"))}</span><button type="button" onClick={() => removeGuest(i)} className="text-red-600 hover:text-red-800 text-sm font-medium flex-shrink-0">Remove</button></div>))}</div>)}
              {guestNames.length === 0 && <p className="text-sm text-gray-700">No guests. Click &quot;+ Add Guest&quot; for non-member players.</p>}
            </div>

            {totalPlayers > 0 && (
              <div className="bg-white rounded-lg border border-blue-200 p-3 md:p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div><span className="text-gray-700">Players</span><div className="font-bold text-gray-900 text-base md:text-lg">{totalPlayers}{guestCount > 0 && ` (${guestCount} guest${guestCount > 1 ? "s" : ""})`}</div></div>
                  <div><span className="text-gray-700">Total Due</span><div className="font-bold text-gray-900 text-base md:text-lg">{formatAED(matchCollected)}</div></div>
                  <div><span className="text-gray-700">Paid Now</span><div className="font-bold text-emerald-700 text-base md:text-lg">{paidCount} / {playingMembers.length}</div></div>
                  <div><span className="text-gray-700">Unpaid</span><div className="font-bold text-red-600 text-base md:text-lg">{playingMembers.length - paidCount}{guestCount > 0 ? ` + ${guestCount} guest` : ""}</div></div>
                  {matchActualCost > 0 && (<div><span className="text-gray-700">To {settings.groupName}</span><div className={`font-bold text-base md:text-lg ${matchSurplus >= 0 ? "text-emerald-700" : "text-red-600"}`}>{matchSurplus >= 0 ? `+${formatAED(matchSurplus)}` : formatAED(matchSurplus)}</div></div>)}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={totalPlayers === 0 || submitting} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm">{submitting ? "Saving..." : editingEvent ? "Update Match" : "Log Match & Payments"}</button>
              {editingEvent && <button type="button" onClick={() => { setShowMatchForm(false); setEditingEvent(null); }} className="px-4 py-2.5 text-gray-700 font-medium text-sm">Cancel</button>}
            </div>
          </form>
        </div>
      )}

      {/* ========== EVENT FORM ========== */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">{editingEvent ? `Edit: ${editingEvent.name}` : "Create Event"}</h2>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-sm font-semibold text-gray-800 mb-1">Event Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900" required /></div>
              <div><label className="block text-sm font-semibold text-gray-800 mb-1">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900" required /></div>
              <div><label className="block text-sm font-semibold text-gray-800 mb-1">Total Cost (AED)</label><input type="number" step="0.01" value={eventTotalCost} onChange={(e) => setEventTotalCost(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-gray-900" required placeholder="Auto-split among members" /></div>
            </div>
            <div><label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" placeholder="Optional" /></div>
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2"><label className="block text-sm font-bold text-gray-900">Attending Members</label><div className="flex gap-2 items-center">
                {groups.length > 0 && (
                  <select onChange={(e) => { if (!e.target.value) return; const g = groups.find((x) => x.id === e.target.value); if (g) setSelectedMembers(g.members.map((gm) => gm.member.id)); e.target.value = ""; }}
                    className="text-xs px-2 py-1 border border-emerald-300 rounded-lg text-emerald-800 font-medium bg-emerald-50">
                    <option value="">Load Group...</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members.length})</option>)}
                  </select>
                )}
                <button type="button" onClick={() => setSelectedMembers(members.map((m) => m.id))} className="text-sm text-emerald-700 hover:underline font-medium">All</button><button type="button" onClick={() => setSelectedMembers([])} className="text-sm text-gray-700 hover:underline font-medium">None</button></div></div>
              <input type="text" value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 text-gray-900 text-sm" placeholder="Search members..." />
              <div className="flex flex-wrap gap-2">{eventFilteredMembers.map((m) => {
                const bal = m.balance ?? 0;
                const hasBal = Math.abs(bal) >= 0.01;
                return (
                  <label key={m.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium ${selectedMembers.includes(m.id) ? "bg-emerald-50 border-emerald-400 text-emerald-900" : "bg-gray-50 border-gray-300 text-gray-600"}`}>
                    <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={() => setSelectedMembers((p) => p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id])} className="sr-only" />
                    <span>{m.name}</span>
                    {hasBal && (
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${bal > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {bal > 0 ? `-${formatAED(bal)}` : `+${formatAED(Math.abs(bal))}`}
                      </span>
                    )}
                  </label>
                );
              })}</div>
              {selectedMembers.length > 0 && eventTotalCost && (<p className="text-sm text-gray-800 mt-2 font-medium">{selectedMembers.length} members — {formatAED(eventPerHead)} per head</p>)}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={selectedMembers.length === 0 || submitting} className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold text-sm">{submitting ? "Saving..." : editingEvent ? "Update Event" : "Create Event"}</button>
              {editingEvent && <button type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }} className="px-4 py-2.5 text-gray-700 font-medium text-sm">Cancel</button>}
            </div>
          </form>
        </div>
      )}

      {/* ========== EVENTS LIST WITH EXPANDABLE DETAIL ========== */}
      <div className="space-y-4">
        {events.map((event) => {
          const paidMemberIds = new Set((event.payments || []).map((p) => p.member.id));
          const paidDues = event.dues.filter((d) => paidMemberIds.has(d.member.id));
          const unpaidDues = event.dues.filter((d) => !paidMemberIds.has(d.member.id));
          const totalDue = event.dues.reduce((s, d) => s + d.amount, 0);
          const totalPaid = (event.payments || []).reduce((s, p) => s + p.amount, 0);
          const isExpanded = expandedEvent === event.id;

          return (
            <div key={event.id} className={`bg-white rounded-xl shadow-sm border ${event.type === "match" ? "border-l-4 border-l-blue-500" : ""}`}>
              {/* Header */}
              <div className="px-4 md:px-6 py-3 md:py-4 border-b flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpandedEvent(isExpanded ? null : event.id)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">{event.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${event.type === "match" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>{event.type === "match" ? "Match" : "Event"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${unpaidDues.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {paidDues.length}/{event.dues.length} paid
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1">
                    {formatDate(event.date)} — {formatAED(event.perHeadFee)}/head — {event.dues.length} {event.type === "match" ? "players" : "members"}
                    {event.totalCost > 0 && (<> — Cost: {formatAED(event.totalCost)}</>)}
                  </p>
                  {event.notes && <p className="text-sm text-gray-700 mt-1">{event.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-400 text-sm">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-4 md:px-6 py-4 space-y-4">
                  {/* Collection Summary */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-600">Total Due</span><div className="font-bold text-gray-900">{formatAED(totalDue)}</div></div>
                    <div className="bg-emerald-50 rounded-lg p-3"><span className="text-gray-600">Collected</span><div className="font-bold text-emerald-700">{formatAED(totalPaid)}</div></div>
                    <div className="bg-red-50 rounded-lg p-3"><span className="text-gray-600">Outstanding</span><div className="font-bold text-red-600">{formatAED(totalDue - totalPaid)}</div></div>
                  </div>

                  {/* Paid Members */}
                  {paidDues.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-emerald-700 mb-2">Paid ({paidDues.length})</h4>
                      <div className="space-y-1">
                        {paidDues.map((d) => {
                          const memberPayments = (event.payments || []).filter((p) => p.member.id === d.member.id);
                          const paidAmount = memberPayments.reduce((s, p) => s + p.amount, 0);
                          const payment = memberPayments[0];
                          return (
                            <div key={d.id} className="flex items-center justify-between bg-emerald-50 rounded-lg px-3 py-2">
                              <span className="text-sm font-medium text-gray-900">{d.member.name}{d.member.isGuest ? " (guest)" : ""}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-emerald-700">{formatAED(paidAmount)}</span>
                                {paidAmount !== d.amount && <span className="text-xs text-gray-500">(due: {formatAED(d.amount)})</span>}
                                {payment && <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${payment.method === "cash" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{payment.method === "cash" ? "Cash" : "Bank"}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unpaid Members with inline payment + bulk select */}
                  {unpaidDues.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-red-600">Unpaid ({unpaidDues.length})</h4>
                        {unpaidDues.length > 1 && (
                          <button onClick={() => { if (bulkSelected.size > 0) setBulkSelected(new Set()); else setBulkSelected(new Set(unpaidDues.map((d) => d.member.id))); }}
                            className="text-xs text-blue-700 font-medium hover:underline">{bulkSelected.size > 0 ? "Deselect All" : "Select All"}</button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {unpaidDues.map((d) => (
                          <div key={d.id} className="bg-red-50 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={bulkSelected.has(d.member.id)} onChange={() => toggleBulkSelect(d.member.id)} className="rounded text-emerald-600" />
                                <span className="text-sm font-medium text-gray-900">{d.member.name}{d.member.isGuest ? " (guest)" : ""}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-red-600">{formatAED(d.amount)}</span>
                                {inlinePayMemberId === d.member.id ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <input type="number" step="0.01" value={inlinePayAmount} onChange={(e) => setInlinePayAmount(e.target.value)}
                                      placeholder={String(d.amount)} className="w-16 text-xs px-1.5 py-1 border rounded-lg text-gray-800 text-right" />
                                    <select value={inlinePayMethod} onChange={(e) => setInlinePayMethod(e.target.value)} className="text-xs px-1.5 py-1 border rounded-lg text-gray-800">
                                      <option value="cash">Cash</option>
                                      <option value="bank_transfer">Bank</option>
                                    </select>
                                    <button disabled={inlinePaySubmitting} onClick={() => recordInlinePayment(event.id, d.member.id, d.amount, event.date)} className="bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50">{inlinePaySubmitting ? "..." : "Pay"}</button>
                                    <button onClick={() => { setInlinePayMemberId(null); setInlinePayAmount(""); }} className="text-gray-500 text-xs px-1.5 py-1">X</button>
                                  </div>
                                ) : (
                                  <button onClick={() => { setInlinePayMemberId(d.member.id); setInlinePayMethod("cash"); setInlinePayAmount(""); }} className="bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-lg font-semibold">Mark Paid</button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {bulkSelected.size > 0 && (
                        <div className="flex items-center gap-2 mt-2 bg-blue-50 rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-gray-800">{bulkSelected.size} selected</span>
                          <select value={bulkPayMethod} onChange={(e) => setBulkPayMethod(e.target.value)} className="text-xs px-1.5 py-1 border rounded-lg text-gray-800">
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">Bank</option>
                          </select>
                          <button disabled={bulkPaySubmitting} onClick={() => recordBulkPayment(event.id, unpaidDues, event.date)}
                            className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50">{bulkPaySubmitting ? "Saving..." : `Mark ${bulkSelected.size} Paid`}</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <button onClick={(e) => { e.stopPropagation(); shareEventWhatsApp(event); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1.5">
                      <span>Share WhatsApp</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); event.type === "match" ? openMatchEdit(event) : openEventEdit(event); }} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-200">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200">Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {events.length === 0 && <div className="text-center text-gray-600 py-12 font-medium">No events or matches yet.</div>}
      </div>
    </div>
  );
}
