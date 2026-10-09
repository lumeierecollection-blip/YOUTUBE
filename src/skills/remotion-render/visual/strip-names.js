/**
 * A headline without the entity names it repeats. An entity plate carries the name (its mark, or its name set in type): a caption that
 * says it again ("NASA" in the plate, "NASA took over" under it) is one name twice (owner, 2026-10-09). Case-insensitive, whole words,
 * a leading "the" and a trailing "'s" go with the name; dangling articles / linking words are trimmed; fewer than three words left -> "".
 */
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DANGLING = /^(?:and|or|of|the|a|an|to|in|at|by|for|with|from)\s+/i;
const TRAILING = /\s+(?:and|or|of|the|a|an|to|in|at|by|for|with|from|as)$/i;

export function stripEntityNames(text, names) {
  let t = String(text || "");
  if (!names || !names.length) return t;
  for (const nm of names) {
    if (!nm) continue;
    t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:the\\s+)?${esc(nm)}(?:'s)?(?![\\p{L}\\p{N}])`, "giu"), " ");
  }
  t = t.replace(/\s+/g, " ").replace(/^[\s,;:.\-–—]+|[\s,;:\-–—]+$/g, "").trim();
  for (let i = 0; i < 3; i++) t = t.replace(DANGLING, "").replace(TRAILING, "").trim();
  return t.split(/\s+/).filter(Boolean).length >= 3 ? t : "";
}
