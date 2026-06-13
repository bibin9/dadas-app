import { NextRequest, NextResponse } from "next/server";
import { buildTeams } from "@/lib/team-balancer";

// ADMIN endpoint (auth-protected by middleware). Returns FULL team data
// including per-player scores, skill tiers and the point difference — for the
// authenticated treasurer's view only.
export async function POST(req: NextRequest) {
  const { playerIds, guestPlayers, autoCaptain } = await req.json();
  const result = await buildTeams(playerIds as string[], guestPlayers, autoCaptain);
  return NextResponse.json(result);
}
