import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";
  if (profile === "bigticket") return handleBigTicket();
  return handleDadas();
}

async function handleDadas() {
  // Run aggregations in parallel — no row-level loads
  const [
    members,
    settings,
    duesAgg,
    paymentsAgg,
    incomeAgg,
    expenseAgg,
    eventCostAgg,
  ] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.eventDue.groupBy({ by: ["memberId"], _sum: { amount: true } }),
    prisma.payment.groupBy({
      by: ["memberId"],
      where: { category: "dadas" },
      _sum: { amount: true },
    }),
    prisma.companyIncome.aggregate({ _sum: { amount: true } }),
    prisma.eventExpense.aggregate({ _sum: { amount: true } }),
    prisma.event.aggregate({ _sum: { totalCost: true } }),
  ]);

  const dueMap = new Map<string, number>();
  for (const d of duesAgg) dueMap.set(d.memberId, d._sum.amount || 0);
  const paidMap = new Map<string, number>();
  for (const p of paymentsAgg) paidMap.set(p.memberId, p._sum.amount || 0);

  const balances = members.map((m) => {
    const totalDue = dueMap.get(m.id) || 0;
    const totalPaid = paidMap.get(m.id) || 0;
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      totalDue,
      totalPaid,
      balance: totalDue - totalPaid,
    };
  });

  let totalReceived = 0;
  let totalOutstanding = 0;
  let totalCredits = 0;
  for (const b of balances) {
    totalReceived += b.totalPaid;
    if (b.balance > 0) totalOutstanding += b.balance;
    else if (b.balance < 0) totalCredits += -b.balance; // overpaid amount owed back to players
  }

  const totalIncome = incomeAgg._sum.amount || 0;
  const totalEventExpenses = expenseAgg._sum.amount || 0;
  const totalEventCosts = eventCostAgg._sum.totalCost || 0;
  const totalCosts = totalEventCosts + totalEventExpenses;

  // Group fund = all money on hand (received + company income - costs)
  // Player credits = portion of that money owed back to players (overpayments)
  // Company fund = group fund minus what we owe players back
  const groupFund = totalReceived + totalIncome - totalCosts;
  const companyFund = groupFund - totalCredits;

  return NextResponse.json({
    profile: "dadas",
    balances,
    totals: {
      totalReceived,
      totalCosts,
      totalEventCosts,
      totalEventExpenses,
      totalIncome,
      totalOutstanding,
      totalCredits,
      groupFund,
      companyFund,
      memberCount: members.length,
      groupName: settings?.groupName || "Company",
    },
  });
}

async function handleBigTicket() {
  const settings = await prisma.settings.findUnique({ where: { id: "main" } });
  const bigTicketGroupId = settings?.bigTicketGroupId || "";

  // Resolve Big Ticket member ids
  let memberIds: string[] | null = null;
  if (bigTicketGroupId) {
    const groupMembers = await prisma.memberGroupMember.findMany({
      where: { groupId: bigTicketGroupId },
      select: { memberId: true },
    });
    memberIds = groupMembers.map((gm) => gm.memberId);
  }

  const memberWhere = memberIds
    ? { active: true as const, id: { in: memberIds } }
    : { active: true as const };

  const splitWhere = memberIds ? { memberId: { in: memberIds } } : {};

  const [members, purchasesAgg, paidAgg, unpaidAgg] = await Promise.all([
    prisma.member.findMany({
      where: memberWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.purchase.aggregate({ _sum: { totalAmount: true } }),
    prisma.purchaseSplit.groupBy({
      by: ["memberId"],
      where: { ...splitWhere, paid: true },
      _sum: { amount: true },
    }),
    prisma.purchaseSplit.groupBy({
      by: ["memberId"],
      where: { ...splitWhere, paid: false },
      _sum: { amount: true },
    }),
  ]);

  const paidMap = new Map<string, number>();
  for (const p of paidAgg) paidMap.set(p.memberId, p._sum.amount || 0);
  const unpaidMap = new Map<string, number>();
  for (const u of unpaidAgg) unpaidMap.set(u.memberId, u._sum.amount || 0);

  const balances = members.map((m) => {
    const totalPaid = paidMap.get(m.id) || 0;
    const totalDue = unpaidMap.get(m.id) || 0;
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      totalDue,
      totalPaid,
      balance: totalDue,
    };
  });

  let totalOutstanding = 0;
  let totalCollected = 0;
  for (const b of balances) {
    totalOutstanding += b.totalDue;
    totalCollected += b.totalPaid;
  }

  return NextResponse.json({
    profile: "bigticket",
    balances,
    totals: {
      totalPurchases: purchasesAgg._sum.totalAmount || 0,
      totalOutstanding,
      totalCollected,
      memberCount: members.length,
      groupName: settings?.groupName || "Company",
    },
  });
}
