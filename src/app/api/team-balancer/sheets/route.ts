import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const sheets = await prisma.teamSheet.findMany({
    orderBy: { date: "desc" },
  });
  return NextResponse.json(sheets);
}

export async function POST(req: NextRequest) {
  const { name, date, teamAName, teamBName, teamAIds, teamBIds, notes } = await req.json();

  const sheet = await prisma.teamSheet.create({
    data: {
      name,
      date: new Date(date),
      teamAName: teamAName || "Team A",
      teamBName: teamBName || "Team B",
      teamAIds,
      teamBIds,
      notes: notes || "",
    },
  });

  return NextResponse.json(sheet);
}
