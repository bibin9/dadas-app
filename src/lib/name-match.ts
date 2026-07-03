// Fuzzy name matching for "paste the WhatsApp list → auto-select players".
//
// Handles the messy reality of WhatsApp lists:
//   • numbering / bullets ("1. Bibin", "2) Ramesh", "- Sudeesh")
//   • decorations (emojis, ✅, ticks, trailing dots)
//   • slight misspellings ("Nikhill" → Nikhil, "Sudheesh" → Sudeesh)
//   • first-name-only entries matching a full name in the pool
//
// Unknown names are NOT force-matched — they're returned as `unmatched` so the
// organiser can add them as guests (per requirement: never silently guess a
// brand-new player into the team).

export interface Candidate {
  id: string;
  name: string;
}

export interface MatchResult {
  matched: { input: string; id: string; name: string }[];
  unmatched: string[]; // cleaned input names with no confident match
}

// Lowercase, strip diacritics, drop non-letters (keep spaces), collapse runs.
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that mark a line as chatter/header, not a player name.
const NOISE_WORDS = new Set([
  "match", "game", "team", "teams", "player", "players", "list",
  "guest", "guests", "welcome", "reply", "confirm", "confirmed",
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  "today", "tomorrow", "tonight", "morning", "evening",
  "am", "pm", "time", "venue", "ground", "turf", "court",
  "paid", "pending", "yes", "ok", "okay",
]);

// Parse a pasted blob into candidate name lines.
export function parseNameList(text: string): string[] {
  const names: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    // Strip leading numbering / bullets: "1.", "1)", "1 -", "-", "•", "*"
    line = line.replace(/^[\s>*•\-–—]*\d*[\s.):\-–—]*/g, "").trim();
    // Strip anything in parentheses/brackets: "(paid)", "[2]"
    line = line.replace(/[([{].*?[)\]}]/g, "").trim();
    // Drop everything after common separators that start comments
    line = line.split(/[,;:/@#]/)[0].trim();
    const cleaned = normalizeName(line);
    if (!cleaned) continue;
    const tokens = cleaned.split(" ");
    // Skip obvious non-name lines (headers, chatter)
    if (tokens.length > 4) continue;
    if (tokens.some((t) => NOISE_WORDS.has(t))) continue;
    if (cleaned.length < 2) continue;
    names.push(line.replace(/\s+/g, " ").trim());
  }
  return names;
}

// Classic Levenshtein distance.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// Allowed edit distance scales with name length.
function allowedDistance(len: number): number {
  if (len <= 3) return 0; // very short names must be exact
  if (len <= 5) return 1;
  if (len <= 8) return 2;
  return 3;
}

// Nickname stem: reduces a name to its core so pet forms match the real name.
//   "nikky"/"nikki"/"nikhy" → "nik" · "nikhil" → "nikil"
// Steps: collapse doubled letters, drop the optional "h" common in Indian
// name spellings, then strip trailing vowel-ish endings (-y, -i, -ee, ...).
function nickStem(s: string): string {
  let t = s.replace(/(.)\1+/g, "$1");     // nikki → niki, nikky → niky
  t = t[0] + t.slice(1).replace(/h/g, ""); // nikhil → nikil (keep leading h)
  t = t.replace(/[aeiouy]+$/g, "");        // niki/niky → nik
  return t;
}

// Best fuzzy score of `input` against a candidate's full name and each token
// (so "Sudheesh" can match "Sudheesh Shinoj" via its first token).
// Fuzzy matches REQUIRE the same first letter — misspellings almost never hit
// the first character, and this blocks false positives like a brand-new
// "Ramesh" being edit-distance-matched onto an existing "Ajesh".
function scoreAgainst(input: string, candidateNorm: string): number {
  let best = Infinity;
  if (candidateNorm[0] === input[0]) {
    best = levenshtein(input, candidateNorm);
  }
  // Token-level: single-word input vs multi-word candidate
  const tokens = candidateNorm.split(" ");
  if (tokens.length > 1 && !input.includes(" ")) {
    for (const t of tokens) {
      if (t[0] !== input[0]) continue;
      best = Math.min(best, levenshtein(input, t));
    }
  }
  // Prefix bonus: "sudheesh s" vs "sudheesh shinoj"
  if (candidateNorm[0] === input[0] && (candidateNorm.startsWith(input) || input.startsWith(candidateNorm))) {
    best = Math.min(best, Math.abs(candidateNorm.length - input.length) > 3 ? best : 1);
  }
  // Nickname rule: "Nikky"/"Nikki"/"Nikhy"/"Nik" → Nikhil. The input's stem
  // must be a prefix (≥3 chars) of the candidate's stem, first letters equal.
  // Counts as exact-strength (0) so it passes even the strict short-name
  // limit; if two candidates both stem-match, the tie leaves it unmatched.
  if (!input.includes(" ")) {
    const inStem = nickStem(input);
    if (inStem.length >= 3) {
      for (const t of candidateNorm.split(" ")) {
        if (t[0] === input[0] && nickStem(t).startsWith(inStem)) {
          best = 0;
          break;
        }
      }
    }
  }
  return best;
}

// Match parsed names against the pool. Greedy, exact-first, each candidate
// used at most once. Ambiguous inputs (two equally-close candidates) are left
// unmatched — safer to ask than to guess the wrong player.
export function matchNames(inputs: string[], candidates: Candidate[]): MatchResult {
  const matched: MatchResult["matched"] = [];
  const unmatched: string[] = [];
  const used = new Set<string>();
  const pool = candidates.map((c) => ({ ...c, norm: normalizeName(c.name) }));

  // Pass 1: exact normalized matches take priority (also protects pairs like
  // "Sudeesh" vs "Sudheesh Shinoj" — exact wins before fuzzy runs).
  const pending: string[] = [];
  for (const input of inputs) {
    const norm = normalizeName(input);
    const exact = pool.find((c) => !used.has(c.id) && c.norm === norm);
    if (exact) {
      used.add(exact.id);
      matched.push({ input, id: exact.id, name: exact.name });
    } else {
      pending.push(input);
    }
  }

  // Pass 2: fuzzy — assign globally best matches FIRST (not input order), so a
  // wrong-but-close input can't steal a candidate from its rightful owner
  // (e.g. "Ajeesh"→Ajesh must win before some other name gets near Ajesh).
  const scored = pending
    .map((input) => {
      const norm = normalizeName(input);
      const limit = allowedDistance(norm.length);
      let bestScore = Infinity;
      let bestIds: { id: string; name: string }[] = [];
      for (const c of pool) {
        if (used.has(c.id)) continue;
        const s = scoreAgainst(norm, c.norm);
        if (s < bestScore) {
          bestScore = s;
          bestIds = [{ id: c.id, name: c.name }];
        } else if (s === bestScore) {
          bestIds.push({ id: c.id, name: c.name });
        }
      }
      return { input, limit, bestScore, bestIds };
    })
    .sort((a, b) => a.bestScore - b.bestScore);

  for (const s of scored) {
    // Re-check availability: an earlier (better) match may have taken our pick.
    const avail = s.bestIds.filter((c) => !used.has(c.id));
    if (s.bestScore <= s.limit && avail.length === 1) {
      used.add(avail[0].id);
      matched.push({ input: s.input, id: avail[0].id, name: avail[0].name });
    } else {
      // No confident single match → report so they can be added as guests.
      unmatched.push(s.input);
    }
  }

  return { matched, unmatched };
}
