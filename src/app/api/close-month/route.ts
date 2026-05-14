import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Monthly close — snapshot the current open period and roll its REAL profit
 * (excluding player credit liability) forward into "Total Income".
 *
 * Real profit = (received + income) - costs - changeInPlayerCredits
 *
 * The credit liability stays as-is on the dashboard's Player Credits card —
 * it's not counted as profit because that money is owed back to players.
 */

// GET = preview: returns what would be closed without actually closing
export async function GET() {
  const preview = await computePreview();
  return NextResponse.json(preview);
}

// POST = actually close the current open period
export async function POST(req: NextRequest) {
  const { notes } = await req.json().catch(() => ({ notes: "" }));
  const preview = await computePreview();

  if (preview.monthReceived === 0 && preview.monthCosts === 0 && preview.monthIncome === 0) {
    return NextResponse.json({ error: "Nothing to close — no activity in this period." }, { status: 400 });
  }

  const closeDate = new Date();
  const monthLabel = `${closeDate.getUTCFullYear()}-${String(closeDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const close = await prisma.monthlyClose.create({
    data: {
      closeDate,
      monthLabel,
      monthReceived: preview.monthReceived,
      monthCosts: preview.monthCosts,
      monthIncome: preview.monthIncome,
      monthProfit: preview.monthProfit, // REAL profit (excludes credit liability)
      creditsAtClose: preview.currentCredits,
      notes: notes || "",
    },
  });

  return NextResponse.json({ ok: true, close });
}

// DELETE = undo the most recent close (safety net)
export async function DELETE() {
  const latest = await prisma.monthlyClose.findFirst({ orderBy: { closeDate: "desc" } });
  if (!latest) return NextResponse.json({ error: "Nothing to undo" }, { status: 404 });
  await prisma.monthlyClose.delete({ where: { id: latest.id } });
  return NextResponse.json({ ok: true, undone: latest });
}

async function computePreview() {
  const lastClose = await prisma.monthlyClose.findFirst({ orderBy: { closeDate: "desc" } });
  const sinceDate = lastClose?.closeDate ?? new Date(0);
  const prevCredits = lastClose?.creditsAtClose ?? 0;

  const [payments, eventCosts, eventExpenses, companyIncomes, members] = await Promise.all([
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
      where: { date: { gt: sinceDate } },
      select: { amount: true },
    }),
    // Need lifetime totals to compute current credit balance
    prisma.member.findMany({
      where: { active: true },
      include: {
        eventDues: { select: { amount: true } },
        payments: { where: { category: "dadas" }, select: { amount: true } },
      },
    }),
  ]);

  let monthReceived = 0;
  for (const p of payments) monthReceived += p.amount;
  let groundCostsTotal = 0;
  for (const e of eventCosts) groundCostsTotal += e.totalCost;
  let expensesTotal = 0;
  for (const e of eventExpenses) expensesTotal += e.amount;
  let monthIncome = 0;
  for (const i of companyIncomes) monthIncome += i.amount;

  const monthCosts = groundCostsTotal + expensesTotal;

  // Compute current player credit balance (lifetime)
  let currentCredits = 0;
  for (const m of members) {
    let due = 0;
    for (const d of m.eventDues) due += d.amount;
    let paid = 0;
    for (const p of m.payments) paid += p.amount;
    const balance = due - paid;
    if (balance < 0) currentCredits += -balance;
  }

  const deltaCredits = currentCredits - prevCredits;
  // REAL profit excludes net new credit liability (overpayments still owed back)
  const monthProfit = monthReceived + monthIncome - monthCosts - deltaCredits;
  // For reference / display: groupFund-style profit (includes credit movement)
  const grossProfit = monthReceived + monthIncome - monthCosts;

  return {
    sinceDate,
    monthReceived,
    monthCosts,
    monthIncome,
    monthProfit,        // REAL profit (carry-forward)
    grossProfit,        // (received + income) - costs (info only)
    deltaCredits,       // net new player credit during this period
    currentCredits,     // current lifetime credit balance
    prevCredits,        // credit balance at last close
    nowLabel: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`,
    lastCloseLabel: lastClose?.monthLabel ?? null,
  };
}
