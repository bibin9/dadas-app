import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Avoid-pair list — soft constraint for team generation.
 *   type = "same"     → don't put both on same team
 *   type = "opposing" → don't put them on opposing teams
 */
export async function GET() {
  const [pairs, members] = await Promise.all([
    prisma.avoidPair.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.member.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Attach member names for display
  const byId = new Map(members.map((m) => [m.id, m.name]));
  const enriched = pairs.map((p) => ({
    ...p,
    memberAName: byId.get(p.memberAId) || "(deleted)",
    memberBName: byId.get(p.memberBId) || "(deleted)",
  }));
  return NextResponse.json({ pairs: enriched, members });
}

export async function POST(req: NextRequest) {
  const { memberAId, memberBId, type, notes } = await req.json();
  if (!memberAId || !memberBId || memberAId === memberBId) {
    return NextResponse.json({ error: "Pick two different members" }, { status: 400 });
  }
  if (type !== "same" && type !== "opposing") {
    return NextResponse.json({ error: "type must be 'same' or 'opposing'" }, { status: 400 });
  }
  // Normalize order so (A,B) and (B,A) are treated as the same pair
  const [a, b] = [memberAId, memberBId].sort();
  // Reject if an identical pair already exists
  const existing = await prisma.avoidPair.findFirst({
    where: { memberAId: a, memberBId: b, type },
  });
  if (existing) {
    return NextResponse.json({ error: "This pair already exists" }, { status: 409 });
  }
  const pair = await prisma.avoidPair.create({
    data: { memberAId: a, memberBId: b, type, notes: notes || "" },
  });
  return NextResponse.json(pair);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.avoidPair.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
