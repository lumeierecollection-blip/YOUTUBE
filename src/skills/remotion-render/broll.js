/**
 * B-roll resolver — maps a script's b_roll cue strings to real image files
 * sourced per channel (see b-roll-manifest-<channelId>.json). Returns paths
 * relative to public/ so the composition can wrap them with staticFile().
 *
 * Rule of thumb: never invent imagery. If a cue has no matching sourced file,
 * it resolves to nothing.
 *
 * PART 0 of the motion-graphics rebuild — the content-routing bug. A
 * b-roll-manifest-<channelId>.json file is keyed by channel SLOT, but
 * channels get reused across topics over time (b-roll-manifest-ch-01.json
 * was, until this rebuild, stale leftover from a "movile-cave" deep-sea
 * test render that had nothing to do with ch-01's real niche — see
 * src/utils/pipeline.js's loadTopicBrollManifest, which already carried
 * this exact guard for the copyright/disclosure/quality gates but was never
 * applied on the RENDER path, which is what actually puts pixels in the
 * video). resolveBrollFiles now takes the topic_slug of the script actually
 * being rendered and refuses to trust a manifest whose own topic_slug
 * doesn't match — a mismatch resolves to no imagery, never a silent wrong
 * photo, exactly like an unmatched cue already does.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Keyword -> file rules, first-match-wins per cue but multiple rules can add
// files (e.g. a creature montage). Order matters: put specific cues first.
const RULES = [
  { match: /cave entrance/i, files: ["cave-entrance.jpg"] },
  { match: /flashlight|beam cutting|torch/i, files: ["flashlight-beam.jpg"] },
  { match: /calcium|stalactite|speleothem|formation/i, files: ["calcium-formations.jpg"] },
  { match: /microbial mats on cave water/i, files: ["microbial-mats-2.jpg"] },
  { match: /biofilm/i, files: ["microbial-mats.jpg"] },
  { match: /blind cave creature|macro shot of blind|spiders?|leeches?|centipedes?|creature/i, files: ["cave-spider.jpg", "water-scorpion.jpg", "movile-centipede.jpg"] },
  { match: /tunnel crawl|claustrophobic|tight passage|passage/i, files: ["tunnel-crawl.jpg"] },
  { match: /vertical shaft|shaft descent|descent/i, files: ["vertical-shaft.jpg"] },
  { match: /cross-section|cross section|cave map|map with depth/i, files: ["cave-cross-section.png"] },
  { match: /springtail|plutomurus|microscopy/i, files: ["springtail-1980m.jpg", "springtail-macro.jpg"] },
  { match: /rock and mineral|mineral macro|sulfur|sulphur/i, files: ["sulfur-crystal.jpg"] },
  { match: /vent|deep-sea|deep sea/i, files: ["black-smoker.jpg"] },
  { match: /fade to black/i, files: [] },
];

function loadManifest(channelId, topicSlug) {
  const path = join(__dirname, `b-roll-manifest-${channelId}.json`);
  if (!existsSync(path)) return null;
  try {
    const manifest = JSON.parse(readFileSync(path, "utf-8"));
    // A manifest with no topic_slug at all, or a topic_slug that doesn't
    // match the script actually being rendered, is untrusted — the caller
    // gets no imagery rather than a possibly wrong-topic photo.
    if (!topicSlug || manifest.topic_slug !== topicSlug) return null;
    return manifest.files || [];
  } catch {
    return null;
  }
}

/**
 * A DECLARED before/after pair: one subject, photographed under two
 * conditions.
 *
 * BEFORE_AFTER's stated intent is "the same frame under two different
 * conditions", and it has never been able to honour it — `ctx.asset` is
 * singular everywhere and every caller passes `bRollFiles[0]`, so the
 * strategy has only ever had one image available and renders as text.
 *
 * A pair is only ever DECLARED, never inferred. Two photos happening to sit
 * in the same section does not make them one subject under two conditions —
 * treating them that way would assert a relationship no source stated,
 * which is the fabrication CLAUDE.md's first rule forbids. So a pair exists
 * only when the manifest says so, by giving two entries the same
 * `pair_id` and marking each `condition: "before" | "after"`:
 *
 *   { "local": "public/b-roll/ch-07/glacier-1928.jpg",
 *     "pair_id": "muir-glacier", "condition": "before", ... }
 *   { "local": "public/b-roll/ch-07/glacier-2004.jpg",
 *     "pair_id": "muir-glacier", "condition": "after",  ... }
 *
 * Returns null unless exactly one complete before+after pair resolves for
 * this section — an incomplete or ambiguous declaration draws nothing
 * rather than guessing which image is which.
 *
 * NOT YET EXERCISED BY ANY REAL DATA. No manifest in this repo declares a
 * pair, and none can be sourced while the asset APIs are egress-blocked, so
 * this path is compile-checked and reviewed but has never rendered a frame.
 * See CHECK-REGISTER §3.12.19.
 */
export function resolveAssetPair(cues, channelId, topicSlug) {
  const files = loadManifest(channelId, topicSlug) || [];
  const available = new Set(resolveBrollFiles(cues, channelId, topicSlug));
  const byPair = new Map();
  for (const f of files) {
    if (!f || !f.pair_id || !f.condition) continue;
    const path = `b-roll/${channelId}/${basename(f.local || "")}`;
    if (!available.has(path)) continue;
    const cond = String(f.condition).toLowerCase();
    if (cond !== "before" && cond !== "after") continue;
    const slot = byPair.get(f.pair_id) || {};
    // A second image claiming the same slot makes the pair ambiguous.
    if (slot[cond]) { slot.ambiguous = true; }
    slot[cond] = { path, attribution: f.attribution || null, license: f.license || null };
    byPair.set(f.pair_id, slot);
  }
  const complete = [...byPair.entries()].filter(([, s]) => s.before && s.after && !s.ambiguous);
  if (complete.length !== 1) return null;
  const [pairId, slot] = complete[0];
  return { pairId, before: slot.before, after: slot.after };
}

/**
 * Resolve an array of b_roll cue strings to image paths relative to public/.
 * Only files that actually exist in the channel's manifest are returned, and
 * only when the manifest's own topic_slug matches `topicSlug` (the script
 * currently being rendered) — see the header note on why this guard exists.
 */
export function resolveBrollFiles(cues, channelId, topicSlug) {
  if (!cues || !Array.isArray(cues) || cues.length === 0) return [];
  const available = new Set((loadManifest(channelId, topicSlug) || []).map((f) => f.local.replace(/^public\//, "")));
  const resolved = [];
  for (const cue of cues) {
    for (const rule of RULES) {
      if (rule.match.test(cue)) {
        for (const file of rule.files) {
          const path = `b-roll/${channelId}/${basename(file)}`;
          if (!resolved.includes(path) && available.has(path)) resolved.push(path);
        }
      }
    }
  }
  return resolved;
}
