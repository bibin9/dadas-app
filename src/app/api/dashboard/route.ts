import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" };

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";
  if (profile === "bigticket") return handleBigTicket();
  return handleDadas();
}

async function handleDadas() {
  // Member balances are computed LIFETIME (full history) regardless of monthly
  // close — so credits and dues never get lost across a close.
  // The current-period totals (Received / Cost) are filtered to AFTER the
  // most recent MonthlyClose date. Past months' profit is rolled forward
  // into Total Income.
  const [members, settings, lastClose, allCloses] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        eventDues: { select: { amount: true } },
        payments: { where: { category: "dadas" }, select: { amount: true } },
      },
    }),
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.monthlyClose.findFirst({ orderBy: { closeDate: "desc" } }),
    prisma.monthlyClose.findMany({ select: { monthProfit: true, creditsAtClose: true } }),
  ]);

  // Lifetime member balances (unchanged behaviour)
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

  // Sum of all past month REAL profits — carried forward into Total Income
  // (monthProfit now excludes player credit liability, so this is "real" profit)
  let carryForward = 0;
  for (const c of allCloses) carryForward += c.monthProfit;
  // Credits at the most recent close — needed to keep groupFund math lifetime-consistent
  const lastCloseCredits = lastClose?.creditsAtClose ?? 0;

  // Cutoff: only count activity AFTER this date in "current period" totals
  const sinceDate = lastClose?.closeDate ?? new Date(0);

  // Current-period totals (post-close) — DADAS football only.
  // Big Ticket profit is intentionally kept separate from DADAS income.
  const [periodPayments, periodEvents, periodExpenses, periodIncomes] = await Promise.all([
    prisma.payment.findMany({
      where: { category: "dadas", date: { gt: sinceDate } },
      select: { amount: true },
    }),
    prisma.event.findMany({
      where: { date: { gt: sinceDate } },
      select: { totalCost: true },
    }),
    prisma.eventExpense.findMany({
      where: { date: { gt: sinceDate } },
      select: { amount: true },
    }),
    prisma.companyIncome.findMany({
      where: { profile: "dadas", date: { gt: sinceDate } },
      select: { amount: true },
    }),
  ]);

  let periodReceived = 0;
  for (const p of periodPayments) periodReceived += p.amount;
  let periodEventCosts = 0;
  for (const e of periodEvents) periodEventCosts += e.totalCost;
  let periodEventExpenses = 0;
  for (const e of periodExpenses) periodEventExpenses += e.amount;
  let periodIncome = 0;
  for (const i of periodIncomes) periodIncome += i.amount;
  const periodCosts = periodEventCosts + periodEventExpenses;

  // Total Income displayed = period income (DADAS only) + carry-forward
  const totalIncomeDisplay = periodIncome + carryForward;

  // Outstanding / credits remain lifetime (member balances)
  let totalOutstanding = 0;
  let totalCredits = 0;
  for (const b of balances) {
    if (b.balance > 0) totalOutstanding += b.balance;
    else if (b.balance < 0) totalCredits += -b.balance;
  }

  // Group Fund (lifetime "money on hand including credits owed back"):
  //   = periodReceived + periodIncome + periodCarry - periodCosts + lastCloseCredits
  // The lastCloseCredits term is needed because carryForward now excludes credit
  // liability — but that credit money is still physically in the fund. Adding
  // it back makes groupFund correctly equal the lifetime received+income-costs.
  const groupFund = periodReceived + totalIncomeDisplay - periodCosts + lastCloseCredits;
  // Company Fund = Group Fund - current credit liability (= real money the club has)
  const companyFund = groupFund - totalCredits;

  return NextResponse.json({
    profile: "dadas",
    balances,
    totals: {
      totalReceived: periodReceived,
      totalCosts: periodCosts,
      totalEventCosts: periodEventCosts,
      totalEventExpenses: periodEventExpenses,
      totalIncome: totalIncomeDisplay,
      periodIncome,
      carryForward,
      totalOutstanding,
      totalCredits,
      groupFund,
      companyFund,
      memberCount: members.length,
      groupName: settings?.groupName || "Company",
      lastCloseDate: lastClose?.closeDate ?? null,
      lastCloseLabel: lastClose?.monthLabel ?? null,
    },
  }, { headers: CACHE_HEADERS });
}

async function handleBigTicket() {
  const [settings, allMembers, purchases, allGroupLinks, allSplits, allPayments, btIncomes] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.purchase.findMany({ select: { totalAmount: true, cost: true } }),
    prisma.memberGroupMember.findMany({ select: { memberId: true, groupId: true } }),
    prisma.purchaseSplit.findMany({ select: { memberId: true, amount: true } }),
    prisma.payment.findMany({ where: { category: "bigticket" }, select: { memberId: true, amount: true } }),
    // Big Ticket-scoped CompanyIncome (sponsorships, opening balance, etc.)
    prisma.companyIncome.findMany({ where: { profile: "bigticket" }, select: { amount: true } }),
  ]);

  // Show ONLY Big Ticket group members (if a group is configured)
  const bigTicketGroupId = settings?.bigTicketGroupId || "";
  let members = allMembers;
  if (bigTicketGroupId) {
    const memberIds = new Set(
      allGroupLinks.filter((g) => g.groupId === bigTicketGroupId).map((g) => g.memberId)
    );
    members = allMembers.filter((m) => memberIds.has(m.id));
  }

  let totalPurchaseValue = 0;
  let totalTicketCost = 0;
  let purchaseProfit = 0;
  for (const p of purchases) {
    totalPurchaseValue += p.totalAmount;
    totalTicketCost += p.cost || 0;
    purchaseProfit += p.totalAmount - (p.cost || 0);
  }
  // Other Big Ticket income (sponsorship, opening balance carried over, etc.)
  let otherIncome = 0;
  for (const i of btIncomes) otherIncome += i.amount;
  // BT Earnings = purchase profit + other Big Ticket income
  const totalEarnings = purchaseProfit + otherIncome;

  // Lifetime per-member: due = sum of splits, paid = sum of bigticket payments
  const dueMap = new Map<string, number>();
  for (const s of allSplits) dueMap.set(s.memberId, (dueMap.get(s.memberId) || 0) + s.amount);
  const paidMap = new Map<string, number>();
  for (const p of allPayments) paidMap.set(p.memberId, (paidMap.get(p.memberId) || 0) + p.amount);

  const balances = members.map((member) => {
    const totalDue = dueMap.get(member.id) || 0;
    const totalPaid = paidMap.get(member.id) || 0;
    const balance = Math.round((totalDue - totalPaid) * 100) / 100;
    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      totalDue,
      totalPaid,
      balance, // positive = owes, negative = credit
    };
  });

  let totalOutstanding = 0;
  let totalCollected = 0;
  let totalCredits = 0; // money held that's owed back to members (overpayments)
  for (const b of balances) {
    if (b.balance > 0) totalOutstanding += b.balance;
    else if (b.balance < 0) totalCredits += -b.balance;
    totalCollected += b.totalPaid;
  }

  return NextResponse.json({
    profile: "bigticket",
    balances,
    totals: {
      totalPurchases: totalPurchaseValue,
      totalOutstanding,
      totalCollected,
      totalCredits,
      totalTicketCost,
      purchaseProfit,
      otherIncome,
      totalEarnings, // BT club earnings — separate from DADAS
      memberCount: members.length,
      groupName: settings?.groupName || "Company",
    },
  }, { headers: CACHE_HEADERS });
}
