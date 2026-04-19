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

const AGE_MODIFIERS: Record<string, number> = {
  veteran: 0.5,
  senior: 0,
  youth: -0.3,
};

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
    const ageGroup = skill?.ageGroup ?? "senior";
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
      players.push({
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: g.name,
        skillTier: g.skillTier || "silver",
        ageGroup: g.ageGroup || "senior",
        position: "any",
        score: calculateScore(g.skillTier || "silver", g.ageGroup || "senior"),
        isGuest: true,
      });
    }
  }

  // Shuffle players with the same score for randomization
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    if (players[i].score === players[j].score) {
      [players[i], players[j]] = [players[j], players[i]];
    }
  }

  // Sort by score descending
  players.sort((a, b) => b.score - a.score);

  // Try to distribute goalkeepers evenly first
  const goalkeepers = players.filter((p) => p.position === "goalkeeper");
  const nonGoalkeepers = players.filter((p) => p.position !== "goalkeeper");

  const teamA: PlayerEntry[] = [];
  const teamB: PlayerEntry[] = [];

  // Distribute goalkeepers first
  goalkeepers.forEach((gk, i) => {
    if (i % 2 === 0) teamA.push(gk);
    else teamB.push(gk);
  });

  // Snake draft for remaining players
  let pickIndex = 0;
  for (const player of nonGoalkeepers) {
    const cycle = Math.floor(pickIndex / 2);
    const pos = pickIndex % 2;
    // Snake: even cycle = A first, odd cycle = B first
    if (cycle % 2 === 0) {
      if (pos === 0) teamA.push(player);
      else teamB.push(player);
    } else {
      if (pos === 0) teamB.push(player);
      else teamA.push(player);
    }
    pickIndex++;
  }

  const scoreA = teamA.reduce((sum, p) => sum + p.score, 0);
  const scoreB = teamB.reduce((sum, p) => sum + p.score, 0);

  return NextResponse.json({
    teamA,
    teamB,
    scoreA: Math.round(scoreA * 10) / 10,
    scoreB: Math.round(scoreB * 10) / 10,
    difference: Math.round(Math.abs(scoreA - scoreB) * 10) / 10,
  });
}
