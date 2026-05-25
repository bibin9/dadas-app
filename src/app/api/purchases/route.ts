import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const purchases = await prisma.purchase.findMany({
    orderBy: { date: "desc" },
    include: {
      splits: { include: { member: true } },
    },
  });
  return NextResponse.json(purchases);
}

export async function POST(req: NextRequest) {
  const { description, totalAmount, date, notes, splits } = await req.json();

  // splits: [{ memberId, amount, paid?: boolean, method?: string }]
  // Members marked as "paid" inline get their PurchaseSplit.paid set + a
  // Big Ticket Payment record created — matching the football match UX.
  const splitData = splits as { memberId: string; amount: number; paid?: boolean; method?: string }[];

  const purchase = await prisma.purchase.create({
    data: {
      description,
      totalAmount,
      date: new Date(date),
      notes: notes || "",
      splits: {
        create: splitData.map((s) => ({
          memberId: s.memberId,
          amount: s.amount,
          paid: !!s.paid,
        })),
      },
    },
    include: { splits: { include: { member: true } } },
  });

  // Create Payment records for members already paid at creation time
  const paidEntries = splitData.filter((s) => s.paid);
  if (paidEntries.length > 0) {
    const purchaseDate = new Date(date);
    await prisma.payment.createMany({
      data: paidEntries.map((s) => ({
        memberId: s.memberId,
        amount: s.amount,
        method: s.method || "cash",
        reference: `${description} - ${purchaseDate.toLocaleDateString()}`,
        notes: "",
        date: purchaseDate,
        category: "bigticket",
      })),
    });
  }

  return NextResponse.json(purchase);
}
