import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const take = limitParam ? parseInt(limitParam, 10) : undefined;

  const [events, members, settings, groups, templates, allDues, allPayments] = await Promise.all([
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
    prisma.eventDue.findMany({ select: { memberId: true, amount: true } }),
    prisma.payment.findMany({ where: { category: "dadas" }, select: { memberId: true, amount: true } }),
  ]);

  // Compute member balances by aggregating in JS (libsql adapter compat)
  const dueMap = new Map<string, number>();
  for (const d of allDues) dueMap.set(d.memberId, (dueMap.get(d.memberId) || 0) + d.amount);
  const paidMap = new Map<string, number>();
  for (const p of allPayments) paidMap.set(p.memberId, (paidMap.get(p.memberId) || 0) + p.amount);
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
