import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [purchases, members, groups] = await Promise.all([
    prisma.purchase.findMany({
      orderBy: { date: "desc" },
      include: { splits: { include: { member: true } } },
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({ purchases, members, groups });
}
