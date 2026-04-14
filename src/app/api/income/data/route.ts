import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [incomes, events] = await Promise.all([
    prisma.companyIncome.findMany({
      orderBy: { date: "desc" },
      include: { event: { select: { id: true, name: true, date: true } } },
    }),
    prisma.event.findMany({ orderBy: { date: "desc" }, select: { id: true, name: true, date: true } }),
  ]);
  return NextResponse.json({ incomes, events });
}
