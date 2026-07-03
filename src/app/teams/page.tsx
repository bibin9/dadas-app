"use client";

import { useEffect, useState, useCallback } from "react";
import PasteTeamList from "@/components/PasteTeamList";

interface Member {
  id: string;
  name: string;
  active: boolean;
}

// Public page only ever receives non-rating fields from the server.
interface PlayerSkill {
  memberId: string;
  isCaptain: boolean;
}

interface PlayerEntry {
  id: string;
  name: string;
  isGuest: boolean;
  isCaptain?: boolean;
}

interface TeamResult {
  teamA: PlayerEntry[];
  teamB: PlayerEntry[];
}

interface GuestPlayer {
  name: string;
  skillTier: string;
  ageGroup: string;
  position: string;
  ballControl: string;
  runningSpeed: string;
}

const SKILL_TIERS = [
  { value: "legend", label: "Legend", color: "bg-purple-600 text-white" },
  { value: "master", label: "Master", color: "bg-red-600 text-white" },
  { value: "gold", label: "Gold", color: "bg-amber-500 text-white" },
  { value: "silver", label: "Silver", color: "bg-gray-400 text-white" },
  { value: "bronze", label: "Bronze", color: "bg-orange-600 text-white" },
  { value: "starter", label: "Starter", color: "bg-green-600 text-white" },
];

const BALL_CONTROL_OPTIONS = [
  { value: "no", label: "No (-0.75)" },
  { value: "less", label: "Less (-0.5)" },
  { value: "ok", label: "Ok (0)" },
  { value: "good", label: "Good (+0.5)" },
  { value: "verygood", label: "Very Good (+1)" },
];

const SPEED_OPTIONS = [
  { value: "slow", label: "Slow (-0.5)" },
  { value: "medium", label: "Medium (0)" },
  { value: "fast", label: "Fast (+0.5)" },
];

const AGE_GROUPS = [
  { value: "under30", label: "Under 30" },
  { value: "age30to40", label: "30–40" },
  { value: "age40to50", label: "40–50" },
  { value: "over50", label: "Above 50" },
];

const POSITIONS = [
  { value: "any", label: "Any (utility)" },
  { value: "goalkeeper", label: "GK" },
  { value: "cb", label: "CB (Centre Back)" },
  { value: "lb", label: "LB (Left Back)" },
  { value: "rb", label: "RB (Right Back)" },
  { value: "lwb", label: "LWB (Left Wing-Back)" },
  { value: "rwb", label: "RWB (Right Wing-Back)" },
  { value: "defender", label: "DEF (any defender)" },
  { value: "cdm", label: "CDM (Defensive Mid / Mid-Back)" },
  { value: "cm", label: "CM (Central Mid)" },
  { value: "cam", label: "CAM (Attacking Mid / Fwd-Mid)" },
  { value: "lm", label: "LM/LW (Left)" },
  { value: "rm", label: "RM/RW (Right)" },
  { value: "midfielder", label: "MID (any midfielder)" },
  { value: "st", label: "ST (Striker)" },
  { value: "cf", label: "CF (Centre Forward)" },
  { value: "ss", label: "SS (Second Striker)" },
  { value: "forward", label: "FWD (any forward)" },
];

const JERSEY_COLORS = [
  { name: "White", bg: "bg-white", border: "border-gray-300", text: "text-gray-900", headerBg: "bg-gray-100", headerText: "text-gray-900", footerBg: "bg-gray-50", footerText: "text-gray-800", emoji: "🤍" },
  { name: "Black", bg: "bg-gray-900", border: "border-gray-700", text: "text-white", headerBg: "bg-black", headerText: "text-white", footerBg: "bg-gray-800", footerText: "text-gray-100", emoji: "🖤" },
  { name: "Red", bg: "bg-white", border: "border-red-300", text: "text-gray-900", headerBg: "bg-red-600", headerText: "text-white", footerBg: "bg-red-50", footerText: "text-red-800", emoji: "❤️" },
  { name: "Blue", bg: "bg-white", border: "border-blue-300", text: "text-gray-900", headerBg: "bg-blue-600", headerText: "text-white", footerBg: "bg-blue-50", footerText: "text-blue-800", emoji: "💙" },
  { name: "Green", bg: "bg-white", border: "border-green-300", text: "text-gray-900", headerBg: "bg-green-600", headerText: "text-white", footerBg: "bg-green-50", footerText: "text-green-800", emoji: "💚" },
  { name: "Yellow", bg: "bg-white", border: "border-yellow-300", text: "text-gray-900", headerBg: "bg-yellow-500", headerText: "text-gray-900", footerBg: "bg-yellow-50", footerText: "text-yellow-800", emoji: "💛" },
];

