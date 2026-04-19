import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";

  // Clean up orphaned payments in background (non-blocking)
  prisma.payment.deleteMany({ where: { eventId: { not: null }, event: null } }).catch(() => {});

  // Clean up duplicate payments (same member + same event, keep only the latest)
  cleanupDuplicatePayments().catch(() => {});

  if (profile === "bigticket") {
    return handleBigTicket();
  }
  return handleDadas();
}

async function handleDadas() {
  const [members, events, settings, companyIncomes, allExpenses] = await Promise.all([
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { eventDues: true, payments: { where: { category: "dadas" } } },
    }),
    prisma.event.findMany(),
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
    let totalPaid = 0;
    for (const p of member.payments) totalPaid += p.amount;

    return { id: member.id, name: member.name, phone: member.phone, totalDue, totalPaid, balance: totalDue - totalPaid };
  });

  let totalReceived = 0, totalOutstanding = 0;
  let totalEventCosts = 0;
  for (const b of balances) { totalReceived += b.totalPaid; totalOutstanding += Math.max(0, b.balance); }
  for (const e of events) totalEventCosts += e.totalCost;

  const totalCosts = totalEventCosts + totalEventExpenses;
  const groupFund = totalReceived + totalCompanyIncome - totalCosts;

  return NextResponse.json({
    profile: "dadas",
    balances,
    totals: { totalReceived, totalCosts, totalIncome: totalCompanyIncome, totalOutstanding, groupFund, memberCount: members.length, groupName: settings?.groupName || "Company" },
  });
}

async function handleBigTicket() {
  const settings = await prisma.settings.findUnique({ where: { id: "main" } });
  const bigTicketGroupId = settings?.bigTicketGroupId || "";

  // Get Big Ticket member IDs from group (if set)
  let memberFilter: { active: true; id?: { in: string[] } } = { active: true };
  if (bigTicketGroupId) {
    const groupMembers = await prisma.memberGroupMember.findMany({
      where: { groupId: bigTicketGroupId },
      select: { memberId: true },
    });
    const memberIds = groupMembers.map((gm) => gm.memberId);
    memberFilter = { active: true, id: { in: memberIds } };
  }

  const [members, purchases] = await Promise.all([
    prisma.member.findMany({
      where: memberFilter,
      orderBy: { name: "asc" },
      include: { purchaseSplits: true },
    }),
    prisma.purchase.findMany(),
  ]);

  let totalPurchaseValue = 0;
  for (const p of purchases) totalPurchaseValue += p.totalAmount;

  const balances = members.map((member) => {
    let totalDue = 0;
    let totalPaid = 0;
    for (const s of member.purchaseSplits) {
      if (s.paid) {
        totalPaid += s.amount;
      } else {
        totalDue += s.amount;
      }
    }
    return { id: member.id, name: member.name, phone: member.phone, totalDue, totalPaid, balance: totalDue };
  });

  let totalOutstanding = 0, totalCollected = 0;
  for (const b of balances) { totalOutstanding += b.totalDue; totalCollected += b.totalPaid; }

  return NextResponse.json({
    profile: "bigticket",
    balances,
    totals: { totalPurchases: totalPurchaseValue, totalOutstanding, totalCollected, memberCount: members.length, groupName: settings?.groupName || "Company" },
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
