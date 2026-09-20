import jwt from "jsonwebtoken";
import { createHash } from "crypto";
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

// Fingerprint of the CURRENT committee password, embedded in every token.
// Rotating COMMITTEE_PASSWORD changes this, which instantly invalidates every
// previously issued cookie — otherwise anyone who logged in with the old
// password would keep access for the full 30 days after a rotation.
function passwordVersion(): string {
  return createHash("sha256")
    .update(process.env.COMMITTEE_PASSWORD || "")
    .digest("hex")
    .slice(0, 16);
}

export function signCommitteeToken() {
  return jwt.sign({ role: "committee", pv: passwordVersion() }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyCommitteeToken(token: string): boolean {
  try {
    const d = jwt.verify(token, JWT_SECRET) as { role?: string; pv?: string };
    return d.role === "committee" && d.pv === passwordVersion();
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
