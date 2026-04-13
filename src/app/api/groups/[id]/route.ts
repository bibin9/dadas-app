import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, memberIds } = await req.json();

  // Delete existing members and recreate
  await prisma.memberGroupMember.deleteMany({ where: { groupId: id } });
  const group = await prisma.memberGroup.update({
    where: { id },
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.memberGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
