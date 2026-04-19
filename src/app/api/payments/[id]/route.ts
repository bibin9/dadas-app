import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { memberId, amount, method, reference, notes, date, eventId, category } = await req.json();

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      memberId,
      amount,
      method: method || "cash",
      reference: reference || "",
      notes: notes || "",
      date: new Date(date),
      eventId: eventId || null,
      category: category || "dadas",
    },
    include: { member: true, event: true },
  });

  return NextResponse.json(payment);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.payment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
