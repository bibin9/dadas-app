import { prisma } from "@/lib/db";

const SKILL_WEIGHTS: Record<string, number> = {
  legend: 6,
  master: 5,
  gold: 4,
  silver: 3,
  bronze: 2,
  starter: 1,
};

// New 4-category age system + backward-compatible old values
const AGE_MODIFIERS: Record<string, number> = {
  under30: 0.4,
  age30to40: 0,
  age40to50: -0.2,
  over50: -0.4,
  // Legacy values (mapped for backward compat)
  youth: 0.4,
  senior: 0,
  veteran: -0.2,
};

// Position modifiers — small bonuses to recognise specialists. Granular
// positions get specific bonuses; legacy generic ones still work.
const POSITION_MODIFIERS: Record<string, number> = {
  // Goalkeeper
  goalkeeper: 0.5, gk: 0.5,
  // Defenders
  cb: 0.3,         // centre back — most critical defender
  lb: 0.2,         // left back
  rb: 0.2,         // right back
  lwb: 0.2,        // left wing-back
  rwb: 0.2,        // right wing-back
  sweeper: 0.3,
  defender: 0.2,   // legacy generic
  // Midfielders
  cdm: 0.4, dm: 0.4,       // defensive mid (mid-back)
  cm: 0.3,                  // central mid
  cam: 0.3, am: 0.3,        // attacking mid (fwd-mid)
  lm: 0.2,                  // left mid / winger
  rm: 0.2,                  // right mid / winger
  lw: 0.2, rw: 0.2,         // wingers
  midfielder: 0.3,          // legacy generic
  // Forwards
  st: 0.3,                  // striker / centre forward
  cf: 0.3,                  // centre forward
  ss: 0.3,                  // second striker
  forward: 0.3,             // legacy generic
  // Utility
  any: 0,
};

// Category mapping: granular position → high-level role. Used by the
// distribution algorithm so we balance ROLES across teams (a CB and an LB
// both count as "defender" when checking team composition).
const POSITION_CATEGORY: Record<string, string> = {
  goalkeeper: "goalkeeper", gk: "goalkeeper",
  cb: "defender", lb: "defender", rb: "defender",
  lwb: "defender", rwb: "defender", sweeper: "defender", defender: "defender",
  cdm: "midfielder", dm: "midfielder", cm: "midfielder",
  cam: "midfielder", am: "midfielder",
  lm: "midfielder", rm: "midfielder", lw: "midfielder", rw: "midfielder",
  midfielder: "midfielder",
  st: "forward", cf: "forward", ss: "forward", forward: "forward",
  any: "any",
};
function categoryOf(pos: string): string {
  return POSITION_CATEGORY[pos] || "any";
}

function normalizeAge(age: string): string {
  switch (age) {
    case "youth": return "under30";
    case "senior": return "age30to40";
    case "veteran": return "age40to50";
    default: return age;
  }
}

export interface PlayerEntry {
  id: string;
  name: string;
  skillTier: string;
  ageGroup: string;
  position: string;
  score: number;
  isGuest: boolean;
  isCaptain: boolean;
}

export interface GuestInput {
  name: string;
  skillTier?: string;
  ageGroup?: string;
  position?: string;
  ballControl?: string;
  availability?: string;
  runningSpeed?: string;
}

export interface BuiltTeams {
  teamA: PlayerEntry[];
  teamB: PlayerEntry[];
  scoreA: number;
  scoreB: number;
  difference: number;
  optimizationIterations: number;
  avoidViolations: number;
}

// Availability modifier: tired players play 1 full point below their level.
const AVAILABILITY_MODIFIERS: Record<string, number> = {
  fit: 0,
  tired: -1,
  injured: 0, // injured players are excluded entirely, not just modified
};

// Ball-control modifier — independent technical skill rating.
const BALL_CONTROL_MODIFIERS: Record<string, number> = {
  no: -0.75,
  less: -0.5,
  ok: 0,
  good: 0.5,
  verygood: 1,
};

