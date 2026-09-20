"use client";

import { useEffect, useState, Fragment } from "react";

interface Member { id: string; name: string; active: boolean; isGuest: boolean }
interface Skill {
  memberId: string; skillTier: string; ageGroup: string; position: string;
  isCaptain: boolean; availability: string; ballControl: string; runningSpeed: string;
}
interface Comment { id: string; memberId: string; author: string; text: string; createdAt: string }
interface Sheet { id: string; name: string; date: string; teamAName: string; teamBName: string; teamA: string[]; teamB: string[] }

const TIER_COLOR: Record<string, string> = {
  legend: "bg-purple-600 text-white", master: "bg-red-600 text-white",
  gold: "bg-amber-500 text-white", silver: "bg-gray-400 text-white",
  bronze: "bg-orange-600 text-white", starter: "bg-green-600 text-white",
};
const TIER_PTS: Record<string, number> = { legend: 6, master: 5, gold: 4, silver: 3, bronze: 2, starter: 1 };
const AGE_LABEL: Record<string, string> = {
  under30: "U30", age30to40: "30-40", age40to50: "40-50", over50: "50+",
  youth: "U30", senior: "30-40", veteran: "40-50",
};
const POS_SHORT: Record<string, string> = {
  any: "—", goalkeeper: "GK", cb: "CB", lb: "LB", rb: "RB", lwb: "LWB", rwb: "RWB",
  defender: "DEF", cdm: "CDM", cm: "CM", cam: "CAM", lm: "LM", rm: "RM",
  midfielder: "MID", st: "ST", cf: "CF", ss: "SS", forward: "FWD",
};
const POS_CAT: Record<string, string> = {
  goalkeeper: "GK", cb: "DEF", lb: "DEF", rb: "DEF", lwb: "DEF", rwb: "DEF", defender: "DEF",
  cdm: "MID", cm: "MID", cam: "MID", lm: "MID", rm: "MID", midfielder: "MID",
  st: "FWD", cf: "FWD", ss: "FWD", forward: "FWD", any: "—",
};
const SPEED_LABEL: Record<string, string> = { slow: "Slow −0.5", medium: "Med 0", fast: "Fast +0.5" };
const BALL_LABEL: Record<string, string> = {
  no: "No −0.75", less: "Less −0.5", ok: "Ok 0", good: "Good +0.5", verygood: "V.Good +1",
};
const AGE_MOD: Record<string, number> = { under30: 0.4, age30to40: 0, age40to50: -0.2, over50: -0.4, youth: 0.4, senior: 0, veteran: -0.2 };
const POS_MOD: Record<string, number> = {
  goalkeeper: 0.5, cb: 0.3, lb: 0.2, rb: 0.2, lwb: 0.2, rwb: 0.2, defender: 0.2,
  cdm: 0.4, cm: 0.3, cam: 0.3, lm: 0.2, rm: 0.2, midfielder: 0.3,
  st: 0.3, cf: 0.3, ss: 0.3, forward: 0.3, any: 0,
};
const SPEED_MOD: Record<string, number> = { slow: -0.5, medium: 0, fast: 0.5 };
const BALL_MOD: Record<string, number> = { no: -0.75, less: -0.5, ok: 0, good: 0.5, verygood: 1 };
const AVAIL_MOD: Record<string, number> = { fit: 0, tired: -1, injured: 0 };

// Mirrors the server formula so the committee can see WHY a rating lands where
// it does. Recent-form is excluded (it depends on match history, not the pool).
function ratingOf(s: Skill | undefined): number {
  if (!s) return TIER_PTS.silver;
  let tier = s.skillTier;
  if (tier === "silver" && s.ageGroup === "over50" && s.availability === "tired") tier = "bronze";
  return Math.round(((TIER_PTS[tier] ?? 3) + (AGE_MOD[s.ageGroup] ?? 0) + (POS_MOD[s.position] ?? 0)
    + (AVAIL_MOD[s.availability] ?? 0) + (BALL_MOD[s.ballControl] ?? 0) + (SPEED_MOD[s.runningSpeed] ?? 0)) * 10) / 10;
}

