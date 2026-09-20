import { NextResponse } from "next/server";
import { COMMITTEE_COOKIE } from "@/lib/auth";

// Clears the committee cookie so the password prompt shows again.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COMMITTEE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
