import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dadas-app-change-this-secret-in-production";

export function signToken(payload: { userId: string; username: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ── Team selection committee ──
// A separate, read-only role. Committee members see the full player pool
// (ratings, positions, avoid pairs) so they can sanity-check team balance,
// but they get no admin access and cannot change anything.
const COMMITTEE_COOKIE = "committee_token";

export function signCommitteeToken() {
  return jwt.sign({ role: "committee" }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyCommitteeToken(token: string): boolean {
  try {
    const d = jwt.verify(token, JWT_SECRET) as { role?: string };
    return d.role === "committee";
  } catch {
    return false;
  }
}

// True when the caller holds EITHER a valid committee token or an admin login.
export async function hasCommitteeAccess(): Promise<boolean> {
  const cookieStore = await cookies();
  const c = cookieStore.get(COMMITTEE_COOKIE)?.value;
  if (c && verifyCommitteeToken(c)) return true;
  const admin = cookieStore.get("token")?.value;
  return !!(admin && verifyToken(admin));
}

export { COMMITTEE_COOKIE };
