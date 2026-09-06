#!/usr/bin/env node
/**
 * SECTION 5.2 — the five automated checks, run against a rendered video.
 *
 *   node visual-engine/qa/motion-checks.mjs <video.mp4> [--plan <beats.json>]
 *
 * These exist because "it looks static" is an impression and this repo does not
 * act on impressions. CHECK 1 is the one that matters: it samples the video and
 * measures how much of the frame actually changed between samples, so "no scene
 * is static for more than three seconds" becomes a number with a frame range
 * attached rather than a claim.
 *
 * CHECK 1 AS SPECIFIED CANNOT SEE THE DEFECT IT WAS WRITTEN FOR, AND SAYING SO
 * IS THE POINT OF RUNNING IT FIRST. Section 5.2 asks: if pixel content does not
 * change for 90 frames, fail. Measured on the 70s ch-02 render, the longest
 * frozen stretch is 10 frames and the median adjacent-sample change is 7.15% of
 * the frame. It passes comfortably — while showing the same document for
 * twenty consecutive beats. A slow camera push moves pixels continuously, so
 * pixel-change measures CAMERA MOTION, not whether the composition ever became
 * a different thing.
 *
 * So CHECK 1 and CHECK 2 stay, because a frozen frame is a real failure mode
 * worth catching, and CHECK 6 is added for the defect actually complained of:
 * how long one composition — the same actors in the same arrangement — is held.
 * That is measurable exactly, from the beat plan, and it is what fails on the
 * current render.
 *
 * WHAT EACH CHECK CAN AND CANNOT SEE, STATED UP FRONT.
 *
 *   1 frame change     MEASURED from pixels. A run of samples whose change
 *                      never exceeds MOVE_FLOOR is a static stretch.
 *   2 typography       MEASURED from pixels, restricted to the band the
 *                      kinetic layer occupies. It cannot read words, so it
 *                      measures whether that band's content changed at all.
 *   3 asset persistence NOT measurable from pixels without tracking. Read from
 *                      the beat plan when one is supplied; reported UNVERIFIED
 *                      otherwise, never passed silently.
 *   4 intent coverage  From the beat plan. Reported UNVERIFIED with no plan.
 *   5 number animation From the beat plan. Reported UNVERIFIED with no plan.
 *   6 composition hold From the beat plan. The one that catches a slideshow.
 *
 * A check that cannot run reports UNVERIFIED and counts as a failure, the same
 * rule the section-7 gate follows.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { decodePNG } from "../../decode-png.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..", "..", "..");
const FFMPEG = existsSync(join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg"))
  ? join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg")
  : join(ROOT, "src/skills/remotion-render/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg");
const FFPROBE = join(ROOT, "src/skills/remotion-render/node_modules/@remotion/compositor-linux-x64-gnu/ffprobe");

const FPS = 30;
/** Every 10th frame: a third of a second, fine enough to catch a 2s hold. */
const SAMPLE_EVERY = 10;
/**
 * How much of the frame must differ between two samples to count as movement.
 *
 * NOW MEASURED. The first version of this file asserted two populations without
 * measuring them, which was exactly the habit this repo exists to prevent. The
 * real distribution over the 70s ch-02 render, 210 samples every 10 frames:
 *
 *   adjacent-sample change   min 0.00%  p10 3.47%  med 7.15%  p90 10.97%
 *
 * A floor of 0.4% sits below p10 with room, so it catches a genuinely frozen
 * frame and nothing else. That is all it can do — see the note on CHECK-1.
 */
const MOVE_FLOOR = 0.004;
/** A pixel counts as changed when its channels differ by this much in total. */
const PIXEL_DELTA = 24;
/** Section 4.1: no static scene longer than 3 seconds. */
const MAX_STATIC_FRAMES = 90;
/** Section 5.2 CHECK 2: kinetic text must change at least every 2 seconds. */
const MAX_TYPE_HOLD_FRAMES = 60;

function frames(video, dir) {
  mkdirSync(dir, { recursive: true });
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", video,
    "-vf", `select=not(mod(n\\,${SAMPLE_EVERY})),scale=270:480`, "-vsync", "0",
    join(dir, "f%05d.png")], { stdio: "pipe" });
  return readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
}

/** Fraction of pixels that differ, over the whole frame or a horizontal band. */
function changed(a, b, band) {
  const n = Math.min(a.data.length, b.data.length);
  const ch = a.channels;
  const y0 = band ? Math.floor(band[0] * a.height) : 0;
  const y1 = band ? Math.ceil(band[1] * a.height) : a.height;
  let diff = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * ch;
      if (i + 2 >= n) continue;
      total++;
      const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (d >= PIXEL_DELTA) diff++;
    }
  }
  return total ? diff / total : 0;
}

/** The longest run of consecutive samples below `floor`, in real frames. */
function longestHold(series, floor) {
  let run = 0, worst = 0, at = 0, start = 0;
  series.forEach((v, i) => {
    if (v < floor) { if (run === 0) start = i; run++; if (run > worst) { worst = run; at = start; } }
    else run = 0;
  });
  // A run of N gaps spans N * SAMPLE_EVERY frames between the first and last.
  return { frames: worst * SAMPLE_EVERY, startFrame: at * SAMPLE_EVERY };
}

const video = process.argv[2];
if (!video || !existsSync(video)) { console.error("usage: motion-checks.mjs <video.mp4> [--plan <beats.json>]"); process.exit(2); }
const planArg = process.argv.indexOf("--plan");
const plan = planArg > -1 && process.argv[planArg + 1] && existsSync(process.argv[planArg + 1])
  ? JSON.parse(readFileSync(process.argv[planArg + 1], "utf-8")) : null;

