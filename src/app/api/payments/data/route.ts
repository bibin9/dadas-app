import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Combined endpoint: returns payments, active members, and events in one call
export async function GET() {
  const [payments, members, events] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { date: "desc" },
      include: {
        member: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, date: true, type: true } },
      },
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.event.findMany({ orderBy: { date: "desc" }, select: { id: true, name: true, date: true, type: true } }),
  ]);

  return NextResponse.json({ payments, members, events });
}
