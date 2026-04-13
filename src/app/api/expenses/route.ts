import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const expenses = await prisma.eventExpense.findMany({
    orderBy: { date: "desc" },
    include: { event: { select: { id: true, name: true, date: true } } },
  });
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const { description, amount, category, date, reference, notes, eventId } = await req.json();
  if (!description?.trim() || !amount) {
    return NextResponse.json({ error: "Description and amount required" }, { status: 400 });
  }
  const expense = await prisma.eventExpense.create({
    data: {
      description: description.trim(),
      amount: parseFloat(amount),
      category: category || "venue",
      date: new Date(date),
      reference: reference || "",
      notes: notes || "",
      eventId: eventId || null,
    },
  });
  return NextResponse.json(expense);
}
