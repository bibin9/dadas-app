import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUBLIC, read-only endpoint for the shareable /teams page.
// Returns ONLY non-rating info: member names, captain flag, and availability
// (so injured players can be greyed out). It deliberately does NOT expose
// skill tier, position, ball control, age group or any score — members must
// never be able to see how anyone is rated.
export async function GET() {
  const [members, skills] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      select: { id: true, name: true, active: true },
    }),
    prisma.playerSkill.findMany({
      select: { memberId: true, isCaptain: true, availability: true },
    }),
  ]);
  return NextResponse.json({ members, skills });
}
