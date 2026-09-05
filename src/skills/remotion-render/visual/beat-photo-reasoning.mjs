/**
 * PER-BEAT PHOTO REASONING
 *
 * Every pipeline run, this stage takes each beat's actual script line and its
 * candidate photos, and decides which candidate (if any) genuinely fits. Cost
 * is secondary; the decision is logged with the evidence that justified it.
 *
 * Two rules are deliberately mechanical rather than left to a model's taste,
 * because both are places where a plausible-sounding guess would be
 * indistinguishable from a real match:
 *
 *   1. WHAT COUNTS AS METADATA. Every candidate carries exactly five fields.
 *      A field the source did not supply is recorded as an explicit
 *      MISSING marker. It is never omitted, and never back-filled with a
 *      guess about what the picture probably shows.
 *
 *   2. WHAT COUNTS AS A FIT. Only text the SOURCE supplied can be evidence.
 *      A filename is not evidence. A production note somebody wrote while
 *      sourcing the image is not evidence. What the image looks like to a
 *      model is not evidence. If the only thing linking a beat to a picture
 *      is an impression, the beat is reported UNMATCHED and the caller falls
 *      back, rather than asserting a match nothing grounds.
 */

import { openSync, readSync, closeSync, statSync } from "node:fs";

/** The five fields every candidate must carry. Order is the log order. */
export const REQUIRED_CANDIDATE_FIELDS = [
  "source_name",
  "source_url",
  "search_query",
  "dimensions",
  "source_text",
];

/** Marker for a field the source genuinely did not provide. */
export const MISSING = Object.freeze({ missing: true });
export const isMissing = (v) => v === MISSING || (v && v.missing === true);
export const fmt = (v) => (isMissing(v) ? "MISSING — not provided by the source" : v);

// ── image dimensions, measured from the real bytes ──────────────────────────

/**
 * Reads pixel dimensions out of a PNG or JPEG header. Dependency-free on
 * purpose: a measured number is evidence, a number from a manifest someone
 * typed is not.
 */
