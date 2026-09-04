#!/usr/bin/env node
/**
 * Real 15-second clips, one per channel, across the styles and background
 * modes that exercise different code paths.
 *
 * Every clip is that channel's OWN script and SRT — no borrowing. Where a
 * channel has a real voiceover it is mounted and the clip starts at frame 0
 * so it stays in sync; where it does not, the clip is picture + SFX and the
 * manifest says so rather than implying audio that is not there.
 *
 *   node qa-scripts/render-15s-clips.mjs
 */
import { mkdirSync, readFileSync, existsSync, copyFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { summarizeVisuals } from "../visual/diagnostics.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { paletteFromHues } from "../styles/tokens.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { resolveBrollFiles } from "../broll.js";
import { findChrome } from "../find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT, "data", "renders", "clips-15s");
mkdirSync(OUT_DIR, { recursive: true });
const FPS = 30, SECONDS = 15;
const FFMPEG = join(ROOT, "node_modules", "ffmpeg-static", "ffmpeg");

const COMPOSITION = {
  "motion-graphics": "MotionGraphicsShorts",
  "cinematic-documentary": "CinematicDocumentaryShorts",
  minimal: "MinimalShorts",
};

const channels = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8")).channels;
const byId = (cid) => channels.find((c) => c.channel_id === cid);

// ch-fixture is not a production channel; it is the ONLY source of real
// sourced photos on this branch, so it is the only way to show the photo
// treatment at all. Labelled as such in the manifest.
const FIXTURE = {
  id: "fixture", channel_id: "ch-fixture", channel_name: "ch-fixture (photo treatment)",
  style: "motion-graphics", bg_mode: "black", font: "Inter",
  thumbnail_spec: { accentHue: 150 }, tone: "investigative",
};

const JOBS = [
  { channel: byId("ch-01"), script: "data/research/1/debt-snowball-vs-debt-avalanche-shorts-script.json",
    srt: "data/tts/1/debt-snowball-vs-debt-avalanche-shorts-script-vo.srt",
    vo: "data/audit/14/measure/debt-snowball-shorts-vo.mp3", note: "real voiceover + SFX" },
  { channel: byId("ch-02"), script: "data/research/2/what-to-say-traffic-stop-script.json",
    srt: "data/tts/2/what-to-say-traffic-stop-script-vo.srt", vo: null, note: "picture + SFX (no voiceover exists)" },
  { channel: byId("ch-04"), script: "data/research/4/great-fire-of-london-script.json",
    srt: "data/tts/4/great-fire-of-london-script-vo.srt", vo: null, note: "picture + SFX (no voiceover exists)" },
  { channel: FIXTURE, script: "data/scripts/ch-fixture/movile-cave-shorts-script.json",
    srt: "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt", vo: null, note: "picture + SFX, real sourced photos" },
  // Minimal: no minimal channel (ch-03/46/47) has a script on this branch, so
  // this renders the fixture's own words in the minimal style. It proves the
  // minimal code path renders; it is NOT that channel's content.
  { channel: { ...FIXTURE, channel_name: "minimal style (fixture content)", style: "minimal", bg_mode: "white" },
    script: "data/scripts/ch-fixture/movile-cave-shorts-script.json",
    srt: "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt", vo: null,
    note: "STYLE DEMO — no minimal channel has a script; fixture words in minimal style" },
];

const CHROME = findChrome();
console.log("bundling once...");
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });

