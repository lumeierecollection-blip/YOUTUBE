#!/usr/bin/env node
/**
 * qa-canvas-render.mjs — renders the full-canvas renderer (visual/full-canvas.jsx)
 * from a hand-built plan that exercises every composition, all three motion
 * tiers, a camera focus, a match cut and a persisted element — so a change to
 * the renderer is checked on REAL rendered frames, not by reading code.
 *
 *   node scripts/qa-canvas-render.mjs --out <dir> [--video] [--accent "#1B7A4D"] [--photo entities/people/x.jpg]
 *
 * Writes <dir>/beat-<i>-<pct>.png stills (and <dir>/canvas-test.mp4 with
 * --video, at 0.5 scale) plus <dir>/plan.json. Captions use made-up word
 * timings (a test plan has no voiceover); everything else is the real path.
 */
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, renderMedia, openBrowser } from "@remotion/renderer";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findChrome } from "../src/skills/remotion-render/find-chrome.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RR = join(ROOT, "src", "skills", "remotion-render");
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const out = arg("out", join(ROOT, "data", "qa", "canvas"));
const accent = arg("accent", "#1B7A4D");
// A repo fixture stands in for an entity photo (Wikimedia is not reachable
// from every environment); the PHOTO beat is captioned as a fixture.
const photo = arg("photo", "b-roll/ch-fixture/movile-centipede.jpg");
// --remotion-browser: Remotion's own headless shell instead of the system
// Chrome (on a desktop where Chrome is already open, launching it headless
// timed out connecting).
const browserExecutable = process.argv.includes("--remotion-browser") ? null : findChrome();
// audio.js statically imports ./vo.mp3 (git-ignored; render.js copies the real
// voiceover there). A silent stub lets a test render bundle without one.
const VO = join(RR, "vo.mp3");
if (!existsSync(VO)) {
  const bin = join(ROOT, "node_modules", "@remotion", "compositor-linux-x64-gnu");
  const r = spawnSync(join(bin, "ffmpeg"), ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "60", "-c:a", "libmp3lame", VO], { env: { ...process.env, LD_LIBRARY_PATH: bin } });
  if (r.status !== 0) console.warn("could not create the silent vo.mp3 stub — the bundle may fail to resolve ./vo.mp3");
}
mkdirSync(out, { recursive: true });

