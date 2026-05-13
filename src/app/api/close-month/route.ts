import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Monthly close — snapshot the current open period, roll its profit forward
 * into "Total Income", and reset the dashboard's current-period totals.
 *
 * Math is provably equivalent to the lifetime calculation, so member balances
 * and group fund stay correct (see /api/dashboard for how it's applied).
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

  const closeDate = new Date(); // close everything up to and including right now
  const monthLabel = `${closeDate.getUTCFullYear()}-${String(closeDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const close = await prisma.monthlyClose.create({
    data: {
      closeDate,
      monthLabel,
      monthReceived: preview.monthReceived,
      monthCosts: preview.monthCosts,
      monthIncome: preview.monthIncome,
      monthProfit: preview.monthProfit,
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
  const sinceDate = lastClose?.closeDate ?? new Date(0); // beginning of time if no previous close

  const [payments, eventCosts, eventExpenses, companyIncomes] = await Promise.all([
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
  const monthProfit = monthReceived + monthIncome - monthCosts;

  return {
    sinceDate,
    monthReceived,
    monthCosts,
    monthIncome,
    monthProfit,
    nowLabel: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`,
    lastCloseLabel: lastClose?.monthLabel ?? null,
  };
}
