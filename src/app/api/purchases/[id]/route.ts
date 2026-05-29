import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { splits: { include: { member: true } } },
  });
  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(purchase);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { description, totalAmount, cost, date, drawDate, notes, splits } = await req.json();
  const splitData = splits as { memberId: string; amount: number; paid?: boolean; method?: string }[];

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { splits: true },
  });
  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Who was paid BEFORE this edit (so we only touch payments for status changes)
  const oldPaidMemberIds = new Set(purchase.splits.filter((s) => s.paid).map((s) => s.memberId));

  // Update purchase metadata
  await prisma.purchase.update({
    where: { id },
    data: {
      description,
      totalAmount,
      cost: cost || 0,
      date: new Date(date),
      drawDate: drawDate ? new Date(drawDate) : null,
      notes: notes || "",
    },
  });

  // Replace splits: delete old, recreate from form
  await prisma.purchaseSplit.deleteMany({ where: { purchaseId: id } });
  await prisma.purchaseSplit.createMany({
    data: splitData.map((s) => ({
      purchaseId: id,
      memberId: s.memberId,
      amount: s.amount,
      paid: !!s.paid,
    })),
  });

  // ── NON-DESTRUCTIVE payment sync ──
  // IMPORTANT: never delete/recreate payments for members who were already
  // paid — that would wipe any advance/overpayment amounts (their credit).
  // Only:
  //   • create a payment for members who are NEWLY marked paid
  //   • delete the payment for members who are NEWLY marked unpaid
  //   • re-point reference if description/date changed (preserve amount)
  const purchaseDate = new Date(date);
  const reference = `${description} - ${purchaseDate.toLocaleDateString()}`;
  const oldReference = `${purchase.description} - ${purchase.date.toLocaleDateString()}`;
  const newPaidMemberIds = new Set(splitData.filter((s) => s.paid).map((s) => s.memberId));

  // Newly paid → create a payment (default to split amount)
  const newlyPaid = splitData.filter((s) => s.paid && !oldPaidMemberIds.has(s.memberId));
  if (newlyPaid.length > 0) {
    await prisma.payment.createMany({
      data: newlyPaid.map((s) => ({
        memberId: s.memberId,
        amount: s.method === "credit" ? 0 : s.amount,
        method: s.method || "cash",
        reference,
        notes: "",
        date: purchaseDate,
        category: "bigticket",
      })),
    });
  }

  // Newly unpaid → delete their payment for this purchase
  const newlyUnpaid = [...oldPaidMemberIds].filter((mid) => !newPaidMemberIds.has(mid));
  if (newlyUnpaid.length > 0) {
    await prisma.payment.deleteMany({
      where: {
        category: "bigticket",
        memberId: { in: newlyUnpaid },
        OR: [{ reference }, { reference: oldReference }],
      },
    });
  }

  // Stay-paid members: if reference changed, re-point it (keep amounts intact)
  if (reference !== oldReference) {
    const stayPaid = [...newPaidMemberIds].filter((mid) => oldPaidMemberIds.has(mid));
    if (stayPaid.length > 0) {
      await prisma.payment.updateMany({
        where: { category: "bigticket", memberId: { in: stayPaid }, reference: oldReference },
        data: { reference },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.purchase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
