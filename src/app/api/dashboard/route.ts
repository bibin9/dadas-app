import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";
  if (profile === "bigticket") return handleBigTicket();
  return handleDadas();
}

async function handleDadas() {
  const [members, events, settings, companyIncomes, allExpenses] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        eventDues: { select: { amount: true } },
        payments: { where: { category: "dadas" }, select: { amount: true } },
      },
    }),
    prisma.event.findMany({ select: { totalCost: true } }),
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.companyIncome.findMany({ select: { amount: true } }),
    prisma.eventExpense.findMany({ select: { amount: true } }),
  ]);

  let totalIncome = 0;
  for (const i of companyIncomes) totalIncome += i.amount;
  let totalEventExpenses = 0;
  for (const e of allExpenses) totalEventExpenses += e.amount;
  let totalEventCosts = 0;
  for (const e of events) totalEventCosts += e.totalCost;

  const balances = members.map((member) => {
    let totalDue = 0;
    for (const d of member.eventDues) totalDue += d.amount;
    let totalPaid = 0;
    for (const p of member.payments) totalPaid += p.amount;
    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
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
    else if (b.balance < 0) totalCredits += -b.balance;
  }

  const totalCosts = totalEventCosts + totalEventExpenses;
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

  const [members, purchases] = await Promise.all([
    prisma.member.findMany({
      where: memberWhere,
      orderBy: { name: "asc" },
      include: { purchaseSplits: { select: { amount: true, paid: true } } },
    }),
    prisma.purchase.findMany({ select: { totalAmount: true } }),
  ]);

  let totalPurchaseValue = 0;
  for (const p of purchases) totalPurchaseValue += p.totalAmount;

  const balances = members.map((member) => {
    let totalDue = 0;
    let totalPaid = 0;
    for (const s of member.purchaseSplits) {
      if (s.paid) totalPaid += s.amount;
      else totalDue += s.amount;
    }
    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
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
      totalPurchases: totalPurchaseValue,
      totalOutstanding,
      totalCollected,
      memberCount: members.length,
      groupName: settings?.groupName || "Company",
    },
  });
}
