import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Dedupe guest players by name (case-insensitive, trimmed).
 *
 * For each group of duplicate guests:
 *   - Keep the OLDEST record (lowest createdAt)
 *   - Re-point all eventDues + payments + purchaseSplits + groupLinks +
 *     playerSkill to the kept guest
 *   - Delete the duplicate guest records
 *
 * Wrapped in a transaction per duplicate group so a failure rolls back
 * that group only.
 *
 * GET = dry-run (returns what would be merged without changing anything)
 * POST = execute the merge
 */

async function findDuplicates() {
  const guests = await prisma.member.findMany({
    where: { isGuest: true },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, typeof guests>();
  for (const g of guests) {
    const key = g.name.trim().toLowerCase();
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push(g);
    groups.set(key, arr);
  }
  // Only groups with >1
  const dupGroups: { name: string; keep: typeof guests[number]; remove: typeof guests }[] = [];
  for (const [, arr] of groups) {
    if (arr.length > 1) {
      // arr is already sorted by createdAt asc, so first = oldest = keep
      dupGroups.push({ name: arr[0].name, keep: arr[0], remove: arr.slice(1) });
    }
  }
  return dupGroups;
}

export async function GET() {
  const dups = await findDuplicates();
  return NextResponse.json({
    duplicateGroups: dups.length,
    totalToDelete: dups.reduce((s, g) => s + g.remove.length, 0),
    groups: dups.map((g) => ({
      name: g.name,
      keepId: g.keep.id,
      removeIds: g.remove.map((r) => r.id),
      removeCount: g.remove.length,
    })),
  });
}

export async function POST() {
  const dups = await findDuplicates();
  if (dups.length === 0) return NextResponse.json({ ok: true, merged: 0, deleted: 0 });

  let mergedGroups = 0;
  let deletedRecords = 0;

  for (const grp of dups) {
    const keepId = grp.keep.id;
    const removeIds = grp.remove.map((r) => r.id);

    await prisma.$transaction([
      // Re-point relations to the kept guest
      prisma.eventDue.updateMany({ where: { memberId: { in: removeIds } }, data: { memberId: keepId } }),
      prisma.payment.updateMany({ where: { memberId: { in: removeIds } }, data: { memberId: keepId } }),
      prisma.purchaseSplit.updateMany({ where: { memberId: { in: removeIds } }, data: { memberId: keepId } }),
      prisma.memberGroupMember.updateMany({ where: { memberId: { in: removeIds } }, data: { memberId: keepId } }),
      // PlayerSkill has a unique constraint on memberId so we can't update —
      // just delete duplicates' skill records (the kept one's stays).
      prisma.playerSkill.deleteMany({ where: { memberId: { in: removeIds } } }),
      // Finally delete the duplicate guest records
      prisma.member.deleteMany({ where: { id: { in: removeIds } } }),
    ]);

    mergedGroups++;
    deletedRecords += removeIds.length;
  }

  return NextResponse.json({ ok: true, merged: mergedGroups, deleted: deletedRecords });
}