function getRandomJerseyPair(): [number, number] {
  const count = JERSEY_COLORS.length;
  const a = Math.floor(Math.random() * count);
  let b = Math.floor(Math.random() * (count - 1));
  if (b >= a) b++;
  return [a, b];
}

function getSkillBadge(tier: string) {
  const t = SKILL_TIERS.find((s) => s.value === tier) || SKILL_TIERS[3];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${t.color}`}>
      {t.label}
    </span>
  );
}

export default function PublicTeamsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [skills, setSkills] = useState<Record<string, PlayerSkill>>({});
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [savedGuests, setSavedGuests] = useState<{ id: string; name: string }[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestTier, setGuestTier] = useState("silver");
  const [guestAge, setGuestAge] = useState("age30to40");
  const [guestPosition, setGuestPosition] = useState("any");
  const [guestBall, setGuestBall] = useState("ok");
  const [guestSpeed, setGuestSpeed] = useState("medium");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TeamResult | null>(null);
  const [jerseyA, setJerseyA] = useState(0);
  const [jerseyB, setJerseyB] = useState(2);
  const [swapPick, setSwapPick] = useState<string | null>(null);
  const [autoCaptain, setAutoCaptain] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/team-balancer/public-data");
    const data = await res.json();
    setMembers((data.members as Member[]).filter((m) => m.active));
    setSavedGuests((data.guests as { id: string; name: string }[]) || []);
    const skillMap: Record<string, PlayerSkill> = {};
    (data.skills as PlayerSkill[]).forEach((s) => { skillMap[s.memberId] = s; });
    setSkills(skillMap);
    setLoading(false);
  }

  const totalPlayers = selectedIds.size + guests.length;

  const doGenerate = useCallback(async (ids: Set<string>, guestList: GuestPlayer[], autoCaptainFlag: boolean) => {
    if (ids.size + guestList.length < 2) {
      setResult(null);
      return;
    }
    setGenerating(true);
    const res = await fetch("/api/team-balancer/generate-public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerIds: Array.from(ids),
        guestPlayers: guestList,
        autoCaptain: autoCaptainFlag,
      }),
    });
    const data = await res.json();
    setResult({ teamA: data.teamA || [], teamB: data.teamB || [] });
    const [a, b] = getRandomJerseyPair();
    setJerseyA(a);
    setJerseyB(b);
    setSwapPick(null);
    setGenerating(false);
  }, []);

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      doGenerate(next, guests, autoCaptain);
      return next;
    });
  }

  function toggleAll() {
    const allSelected = selectedIds.size === members.length;
    const next = allSelected ? new Set<string>() : new Set(members.map((m) => m.id));
    setSelectedIds(next);
    doGenerate(next, guests, autoCaptain);
  }

  function addGuest() {
    if (!guestName.trim()) return;
    const newGuests = [...guests, { name: guestName.trim(), skillTier: guestTier, ageGroup: guestAge, position: guestPosition, ballControl: guestBall, runningSpeed: guestSpeed }];
    setGuests(newGuests);
    setGuestName("");
    setGuestTier("silver");
    setGuestAge("age30to40");
    setGuestPosition("any");
    setGuestBall("ok");
    setGuestSpeed("medium");
    doGenerate(selectedIds, newGuests, autoCaptain);
  }

  function removeGuest(i: number) {
    const newGuests = guests.filter((_, idx) => idx !== i);
    setGuests(newGuests);
    doGenerate(selectedIds, newGuests, autoCaptain);
  }

  function shuffleTeams() {
    doGenerate(selectedIds, guests, autoCaptain);
  }

  function swapPlayers(idA: string, idB: string) {
    if (!result) return;
    const a = result.teamA.find((p) => p.id === idA);
    const b = result.teamB.find((p) => p.id === idB);
    if (!a || !b) return;
    const newA = result.teamA.map((p) => (p.id === idA ? b : p));
    const newB = result.teamB.map((p) => (p.id === idB ? a : p));
    setResult({ teamA: newA, teamB: newB });
    setSwapPick(null);
  }

  function pickForSwap(side: "A" | "B", id: string) {
    const key = `${side}:${id}`;
    if (swapPick === key) { setSwapPick(null); return; }
    if (swapPick && swapPick.startsWith(side === "A" ? "B:" : "A:")) {
      const otherId = swapPick.slice(2);
      if (side === "A") swapPlayers(id, otherId);
      else swapPlayers(otherId, id);
      return;
    }
    setSwapPick(key);
  }

  async function shareWhatsApp() {
    if (!result) return;
    const colorA = JERSEY_COLORS[jerseyA];
    const colorB = JERSEY_COLORS[jerseyB];
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const aSorted = [...result.teamA].sort((p, q) => p.name.localeCompare(q.name));
    const bSorted = [...result.teamB].sort((p, q) => p.name.localeCompare(q.name));
    const fmt = (p: PlayerEntry, i: number) =>
      `${i + 1}. ${p.isCaptain ? "© " : ""}${p.name}${p.isGuest ? " (Guest)" : ""}`;
    const text = `⚽ *DADAS FC - Team Sheet*\n📅 ${dateStr}\n\n${colorA.emoji} *${colorA.name} Jersey*\n${aSorted.map(fmt).join("\n")}\n\n${colorB.emoji} *${colorB.name} Jersey*\n${bSorted.map(fmt).join("\n")}\n\n👥 ${result.teamA.length} vs ${result.teamB.length} players`;
    if (navigator.share) {
      try { await navigator.share({ title: "DADAS FC Team Sheet", text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    }
  }

  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">⚽ Team Maker</h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-800">⚽ DADAS FC — Team Maker</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">Pick the players who turned up and tap to build balanced teams. Share the result on WhatsApp.</p>

        {/* Player count badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${
              totalPlayers >= 2 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
            }`}>
              👥 {totalPlayers} Player{totalPlayers !== 1 ? "s" : ""} Selected
              {totalPlayers >= 2 && <span className="text-xs font-normal">({Math.floor(totalPlayers / 2)} vs {Math.ceil(totalPlayers / 2)})</span>}
            </span>
            {guests.length > 0 && (
              <span className="text-xs text-gray-500">({guests.length} guest{guests.length !== 1 ? "s" : ""})</span>
            )}
          </div>
          <button
            onClick={toggleAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50"
          >
            {selectedIds.size === members.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        {/* Auto-pick captains toggle */}
        {(() => {
          const flaggedPlaying = sortedMembers.filter((m) => selectedIds.has(m.id) && skills[m.id]?.isCaptain).length;
          return (
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-3 cursor-pointer select-none flex-wrap">
              <input
                type="checkbox"
                checked={autoCaptain}
                onChange={(e) => { setAutoCaptain(e.target.checked); doGenerate(selectedIds, guests, e.target.checked); }}
                className="rounded text-amber-600"
              />
              <span><strong>©</strong> Auto-pick 2 captains randomly from flagged captains</span>
              <span className="text-xs text-gray-500">
                — {flaggedPlaying} flagged captain{flaggedPlaying === 1 ? "" : "s"} playing.
              </span>
            </label>
          );
        })()}

        {/* Paste WhatsApp list → auto-select matched players */}
        <PasteTeamList
          candidates={[...members, ...savedGuests].map((m) => ({ id: m.id, name: m.name }))}
          onApply={(ids) => {
            const next = new Set(ids);
            setSelectedIds(next);
            doGenerate(next, guests, autoCaptain);
          }}
        />

        {/* Player selection grid */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[350px] overflow-y-auto">
            {sortedMembers.map((m) => {
              const s = skills[m.id];
              const isSelected = selectedIds.has(m.id);
              const isCaptain = !!s?.isCaptain;
              return (
                <button
                  key={m.id}
                  onClick={() => togglePlayer(m.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all relative ${
                    isSelected
                      ? "bg-blue-50 border-2 border-blue-400 shadow-sm"
                      : "bg-gray-50 border-2 border-transparent hover:border-gray-200"
                  }`}
                >
                  {isCaptain && <span className="absolute top-1 right-1 text-[10px] bg-amber-200 text-amber-900 font-bold px-1 rounded">©</span>}
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {isSelected ? "✓" : m.name.charAt(0)}
                  </span>
                  <span className="text-xs font-medium text-gray-800 truncate w-full">{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Guest players */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">➕ Add Guest Players</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
              <input
                type="text"
                placeholder="Guest name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addGuest(); }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <select value={guestTier} onChange={(e) => setGuestTier(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white">
              {SKILL_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={guestAge} onChange={(e) => setGuestAge(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white">
              {AGE_GROUPS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <select value={guestPosition} onChange={(e) => setGuestPosition(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white" title="Position">
              {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={guestBall} onChange={(e) => setGuestBall(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white" title="Ball control">
              {BALL_CONTROL_OPTIONS.map((b) => <option key={b.value} value={b.value}>⚽ {b.label}</option>)}
            </select>
            <select value={guestSpeed} onChange={(e) => setGuestSpeed(e.target.value)} className="border rounded-lg px-2 py-2 text-sm bg-white" title="Running speed">
              {SPEED_OPTIONS.map((s) => <option key={s.value} value={s.value}>🏃 {s.label}</option>)}
            </select>
            <button
              onClick={addGuest}
              disabled={!guestName.trim()}
              className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#243556] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Guest
            </button>
          </div>
          {guests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {guests.map((g, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full pl-3 pr-1.5 py-1 text-sm">
                  <span className="font-medium text-gray-700">{g.name}</span>
                  {getSkillBadge(g.skillTier)}
                  {g.position !== "any" && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                      {POSITIONS.find((p) => p.value === g.position)?.label || g.position}
                    </span>
                  )}
                  <button
                    onClick={() => removeGuest(i)}
                    className="w-5 h-5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center text-xs font-bold ml-1"
                  >×</button>
                </span>
              ))}
            </div>
          )}

          {/* Saved (reusable) guests — tap to include in this match */}
          {savedGuests.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">⭐ Saved guests — tap to add</h4>
              <div className="flex flex-wrap gap-2">
                {[...savedGuests].sort((a, b) => a.name.localeCompare(b.name)).map((g) => {
                  const sel = selectedIds.has(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => togglePlayer(g.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm border-2 transition-colors ${
                        sel ? "bg-blue-50 border-blue-400" : "bg-gray-50 border-transparent hover:border-gray-200"
                      }`}
                    >
                      <span className={`text-xs ${sel ? "text-blue-700" : "text-gray-400"}`}>{sel ? "✓" : "+"}</span>
                      <span className="font-medium text-gray-700">{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Generating indicator */}
        {generating && (
          <div className="text-center py-6">
            <div className="inline-flex items-center gap-2 text-gray-500">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Balancing teams...
            </div>
          </div>
        )}

        {!generating && totalPlayers < 2 && totalPlayers > 0 && (
          <div className="text-center py-4 text-sm text-amber-600 bg-amber-50 rounded-xl">
            Select at least 2 players to auto-generate teams
          </div>
        )}

        {/* Results */}
        {!generating && result && (
          <div>
            <div className="text-center mb-3">
              <span className="inline-block px-4 py-2 rounded-full text-sm font-bold bg-green-100 text-green-800">
                ⚖️ Balanced Teams Ready
              </span>
            </div>

            <p className="text-xs text-center text-gray-600 mb-3">
              {swapPick
                ? "Now tap a player on the OTHER team to swap. Tap again to cancel."
                : "💡 Tap any player to swap them with a player from the other team."}
            </p>

            <div className="flex items-center justify-center gap-3 mb-3 text-xs flex-wrap">
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-700">Team 1 jersey:</span>
                <select value={jerseyA} onChange={(e) => setJerseyA(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-800">
                  {JERSEY_COLORS.map((c, i) => <option key={c.name} value={i} disabled={i === jerseyB}>{c.emoji} {c.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-700">Team 2 jersey:</span>
                <select value={jerseyB} onChange={(e) => setJerseyB(parseInt(e.target.value))}
                  className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-800">
                  {JERSEY_COLORS.map((c, i) => <option key={c.name} value={i} disabled={i === jerseyA}>{c.emoji} {c.name}</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {(["A", "B"] as const).map((side) => {
                const jersey = JERSEY_COLORS[side === "A" ? jerseyA : jerseyB];
                const team = side === "A" ? result.teamA : result.teamB;
                const sorted = [...team].sort((p, q) => p.name.localeCompare(q.name));
                return (
                  <div key={side} className={`${jersey.bg} rounded-xl shadow-sm border-2 ${jersey.border} overflow-hidden`}>
                    <div className={`${jersey.headerBg} ${jersey.headerText} px-4 py-3 font-bold text-center text-lg`}>
                      {jersey.emoji} {jersey.name} Jersey
                    </div>
                    <div className="p-3 space-y-1.5">
                      {sorted.map((p, i) => {
                        const picked = swapPick === `${side}:${p.id}`;
                        const otherSidePicked = swapPick && swapPick.startsWith(side === "A" ? "B:" : "A:");
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => pickForSwap(side, p.id)}
                            className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left transition-all ${
                              picked
                                ? "ring-2 ring-blue-500 bg-blue-50/40"
                                : otherSidePicked
                                ? "hover:ring-2 hover:ring-emerald-400 hover:bg-emerald-50/30 cursor-pointer"
                                : "hover:bg-black/5 cursor-pointer"
                            } ${jersey.name === "Black" ? "border-b border-gray-700 last:border-0" : "border-b border-gray-100 last:border-0"}`}
                          >
                            <span className="text-xs w-5 font-bold text-gray-400">{i + 1}</span>
                            <span className={`font-medium flex-1 truncate text-sm ${jersey.text}`}>
                              {p.isCaptain && <span className="text-xs font-bold mr-1" title="Captain">©</span>}
                              {p.name}
                              {p.isGuest && <span className="text-xs opacity-60 ml-1">(G)</span>}
                            </span>
                            {picked && <span className="text-xs text-blue-700 font-bold">↔ pick partner</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className={`${jersey.footerBg} px-4 py-2 text-center font-bold ${jersey.footerText} text-sm`}>
                      {team.length} players
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={shuffleTeams}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                🔀 Shuffle
              </button>
              <button
                onClick={shareWhatsApp}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                📤 Share
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">DADAS FC Treasury · Team Maker</p>
      </div>
    </div>
  );
}
