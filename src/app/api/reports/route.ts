import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [events, members, settings, companyIncomes, eventExpenses] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "desc" },
      include: { dues: { include: { member: true } }, payments: { include: { member: true } } },
    }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { eventDues: true, purchaseSplits: true, payments: true },
    }),
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.companyIncome.findMany({ orderBy: { date: "desc" } }),
    prisma.eventExpense.findMany({ orderBy: { date: "desc" } }),
  ]);

  // Build income/expense maps by eventId for O(1) lookup
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
    let totalDue = 0, totalPaid = 0;
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

    return {
      id: event.id, name: event.name, type: event.type, date: event.date,
      perHeadFee: event.perHeadFee, totalCost: event.totalCost,
      totalDue, totalPaid, totalIncome,
      incomes: incomes.map((i) => ({ description: i.description, amount: i.amount, category: i.category })),
      totalExpenses,
      expenses: expenses.map((e) => ({ description: e.description, amount: e.amount, category: e.category })),
      totalRevenue, totalCosts, netPL: totalRevenue - totalCosts,
      outstanding: totalDue - totalPaid,
      playerCount: event.dues.length, paidCount: paidDues.length, unpaidCount: unpaidDues.length,
      paidMembers: paidDues.map((d) => {
        const memberPayments = event.payments.filter((p) => p.memberId === d.memberId);
        const paidAmount = memberPayments.reduce((s: number, p) => s + p.amount, 0);
        return { name: d.member.name, amount: d.amount, paidAmount, isGuest: d.member.isGuest, method: memberPayments[0]?.method || "cash" };
      }),
      unpaidMembers: unpaidDues.map((d) => ({ name: d.member.name, amount: d.amount, isGuest: d.member.isGuest })),
    };
  });

  const outstandingReport = members.map((member) => {
    let totalDue = 0, totalPaid = 0;
    for (const d of member.eventDues) totalDue += d.amount;
    for (const s of member.purchaseSplits) totalDue += s.amount;
    for (const p of member.payments) totalPaid += p.amount;
    return { id: member.id, name: member.name, phone: member.phone, totalDue, totalPaid, balance: totalDue - totalPaid };
  }).filter((m) => m.balance > 0).sort((a, b) => b.balance - a.balance);

  return NextResponse.json({ eventReports, outstandingReport, groupName: settings?.groupName || "Company" });
}
