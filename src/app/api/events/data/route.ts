import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Combined endpoint: returns events, active members (with balances), settings, groups, templates
// Supports ?limit=N to cap recent events for faster loads
export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;

  const [events, members, settings, groups, templates, dueAgg, paidAgg] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "desc" },
      ...(take ? { take } : {}),
      include: {
        dues: {
          select: {
            id: true,
            amount: true,
            paid: true,
            member: { select: { id: true, name: true, isGuest: true } },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            member: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, isGuest: true },
    }),
    prisma.settings.findFirst({ where: { id: "main" } }),
    prisma.memberGroup.findMany({
      orderBy: { createdAt: "desc" },
      include: { members: { include: { member: { select: { id: true, name: true } } } } },
    }),
    prisma.eventTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.eventDue.groupBy({ by: ["memberId"], _sum: { amount: true } }),
    prisma.payment.groupBy({
      by: ["memberId"],
      where: { category: "dadas" },
      _sum: { amount: true },
    }),
  ]);

  // Compute balances using SQL-side aggregation
  const dueMap = new Map<string, number>();
  for (const d of dueAgg) dueMap.set(d.memberId, d._sum.amount || 0);
  const paidMap = new Map<string, number>();
  for (const p of paidAgg) paidMap.set(p.memberId, p._sum.amount || 0);
  const membersWithBalance = members.map((m) => {
    const totalDue = dueMap.get(m.id) || 0;
    const totalPaid = paidMap.get(m.id) || 0;
    return { ...m, balance: Math.round((totalDue - totalPaid) * 100) / 100 };
  });

  return NextResponse.json({
    events,
    members: membersWithBalance,
    settings: settings || { defaultMatchFee: 20, groupName: "Company" },
    groups,
    templates,
  });
}
