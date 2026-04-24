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

// Normalize legacy age values
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

function calculateScore(skillTier: string, ageGroup: string): number {
  const base = SKILL_WEIGHTS[skillTier] ?? 3;
  const modifier = AGE_MODIFIERS[ageGroup] ?? 0;
  return base + modifier;
}

export async function POST(req: NextRequest) {
  const { playerIds, guestPlayers } = await req.json();

  // Fetch selected members with their skills
  const members = await prisma.member.findMany({
    where: { id: { in: playerIds as string[] } },
    include: { skill: true },
  });

  // Build player entries
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
      score: calculateScore(skillTier, ageGroup),
      isGuest: false,
    };
  });

  // Add guest players
  if (guestPlayers && Array.isArray(guestPlayers)) {
    for (const g of guestPlayers) {
      const ageGroup = normalizeAge(g.ageGroup || "age30to40");
      const skillTier = g.skillTier || "silver";
      players.push({
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: g.name,
        skillTier,
        ageGroup,
        position: "any",
        score: calculateScore(skillTier, ageGroup),
        isGuest: true,
      });
    }
  }

  // Shuffle for randomness, then stable-sort by score desc
  // so equal-scored players randomize between runs
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  players.sort((a, b) => b.score - a.score);

  // Separate goalkeepers and non-goalkeepers
  const goalkeepers = players.filter((p) => p.position === "goalkeeper");
  const nonGoalkeepers = players.filter((p) => p.position !== "goalkeeper");

  const teamA: PlayerEntry[] = [];
  const teamB: PlayerEntry[] = [];
  let scoreA = 0;
  let scoreB = 0;

  // Helper: assign a player to the team that keeps BOTH size and score balanced
  function assign(p: PlayerEntry) {
    // Primary: keep team sizes equal (max diff of 1)
    if (teamA.length < teamB.length) {
      teamA.push(p); scoreA += p.score;
    } else if (teamB.length < teamA.length) {
      teamB.push(p); scoreB += p.score;
    } else {
      // Equal sizes — assign to the lower-scoring team
      if (scoreA <= scoreB) {
        teamA.push(p); scoreA += p.score;
      } else {
        teamB.push(p); scoreB += p.score;
      }
    }
  }

  // Distribute goalkeepers alternately (they go first so each team gets one if possible)
  goalkeepers.forEach((gk) => assign(gk));

  // Distribute the rest using size-first, then score-balance
  for (const p of nonGoalkeepers) {
    assign(p);
  }

  return NextResponse.json({
    teamA,
    teamB,
    scoreA: Math.round(scoreA * 10) / 10,
    scoreB: Math.round(scoreB * 10) / 10,
    difference: Math.round(Math.abs(scoreA - scoreB) * 10) / 10,
  });
}
