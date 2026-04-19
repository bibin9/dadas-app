import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const skills = await prisma.playerSkill.findMany({
    include: { member: true },
  });
  return NextResponse.json(skills);
}

export async function POST(req: NextRequest) {
  const { memberId, skillTier, ageGroup, position } = await req.json();

  const skill = await prisma.playerSkill.upsert({
    where: { memberId },
    create: {
      memberId,
      skillTier: skillTier || "silver",
      ageGroup: ageGroup || "senior",
      position: position || "any",
    },
    update: {
      skillTier: skillTier || "silver",
      ageGroup: ageGroup || "senior",
      position: position || "any",
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(skill);
}
