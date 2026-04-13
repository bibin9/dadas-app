import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const income = await prisma.companyIncome.findMany({
    orderBy: { date: "desc" },
    include: { event: { select: { id: true, name: true, date: true } } },
  });
  return NextResponse.json(income);
}

export async function POST(req: NextRequest) {
  const { description, amount, category, date, reference, notes, eventId } = await req.json();
  if (!description?.trim() || !amount) {
    return NextResponse.json({ error: "Description and amount required" }, { status: 400 });
  }
  const income = await prisma.companyIncome.create({
    data: {
      description: description.trim(),
      amount: parseFloat(amount),
      category: category || "sponsorship",
      date: new Date(date),
      reference: reference || "",
      notes: notes || "",
      eventId: eventId || null,
    },
  });
  return NextResponse.json(income);
}