export default function CommitteePage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [skills, setSkills] = useState<Record<string, Skill>>({});
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "rating" | "position">("name");
  const [showGuests, setShowGuests] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null); // player id with comments open
  const [draft, setDraft] = useState("");
  const [author, setAuthor] = useState("");
  const [posting, setPosting] = useState(false);
  const [showScale, setShowScale] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/committee/data");
    if (res.ok) {
      const d = await res.json();
      setMembers(d.members);
      const map: Record<string, Skill> = {};
      (d.skills as Skill[]).forEach((s) => { map[s.memberId] = s; });
      setSkills(map);
      setSheets(d.sheets || []);
      setComments(d.comments || []);
      setAuthed(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    const saved = localStorage.getItem("committee_author");
    if (saved) setAuthor(saved);
  }, []);

  async function addComment(memberId: string) {
    if (!draft.trim()) return;
    setPosting(true);
    const res = await fetch("/api/committee/comments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, text: draft.trim(), author: author.trim() }),
    });
    if (res.ok) {
      const c = await res.json();
      setComments((prev) => [c, ...prev]);
      setDraft("");
      if (author.trim()) localStorage.setItem("committee_author", author.trim());
    }
    setPosting(false);
  }

  async function removeComment(id: string) {
    await fetch(`/api/committee/comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  async function login(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/committee/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) { setPassword(""); await load(); }
    else setError((await res.json()).error || "Login failed");
    setBusy(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <form onSubmit={login} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-1">⚽ Selection Committee</h1>
          <p className="text-sm text-gray-500 mb-5">Enter the committee password to review the player pool.</p>
          <input
            type="password" value={password} autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && password && !busy) login(e); }}
            placeholder="Committee password"
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          />
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button type="submit" disabled={busy || !password}
            className="w-full bg-[#1a2744] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#243556] disabled:opacity-40">
            {busy ? "Checking…" : "View Player Pool"}
          </button>
          <p className="text-[11px] text-gray-400 mt-4 text-center">Read-only. Nothing here can be changed.</p>
        </form>
      </div>
    );
  }

  const visible = members.filter((m) => (showGuests ? true : !m.isGuest) && (m.active || m.isGuest));
  const sorted = [...visible].sort((a, b) => {
    if (sortBy === "rating") return ratingOf(skills[b.id]) - ratingOf(skills[a.id]);
    if (sortBy === "position") {
      // Pitch order, with unassigned last — what a committee member expects.
      const ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3, "—": 4 };
      const ca = ORDER[POS_CAT[skills[a.id]?.position ?? "any"] ?? "—"] ?? 4;
      const cb = ORDER[POS_CAT[skills[b.id]?.position ?? "any"] ?? "—"] ?? 4;
      return ca === cb ? a.name.localeCompare(b.name) : ca - cb;
    }
    return a.name.localeCompare(b.name);
  });

  const unrated = visible.filter((m) => !skills[m.id]);
  const captains = visible.filter((m) => skills[m.id]?.isCaptain);
  const catCount: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0, "—": 0 };
  for (const m of visible) catCount[POS_CAT[skills[m.id]?.position ?? "any"] ?? "—"]++;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">⚽ Selection Committee — Player Pool</h1>
            <p className="text-sm text-gray-500 mb-2">
              Review ratings and positions. You can add notes on any player; ratings themselves are changed by the admin.
            </p>
          </div>
          <button
            onClick={async () => { await fetch("/api/committee/logout", { method: "POST" }); location.reload(); }}
            className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 whitespace-nowrap"
          >
            Sign out
          </button>
        </div>

        {/* How ratings work — every option and what it is worth */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-5">
          <button onClick={() => setShowScale(!showScale)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800">
            <span>📊 How ratings are calculated — all available options</span>
            <span className="text-gray-400">{showScale ? "▲" : "▼"}</span>
          </button>
          {showScale && (
            <div className="px-4 pb-4 text-xs text-gray-700 space-y-3">
              <p className="text-gray-500">
                A player&apos;s rating is the skill tier plus every modifier below. Teams are then built so the two
                sides are within <strong>1 point</strong> of each other.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="font-semibold text-gray-800 mb-1">Skill tier (base)</div>
                  <ul className="space-y-0.5">
                    {[["Legend", 6], ["Master", 5], ["Gold", 4], ["Silver", 3], ["Bronze", 2], ["Starter", 1]].map(([l, v]) => (
                      <li key={l as string} className="flex justify-between"><span>{l}</span><span className="font-mono">{v}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 mb-1">Age group</div>
                  <ul className="space-y-0.5">
                    {[["Under 30", "+0.4"], ["30–40", "0"], ["40–50", "−0.2"], ["Above 50", "−0.4"]].map(([l, v]) => (
                      <li key={l} className="flex justify-between"><span>{l}</span><span className="font-mono">{v}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 mb-1">Running speed</div>
                  <ul className="space-y-0.5">
                    {[["Slow", "−0.5"], ["Medium", "0"], ["Fast", "+0.5"]].map(([l, v]) => (
                      <li key={l} className="flex justify-between"><span>{l}</span><span className="font-mono">{v}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 mb-1">Ball control</div>
                  <ul className="space-y-0.5">
                    {[["No", "−0.75"], ["Less", "−0.5"], ["Ok", "0"], ["Good", "+0.5"], ["Very Good", "+1"]].map(([l, v]) => (
                      <li key={l} className="flex justify-between"><span>{l}</span><span className="font-mono">{v}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 mb-1">Fitness</div>
                  <ul className="space-y-0.5">
                    {[["Fit", "0"], ["Tired", "−1"], ["Injured", "excluded from teams"]].map(([l, v]) => (
                      <li key={l} className="flex justify-between gap-3"><span>{l}</span><span className="font-mono text-right">{v}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 mb-1">Position bonus</div>
                  <ul className="space-y-0.5">
                    {[["GK", "+0.5"], ["CDM", "+0.4"], ["CB", "+0.3"], ["CM / CAM", "+0.3"], ["ST / CF / SS", "+0.3"],
                      ["LB / RB / LWB / RWB", "+0.2"], ["LM / RM", "+0.2"], ["Any (utility)", "0"]].map(([l, v]) => (
                      <li key={l} className="flex justify-between gap-3"><span>{l}</span><span className="font-mono">{v}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-gray-500 border-t border-gray-100 pt-2">
                <strong>Special rule:</strong> a Silver player who is both over 50 and tired is treated as Bronze.
                Recent form also nudges a rating slightly (−0.3 if they haven&apos;t played in the last 5 matches, up to +0.2 if they play every week),
                so the figure in the table can differ a little from the pure sum above.
              </p>
            </div>
          )}
        </div>

        {/* Health checks — what usually causes odd-looking teams */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {[
            { label: "Players", value: visible.length, tone: "bg-white" },
            { label: "Unrated", value: unrated.length, tone: unrated.length ? "bg-orange-50 border-orange-200" : "bg-white" },
            { label: "Goalkeepers", value: catCount.GK, tone: catCount.GK < 2 ? "bg-orange-50 border-orange-200" : "bg-white" },
            { label: "Flagged captains", value: captains.length, tone: captains.length > 6 ? "bg-orange-50 border-orange-200" : "bg-white" },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl border border-gray-100 p-3 text-center ${c.tone}`}>
              <div className="text-2xl font-bold text-gray-800">{c.value}</div>
              <div className="text-[11px] text-gray-500">{c.label}</div>
            </div>
          ))}
        </div>

        {(unrated.length > 0 || catCount.GK < 2) && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-5 text-xs text-orange-900">
            <strong>Worth checking:</strong>
            {unrated.length > 0 && (
              <div className="mt-1">
                {unrated.length} player{unrated.length === 1 ? " has" : "s have"} no rating set and default to Silver:{" "}
                <strong>{unrated.map((m) => m.name).join(", ")}</strong>
              </div>
            )}
            {catCount.GK < 2 && (
              <div className="mt-1">
                Only {catCount.GK} goalkeeper in the pool — one team will always play without a recognised keeper.
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
          <span className="text-gray-500 font-medium">Sort:</span>
          {(["name", "rating", "position"] as const).map((s) => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-full font-semibold capitalize ${sortBy === s ? "bg-[#1a2744] text-white" : "bg-gray-200 text-gray-600"}`}>
              {s}
            </button>
          ))}
          <label className="flex items-center gap-1.5 ml-auto text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showGuests} onChange={(e) => setShowGuests(e.target.checked)} className="rounded" />
            Include saved guests
          </label>
          <span className="text-gray-400">GK {catCount.GK} · DEF {catCount.DEF} · MID {catCount.MID} · FWD {catCount.FWD} · Any {catCount["—"]}</span>
        </div>

        {/* Pool table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto mb-6">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 z-10">Player</th>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="text-left px-3 py-2">Pos</th>
                <th className="text-left px-3 py-2">Age</th>
                <th className="text-left px-3 py-2">Speed</th>
                <th className="text-left px-3 py-2">Ball control</th>
                <th className="text-left px-3 py-2">Fitness</th>
                <th className="text-right px-3 py-2">Rating</th>
                <th className="text-center px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const s = skills[m.id];
                const tier = s?.skillTier ?? "silver";
                const mine = comments.filter((c) => c.memberId === m.id);
                return (
                  <Fragment key={m.id}>
                  <tr className={`border-t border-gray-100 ${!s ? "bg-orange-50/50" : ""}`}>
                    <td className={`px-3 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 z-10 ${!s ? "bg-orange-50" : "bg-white"}`}>
                      {s?.isCaptain && <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1 rounded mr-1">©</span>}
                      {m.name}
                      {m.isGuest && <span className="text-[10px] bg-gray-200 text-gray-700 px-1 rounded ml-1">GUEST</span>}
                      {!s && <span className="text-[10px] text-orange-700 ml-1">(unrated)</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${TIER_COLOR[tier]}`}>{tier}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {POS_SHORT[s?.position ?? "any"]}
                      <span className="text-gray-400 text-[11px] ml-1">{POS_CAT[s?.position ?? "any"]}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{AGE_LABEL[s?.ageGroup ?? "age30to40"] ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{SPEED_LABEL[s?.runningSpeed ?? "medium"]}</td>
                    <td className="px-3 py-2 text-gray-600">{BALL_LABEL[s?.ballControl ?? "ok"]}</td>
                    <td className="px-3 py-2">
                      {s?.availability === "injured" ? <span className="text-red-700 font-semibold">🚑 Injured</span>
                        : s?.availability === "tired" ? <span className="text-yellow-700 font-semibold">😓 Tired</span>
                        : <span className="text-green-700">Fit</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-800">{ratingOf(s).toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => { setOpenFor(openFor === m.id ? null : m.id); setDraft(""); }}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                          mine.length ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        💬 {mine.length || "+"}
                      </button>
                    </td>
                  </tr>
                  {openFor === m.id && (
                    <tr className="bg-blue-50/40 border-t border-blue-100">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Notes on {m.name}</div>
                        {mine.length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {mine.map((c) => (
                              <div key={c.id} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                                <div className="flex-1">
                                  <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{c.text}</div>
                                  <div className="text-[11px] text-gray-400 mt-0.5">
                                    {c.author || "Committee"} · {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </div>
                                </div>
                                <button onClick={() => removeComment(c.id)} title="Delete note"
                                  className="text-gray-300 hover:text-red-600 font-bold text-sm">×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input value={author} onChange={(e) => setAuthor(e.target.value)}
                            placeholder="Your name" className="border rounded-lg px-3 py-2 text-sm sm:w-40" />
                          <input value={draft} onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) addComment(m.id); }}
                            placeholder={`e.g. "rated too high — struggled at CB last week"`}
                            className="border rounded-lg px-3 py-2 text-sm flex-1" />
                          <button onClick={() => addComment(m.id)} disabled={!draft.trim() || posting}
                            className="bg-[#1a2744] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#243556] disabled:opacity-40">
                            {posting ? "Saving…" : "Add note"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recent shared teams */}
        <h2 className="text-lg font-bold text-gray-800 mb-2">📋 Recent Teams Shared</h2>
        <div className="space-y-3 mb-8">
          {sheets.length === 0 ? (
            <p className="text-sm text-gray-400 italic bg-white rounded-xl border border-gray-100 p-4">
              No teams recorded yet — they appear here once teams are shared to WhatsApp.
            </p>
          ) : sheets.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="text-xs text-gray-500 mb-2">
                {new Date(s.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="font-semibold text-gray-700 mb-1">{s.teamAName}</div>
                  <div className="text-gray-600">{[...s.teamA].sort().join(", ")}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">{s.teamBName}</div>
                  <div className="text-gray-600">{[...s.teamB].sort().join(", ")}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400">
          Read-only view for the selection committee · DADAS FC
        </p>
      </div>
    </div>
  );
}
