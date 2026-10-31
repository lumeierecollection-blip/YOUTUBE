#!/usr/bin/env node
/**
 * The editor's eyes: look at frames of the rendered MP4 and say, per frame, whether it looks like a finished documentary explainer
 * (the Vox / mograph-critic acceptance bar in .opencode/skills/vox-style-treatment and mograph-critic) or like a template.
 *
 * The deterministic final-MP4 QA (video-qa.js) measures motion, coverage and credits; it cannot tell that a chart is unreadable, that
 * text sits on top of a face, or that the photo has nothing to do with the sentence. A vision model can, so this asks it, frame by frame.
 *
 *   node scripts/editor/frame-critic.mjs --video <mp4> --timeline <timeline.json> --out <report.json> [--max 10]
 *
 * ADVISORY: it writes the report and prints ::warning:: lines; it never fails the render. A model that cannot answer yields
 * { available:false } and nothing else changes. Findings are the vision model's opinion, not a measurement.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const CHECKLIST = `You are the picture editor reviewing one frame (1080x1920 vertical) of a finished documentary explainer. Judge honestly; most frames from an automatic editor have at least one problem.
Answer ONLY JSON: {"verdict":"good"|"weak"|"bad","issues":["..."],"photo_matches_caption":true|false|null,"chart_readable":true|false|null}
Check:
- overlap: text over a face, text over text, a chart over the photo, anything clipped by the frame edge (bad).
- chart/graph (if one is shown): has a real label saying what is measured, a legible value, an axis or scale a viewer can read, and fills its panel sensibly; a bare number floating in empty space is weak.
- photo: relates to the caption words and to the video's subject; a generic stock-looking image (empty beach, skyline, handshake) is weak; a face recognisable as a named person is only acceptable with that name on screen.
- map (if shown): the highlighted place is readable and large enough, labels do not collide.
- typography: contrast against the background, a clear hierarchy, nothing tiny.
- looks templated: the same layout as every other explainer, flat gradient + centred text.
photo_matches_caption / chart_readable: null when the frame has no photo / no chart.
"good" means you would publish this frame as is.`;

export function parseVerdict(answer) {
  let obj = answer;
  if (answer && typeof answer.content === "string") {
    const m = answer.content.match(/\{[\s\S]*\}/);
    try { obj = m ? JSON.parse(m[0]) : null; } catch { obj = null; }
  }
  if (!obj || !["good", "weak", "bad"].includes(obj.verdict)) return null;
  return {
    verdict: obj.verdict,
    issues: Array.isArray(obj.issues) ? obj.issues.map(String).slice(0, 6) : [],
    photo_matches_caption: typeof obj.photo_matches_caption === "boolean" ? obj.photo_matches_caption : null,
    chart_readable: typeof obj.chart_readable === "boolean" ? obj.chart_readable : null,
  };
}

/** n timestamps spread evenly through a video of `duration` seconds (never the very first or last frame). */
export function pickTimes(duration, n) {
  const out = [];
  // A counter animates for about a second after its beat starts: sample after it has settled, or the critic reads a number mid-count as a bare number.
  for (let k = 0; k < n; k++) out.push(Number(Math.min(duration - 0.3, (duration * (k + 0.5)) / n + 1.5).toFixed(2)));
  return out;
}

export function summarize(frames) {
  const count = (v) => frames.filter((f) => f.verdict === v).length;
  const answered = frames.filter((f) => f.verdict);
  return {
    frames: frames.length,
    good: count("good"), weak: count("weak"), bad: count("bad"),
    photo_mismatches: frames.filter((f) => f.photo_matches_caption === false).length,
    unreadable_charts: frames.filter((f) => f.chart_readable === false).length,
    share_good: answered.length ? Number((count("good") / answered.length).toFixed(2)) : null,
  };
}

/** askVision({prompt, imageBase64}) -> the model's answer. extractFrame(t) -> a JPEG buffer of the video at t seconds. */
export async function critique({ duration, timeline = {}, max = 10, askVision, extractFrame, topic = "" }) {
  const fps = timeline.fps || 30;
  const cues = Array.isArray(timeline.captions) ? timeline.captions : [];
  const frames = [];
  for (const t of pickTimes(duration, max)) {
    const f = Math.round(t * fps);
    const caption = cues.find((c) => c.start_f <= f && c.end_f >= f)?.text || "";
    const jpeg = await extractFrame(t);
    const prompt = `${CHECKLIST}
${topic ? `The video is about: ${topic}
` : ""}${caption ? `The narrator is saying: "${caption}"
` : ""}Time in video: ${t.toFixed(1)}s.`;
    let verdict = null;
    try { verdict = parseVerdict(await askVision({ prompt, imageBase64: jpeg.toString("base64") })); } catch { verdict = null; }
    frames.push({ t, caption, ...(verdict || { verdict: null, issues: ["no answer from the vision model"] }) });
  }
  return { available: frames.some((f) => f.verdict), summary: summarize(frames), frames };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith("--")) a.push([x.slice(2), arr[i + 1]]); return a; }, []));
  if (!args.video || !args.out) throw new Error("usage: frame-critic.mjs --video <mp4> --out <report.json> [--timeline <json>] [--max 10] [--topic <text>]");
  const { defaultAskVision } = await import("./concept-photo.mjs");
  const video = resolve(ROOT, args.video);
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video], { encoding: "utf8" }).trim());
  const extractFrame = async (t) => {
    const png = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", "scale=540:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "3", "-"], { maxBuffer: 20e6 });
    return png;
  };
  const timeline = args.timeline && existsSync(resolve(ROOT, args.timeline)) ? JSON.parse(readFileSync(resolve(ROOT, args.timeline), "utf8")) : {};
  const report = await critique({ duration, timeline, max: Number(args.max) || 10, askVision: defaultAskVision(), extractFrame, topic: args.topic || "" });
  mkdirSync(dirname(resolve(ROOT, args.out)), { recursive: true });
  writeFileSync(resolve(ROOT, args.out), JSON.stringify(report, null, 2));
  if (!report.available) { console.log("[frame-critic] the vision model gave no answer; no opinion recorded"); return; }
  const s = report.summary;
  console.log(`[frame-critic] ${s.frames} frames: ${s.good} good, ${s.weak} weak, ${s.bad} bad; ${s.photo_mismatches} photo/caption mismatch, ${s.unreadable_charts} unreadable chart`);
  for (const f of report.frames.filter((x) => x.verdict && x.verdict !== "good")) console.log(`::warning::frame-critic ${f.t.toFixed(1)}s ${f.verdict}: ${f.issues.join("; ")}`);
}

if (process.argv[1] && /frame-critic\.mjs$/.test(process.argv[1].split("\\").join("/"))) {
  main().catch((e) => { console.log(`[frame-critic] skipped: ${e.message}`); });
}
