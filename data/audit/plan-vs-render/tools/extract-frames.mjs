/**
 * Plan-vs-render audit tooling (NOT pipeline code — audit only).
 * Step 1: extract each beat's plan fields + timing into plan.json
 * Step 2: extract frames at 25/50/75% of each beat and measure them
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const AUDIT = "data/audit/plan-vs-render";

// channel -> { plan, manifest, mp4, run }
export const INPUTS = {
  "ch-26": {
    run: "37313431912",
    plan: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/rendered/rendered-26-37313431912/data/visual-plans/26/base-vault-whitelist-hack-6m-2026-shorts-script-visual-plan.json",
    manifest: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/rendered/rendered-26-37313431912/data/renders/26/base-vault-whitelist-hack-6m-2026-shorts-shorts-2026-10-05-manifest.json",
    mp4: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/queues/qa-queues-26-37313431912/rejected/base-vault-whitelist-hack-6m-2026-shorts-shorts-2026-10-05.mp4",
  },
  "ch-49": {
    run: "37313431912",
    plan: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/rendered/rendered-49-37313431912/data/visual-plans/49/harvey-keitel-the-method-acting-scene-shorts-script-visual-plan.json",
    manifest: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/rendered/rendered-49-37313431912/data/renders/49/harvey-keitel-the-method-acting-scene-shorts-shorts-2026-10-05-manifest.json",
    mp4: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/queues/qa-queues-49-37313431912/approved/harvey-keitel-the-method-acting-scene-shorts-shorts-2026-10-05.mp4",
  },
  "ch-9": {
    run: "37313431912",
    plan: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/rendered/rendered-9-37313431912/data/visual-plans/9/india-kalapani-territorial-map-dispute-nepal-shorts-script-visual-plan.json",
    manifest: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/rendered/rendered-9-37313431912/data/renders/9/india-kalapani-territorial-map-dispute-nepal-shorts-shorts-2026-10-05-manifest.json",
    mp4: "C:/Users/user/AppData/Local/Temp/opencode/audit37313431912/queues/qa-queues-9-37313431912/rejected/india-kalapani-territorial-map-dispute-nepal-shorts-shorts-2026-10-05.mp4",
  },
  "ch-44": {
    run: "37308547249",
    plan: "C:/Users/user/AppData/Local/Temp/opencode/audit37308547249/rendered/rendered-44-37308547249/data/visual-plans/44/stop-managing-ai-agents-blind-pixel-agents-shorts-script-visual-plan.json",
    manifest: "C:/Users/user/AppData/Local/Temp/opencode/audit37308547249/rendered/rendered-44-37308547249/data/renders/44/stop-managing-ai-agents-blind-pixel-agents-shorts-shorts-2026-10-05-manifest.json",
    mp4: "C:/Users/user/AppData/Local/Temp/opencode/audit37308547249/queues/qa-queues-44-37308547249/approved/stop-managing-ai-agents-blind-pixel-agents-shorts-shorts-2026-10-05.mp4",
  },
};

function frameAt(mp4, sec, out) {
  try {
    execFileSync("ffmpeg", ["-ss", String(sec), "-i", mp4, "-frames:v", "1", out, "-y"], { stdio: "pipe", timeout: 60000 });
    return existsSync(out);
  } catch { return false; }
}

/** size, mean pixel value, ink bounding box (pixels darker than 200/255). */
async function measure(png) {
  const img = sharp(png);
  const meta = await img.metadata();
  const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let sum = 0, ink = 0, minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = data[y * width + x];
      sum += v;
      if (v < 200) { ink++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  return {
    path: png,
    size: `${width}x${height}`,
    mean: Number((sum / (width * height)).toFixed(2)),
    ink_fraction: Number((ink / (width * height)).toFixed(4)),
    ink_bbox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}

const channel = process.argv[2];
const src = INPUTS[channel];
if (!src) { console.error("usage: node extract-frames.mjs ch-26|ch-49|ch-9|ch-44"); process.exit(2); }
const dir = join(AUDIT, channel);
mkdirSync(dir, { recursive: true });

const plan = JSON.parse(readFileSync(src.plan, "utf8"));
const manifest = JSON.parse(readFileSync(src.manifest, "utf8"));
const mByIndex = new Map((manifest.beats || []).map((b) => [b.index, b]));

const beats = [];
for (const pb of plan.beats || []) {
  const mb = mByIndex.get(pb.index) || {};
  const start = Number(mb.start_sec ?? 0);
  const dur = Number(mb.duration_sec ?? 0);
  const entry = {
    index: pb.index,
    sentence: pb.narration || "",
    scene_description: pb.scene_description || "",
    named_entities: pb.named_entities || [],
    composition_planned: pb.composition || null,
    visual_type_planned: pb.visual_type || null,
    data_planned: pb.data || null,
    entity_anchor_word: pb.entity_anchor_word ?? null,
    visual_events: pb.visual_events || [],
    // what the renderer recorded it actually drew
    rendered: {
      visual_type: mb.visual_type ?? null,
      composition: mb.canvas?.composition ?? null,
      boxes: mb.canvas?.boxes ? Object.keys(mb.canvas.boxes) : [],
      name_card: mb.canvas?.name_card ?? null,
      photo: mb.canvas?.photo?.asset ?? null,
      concept_visuals: (mb.canvas?.concept_visuals || []).map((c) => c.name),
      start_sec: start,
      duration_sec: dur,
      headline_size: mb.canvas?.headline_size ?? null,
      headline_align: mb.canvas?.headline_align ?? null,
      background: mb.canvas?.background ?? null,
      entrance_style: mb.canvas?.entrance_style ?? null,
      animation_family: pb.animation_family ?? null,
    },
    frames: [],
  };
  for (const frac of [0.25, 0.5, 0.75]) {
    const t = Number((start + dur * frac).toFixed(3));
    const out = join(dir, `beat-${pb.index}-${Math.round(frac * 100)}.png`);
    if (!frameAt(src.mp4, t, out)) { entry.frames.push({ at: t, error: "frame extraction failed" }); continue; }
    const m = await measure(out);
    entry.frames.push({ at: t, frac, ...m });
  }
  beats.push(entry);
}

writeFileSync(join(dir, "plan.json"), JSON.stringify({ channel, run: src.run, mp4: src.mp4, video: manifest.video, fps: manifest.fps, width: manifest.width, height: manifest.height, beats }, null, 2));
console.log(`[extract] ${channel}: ${beats.length} beats, ${beats.reduce((n, b) => n + b.frames.filter((f) => !f.error).length, 0)} frames -> ${dir}/plan.json`);
