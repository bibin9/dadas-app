"use client";

import { useEffect, useState, useCallback } from "react";

interface Member {
  id: string;
  name: string;
  active: boolean;
}

interface PlayerSkill {
  id: string;
  memberId: string;
  skillTier: string;
  ageGroup: string;
  position: string;
  isCaptain: boolean;
  availability: string;
  member: Member;
}

interface AvoidPairRow {
  id: string;
  memberAId: string;
  memberBId: string;
  memberAName: string;
  memberBName: string;
  type: "same" | "opposing";
  notes: string;
}

interface PlayerEntry {
  id: string;
  name: string;
  skillTier: string;
  ageGroup: string;
  position: string;
  score: number;
  isGuest: boolean;
  isCaptain?: boolean;
}

interface TeamResult {
  teamA: PlayerEntry[];
  teamB: PlayerEntry[];
  scoreA: number;
  scoreB: number;
  difference: number;
  avoidViolations?: number;
}

interface GuestPlayer {
  name: string;
  skillTier: string;
  ageGroup: string;
  position: string;
}

const SKILL_TIERS = [
  { value: "legend", label: "Legend", color: "bg-purple-600 text-white" },
  { value: "master", label: "Master", color: "bg-red-600 text-white" },
  { value: "gold", label: "Gold", color: "bg-amber-500 text-white" },
  { value: "silver", label: "Silver", color: "bg-gray-400 text-white" },
  { value: "bronze", label: "Bronze", color: "bg-orange-600 text-white" },
  { value: "starter", label: "Starter", color: "bg-green-600 text-white" },
];

const AGE_GROUPS = [
  { value: "under30", label: "Under 30" },
  { value: "age30to40", label: "30–40" },
  { value: "age40to50", label: "40–50" },
  { value: "over50", label: "Above 50" },
];

// Map legacy age values to new ones for display
function normalizeAgeClient(age: string): string {
  switch (age) {
    case "youth": return "under30";
    case "senior": return "age30to40";
    case "veteran": return "age40to50";
    default: return age;
  }
}