const FPS = 30, D = 90;
// Every composition, each type role, both anchoring variants (a beat's index
// decides left / right: even = left), the snap-in year, the one emphasis word
// and the one vertical beat — in an order that never repeats a composition on
// consecutive beats, as the planner guarantees (composition-rotation.js), so
// the audit's canvas-type rotation check runs on this video too. Headlines
// are sentence case, as the resolver hands them over. The PHOTO / ARCHITECTURE /
// DOCUMENT / MONEY beats use a repo fixture photo (Wikimedia is not reachable
// from every environment) and say so on screen.
const fx = (view, entity) => ({ asset: photo, entity, kind: "place", view, credit: "Repo test fixture photo" });
const beatsSpec = [
  { text: "Why does the fifty thirty twenty rule break now?", c: { visual_type: "TYPE", headline: "Why the 50/30/20 rule breaks", lead_in: "a budget rule", motion_tier: "major" } },
  { text: "The fraud cost investors one hundred five million dollars.", c: { visual_type: "COUNTER", data: { value: "$105M", label: "lost by investors" }, headline: "Investor losses", motion_tier: "medium" } },
  { text: "Needs take fifty percent, wants thirty, savings twenty.", c: { visual_type: "BAR", data: { bars: [{ label: "needs", value: "50%" }, { label: "wants", value: "30%" }, { label: "savings", value: "20%" }] }, headline: "Where the money goes", lead_in: "the split", motion_tier: "medium" } },
  { text: "The law passed in twenty nineteen and was repealed in twenty twenty four.", c: { visual_type: "TIMELINE", data: { markers: [{ date: "2019", label: "the law passed" }, { date: "2024", label: "was repealed" }] }, headline: "The wage law", motion_tier: "medium" } },
  { text: "Forty five percent of renters are cost burdened.", c: { visual_type: "GAUGE", data: { percent: 45, label: "renters cost-burdened" }, headline: "Cost burden", motion_tier: "medium" } },
  { text: "The three tiers are basic, standard, and premium.", c: { visual_type: "LIST", data: { items: ["basic", "standard", "premium"], lead: "The three tiers are" }, headline: "Three tiers", motion_tier: "medium" } },
  { text: "Test fixture photo, standing in for a named person.", c: { visual_type: "PHOTO", data: { entity: "test fixture" }, photo: fx("person", "Test fixture"), headline: "Photo beat (fixture)", motion_tier: "major" } },
  { text: "Higher rates raise rent, and rent cuts savings.", c: { visual_type: "PROCESS", data: { nodes: ["higher rates", "rent", "savings"] }, headline: "The chain", motion_tier: "major" } },
  { text: "In Iran, prices rose again.", c: { visual_type: "MAP", data: { place: "Iran" }, headline: "Prices rose", motion_tier: "micro" } },
  { text: "Renters pay forty two percent of income versus thirty one percent for owners.", c: { visual_type: "COMPARE", data: { a: { value: "42%", label: "income" }, b: { value: "31%", label: "owners" }, relation: "vs" }, headline: "Who pays more", motion_tier: "medium" } },
  { text: "Trucking entrepreneur indicted for fraud.", c: { visual_type: "TYPE", composition: "TYPE-SPLIT", headline: "Trucking entrepreneur indicted for fraud", motion_tier: "medium", text_entrance: "POP_LETTER" } },
  { text: "The fraud cost investors one hundred five million dollars.", c: { visual_type: "MONEY", data: { value: "$105M", object: "United States dollar banknotes" }, photo: fx("money", null), headline: "Money beat (fixture photo)", motion_tier: "medium" } },
  { text: "Test fixture photo, standing in for a named building.", c: { visual_type: "PHOTO", composition: "ARCHITECTURE", data: { entity: "test fixture" }, photo: fx("building", "Test building"), headline: "Architecture beat (fixture)", motion_tier: "medium" } },
  { text: "The Dodd-Frank Act reshaped banking.", c: { visual_type: "DOCUMENT", data: { name: "Dodd-Frank Act" }, photo: fx("document", "Dodd-Frank Act"), headline: "The act reshaped banking (fixture)", motion_tier: "medium" } },
  { text: "The law passed in nineteen thirty eight.", c: { visual_type: "COUNTER", data: { value: "1938", label: "the year the law passed" }, headline: "The wage law", motion_tier: "medium" } },
  { text: "Rates will cut into savings.", c: { visual_type: "TYPE", headline: "Rates will cut savings", emphasis_word: "cut", emphasis_beat: true, motion_tier: "medium" } },
  { text: "Housing alone is thirty four percent of income.", c: { visual_type: "PIE", data: { percent: 34, label: "of income on housing" }, headline: "Housing share", motion_tier: "medium", camera_focus: [{ at_percent: 0.45, target: "number" }] } },
  { text: "The rule breaks.", c: { visual_type: "TYPE", headline: "The rule breaks", lead_in: "so", motion_tier: "medium", text_entrance: "POP_WORD_STACK" } },
  { text: "Two rules now matter most.", c: { visual_type: "PROCESS", data: { nodes: ["save first", "then spend"] }, headline: "The fix", motion_tier: "medium" } },
  { text: "Rates went from two to four point five percent.", c: { visual_type: "LINE", data: { points: [{ label: "2022", value: "2%" }, { label: "2024", value: "3.5%" }, { label: "2026", value: "4.5%" }] }, headline: "The rate climb", motion_tier: "medium", camera_focus: [{ at_percent: 0.35, target: "chart" }, { at_percent: 0.75, target: "full" }] } },
  // Hero cutouts from the verified library: a near-square object, and a wide scene (cropped level, never tilted).
  { text: "Trade now spans the whole globe.", c: { visual_type: "TYPE", headline: "Trade spans the globe", lead_in: "worldwide", motion_tier: "medium", concept_visuals: [{ name: "globe", class: "cutout", asset: "cutouts/globe.png", w: 1024, h: 989 }] } },
  { text: "The city skyline kept rising.", c: { visual_type: "TYPE", headline: "The skyline kept rising", lead_in: "downtown", motion_tier: "medium", concept_visuals: [{ name: "city-skyline", class: "cutout", asset: "cutouts/city-skyline.png", w: 1024, h: 280 }] } },
  // --extra-beats <file.json>: more beats in this same { text, c } shape (e.g. a scratch cutout fixture).
  ...(arg("extra-beats") ? JSON.parse(readFileSync(arg("extra-beats"), "utf8")) : []),
];
// Cutout ink outlines, as render-and-qa.js attaches them.
const { inkOf } = await import("./cutout-ink.mjs");
for (const b of beatsSpec) for (const v of b.c.concept_visuals || []) if (v.class === "cutout" && v.asset && !v.ink) v.ink = await inkOf(join(RR, "public", v.asset));
const { compositionFor } = await import("../src/skills/remotion-render/visual/canvas-layout.js");
const beats = beatsSpec.map((b, i) => {
  const words = b.text.split(" ");
  const per = (D - 20) / words.length;
  const c = { ...b.c };
  c.composition = c.composition || compositionFor(c.visual_type, !!c.photo, { view: c.photo?.view });
  c.beat_total = beatsSpec.length;
  return {
    beat_id: `t${i}`, start_frame: i * D, duration_frames: D, text: b.text, original_text: b.text,
    scene: { mechanism: "TYPOGRAPHY", canvas: c },
    spoken: words.map((w, k) => ({ text: w, from: Math.round(6 + k * per), to: Math.round(6 + (k + 1) * per) })),
    words: [],
  };
});
// The real animation planner (visual/animation-plan.js), on the test plan's final canvases.
const { assignCanvasAnimations } = await import("./anim-plan.js");
assignCanvasAnimations(beats.map((b) => ({ canvas: b.scene.canvas })), { seed: arg("seed", "qa"), log: (m) => console.log(m) });
// The uniform white ground (visual/backgrounds.js), as render.js sets it.
const { GROUND } = await import("../src/skills/remotion-render/visual/backgrounds.js");
const plan = { canvas: true, accent, ground: GROUND, beats, palette: { primary: ["#0F172A", "#1E293B", "#22C55E", "#FAFAFA"], secondary: [] }, fonts: { primary: "Inter", secondary: "Inter" } };
writeFileSync(join(out, "plan.json"), JSON.stringify(plan, null, 2));

