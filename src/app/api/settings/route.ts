import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  let settings = await prisma.settings.findUnique({ where: { id: "main" } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { id: "main" } });
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const { bankName, accountName, iban, accountNumber, swiftCode, defaultMatchFee, defaultBigTicketShare, bigTicketGroupId, groupName, autoDeleteDays } = await req.json();
  const settings = await prisma.settings.upsert({
    where: { id: "main" },
    update: { bankName, accountName, iban, accountNumber, swiftCode, defaultMatchFee, defaultBigTicketShare: defaultBigTicketShare ?? 50, bigTicketGroupId: bigTicketGroupId ?? "", groupName, autoDeleteDays: autoDeleteDays ?? 0 },
    create: { id: "main", bankName, accountName, iban, accountNumber, swiftCode, defaultMatchFee, defaultBigTicketShare: defaultBigTicketShare ?? 50, bigTicketGroupId: bigTicketGroupId ?? "", groupName, autoDeleteDays: autoDeleteDays ?? 0 },
  });
  return NextResponse.json(settings);
}
