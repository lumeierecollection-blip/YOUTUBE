/**
 * dedupe-sentences — a script never says the same thing twice.
 *
 * Board 39031532519 ch-44: the claims repair replaced the hook with an exact copy of the setup's first sentence, the story repair turned the re-hook
 * into the setup's second sentence minus "Author", and the close repeated the hook's words. The clarity reader flagged "Exact repeat of sentence 1",
 * but story failures after the re-asks are logged and the script continues (owner's ruling), so the video narrated the same line twice and its
 * word timings collapsed (a 1.07 s beat, blank frames, words popping out of order).
 *
 * Deletion only, like fit-short.js: nothing is reworded, so every remaining sentence and fact is exactly as written and traceable. Two sentences are
 * repeats when the content words (3+ letters, not stopwords) of the shorter one are at least 85 % inside the other's, and it has 5 or more of them.
 * Of a pair, the copy in a section that keeps another sentence is removed (the later copy first); a pair where both copies are the only sentence of
 * their section cannot be fixed by deletion and is returned in `unfixable` (the caller decides: re-ask or skip).
 */

const STOP = new Set("the and for with that this these those from into onto over under about after before their there they them then than when what which while where who whom whose will would could should have has had was were are been being its it's his her hers our ours your yours you not but also just only very more most such each every some any all both either neither one per via says said".split(" "));
export const contentWords = (s) => [...new Set(String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w)))];
// A period after an abbreviation or an initial ends no sentence ("1220 Chew Ave. in Olney", "St. Louis Hotel", "M. H. Bazerman", "U.S. banks"):
// splitting there made fragments that matched each other in the repo's own scripts.
const ABBR = /(?:\b(?:St|Ave|Rd|Blvd|Mt|Ft|Mr|Mrs|Ms|Dr|Jr|Sr|Inc|Co|Corp|Ltd|vs|No|Gen|Gov|Sen|Rep|Lt|Col|Capt|Sgt|Prof|Dept|Univ|approx|etc|[A-Z])\.)$/;
export function splitSentences(t) {
  const out = [];
  for (const piece of String(t || "").trim().split(/(?<=[.!?])\s+/).filter(Boolean)) {
    if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += " " + piece;
    else out.push(piece);
  }
  return out;
}

/** true when `a` and `b` say the same thing (see above). A question and a statement never repeat each other: the setup asks what the payoff answers. */
export function isRepeat(a, b) {
  if (/\?\s*$/.test(String(a).trim()) !== /\?\s*$/.test(String(b).trim())) return false;
  const wa = contentWords(a), wb = contentWords(b);
  const [small, big] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  if (small.length < 5) return false;
  return small.filter((w) => big.has(w)).length / small.length >= 0.85;
}

/** -> { sections (new array), removed: [{section, sentence, repeats}], unfixable: [{a, b}] } */
export function dedupeSections(sections) {
  const parts = (sections || []).map((s) => splitSentences(s.voiceover));
  const removed = [], unfixable = [];
  let changed = true;
  while (changed) {
    changed = false;
    const flat = parts.flatMap((ss, i) => ss.map((text, k) => ({ i, k, text })));
    outer: for (let x = 0; x < flat.length; x++) {
      for (let y = x + 1; y < flat.length; y++) {
        const A = flat[x], B = flat[y];
        if (!isRepeat(A.text, B.text)) continue;
        const gone = parts[B.i].length > 1 ? B : parts[A.i].length > 1 ? A : null;
        if (!gone) { if (!unfixable.some((u) => u.a === A.text && u.b === B.text)) unfixable.push({ a: A.text, b: B.text }); continue; }
        parts[gone.i].splice(gone.k, 1);
        removed.push({ section: sections[gone.i].id, sentence: gone.text, repeats: (gone === B ? A : B).text });
        changed = true;
        break outer;
      }
    }
  }
  return { sections: sections.map((s, i) => ({ ...s, voiceover: parts[i].join(" ") })), removed, unfixable };
}
