import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily DB backup endpoint.
 *
 * Auth (either):
 * - Vercel Cron header: x-vercel-cron-signature is verified by Vercel automatically.
 * - Manual: ?token=<BACKUP_TOKEN env var> for ad-hoc download.
 *
 * Behavior:
 * - GET (or POST) returns the full DB as JSON.
 * - If GITHUB_BACKUP_REPO + GITHUB_TOKEN env vars are set, also commits the
 *   JSON to backups/YYYY-MM-DD.json in that repo (off-site backup).
 *
 * To restore: parse the JSON and use prisma to insert in the right order
 * (Members -> MemberGroups -> Events -> EventDues -> Payments -> ...)
 */

async function dumpAll() {
  const [
    users, members, memberGroups, memberGroupMembers,
    events, eventDues, eventExpenses, companyIncomes,
    purchases, purchaseSplits, payments,
    eventTemplates, playerSkills, teamSheets, settings,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.member.findMany(),
    prisma.memberGroup.findMany(),
    prisma.memberGroupMember.findMany(),
    prisma.event.findMany(),
    prisma.eventDue.findMany(),
    prisma.eventExpense.findMany(),
    prisma.companyIncome.findMany(),
    prisma.purchase.findMany(),
    prisma.purchaseSplit.findMany(),
    prisma.payment.findMany(),
    prisma.eventTemplate.findMany(),
    prisma.playerSkill.findMany(),
    prisma.teamSheet.findMany(),
    prisma.settings.findMany(),
  ]);

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    counts: {
      users: users.length, members: members.length, memberGroups: memberGroups.length,
      events: events.length, eventDues: eventDues.length, payments: payments.length,
      purchases: purchases.length, purchaseSplits: purchaseSplits.length,
    },
    data: {
      users, members, memberGroups, memberGroupMembers,
      events, eventDues, eventExpenses, companyIncomes,
      purchases, purchaseSplits, payments,
      eventTemplates, playerSkills, teamSheets, settings,
    },
  };
}

async function pushToGithub(snapshot: object) {
  const repo = process.env.GITHUB_BACKUP_REPO; // "owner/repo"
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BACKUP_BRANCH || "main";
  if (!repo || !token) return { uploaded: false, reason: "GITHUB_BACKUP_REPO or GITHUB_TOKEN not set" };

  // Weekly backup file path: backups/2026-W17.json (ISO week number)
  const now = new Date();
  const isoWeek = getIsoWeek(now);
  const today = now.toISOString().slice(0, 10);
  const path = `backups/${now.getUTCFullYear()}-W${String(isoWeek).padStart(2, "0")}.json`;
  // Also keep an "always-latest" pointer for easy fetch
  const latestPath = `backups/latest.json`;
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const content = Buffer.from(JSON.stringify(snapshot, null, 2)).toString("base64");

  // Get existing SHA if file already exists today (overwrite)
  let sha: string | undefined;
  try {
    const existing = await fetch(`${url}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (existing.ok) {
      const j = await existing.json();
      sha = j.sha;
    }
  } catch { /* ignore */ }

  const body: Record<string, string> = {
    message: `Backup ${today}`,
    content,
    branch,
  };
  if (sha) body.sha = sha;

  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    return { uploaded: false, reason: `GitHub API ${resp.status}: ${t.slice(0, 200)}` };
  }

  // Also update latest.json (always-overwritten pointer to most recent backup)
  try {
    const latestUrl = `https://api.github.com/repos/${repo}/contents/${latestPath}`;
    let latestSha: string | undefined;
    const existing = await fetch(`${latestUrl}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (existing.ok) latestSha = (await existing.json()).sha;
    const latestBody: Record<string, string> = {
      message: `Backup ${today} (latest)`,
      content,
      branch,
    };
    if (latestSha) latestBody.sha = latestSha;
    await fetch(latestUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(latestBody),
    });
  } catch { /* non-fatal */ }

  return { uploaded: true, path };
}

// ISO 8601 week number (1-53). Sunday belongs to the previous week's Sat.
function getIsoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron passes Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true;

  // Manual: ?token=BACKUP_TOKEN
  const token = req.nextUrl.searchParams.get("token");
  if (process.env.BACKUP_TOKEN && token === process.env.BACKUP_TOKEN) return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await dumpAll();
  const upload = await pushToGithub(snapshot);

  // If client asks for download, serve as JSON file
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (download) {
    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dadas-backup-${today}.json"`,
      },
    });
  }
  return NextResponse.json({ ok: true, counts: snapshot.counts, upload });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
