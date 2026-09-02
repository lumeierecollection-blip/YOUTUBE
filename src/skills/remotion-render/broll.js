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
