import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PUBLIC, read-only endpoint for the shareable /teams page.
// Returns only what's needed to build teams (member names + their skills).
// No write capability — safe to expose without authentication.
export async function GET() {
  const [members, skills] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      select: { id: true, name: true, active: true },
    }),
    prisma.playerSkill.findMany(),
  ]);
  return NextResponse.json({ members, skills });
}
