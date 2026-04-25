import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { dues: { include: { member: true } } },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, date, perHeadFee, totalCost, notes, memberIds, guestNames, payments } = await req.json();

  // Create guest members if any
  const guestIds: string[] = [];
  if (guestNames && guestNames.length > 0) {
    for (const guestName of guestNames as string[]) {
      if (!guestName.trim()) continue;
      const guest = await prisma.member.create({
        data: { name: guestName.trim(), isGuest: true, active: false },
      });
      guestIds.push(guest.id);
    }
  }

  const allMemberIds = [...(memberIds as string[]), ...guestIds];

  // Update event details
  await prisma.event.update({
    where: { id },
    data: {
      name,
      date: new Date(date),
      perHeadFee,
      totalCost: totalCost || 0,
      notes: notes || "",
    },
  });

  // Delete old dues and recreate
  await prisma.eventDue.deleteMany({ where: { eventId: id } });
  await prisma.eventDue.createMany({
    data: allMemberIds.map((memberId) => ({
      eventId: id,
      memberId,
      amount: perHeadFee,
    })),
  });

  // Sync inline payments: replace event-linked payments with the new set from the form
  if (Array.isArray(payments)) {
    const parsed = payments as { memberId: string; amount: number; method: string }[];
    await prisma.payment.deleteMany({ where: { eventId: id } });
    if (parsed.length > 0) {
      const eventDate = new Date(date);
      await prisma.payment.createMany({
        data: parsed.map((p) => ({
          memberId: p.memberId,
          amount: p.amount,
          method: p.method || "cash",
          reference: `${name} - ${eventDate.toLocaleDateString()}`,
          notes: "",
          date: eventDate,
          eventId: id,
          category: "dadas",
        })),
      });
    }
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: { dues: { include: { member: true } } },
  });

  return NextResponse.json(event);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
