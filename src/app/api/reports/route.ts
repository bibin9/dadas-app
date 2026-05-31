import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { settleMember, DueInput, PaymentInput } from "@/lib/settlement";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") || "dadas";
  if (profile === "bigticket") return handleBigTicket();
  return handleDadas();
}

async function handleDadas() {
  const [events, members, settings, companyIncomes, eventExpenses, allDuesFull, allPaymentsFull] =
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
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true, active: true, isGuest: true },
      }),
      prisma.settings.findUnique({ where: { id: "main" } }),
      prisma.companyIncome.findMany({ where: { profile: "dadas" }, orderBy: { date: "desc" } }),
      prisma.eventExpense.findMany({ orderBy: { date: "desc" } }),
      // Full dues+payments for FIFO settlement (need dates + eventIds)
      prisma.eventDue.findMany({
        select: { memberId: true, amount: true, eventId: true, event: { select: { date: true } } },
      }),
      prisma.payment.findMany({
        where: { category: "dadas" },
        select: { id: true, memberId: true, amount: true, method: true, eventId: true, date: true },
      }),
    ]);

  // ===== FIFO SETTLEMENT (per member) =====
  // Group dues and payments by member, then settle each independently.
  const duesByMember = new Map<string, DueInput[]>();
  for (const d of allDuesFull) {
    if (!d.event) continue;
    const arr = duesByMember.get(d.memberId) || [];
    arr.push({ memberId: d.memberId, eventId: d.eventId, eventDate: d.event.date, amount: d.amount });
    duesByMember.set(d.memberId, arr);
  }
  const paymentsByMember = new Map<string, PaymentInput[]>();
  for (const p of allPaymentsFull) {
    const arr = paymentsByMember.get(p.memberId) || [];
    arr.push({
      memberId: p.memberId,
      paymentId: p.id,
      date: p.date,
      amount: p.amount,
      method: p.method,
      eventId: p.eventId,
    });
    paymentsByMember.set(p.memberId, arr);
  }

  // For each member, run FIFO and collect per-event effective paid + outstanding
  const effectivePaidByEventByMember = new Map<string, Map<string, number>>(); // memberId -> (eventId -> effectivePaid)
  const outstandingByEventByMember = new Map<string, Map<string, number>>(); // memberId -> (eventId -> outstanding)
  for (const m of members) {
    const dues = duesByMember.get(m.id) || [];
    const payments = paymentsByMember.get(m.id) || [];
    const result = settleMember(dues, payments);
    effectivePaidByEventByMember.set(m.id, result.effectivePaidByEvent);
    outstandingByEventByMember.set(m.id, result.outstandingByEvent);
  }

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
    for (const d of event.dues) totalDue += d.amount;

    // Per-event totalPaid (FIFO effective) — sum the effective payments
    // allocated to this event across all its members.
    let totalPaidEffective = 0;
    for (const d of event.dues) {
      const memberMap = effectivePaidByEventByMember.get(d.memberId);
      const eff = memberMap?.get(event.id) ?? 0;
      totalPaidEffective += eff;
    }

    // Per-event totalPaid (direct = sum of payments LINKED to this event)
    // Kept for display purposes (e.g. so cash collected on match day shows)
    let totalPaidDirect = 0;
    for (const p of event.payments) totalPaidDirect += p.amount;

    // Split dues into paid / partial / unpaid based on FIFO effective amount
    const paidDues: typeof event.dues = [];
    const unpaidDues: typeof event.dues = [];
    for (const d of event.dues) {
      const memberMap = effectivePaidByEventByMember.get(d.memberId);
      const eff = memberMap?.get(event.id) ?? 0;
      if (eff >= d.amount - 0.01) {
        paidDues.push(d);
      } else {
        unpaidDues.push(d);
      }
    }

    const incomes = incomeByEvent.get(event.id) || [];
    let totalIncome = 0;
    for (const i of incomes) totalIncome += i.amount;

    const expenses = expenseByEvent.get(event.id) || [];
    let totalExpenses = 0;
    for (const e of expenses) totalExpenses += e.amount;

    // P&L revenue uses FIFO effective payment — accurate per-event P&L
    // since carry-over from other matches counts toward this match's settlement.
    const totalRevenue = totalPaidEffective + totalIncome;
    const totalCosts = totalExpenses + event.totalCost;

    // Index direct payments by member (for method display)
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
      totalPaid: totalPaidEffective,       // FIFO effective (used in P&L)
      totalPaidDirect,                      // direct payments linked to this event
      totalIncome,
      incomes: incomes.map((i) => ({ description: i.description, amount: i.amount, category: i.category })),
      totalExpenses,
      expenses: expenses.map((e) => ({ description: e.description, amount: e.amount, category: e.category })),
      totalRevenue,
      totalCosts,
      netPL: totalRevenue - totalCosts,
      outstanding: totalDue - totalPaidEffective,
      playerCount: event.dues.length,
      paidCount: paidDues.length,
      unpaidCount: unpaidDues.length,
      paidMembers: paidDues.map((d) => {
        const memberPayments = payByMember.get(d.memberId) || [];
        const eff = effectivePaidByEventByMember.get(d.memberId)?.get(event.id) ?? 0;
        // method: prefer direct payment method, fall back to "carry-over"
        const method = memberPayments[0]?.method || "carry-over";
        return {
          name: d.member.name,
          amount: d.amount,
          paidAmount: eff,
          isGuest: d.member.isGuest,
          method,
        };
      }),
      unpaidMembers: unpaidDues.map((d) => {
        const eff = effectivePaidByEventByMember.get(d.memberId)?.get(event.id) ?? 0;
        return {
          name: d.member.name,
          amount: d.amount,
          paidAmount: eff,                   // partial amount covered (if any)
          outstanding: d.amount - eff,       // still owed
          isGuest: d.member.isGuest,
        };
      }),
    };
  });

  // Outstanding report: use FIFO outstanding totals (more accurate)
  const outstandingReport = members
    .map((m) => {
      const outstandingMap = outstandingByEventByMember.get(m.id) || new Map();
      let totalOutstanding = 0;
      for (const v of outstandingMap.values()) totalOutstanding += Math.max(0, v);
      const effMap = effectivePaidByEventByMember.get(m.id) || new Map();
      let totalPaid = 0;
      for (const v of effMap.values()) totalPaid += v;
      const totalDue = totalOutstanding + totalPaid;
      return {
        id: m.id,
        name: m.name,
        phone: m.phone,
        totalDue,
        totalPaid,
        balance: totalOutstanding,
      };
    })
    .filter((m) => m.balance > 0.01)
    .sort((a, b) => b.balance - a.balance);

  return NextResponse.json({
    profile: "dadas",
    eventReports,
    outstandingReport,
    groupName: settings?.groupName || "Company",
  }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" } });
}

