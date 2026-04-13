import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: {
      dues: { include: { member: true } },
      payments: { include: { member: true } },
    },
  });

  const members = await prisma.member.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      eventDues: true,
      purchaseSplits: true,
      payments: true,
    },
  });

  const settings = await prisma.settings.findUnique({ where: { id: "main" } });

  // Get company income linked to events
  const companyIncomes = await prisma.companyIncome.findMany({
    orderBy: { date: "desc" },
  });

  // Get event expenses
  const eventExpenses = await prisma.eventExpense.findMany({
    orderBy: { date: "desc" },
  });

  // Event-wise collection report with P&L
  const eventReports = events.map((event) => {
    const totalDue = event.dues.reduce((s, d) => s + d.amount, 0);
    const totalPaid = event.payments.reduce((s, p) => s + p.amount, 0);
    const paidMemberIds = new Set(event.payments.map((p) => p.memberId));
    const unpaidDues = event.dues.filter((d) => !paidMemberIds.has(d.memberId));
    const paidDues = event.dues.filter((d) => paidMemberIds.has(d.memberId));

    // Income linked to this event
    const incomes = companyIncomes.filter((i) => i.eventId === event.id);
    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);

    // Expenses linked to this event
    const expenses = eventExpenses.filter((e) => e.eventId === event.id);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

    // P&L: Revenue (contributions + income) - Costs (expenses + event totalCost)
    const totalRevenue = totalPaid + totalIncome;
    const totalCosts = totalExpenses + event.totalCost;
    const netPL = totalRevenue - totalCosts;

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
      netPL,
      outstanding: totalDue - totalPaid,
      playerCount: event.dues.length,
      paidCount: paidDues.length,
      unpaidCount: unpaidDues.length,
      paidMembers: paidDues.map((d) => {
        const payment = event.payments.find((p) => p.memberId === d.memberId);
        return {
          name: d.member.name,
          amount: d.amount,
          isGuest: d.member.isGuest,
          method: payment?.method || "cash",
        };
      }),
      unpaidMembers: unpaidDues.map((d) => ({
        name: d.member.name,
        amount: d.amount,
        isGuest: d.member.isGuest,
      })),
    };
  });

  // Outstanding balances report
  const outstandingReport = members.map((member) => {
    const totalEventDues = member.eventDues.reduce((sum, d) => sum + d.amount, 0);
    const totalPurchaseSplits = member.purchaseSplits.reduce((sum, s) => sum + s.amount, 0);
    const totalDue = totalEventDues + totalPurchaseSplits;
    const totalPaid = member.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalDue - totalPaid;

    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      totalDue,
      totalPaid,
      balance,
    };
  }).filter((m) => m.balance > 0).sort((a, b) => b.balance - a.balance);

  return NextResponse.json({
    eventReports,
    outstandingReport,
    groupName: settings?.groupName || "Company",
  });
}
