import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Auto-cleanup fully-paid matches older than N days
export async function POST() {
  try {
    const settings = await prisma.settings.findFirst({ where: { id: "main" } });
    const days = settings?.autoDeleteDays || 0;
    if (days <= 0) return NextResponse.json({ deleted: 0, message: "Auto-delete disabled" });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Find all matches (type="match") older than cutoff
    const oldMatches = await prisma.event.findMany({
      where: {
        type: "match",
        date: { lt: cutoffDate },
      },
      include: {
        dues: true,
        payments: true,
      },
    });

    // Filter to only fully settled matches (every due has a corresponding payment)
    const settledMatchIds: string[] = [];
    for (const match of oldMatches) {
      if (match.dues.length === 0) continue; // skip empty matches
      const paidMemberIds = new Set(match.payments.map((p: { memberId: string }) => p.memberId));
      const allPaid = match.dues.every((d: { memberId: string }) => paidMemberIds.has(d.memberId));
      if (allPaid) {
        settledMatchIds.push(match.id);
      }
    }

    if (settledMatchIds.length === 0) {
      return NextResponse.json({ deleted: 0, message: "No settled matches to clean up" });
    }

    // Delete payments linked to these matches first, then delete the matches
    // (EventDue cascade deletes automatically, but payments need explicit delete)
    await prisma.payment.deleteMany({
      where: { eventId: { in: settledMatchIds } },
    });
    await prisma.event.deleteMany({
      where: { id: { in: settledMatchIds } },
    });

    return NextResponse.json({
      deleted: settledMatchIds.length,
      message: `Cleaned up ${settledMatchIds.length} fully-settled match(es) older than ${days} days`,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
