import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // Clean up orphaned payments (payments linked to deleted events)
  await prisma.payment.deleteMany({
    where: {
      eventId: { not: null },
      event: null,
    },
  });

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
    const totalDue = member.eventDues.reduce((sum, d) => sum + d.amount, 0)
      + member.purchaseSplits.reduce((sum, s) => sum + s.amount, 0);
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
  });

  // Total received = all member payments
  const totalReceived = balances.reduce((sum, b) => sum + b.totalPaid, 0);
  // Total costs = event ground costs + purchase costs + event expenses
  const totalEventCosts = events.reduce((sum, e) => sum + e.totalCost, 0);
  const totalPurchaseCosts = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalCosts = totalEventCosts + totalPurchaseCosts + totalEventExpenses;
  // Outstanding = members who still owe
  const totalOutstanding = balances.reduce((sum, b) => sum + Math.max(0, b.balance), 0);
  // Fund = received + income - costs
  const groupFund = totalReceived + totalCompanyIncome - totalCosts;

  const totals = {
    totalReceived,
    totalCosts,
    totalIncome: totalCompanyIncome,
    totalOutstanding,
    groupFund,
    memberCount: members.length,
    groupName: settings?.groupName || "Company",
  };

  return NextResponse.json({ balances, totals });
}
