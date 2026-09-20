import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasCommitteeAccess } from "@/lib/auth";

// The ONE thing the committee may write: notes on a player.
// They still cannot change any rating — this is how observations get back to
// the admin, who decides whether to act on them.
export async function POST(req: NextRequest) {
  if (!(await hasCommitteeAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const author = typeof body.author === "string" ? body.author.trim().slice(0, 40) : "";

  if (!memberId || !text) {
    return NextResponse.json({ error: "memberId and text are required" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "Comment is too long (max 500 characters)" }, { status: 400 });
  }

  // Only against a real member — no arbitrary rows.
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) {
    return NextResponse.json({ error: "Unknown player" }, { status: 400 });
  }

  const comment = await prisma.playerComment.create({
    data: { memberId, text, author: author || "Committee" },
  });
  return NextResponse.json(comment);
}

// Committee members can remove a note they added by mistake.
export async function DELETE(req: NextRequest) {
  if (!(await hasCommitteeAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.playerComment.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
