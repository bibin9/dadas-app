import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const [settings, templates, groups] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "main" } }),
    prisma.eventTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({
    settings: settings || { bankName: "", accountName: "", iban: "", accountNumber: "", swiftCode: "", defaultMatchFee: 20, groupName: "Company", autoDeleteDays: 0 },
    templates,
    groups,
  });
}
