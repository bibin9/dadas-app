import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const payments = await prisma.payment.findMany({
    orderBy: { date: "desc" },
    include: { member: true, event: true },
  });
  return NextResponse.json(payments);
}

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  await prisma.payment.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const { memberId, amount, method, reference, notes, date, eventId, category } = await req.json();

  const payment = await prisma.payment.create({
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
