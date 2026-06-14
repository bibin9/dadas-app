import { NextRequest, NextResponse } from "next/server";
import { buildTeams, PlayerEntry } from "@/lib/team-balancer";

// PUBLIC endpoint for the shareable /teams page.
// Runs the SAME balancing algorithm (so avoid-pairs, captains, ratings all
// still influence the result server-side) but strips every rating signal from
// the response: no scores, no skill tiers, no positions, no point difference.
// Members can only ever see names + who's a captain — never any rating.
function strip(p: PlayerEntry) {
  return { id: p.id, name: p.name, isCaptain: p.isCaptain, isGuest: p.isGuest };
}

export async function POST(req: NextRequest) {
  const { playerIds, guestPlayers, autoCaptain } = await req.json();
  const r = await buildTeams(playerIds as string[], guestPlayers, autoCaptain);
  return NextResponse.json({
    teamA: r.teamA.map(strip),
    teamB: r.teamB.map(strip),
    // Whether the two teams have an equal number of players — purely structural,
    // not a rating. Lets the UI confirm a fair split without revealing strength.
    balanced: r.teamA.length === r.teamB.length || Math.abs(r.teamA.length - r.teamB.length) <= 1,
    // Aggregate evenness of speed + ball-control spread (0 = perfectly even).
    // A single count of mismatches — does NOT reveal any individual's rating.
    attributeSpread: r.attributeImbalance,
    // Aggregate evenness of positions across teams (0 = perfectly even).
    positionSpread: r.positionImbalance,
    // Confirms the teams are within the 1-point strength rule. A boolean only —
    // does NOT reveal the actual scores or any individual's rating.
    withinOnePoint: r.difference <= 1.0001,
  });
}
