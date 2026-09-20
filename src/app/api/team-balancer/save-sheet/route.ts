import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Records the teams that were actually SHARED to WhatsApp, so the balancer can
// avoid repeating the same combinations next time.
//
// Reachable from the public /teams page (that's where teams get shared), so it
// is deliberately narrow: it only ever writes TeamSheet rows — never members,
// money, or skills — every id is validated against real members, and old rows
// are pruned so history can't grow without bound.
const KEEP_SHEETS = 30;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rawA: unknown = body.teamAIds;
  const rawB: unknown = body.teamBIds;
  if (!Array.isArray(rawA) || !Array.isArray(rawB)) {
    return NextResponse.json({ error: "teamAIds and teamBIds must be arrays" }, { status: 400 });
  }
  if (rawA.length > 40 || rawB.length > 40) {
    return NextResponse.json({ error: "Too many players" }, { status: 400 });
  }

  // Keep only ids that are real members. Ad-hoc guest entries carry synthetic
  // ids that change every generation, so they're useless as history anyway.
  const requested = [...rawA, ...rawB].filter((x): x is string => typeof x === "string");
  const known = await prisma.member.findMany({
    where: { id: { in: requested } },
    select: { id: true },
  });
  const valid = new Set(known.map((m) => m.id));
  const teamAIds = (rawA as string[]).filter((id) => valid.has(id));
  const teamBIds = (rawB as string[]).filter((id) => valid.has(id));

  if (teamAIds.length + teamBIds.length < 4) {
    return NextResponse.json({ error: "Not enough known players to record" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.slice(0, 80) : "Shared team";
  const teamAName = typeof body.teamAName === "string" ? body.teamAName.slice(0, 40) : "Team A";
  const teamBName = typeof body.teamBName === "string" ? body.teamBName.slice(0, 40) : "Team B";

  // De-duplicate: sharing the same line-up twice (double tap, or re-sharing
  // after only changing jersey colours) must not create a second row. Repeat
  // avoidance looks at the last 2 sheets, so duplicates would silently halve
  // the history it has to work with.
  const sig = (a: string[], b: string[]) =>
    [[...a].sort().join(","), [...b].sort().join(",")].sort().join("||");
  const newSig = sig(teamAIds, teamBIds);
  const latest = await prisma.teamSheet.findFirst({ orderBy: { date: "desc" } });
  if (latest) {
    try {
      const prevSig = sig(JSON.parse(latest.teamAIds), JSON.parse(latest.teamBIds));
      if (prevSig === newSig) {
        const updated = await prisma.teamSheet.update({
          where: { id: latest.id },
          data: { name, teamAName, teamBName, date: new Date() },
        });
        return NextResponse.json({ id: updated.id, saved: true, deduped: true });
      }
    } catch { /* malformed previous row — fall through and insert */ }
  }

  const sheet = await prisma.teamSheet.create({
    data: {
      name,
      date: new Date(),
      teamAName,
      teamBName,
      teamAIds: JSON.stringify(teamAIds),
      teamBIds: JSON.stringify(teamBIds),
      notes: "",
    },
  });

  // Prune anything beyond the most recent KEEP_SHEETS.
  const old = await prisma.teamSheet.findMany({
    orderBy: { date: "desc" },
    skip: KEEP_SHEETS,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.teamSheet.deleteMany({ where: { id: { in: old.map((s) => s.id) } } });
  }

  return NextResponse.json({ id: sheet.id, saved: true });
}
