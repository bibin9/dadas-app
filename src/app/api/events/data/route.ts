import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Combined endpoint: returns events, active members (with balances), settings, groups, and templates
export async function GET() {
  const [events, members, settings, groups, templates, allDues, allPayments] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "desc" },
      include: {
        dues: { include: { member: true } },
        payments: { include: { member: true } },
      },
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.settings.findFirst({ where: { id: "main" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.eventTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.eventDue.findMany(),
    prisma.payment.findMany({ where: { category: "dadas" } }),
  ]);

  // Compute balance per member: totalDue - totalPaid
  // Positive = owes (debit), Negative = credit (overpaid / advance)
  const dueByMember = new Map<string, number>();
  for (const d of allDues) {
    dueByMember.set(d.memberId, (dueByMember.get(d.memberId) || 0) + d.amount);
  }
  const paidByMember = new Map<string, number>();
  for (const p of allPayments) {
    paidByMember.set(p.memberId, (paidByMember.get(p.memberId) || 0) + p.amount);
  }
  const membersWithBalance = members.map((m) => {
    const totalDue = dueByMember.get(m.id) || 0;
    const totalPaid = paidByMember.get(m.id) || 0;
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
