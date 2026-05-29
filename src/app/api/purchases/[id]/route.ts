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
  const { description, totalAmount, cost, date, notes, splits } = await req.json();
  const splitData = splits as { memberId: string; amount: number; paid?: boolean; method?: string }[];

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { splits: true },
  });
  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update purchase metadata
  await prisma.purchase.update({
    where: { id },
    data: {
      description,
      totalAmount,
      cost: cost || 0,
      date: new Date(date),
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

  // Sync Big Ticket payments for THIS purchase: delete payments tied to this
  // purchase (matched by reference + memberId since Payment has no purchaseId)
  // then recreate based on the new paid set.
  const purchaseDate = new Date(date);
  const reference = `${description} - ${purchaseDate.toLocaleDateString()}`;
  const memberIds = splitData.map((s) => s.memberId);

  // Best-effort match on old reference too (in case description/date changed)
  const oldReference = `${purchase.description} - ${purchase.date.toLocaleDateString()}`;
  await prisma.payment.deleteMany({
    where: {
      category: "bigticket",
      memberId: { in: memberIds },
      OR: [{ reference }, { reference: oldReference }],
    },
  });

  const paidSplits = splitData.filter((s) => s.paid);
  if (paidSplits.length > 0) {
    await prisma.payment.createMany({
      data: paidSplits.map((s) => ({
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.purchase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
