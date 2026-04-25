import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Combined endpoint: returns payments, active members, and events in one call
export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";
  const category = profile === "bigticket" ? "bigticket" : "dadas";

  // Get settings for Big Ticket group filtering
  const settings = await prisma.settings.findUnique({ where: { id: "main" } });

  // Build member filter for Big Ticket
  let memberFilter: { active: true; id?: { in: string[] } } = { active: true };
  if (profile === "bigticket" && settings?.bigTicketGroupId) {
    const groupMembers = await prisma.memberGroupMember.findMany({
      where: { groupId: settings.bigTicketGroupId },
      select: { memberId: true },
    });
    memberFilter = { active: true, id: { in: groupMembers.map((gm) => gm.memberId) } };
  }

  const [payments, members, events] = await Promise.all([
    prisma.payment.findMany({
      where: { category },
      orderBy: { date: "desc" },
      select: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        notes: true,
        date: true,
        category: true,
        member: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, date: true, type: true } },
      },
    }),
    prisma.member.findMany({ where: memberFilter, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    profile === "dadas"
      ? prisma.event.findMany({ orderBy: { date: "desc" }, select: { id: true, name: true, date: true, type: true } })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({ payments, members, events });
}
