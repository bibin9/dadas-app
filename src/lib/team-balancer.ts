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
  ballControl: string;
  runningSpeed: string;
  passAccuracy: string;
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
  passAccuracy?: string;
}

export interface BuiltTeams {
  teamA: PlayerEntry[];
  teamB: PlayerEntry[];
  scoreA: number;
  scoreB: number;
  difference: number;
  optimizationIterations: number;
  avoidViolations: number;
  // Combined speed + ball-control distribution imbalance (0 = perfectly even).
  attributeImbalance: number;
  // Role-category + exact-position imbalance (0 = positions perfectly even).
  positionImbalance: number;
  // Teammate pairs repeated from the last 2 shared sheets (0 = fully fresh).
  repeatedPairs: number;
  // Teammate pairs that existed in those sheets and could still recur.
  repeatablePairs: number;
}

// Availability modifier. "halffit" covers the common case of a player who is
// sharp for the first half and fades after the break — half the penalty of
// someone who turns up tired for the whole match.
const AVAILABILITY_MODIFIERS: Record<string, number> = {
  fit: 0,
  halffit: -0.5,
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

// Passing accuracy — distinct from ball control: how reliably they find a
// team-mate, rather than how well they keep the ball.
const PASS_MODIFIERS: Record<string, number> = {
  poor: -0.75,
  weak: -0.5,
  ok: 0,
  good: 0.5,
  excellent: 1,
};

// Special rule: a Silver-tier player who is BOTH over 50 AND tired
// should be treated as Bronze (effective skill drop from being old + tired).
function effectiveSkillTier(skillTier: string, ageGroup: string, availability: string): string {
  if (skillTier === "silver" && ageGroup === "over50" && availability === "tired") {
    return "bronze";
  }
  return skillTier;
}

// Score = base skill + age + position + availability + ball control + speed
//         + pass accuracy + recent form
function calculateScore(
  skillTier: string,
  ageGroup: string,
  position: string,
  availability = "fit",
  ballControl = "ok",
  runningSpeed = "medium",
  passAccuracy = "ok",
  recentFormMod = 0,
): number {
  const tier = effectiveSkillTier(skillTier, ageGroup, availability);
  const base = SKILL_WEIGHTS[tier] ?? 3;
  const ageMod = AGE_MODIFIERS[ageGroup] ?? 0;
  const posMod = POSITION_MODIFIERS[position] ?? 0;
  const availMod = AVAILABILITY_MODIFIERS[availability] ?? 0;
  const bcMod = BALL_CONTROL_MODIFIERS[ballControl] ?? 0;
  const speedMod = SPEED_MODIFIERS[runningSpeed] ?? 0;
  const passMod = PASS_MODIFIERS[passAccuracy] ?? 0;
  return Math.round((base + ageMod + posMod + availMod + bcMod + speedMod + passMod + recentFormMod) * 10) / 10;
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

  // ── Repeat-avoidance memory ──
  // From the LAST 2 shared team sheets, collect every pair of players who were
  // TEAMMATES. Re-using those pairings is what makes teams feel "the same
  // again", so the optimizer treats each repeated pair as a small penalty.
  const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  const previousTeammatePairs = new Set<string>();
  for (const ts of recentSheets.slice(0, 2)) {
    for (const key of ["teamAIds", "teamBIds"] as const) {
      let side: string[] = [];
      try { side = JSON.parse(ts[key]) as string[]; } catch { continue; }
      for (let i = 0; i < side.length; i++) {
        for (let j = i + 1; j < side.length; j++) {
          previousTeammatePairs.add(pairKey(side[i], side[j]));
        }
      }
    }
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
    const passAccuracy = skill?.passAccuracy ?? "ok";
    const formMod = recentFormModifier(m.id);
    players.push({
      id: m.id,
      name: m.name,
      skillTier,
      ageGroup,
      position,
      ballControl,
      runningSpeed,
      passAccuracy,
      score: calculateScore(skillTier, ageGroup, position, availability, ballControl, runningSpeed, passAccuracy, formMod),
      isGuest: !!m.isGuest, // saved guests are members flagged isGuest
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
      // Same rule as members: an injured player does not get picked. Without
      // this the guest was not only placed but scored as fully fit, because
      // the "injured" modifier is 0 (it means excluded, not penalised).
      if (availability === "injured") continue;
      const runningSpeed = g.runningSpeed || "medium";
      const passAccuracy = g.passAccuracy || "ok";
      players.push({
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: g.name,
        skillTier,
        ageGroup,
        position,
        ballControl,
        runningSpeed,
        passAccuracy,
        score: calculateScore(skillTier, ageGroup, position, availability, ballControl, runningSpeed, passAccuracy),
        isGuest: true,
        isCaptain: false,
      });
    }
  }

  // autoCaptain mutates isCaptain, so remember the real flags to restore
  // before each attempt (otherwise attempt 2 inherits attempt 1's choices).
  const originalCaptains = new Map(players.map((p) => [p.id, p.isCaptain]));

  interface Attempt {
    teamA: PlayerEntry[];
    teamB: PlayerEntry[];
    scoreA: number;
    scoreB: number;
    gap: number;
    violations: number;
    repeated: number;
    attrImb: number;
    posImb: number;
    iterations: number;
    // Captain ids AS OF THIS ATTEMPT. Attempts share PlayerEntry objects and
    // each one re-picks captains, so a later attempt would otherwise overwrite
    // the flags of the candidate we end up choosing — which showed up as two
    // captains on one team and none on the other. Re-applied after selection.
    captainIds: string[];
  }

  // The scoring metrics are pure (they take both teams as arguments and read
  // only avoidPairs / previousTeammatePairs). We capture them from the first
  // attempt so the exhaustive search below can reuse them without duplicating
  // the logic.
  type Metric = (tA: PlayerEntry[], tB: PlayerEntry[]) => number;
  let metrics: { violations: Metric; cat: Metric; exact: Metric; attr: Metric; repeats: Metric } | null = null;

  // One full build: shuffle → distribute → optimise. Called several times so we
  // can pick the freshest of many equally-balanced solutions.
  function runAttempt(): Attempt {
  for (const p of players) p.isCaptain = originalCaptains.get(p.id) ?? false;
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
    // Tier 4: lower-scoring team (random when perfectly level, for variety)
    if (Math.abs(scoreA - scoreB) < 1e-9) {
      if (Math.random() < 0.5) pushA(p); else pushB(p);
    } else if (scoreA < scoreB) pushA(p); else pushB(p);
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

  // Generic bucket imbalance: how unevenly a categorical attribute is split.
  // 0 = each distinct value appears equally on both teams.
  function bucketImbalance(tA: PlayerEntry[], tB: PlayerEntry[], key: (p: PlayerEntry) => string): number {
    const ca: Record<string, number> = {};
    const cb: Record<string, number> = {};
    for (const p of tA) ca[key(p)] = (ca[key(p)] || 0) + 1;
    for (const p of tB) cb[key(p)] = (cb[key(p)] || 0) + 1;
    const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]);
    let s = 0;
    for (const k of keys) s += Math.abs((ca[k] || 0) - (cb[k] || 0));
    return s;
  }

  // Attribute distribution imbalance: speed + ball control + pass accuracy.
  // Lower = fast/slow players and each skill level are evenly spread, so one
  // team can't end up with all the accurate passers.
  function attributeImbalance(tA: PlayerEntry[], tB: PlayerEntry[]): number {
    return (
      bucketImbalance(tA, tB, (p) => p.runningSpeed) +
      bucketImbalance(tA, tB, (p) => p.ballControl) +
      bucketImbalance(tA, tB, (p) => p.passAccuracy)
    );
  }

  // How many teammate pairs repeat from the last 2 shared team sheets.
  // 0 = nobody is paired with the same teammate as last time.
  function repeatPairs(tA: PlayerEntry[], tB: PlayerEntry[]): number {
    if (previousTeammatePairs.size === 0) return 0;
    let n = 0;
    for (const side of [tA, tB]) {
      for (let i = 0; i < side.length; i++) {
        for (let j = i + 1; j < side.length; j++) {
          if (previousTeammatePairs.has(pairKey(side[i].id, side[j].id))) n++;
        }
      }
    }
    return n;
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
      let tieCount = 0;
      const curV = countViolations(teamA, teamB);
      const curG = gap();
      const curImb = categoryImbalance(teamA, teamB);
      const curExactImb = exactPositionImbalance(teamA, teamB);
      // If we're already at target, stop early
      if (curG <= targetGap && curV === 0) break;
      for (const a of teamA) {
        for (const b of teamB) {
          // Only the two captains actually pinned one-per-team are locked.
          // Any other flagged captain stays swappable — otherwise a pool where
          // most players are flagged would freeze the optimiser completely.
          if (assignedCaptainIds.has(a.id) || assignedCaptainIds.has(b.id)) continue;
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
          const isTie =
            bestPair !== null &&
            Math.abs(vDelta - bestVDelta) < 0.0001 &&
            Math.abs(gDelta - bestGDelta) < 0.0001;
          if (isBetter && (vDelta < 0 || (vDelta === 0 && gDelta < 0))) {
            bestVDelta = vDelta;
            bestGDelta = gDelta;
            bestPair = { a, b };
            tieCount = 1;
          } else if (isTie && (vDelta < 0 || (vDelta === 0 && gDelta < 0))) {
            // Equally good swap — reservoir-sample so different runs explore
            // different (equally balanced) solutions instead of all
            // converging on the identical line-up every week.
            tieCount++;
            if (Math.random() < 1 / tieCount) bestPair = { a, b };
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

  // ── Attribute-equalization phase ──
  // Runs AFTER score balancing. Spreads running speed and ball-control levels
  // (plus position) evenly across the teams using only swaps that:
  //   • never add an avoid-pair violation, and
  //   • never push the score gap above target (and never make it worse than it
  //     already is, for impossible-roster cases that can't reach ≤1 pt).
  // It strictly reduces the combined distribution+position imbalance, so the
  // score balance and equal headcount achieved earlier are fully preserved.
  // Pure balance measure — positions + speed + ball control only. Repeat
  // avoidance is deliberately NOT mixed in here: a balanced team with even
  // positions and points is the first priority, so nothing may be traded
  // away for variety. Freshness is handled afterwards, for free, in
  // runFreshnessPhase below.
  function combinedImbalance(tA: PlayerEntry[], tB: PlayerEntry[]): number {
    return (
      attributeImbalance(tA, tB) +
      categoryImbalance(tA, tB) +
      exactPositionImbalance(tA, tB)
    );
  }
  function runEqualizationPhase(targetGap: number): number {
    let iter = 0;
    const MAX = 300;
    while (iter < MAX) {
      iter++;
      const curV = countViolations(teamA, teamB);
      const curG = gap();
      const curImb = combinedImbalance(teamA, teamB);
      const cap = Math.max(targetGap, curG); // don't worsen score beyond where it is
      let bestPair: { a: PlayerEntry; b: PlayerEntry } | null = null;
      let bestDelta = 0;            // must strictly reduce imbalance
      let bestGap = Infinity;       // tie-break: prefer the tighter score gap
      let tieCount = 0;
      for (const a of teamA) {
        for (const b of teamB) {
          // Only the two captains actually pinned one-per-team are locked.
          // Any other flagged captain stays swappable — otherwise a pool where
          // most players are flagged would freeze the optimiser completely.
          if (assignedCaptainIds.has(a.id) || assignedCaptainIds.has(b.id)) continue;
          const newA = teamA.map((p) => (p === a ? b : p));
          const newB = teamB.map((p) => (p === b ? a : p));
          if (countViolations(newA, newB) > curV) continue; // never add violations
          const newGap = Math.abs(scoreA - a.score + b.score - (scoreB - b.score + a.score));
          if (newGap > cap + 1e-9) continue; // keep score within budget (≤ 1 pt)
          const delta = combinedImbalance(newA, newB) - curImb;
          if (delta > -1e-9) continue; // skip swaps that don't improve distribution
          // Better = bigger distribution gain; tie → smaller resulting score gap.
          if (delta < bestDelta - 1e-9 || (Math.abs(delta - bestDelta) < 1e-9 && newGap < bestGap - 1e-9)) {
            bestDelta = delta; bestGap = newGap; bestPair = { a, b }; tieCount = 1;
          } else if (bestPair && Math.abs(delta - bestDelta) < 1e-9 && Math.abs(newGap - bestGap) < 1e-9) {
            // Equally good — sample randomly so runs explore different
            // equally-balanced line-ups rather than always the same one.
            tieCount++;
            if (Math.random() < 1 / tieCount) bestPair = { a, b };
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

  // ── Freshness phase (runs last, never costs balance) ──
  // Breaks up teammate pairings repeated from the last 2 shared sheets, but
  // ONLY via swaps that keep the score gap within budget, keep avoid-pair
  // violations no worse, and leave the position/attribute spread EQUAL OR
  // BETTER. If no such free swap exists, teams are left exactly as balanced
  // as they were — balance always wins over variety.
  function runFreshnessPhase(targetGap: number): number {
    if (previousTeammatePairs.size === 0) return 0;
    let iter = 0;
    const MAX = 200;
    while (iter < MAX) {
      iter++;
      const curV = countViolations(teamA, teamB);
      const curG = gap();
      // Guard on what actually matters for a fair match: the same number of
      // keepers/defenders/midfielders/forwards, and an even spread of speed
      // and ball control. Exact-role parity (one LB each, one CDM each) is
      // deliberately NOT guarded here — with singleton roles it pins the
      // line-up to a single split and would block all variety.
      const balanceGuard = (tA: PlayerEntry[], tB: PlayerEntry[]) =>
        categoryImbalance(tA, tB) + attributeImbalance(tA, tB);
      const curImb = balanceGuard(teamA, teamB);
      const curRep = repeatPairs(teamA, teamB);
      const cap = Math.max(targetGap, curG);
      let bestPair: { a: PlayerEntry; b: PlayerEntry } | null = null;
      let bestRep = curRep;
      let bestGap = Infinity;
      for (const a of teamA) {
        for (const b of teamB) {
          // Only the two captains actually pinned one-per-team are locked.
          // Any other flagged captain stays swappable — otherwise a pool where
          // most players are flagged would freeze the optimiser completely.
          if (assignedCaptainIds.has(a.id) || assignedCaptainIds.has(b.id)) continue;
          const newA = teamA.map((p) => (p === a ? b : p));
          const newB = teamB.map((p) => (p === b ? a : p));
          if (countViolations(newA, newB) > curV) continue;      // no new clashes
          if (balanceGuard(newA, newB) > curImb) continue;        // balance must not worsen
          const newGap = Math.abs(scoreA - a.score + b.score - (scoreB - b.score + a.score));
          if (newGap > cap + 1e-9) continue;                      // stay within the point rule
          const rep = repeatPairs(newA, newB);
          if (rep < bestRep || (rep === bestRep && bestPair && newGap < bestGap - 1e-9)) {
            bestRep = rep; bestGap = newGap; bestPair = { a, b };
          }
        }
      }
      if (!bestPair || bestRep >= curRep) break;
      const iA = teamA.indexOf(bestPair.a);
      const iB = teamB.indexOf(bestPair.b);
      teamA[iA] = bestPair.b;
      teamB[iB] = bestPair.a;
      scoreA = scoreA - bestPair.a.score + bestPair.b.score;
      scoreB = scoreB - bestPair.b.score + bestPair.a.score;
    }
    return iter;
  }

  metrics = {
    violations: countViolations, cat: categoryImbalance, exact: exactPositionImbalance,
    attr: attributeImbalance, repeats: repeatPairs,
  };

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
  // Phase 4: equalize attribute distribution (speed / ball control / position)
  // without disturbing the score balance or violations achieved above.
  totalIter += runEqualizationPhase(TARGET_GAP);
  // Phase 5: break up repeated pairings — only where it costs no balance.
  totalIter += runFreshnessPhase(TARGET_GAP);

  return {
    teamA: [...teamA],
    teamB: [...teamB],
    scoreA,
    scoreB,
    gap: gap(),
    violations: countViolations(teamA, teamB),
    repeated: repeatPairs(teamA, teamB),
    attrImb: attributeImbalance(teamA, teamB),
    posImb: categoryImbalance(teamA, teamB) + exactPositionImbalance(teamA, teamB),
    iterations: totalIter,
    captainIds: players.filter((p) => p.isCaptain).map((p) => p.id),
  };
  } // end runAttempt

  // ── Multi-restart selection ──
  // A single run converges to one balanced split and stays there, so the same
  // faces keep ending up together. Instead we build several candidates (each
  // with its own shuffle) and pick the FRESHEST one that still satisfies the
  // hard rules. Variety is chosen only among already-valid line-ups, so equal
  // size and the ≤1 point gap are never traded away for it.
  const TARGET = 1.0;
  const RESTARTS = previousTeammatePairs.size > 0 ? 14 : 4;
  const candidates: Attempt[] = [];
  for (let i = 0; i < RESTARTS; i++) candidates.push(runAttempt());

  function better(x: Attempt, y: Attempt): boolean {
    // 1) fewer avoid-pair violations
    if (x.violations !== y.violations) return x.violations < y.violations;
    // 2) meeting the ≤1 point rule beats not meeting it
    const xOk = x.gap <= TARGET + 1e-9;
    const yOk = y.gap <= TARGET + 1e-9;
    if (xOk !== yOk) return xOk;
    // 3) if neither can meet it, the tighter gap wins
    if (!xOk && Math.abs(x.gap - y.gap) > 1e-9) return x.gap < y.gap;
    // 4) both valid → evenest spread of positions / speed / ball control.
    //    Balance is the first preference, so it outranks freshness.
    const xi = x.attrImb + x.posImb;
    const yi = y.attrImb + y.posImb;
    if (xi !== yi) return xi < yi;
    // 5) only among equally-balanced line-ups: fewest repeated pairings
    if (x.repeated !== y.repeated) return x.repeated < y.repeated;
    // 6) finally the tighter score gap
    return x.gap < y.gap;
  }

  let best = candidates[0];
  for (const c of candidates) if (better(c, best)) best = c;

  // Restore the captain flags that belonged to the CHOSEN line-up (later
  // attempts mutated the shared player objects).
  const bestCaptains = new Set(best.captainIds);
  for (const p of players) p.isCaptain = bestCaptains.has(p.id);

  // ── Exhaustive search for normal squad sizes ──
  // The swap optimiser is a hill-climb and can settle on a local optimum,
  // leaving a better-balanced split on the table (QA reproduced this at 8
  // players). For a typical turnout we can simply check EVERY possible split
  // and take the provably best one, which guarantees the tightest points gap
  // the squad allows. Falls back to the heuristic for very large turnouts.
  function exhaustiveBest(): Attempt | null {
    const n = players.length;
    if (n < 4 || n > 18 || !metrics) return null;
    const sizeA = Math.floor(n / 2);
    let total = 1;
    for (let i = 0; i < sizeA; i++) total = (total * (n - i)) / (i + 1);
    if (total > 60000) return null; // keep the request fast

    const caps = players.filter((p) => p.isCaptain).map((p) => p.id);
    const mustSplit = caps.length === 2 ? caps : null;
    const captainIds = players.map((p) => p.id).filter((id) => bestCaptains.has(id));
    const evenSplit = n % 2 === 0;

    let found: Attempt | null = null;
    const pick: number[] = [];

    const evaluate = () => {
      const inA = new Uint8Array(n);
      for (const i of pick) inA[i] = 1;
      const tA: PlayerEntry[] = [];
      const tB: PlayerEntry[] = [];
      let sA = 0;
      for (let i = 0; i < n; i++) {
        if (inA[i]) { tA.push(players[i]); sA += players[i].score; }
        else tB.push(players[i]);
      }
      if (mustSplit) {
        const aHas = tA.some((p) => p.id === mustSplit[0]) ? 1 : 0;
        const bHas = tA.some((p) => p.id === mustSplit[1]) ? 1 : 0;
        if (aHas === bHas) return; // both captains on the same side
      }
      let sB = 0;
      for (const p of tB) sB += p.score;
      const cand: Attempt = {
        teamA: tA, teamB: tB, scoreA: sA, scoreB: sB,
        gap: Math.abs(sA - sB),
        violations: metrics!.violations(tA, tB),
        repeated: metrics!.repeats(tA, tB),
        attrImb: metrics!.attr(tA, tB),
        posImb: metrics!.cat(tA, tB) + metrics!.exact(tA, tB),
        iterations: 0,
        captainIds,
      };
      // Random tie-break keeps variety among equally-optimal splits.
      if (!found || better(cand, found) || (!better(found, cand) && Math.random() < 0.5)) found = cand;
    };

    // Enumerate every choice of sizeA players. For an even split, pinning
    // player 0 to team A skips the mirror-image duplicate of each split.
    const start = evenSplit ? 1 : 0;
    if (evenSplit) pick.push(0);
    const need = evenSplit ? sizeA - 1 : sizeA;
    const rec = (from: number, left: number) => {
      if (left === 0) { evaluate(); return; }
      for (let i = from; i <= n - left; i++) {
        pick.push(i);
        rec(i + 1, left - 1);
        pick.pop();
      }
    };
    rec(start, need);
    return found;
  }

  const exhaustive = exhaustiveBest();
  if (exhaustive && better(exhaustive, best)) best = exhaustive;

  // ── Captain normalisation ──
  // The pool flag means "eligible to captain", NOT "is captain of this match".
  // Without this, turning the auto-pick toggle OFF passed every pool flag
  // straight through, so a squad drawn from a pool where most players are
  // flagged came back with almost everyone wearing the armband. A team sheet
  // may only ever show ONE captain per side: keep the highest-rated eligible
  // player on each team and clear the rest.
  for (const side of [best.teamA, best.teamB]) {
    const caps = side.filter((p) => p.isCaptain).sort((a, b) => b.score - a.score);
    for (let i = 1; i < caps.length; i++) caps[i].isCaptain = false;
  }

  return {
    teamA: best.teamA,
    teamB: best.teamB,
    scoreA: Math.round(best.scoreA * 10) / 10,
    scoreB: Math.round(best.scoreB * 10) / 10,
    difference: Math.round(best.gap * 10) / 10,
    optimizationIterations: best.iterations,
    avoidViolations: best.violations,
    attributeImbalance: best.attrImb,
    positionImbalance: best.posImb,
    repeatedPairs: best.repeated,
    repeatablePairs: previousTeammatePairs.size,
  };
}
