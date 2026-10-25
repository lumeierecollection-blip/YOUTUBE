/**
 * Words pop on their SPOKEN word (owner, 2026-10-09: "Words fly or pop in on their spoken word ... something happening about
 * every half second"). A headline is a phrase of the beat's sentence, so each of its words can be matched to the voiceover's
 * timing for that word: it pops in the frame the narrator says it, instead of an even stagger across the first 40% of the
 * beat (kinetic.js wordSchedule — which finished long before a long sentence was spoken and left the rest of the beat still).
 * Pure; unit-tested (scripts/__tests__/word-sync.test.js).
 */
const key = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));

/**
 * The frame each headline word pops at (beat-relative), or null when too few words match the narration (the caller keeps the
 * even stagger). `spoken`: [{ text, from }] in frames from the beat's start; `dur`: the beat's frames; `first`: the latest
 * frame the first word may pop (ink early: a beat's first frames must not be empty).
 */
export function wordPops(words, spoken, dur, { first = 6, tail = 24 } = {}) {
  const w = (words || []).map((x) => key(typeof x === "string" ? x : x?.text));
  const sp = (spoken || []).map((x) => ({ k: key(x.text), at: Math.max(0, Math.round(Number(x.from) || 0)) }));
  if (!w.length || !sp.length) return null;
  const at = new Array(w.length).fill(null);
  let p = 0, hits = 0;
  w.forEach((k, i) => {
    if (!k) return;
    for (let j = p; j < sp.length; j++) if (same(k, sp[j].k)) { at[i] = sp[j].at; p = j + 1; hits++; return; }
  });
  if (hits < Math.max(1, Math.ceil(w.length / 2))) return null;
  // Unmatched words sit between their matched neighbours (spread evenly), or a few frames after the last match.
  for (let i = 0; i < w.length; i++) {
    if (at[i] != null) continue;
    let a = i - 1; while (a >= 0 && at[a] == null) a--;
    let b = i + 1; while (b < w.length && at[b] == null) b++;
    const lo = a >= 0 ? at[a] : first, hi = b < w.length ? at[b] : lo + 8 * (b - a);
    at[i] = Math.round(lo + ((hi - lo) * (i - a)) / (b - a));
  }
  // Monotonic, the first word early, the last landed before the beat's end.
  const last = Math.max(first, dur - tail);
  for (let i = 0; i < at.length; i++) at[i] = Math.min(last, Math.max(i ? at[i - 1] : 0, at[i]));
  at[0] = Math.min(at[0], first);
  for (let i = 1; i < at.length; i++) at[i] = Math.max(at[i], at[i - 1]);
  return at;
}
