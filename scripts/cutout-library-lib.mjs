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
export function judgeCandidate(c, spec, { minSide = 900, query = "" } = {}) {
  if (!isAllowedLicense(c.license)) return { ok: false, why: `licence ${c.license || "unknown"} is not on the allowlist` };
  const text = candidateText(c);
  if (UNSAFE.test(text)) return { ok: false, why: "unsafe words in the source text" };
  if (NOT_PHOTO.test(text)) return { ok: false, why: "the source calls it a drawing / vector / icon, not a photograph" };
  if (c.mime && !/^image\/(jpeg|png|webp)$/.test(c.mime)) return { ok: false, why: `${c.mime} is not a bitmap photograph` };
  const longest = Math.max(Number(c.width) || 0, Number(c.height) || 0);
  if (longest && longest < minSide) return { ok: false, why: `${longest}px is under ${minSide}px` };
  if (!text.trim()) return { ok: true, why: "no source text (ranked last)", rank: 2 };
  // Rejected only when the source's words (title, description, tags) share NO word with the query or the
  // spec's keywords — case, plurals and prefixes ("A courthouse in Ohio", "Courthouses") do not matter.
  const have = new Set(words(text));
  const want = new Set([...words(query), ...(spec.words || []).flatMap((w) => words(w))]);
  const hit = [...want].some((w) => have.has(w));
  if (!hit) return { ok: false, why: "the source's words share no word with the query" };
  return { ok: true, why: "word match", rank: words(query).every((w) => have.has(w)) ? 0 : 1 };
}

const STOP = new Set(["the", "and", "with", "for", "from", "that", "this", "are", "its", "was", "photo", "image", "file", "jpg", "png", "jpeg"]);
/** Lower-case words of >= 3 letters, plural-folded ("coins" -> "coin"), minus stop words. */
export function words(text) {
  return String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/**
 * Wait-and-retry for HTTP 429, per source (the caller keeps one `state` for the run):
 *   429 -> "[cutouts] <src>: 429, waiting 30s", sleep 30 s, retry once;
 *   429 again -> sleep 60 s, retry once more;
 *   a third consecutive 429 -> "rate-limited, disabling for this run" (the source is `dead`);
 *   403 (or 401) is a block, not a rate limit: the source is disabled at once.
 * Any success resets the count. Returns fn()'s value, or throws the last error when the source is
 * disabled or the error is not a rate limit.
 */
export async function withBackoff(state, source, fn, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.warn } = {}) {
  state.dead = state.dead || new Set();
  state.streak = state.streak || {};
  for (;;) {
    if (state.dead.has(source)) throw Object.assign(new Error(`${source} is disabled for this run`), { disabled: true });
    try {
      const v = await fn();
      state.streak[source] = 0;
      return v;
    } catch (e) {
      const m = String(e?.message || e);
      if (/HTTP (401|403)\b/.test(m)) {
        state.dead.add(source);
        log(`[cutouts] ${source}: blocked (${m.slice(0, 60)}) — disabling for this run`);
        throw e;
      }
      if (!/HTTP 429\b/.test(m)) throw e;
      state.streak[source] = (state.streak[source] || 0) + 1;
      if (state.streak[source] >= 3) {
        state.dead.add(source);
        log(`[cutouts] ${source}: rate-limited, disabling for this run`);
        throw e;
      }
      const wait = state.streak[source] === 1 ? 30 : 60;
      log(`[cutouts] ${source}: 429, waiting ${wait}s`);
      await sleep(wait * 1000);
    }
  }
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
export function sourceNote() {
  return "**Built from Wikimedia Commons and Openverse — no API keys required.**";
}

/** CREDITS.md from the index: name, source, licence, attribution, page, query. */
export function creditsMarkdown(index) {
  const rows = (index.cutouts || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const esc = (s) => String(s || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return `# Cutout credits

Real photographs of physical objects, isolated onto transparent PNGs by
\`scripts/build-cutout-library.mjs\` (rembg u2net, then the geometric checks in
\`scripts/cutout_lib.py\`). Every licence is on the allowlist in
\`src/skills/asset-sourcing/licenses.js\` (public domain, CC0, CC-BY — all free for commercial use). CC-BY requires the
attribution below.

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
