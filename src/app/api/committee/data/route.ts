import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasCommitteeAccess } from "@/lib/auth";

// Full player pool for the team selection committee — READ ONLY.
// Unlike the public /teams endpoints (which strip every rating), this returns
// the actual ratings so the committee can sanity-check why teams balance the
// way they do. It is gated behind the committee password or an admin login,
// and exposes no financial data whatsoever.
export async function GET() {
  if (!(await hasCommitteeAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [members, skills, avoidPairs, sheets] = await Promise.all([
    prisma.member.findMany({
      select: { id: true, name: true, active: true, isGuest: true },
      orderBy: { name: "asc" },
    }),
    prisma.playerSkill.findMany(),
    prisma.avoidPair.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.teamSheet.findMany({
      orderBy: { date: "desc" },
      take: 5,
      select: { id: true, name: true, date: true, teamAName: true, teamBName: true, teamAIds: true, teamBIds: true },
    }),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));
  return NextResponse.json({
    members,
    skills,
    avoidPairs: avoidPairs.map((p) => ({
      ...p,
      memberAName: nameById.get(p.memberAId) ?? "(removed)",
      memberBName: nameById.get(p.memberBId) ?? "(removed)",
    })),
    sheets: sheets.map((s) => {
      const toNames = (json: string) => {
        try { return (JSON.parse(json) as string[]).map((id) => nameById.get(id) ?? "?"); }
        catch { return []; }
      };
      return {
        id: s.id, name: s.name, date: s.date,
        teamAName: s.teamAName, teamBName: s.teamBName,
        teamA: toNames(s.teamAIds), teamB: toNames(s.teamBIds),
      };
    }),
  });
}
