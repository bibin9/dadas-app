import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUBLIC, read-only endpoint for the shareable /teams page.
// Returns ONLY non-rating info: member names and the captain flag (captains
// are shown on the shared team sheet anyway). It deliberately does NOT expose
// skill tier, position, ball control, running speed, age group, availability/
// fitness or any score — members must never see how anyone is rated.
export async function GET() {
  const [members, skills, guests] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      select: { id: true, name: true, active: true },
    }),
    prisma.playerSkill.findMany({
      select: { memberId: true, isCaptain: true },
    }),
    // Saved (reusable) guests — names only, so they can be tapped into a match.
    // No ratings exposed; the server scores them when teams are built.
    prisma.member.findMany({
      where: { isGuest: true },
      select: { id: true, name: true },
    }),
  ]);
  return NextResponse.json({ members, skills, guests });
}
