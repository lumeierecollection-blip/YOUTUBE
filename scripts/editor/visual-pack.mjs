/**
 * Apply a curated historical visual pack to an auto-built editor plan.
 *
 * The pack is the manifest produced by
 * scripts/assets/download-historical-images.mjs. Each image carries a
 * sentence_index, so the image is tied to the spoken sentence it illustrates.
 * This module replaces every scene's asset with its sentence's image and prunes
 * the plan's asset table, which is important because the renderer stages every
 * asset in plan.assets and fails on a missing file.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIN_PEOPLE_RATIO = 0.75;

export function loadVisualPack(manifestPath, { root = process.cwd() } = {}) {
  if (!manifestPath) throw new Error("visual pack: no manifest path");
  const abs = resolve(root, manifestPath);
  if (!existsSync(abs)) throw new Error(`visual pack manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(abs, "utf8"));
  if (manifest.status && manifest.status !== "ok") throw new Error(`visual pack status is "${manifest.status}": ${(manifest.errors || []).join("; ")}`);
  const images = Array.isArray(manifest.images) ? manifest.images.slice() : [];
  if (!images.length) throw new Error(`visual pack ${manifestPath} has no images`);

  const ids = new Set();
  const hashes = new Set();
  const sentences = new Set();
  for (const img of images) {
    if (!img.id || !img.file) throw new Error(`visual pack image is missing id/file: ${JSON.stringify(img).slice(0, 200)}`);
    if (!Number.isInteger(img.sentence_index) || img.sentence_index < 0) throw new Error(`visual pack image ${img.id} has no sentence_index`);
    if (ids.has(img.id)) throw new Error(`visual pack has duplicate id ${img.id}`);
    if (sentences.has(img.sentence_index)) throw new Error(`visual pack has two images for sentence ${img.sentence_index}`);
    if (img.sha256 && hashes.has(img.sha256)) throw new Error(`visual pack repeats image content (sha256 ${img.sha256})`);
    ids.add(img.id);
    sentences.add(img.sentence_index);
    if (img.sha256) hashes.add(img.sha256);
    const file = resolve(root, img.file);
    if (!existsSync(file)) throw new Error(`visual pack image missing on disk: ${img.file}`);
    if (!(img.width > 0) || !(img.height > 0)) throw new Error(`visual pack image ${img.id} has no dimensions`);
  }
  images.sort((a, b) => a.sentence_index - b.sentence_index);
  return { ...manifest, images, manifestPath };
}

/**
 * Replace every scene asset with the pack image for that scene's sentence.
 * scene ids are produced by auto-plan as s< sentence >-<asset> (and s< sentence >-...b
 * for a re-framed second shot), so the sentence index is recoverable from the id.
 */
export function applyVisualPack(plan, pack, { sentenceCount } = {}) {
  const bySentence = new Map();
  for (const img of pack.images) bySentence.set(img.sentence_index, img);

  const n = Number.isInteger(sentenceCount) ? sentenceCount : Math.max(...bySentence.keys()) + 1;
  for (let i = 0; i < n; i++) {
    if (!bySentence.has(i)) throw new Error(`visual pack is missing an image for sentence ${i} (script has ${n} sentences)`);
  }
  for (const idx of bySentence.keys()) {
    if (idx >= n) throw new Error(`visual pack has an image for sentence ${idx}, but the script has only ${n} sentences`);
  }

  const used = new Set();
  const seenSentences = new Set();
  for (const scene of plan.scenes || []) {
    const m = /^s(\d+)-/.exec(String(scene.id || ""));
    if (!m) throw new Error(`visual pack: scene "${scene.id}" does not carry a sentence index`);
    const idx = Number(m[1]);
    const img = bySentence.get(idx);
    if (!img) throw new Error(`visual pack: no image for sentence ${idx} (scene ${scene.id})`);
    scene.asset = img.id;
    scene.fit = "cover";
    delete scene.rect;
    // People are framed a little high so faces survive the 9:16 cover crop.
    scene.fy = img.kind === "person" ? 0.28 : img.kind === "place" ? 0.5 : 0.4;
    if (img.label) scene.kicker = img.label;
    // A figure graphic that expected a flat card must not paint its own backdrop over the photo.
    if (scene.graphic && scene.graphic.backdrop) scene.graphic.backdrop = false;
    used.add(img.id);
    seenSentences.add(idx);
  }
  if (seenSentences.size !== n) throw new Error(`visual pack: the plan covers ${seenSentences.size}/${n} sentences`);

  const assets = {};
  for (const img of pack.images) {
    if (!used.has(img.id)) continue;
    assets[img.id] = {
      file: img.file,
      width: img.width,
      height: img.height,
      credit: img.attribution,
      source_url: img.page_url,
      license: img.license,
    };
  }
  if (Object.keys(assets).length !== used.size) throw new Error("visual pack: some used images are missing from the manifest");
  for (const scene of plan.scenes || []) {
    if (!assets[scene.asset]) throw new Error(`visual pack: scene ${scene.id} references ${scene.asset}, which is not staged`);
  }

  plan.assets = assets;
  plan.visual_pack = {
    manifest: pack.manifestPath,
    pack: pack.pack,
    status: pack.status || "ok",
    images: pack.images.length,
    people_focused: pack.people_focused,
    people_ratio: pack.people_ratio,
  };
  return plan;
}

/** Guard for the report step: the pack must stay at or above the people-focused floor. */
export function assertPeopleRatio(pack, min = MIN_PEOPLE_RATIO) {
  const ratio = Number(pack.people_ratio);
  if (!(ratio >= min)) throw new Error(`visual pack people ratio ${ratio} is below ${min}`);
  return true;
}
