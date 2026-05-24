import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, phone, active } = await req.json();
  const member = await prisma.member.update({
    where: { id },
    data: { name, phone, active },
  });
  return NextResponse.json(member);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // libsql/Turso doesn't always enforce FK CASCADE reliably, so we explicitly
  // clean up all related records before deleting the member. Wrapped in a
  // transaction so it's all-or-nothing.
  try {
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { memberId: id } }),
      prisma.eventDue.deleteMany({ where: { memberId: id } }),
      prisma.purchaseSplit.deleteMany({ where: { memberId: id } }),
      prisma.memberGroupMember.deleteMany({ where: { memberId: id } }),
      prisma.playerSkill.deleteMany({ where: { memberId: id } }),
      prisma.member.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { error: "Delete failed", message: err.message },
      { status: 500 }
    );
  }
}
