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

// Position modifiers — small bonuses to recognise specialists.
// Goalkeepers + defenders get a slight defensive bonus, attackers offensive.
// "any" = utility player, no bonus.
const POSITION_MODIFIERS: Record<string, number> = {
  goalkeeper: 0.5,
  defender: 0.2,
  midfielder: 0.3,
  forward: 0.3,
  any: 0,
};

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
  const { playerIds, guestPlayers } = await req.json();

  const [members, recentSheets] = await Promise.all([
    prisma.member.findMany({
      where: { id: { in: playerIds as string[] } },
      include: { skill: true },
    }),
    // Last 5 TeamSheets — used to compute recent form (participation proxy)
    prisma.teamSheet.findMany({ orderBy: { date: "desc" }, take: 5, select: { teamAIds: true, teamBIds: true } }),
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
    const sizeA = teamA.length;
    const sizeB = teamB.length;
    if (sizeA < sizeB) {
      teamA.push(p); scoreA += p.score;
      posCountA[p.position] = (posCountA[p.position] || 0) + 1;
      return;
    }
    if (sizeB < sizeA) {
      teamB.push(p); scoreB += p.score;
      posCountB[p.position] = (posCountB[p.position] || 0) + 1;
      return;
    }
    // Sizes equal — prefer the team with fewer of this player's position
    const posA = posCountA[p.position] || 0;
    const posB = posCountB[p.position] || 0;
    if (posA < posB) {
      teamA.push(p); scoreA += p.score; posCountA[p.position] = posA + 1;
      return;
    }
    if (posB < posA) {
      teamB.push(p); scoreB += p.score; posCountB[p.position] = posB + 1;
      return;
    }
    // Position equal too — assign to the lower-scoring team
    if (scoreA <= scoreB) {
      teamA.push(p); scoreA += p.score; posCountA[p.position] = posA + 1;
    } else {
      teamB.push(p); scoreB += p.score; posCountB[p.position] = posB + 1;
    }
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

  // Distribute the rest by position priority
  const positionOrder = ["goalkeeper", "defender", "midfielder", "forward", "any"];
  for (const pos of positionOrder) {
    for (const p of players.filter((x) => x.position === pos && !assignedCaptainIds.has(x.id))) {
      assign(p);
    }
  }

  // ── Optimization pass ──
  // The greedy assignment can leave a score gap. Try every same-position swap
  // (A↔B) and keep the one that most reduces the gap. Repeat until no swap
  // improves it. Hard caps: team size stays equal (always), position count
  // never gets WORSE for either team. Result: gap typically ≤ 1-2 points.
  function gap() { return Math.abs(scoreA - scoreB); }
  let iterations = 0;
  const MAX_ITER = 200;
  while (iterations < MAX_ITER) {
    iterations++;
    let bestGain = 0;
    let bestPair: { a: PlayerEntry; b: PlayerEntry } | null = null;
    const currentGap = gap();
    for (const a of teamA) {
      for (const b of teamB) {
        // Don't swap captains apart — each team must keep exactly its captain
        if (a.isCaptain || b.isCaptain) continue;
        // Same position only (preserves position distribution)
        if (a.position !== b.position) continue;
        // Hypothetical new scores after swap
        const newScoreA = scoreA - a.score + b.score;
        const newScoreB = scoreB - b.score + a.score;
        const newGap = Math.abs(newScoreA - newScoreB);
        const gain = currentGap - newGap;
        if (gain > bestGain + 0.0001) {
          bestGain = gain;
          bestPair = { a, b };
        }
      }
    }
    if (!bestPair) break;
    // Apply best swap
    const iA = teamA.indexOf(bestPair.a);
    const iB = teamB.indexOf(bestPair.b);
    teamA[iA] = bestPair.b;
    teamB[iB] = bestPair.a;
    scoreA = scoreA - bestPair.a.score + bestPair.b.score;
    scoreB = scoreB - bestPair.b.score + bestPair.a.score;
    // pos counts unchanged (same position swap)
  }

  return NextResponse.json({
    teamA,
    teamB,
    scoreA: Math.round(scoreA * 10) / 10,
    scoreB: Math.round(scoreB * 10) / 10,
    difference: Math.round(Math.abs(scoreA - scoreB) * 10) / 10,
    optimizationIterations: iterations,
  });
}