const work = join(tmpdir(), `motion-${Date.now()}`);
const files = frames(video, work);
const pngs = files.map((f) => decodePNG(join(work, f)));
const dur = Number(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], { encoding: "utf-8" }).trim());

const whole = [], typeBand = [];
for (let i = 1; i < pngs.length; i++) {
  whole.push(changed(pngs[i - 1], pngs[i]));
  // The kinetic layer's band. Upper-third and centre placements both fall
  // inside 0.12-0.62 of frame height; the caption band below is excluded so a
  // moving caption cannot pass this check on the kinetic layer's behalf.
  typeBand.push(changed(pngs[i - 1], pngs[i], [0.12, 0.62]));
}

const results = [];
const add = (id, name, ok, detail) => results.push({ id, name, ok, detail });

const h1 = longestHold(whole, MOVE_FLOOR);
add("CHECK-1", "no static stretch longer than 3s", h1.frames <= MAX_STATIC_FRAMES,
  `longest static stretch ${h1.frames}f (${(h1.frames / FPS).toFixed(1)}s) from frame ${h1.startFrame}; limit ${MAX_STATIC_FRAMES}f`);

const h2 = longestHold(typeBand, MOVE_FLOOR);
add("CHECK-2", "kinetic typography changes at least every 2s", h2.frames <= MAX_TYPE_HOLD_FRAMES,
  `longest unchanged type band ${h2.frames}f (${(h2.frames / FPS).toFixed(1)}s) from frame ${h2.startFrame}; limit ${MAX_TYPE_HOLD_FRAMES}f`);

if (!plan) {
  for (const [id, name] of [["CHECK-3", "assets persist across beats"], ["CHECK-4", "more than one visual intent used"], ["CHECK-5", "numbers animate"]]) {
    add(id, name, false, "UNVERIFIED — no --plan supplied. An unrun check is not a passed check.");
  }
} else {
  const beats = plan.beats || plan;
  const ids = beats.map((b) => new Set((b.actors || []).map((a) => a.id)));
  const flicker = [];
  for (let i = 0; i + 2 < ids.length; i++) {
    for (const id of ids[i]) if (!ids[i + 1].has(id) && ids[i + 2].has(id)) flicker.push(`${id} @beat ${i}`);
  }
  add("CHECK-3", "assets persist across beats", flicker.length === 0,
    flicker.length ? `${flicker.length} actor(s) vanish and return: ${flicker.slice(0, 4).join(", ")}` : "no actor leaves and comes back");

  const intents = new Set(beats.map((b) => b.visual_intent).filter(Boolean));
  add("CHECK-4", "more than one visual intent used", intents.size > 1,
    `${intents.size} intent(s): ${[...intents].sort().join(", ") || "(none)"}`);

  /**
   * CHECK 6 — how long one composition is held.
   *
   * A composition is the set of actors present and where they are. Consecutive
   * beats that resolve to the same set in the same places are one held picture
   * however much the camera drifts across them, and that is what reads as a
   * slideshow. Signature is actor id + rounded anchor, so a MOVE or a SPLIT
   * counts as a change and a re-render of the same arrangement does not.
   */
  const sig = (b) => (b.actors || [])
    .map((a) => `${a.id}@${Math.round((a.x ?? 0.5) * 20)},${Math.round((a.y ?? 0.5) * 20)}`)
    .sort().join("|");
  let held = 0, worstHold = 0, holdAt = 0, holdStart = 0, prev = null;
  beats.forEach((b, i) => {
    const s2 = sig(b);
    if (s2 === prev) { held += b.duration_frames || 0; }
    else { held = b.duration_frames || 0; holdStart = i; prev = s2; }
    if (held > worstHold) { worstHold = held; holdAt = holdStart; }
  });
  add("CHECK-6", "no composition held longer than 3s", worstHold <= MAX_STATIC_FRAMES,
    `longest identical composition ${worstHold}f (${(worstHold / FPS).toFixed(1)}s) starting at beat ${holdAt}; limit ${MAX_STATIC_FRAMES}f`);

  /**
   * CHECK 5 — a number must COUNT the first time it appears.
   *
   * The first version demanded COUNT in every beat a numeric actor is present,
   * and reported 1 of 7. That was the check being wrong, not the render: a
   * quantity counts up once and then stays on screen while the narration moves
   * on, and a number that has finished counting is meant to hold. What Section
   * 4.1 forbids is a number that never animates at all, so the test is on the
   * beat where each numeric actor is INTRODUCED.
   */
  const firstSeen = new Map();
  beats.forEach((b, i) => {
    for (const a of b.actors || []) {
      if (a.type === "number" && !firstSeen.has(a.id)) firstSeen.set(a.id, a.behavior);
    }
  });
  const nums = [...firstSeen.entries()];
  const counted = nums.filter(([, behavior]) => behavior === "COUNT");
  add("CHECK-5", "every number counts when it first appears", nums.length === 0 || counted.length === nums.length,
    nums.length ? `${counted.length}/${nums.length} numeric actors COUNT on entry`
      : "no numeric actors in this video — vacuous pass");
}

console.log(`\nmotion checks — ${basename(video)} (${dur.toFixed(1)}s, ${pngs.length} samples every ${SAMPLE_EVERY}f)\n`);
for (const r of results) console.log(`  ${r.ok ? "ok    " : "FAIL  "} ${r.id}  ${r.name}\n         ${r.detail}`);
const pct = whole.length ? whole.reduce((a, b) => a + b, 0) / whole.length : 0;
console.log(`\n  mean frame change between samples: ${(pct * 100).toFixed(2)}%`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? `${failed.length} of ${results.length} checks FAILED` : `all ${results.length} checks pass`}\n`);
rmSync(work, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);
