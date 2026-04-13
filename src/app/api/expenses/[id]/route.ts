import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { description, amount, category, date, reference, notes, eventId } = await req.json();
  const expense = await prisma.eventExpense.update({
    where: { id },
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.eventExpense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
