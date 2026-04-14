import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // Clean up orphaned payments in background (non-blocking)
  prisma.payment.deleteMany({ where: { eventId: { not: null }, event: null } }).catch(() => {});

  // Clean up duplicate payments (same member + same event, keep only the latest)
  cleanupDuplicatePayments().catch(() => {});

  const [members, events, purchases, settings, companyIncomes, allExpenses] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { eventDues: true, purchaseSplits: true, payments: true },
    }),
    prisma.event.findMany(),
    prisma.purchase.findMany(),
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.companyIncome.findMany(),
    prisma.eventExpense.findMany(),
  ]);

  let totalCompanyIncome = 0;
  for (const i of companyIncomes) totalCompanyIncome += i.amount;
  let totalEventExpenses = 0;
  for (const e of allExpenses) totalEventExpenses += e.amount;

  const balances = members.map((member) => {
    let totalDue = 0;
    for (const d of member.eventDues) totalDue += d.amount;
    for (const s of member.purchaseSplits) totalDue += s.amount;
    let totalPaid = 0;
    for (const p of member.payments) totalPaid += p.amount;

    return { id: member.id, name: member.name, phone: member.phone, totalDue, totalPaid, balance: totalDue - totalPaid };
  });

  let totalReceived = 0, totalOutstanding = 0;
  let totalEventCosts = 0, totalPurchaseCosts = 0;
  for (const b of balances) { totalReceived += b.totalPaid; totalOutstanding += Math.max(0, b.balance); }
  for (const e of events) totalEventCosts += e.totalCost;
  for (const p of purchases) totalPurchaseCosts += p.totalAmount;

  const totalCosts = totalEventCosts + totalPurchaseCosts + totalEventExpenses;
  const groupFund = totalReceived + totalCompanyIncome - totalCosts;

  return NextResponse.json({
    balances,
    totals: { totalReceived, totalCosts, totalIncome: totalCompanyIncome, totalOutstanding, groupFund, memberCount: members.length, groupName: settings?.groupName || "Company" },
  });
}

async function cleanupDuplicatePayments() {
  const payments = await prisma.payment.findMany({
    where: { eventId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  // Group by memberId+eventId, keep only the latest
  const seen = new Map<string, string>(); // key -> id to keep
  const toDelete: string[] = [];
  for (const p of payments) {
    const key = `${p.memberId}:${p.eventId}`;
    if (seen.has(key)) {
      toDelete.push(p.id); // older duplicate
    } else {
      seen.set(key, p.id);
    }
  }
  if (toDelete.length > 0) {
    await prisma.payment.deleteMany({ where: { id: { in: toDelete } } });
  }
}
