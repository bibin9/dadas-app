import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const groups = await prisma.memberGroup.findMany({
    include: { members: { include: { member: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const { name, memberIds } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Group name required" }, { status: 400 });
  }
  const group = await prisma.memberGroup.create({
    data: {
      name: name.trim(),
      members: {
        create: (memberIds || []).map((memberId: string) => ({ memberId })),
      },
    },
    include: { members: { include: { member: true } } },
  });
  return NextResponse.json(group);
}