const POSITIONS = [
  { value: "any", label: "Any" },
  { value: "goalkeeper", label: "GK" },
  { value: "defender", label: "DEF" },
  { value: "midfielder", label: "MID" },
  { value: "forward", label: "FWD" },
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

export default function TeamBalancerPage() {
  const [tab, setTab] = useState<"pool" | "generate">("generate");
  const [members, setMembers] = useState<Member[]>([]);
  const [skills, setSkills] = useState<Record<string, PlayerSkill>>({});
  const [loading, setLoading] = useState(true);

  // Pool tab state
  const [filterTier, setFilterTier] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editSkills, setEditSkills] = useState<
    Record<string, { skillTier: string; ageGroup: string; position: string; isCaptain: boolean; availability: string }>
  >({});

  // Generate tab state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestTier, setGuestTier] = useState("silver");
  const [guestAge, setGuestAge] = useState("age30to40");
  const [guestPosition, setGuestPosition] = useState("any");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TeamResult | null>(null);
  const [jerseyA, setJerseyA] = useState(0);
  const [jerseyB, setJerseyB] = useState(2);
  // Player picked for swap. Format "A:id" or "B:id". Click another from the
  // OPPOSITE team to swap them; click again to cancel.
  const [swapPick, setSwapPick] = useState<string | null>(null);

  // Auto-pick captains randomly (one per team) when none are flagged in the pool
  const [autoCaptain, setAutoCaptain] = useState(true);

  // Avoid-pairs (Player Pool tab)
  const [avoidPairs, setAvoidPairs] = useState<AvoidPairRow[]>([]);
  const [avoidA, setAvoidA] = useState("");
  const [avoidB, setAvoidB] = useState("");
  const [avoidType, setAvoidType] = useState<"same" | "opposing">("same");
  const [avoidSubmitting, setAvoidSubmitting] = useState(false);

  async function loadAvoidPairs() {
    const r = await fetch("/api/team-balancer/avoid-pairs");
    if (r.ok) {
      const d = await r.json();
      setAvoidPairs(d.pairs || []);
    }
  }

  async function addAvoidPair() {
    if (!avoidA || !avoidB || avoidA === avoidB || avoidSubmitting) return;
    setAvoidSubmitting(true);
    try {
      const res = await fetch("/api/team-balancer/avoid-pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberAId: avoidA, memberBId: avoidB, type: avoidType }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to add pair");
        return;
      }
      setAvoidA(""); setAvoidB(""); setAvoidType("same");
      await loadAvoidPairs();
    } finally { setAvoidSubmitting(false); }
  }

  async function removeAvoidPair(id: string) {
    if (!confirm("Remove this avoid-pair?")) return;
    await fetch("/api/team-balancer/avoid-pairs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadAvoidPairs();
  }

  // Swap a player from team A with one from team B (preserves team sizes).
  function swapPlayers(idA: string, idB: string) {
    if (!result) return;
    const a = result.teamA.find((p) => p.id === idA);
    const b = result.teamB.find((p) => p.id === idB);
    if (!a || !b) return;
    const newA = result.teamA.map((p) => (p.id === idA ? b : p));
    const newB = result.teamB.map((p) => (p.id === idB ? a : p));
    const scoreA = newA.reduce((s, p) => s + p.score, 0);
    const scoreB = newB.reduce((s, p) => s + p.score, 0);
    setResult({
      teamA: newA,
      teamB: newB,
      scoreA: Math.round(scoreA * 10) / 10,
      scoreB: Math.round(scoreB * 10) / 10,
      difference: Math.round(Math.abs(scoreA - scoreB) * 10) / 10,
    });
    setSwapPick(null);
  }

  // Click a player chip; if one from the opposite team is already picked, swap.
  function pickForSwap(side: "A" | "B", id: string) {
    const key = `${side}:${id}`;
    if (swapPick === key) {
      setSwapPick(null); // toggle off
      return;
    }
    if (swapPick && swapPick.startsWith(side === "A" ? "B:" : "A:")) {
      const otherId = swapPick.slice(2);
      if (side === "A") swapPlayers(id, otherId);
      else swapPlayers(otherId, id);
      return;
    }
    setSwapPick(key);
  }

  useEffect(() => {
    loadData();
    loadAvoidPairs();
  }, []);

  async function loadData() {
    setLoading(true);
    const [membersRes, skillsRes] = await Promise.all([
      fetch("/api/members"),
      fetch("/api/team-balancer/skills"),
    ]);
    const membersData: Member[] = await membersRes.json();
    const skillsData: PlayerSkill[] = await skillsRes.json();

    setMembers(membersData.filter((m) => m.active));
    const skillMap: Record<string, PlayerSkill> = {};
    skillsData.forEach((s) => {
      skillMap[s.memberId] = s;
    });
    setSkills(skillMap);
    setLoading(false);
  }

  // ---- Pool Tab ----
  async function saveSkill(memberId: string) {
    const edit = editSkills[memberId];
    if (!edit) return;
    setSavingId(memberId);
    await fetch("/api/team-balancer/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        skillTier: edit.skillTier,
        ageGroup: edit.ageGroup,
        position: edit.position,
        isCaptain: edit.isCaptain,
        availability: edit.availability,
      }),
    });
    await loadData();
    setSavingId(null);
  }

  function getEditValue(memberId: string) {
    if (editSkills[memberId]) return editSkills[memberId];
    const s = skills[memberId];
    return {
      skillTier: s?.skillTier ?? "silver",
      ageGroup: normalizeAgeClient(s?.ageGroup ?? "age30to40"),
      position: s?.position ?? "any",
      isCaptain: s?.isCaptain ?? false,
      availability: s?.availability ?? "fit",
    };
  }

  function updateEdit(memberId: string, field: string, value: string | boolean) {
    const current = getEditValue(memberId);
    setEditSkills((prev) => ({
      ...prev,
      [memberId]: { ...current, [field]: value },
    }));
  }

  // ---- Generate Tab ----
  const totalPlayers = selectedIds.size + guests.length;

  const doGenerate = useCallback(async (ids: Set<string>, guestList: GuestPlayer[], autoCaptainFlag: boolean) => {
    if (ids.size + guestList.length < 2) {
      setResult(null);
      return;
    }
    setGenerating(true);
    const res = await fetch("/api/team-balancer/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerIds: Array.from(ids),
        guestPlayers: guestList,
        autoCaptain: autoCaptainFlag,
      }),
    });
    const data = await res.json();
    setResult(data);
    // Assign random jersey colors each time
    const [a, b] = getRandomJerseyPair();
    setJerseyA(a);
    setJerseyB(b);
    setSwapPick(null); // clear any swap selection on new generation
    setGenerating(false);
  }, []);

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Auto-generate
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
    const newGuests = [...guests, { name: guestName.trim(), skillTier: guestTier, ageGroup: guestAge, position: guestPosition }];
    setGuests(newGuests);
    setGuestName("");
    setGuestTier("silver");
    setGuestAge("age30to40");
    setGuestPosition("any");
    // Auto-generate with new guest
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

  async function shareWhatsApp() {
    if (!result) return;
    const colorA = JERSEY_COLORS[jerseyA];
    const colorB = JERSEY_COLORS[jerseyB];
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    // Sort alphabetically so members can't tell who they're paired-against by position
    const aSorted = [...result.teamA].sort((p, q) => p.name.localeCompare(q.name));
    const bSorted = [...result.teamB].sort((p, q) => p.name.localeCompare(q.name));

    const fmt = (p: PlayerEntry, i: number) =>
      `${i + 1}. ${p.isCaptain ? "© " : ""}${p.name}${p.isGuest ? " (Guest)" : ""}`;
    const text = `⚽ *DADAS FC - Team Sheet*\n📅 ${dateStr}\n\n${colorA.emoji} *${colorA.name} Jersey*\n${aSorted.map(fmt).join("\n")}\n\n${colorB.emoji} *${colorB.name} Jersey*\n${bSorted.map(fmt).join("\n")}\n\n👥 ${result.teamA.length} vs ${result.teamB.length} players`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "DADAS FC Team Sheet", text });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    }
  }

  // Always alphabetical so the selection grid and pool tab list players
  // by name regardless of API order
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const filteredMembers =
    filterTier === "all"
      ? sortedMembers
      : sortedMembers.filter((m) => {
          const s = skills[m.id];
          return (s?.skillTier ?? "silver") === filterTier;
        });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">⚽ Team Maker</h1>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">⚽ Team Maker</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {[
          { key: "generate" as const, label: "Make Teams" },
          { key: "pool" as const, label: "Player Pool" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-[#1a2744] text-white shadow"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== GENERATE TAB ========== */}
      {tab === "generate" && (
        <div>
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
                <span><strong>©</strong> Auto-pick 2 captains randomly from those flagged in Player Pool</span>
                <span className="text-xs text-gray-500">
                  — {flaggedPlaying} flagged captain{flaggedPlaying === 1 ? "" : "s"} playing.
                  {flaggedPlaying < 2 && " Mark 2+ in Player Pool to enable."}
                </span>
              </label>
            );
          })()}

          {/* Player selection grid (alphabetical) */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[350px] overflow-y-auto">
              {sortedMembers.map((m) => {
                const s = skills[m.id];
                const tier = s?.skillTier ?? "silver";
                const isSelected = selectedIds.has(m.id);
                const isInjured = s?.availability === "injured";
                const isTired = s?.availability === "tired";
                const isCaptain = !!s?.isCaptain;
                return (
                  <button
                    key={m.id}
                    onClick={() => togglePlayer(m.id)}
                    title={isInjured ? "Injured — will be excluded from team generation" : undefined}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all relative ${
                      isSelected
                        ? "bg-blue-50 border-2 border-blue-400 shadow-sm"
                        : "bg-gray-50 border-2 border-transparent hover:border-gray-200"
                    } ${isInjured ? "opacity-60" : ""}`}
                  >
                    {isCaptain && <span className="absolute top-1 right-1 text-[10px] bg-amber-200 text-amber-900 font-bold px-1 rounded">©</span>}
                    {isInjured && <span className="absolute top-1 left-1 text-[10px]">🚑</span>}
                    {isTired && !isInjured && <span className="absolute top-1 left-1 text-[10px]">😓</span>}
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                    }`}>
                      {isSelected ? "✓" : m.name.charAt(0)}
                    </span>
                    <span className="text-xs font-medium text-gray-800 truncate w-full">{m.name}</span>
                    {getSkillBadge(tier)}
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
              <select
                value={guestTier}
                onChange={(e) => setGuestTier(e.target.value)}
                className="border rounded-lg px-2 py-2 text-sm bg-white"
              >
                {SKILL_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={guestAge}
                onChange={(e) => setGuestAge(e.target.value)}
                className="border rounded-lg px-2 py-2 text-sm bg-white"
              >
                {AGE_GROUPS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <select
                value={guestPosition}
                onChange={(e) => setGuestPosition(e.target.value)}
                className="border rounded-lg px-2 py-2 text-sm bg-white"
                title="Position"
              >
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
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
                    >
                      ×
                    </button>
                  </span>
                ))}
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

          {/* Minimum players hint */}
          {!generating && totalPlayers < 2 && totalPlayers > 0 && (
            <div className="text-center py-4 text-sm text-amber-600 bg-amber-50 rounded-xl">
              Select at least 2 players to auto-generate teams
            </div>
          )}

          {/* Results */}
          {!generating && result && (
            <div>
              {/* Score difference */}
              <div className="text-center mb-3">
                <span
                  className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                    result.difference === 0
                      ? "bg-green-100 text-green-800"
                      : result.difference <= 1
                      ? "bg-green-100 text-green-800"
                      : result.difference <= 2
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {result.difference === 0
                    ? "⚖️ Perfectly Balanced!"
                    : `⚖️ Difference: ${result.difference} pts`}
                </span>
                {(result.avoidViolations ?? 0) > 0 && (
                  <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                    ⚠️ {result.avoidViolations} avoid-pair violation{result.avoidViolations === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {/* Swap hint */}
              <p className="text-xs text-center text-gray-600 mb-3">
                {swapPick
                  ? "Now tap a player on the OTHER team to swap. Tap again to cancel."
                  : "💡 Tap any player to swap them with a player from the other team."}
              </p>

              {/* Jersey color pickers — manual override */}
              <div className="flex items-center justify-center gap-3 mb-3 text-xs flex-wrap">
                <label className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-700">Team 1 jersey:</span>
                  <select value={jerseyA} onChange={(e) => setJerseyA(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-800">
                    {JERSEY_COLORS.map((c, i) => (
                      <option key={c.name} value={i} disabled={i === jerseyB}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-700">Team 2 jersey:</span>
                  <select value={jerseyB} onChange={(e) => setJerseyB(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-800">
                    {JERSEY_COLORS.map((c, i) => (
                      <option key={c.name} value={i} disabled={i === jerseyA}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Teams side by side — alphabetically sorted, click-to-swap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {(["A", "B"] as const).map((side) => {
                  const jersey = JERSEY_COLORS[side === "A" ? jerseyA : jerseyB];
                  const team = side === "A" ? result.teamA : result.teamB;
                  const score = side === "A" ? result.scoreA : result.scoreB;
                  // Alphabetical sort — members can't tell who they're paired-against
                  const sorted = [...team].sort((p, q) => p.name.localeCompare(q.name));
                  return (
                    <div key={side} className={`${jersey.bg} rounded-xl shadow-sm border-2 ${jersey.border} overflow-hidden`}>
                      <div className={`${jersey.headerBg} ${jersey.headerText} px-4 py-3 font-bold text-center text-lg`}>
                        {jersey.emoji} {jersey.name} Jersey
                      </div>
                      <div className="p-3 space-y-1.5">
                        {sorted.map((p, i) => {
                          const picked = swapPick === `${side}:${p.id}`;
                          // Can swap with this player when the other team has someone picked
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
                              <span className={`text-xs w-5 font-bold ${jersey.name === "Black" ? "text-gray-400" : "text-gray-400"}`}>{i + 1}</span>
                              <span className={`font-medium flex-1 truncate text-sm ${jersey.text}`}>
                                {p.isCaptain && <span className="text-xs font-bold mr-1" title="Captain">©</span>}
                                {p.name}
                                {p.isGuest && <span className="text-xs opacity-60 ml-1">(G)</span>}
                              </span>
                              {picked && <span className="text-xs text-blue-700 font-bold">↔ pick partner</span>}
                              {getSkillBadge(p.skillTier)}
                            </button>
                          );
                        })}
                      </div>
                      <div className={`${jersey.footerBg} px-4 py-2 text-center font-bold ${jersey.footerText} text-sm`}>
                        {score} pts • {team.length} players
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
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
        </div>
      )}

      {/* ========== POOL TAB ========== */}
      {tab === "pool" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Set each player&apos;s skill level, age group, position, captain flag, and availability. Used to balance teams.</p>

          {/* Avoid Pairs section */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <h3 className="text-sm font-bold text-gray-800 mb-2">🚫 Avoid Pairs <span className="font-normal text-gray-500 text-xs">— rivalries / clashes</span></h3>
            <p className="text-xs text-gray-600 mb-3">
              Tell the algorithm which members shouldn&apos;t end up on the same team (clash) or on opposing teams (rivalry).
              These are soft constraints — the swap optimizer prioritizes fewer violations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
              <select value={avoidA} onChange={(e) => setAvoidA(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">Member A...</option>
                {sortedMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={avoidB} onChange={(e) => setAvoidB(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">Member B...</option>
                {sortedMembers.map((m) => <option key={m.id} value={m.id} disabled={m.id === avoidA}>{m.name}</option>)}
              </select>
              <select value={avoidType} onChange={(e) => setAvoidType(e.target.value as "same" | "opposing")} className="border rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="same">❌ Same team (clash)</option>
                <option value="opposing">⚔️ Opposing (rivalry)</option>
              </select>
              <button onClick={addAvoidPair} disabled={!avoidA || !avoidB || avoidA === avoidB || avoidSubmitting}
                className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {avoidSubmitting ? "Adding..." : "+ Add pair"}
              </button>
            </div>
            {avoidPairs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {avoidPairs.map((p) => (
                  <span key={p.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    p.type === "same" ? "bg-red-50 text-red-800 border border-red-200" : "bg-purple-50 text-purple-800 border border-purple-200"
                  }`}>
                    {p.type === "same" ? "❌" : "⚔️"} <strong>{p.memberAName}</strong> &amp; <strong>{p.memberBName}</strong>
                    <button onClick={() => removeAvoidPair(p.id)} className="ml-1 text-gray-500 hover:text-red-600 font-bold" title="Remove">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No pairs yet. Add some above to enforce team / opposing constraints.</p>
            )}
          </div>

          {/* Filter */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Filter:</span>
            <button
              onClick={() => setFilterTier("all")}
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                filterTier === "all" ? "bg-[#1a2744] text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              All ({members.length})
            </button>
            {SKILL_TIERS.map((t) => {
              const count = members.filter((m) => (skills[m.id]?.skillTier ?? "silver") === t.value).length;
              return (
                <button
                  key={t.value}
                  onClick={() => setFilterTier(t.value)}
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    filterTier === t.value ? t.color : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {t.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Player list */}
          <div className="space-y-2">
            {filteredMembers.map((m) => {
              const ev = getEditValue(m.id);
              const hasChanges =
                editSkills[m.id] &&
                (editSkills[m.id].skillTier !== (skills[m.id]?.skillTier ?? "silver") ||
                  editSkills[m.id].ageGroup !== normalizeAgeClient(skills[m.id]?.ageGroup ?? "age30to40") ||
                  editSkills[m.id].position !== (skills[m.id]?.position ?? "any") ||
                  editSkills[m.id].isCaptain !== (skills[m.id]?.isCaptain ?? false) ||
                  editSkills[m.id].availability !== (skills[m.id]?.availability ?? "fit"));
              return (
                <div
                  key={m.id}
                  className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 truncate text-sm">{m.name}</span>
                      {ev.isCaptain && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">© CAPTAIN</span>}
                      {ev.availability === "injured" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold">🚑 INJURED</span>}
                      {ev.availability === "tired" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-bold">😓 TIRED</span>}
                      {getSkillBadge(ev.skillTier)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={ev.skillTier}
                      onChange={(e) => updateEdit(m.id, "skillTier", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-xs bg-white"
                    >
                      {SKILL_TIERS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={ev.ageGroup}
                      onChange={(e) => updateEdit(m.id, "ageGroup", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-xs bg-white"
                    >
                      {AGE_GROUPS.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    <select
                      value={ev.position}
                      onChange={(e) => updateEdit(m.id, "position", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-xs bg-white"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <select
                      value={ev.availability}
                      onChange={(e) => updateEdit(m.id, "availability", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-xs bg-white"
                      title="Fitness / availability"
                    >
                      <option value="fit">Fit</option>
                      <option value="tired">Tired (-0.5)</option>
                      <option value="injured">🚑 Injured (skip)</option>
                    </select>
                    <label className="inline-flex items-center gap-1 px-2 py-1.5 text-xs bg-white border rounded-lg cursor-pointer" title="Captain — algorithm puts one on each team">
                      <input type="checkbox" checked={ev.isCaptain}
                        onChange={(e) => updateEdit(m.id, "isCaptain", e.target.checked)}
                        className="rounded text-amber-600" />
                      <span className="font-semibold text-amber-700">©</span>
                    </label>
                    <button
                      onClick={() => saveSkill(m.id)}
                      disabled={savingId === m.id || !hasChanges}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        hasChanges
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {savingId === m.id ? "..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <div className="text-center py-12 text-gray-400">No players found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
