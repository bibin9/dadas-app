import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const templates = await prisma.eventTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const { name, type, amount, amountType, groupId, notes } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name required" }, { status: 400 });
  }
  const template = await prisma.eventTemplate.create({
    data: {
      name: name.trim(),
      type: type || "event",
      amount: parseFloat(amount) || 0,
      amountType: amountType || "total",
      groupId: groupId || null,
      notes: notes || "",
    },
  });
  return NextResponse.json(template);
}
