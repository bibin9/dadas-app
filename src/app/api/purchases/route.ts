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

  // splits: [{ memberId, amount }]
  const purchase = await prisma.purchase.create({
    data: {
      description,
      totalAmount,
      date: new Date(date),
      notes: notes || "",
      splits: {
        create: (splits as { memberId: string; amount: number }[]).map((s) => ({
          memberId: s.memberId,
          amount: s.amount,
        })),
      },
    },
    include: { splits: { include: { member: true } } },
  });

  return NextResponse.json(purchase);
}
