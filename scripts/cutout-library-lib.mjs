/**
 * The pure parts of the cutout library builder (scripts/build-cutout-library.mjs),
 * split out so scripts/test-cutout-library.mjs can test them without a network.
 */
import { isAllowedLicense, normalizeLicense } from "../src/skills/asset-sourcing/licenses.js";

// A photograph of a physical object — not a drawing, an icon, a vector or a logo.
const NOT_PHOTO = /\b(vector|illustration|clip ?art|icon|icons|cartoon|drawing|sketch|logo|emoji|infographic|pictogram|watercolou?r|painting)\b/i;
// A person-free / NSFW guard on the words the source itself gives.
const UNSAFE = /\b(nude|naked|nsfw|lingerie|topless|erotic)\b/i;

/** Every word the source gives about a candidate (title, alt, tags, description), lower-cased, as one string. */
export function candidateText(c) {
  const st = c.sourceText && typeof c.sourceText === "object" ? Object.values(c.sourceText) : [];
  return [c.title, ...st].filter(Boolean).join(" ").toLowerCase();
}

/**
 * Is this candidate worth downloading for `spec`? { ok, why }.
 *  - its licence is on the allowlist (asset-sourcing/licenses.js);
 *  - the source's own words do not say it is not a photograph, and are not unsafe;
 *  - they share at least one keyword with the spec (a candidate with NO words at
 *    all — Pexels alt is often empty — is allowed, and ranked last: the geometric
 *    checks and the human contact-sheet review are what remain);
 *  - it is large enough to cut out at retina size.
 */
export function judgeCandidate(c, spec, { minSide = 900 } = {}) {
  if (!isAllowedLicense(c.license)) return { ok: false, why: `licence ${c.license || "unknown"} is not on the allowlist` };
  const text = candidateText(c);
  if (UNSAFE.test(text)) return { ok: false, why: "unsafe words in the source text" };
  if (NOT_PHOTO.test(text)) return { ok: false, why: "the source calls it a drawing / vector / icon, not a photograph" };
  const longest = Math.max(Number(c.width) || 0, Number(c.height) || 0);
  if (longest && longest < minSide) return { ok: false, why: `${longest}px is under ${minSide}px` };
  const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
  const hit = (spec.words || []).some((w) => (/\s/.test(w) ? text.includes(w) : words.has(w)));
  if (!text.trim()) return { ok: true, why: "no source text (ranked last)", rank: 2 };
  if (!hit) return { ok: false, why: "the source's words share no keyword with the spec" };
  return { ok: true, why: "keyword match", rank: 0 };
}

/** Candidates worth trying, best first: keyword matches, then the wordless; larger first; deduplicated by URL. */
export function shortlist(cands, spec, opts = {}) {
  const seen = new Set(), out = [];
  for (const c of cands) {
    if (!c?.downloadUrl || seen.has(c.downloadUrl)) continue;
    seen.add(c.downloadUrl);
    const j = judgeCandidate(c, spec, opts);
    if (j.ok) out.push({ c, rank: j.rank });
  }
  out.sort((a, b) => a.rank - b.rank || (Number(b.c.width) || 0) - (Number(a.c.width) || 0));
  return out.map((x) => x.c);
}

/** Which sources built the library, and which were unavailable (no API key) — read from the index, never hard-coded. */
export function sourceNote(index) {
  const used = [...new Set((index.cutouts || []).map((c) => c.source))].sort();
  const skipped = index.sources_skipped || [];
  const cap = (a) => a.map((x) => x[0].toUpperCase() + x.slice(1));
  return `**Built from ${used.length ? cap(used).join(" and ") : "no source yet"} only${skipped.length ? `; ${cap(skipped).join(" and ")} ${skipped.length > 1 ? "were" : "was"} unavailable (no API key)` : ""}.**`;
}

/** CREDITS.md from the index: name, source, licence, attribution, page, query. */
export function creditsMarkdown(index) {
  const rows = (index.cutouts || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const esc = (s) => String(s || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return `# Cutout credits

Real photographs of physical objects, isolated onto transparent PNGs by
\`scripts/build-cutout-library.mjs\` (rembg u2net, then the geometric checks in
\`scripts/cutout_lib.py\`). Every licence is on the allowlist in
\`src/skills/asset-sourcing/licenses.js\` (public domain, CC0, CC-BY, or the
Pexels / Unsplash / Pixabay licences — all free for commercial use). CC-BY
requires the attribution below.

${sourceNote(index)}

| Cutout | Source | Licence | Attribution | Page | Query that found it |
|---|---|---|---|---|---|
${rows.map((r) => `| ${esc(r.name)} | ${esc(r.source)} | ${esc(normalizeLicense(r.license) || r.license)} | ${esc(r.attribution)} | ${r.source_url ? `<${esc(r.source_url)}>` : ""} | ${esc(r.query)} |`).join("\n")}
`;
}

/** MISSING.md: the cutouts that could not be fetched cleanly, and what was tried. */
export function missingMarkdown(index) {
  const rows = (index.missing || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  return `# Cutouts that could not be fetched

Each of these failed three different queries (the attempts are logged in
\`data/cutout-library-log.jsonl\`). A missing cutout is NOT replaced by a drawing:
the beat draws no concept visual for it (the number and label alone), or a
cutout of the same category when one exists. Re-run
\`node scripts/build-cutout-library.mjs --only <name>\` after adding a key or a
query.

${rows.length ? rows.map((r) => `## ${r.name}\n\n${(r.attempts || []).map((a) => `- ${a}`).join("\n") || "- (no attempt recorded)"}\n`).join("\n") : "None: every cutout in the brief was fetched.\n"}`;
}

/** Merge one result into the index (replace by name). */
export function upsert(index, entry) {
  const cutouts = (index.cutouts || []).filter((c) => c.name !== entry.name).concat(entry);
  const missing = (index.missing || []).filter((m) => m.name !== entry.name);
  return { ...index, cutouts, missing };
}
export function markMissing(index, name, attempts) {
  const missing = (index.missing || []).filter((m) => m.name !== name).concat({ name, attempts });
  return { ...index, missing };
}
