import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Saves a guest player so it can be reused next time without re-entering.
// A guest is a Member flagged isGuest=true and active=false — same convention
// the events autocomplete uses — so it never shows up in the active roster or
// any financial total (it has no dues/payments). Its attributes live on its
// PlayerSkill, so the balancer scores it exactly like a regular player.
//
// Dedupe: if a guest with the same (case-insensitive, trimmed) name already
// exists, we reuse it and just refresh its skill — no duplicate is created.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const skillData = {
    skillTier: body.skillTier || "silver",
    ageGroup: body.ageGroup || "age30to40",
    position: body.position || "any",
    ballControl: body.ballControl || "ok",
    runningSpeed: body.runningSpeed || "medium",
  };

  // Look for an existing guest by case-insensitive name match.
  const guests = await prisma.member.findMany({
    where: { isGuest: true },
    select: { id: true, name: true },
  });
  const existing = guests.find((g) => g.name.trim().toLowerCase() === name.toLowerCase());

  let member;
  if (existing) {
    member = await prisma.member.update({
      where: { id: existing.id },
      data: { name }, // normalise to the latest spelling/casing
    });
  } else {
    member = await prisma.member.create({
      data: { name, isGuest: true, active: false },
    });
  }

  await prisma.playerSkill.upsert({
    where: { memberId: member.id },
    create: { memberId: member.id, ...skillData },
    update: { ...skillData, updatedAt: new Date() },
  });

  return NextResponse.json(member);
}