// Running-speed modifier — independent athletic rating, separate from skill.
const SPEED_MODIFIERS: Record<string, number> = {
  slow: -0.5,
  medium: 0,
  fast: 0.5,
};

// Special rule: a Silver-tier player who is BOTH over 50 AND tired
// should be treated as Bronze (effective skill drop from being old + tired).
function effectiveSkillTier(skillTier: string, ageGroup: string, availability: string): string {
  if (skillTier === "silver" && ageGroup === "over50" && availability === "tired") {
    return "bronze";
  }
  return skillTier;
}

// Score = base skill + age + position + availability + ball control + speed + recent form
function calculateScore(
  skillTier: string,
  ageGroup: string,
  position: string,
  availability = "fit",
  ballControl = "ok",
  runningSpeed = "medium",
  recentFormMod = 0,
): number {
  const tier = effectiveSkillTier(skillTier, ageGroup, availability);
  const base = SKILL_WEIGHTS[tier] ?? 3;
  const ageMod = AGE_MODIFIERS[ageGroup] ?? 0;
  const posMod = POSITION_MODIFIERS[position] ?? 0;
  const availMod = AVAILABILITY_MODIFIERS[availability] ?? 0;
  const bcMod = BALL_CONTROL_MODIFIERS[ballControl] ?? 0;
  const speedMod = SPEED_MODIFIERS[runningSpeed] ?? 0;
  return Math.round((base + ageMod + posMod + availMod + bcMod + speedMod + recentFormMod) * 10) / 10;
}

