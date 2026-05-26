import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Quick-collect endpoint: mark Big Ticket purchase splits as paid and
 * create matching Payment records (category=bigticket) in one call.
 *
 * Body: { memberIds: string[], method: "cash" | "bank_transfer" }
 *   - memberIds: which splits in this purchase to mark paid
 *   - method: payment method
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { memberIds, method, amount } = await req.json();
  const ids = (memberIds as string[]) || [];
  if (ids.length === 0) return NextResponse.json({ ok: true, count: 0 });

  // Load the purchase + matching unpaid splits
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { splits: { where: { memberId: { in: ids }, paid: false } } },
  });
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  const splitsToCollect = purchase.splits;
  if (splitsToCollect.length === 0) return NextResponse.json({ ok: true, count: 0 });

  // Optional override: for single-member inline pay, the user can specify
  // a custom paid amount (e.g. overpaying or paying less than split). For
  // batch pay, we use the split's own amount.
  const customAmount = typeof amount === "number" && !isNaN(amount) && splitsToCollect.length === 1
    ? amount
    : null;

  // Mark splits paid + create Payment records
  await prisma.$transaction([
    prisma.purchaseSplit.updateMany({
      where: { id: { in: splitsToCollect.map((s) => s.id) } },
      data: { paid: true },
    }),
    prisma.payment.createMany({
      data: splitsToCollect.map((s) => ({
        memberId: s.memberId,
        // Credit-method payments record amount=0 so the lifetime credit
        // balance naturally absorbs the due (same mechanic as football).
        amount: method === "credit" ? 0 : (customAmount !== null ? customAmount : s.amount),
        method: method || "cash",
        reference: `${purchase.description} - ${purchase.date.toLocaleDateString()}`,
        notes: "",
        date: new Date(),
        category: "bigticket",
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, count: splitsToCollect.length });
}

/**
 * Unmark a split as paid (undo collection). Body: { memberId }
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { memberId } = await req.json();

  const split = await prisma.purchaseSplit.findFirst({
    where: { purchaseId: id, memberId, paid: true },
  });
  if (!split) return NextResponse.json({ error: "Split not found or not paid" }, { status: 404 });

  await prisma.purchaseSplit.update({
    where: { id: split.id },
    data: { paid: false },
  });
  // Note: associated Payment record is NOT auto-deleted (admin can remove
  // from Payments page if needed) — keeps the audit trail intact.

  return NextResponse.json({ ok: true });
}
