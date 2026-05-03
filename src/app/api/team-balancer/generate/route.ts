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
}

// Score = base skill + age modifier + position modifier
function calculateScore(skillTier: string, ageGroup: string, position: string): number {
  const base = SKILL_WEIGHTS[skillTier] ?? 3;
  const ageMod = AGE_MODIFIERS[ageGroup] ?? 0;
  const posMod = POSITION_MODIFIERS[position] ?? 0;
  return Math.round((base + ageMod + posMod) * 10) / 10;
}

export async function POST(req: NextRequest) {
  const { playerIds, guestPlayers } = await req.json();

  const members = await prisma.member.findMany({
    where: { id: { in: playerIds as string[] } },
    include: { skill: true },
  });

  const players: PlayerEntry[] = members.map((m) => {
    const skill = m.skill;
    const skillTier = skill?.skillTier ?? "silver";
    const ageGroup = normalizeAge(skill?.ageGroup ?? "age30to40");
    const position = skill?.position ?? "any";
    return {
      id: m.id,
      name: m.name,
      skillTier,
      ageGroup,
      position,
      score: calculateScore(skillTier, ageGroup, position),
      isGuest: false,
    };
  });

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

  // Distribute by position priority — GK first, then defenders, then mids/forwards, "any" last
  const positionOrder = ["goalkeeper", "defender", "midfielder", "forward", "any"];
  for (const pos of positionOrder) {
    for (const p of players.filter((x) => x.position === pos)) {
      assign(p);
    }
  }

  return NextResponse.json({
    teamA,
    teamB,
    scoreA: Math.round(scoreA * 10) / 10,
    scoreB: Math.round(scoreB * 10) / 10,
    difference: Math.round(Math.abs(scoreA - scoreB) * 10) / 10,
  });
}