// Core team-building algorithm. Shared by the admin (full data) and public
// (stripped data) API routes. Reads members/skills/sheets/avoid-pairs from DB.
export async function buildTeams(
  playerIds: string[],
  guestPlayers: GuestInput[] | undefined,
  autoCaptain: boolean,
): Promise<BuiltTeams> {
  const [members, recentSheets, avoidPairs] = await Promise.all([
    prisma.member.findMany({
      where: { id: { in: playerIds } },
      include: { skill: true },
    }),
    // Last 5 TeamSheets — used to compute recent form (participation proxy)
    prisma.teamSheet.findMany({ orderBy: { date: "desc" }, take: 5, select: { teamAIds: true, teamBIds: true } }),
    // Avoid-pair soft constraints
    prisma.avoidPair.findMany({ select: { memberAId: true, memberBId: true, type: true } }),
  ]);

  // Build an appearances map (memberId -> count of times in last 5 sheets)
  const appearances = new Map<string, number>();
  for (const ts of recentSheets) {
    const ids = new Set<string>();
    try {
      for (const x of JSON.parse(ts.teamAIds) as string[]) ids.add(x);
      for (const x of JSON.parse(ts.teamBIds) as string[]) ids.add(x);
    } catch { /* malformed json, skip */ }
    for (const id of ids) appearances.set(id, (appearances.get(id) || 0) + 1);
  }
  // Convert appearances to a small modifier:
  //   0 appearances in last 5 → -0.3 (rusty)
  //   3-4 appearances        → +0.1 (in rhythm)
  //   5 appearances          → +0.2 (very active)
  function recentFormModifier(memberId: string): number {
    const n = appearances.get(memberId) || 0;
    if (n === 0) return -0.3;
    if (n >= 5) return 0.2;
    if (n >= 3) return 0.1;
    return 0;
  }

  // Build player entries (filter out injured)
  const players: PlayerEntry[] = [];
  for (const m of members) {
    const skill = m.skill;
    const availability = skill?.availability ?? "fit";
    if (availability === "injured") continue; // exclude injured from team generation
    const skillTier = skill?.skillTier ?? "silver";
    const ageGroup = normalizeAge(skill?.ageGroup ?? "age30to40");
    const position = skill?.position ?? "any";
    const ballControl = skill?.ballControl ?? "ok";
    const runningSpeed = skill?.runningSpeed ?? "medium";
    const formMod = recentFormModifier(m.id);
    players.push({
      id: m.id,
      name: m.name,
      skillTier,
      ageGroup,
      position,
      score: calculateScore(skillTier, ageGroup, position, availability, ballControl, runningSpeed, formMod),
      isGuest: false,
      isCaptain: !!skill?.isCaptain,
    });
  }

  // Add guest players (now with position too)
  if (guestPlayers && Array.isArray(guestPlayers)) {
    for (const g of guestPlayers) {
      const ageGroup = normalizeAge(g.ageGroup || "age30to40");
      const skillTier = g.skillTier || "silver";
      const position = g.position || "any";
      const ballControl = g.ballControl || "ok";
      const availability = g.availability || "fit";
      const runningSpeed = g.runningSpeed || "medium";
      players.push({
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: g.name,
        skillTier,
        ageGroup,
        position,
        score: calculateScore(skillTier, ageGroup, position, availability, ballControl, runningSpeed),
        isGuest: true,
        isCaptain: false,
      });
    }
  }

  // Shuffle for run-to-run variety, then stable-sort by score desc
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  players.sort((a, b) => b.score - a.score);

  const teamA: PlayerEntry[] = [];
  const teamB: PlayerEntry[] = [];
  let scoreA = 0;
  let scoreB = 0;
  // Track per-category AND per-exact-position counts so we can distribute
  // specialists evenly (e.g. 4 CBs → 2 per team, not 4-0 just because they're
  // all "defenders") while still keeping high-level role balance.
  const posCountA: Record<string, number> = {}; // by category
  const posCountB: Record<string, number> = {};
  const exactCountA: Record<string, number> = {}; // by exact position (cb, lb, ...)
  const exactCountB: Record<string, number> = {};

  // Assign helper: pick the team that keeps:
  //  1) team size balanced (most important — max diff of 1)
  //  2) EXACT position count balanced (so multiple CBs split evenly)
  //  3) role category count balanced (so one team isn't all defenders)
  //  4) total score balanced
  function pushA(p: PlayerEntry) {
    const cat = categoryOf(p.position);
    teamA.push(p); scoreA += p.score;
    posCountA[cat] = (posCountA[cat] || 0) + 1;
    exactCountA[p.position] = (exactCountA[p.position] || 0) + 1;
  }
  function pushB(p: PlayerEntry) {
    const cat = categoryOf(p.position);
    teamB.push(p); scoreB += p.score;
    posCountB[cat] = (posCountB[cat] || 0) + 1;
    exactCountB[p.position] = (exactCountB[p.position] || 0) + 1;
  }
  function assign(p: PlayerEntry) {
    const cat = categoryOf(p.position);
    const sizeA = teamA.length;
    const sizeB = teamB.length;
    if (sizeA < sizeB) { pushA(p); return; }
    if (sizeB < sizeA) { pushB(p); return; }
    // Sizes equal — tier 2: prefer team with fewer of this EXACT position
    const exA = exactCountA[p.position] || 0;
    const exB = exactCountB[p.position] || 0;
    if (exA < exB) { pushA(p); return; }
    if (exB < exA) { pushB(p); return; }
    // Tier 3: prefer team with fewer of this role category
    const posA = posCountA[cat] || 0;
    const posB = posCountB[cat] || 0;
    if (posA < posB) { pushA(p); return; }
    if (posB < posA) { pushB(p); return; }
    // Tier 4: lower-scoring team
    if (scoreA <= scoreB) pushA(p); else pushB(p);
  }

  // Auto-pick captains from the pool of flagged captains ONLY.
  // Behaviour when autoCaptain is true:
  //   - 0 or 1 flagged-captain playing → no captain assignment (fall through)
  //   - exactly 2 flagged-captains playing → use both (one per team)
  //   - 3+ flagged-captains playing → randomly pick 2 of them
  // Note: any non-pool-flagged player is never auto-promoted to captain.
  // Captain assignment is for THIS generation only (does NOT persist).
  if (autoCaptain) {
    const playingCaptains = players.filter((p) => p.isCaptain);
    if (playingCaptains.length > 2) {
      // Shuffle and keep only 2
      const shuffled = [...playingCaptains];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const keep = new Set([shuffled[0].id, shuffled[1].id]);
      for (const p of players) {
        if (p.isCaptain && !keep.has(p.id)) p.isCaptain = false;
      }
    }
    // If 0, 1, or already exactly 2: leave as-is. Distribution loop below
    // handles "exactly 2" → split per team; otherwise treats them as regulars.
  }

  // Distribute captains FIRST — if exactly 2 captains are playing, assign one
  // to each team. If 1, 3+, or 0 captains, treat them as regular players.
  const captains = players.filter((p) => p.isCaptain);
  const assignedCaptainIds = new Set<string>();
  if (captains.length === 2) {
    // Put higher-scored captain on Team A, the other on Team B (for predictability)
    const [hi, lo] = [...captains].sort((a, b) => b.score - a.score);
    pushA(hi); pushB(lo);
    assignedCaptainIds.add(hi.id); assignedCaptainIds.add(lo.id);
  }

  // Distribute the rest by ROLE category priority (groups granular positions)
  const categoryOrder = ["goalkeeper", "defender", "midfielder", "forward", "any"];
  for (const cat of categoryOrder) {
    for (const p of players.filter((x) => categoryOf(x.position) === cat && !assignedCaptainIds.has(x.id))) {
      assign(p);
    }
  }

  // ── Avoid-pair violation counter ──
  // Counts how many "avoid" constraints are currently violated.
  // type="same"     → both members on the same team = 1 violation
  // type="opposing" → members on opposing teams      = 1 violation
  function countViolations(tA: PlayerEntry[], tB: PlayerEntry[]): number {
    if (avoidPairs.length === 0) return 0;
    const inA = new Set(tA.map((p) => p.id));
    const inB = new Set(tB.map((p) => p.id));
    let v = 0;
    for (const pair of avoidPairs) {
      const aOnA = inA.has(pair.memberAId);
      const aOnB = inB.has(pair.memberAId);
      const bOnA = inA.has(pair.memberBId);
      const bOnB = inB.has(pair.memberBId);
      // Skip if one of them isn't even playing
      if (!(aOnA || aOnB) || !(bOnA || bOnB)) continue;
      if (pair.type === "same" && ((aOnA && bOnA) || (aOnB && bOnB))) v++;
      else if (pair.type === "opposing" && ((aOnA && bOnB) || (aOnB && bOnA))) v++;
    }
    return v;
  }

  function gap() { return Math.abs(scoreA - scoreB); }

  // Per-category imbalance across teams. Lower = better position distribution.
  function categoryImbalance(tA: PlayerEntry[], tB: PlayerEntry[]): number {
    const countsA: Record<string, number> = {};
    const countsB: Record<string, number> = {};
    for (const p of tA) countsA[categoryOf(p.position)] = (countsA[categoryOf(p.position)] || 0) + 1;
    for (const p of tB) countsB[categoryOf(p.position)] = (countsB[categoryOf(p.position)] || 0) + 1;
    const cats = new Set([...Object.keys(countsA), ...Object.keys(countsB)]);
    let imbalance = 0;
    for (const c of cats) imbalance += Math.abs((countsA[c] || 0) - (countsB[c] || 0));
    return imbalance;
  }

  // Per-EXACT-position imbalance — penalises lopsided CB/LB/etc.
  function exactPositionImbalance(tA: PlayerEntry[], tB: PlayerEntry[]): number {
    const countsA: Record<string, number> = {};
    const countsB: Record<string, number> = {};
    for (const p of tA) countsA[p.position] = (countsA[p.position] || 0) + 1;
    for (const p of tB) countsB[p.position] = (countsB[p.position] || 0) + 1;
    const positions = new Set([...Object.keys(countsA), ...Object.keys(countsB)]);
    let imbalance = 0;
    for (const pos of positions) {
      if (pos === "any") continue; // utility players are flexible
      imbalance += Math.abs((countsA[pos] || 0) - (countsB[pos] || 0));
    }
    return imbalance;
  }

  // ── Multi-phase optimization ──
  // Goal: get score gap as close to 0 as possible (target ≤ 1 pt), while
  // preserving position balance as much as the composition allows.
  // Each phase relaxes constraints further so that even with incomplete
  // position rosters, the score gap converges.
  //
  // Phase 1: same category swaps (preserves role distribution exactly)
  // Phase 2: cross-category swaps that don't WORSEN the position imbalance
  // Phase 3: any swap allowed (last resort if still > 1 pt)
  //
  // In every phase: violations take priority over score gap (we won't
  // worsen avoid-pair violations to fix the score, and we will accept
  // worse score to fix a violation).
  function runOptimizationPhase(
    sameCategory: boolean,
    requireParity: boolean,
    targetGap: number,
  ): number {
    let iter = 0;
    const MAX = 300;
    while (iter < MAX) {
      iter++;
      let bestPair: { a: PlayerEntry; b: PlayerEntry } | null = null;
      let bestVDelta = 0;
      let bestGDelta = 0;
      const curV = countViolations(teamA, teamB);
      const curG = gap();
      const curImb = categoryImbalance(teamA, teamB);
      const curExactImb = exactPositionImbalance(teamA, teamB);
      // If we're already at target, stop early
      if (curG <= targetGap && curV === 0) break;
      for (const a of teamA) {
        for (const b of teamB) {
          if (a.isCaptain || b.isCaptain) continue;
          if (sameCategory && categoryOf(a.position) !== categoryOf(b.position)) continue;
          const newA = teamA.map((p) => (p === a ? b : p));
          const newB = teamB.map((p) => (p === b ? a : p));
          const newV = countViolations(newA, newB);
          const newImb = categoryImbalance(newA, newB);
          const newExactImb = exactPositionImbalance(newA, newB);
          // Phase 2 guard: don't worsen category OR exact-position imbalance
          if (requireParity && (newImb > curImb || newExactImb > curExactImb)) continue;
          const newGap = Math.abs(scoreA - a.score + b.score - (scoreB - b.score + a.score));
          const vDelta = newV - curV;
          const gDelta = newGap - curG;
          // Decision: violations first, then score gap
          const isBetter =
            vDelta < bestVDelta - 0.0001 ||
            (Math.abs(vDelta - bestVDelta) < 0.0001 && gDelta < bestGDelta - 0.0001);
          if (isBetter && (vDelta < 0 || (vDelta === 0 && gDelta < 0))) {
            bestVDelta = vDelta;
            bestGDelta = gDelta;
            bestPair = { a, b };
          }
        }
      }
      if (!bestPair) break;
      const iA = teamA.indexOf(bestPair.a);
      const iB = teamB.indexOf(bestPair.b);
      teamA[iA] = bestPair.b;
      teamB[iB] = bestPair.a;
      scoreA = scoreA - bestPair.a.score + bestPair.b.score;
      scoreB = scoreB - bestPair.b.score + bestPair.a.score;
    }
    return iter;
  }

  const TARGET_GAP = 1.0;
  // We escalate to a more permissive phase if EITHER the score gap is still
  // above target OR there is an unresolved avoid-pair violation. A clash
  // between two players of different positions can't be fixed by same-category
  // swaps, so we must allow cross-category swaps even when the score is fine.
  const notDone = () => gap() > TARGET_GAP || countViolations(teamA, teamB) > 0;
  let totalIter = 0;
  // Phase 1: strict — same category swaps only
  totalIter += runOptimizationPhase(true, false, TARGET_GAP);
  // Phase 2: cross-category allowed, but only if position imbalance doesn't worsen
  if (notDone()) {
    totalIter += runOptimizationPhase(false, true, TARGET_GAP);
  }
  // Phase 3: any swap — last resort to clear violations / get under 1 pt
  if (notDone()) {
    totalIter += runOptimizationPhase(false, false, TARGET_GAP);
  }

  return {
    teamA,
    teamB,
    scoreA: Math.round(scoreA * 10) / 10,
    scoreB: Math.round(scoreB * 10) / 10,
    difference: Math.round(Math.abs(scoreA - scoreB) * 10) / 10,
    optimizationIterations: totalIter,
    avoidViolations: countViolations(teamA, teamB),
  };
}
