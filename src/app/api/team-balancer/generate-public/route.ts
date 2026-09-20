import { NextRequest, NextResponse } from "next/server";
import { buildTeams, PlayerEntry, GuestInput } from "@/lib/team-balancer";
import { readJsonBody, badRequest } from "@/lib/http";

// PUBLIC endpoint for the shareable /teams page.
// Runs the SAME balancing algorithm (so avoid-pairs, captains, ratings all
// still influence the result server-side) but strips every rating signal from
// the response: no scores, no skill tiers, no positions, no point difference.
// Members can only ever see names + who's a captain — never any rating.
function strip(p: PlayerEntry) {
  return { id: p.id, name: p.name, isCaptain: p.isCaptain, isGuest: p.isGuest };
}

const MAX_PLAYERS = 80;

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (!body) return badRequest("Invalid JSON body");

  // Validate rather than cast: a bare {} used to balance the entire club, and
  // a non-array playerIds crashed the handler.
  const playerIds = Array.isArray(body.playerIds) ? (body.playerIds as unknown[]).filter((x): x is string => typeof x === "string") : null;
  if (!playerIds) return badRequest("playerIds must be an array");
  const guestPlayers = body.guestPlayers === undefined || body.guestPlayers === null
    ? []
    : Array.isArray(body.guestPlayers) ? (body.guestPlayers as GuestInput[]) : null;
  if (!guestPlayers) return badRequest("guestPlayers must be an array");
  if (playerIds.length + guestPlayers.length === 0) {
    return badRequest("Select at least one player");
  }
  if (playerIds.length + guestPlayers.length > MAX_PLAYERS) {
    return badRequest(`Too many players (max ${MAX_PLAYERS})`);
  }

  const r = await buildTeams(playerIds, guestPlayers, !!body.autoCaptain);
  return NextResponse.json({
    teamA: r.teamA.map(strip),
    teamB: r.teamB.map(strip),
    // Whether the two teams have an equal number of players — purely structural,
    // not a rating. Lets the UI confirm a fair split without revealing strength.
    balanced: r.teamA.length === r.teamB.length || Math.abs(r.teamA.length - r.teamB.length) <= 1,
  });
  // NOTE: attributeSpread / positionSpread / withinOnePoint were deliberately
  // REMOVED. Although each looked like a harmless aggregate, together with the
  // caller-controlled guestPlayers ratings they formed an oracle: pit one real
  // player against a guest of known strength and binary-search the guest until
  // withinOnePoint flips, and the player's hidden score falls out. A security
  // review recovered an exact rating this way with no login. Nothing derived
  // from the secret scores may be returned on the public route.
}
