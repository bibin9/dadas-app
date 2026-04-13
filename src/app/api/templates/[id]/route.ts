import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, type, amount, amountType, groupId, notes } = await req.json();
  const template = await prisma.eventTemplate.update({
    where: { id },
    data: {
      name: name.trim(),
      type: type || "event",
      amount: parseFloat(amount) || 0,
      amountType: amountType || "total",
      groupId: groupId || null,
      notes: notes || "",
    },
  });
  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.eventTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