console.log("bundling...");
const serveUrl = await bundle({ entryPoint: join(RR, "Root.jsx"), publicDir: join(RR, "public"), onProgress: () => {} });
const props = { plan, ttsAudioPath: null };
// One browser for every still (each render otherwise launches its own, and a
// launch that takes > 25 s on a loaded machine fails the whole run).
let puppeteerInstance = null;
for (let k = 0; k < 3 && !puppeteerInstance; k++) {
  try { puppeteerInstance = await openBrowser("chrome", { browserExecutable }); } catch (e) { console.warn(`browser launch ${k + 1}/3 failed: ${e.message.slice(0, 120)}`); }
}
if (!puppeteerInstance) throw new Error("could not launch the headless browser (3 attempts)");
const composition = await selectComposition({ serveUrl, id: "DirectedShorts", inputProps: props, browserExecutable, puppeteerInstance });
composition.durationInFrames = beats.length * D;
const shots = [];
// --beats 8,9 renders only those beats; --moments 0.05,0.1 chooses the moments (fractions of a beat).
const only = arg("beats") ? arg("beats").split(",").map(Number) : null;
const moments = arg("moments") ? arg("moments").split(",").map(Number) : [0.12, 0.3, 0.65, 0.95];
beats.forEach((b, i) => { if (only && !only.includes(i)) return; for (const pct of moments) shots.push([i, pct, b.start_frame + Math.round(b.duration_frames * pct)]); });
for (const [i, pct, frame] of process.argv.includes("--video-only") ? [] : shots) {
  const file = join(out, `beat-${i}-${Math.round(pct * 100)}.png`);
  await renderStill({ serveUrl, composition, frame, output: file, inputProps: props, scale: 0.5, browserExecutable, puppeteerInstance });
}
console.log(`stills: ${shots.length} in ${out}`);
if (process.argv.includes("--video")) {
  await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: join(out, "canvas-test.mp4"), inputProps: props, scale: 0.5, concurrency: 2, browserExecutable, puppeteerInstance });
  console.log(`video: ${join(out, "canvas-test.mp4")}`);
  // The same canvas fields render.js records, so local-audit.cjs --canvas-only can run on it.
  const { canvasManifest } = await import("../src/skills/remotion-render/visual/canvas-layout.js");
  const manifest = { video: "canvas-test.mp4", fps: FPS, width: 1080, height: 1920, accent, ground: plan.ground, beats: beats.map((b, i) => ({
    index: i, start_sec: b.start_frame / FPS, duration_sec: b.duration_frames / FPS, visual_type: b.scene.canvas.visual_type,
    canvas: canvasManifest(b.scene.canvas, i) })) };
  writeFileSync(join(out, "canvas-test-manifest.json"), JSON.stringify(manifest, null, 2));
}
await puppeteerInstance.close({ silent: true });
