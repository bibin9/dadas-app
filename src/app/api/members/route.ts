import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const members = await prisma.member.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const { name, phone } = await req.json();
  const member = await prisma.member.create({
    data: { name, phone: phone || "" },
  });
  return NextResponse.json(member);
}
