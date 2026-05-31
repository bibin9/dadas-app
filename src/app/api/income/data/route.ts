import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const profile = request.nextUrl.searchParams.get("profile") === "bigticket" ? "bigticket" : "dadas";

  const [incomes, events] = await Promise.all([
    prisma.companyIncome.findMany({
      where: { profile },
      orderBy: { date: "desc" },
      include: { event: { select: { id: true, name: true, date: true } } },
    }),
    // Events linkage is only meaningful for DADAS; Big Ticket has no events.
    profile === "dadas"
      ? prisma.event.findMany({ orderBy: { date: "desc" }, select: { id: true, name: true, date: true } })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({ incomes, events, profile });
}
