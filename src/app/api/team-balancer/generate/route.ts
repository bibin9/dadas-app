import { NextRequest, NextResponse } from "next/server";
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

interface PlayerEntry {
  id: string;
  name: string;
  skillTier: string;
  ageGroup: string;
  position: string;
  score: number;
  isGuest: boolean;
  isCaptain: boolean;
}

// Availability modifier: tired players play below their usual level.
const AVAILABILITY_MODIFIERS: Record<string, number> = {
  fit: 0,
  tired: -0.5,
  injured: 0, // injured players are excluded entirely, not just modified
};

// Score = base skill + age + position + availability + recent form
function calculateScore(
  skillTier: string,
  ageGroup: string,
  position: string,
  availability = "fit",
  recentFormMod = 0,
): number {
  const base = SKILL_WEIGHTS[skillTier] ?? 3;
  const ageMod = AGE_MODIFIERS[ageGroup] ?? 0;
  const posMod = POSITION_MODIFIERS[position] ?? 0;
  const availMod = AVAILABILITY_MODIFIERS[availability] ?? 0;
  return Math.round((base + ageMod + posMod + availMod + recentFormMod) * 10) / 10;
}

export async function POST(req: NextRequest) {
  const { playerIds, guestPlayers, autoCaptain } = await req.json();

  const [members, recentSheets, avoidPairs] = await Promise.all([
    prisma.member.findMany({
      where: { id: { in: playerIds as string[] } },
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
    const formMod = recentFormModifier(m.id);
    players.push({
      id: m.id,
      name: m.name,
      skillTier,
      ageGroup,
      position,
      score: calculateScore(skillTier, ageGroup, position, availability, formMod),
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
      players.push({
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: g.name,
        skillTier,
        ageGroup,
        position,
        score: calculateScore(skillTier, ageGroup, position),
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
  // Track per-position counts so we distribute specialists evenly across teams
  const posCountA: Record<string, number> = {};
  const posCountB: Record<string, number> = {};

  // Assign helper: pick the team that keeps:
  //  1) team size balanced (most important — max diff of 1)
  //  2) position count balanced (so one team isn't all defenders)
  //  3) total score balanced
  function assign(p: PlayerEntry) {
    const cat = categoryOf(p.position);
    const sizeA = teamA.length;
    const sizeB = teamB.length;
    if (sizeA < sizeB) {
      teamA.push(p); scoreA += p.score;
      posCountA[cat] = (posCountA[cat] || 0) + 1;
      return;
    }
    if (sizeB < sizeA) {
      teamB.push(p); scoreB += p.score;
      posCountB[cat] = (posCountB[cat] || 0) + 1;
      return;
    }
    // Sizes equal — prefer the team with fewer of this player's role category
    const posA = posCountA[cat] || 0;
    const posB = posCountB[cat] || 0;
    if (posA < posB) {
      teamA.push(p); scoreA += p.score; posCountA[cat] = posA + 1;
      return;
    }
    if (posB < posA) {
      teamB.push(p); scoreB += p.score; posCountB[cat] = posB + 1;
      return;
    }
    // Role count equal too — assign to the lower-scoring team
    if (scoreA <= scoreB) {
      teamA.push(p); scoreA += p.score; posCountA[cat] = posA + 1;
    } else {
      teamB.push(p); scoreB += p.score; posCountB[cat] = posB + 1;
    }
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
    teamA.push(hi); scoreA += hi.score; posCountA[hi.position] = (posCountA[hi.position] || 0) + 1;
    teamB.push(lo); scoreB += lo.score; posCountB[lo.position] = (posCountB[lo.position] || 0) + 1;
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

  // ── Optimization pass ──
  // The greedy assignment can leave a score gap AND avoid-pair violations.
  // Try every same-position swap (A↔B) and keep the one that BEST improves
  // the result. Priority: reduce violations first, then reduce score gap.
  // Hard caps: team size stays equal, captains stay where they are.
  function gap() { return Math.abs(scoreA - scoreB); }
  let iterations = 0;
  const MAX_ITER = 300;
  while (iterations < MAX_ITER) {
    iterations++;
    let bestPair: { a: PlayerEntry; b: PlayerEntry } | null = null;
    let bestViolationDelta = 0;   // negative = fewer violations after swap
    let bestGapDelta = 0;         // negative = smaller gap after swap
    const currentViolations = countViolations(teamA, teamB);
    const currentGap = gap();
    for (const a of teamA) {
      for (const b of teamB) {
        if (a.isCaptain || b.isCaptain) continue;
        // Same ROLE category (CB↔LB OK — both defenders; CB↔ST not OK)
        if (categoryOf(a.position) !== categoryOf(b.position)) continue;
        // Hypothetical post-swap teams
        const newA = teamA.map((p) => (p === a ? b : p));
        const newB = teamB.map((p) => (p === b ? a : p));
        const newViolations = countViolations(newA, newB);
        const newScoreA = scoreA - a.score + b.score;
        const newScoreB = scoreB - b.score + a.score;
        const newGap = Math.abs(newScoreA - newScoreB);
        const vDelta = newViolations - currentViolations;
        const gDelta = newGap - currentGap;
        // Priority: pick swaps that reduce violations OR
        // (same violations AND reduce gap)
        const better =
          vDelta < bestViolationDelta - 0.0001 ||
          (Math.abs(vDelta - bestViolationDelta) < 0.0001 && gDelta < bestGapDelta - 0.0001);
        if (better && (vDelta < 0 || (vDelta === 0 && gDelta < 0))) {
          bestViolationDelta = vDelta;
          bestGapDelta = gDelta;
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

  return NextResponse.json({
    teamA,
    teamB,
    scoreA: Math.round(scoreA * 10) / 10,
    scoreB: Math.round(scoreB * 10) / 10,
    difference: Math.round(Math.abs(scoreA - scoreB) * 10) / 10,
    optimizationIterations: iterations,
    avoidViolations: countViolations(teamA, teamB),
  });
}
