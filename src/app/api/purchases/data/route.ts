import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [purchases, allMembers, groups, settings, templates, allSplits, allBigTicketPayments] =
    await Promise.all([
      prisma.purchase.findMany({
        orderBy: { date: "desc" },
        include: { splits: { include: { member: true } } },
      }),
      prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.memberGroup.findMany({
        include: { members: { include: { member: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.settings.findUnique({ where: { id: "main" } }),
      prisma.eventTemplate.findMany({ where: { type: "purchase" }, orderBy: { createdAt: "desc" } }),
      prisma.purchaseSplit.findMany({ select: { memberId: true, amount: true } }),
      prisma.payment.findMany({
        where: { category: "bigticket" },
        select: { memberId: true, amount: true },
      }),
    ]);

  // Compute lifetime Big Ticket balance per member:
  //   balance > 0 = owes money; balance < 0 = has credit
  const dueMap = new Map<string, number>();
  for (const s of allSplits) dueMap.set(s.memberId, (dueMap.get(s.memberId) || 0) + s.amount);
  const paidMap = new Map<string, number>();
  for (const p of allBigTicketPayments) paidMap.set(p.memberId, (paidMap.get(p.memberId) || 0) + p.amount);

  // Filter members to Big Ticket group if set
  const bigTicketGroupId = settings?.bigTicketGroupId || "";
  let scopedMembers = allMembers;
  if (bigTicketGroupId) {
    const group = groups.find((g) => g.id === bigTicketGroupId);
    if (group) {
      const groupMemberIds = new Set(group.members.map((gm) => gm.member.id));
      scopedMembers = allMembers.filter((m) => groupMemberIds.has(m.id));
    }
  }

  const membersWithBalance = scopedMembers.map((m) => {
    const totalDue = dueMap.get(m.id) || 0;
    const totalPaid = paidMap.get(m.id) || 0;
    return {
      ...m,
      balance: Math.round((totalDue - totalPaid) * 100) / 100,
    };
  });

  return NextResponse.json({
    purchases,
    members: membersWithBalance,
    groups,
    defaultShare: settings?.defaultBigTicketShare ?? 50,
    templates,
  });
}
