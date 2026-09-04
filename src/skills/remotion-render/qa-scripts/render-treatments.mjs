#!/usr/bin/env node
/**
 * Renders one real still per wired treatment, so "it parses" is not mistaken
 * for "it draws". Every beat here is a real ch-fixture beat with its
 * treatment declared on the plan — the same field the director would set.
 *
 *   node src/skills/remotion-render/qa-scripts/render-treatments.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { resolveBrollFiles } from "../broll.js";
import { findChrome } from "../find-chrome.js";
import { decodePNG } from "../decode-png.js";

const RENDER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const OUT = join(ROOT, "data", "renders", "treatments");
mkdirSync(OUT, { recursive: true });

const script = JSON.parse(readFileSync(join(ROOT, "data/scripts/ch-fixture/movile-cave-shorts-script.json"), "utf8"));
const sections = (script.sections || []).filter((s) => s.voiceover && s.voiceover.trim()).map((s) => ({
  id: s.id, timing: s.timing, voiceover: s.voiceover, content: chunkTextClauseAware(s.voiceover),
  bRoll: Array.isArray(s.b_roll) ? s.b_roll : null }));
for (const s of sections) s.bRollFiles = resolveBrollFiles(s.bRoll || [], "ch-fixture", script.topic_slug);
const channels = JSON.parse(readFileSync(join(ROOT, "config/channels.json"), "utf8"));
const channel = (channels.channels || channels).find((c) => c.style === "motion-graphics");

function build() {
  return buildMgPackage(readFileSync(join(ROOT, "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt"), "utf8"), {
    sections, bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
    imageForSection: (i) => (sections[i] && sections[i].bRollFiles && sections[i].bRollFiles[0]) || null });
}

/**
 * Whole-stage stddev was the first metric here and it was useless: five
 * different number treatments all returned 31.4, because one numeral changing
 * style barely moves the variance of a whole frame. It reported "drew
 * something" while the treatments were not wired at all. What actually
 * answers the question is whether the treatment CHANGED the picture, so each
 * one is diffed against its own untreated baseline and a zero diff fails.
 */
const pctDifferent = (a, b) => {
  let diff = 0, n = 0;
  for (let y = 0; y < a.height; y += 2) for (let x = 0; x < a.width; x += 2) {
    const i = (y * a.width + x) * a.channels;
    const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (d > 8) diff++;
    n++;
  }
  return (100 * diff) / n;
};

const stdDev = (p, x0, y0, x1, y1) => {
  const v = [];
  for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) {
    const i = (y * p.width + x) * p.channels; v.push((p.data[i] + p.data[i + 1] + p.data[i + 2]) / 3);
  }
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};

const CHROME = findChrome();
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });
const browser = await openBrowser(undefined, { browserExecutable: CHROME, chromiumOptions: { gl: "swangle" } });

const NUMBER = ["settle", "rolling", "number-wheel", "slot-machine", "matrix-decode"];
const TEXT = ["default", "line-by-line-slide", "soft-blur-in", "micro-scale-fade"];
let failures = 0;

async function shoot(label, mg, frame) {
  const out = join(OUT, `${label}.png`);
  const props = { mg, channel };
  const comp = await selectComposition({ serveUrl, id: "MotionGraphicsShorts", browserExecutable: CHROME, puppeteerInstance: browser, inputProps: props });
  await renderStill({ composition: { ...comp, durationInFrames: mg.totalFrames }, serveUrl, output: out,
    frame, browserExecutable: CHROME, puppeteerInstance: browser, inputProps: props });
  const png = decodePNG(out);
  const sd = stdDev(png, 48, 300, 1032, 1400);
  if (sd <= 6) { console.log(`BLANK ${label.padEnd(34)} stage stddev ${sd.toFixed(1)}`); failures++; return; }
  const base = baselines[label.split("-")[0]];
  if (!base) { baselines[label.split("-")[0]] = png; console.log(`BASE  ${label.padEnd(34)} stage stddev ${sd.toFixed(1)}`); return; }
  const pct = pctDifferent(png, base);
  const ok = pct > 0.01;
  if (!ok) failures++;
  console.log(`${ok ? "OK   " : "NOCHANGE"} ${label.padEnd(33)} ${pct.toFixed(2)}% of pixels differ from its baseline`);
}
const baselines = {};

for (const t of NUMBER) {
  const mg = build();
  const b = mg.beats.find((x) => x.visualPlan && ["ACCUMULATION", "SCALE_COMPARISON", "COMPARISON"].includes(x.visualPlan.strategy));
  if (!b) { console.log(`UNVERIFIED number/${t}: no quantity beat in the fixture`); failures++; continue; }
  b.visualPlan.numberTreatment = t;
  await shoot(`number-${t}`, mg, Math.round(b.startFrame + b.durationInFrames * 0.7));
}
for (const t of TEXT) {
  const mg = build();
  let b = mg.beats.find((x) => x.visualPlan && x.visualPlan.strategy === "CINEMATIC_STATEMENT");
  if (!b) {
    // The fixture never routes to the terminal fallback, so force one beat to
    // it. Forcing the STRATEGY is legitimate here — this harness exists to
    // prove the scene draws — but a treatment that is never exercised must
    // never be reported as verified, which is what a silent skip did.
    const alt = mg.beats.find((x) => x.visualPlan && x.visualPlan.supporting && x.visualPlan.supporting.phrase);
    if (!alt) { console.log(`UNVERIFIED text/${t}: no beat carries a phrase`); failures++; continue; }
    alt.visualPlan.strategy = "CINEMATIC_STATEMENT";
    b = alt;
  }
  b.visualPlan.textEntrance = t;
  await shoot(`text-${t}`, mg, Math.round(b.startFrame + b.durationInFrames * 0.7));
}
// Inline Highlight needs a word that actually occurs in the phrase.
{
  const mg = build();
  let b = mg.beats.find((x) => x.visualPlan && x.visualPlan.strategy === "CINEMATIC_STATEMENT");
  if (!b) {
    const alt = mg.beats.find((x) => x.visualPlan && x.visualPlan.supporting && x.visualPlan.supporting.phrase);
    if (alt) { alt.visualPlan.strategy = "CINEMATIC_STATEMENT"; b = alt; }
  }
  if (!b) { console.log("UNVERIFIED inline-highlight: no beat carries a phrase"); failures++; }
  else {
    const phrase = (b.visualPlan.supporting && b.visualPlan.supporting.phrase) || "";
    const word = phrase.split(/\s+/).filter(Boolean).sort((a, c) => c.length - a.length)[0];
    if (word) {
      b.visualPlan.supporting.emphasis = word;
      console.log(`(inline-highlight emphasises ${JSON.stringify(word)} from ${JSON.stringify(phrase)})`);
      await shoot("text-inline-highlight", mg, Math.round(b.startFrame + b.durationInFrames * 0.7));
    } else { console.log("UNVERIFIED inline-highlight: statement beat has no phrase"); failures++; }
  }
}
await browser.close({ silent: true });
console.log(failures ? `\n${failures} treatment(s) BLANK or UNVERIFIED` : "\nevery wired treatment was exercised and drew something");
process.exit(failures ? 1 : 0);