async function handleBigTicket() {
  // Parallelize all queries — locally filter Big Ticket group members
  const [settings, allMembers, purchases, allUnpaidSplits, allGroupLinks] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.member.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    prisma.purchase.findMany({
      orderBy: { date: "desc" },
      select: { id: true, description: true, date: true, drawDate: true, totalAmount: true, cost: true, splits: { select: { amount: true, paid: true } } },
    }),
    prisma.purchaseSplit.findMany({ where: { paid: false }, select: { memberId: true, amount: true } }),
    prisma.memberGroupMember.findMany({ select: { memberId: true, groupId: true } }),
  ]);

  const bigTicketGroupId = settings?.bigTicketGroupId || "";
  let members = allMembers;
  let unpaidSplits = allUnpaidSplits;
  if (bigTicketGroupId) {
    const memberIds = new Set(
      allGroupLinks.filter((g) => g.groupId === bigTicketGroupId).map((g) => g.memberId)
    );
    members = allMembers.filter((m) => memberIds.has(m.id));
    unpaidSplits = allUnpaidSplits.filter((s) => memberIds.has(s.memberId));
  }

  // Per-purchase P&L: expected collection (sum of splits) vs ticket cost
  const purchaseReports = purchases.map((p) => {
    let collected = 0;
    for (const s of p.splits) if (s.paid) collected += s.amount;
    const expectedCollection = p.totalAmount;
    const cost = p.cost || 0;
    return {
      id: p.id,
      name: p.description,
      date: p.date,
      drawDate: p.drawDate,
      totalAmount: expectedCollection,
      cost,
      collected,
      expectedProfit: Math.round((expectedCollection - cost) * 100) / 100,
      realisedProfit: Math.round((collected - cost) * 100) / 100,
      memberCount: p.splits.length,
    };
  });

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
  }, { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" } });
}
