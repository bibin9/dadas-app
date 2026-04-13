import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const members = await prisma.member.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { eventDues: true, purchaseSplits: true, payments: true },
  });
  const events = await prisma.event.findMany();
  const purchases = await prisma.purchase.findMany();
  const settings = await prisma.settings.findUnique({ where: { id: "main" } });
  const companyIncomes = await prisma.companyIncome.findMany();
  const allExpenses = await prisma.eventExpense.findMany();

  const totalCompanyIncome = companyIncomes.reduce((sum, i) => sum + i.amount, 0);
  let totalEventExpenses = 0;
  for (const exp of allExpenses) { totalEventExpenses += exp.amount; }

  const balances = members.map((member) => {
    const totalEventDues = member.eventDues.reduce((sum, d) => sum + d.amount, 0);
    const totalPurchaseSplits = member.purchaseSplits.reduce((sum, s) => sum + s.amount, 0);
    const totalDue = totalEventDues + totalPurchaseSplits;
    const totalPaid = member.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalDue - totalPaid;

    return {
      id: member.id,
      name: member.name,
      phone: member.phone,
      totalEventDues,
      totalPurchaseSplits,
      totalDue,
      totalPaid,
      balance,
    };
  });

  const totalCollected = balances.reduce((sum, b) => sum + b.totalPaid, 0);
  const totalEventCosts = events.reduce((sum, e) => sum + e.totalCost, 0);
  const totalPurchaseCosts = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalCosts = totalEventCosts + totalPurchaseCosts;
  const totalDuesCharged = balances.reduce((sum, b) => sum + b.totalDue, 0);

  // Group fund = total collected + company income - total actual costs - event expenses
  const groupFund = totalCollected + totalCompanyIncome - totalCosts - totalEventExpenses;

  const totals = {
    totalDue: totalDuesCharged,
    totalPaid: totalCollected,
    totalOutstanding: balances.reduce((sum, b) => sum + Math.max(0, b.balance), 0),
    totalCredit: balances.reduce((sum, b) => sum + Math.abs(Math.min(0, b.balance)), 0),
    memberCount: members.length,
    groupFund,
    totalEventCosts,
    totalPurchaseCosts,
    totalCompanyIncome,
    totalEventExpenses,
    groupName: settings?.groupName || "Company",
  };

  return NextResponse.json({ balances, totals });
}
