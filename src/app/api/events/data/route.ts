import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Combined endpoint: returns events, active members, settings, groups, and templates in one call
export async function GET() {
  const [events, members, settings, groups, templates] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "desc" },
      include: {
        dues: { include: { member: true } },
        payments: { include: { member: true } },
      },
    }),
    prisma.member.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.settings.findFirst({ where: { id: "main" } }),
    prisma.memberGroup.findMany({
      include: { members: { include: { member: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.eventTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  // Run cleanup in background (non-blocking)
  const autoDeleteDays = settings?.autoDeleteDays || 0;
  if (autoDeleteDays > 0) {
    cleanupSettledMatches(autoDeleteDays).catch(() => {});
  }

  return NextResponse.json({
    events,
    members,
    settings: settings || { defaultMatchFee: 20, groupName: "Company", autoDeleteDays: 0 },
    groups,
    templates,
  });
}

async function cleanupSettledMatches(days: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const oldMatches = await prisma.event.findMany({
    where: { type: "match", date: { lt: cutoffDate } },
    include: { dues: true, payments: true },
  });
  const settledIds: string[] = [];
  for (const match of oldMatches) {
    if (match.dues.length === 0) continue;
    const paidMemberIds = new Set(match.payments.map((p) => p.memberId));
    if (match.dues.every((d) => paidMemberIds.has(d.memberId))) settledIds.push(match.id);
  }
  if (settledIds.length > 0) {
    await prisma.payment.deleteMany({ where: { eventId: { in: settledIds } } });
    await prisma.event.deleteMany({ where: { id: { in: settledIds } } });
  }
}
