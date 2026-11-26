// InsiderForce-style single-video render (Short 25, Tabletop). Run from data/ai-tested/shorts-v5: node if/render-if.mjs
// Plan is built from the word-timed VTT so every text reveal follows the spoken word. No system, one video.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseVtt } from "../plan-lib.mjs";

const shorts = path.resolve(import.meta.dirname, "..");
const root = path.join(shorts, "render");
const publicDir = path.join(root, "public");
const outDir = path.join(shorts, "if", "out");
fs.mkdirSync(outDir, { recursive: true });

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) { const s = path.join(src, f), d = path.join(dst, f); fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d); }
}
copyDir(path.join(shorts, "assets", "sfx2"), path.join(publicDir, "sfx2"));
copyDir(path.join(shorts, "assets", "v7", "25"), path.join(publicDir, "v7", "25"));
fs.mkdirSync(path.join(publicDir, "if"), { recursive: true });
fs.copyFileSync(path.join(shorts, "if", "audio", "25.mp3"), path.join(publicDir, "if", "25.mp3"));

const probe = (args) => spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" }).stdout.trim();
const dur = parseFloat(probe(["-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path.join(shorts, "if", "audio", "25.mp3")]));
const cues = parseVtt(fs.readFileSync(path.join(shorts, "if", "audio", "25.vtt"), "utf8"));
const T = cues.map((c) => c.start);
if (T.length !== 110) throw new Error(`expected 110 timed words, got ${T.length}`);

// word i with display text (and style overrides)
const w = (i, text, o = {}) => ({ w: text, t: T[i], ...o });
const run = (i0, texts, o = {}) => texts.map((tx, k) => w(i0 + k, tx, o));
const B = { sz: 56, wt: 700 }; // bold keyword style
const bold = (i0, texts) => run(i0, texts, B);

const SZ = { lead: 40 };
const cardW = 462;
const A = "v7/25/";
const t0 = (i) => Math.max(0, T[i] - 0.15);
const scenes = [
  { i: 0, grid: true, els: [
    { k: "props", t: 0.0 },
    { k: "lines", lines: [
      { y: 440, words: run(0, ["google", "is", "testing", "a", "tool", "where"]) },
      { y: 505, sz: 56, wt: 700, words: bold(6, ["You", "Ask", "An", "AI"]) },
      { y: 575, sz: 33, wt: 700, words: run(10, ["to", "build", "the", "app", "your", "group", "needs"], { pill: true }) },
    ] },
  ] },
  { i: 17, els: [
    { k: "lines", lines: [
      { y: 440, words: run(17, ["it", "is", "called"]) },
      { y: 520, sz: 76, wt: 800, words: [w(20, "Tabletop", { sz: 76, wt: 800 })] },
    ] },
    { k: "chip", img: A + "google-g-logo-tile.png", label: "GOOGLE LABS", y: 620, t: T[20] },
  ] },
  { i: 21, els: [
    { k: "lines", lines: [
      { y: 100, words: run(21, ["your", "group", "shares"]) },
      { y: 165, sz: 56, wt: 700, words: bold(24, ["One", "Online", "Space"]) },
    ] },
    { k: "card", img: A + "tabletop-video-shared-space-invite-t09.png", y: 368, w: cardW, h: 260, t: T[21] },
  ] },
  { i: 27, els: [
    { k: "lines", lines: [
      { y: 100, words: run(27, ["add", "links,", "files", "and", "ideas"]) },
      { y: 165, sz: 56, wt: 700, words: bold(32, ["Then", "Ask", "The", "Agent"]) },
    ] },
    { k: "card", img: A + "tabletop-video-ask-prompt-t11.png", y: 368, w: cardW, h: 260, t: T[27] },
  ] },
  { i: 36, els: [
    { k: "lines", lines: [
      { y: 100, words: run(36, ["or", "pick", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(39, ["Starter", "Template"]) },
    ] },
    { k: "card", img: A + "tabletop-video-tool-picker-t18.png", y: 368, w: cardW, h: 260, t: T[36] },
  ] },
  { i: 41, grid: true, els: [
    { k: "lines", lines: [
      { y: 470, words: run(41, ["it", "can", "build"]) },
      { y: 540, sz: 56, wt: 700, words: bold(44, ["Things", "Like", "These"]) },
    ] },
  ] },
  { i: 47, els: [
    { k: "lines", lines: [
      { y: 100, words: run(47, ["first,", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(49, ["Trip", "Itinerary"]) },
    ] },
    { k: "card", img: A + "tabletop-labs-trip-planning-dinner-decider.png", y: 368, w: cardW, h: 250, t: T[47] },
  ] },
  { i: 51, els: [
    { k: "lines", lines: [
      { y: 100, words: run(51, ["second,", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(53, ["Dinner", "Poll"]) },
    ] },
    { k: "card", img: A + "tabletop-video-vote-ui-live-cursors-t53.png", y: 368, w: cardW, h: 260, t: T[51] },
  ] },
  { i: 55, els: [
    { k: "lines", lines: [
      { y: 100, words: run(55, ["third,", "an"]) },
      { y: 165, sz: 56, wt: 700, words: bold(57, ["Expense", "Splitter"]) },
    ] },
    { k: "card", img: A + "tabletop-video-expense-overview-t57.png", y: 368, w: cardW, h: 260, t: T[55] },
  ] },
  { i: 59, els: [
    { k: "lines", lines: [
      { y: 100, words: run(59, ["fourth,", "a"]) },
      { y: 165, sz: 56, wt: 700, words: bold(61, ["Tournament", "Bracket"]) },
    ] },
    { k: "card", img: A + "tabletop-video-tournament-bracket-t22.png", y: 368, w: cardW, h: 260, t: T[59] },
  ] },
  { i: 63, grid: true, els: [
    { k: "lines", lines: [
      { y: 470, words: run(63, ["and", "here", "is", "the", "part"]) },
      { y: 545, sz: 66, wt: 800, words: run(68, ["THAT", "MATTERS"], { sz: 66, wt: 800 }) },
    ] },
  ] },
  { i: 70, els: [
    { k: "lines", lines: [
      { y: 73, words: run(70, ["everyone", "uses", "it"]) },
      { y: 117, words: run(73, ["at", "the", "same", "time"]) },
      { y: 165, sz: 56, wt: 700, words: bold(77, ["Like", "A", "Google", "Doc"]) },
    ] },
    { k: "card", img: A + "tabletop-video-shared-cursors-vote-t31.png", y: 400, w: cardW, h: 260, t: T[70] },
  ] },
  { i: 81, els: [
    { k: "lines", lines: [
      { y: 73, words: run(81, ["it", "is", "still", "a", "google", "labs"]) },
      { y: 130, sz: 56, wt: 700, words: bold(87, ["Experiment"]) },
    ] },
    { k: "card", img: A + "tabletop-labs-landing-waitlist.png", y: 340, w: cardW, h: 200, t: T[81] },
    { k: "bullets", y: 625, gap: 78, sz: 34, items: [
      { words: run(88, ["US", "only"]) },
      { words: run(90, ["adults", "eighteen", "and", "over"]) },
      { words: run(94, ["by", "waitlist"]) },
    ] },
  ] },
  { i: 96, grid: true, els: [
    { k: "lines", lines: [
      { y: 400, words: run(96, ["you", "just", "found", "the", "tool"]) },
      { y: 450, words: run(101, ["that", "builds", "your"]) },
      { y: 520, sz: 60, wt: 700, words: bold(104, ["Group's", "Planning"]) },
      { y: 590, sz: 60, wt: 700, words: bold(106, ["Tools"]) },
    ] },
  ] },
  { i: 107, els: [
    { k: "mark", y: 360, t: T[107] },
    { k: "lines", lines: [
      { y: 540, words: run(107, ["follow"]) },
      { y: 620, sz: 76, wt: 800, words: run(108, ["AI", "Tested"], { sz: 76, wt: 800 }) },
    ] },
  ] },
];
// Reference layout: lead text above the card, bold keyword below it.
for (const s of scenes) {
  if (!s.els.some((e) => e.k === "card")) continue;
  for (const e of s.els) if (e.k === "lines") for (const l of e.lines) { if (l.y === 165) l.y = 595; else if (l.y === 100) l.y = 117; }
}
const planScenes = scenes.map((s, k) => ({ t0: k === 0 ? 0 : t0(s.i), t1: k === scenes.length - 1 ? 999 : t0(scenes[k + 1].i), grid: !!s.grid, els: s.els }));

const sfxAt = (t, src, vol, d) => ({ t, src, vol, dur: d });
const sfx = [
  sfxAt(0.08, "sfx2/boom_hit.mp3", 0.35, 1.2),
  sfxAt(T[20] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[21] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[27] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[36] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[47] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[51] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[55] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[59] - 0.1, "sfx2/whoosh_quick.mp3", 0.12, 0.6),
  sfxAt(T[68] - 0.05, "sfx2/impact_low.mp3", 0.3, 1.2),
  sfxAt(T[70] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[81] - 0.1, "sfx2/whoosh_swipe.mp3", 0.12, 0.6),
  sfxAt(T[88] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
  sfxAt(T[90] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
  sfxAt(T[94] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4),
  sfxAt(T[107] - 0.05, "sfx2/boom_hit.mp3", 0.25, 1.0),
];

const plan = { scenes: planScenes, sfx, watermark: "AI Tested" };
const propsFile = path.join(outDir, "if25.props.json");
fs.writeFileSync(propsFile, JSON.stringify({ plan, audioSrc: "if/25.mp3", audioDurationSec: dur }));
console.log(`plan: ${planScenes.length} scenes, ${sfx.length} sfx, narration ${dur.toFixed(2)}s`);

const raw = path.join(outDir, ".raw.mp4"), outFile = path.join(outDir, "if25.mp4");
execFileSync("npx", ["remotion", "render", "src/index.ts", "IF-25", raw, `--props=${propsFile}`, "--codec=h264", "--pixel-format=yuv420p", "--crf=17", "--audio-bitrate=192k", "--log=warn"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });

const r1 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", raw, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
const m = (r1.stderr || "").match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
const s = JSON.parse(m[0]);
const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true,alimiter=limit=0.78:attack=3:release=40:level=false`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-c:v", "copy", "-af", af, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outFile], { stdio: "inherit" });
fs.unlinkSync(raw);

// stills at the middle of each scene, native 1080x1920 and a contact sheet
const stillDir = path.join(outDir, "stills");
fs.mkdirSync(stillDir, { recursive: true });
planScenes.forEach((sc, k) => {
  const t = Math.min(dur - 0.1, Math.min(sc.t1, dur) - 0.25);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", t.toFixed(2), "-i", outFile, "-frames:v", "1", path.join(stillDir, `s${String(k + 1).padStart(2, "0")}_${t.toFixed(1)}s.png`)]);
});
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "1", "-pattern_type", "glob", "-i", path.join(stillDir, "s*.png"), "-vf", "scale=270:480,tile=8x2:padding=6:color=white", "-frames:v", "1", path.join(outDir, "contact.png")]);
console.log("done", outFile);
