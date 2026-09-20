import { NextRequest, NextResponse } from "next/server";
import { signCommitteeToken, COMMITTEE_COOKIE } from "@/lib/auth";
import { readJsonBody, badRequest } from "@/lib/http";

// Password gate for the team selection committee screen.
// The password lives in the COMMITTEE_PASSWORD environment variable — it is
// never stored in the repo. If it isn't configured, access is denied outright
// rather than falling back to some guessable default.
export async function POST(req: NextRequest) {
  const expected = process.env.COMMITTEE_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Committee access is not configured yet. Ask the admin to set COMMITTEE_PASSWORD." },
      { status: 503 },
    );
  }

  const body = await readJsonBody(req);
  if (!body) return badRequest("Invalid JSON body");
  const password = body.password;
  if (typeof password !== "string" || password.length === 0) {
    return badRequest("Password required");
  }

  // Length-then-bytes comparison; avoids leaking the password via early exit.
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && a.every((v, i) => v === b[i]);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COMMITTEE_COOKIE, signCommitteeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
