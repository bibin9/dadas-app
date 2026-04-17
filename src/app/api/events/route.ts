import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: {
      dues: { include: { member: true } },
      payments: { include: { member: true } },
    },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const { name, date, perHeadFee, notes, memberIds, type, totalCost, payments, guestNames } = await req.json();

  // Prevent duplicate match on the same day
  if (type === "match") {
    const matchDate = new Date(date);
    const startOfDay = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const existing = await prisma.event.findFirst({
      where: { type: "match", date: { gte: startOfDay, lt: endOfDay } },
    });
    if (existing) {
      return NextResponse.json({ error: `A match already exists for this date (${existing.name}). Delete it first or pick a different date.` }, { status: 409 });
    }
  }

  // guestNames: string[] — create temporary guest members
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
  const fee = perHeadFee;

  // payments: [{ memberId, amount, method }] — optional inline payments
  const parsedPayments = (payments || []) as { memberId: string; amount: number; method: string }[];

  // Create event
  const event = await prisma.event.create({
    data: {
      name,
      type: type || "event",
      date: new Date(date),
      perHeadFee: fee,
      totalCost: totalCost || 0,
      notes: notes || "",
      dues: {
        create: allMemberIds.map((memberId) => ({
          memberId,
          amount: fee,
        })),
      },
    },
    include: { dues: { include: { member: true } } },
  });

  // Create payment records for members who paid
  if (parsedPayments.length > 0) {
    await prisma.payment.createMany({
      data: parsedPayments.map((p) => ({
        memberId: p.memberId,
        amount: p.amount,
        method: p.method || "cash",
        reference: `${event.name} - ${new Date(date).toLocaleDateString()}`,
        notes: "",
        date: new Date(date),
        eventId: event.id,
      })),
    });
  }

  return NextResponse.json(event);
}
