"use client";

import { useEffect, useState } from "react";
import { formatAED, formatDate } from "@/lib/format";

interface Member { id: string; name: string; isGuest?: boolean }
interface EventDue { id: string; amount: number; paid: boolean; member: Member }
interface Event { id: string; name: string; type: string; date: string; perHeadFee: number; totalCost: number; notes: string; dues: EventDue[] }
interface Settings { defaultMatchFee: number; groupName: string }
interface PlayerPayment { playing: boolean; paid: boolean; method: string }

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>({ defaultMatchFee: 20, groupName: "Company" });
  const [showForm, setShowForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Event form
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventTotalCost, setEventTotalCost] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Quick Match state
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [matchFee, setMatchFee] = useState("");
  const [matchCost, setMatchCost] = useState("");
  const [matchNotes, setMatchNotes] = useState("");
  const [playerPayments, setPlayerPayments] = useState<Record<string, PlayerPayment>>({});
  const [guestNames, setGuestNames] = useState<string[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  function loadAll() {
    loadEvents();
    fetch("/api/members").then((r) => r.json()).then((m) => {
      setMembers(m.filter((x: Member & { active: boolean }) => x.active));
    });
    fetch("/api/settings").then((r) => r.json()).then((s) => {
      setSettings(s);
      setMatchFee(String(s.defaultMatchFee || 20));
    });
  }

  async function loadEvents() {
    setEvents(await (await fetch("/api/events")).json());
  }

  // --- Player payment helpers ---
  function initAllPlayers() {
    const map: Record<string, PlayerPayment> = {};
    members.forEach((m) => { map[m.id] = { playing: true, paid: false, method: "cash" }; });
    setPlayerPayments(map);
  }
  function togglePlaying(id: string) {
    setPlayerPayments((p) => ({ ...p, [id]: { ...p[id], playing: !p[id]?.playing, paid: p[id]?.playing ? false : p[id]?.paid } }));
  }
  function togglePaid(id: string) {
    setPlayerPayments((p) => ({ ...p, [id]: { ...p[id], paid: !p[id]?.paid } }));
  }
  function setMethod(id: string, m: string) {
    setPlayerPayments((p) => ({ ...p, [id]: { ...p[id], method: m } }));
  }
  function markAllPaid() {
    setPlayerPayments((p) => {
      const u = { ...p }; Object.keys(u).forEach((id) => { if (u[id].playing) u[id] = { ...u[id], paid: true }; }); return u;
    });
  }
  function markAllUnpaid() {
    setPlayerPayments((p) => {
      const u = { ...p }; Object.keys(u).forEach((id) => { u[id] = { ...u[id], paid: false }; }); return u;
    });
  }

  // --- Guest helpers ---
  function addGuest() { setGuestNames([...guestNames, ""]); }
  function updateGuest(i: number, v: string) { const g = [...guestNames]; g[i] = v; setGuestNames(g); }
  function removeGuest(i: number) { setGuestNames(guestNames.filter((_, j) => j !== i)); }

  // --- Event form (auto-split) ---
  function openEventForm() { setShowForm(true); setShowMatchForm(false); setEditingEvent(null); setName(""); setEventTotalCost(""); setNotes(""); setSelectedMembers(members.map((m) => m.id)); setDate(new Date().toISOString().split("T")[0]); }
  function openEventEdit(ev: Event) {
    setEditingEvent(ev); setShowForm(true); setShowMatchForm(false);
    setName(ev.name); setDate(ev.date.split("T")[0]); setEventTotalCost(String(ev.totalCost || ev.perHeadFee * ev.dues.length)); setNotes(ev.notes);
    setSelectedMembers(ev.dues.map((d) => d.member.id));
  }
  function openMatchEdit(ev: Event) {
    setEditingEvent(ev); setShowMatchForm(true); setShowForm(false);
    setMatchDate(ev.date.split("T")[0]); setMatchFee(String(ev.perHeadFee)); setMatchCost(String(ev.totalCost || "")); setMatchNotes(ev.notes);
    const map: Record<string, PlayerPayment> = {};
    members.forEach((m) => { map[m.id] = { playing: false, paid: false, method: "cash" }; });
    ev.dues.forEach((d) => { map[d.member.id] = { playing: true, paid: false, method: "cash" }; });
    setPlayerPayments(map);
    setGuestNames([]);
  }

  const eventPerHead = selectedMembers.length > 0 && eventTotalCost ? parseFloat(eventTotalCost) / selectedMembers.length : 0;

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    const total = parseFloat(eventTotalCost);
    const perHead = Math.round((total / selectedMembers.length) * 100) / 100;

    if (editingEvent) {
      await fetch(`/api/events/${editingEvent.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, perHeadFee: perHead, totalCost: total, notes, memberIds: selectedMembers }),
      });
    } else {
      await fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, date, perHeadFee: perHead, totalCost: total, notes, memberIds: selectedMembers, type: "event" }),
      });
    }
    setShowForm(false); setEditingEvent(null); loadEvents();
  }

  async function handleCreateMatch(e: React.FormEvent) {
    e.preventDefault();
    const fee = parseFloat(matchFee);
    const playingIds = Object.entries(playerPayments).filter(([, v]) => v.playing).map(([id]) => id);
    const paidPlayers = Object.entries(playerPayments).filter(([, v]) => v.playing && v.paid).map(([id, v]) => ({ memberId: id, amount: fee, method: v.method }));
    const cost = parseFloat(matchCost || "0");
    const collected = fee * (playingIds.length + guestNames.filter((g) => g.trim()).length);
    const surplus = collected - cost;

    if (editingEvent) {
      await fetch(`/api/events/${editingEvent.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingEvent.name, date: matchDate, perHeadFee: fee, totalCost: cost, notes: matchNotes, memberIds: playingIds, guestNames: guestNames.filter((g) => g.trim()) }),
      });
    } else {
      await fetch("/api/events", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Football Match", date: matchDate, perHeadFee: fee, totalCost: cost,
          notes: matchNotes || (surplus > 0 ? `Surplus ${formatAED(surplus)} to ${settings.groupName} fund` : ""),
          memberIds: playingIds, type: "match", payments: paidPlayers,
          guestNames: guestNames.filter((g) => g.trim()),
        }),
      });
    }
    setShowMatchForm(false); setEditingEvent(null); setGuestNames([]); loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event and all its dues?")) return;
    await fetch(`/api/events/${id}`, { method: "DELETE" }); loadEvents();
  }

  const playingMembers = Object.entries(playerPayments).filter(([, v]) => v.playing);
  const guestCount = guestNames.filter((g) => g.trim()).length;
  const totalPlayers = playingMembers.length + guestCount;
  const paidCount = playingMembers.filter(([, v]) => v.paid).length;
  const matchCollected = totalPlayers * parseFloat(matchFee || "0");
  const matchActualCost = parseFloat(matchCost || "0");
  const matchSurplus = matchCollected - matchActualCost;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events & Matches</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowMatchForm(!showMatchForm); setShowForm(false); setEditingEvent(null); if (!showMatchForm) { initAllPlayers(); setGuestNames([]); } }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
            {showMatchForm && !editingEvent ? "Cancel" : "Quick Match"}
          </button>
          <button onClick={() => { if (showForm && !editingEvent) { setShowForm(false); } else { openEventForm(); } }}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium">
            {showForm && !editingEvent ? "Cancel" : "New Event"}
          </button>
        </div>
      </div>

      {/* ========== QUICK MATCH FORM ========== */}
      {showMatchForm && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
          <h2 className="font-bold text-blue-900 text-lg mb-1">{editingEvent ? `Edit: ${editingEvent.name}` : "Log Football Match"}</h2>
          <p className="text-sm text-blue-800 mb-4">
            Fee: {formatAED(settings.defaultMatchFee)}/player. Select who played, mark payments — all in one go.
          </p>
          <form onSubmit={handleCreateMatch} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Date</label>
                <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Fee Per Player (AED)</label>
                <input type="number" step="0.01" value={matchFee} onChange={(e) => setMatchFee(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Ground Cost (AED)</label>
                <input type="number" step="0.01" value={matchCost} onChange={(e) => setMatchCost(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
                <input type="text" value={matchNotes} onChange={(e) => setMatchNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional" />
              </div>
            </div>

            {/* Players with inline payment */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-gray-900">Players & Payments</label>
                <div className="flex gap-3 flex-wrap">
                  <button type="button" onClick={initAllPlayers} className="text-sm text-blue-700 hover:underline font-medium">All Playing</button>
                  <button type="button" onClick={() => setPlayerPayments((p) => { const u = { ...p }; Object.keys(u).forEach((id) => { u[id] = { ...u[id], playing: false, paid: false }; }); return u; })} className="text-sm text-blue-700 hover:underline font-medium">None</button>
                  <span className="text-gray-300">|</span>
                  <button type="button" onClick={markAllPaid} className="text-sm text-emerald-700 hover:underline font-medium">All Paid</button>
                  <button type="button" onClick={markAllUnpaid} className="text-sm text-gray-700 hover:underline font-medium">None Paid</button>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 divide-y">
                {members.map((m) => {
                  const pp = playerPayments[m.id] || { playing: false, paid: false, method: "cash" };
                  return (
                    <div key={m.id} className={`flex items-center gap-4 px-4 py-3 ${pp.playing ? "bg-white" : "bg-gray-50"}`}>
                      <button type="button" onClick={() => togglePlaying(m.id)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${pp.playing ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-300"}`}>
                        {pp.playing ? "✓" : ""}
                      </button>
                      <span className={`flex-1 font-semibold ${pp.playing ? "text-gray-900" : "text-gray-400 line-through"}`}>{m.name}</span>
                      <span className={`text-sm font-medium w-24 text-right ${pp.playing ? "text-gray-800" : "text-gray-400"}`}>
                        {pp.playing ? formatAED(parseFloat(matchFee || "0")) : "-"}
                      </span>
                      {pp.playing && (
                        <>
                          <button type="button" onClick={() => togglePaid(m.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${pp.paid ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-red-300 text-red-600"}`}>
                            {pp.paid ? "Paid ✓" : "Unpaid"}
                          </button>
                          {pp.paid && (
                            <select value={pp.method} onChange={(e) => setMethod(m.id, e.target.value)}
                              className="text-sm px-2 py-1.5 border border-gray-300 rounded-lg text-gray-800 font-medium">
                              <option value="cash">Cash</option>
                              <option value="bank_transfer">Bank</option>
                            </select>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Guest Players */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-900">Guest Players (non-members)</label>
                <button type="button" onClick={addGuest} className="text-sm text-blue-700 hover:underline font-medium">+ Add Guest</button>
              </div>
              {guestNames.length > 0 && (
                <div className="space-y-2">
                  {guestNames.map((g, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input type="text" value={g} onChange={(e) => updateGuest(i, e.target.value)} placeholder="Guest name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium" />
                      <span className="text-sm font-medium text-gray-800 w-24 text-right">{formatAED(parseFloat(matchFee || "0"))}</span>
                      <button type="button" onClick={() => removeGuest(i)} className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              {guestNames.length === 0 && <p className="text-sm text-gray-500">No guests. Click &quot;+ Add Guest&quot; for non-member players.</p>}
            </div>

            {/* Summary */}
            {totalPlayers > 0 && (
              <div className="bg-white rounded-lg border border-blue-200 p-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div><span className="text-gray-600">Players</span><div className="font-bold text-gray-900 text-lg">{totalPlayers}{guestCount > 0 && ` (${guestCount} guest${guestCount > 1 ? "s" : ""})`}</div></div>
                  <div><span className="text-gray-600">Total Due</span><div className="font-bold text-gray-900 text-lg">{formatAED(matchCollected)}</div></div>
                  <div><span className="text-gray-600">Paid Now</span><div className="font-bold text-emerald-700 text-lg">{paidCount} / {playingMembers.length}</div></div>
                  <div><span className="text-gray-600">Unpaid</span><div className="font-bold text-red-600 text-lg">{playingMembers.length - paidCount}{guestCount > 0 ? ` + ${guestCount} guest` : ""}</div></div>
                  {matchActualCost > 0 && (
                    <div><span className="text-gray-600">To {settings.groupName}</span><div className={`font-bold text-lg ${matchSurplus >= 0 ? "text-emerald-700" : "text-red-600"}`}>{matchSurplus >= 0 ? `+${formatAED(matchSurplus)}` : formatAED(matchSurplus)}</div></div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={totalPlayers === 0} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold">
                {editingEvent ? "Update Match" : "Log Match & Payments"}
              </button>
              {editingEvent && <button type="button" onClick={() => { setShowMatchForm(false); setEditingEvent(null); }} className="px-4 py-2.5 text-gray-700 font-medium">Cancel</button>}
            </div>
          </form>
        </div>
      )}

      {/* ========== EVENT FORM (auto-split) ========== */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">{editingEvent ? `Edit: ${editingEvent.name}` : "Create Event"}</h2>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Event Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Total Cost (AED)</label>
                <input type="number" step="0.01" value={eventTotalCost} onChange={(e) => setEventTotalCost(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required placeholder="Will be split among members" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-900">Attending Members</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedMembers(members.map((m) => m.id))} className="text-sm text-emerald-700 hover:underline font-medium">All</button>
                  <button type="button" onClick={() => setSelectedMembers([])} className="text-sm text-gray-700 hover:underline font-medium">None</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <label key={m.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm font-medium ${selectedMembers.includes(m.id) ? "bg-emerald-50 border-emerald-400 text-emerald-900" : "bg-gray-50 border-gray-300 text-gray-500"}`}>
                    <input type="checkbox" checked={selectedMembers.includes(m.id)} onChange={() => setSelectedMembers((p) => p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id])} className="sr-only" />
                    {m.name}
                  </label>
                ))}
              </div>
              {selectedMembers.length > 0 && eventTotalCost && (
                <p className="text-sm text-gray-800 mt-2 font-medium">
                  {selectedMembers.length} members — {formatAED(eventPerHead)} per head (auto-split from {formatAED(parseFloat(eventTotalCost))})
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={selectedMembers.length === 0} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
                {editingEvent ? "Update Event" : "Create Event"}
              </button>
              {editingEvent && <button type="button" onClick={() => { setShowForm(false); setEditingEvent(null); }} className="px-4 py-2.5 text-gray-700 font-medium">Cancel</button>}
            </div>
          </form>
        </div>
      )}

      {/* ========== EVENTS LIST ========== */}
      <div className="space-y-4">
        {events.map((event) => {
          const collected = event.dues.reduce((s, d) => s + d.amount, 0);
          const surplus = event.totalCost > 0 ? collected - event.totalCost : 0;
          return (
            <div key={event.id} className={`bg-white rounded-xl shadow-sm border ${event.type === "match" ? "border-l-4 border-l-blue-500" : ""}`}>
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{event.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${event.type === "match" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {event.type === "match" ? "Match" : "Event"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">
                    {formatDate(event.date)} — {formatAED(event.perHeadFee)}/head — {event.dues.length} {event.type === "match" ? "players" : "members"}
                    {event.totalCost > 0 && (<> — Cost: {formatAED(event.totalCost)} — Surplus: <span className={`font-semibold ${surplus >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatAED(surplus)}</span></>)}
                  </p>
                  {event.notes && <p className="text-sm text-gray-600 mt-1">{event.notes}</p>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => event.type === "match" ? openMatchEdit(event) : openEventEdit(event)} className="text-blue-700 hover:text-blue-900 text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(event.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                </div>
              </div>
              <div className="px-6 py-3">
                <div className="flex flex-wrap gap-2">
                  {event.dues.map((due) => (
                    <span key={due.id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${due.member.isGuest ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-800"}`}>
                      {due.member.name}{due.member.isGuest ? " (guest)" : ""}: {formatAED(due.amount)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {events.length === 0 && <div className="text-center text-gray-500 py-12 font-medium">No events or matches yet.</div>}
      </div>
    </div>
  );
}
