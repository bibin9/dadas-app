import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";
  if (profile === "bigticket") return handleBigTicket();
  return handleDadas();
}

async function handleDadas() {
  const [events, members, settings, companyIncomes, eventExpenses, allDues, allPayments] =
    await Promise.all([
      prisma.event.findMany({
        orderBy: { date: "desc" },
        include: {
          dues: {
            select: {
              memberId: true,
              amount: true,
              member: { select: { name: true, isGuest: true } },
            },
          },
          payments: {
            select: {
              memberId: true,
              amount: true,
              method: true,
            },
          },
        },
      }),
      prisma.member.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true },
      }),
      prisma.settings.findUnique({ where: { id: "main" } }),
      prisma.companyIncome.findMany({ orderBy: { date: "desc" } }),
      prisma.eventExpense.findMany({ orderBy: { date: "desc" } }),
      prisma.eventDue.findMany({ select: { memberId: true, amount: true } }),
      prisma.payment.findMany({ where: { category: "dadas" }, select: { memberId: true, amount: true } }),
    ]);

  // Index incomes/expenses by event
  const incomeByEvent = new Map<string, typeof companyIncomes>();
  for (const i of companyIncomes) {
    if (!i.eventId) continue;
    const arr = incomeByEvent.get(i.eventId) || [];
    arr.push(i);
    incomeByEvent.set(i.eventId, arr);
  }
  const expenseByEvent = new Map<string, typeof eventExpenses>();
  for (const e of eventExpenses) {
    if (!e.eventId) continue;
    const arr = expenseByEvent.get(e.eventId) || [];
    arr.push(e);
    expenseByEvent.set(e.eventId, arr);
  }

  const eventReports = events.map((event) => {
    let totalDue = 0;
    let totalPaid = 0;
    for (const d of event.dues) totalDue += d.amount;
    for (const p of event.payments) totalPaid += p.amount;

    const paidMemberIds = new Set(event.payments.map((p) => p.memberId));
    const unpaidDues = event.dues.filter((d) => !paidMemberIds.has(d.memberId));
    const paidDues = event.dues.filter((d) => paidMemberIds.has(d.memberId));

    const incomes = incomeByEvent.get(event.id) || [];
    let totalIncome = 0;
    for (const i of incomes) totalIncome += i.amount;

    const expenses = expenseByEvent.get(event.id) || [];
    let totalExpenses = 0;
    for (const e of expenses) totalExpenses += e.amount;

    const totalRevenue = totalPaid + totalIncome;
    const totalCosts = totalExpenses + event.totalCost;

    // Index payments by member for fast lookup
    const payByMember = new Map<string, typeof event.payments>();
    for (const p of event.payments) {
      const arr = payByMember.get(p.memberId) || [];
      arr.push(p);
      payByMember.set(p.memberId, arr);
    }

    return {
      id: event.id,
      name: event.name,
      type: event.type,
      date: event.date,
      perHeadFee: event.perHeadFee,
      totalCost: event.totalCost,
      totalDue,
      totalPaid,
      totalIncome,
      incomes: incomes.map((i) => ({ description: i.description, amount: i.amount, category: i.category })),
      totalExpenses,
      expenses: expenses.map((e) => ({ description: e.description, amount: e.amount, category: e.category })),
      totalRevenue,
      totalCosts,
      netPL: totalRevenue - totalCosts,
      outstanding: totalDue - totalPaid,
      playerCount: event.dues.length,
      paidCount: paidDues.length,
      unpaidCount: unpaidDues.length,
      paidMembers: paidDues.map((d) => {
        const memberPayments = payByMember.get(d.memberId) || [];
        let paidAmount = 0;
        for (const p of memberPayments) paidAmount += p.amount;
        return {
          name: d.member.name,
          amount: d.amount,
          paidAmount,
          isGuest: d.member.isGuest,
          method: memberPayments[0]?.method || "cash",
        };
      }),
      unpaidMembers: unpaidDues.map((d) => ({
        name: d.member.name,
        amount: d.amount,
        isGuest: d.member.isGuest,
      })),
    };
  });

  // Outstanding by JS aggregation (libsql adapter compat)
  const dueMap = new Map<string, number>();
  for (const d of allDues) dueMap.set(d.memberId, (dueMap.get(d.memberId) || 0) + d.amount);
  const paidMap = new Map<string, number>();
  for (const p of allPayments) paidMap.set(p.memberId, (paidMap.get(p.memberId) || 0) + p.amount);

  const outstandingReport = members
    .map((m) => {
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
    })
    .filter((m) => m.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return NextResponse.json({
    profile: "dadas",
    eventReports,
    outstandingReport,
    groupName: settings?.groupName || "Company",
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
  const splitWhere = memberIds ? { memberId: { in: memberIds }, paid: false } : { paid: false };

  const [members, purchases, unpaidSplits] = await Promise.all([
    prisma.member.findMany({
      where: memberWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.purchase.findMany({
      orderBy: { date: "desc" },
      select: { id: true, description: true, date: true, totalAmount: true },
    }),
    prisma.purchaseSplit.findMany({ where: splitWhere, select: { memberId: true, amount: true } }),
  ]);

  const purchaseReports = purchases.map((p) => ({
    id: p.id,
    name: p.description,
    date: p.date,
    totalAmount: p.totalAmount,
  }));

  const unpaidMap = new Map<string, number>();
  for (const u of unpaidSplits) unpaidMap.set(u.memberId, (unpaidMap.get(u.memberId) || 0) + u.amount);

  const outstandingReport = members
    .map((m) => {
      const totalDue = unpaidMap.get(m.id) || 0;
      return { id: m.id, name: m.name, phone: m.phone, totalDue, totalPaid: 0, balance: totalDue };
    })
    .filter((m) => m.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return NextResponse.json({
    profile: "bigticket",
    purchaseReports,
    outstandingReport,
    groupName: settings?.groupName || "Company",
  });
}
