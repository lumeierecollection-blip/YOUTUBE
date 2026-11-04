#!/usr/bin/env node
/**
 * Produce the two review reports that prove the pictures match the narration:
 *
 *   visual-repetition-report.json  — every scene, every image, repeats, people ratio
 *   narration-visual-mapping.json  — sentence -> time span -> image -> why
 *
 *   node scripts/editor/visual-reports.mjs \
 *     --plan data/editor/auto/<stem>/plan.json \
 *     --manifest data/editor/assets/1/asset-manifest.json \
 *     --out-dir data/editor/auto/<stem>
 *
 * The step fails (exit 1) when an image is reused across sentences, when an
 * image is unused, when a sentence has no visual, or when the people-focused
 * ratio is below 75%. Reports are written before the failure so the artifact
 * still explains what went wrong.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scriptSentences } from "./captions.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIN_PEOPLE_RATIO = 0.75;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const planPath = arg("plan");
const manifestPath = arg("manifest");
if (!planPath || !manifestPath) {
  console.error("usage: visual-reports.mjs --plan <plan.json> --manifest <asset-manifest.json> --out-dir <dir>");
  process.exit(2);
}

const plan = JSON.parse(readFileSync(resolve(ROOT, planPath), "utf8"));
const manifest = JSON.parse(readFileSync(resolve(ROOT, manifestPath), "utf8"));
const script = JSON.parse(readFileSync(resolve(ROOT, plan.script), "utf8"));
const sentences = scriptSentences(script);
const byId = new Map((manifest.images || []).map((img) => [img.id, img]));

const groups = new Map();
for (const scene of plan.scenes || []) {
  const m = /^s(\d+)-/.exec(String(scene.id || ""));
  if (!m) throw new Error(`scene ${scene.id} does not carry a sentence index`);
  const idx = Number(m[1]);
  if (!groups.has(idx)) groups.set(idx, []);
  groups.get(idx).push(scene);
}

const perSentence = [];
const missing = [];
for (let i = 0; i < sentences.length; i++) {
  const scenes = (groups.get(i) || []).slice().sort((a, b) => Number(a.start) - Number(b.start));
  if (!scenes.length) {
    missing.push(i);
    perSentence.push({ sentence_index: i, narration: sentences[i], visual: null, scenes: [], error: "no scene for this sentence" });
    continue;
  }
  const ids = [...new Set(scenes.map((s) => s.asset))];
  const img = byId.get(ids[0]);
  if (ids.length !== 1) {
    perSentence.push({ sentence_index: i, narration: sentences[i], visual: null, scenes: scenes.map((s) => s.id), error: `sentence uses ${ids.length} different images: ${ids.join(", ")}` });
    continue;
  }
  if (!img) {
    perSentence.push({ sentence_index: i, narration: sentences[i], visual: null, scenes: scenes.map((s) => s.id), error: `asset ${ids[0]} is not in the visual pack` });
    continue;
  }
  perSentence.push({
    sentence_index: i,
    narration: sentences[i],
    start_s: Math.min(...scenes.map((s) => Number(s.start))),
    end_s: Math.max(...scenes.map((s) => Number(s.end))),
    scene_ids: scenes.map((s) => s.id),
    scene_count: scenes.length,
    visual: {
      asset_id: img.id,
      filename: img.filename,
      file: img.file,
      subject: img.subject,
      kind: img.kind,
      label: img.label,
      alt: img.alt,
      note: img.note,
      reason: img.reason,
      credit: img.attribution,
      license: img.license,
      source_url: img.page_url,
      commons_title: img.commons_title,
    },
  });
}

const used = perSentence.filter((x) => x.visual).map((x) => x.visual.asset_id);
const uniqueUsed = [...new Set(used)];
const usage = new Map();
for (const item of perSentence) {
  if (!item.visual) continue;
  if (!usage.has(item.visual.asset_id)) usage.set(item.visual.asset_id, new Set());
  usage.get(item.visual.asset_id).add(item.sentence_index);
}
const crossSentenceRepeats = [...usage.entries()].filter(([, set]) => set.size > 1).map(([asset_id, set]) => ({ asset_id, sentence_indices: [...set].sort((a, b) => a - b) }));
const withinSentenceRepeats = perSentence.filter((x) => x.scene_count > 1 && x.visual).map((x) => ({ asset_id: x.visual.asset_id, sentence_index: x.sentence_index, scene_count: x.scene_count, frames: x.scene_ids }));
const usedPeople = uniqueUsed.filter((id) => {
  const kind = byId.get(id)?.kind;
  return kind === "person" || kind === "people";
}).length;
const peopleRatio = uniqueUsed.length ? usedPeople / uniqueUsed.length : 0;
const unusedImages = (manifest.images || []).filter((img) => !uniqueUsed.includes(img.id)).map((img) => ({ id: img.id, subject: img.subject, sentence_index: img.sentence_index }));
const expected = manifest.total_downloaded || (manifest.images || []).length;

const checks = {
  every_sentence_has_one_visual: missing.length === 0 && perSentence.every((x) => x.visual && !x.error),
  no_cross_sentence_repeats: crossSentenceRepeats.length === 0,
  people_ratio_at_least_75_percent: peopleRatio >= MIN_PEOPLE_RATIO,
};
const pass = Object.values(checks).every(Boolean);

const generatedAt = new Date().toISOString();
const report = {
  schema: "visual-repetition-report/v1",
  generated_at: generatedAt,
  video: plan.id,
  plan: planPath,
  visual_pack_manifest: manifestPath,
  audio: plan.audio,
  script: plan.script,
  sentences: sentences.length,
  scenes: (plan.scenes || []).length,
  unique_images_used: uniqueUsed.length,
  expected_unique_images: expected,
  people_focused_images: usedPeople,
  people_ratio: Number(peopleRatio.toFixed(4)),
  people_ratio_min: MIN_PEOPLE_RATIO,
  cross_sentence_repeats: crossSentenceRepeats,
  within_sentence_repeats: withinSentenceRepeats,
  unused_images: unusedImages,
  missing_sentences: missing,
  checks,
  pass,
  per_sentence: perSentence,
};
const mapping = {
  schema: "narration-visual-mapping/v1",
  generated_at: generatedAt,
  video: plan.id,
  audio: plan.audio,
  script: plan.script,
  visual_pack_manifest: manifestPath,
  images_source: manifest.source,
  mappings: perSentence.map((x) => ({
    sentence_index: x.sentence_index,
    start_s: x.start_s,
    end_s: x.end_s,
    narration: x.narration,
    visual: x.visual,
    why_this_visual: x.visual?.reason || x.visual?.note || "",
    scene_ids: x.scene_ids || [],
  })),
};

const outDir = resolve(ROOT, arg("out-dir") || dirname(planPath));
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "visual-repetition-report.json"), JSON.stringify(report, null, 2));
writeFileSync(resolve(outDir, "narration-visual-mapping.json"), JSON.stringify(mapping, null, 2));

const md = [
  `# Visual repetition report — ${plan.id}`,
  "",
  `- Sentences: **${sentences.length}**`,
  `- Scenes: **${(plan.scenes || []).length}**`,
  `- Unique images used: **${uniqueUsed.length}/${expected}**`,
  `- People-focused images: **${usedPeople}/${uniqueUsed.length} (${(peopleRatio * 100).toFixed(1)}%)** (minimum ${(MIN_PEOPLE_RATIO * 100).toFixed(0)}%)`,
  `- Cross-sentence repeats: **${crossSentenceRepeats.length}**`,
  `- Unused pack images: **${unusedImages.length}**`,
  `- Result: **${pass ? "PASS" : "FAIL"}**`,
  "",
  "| # | Narration | Image | Subject | Kind | Time |",
  "|---|---|---|---|---|---|",
  ...perSentence.map((x) => `| ${x.sentence_index} | ${String(x.narration).replace(/\|/g, "\\|")} | ${x.visual ? `\`${x.visual.filename}\`` : "—"} | ${x.visual ? x.visual.subject : "—"} | ${x.visual ? x.visual.kind : "—"} | ${x.start_s ?? "—"}–${x.end_s ?? "—"}s |`),
  "",
  "## Checks",
  "",
  ...Object.entries(checks).map(([k, v]) => `- ${v ? "PASS" : "FAIL"} — ${k}`),
  "",
  ...(crossSentenceRepeats.length ? ["## Cross-sentence repeats", "", ...crossSentenceRepeats.map((r) => `- ${r.asset_id}: sentences ${r.sentence_indices.join(", ")}`), ""] : []),
  ...(withinSentenceRepeats.length ? ["## Within-sentence re-frames (allowed)", "", ...withinSentenceRepeats.map((r) => `- ${r.asset_id}: sentence ${r.sentence_index}, ${r.scene_count} shots`), ""] : []),
  ...(unusedImages.length ? ["## Unused images", "", ...unusedImages.map((r) => `- ${r.id} (${r.subject})`), ""] : []),
].join("\n");
writeFileSync(resolve(outDir, "visual-repetition-report.md"), md);

const mapMd = [
  `# Narration → visual mapping — ${plan.id}`,
  "",
  ...perSentence.flatMap((x) => [
    `## ${x.sentence_index}. ${x.narration}`,
    "",
    x.visual ? `- Time: **${x.start_s}–${x.end_s}s**` : "- Time: —",
    x.visual ? `- Image: \`${x.visual.filename}\` — ${x.visual.subject} (${x.visual.kind})` : "- Image: **MISSING**",
    x.visual ? `- Credit: ${x.visual.credit}` : "",
    x.visual ? `- Licence: ${x.visual.license}` : "",
    x.visual ? `- Source: ${x.visual.source_url}` : "",
    x.visual ? `- Why: ${x.visual.reason || x.visual.note || ""}` : "",
    "",
  ]),
].join("\n");
writeFileSync(resolve(outDir, "narration-visual-mapping.md"), mapMd);

console.log(`[visual-reports] ${uniqueUsed.length}/${expected} unique images, ${usedPeople}/${uniqueUsed.length} people-focused (${(peopleRatio * 100).toFixed(1)}%), repeats=${crossSentenceRepeats.length}, unused=${unusedImages.length}`);
for (const [k, v] of Object.entries(checks)) console.log(`[visual-reports] ${v ? "PASS" : "FAIL"} ${k}`);
if (!pass) {
  console.error("::error::visual-reports: production gate failed");
  process.exit(1);
}
console.log(`[visual-reports] wrote ${outDir}/visual-repetition-report.json and narration-visual-mapping.json`);