const manifest = [];
for (const job of JOBS) {
  const c = job.channel;
  if (!c) { console.log(`SKIP: channel missing from config`); continue; }
  const scriptPath = join(ROOT, job.script), srtPath = join(ROOT, job.srt);
  if (!existsSync(scriptPath) || !existsSync(srtPath)) {
    console.log(`FAIL ${c.channel_id}: missing ${!existsSync(scriptPath) ? job.script : job.srt}`);
    manifest.push({ channel: c.channel_name, status: "FAIL", reason: "script or srt missing" });
    continue;
  }
  const script = JSON.parse(readFileSync(scriptPath, "utf-8"));
  const sections = narrationSections(script).filter((s) => s.voiceover && s.voiceover.trim()).map((s) => ({
    id: s.id, timing: s.timing, voiceover: s.voiceover, content: chunkTextClauseAware(s.voiceover),
    sfxCue: s.sfx_cue || null, bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
    beats: Array.isArray(s.beats) ? s.beats : null,
  }));
  for (const s of sections) s.bRollFiles = resolveBrollFiles(s.bRoll || [], c.channel_id, script.topic_slug);
  const photos = sections.reduce((n, s) => n + (s.bRollFiles || []).length, 0);

  const mg = buildMgPackage(readFileSync(srtPath, "utf-8"), {
    sections, hook: script.hook || null, channel: c,
    bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
    imageForSection: (i) => (sections[i] && sections[i].bRollFiles && sections[i].bRollFiles[0]) || null,
  });

  // The composition statically imports ./vo.mp3, so one is always staged.
  const voTarget = join(RENDER_DIR, "vo.mp3");
  let audioNote = job.note;
  if (job.vo && existsSync(join(ROOT, job.vo))) {
    copyFileSync(join(ROOT, job.vo), voTarget);
  } else {
    execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
      "-i", "anullsrc=r=44100:cl=stereo", "-t", String(SECONDS + 1), "-q:a", "9", voTarget]);
  }

  const palette = typeof c.thumbnail_spec?.accentHue === "number"
    ? paletteFromHues({ accentHue: c.thumbnail_spec.accentHue, bgMode: c.bg_mode, accent: (c.colors || {}).accent }) : null;
  const props = {
    channelId: c.channel_id, style: c.style, format: "shorts", sections, mg,
    ttsAudioPath: job.vo ? job.vo : null, hasUnderscore: false,
    thumbnailStyle: c.thumbnail_spec?.style || "dramatic-visual", tone: c.tone,
    font: c.font || "Inter", channelName: c.channel_name || "", palette,
    showCaptions: c.captions === "burned-in",
  };

  const to = Math.min(SECONDS * FPS, mg.totalFrames - 1);
  const id = COMPOSITION[c.style];
  const name = `${c.channel_id}-${c.style}-${c.bg_mode}-15s.mp4`;
  const outPath = join(OUT_DIR, name);
  const strategies = [...new Set(mg.beats.filter((b) => b.startFrame < to && b.visualPlan)
    .map((b) => b.visualPlan.strategy))];
  try {
    const composition = await selectComposition({ serveUrl, id, inputProps: props,
      ...(CHROME ? { browserExecutable: CHROME } : {}) });
    await renderMedia({ composition: { ...composition, durationInFrames: mg.totalFrames }, serveUrl,
      codec: "h264", inputProps: props, outputLocation: outPath, frameRange: [0, to],
      imageFormat: "png", crf: 20, pixelFormat: "yuv420p", chromiumOptions: { gl: "swangle" },
      concurrency: 2, scale: 0.5, timeoutInMilliseconds: 300000, logLevel: "error",
      ...(CHROME ? { browserExecutable: CHROME } : {}) });
    /**
     * The visual report, written next to the clip.
     *
     * `qa-scripts/mute-test.mjs` — which pulls each beat's ANCHOR frame so
     * the muted-comprehension read can be done on the frames that actually
     * carry the claim — takes `<video.mp4> <visual-report.json>` and reads
     * `report.beats` / `report.metrics`. `render.js` has always written this
     * file for production renders, but this clip renderer never did, so the
     * one tool built to make that review repeatable could not be pointed at
     * the clips it was built for, and every muted pass was done by hand
     * against ffmpeg-seeked frames instead. `mg.visual` is already computed
     * by buildMgPackage in exactly the shape mute-test expects — it was only
     * ever missing the write.
     */
    const reportName = name.replace(/\.mp4$/, "-visual-report.json");
    /**
     * SCOPED TO THE FRAMES THIS CLIP ACTUALLY CONTAINS.
     *
     * `mg.visual` describes the whole script. Writing it beside a 15s clip
     * pairs a 72-second report with a 15-second video, and mute-test.mjs
     * then tries to seek 60s of beats that are not in the file — it
     * announced "31 frames" while writing 8. Recomputing over just the
     * rendered beats means the metrics describe THIS clip, which is also
     * what the manifest's `strategies` list beside it already does.
     */
    const clipBeats = mg.beats.filter((b) => b.startFrame <= to);
    const clipVisual = { ...summarizeVisuals(clipBeats, { fps: FPS }), renderedFrameRange: [0, to] };
    writeFileSync(join(OUT_DIR, reportName), JSON.stringify(clipVisual, null, 2) + "\n");
    console.log(`OK   ${name}  ${(to / FPS).toFixed(1)}s  photos=${photos}  ${audioNote}`);
    console.log(`     report -> data/renders/clips-15s/${reportName}`);
    manifest.push({ channel: c.channel_name, channel_id: c.channel_id, style: c.style,
      bg_mode: c.bg_mode, composition: id, seconds: +(to / FPS).toFixed(1), photos,
      audio: audioNote, first_line: sections[0] && sections[0].voiceover.slice(0, 80),
      strategies, file: `data/renders/clips-15s/${name}`,
      visualReport: `data/renders/clips-15s/${reportName}`, status: "OK" });
  } catch (err) {
    console.log(`FAIL ${name}: ${err.message.split("\n")[0]}`);
    manifest.push({ channel: c.channel_name, status: "FAIL", error: err.message.split("\n")[0] });
  }
}
writeFileSync(join(OUT_DIR, "clips-15s-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const ok = manifest.filter((m) => m.status === "OK").length;
console.log(`\n${ok}/${manifest.length} clips rendered`);
process.exit(ok === manifest.length ? 0 : 1);
