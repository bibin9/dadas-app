import { NextResponse } from "next/server";

// Safely read a JSON request body. `await req.json()` throws on malformed
// input, and an uncaught throw in a route handler surfaces as a 500 — which
// let anyone provoke server errors on the public endpoints by POSTing junk.
// Returns null instead so callers can answer 400.
export async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
