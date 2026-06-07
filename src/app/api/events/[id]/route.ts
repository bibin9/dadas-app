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
  // Dedupe-on-add: reuse existing guest with the same name (case-insensitive)
  // instead of creating a new duplicate record.
  const guestIds: string[] = [];
  if (guestNames && guestNames.length > 0) {
    const existingGuests = await prisma.member.findMany({
      where: { isGuest: true },
      select: { id: true, name: true },
    });
    const guestByLowerName = new Map<string, string>();
    for (const g of existingGuests) guestByLowerName.set(g.name.trim().toLowerCase(), g.id);

    for (const guestName of guestNames as string[]) {
      const trimmed = (guestName || "").trim();
      if (!trimmed) continue;
      const existingId = guestByLowerName.get(trimmed.toLowerCase());
      if (existingId) {
        guestIds.push(existingId);
      } else {
        const guest = await prisma.member.create({
          data: { name: trimmed, isGuest: true, active: false },
        });
        guestIds.push(guest.id);
        guestByLowerName.set(trimmed.toLowerCase(), guest.id);
      }
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
