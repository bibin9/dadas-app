import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const members = await prisma.member.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      eventDues: true,
      purchaseSplits: true,
      payments: true,
    },
  });

  // Get all events to calculate group fund (surplus from matches)
  const events = await prisma.event.findMany();
  const purchases = await prisma.purchase.findMany();

  // Get settings for group name
  const settings = await prisma.settings.findUnique({ where: { id: "main" } });

  const balances = members.map((member) => {
    const totalEventDues = member.eventDues.reduce((sum, d) => sum + d.amount, 0);
    const totalPurchaseSplits = member.purchaseSplits.reduce((sum, s) => sum + s.amount, 0);
    const totalDue = totalEventDues + totalPurchaseSplits;
    const totalPaid = member.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalDue - totalPaid;
    // positive = owes money, negative = has credit (advance payment)

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

  // Group fund calculation:
  // Total collected from all members (all payments)
  const totalCollected = balances.reduce((sum, b) => sum + b.totalPaid, 0);
  // Total actual costs (event totalCost + purchase totalAmount)
  const totalEventCosts = events.reduce((sum, e) => sum + e.totalCost, 0);
  const totalPurchaseCosts = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalCosts = totalEventCosts + totalPurchaseCosts;
  // Total dues charged to members
  const totalDuesCharged = balances.reduce((sum, b) => sum + b.totalDue, 0);
  // Surplus from events (collected per-head fees minus actual costs)
  const totalEventRevenue = events.reduce((sum, e) => {
    // Revenue from this event = perHeadFee * number of dues
    return sum; // We already have this in totalDuesCharged from events
  }, 0);
  // Group fund = total collected - total actual costs
  // Members who paid in advance have negative balance = their money sits in the fund
  const groupFund = totalCollected - totalCosts;

  const totals = {
    totalDue: totalDuesCharged,
    totalPaid: totalCollected,
    totalOutstanding: balances.reduce((sum, b) => sum + Math.max(0, b.balance), 0),
    totalCredit: balances.reduce((sum, b) => sum + Math.abs(Math.min(0, b.balance)), 0),
    memberCount: members.length,
    groupFund,
    totalEventCosts,
    totalPurchaseCosts,
    groupName: settings?.groupName || "Company",
  };

  return NextResponse.json({ balances, totals });
}
