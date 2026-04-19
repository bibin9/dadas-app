"use client";

import { useEffect, useState } from "react";

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
  member: Member;
}

interface PlayerEntry {
  id: string;
  name: string;
  skillTier: string;
  ageGroup: string;
  position: string;
  score: number;
  isGuest: boolean;
}

interface TeamResult {
  teamA: PlayerEntry[];
  teamB: PlayerEntry[];
  scoreA: number;
  scoreB: number;
  difference: number;
}

interface GuestPlayer {
  name: string;
  skillTier: string;
  ageGroup: string;
}

interface TeamSheet {
  id: string;
  name: string;
  date: string;
  teamAName: string;
  teamBName: string;
  teamAIds: string;
  teamBIds: string;
  notes: string;
  createdAt: string;
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
  { value: "senior", label: "Senior" },
  { value: "veteran", label: "Veteran" },
  { value: "youth", label: "Youth" },
];

const POSITIONS = [
  { value: "any", label: "Any" },
  { value: "goalkeeper", label: "GK" },
  { value: "defender", label: "DEF" },
  { value: "midfielder", label: "MID" },
  { value: "forward", label: "FWD" },
];

function getSkillBadge(tier: string) {
  const t = SKILL_TIERS.find((s) => s.value === tier) || SKILL_TIERS[3];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${t.color}`}>
      {t.label}
    </span>
  );
}

export default function TeamBalancerPage() {
  const [tab, setTab] = useState<"pool" | "generate" | "sheets">("pool");
  const [members, setMembers] = useState<Member[]>([]);
  const [skills, setSkills] = useState<Record<string, PlayerSkill>>({});
  const [loading, setLoading] = useState(true);

  // Pool tab state
  const [filterTier, setFilterTier] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editSkills, setEditSkills] = useState<
    Record<string, { skillTier: string; ageGroup: string; position: string }>
  >({});

  // Generate tab state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestTier, setGuestTier] = useState("silver");
  const [guestAge, setGuestAge] = useState("senior");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TeamResult | null>(null);
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");

  // Sheets tab state
  const [sheets, setSheets] = useState<TeamSheet[]>([]);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  useEffect(() => {
    loadData();
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

  async function loadSheets() {
    setSheetsLoading(true);
    const res = await fetch("/api/team-balancer/sheets");
    setSheets(await res.json());
    setSheetsLoading(false);
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
      ageGroup: s?.ageGroup ?? "senior",
      position: s?.position ?? "any",
    };
  }

  function updateEdit(memberId: string, field: string, value: string) {
    const current = getEditValue(memberId);
    setEditSkills((prev) => ({
      ...prev,
      [memberId]: { ...current, [field]: value },
    }));
  }

  // ---- Generate Tab ----
  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)));
    }
  }

  function addGuest() {
    if (!guestName.trim()) return;
    setGuests((prev) => [
      ...prev,
      { name: guestName.trim(), skillTier: guestTier, ageGroup: guestAge },
    ]);
    setGuestName("");
    setGuestTier("silver");
    setGuestAge("senior");
  }

  function removeGuest(i: number) {
    setGuests((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function generateTeams() {
    if (selectedIds.size + guests.length < 2) return;
    setGenerating(true);
    const res = await fetch("/api/team-balancer/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerIds: Array.from(selectedIds),
        guestPlayers: guests,
      }),
    });
    setResult(await res.json());
    setGenerating(false);
  }

  async function saveSheet() {
    if (!result) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
    const name = `Week ${weekNum} - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    await fetch("/api/team-balancer/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        date: new Date().toISOString(),
        teamAName,
        teamBName,
        teamAIds: result.teamA.map((p) => `${p.id}:${p.name}:${p.skillTier}`).join(","),
        teamBIds: result.teamB.map((p) => `${p.id}:${p.name}:${p.skillTier}`).join(","),
        notes: `Score: ${teamAName} ${result.scoreA} - ${teamBName} ${result.scoreB}`,
      }),
    });
    alert("Team sheet saved!");
  }

  async function shareWhatsApp() {
    if (!result) return;
    const text = `${teamAName} (${result.scoreA} pts)\n${result.teamA.map((p) => `  ${p.name} [${p.skillTier}]`).join("\n")}\n\n${teamBName} (${result.scoreB} pts)\n${result.teamB.map((p) => `  ${p.name} [${p.skillTier}]`).join("\n")}\n\nDifference: ${result.difference} pts`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Team Sheet", text });
      } catch {
        /* user cancelled */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  }

  // ---- Sheets Tab ----
  async function deleteSheet(id: string) {
    if (!confirm("Delete this team sheet?")) return;
    await fetch(`/api/team-balancer/sheets/${id}`, { method: "DELETE" });
    loadSheets();
  }

  function parseTeamIds(str: string) {
    return str.split(",").map((entry) => {
      const parts = entry.split(":");
      return { id: parts[0], name: parts[1] || parts[0], skillTier: parts[2] || "silver" };
    });
  }

  const filteredMembers =
    filterTier === "all"
      ? members
      : members.filter((m) => {
          const s = skills[m.id];
          return (s?.skillTier ?? "silver") === filterTier;
        });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Team Balancer</h1>
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
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Team Balancer</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        {[
          { key: "pool" as const, label: "Player Pool" },
          { key: "generate" as const, label: "Generate Teams" },
          { key: "sheets" as const, label: "Saved Sheets" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              if (t.key === "sheets") loadSheets();
            }}
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

      {/* ========== POOL TAB ========== */}
      {tab === "pool" && (
        <div>
          {/* Filter */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Filter:</span>
            <button
              onClick={() => setFilterTier("all")}
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                filterTier === "all" ? "bg-[#1a2744] text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              All
            </button>
            {SKILL_TIERS.map((t) => (
              <button
                key={t.value}
                onClick={() => setFilterTier(t.value)}
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  filterTier === t.value ? t.color : "bg-gray-200 text-gray-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Player list */}
          <div className="space-y-2">
            {filteredMembers.map((m) => {
              const ev = getEditValue(m.id);
              const hasChanges =
                editSkills[m.id] &&
                (editSkills[m.id].skillTier !== (skills[m.id]?.skillTier ?? "silver") ||
                  editSkills[m.id].ageGroup !== (skills[m.id]?.ageGroup ?? "senior") ||
                  editSkills[m.id].position !== (skills[m.id]?.position ?? "any"));
              return (
                <div
                  key={m.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 truncate">{m.name}</span>
                      {getSkillBadge(ev.skillTier)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={ev.skillTier}
                      onChange={(e) => updateEdit(m.id, "skillTier", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                    >
                      {SKILL_TIERS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={ev.ageGroup}
                      onChange={(e) => updateEdit(m.id, "ageGroup", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                    >
                      {AGE_GROUPS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={ev.position}
                      onChange={(e) => updateEdit(m.id, "position", e.target.value)}
                      className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                    >
                      {POSITIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => saveSkill(m.id)}
                      disabled={savingId === m.id || !hasChanges}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        hasChanges
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {savingId === m.id ? "Saving..." : "Save"}
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

      {/* ========== GENERATE TAB ========== */}
      {tab === "generate" && (
        <div>
          {/* Player selection */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Select Players</h2>
              <button
                onClick={toggleAll}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {selectedIds.size === members.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
              {members.map((m) => {
                const s = skills[m.id];
                const tier = s?.skillTier ?? "silver";
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedIds.has(m.id)
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(m.id)}
                      onChange={() => togglePlayer(m.id)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 truncate">{m.name}</span>
                    {getSkillBadge(tier)}
                  </label>
                );
              })}
            </div>
            <div className="mt-3 text-sm text-gray-500">
              {selectedIds.size} player{selectedIds.size !== 1 ? "s" : ""} selected
            </div>
          </div>

          {/* Guest players */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <h2 className="font-semibold text-gray-800 mb-3">Guest Players</h2>
            <div className="flex flex-wrap gap-2 mb-3">
              <input
                type="text"
                placeholder="Guest name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[140px]"
              />
              <select
                value={guestTier}
                onChange={(e) => setGuestTier(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm"
              >
                {SKILL_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={guestAge}
                onChange={(e) => setGuestAge(e.target.value)}
                className="border rounded-lg px-2 py-1.5 text-sm"
              >
                {AGE_GROUPS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button
                onClick={addGuest}
                className="bg-gray-800 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700"
              >
                Add
              </button>
            </div>
            {guests.length > 0 && (
              <div className="space-y-1">
                {guests.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">{g.name}</span>
                    {getSkillBadge(g.skillTier)}
                    <span className="text-gray-400">{g.ageGroup}</span>
                    <button
                      onClick={() => removeGuest(i)}
                      className="text-red-500 hover:text-red-700 ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={generateTeams}
            disabled={generating || selectedIds.size + guests.length < 2}
            className="w-full bg-[#1a2744] text-white py-4 rounded-xl text-lg font-bold hover:bg-[#243556] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6 shadow-lg"
          >
            {generating ? "Generating..." : "Generate Balanced Teams"}
          </button>

          {/* Results */}
          {result && (
            <div>
              {/* Team names */}
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={teamAName}
                  onChange={(e) => setTeamAName(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm font-bold flex-1 text-center"
                />
                <span className="text-gray-400 self-center font-bold">VS</span>
                <input
                  type="text"
                  value={teamBName}
                  onChange={(e) => setTeamBName(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm font-bold flex-1 text-center"
                />
              </div>

              {/* Score difference */}
              <div className="text-center mb-4">
                <span
                  className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${
                    result.difference === 0
                      ? "bg-green-100 text-green-800"
                      : result.difference <= 1
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {result.difference === 0
                    ? "Perfectly Balanced!"
                    : `Difference: ${result.difference} pts`}
                </span>
              </div>

              {/* Teams side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Team A */}
                <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 overflow-hidden">
                  <div className="bg-blue-600 text-white px-4 py-3 font-bold text-center">
                    {teamAName}
                  </div>
                  <div className="p-4 space-y-2">
                    {result.teamA.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
                      >
                        <span className="text-gray-400 text-xs w-5">{i + 1}</span>
                        <span className="font-medium text-gray-800 flex-1 truncate">
                          {p.name}
                          {p.isGuest && (
                            <span className="text-xs text-gray-400 ml-1">(Guest)</span>
                          )}
                        </span>
                        {getSkillBadge(p.skillTier)}
                        <span className="text-xs text-gray-400">{p.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 px-4 py-2 text-center font-bold text-blue-800">
                    Total: {result.scoreA} pts ({result.teamA.length} players)
                  </div>
                </div>

                {/* Team B */}
                <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 overflow-hidden">
                  <div className="bg-red-600 text-white px-4 py-3 font-bold text-center">
                    {teamBName}
                  </div>
                  <div className="p-4 space-y-2">
                    {result.teamB.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
                      >
                        <span className="text-gray-400 text-xs w-5">{i + 1}</span>
                        <span className="font-medium text-gray-800 flex-1 truncate">
                          {p.name}
                          {p.isGuest && (
                            <span className="text-xs text-gray-400 ml-1">(Guest)</span>
                          )}
                        </span>
                        {getSkillBadge(p.skillTier)}
                        <span className="text-xs text-gray-400">{p.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-red-50 px-4 py-2 text-center font-bold text-red-800">
                    Total: {result.scoreB} pts ({result.teamB.length} players)
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={generateTeams}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Shuffle Again
                </button>
                <button
                  onClick={saveSheet}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  Save Team Sheet
                </button>
                <button
                  onClick={shareWhatsApp}
                  className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
                >
                  Share via WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== SHEETS TAB ========== */}
      {tab === "sheets" && (
        <div>
          {sheetsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : sheets.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-1">No saved team sheets</p>
              <p className="text-sm">Generate teams and save them to see them here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sheets.map((sheet) => {
                const expanded = expandedSheet === sheet.id;
                const teamA = parseTeamIds(sheet.teamAIds);
                const teamB = parseTeamIds(sheet.teamBIds);
                return (
                  <div
                    key={sheet.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedSheet(expanded ? null : sheet.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-semibold text-gray-800">{sheet.name}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(sheet.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                      <span className="text-gray-400">{expanded ? "−" : "+"}</span>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="font-bold text-blue-700 mb-2">{sheet.teamAName}</div>
                            {teamA.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                                <span className="text-gray-700">{p.name}</span>
                                {getSkillBadge(p.skillTier)}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="font-bold text-red-700 mb-2">{sheet.teamBName}</div>
                            {teamB.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                                <span className="text-gray-700">{p.name}</span>
                                {getSkillBadge(p.skillTier)}
                              </div>
                            ))}
                          </div>
                        </div>
                        {sheet.notes && (
                          <div className="text-sm text-gray-500 mb-3">{sheet.notes}</div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const text = `${sheet.teamAName}\n${teamA.map((p) => `  ${p.name} [${p.skillTier}]`).join("\n")}\n\n${sheet.teamBName}\n${teamB.map((p) => `  ${p.name} [${p.skillTier}]`).join("\n")}\n\n${sheet.notes}`;
                              if (navigator.share) {
                                navigator.share({ title: sheet.name, text }).catch(() => {});
                              } else {
                                window.open(
                                  `https://wa.me/?text=${encodeURIComponent(text)}`,
                                  "_blank"
                                );
                              }
                            }}
                            className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Share
                          </button>
                          <button
                            onClick={() => deleteSheet(sheet.id)}
                            className="text-sm px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
