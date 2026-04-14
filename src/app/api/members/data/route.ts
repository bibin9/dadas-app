import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [members, groups] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({ members, groups });
}