export function readDimensions(path) {
  let fd;
  try {
    statSync(path);
    fd = openSync(path, "r");
    const head = Buffer.alloc(24);
    readSync(fd, head, 0, 24, 0);

    // PNG: 8-byte signature, then IHDR with width/height as BE uint32.
    if (head.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20), measured: true };
    }

    // JPEG: walk the segment chain to a SOFn frame header.
    if (head[0] === 0xff && head[1] === 0xd8) {
      const size = statSync(path).size;
      const buf = Buffer.alloc(Math.min(size, 5 * 1024 * 1024));
      readSync(fd, buf, 0, buf.length, 0);
      let off = 2;
      while (off < buf.length - 9) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        const len = buf.readUInt16BE(off + 2);
        // SOF0..SOF15, excluding DHT(c4), JPGA(c8) and DAC(cc).
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7), measured: true };
        }
        off += 2 + len;
      }
    }
    return MISSING;
  } catch {
    return MISSING;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

// ── the fit rule ────────────────────────────────────────────────────────────

/**
 * Words that carry no concrete referent. A beat whose only overlap with a
 * candidate is one of these has not matched anything.
 */
const STOPWORDS = new Set(`
a an and are as at be been but by for from had has have he her his how i if in
into is it its of on or our out she so than that the their them then there these
they this to was we were what when where which who will with you your just only
about after all also any because before between both can could did do does down
each even every first get got here how into like made make many more most
much must never new no not now off one other over own said same see should some
such take than their there through time too under until up use used very
was way well went who why would year years
`.trim().split(/\s+/));

const normalize = (w) =>
  w.toLowerCase()
    .replace(/[^a-z0-9%$.-]/g, "")
    .replace(/(?<=[a-z]{4})(?:ies)$/, "y")
    .replace(/(?<=[a-z]{4})(?:es|s)$/, "");

/** The concrete words a script line actually names. */
export function concreteTerms(line) {
  return [...new Set(
    String(line || "")
      .split(/\s+/)
      .map(normalize)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  )];
}

/**
 * Decides whether one candidate genuinely fits one script line.
 *
 * Evidence may come ONLY from `candidate.source_text` — the title,
 * description or alt-text the source itself returned. Everything else on the
 * candidate (its filename, its local path, any note written during sourcing)
 * is explicitly excluded, because a match found there is a match found in our
 * own words rather than the source's.
 */
export function judgeFit(scriptLine, candidate) {
  const text = candidate.source_text;
  if (isMissing(text) || !text || typeof text !== "object") {
    return {
      fits: false,
      reason: "the source returned no title, description or alt-text — nothing to ground a match in",
    };
  }

  const terms = concreteTerms(scriptLine);
  for (const field of ["title", "description", "alt"]) {
    const value = text[field];
    if (isMissing(value) || !value) continue;
    const haystack = String(value);
    const haystackTerms = new Set(haystack.split(/\s+/).map(normalize));
    for (const term of terms) {
      if (haystackTerms.has(term)) {
        return {
          fits: true,
          evidence_field: `source_text.${field}`,
          evidence_quote: haystack,
          matched_term: term,
        };
      }
    }
  }
  return {
    fits: false,
    reason:
      `no concrete term from the script line (${terms.join(", ") || "none"}) appears in any ` +
      `source-provided text; the only remaining link would be what the image looks like, which is not evidence`,
  };
}

/**
 * Runs the reasoning for one beat over its candidates.
 * Returns a decision record — never a bare pick.
 */
export function reasonBeat(scriptLine, candidates) {
  const considered = candidates.map((c) => ({ candidate: c, verdict: judgeFit(scriptLine, c) }));
  const fitting = considered.filter((c) => c.verdict.fits);
  return {
    script_line: scriptLine,
    considered,
    picked: fitting.length ? fitting[0] : null,
    unmatched: fitting.length === 0,
    unmatched_reason: fitting.length
      ? null
      : "no candidate's source-provided text names anything the script line names",
  };
}

// ── the log format ──────────────────────────────────────────────────────────

/**
 * The required per-beat log: the script line, every candidate with its five
 * metadata fields, which one was picked, and the quoted textual evidence that
 * justified the pick. A pick with no quote is not representable here.
 */
export function formatBeatLog(decision, { index } = {}) {
  const L = [];
  L.push(`BEAT ${index ?? "?"}`);
  L.push(`  SCRIPT LINE: ${decision.script_line}`);
  if (decision.considered.length === 0) {
    L.push(`  CANDIDATES CONSIDERED: none — no photo source returned any candidate for this beat`);
  } else {
    L.push(`  CANDIDATES CONSIDERED: ${decision.considered.length}`);
    decision.considered.forEach(({ candidate: c, verdict }, i) => {
      // The five fields are a contract, not a suggestion: a caller that omits
      // one would silently produce a log entry that looks complete. Enforce it
      // here rather than trusting every caller to remember.
      const absent = REQUIRED_CANDIDATE_FIELDS.filter((f) => !(f in c));
      if (absent.length) {
        throw new Error(
          `candidate ${i + 1} omits required field(s): ${absent.join(", ")}. ` +
            `A field the source did not supply must be present and set to MISSING, never left out.`,
        );
      }
      const t = c.source_text;
      const st = isMissing(t)
        ? "MISSING — not provided by the source"
        : ["title", "description", "alt"]
            .map((f) => `${f}=${isMissing(t[f]) || !t[f] ? "MISSING — not provided by the source" : JSON.stringify(t[f])}`)
            .join("; ");
      const dim = isMissing(c.dimensions)
        ? "MISSING — could not be measured"
        : `${c.dimensions.width}x${c.dimensions.height}${c.dimensions.measured ? " (measured from the file)" : ""}`;
      L.push(`    [${i + 1}] source_name:   ${fmt(c.source_name)}`);
      L.push(`        source_url:    ${fmt(c.source_url)}`);
      L.push(`        search_query:  ${fmt(c.search_query)}`);
      L.push(`        dimensions:    ${dim}`);
      L.push(`        source_text:   ${st}`);
      L.push(`        verdict:       ${verdict.fits ? `FITS on ${verdict.evidence_field} via "${verdict.matched_term}"` : `does not fit — ${verdict.reason}`}`);
    });
  }
  if (decision.picked) {
    const { candidate: c, verdict } = decision.picked;
    L.push(`  PICKED: ${fmt(c.source_url)}`);
    L.push(`  JUSTIFICATION (quoted from the candidate's own ${verdict.evidence_field}):`);
    L.push(`    "${verdict.evidence_quote}"`);
    L.push(`    matched the script line's concrete term "${verdict.matched_term}"`);
  } else {
    L.push(`  PICKED: none`);
    L.push(`  UNMATCHED GAP: ${decision.unmatched_reason}`);
  }
  return L.join("\n");
}
