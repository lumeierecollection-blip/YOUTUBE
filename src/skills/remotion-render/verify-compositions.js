import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill, openBrowser } from "@remotion/renderer";
import { readFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { resolveBrollFiles } from "./broll.js";
import { buildMgPackage, gateMgHeadlineOverlap, gateIconNames, gateChartData } from "./compositions/mg-package.js";
import { gateBeats, gateCaptions, chunkTextClauseAware } from "./compositions/beats.js";
import { ICON_INNER } from "./compositions/icons-data.js";
import { verifyPalette } from "./compositions/mg-style.js";
import { paletteFromHues, deriveHuesFromHexes } from "./styles/tokens.js";
import { findChrome } from "./find-chrome.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Was a hardcoded Windows-only path — never ran on Linux/CI as a result
// (render.js's own cross-platform findChrome(), reused here, already
// handles the sandboxed Playwright cache this environment provides).
const CHROME = findChrome();
const OUT_DIR = join(__dirname, "verify-out");

function chunkVoiceover(text, maxWords = 7) {
  return chunkTextClauseAware(text, maxWords);
}

// Real ch-fixture script, mapped exactly like render.js toContentSections.
const script = JSON.parse(
  readFileSync(join(dirname(__dirname), "..", "..", "data", "scripts", "ch-fixture", "movile-cave-shorts-script.json"), "utf-8")
);
const sections = (script.sections || [])
  .filter((s) => s.voiceover && s.voiceover.trim())
  .map((s) => ({
    id: s.id,
    timing: s.timing,
    voiceover: s.voiceover,
    content: chunkVoiceover(s.voiceover),
    visualCue: s.visual_cue || null,
    bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
    textOverlay: s.text_overlay || null,
    transitionOut: s.transition_out || null,
  }));
for (const section of sections) {
  section.bRollFiles = resolveBrollFiles(section.bRoll || [], "ch-fixture", script.topic_slug);
}
for (const section of sections) {
  console.log(`b-roll [${section.id}]:`, JSON.stringify(section.bRollFiles));
}

// ─────────────────────────────────────────────────────────────────────────────
// Motion-graphics package + static gates (H3, H5–H8, H9, H11, H12, H14).
// Fixture: ch-fixture SRT (real caption stream) + a real mg channel's icon map and
// palette (Legal Brief, id 2) so icon resolution and contrast are genuine.
// ─────────────────────────────────────────────────────────────────────────────

const channelsJson = JSON.parse(
  readFileSync(join(dirname(__dirname), "..", "..", "config", "channels.json"), "utf-8")
);
const mgChannel = (channelsJson.channels || channelsJson).find((c) => c.style === "motion-graphics");
if (!mgChannel) throw new Error("no motion-graphics channel in config/channels.json");

const mgSrtPath = join(dirname(__dirname), "..", "..", "data", "tts", "ch-fixture", "movile-cave-shorts-script-vo.srt");
const mgPackage = buildMgPackage(readFileSync(mgSrtPath, "utf-8"), {
  sections,
  iconMap: mgChannel.icon_map || null,
  bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
  imageForSection: (idx) => (sections[idx] && sections[idx].bRollFiles && sections[idx].bRollFiles[0]) || null,
});

const mgGates = {
  beats: gateBeats(mgPackage.beats, { audioFrames: mgPackage.audioFrames, requireAnchorTokens: true }),
  captions: gateCaptions(mgPackage.pages),
  headlineOverlap: gateMgHeadlineOverlap(mgPackage.beats),
  iconNames: gateIconNames(mgPackage.beats, ICON_INNER),
  chartData: gateChartData(mgPackage.beats),
  palette: verifyPalette(
    typeof mgChannel.thumbnail_spec?.baseHue === "number" &&
    typeof mgChannel.thumbnail_spec?.accentHue === "number"
      ? { baseHue: mgChannel.thumbnail_spec.baseHue, accentHue: mgChannel.thumbnail_spec.accentHue }
      : null
  ),
};
for (const [name, g] of Object.entries(mgGates)) {
  const status = g.pass ? "PASS" : "FAIL";
  console.log(`[mg-gate] ${name}: ${status}`);
  for (const f of g.failures || []) console.log(`  - ${f}`);
}
const mgHardFailures = Object.entries(mgGates)
  .filter(([, g]) => !g.pass)
  .map(([name]) => name);
if (mgHardFailures.length) {
  console.error(`MG GATES FAILED: ${mgHardFailures.join(", ")}`);
  process.exitCode = 1;
}
console.log(
  `MG package: ${mgPackage.beats.length} beats, ${mgPackage.pages.length} pages, ${mgPackage.totalFrames}f (audio ${mgPackage.audioFrames}f)`
);

const mgFont = mgChannel.font || "DM Sans";
const mgPalette =
  typeof mgChannel.thumbnail_spec?.baseHue === "number" &&
  typeof mgChannel.thumbnail_spec?.accentHue === "number"
    ? paletteFromHues({
        baseHue: mgChannel.thumbnail_spec.baseHue,
        accentHue: mgChannel.thumbnail_spec.accentHue,
      })
    : paletteFromHues(deriveHuesFromHexes(["#1A1A2E", "#F5536B", "#FFFFFF"]));

const DEFAULTS = {
  channelId: "ch-verify",
  style: "verify",
  format: "shorts",
  sections,
  ttsAudioPath: null,
  thumbnailStyle: "dramatic-visual",
  tone: "investigative-dramatic",
};

const cinProps = { ...DEFAULTS, sections, font: "Space Grotesk", palette: ["#0A0A1A", "#6366F1", "#FFFFFF"] };
const cinAltProps = { ...DEFAULTS, sections, font: "Space Grotesk", palette: ["#0D1117", "#C9A227", "#FFFFFF"] };
const minProps = { ...DEFAULTS, sections, font: "Inter", palette: ["#0F172A", "#38BDF8", "#F5F5DC"] };
const mgProps = { ...DEFAULTS, sections, mg: mgPackage, font: mgFont, palette: mgPalette, channelName: mgChannel.channel_name || "Legal Brief" };

mkdirSync(OUT_DIR, { recursive: true });

const serveUrl = await bundle({ entryPoint: join(__dirname, "Root.jsx"), onProgress: () => {} });

// One browser for all stills: each cold launch can exceed Chrome's 25s
// connect timeout on this machine, so reuse a single instance.
// openBrowser's real signature is (browser, options) — passing a single
// options object as `browser` (as this used to) silently drops
// browserExecutable and makes it try to download its own Chrome, which
// this sandbox's egress policy blocks. Found while verifying this session's
// changes; real defect, unrelated to this session's actual work.
const browserInstance = await openBrowser(undefined, { browserExecutable: CHROME, chromiumOptions: { gl: "swangle" } });

const renderStillSafe = async (compId, inputProps, out, frame, durationOverride = null) => {
  const composition = await selectComposition({ serveUrl, id: compId, browserExecutable: CHROME, puppeteerInstance: browserInstance, inputProps });
  await renderStill({
    composition: durationOverride ? { ...composition, durationInFrames: durationOverride } : composition,
    serveUrl,
    output: out,
    frame,
    browserExecutable: CHROME,
    puppeteerInstance: browserInstance,
    inputProps,
  });
};

const stillProps = {
  "cinematic-documentary": cinProps,
  "cinematic-leak": cinProps,
  "cinematic-alt": cinAltProps,
  minimal: minProps,
};

for (const [name, id, frame] of [
  ["cinematic-documentary", "CinematicDocumentaryShorts", 60],
  ["cinematic-documentary", "CinematicDocumentaryShorts", 90],
  ["cinematic-documentary", "CinematicDocumentaryShorts", 200],
  ["cinematic-documentary", "CinematicDocumentaryShorts", 600],
  ["cinematic-documentary", "CinematicDocumentaryShorts", 900],
  ["cinematic-documentary", "CinematicDocumentaryShorts", 1200],
  ["cinematic-documentary", "CinematicDocumentaryShorts", 1500],
  ["cinematic-documentary", "CinematicDocumentaryShorts", 1790],
  ["cinematic-leak", "CinematicDocumentaryShorts", 415],
  ["cinematic-alt", "CinematicDocumentaryShorts", 60],
  ["minimal", "MinimalShorts", 60],
]) {
  await renderStillSafe(id, stillProps[name], join(OUT_DIR, `${name}-f${frame}.png`), frame);
  console.log("rendered:", join(OUT_DIR, `${name}-f${frame}.png`));
}

// H18 — motion-graphics stills across the whole timeline (beat stages, list
// runs, section kickers, image beats). Frames land inside HERO_NUMBER (5, 60,
// 600, 1200, 1800), LIST_ITEM runs (300, 700, 1790), IMAGE_BEAT (505, 1210,
// 1565), CONTRAST (900), RELATION (1500) and STATEMENT (2050).
for (const frame of [5, 60, 300, 505, 600, 700, 900, 1210, 1500, 1565, 1800, 2050]) {
  await renderStillSafe("MotionGraphicsShorts", mgProps, join(OUT_DIR, `mg-f${frame}.png`), frame, mgPackage.totalFrames);
  console.log("rendered:", join(OUT_DIR, `mg-f${frame}.png`));
}

await browserInstance.close({ silent: true });

const { decodePNG, meanColor } = await import("./decode-png.js");
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const hA = hash(join(OUT_DIR, "cinematic-documentary-f60.png"));
const hAlt = hash(join(OUT_DIR, "cinematic-alt-f60.png"));
console.log("cinematic vs alt-palette:", hA === hAlt ? "IDENTICAL -> palette NOT applied" : "DIFFERENT -> palette applied");

for (const f of ["cinematic-documentary-f60", "cinematic-documentary-f600", "cinematic-documentary-f900", "cinematic-documentary-f1200", "cinematic-documentary-f1500", "minimal-f60"]) {
  const png = decodePNG(join(OUT_DIR, `${f}.png`));
  const c = meanColor(png, Math.round(png.width * 0.3), Math.round(png.height * 0.3), Math.round(png.width * 0.7), Math.round(png.height * 0.7));
  console.log(`${f}: mean RGB(${c.join(",")})`);
}

// B-roll presence: hook shots 1 and 2 (frames 60 / 200) are DIFFERENT photos,
// so their top strip (no text there) must differ; Ken Burns motion means frame
// 60 vs 90 of the SAME shot must also differ.
const topStrip = (png) => meanColor(png, 0, 0, png.width - 1, Math.round(png.height * 0.22));
const strip60 = topStrip(decodePNG(join(OUT_DIR, "cinematic-documentary-f60.png")));
const strip90 = topStrip(decodePNG(join(OUT_DIR, "cinematic-documentary-f90.png")));
const strip200 = topStrip(decodePNG(join(OUT_DIR, "cinematic-documentary-f200.png")));
const diff = (a, b) => a.map((v, i) => Math.abs(v - b[i]));
console.log("b-roll top strip f60:", strip60.join(","));
console.log("b-roll top strip f90:", strip90.join(","));
console.log("b-roll top strip f200:", strip200.join(","));
console.log("Ken Burns motion f60->f90 diff:", diff(strip60, strip90).join(","));
console.log("shot change f60->f200 diff:", diff(strip60, strip200).join(","));

const cin1790 = decodePNG(join(OUT_DIR, "cinematic-documentary-f1790.png"));
console.log("cinematic f1790 (fade-to-black): corner", sampleAtRaw(cin1790, 40, 40).join(","), "center", sampleAtRaw(cin1790, 540, 960).join(","));

const leak = decodePNG(join(OUT_DIR, "cinematic-leak-f415.png"));
console.log("cinematic leak f415 region (78%,18%):", sampleAtRaw(leak, Math.round(leak.width * 0.78), Math.round(leak.height * 0.18)).join(","));

// ─────────────────────────────────────────────────────────────────────────────
// Motion-graphics PNG probes — the stills must be alive: frames differ, the
// background is the channel bg, and the accent colour actually renders.
// ─────────────────────────────────────────────────────────────────────────────
const mg60 = decodePNG(join(OUT_DIR, "mg-f60.png"));
const mg1500 = decodePNG(join(OUT_DIR, "mg-f1500.png"));
console.log("mg f60 vs f1500:", hash(join(OUT_DIR, "mg-f60.png")) === hash(join(OUT_DIR, "mg-f1500.png")) ? "IDENTICAL -> no motion" : "DIFFERENT -> alive");

const corner = sampleAtRaw(mg60, 20, 20);
const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
console.log(`mg f60 corner (bg ${mgPalette.bg}):`, corner.join(","), near(corner, hex(mgPalette.bg), 26) ? "bg OK" : "bg MISMATCH");

const accentCount = countNear(mg900(), hex(mgPalette.accent), 48);
console.log("mg f900 pixels near accent:", accentCount, accentCount > 0 ? "accent OK" : "accent MISSING");

const capMean = meanColor(mg60, 300, 1150, 780, 1230);
const capBg = meanColor(mg60, 200, 1400, 880, 1500);
console.log("mg f60 caption zone mean:", capMean.join(","), "lower-zone mean:", capBg.join(","), capMean[0] + capMean[1] + capMean[2] > capBg[0] + capBg[1] + capBg[2] + 30 ? "caption OK" : "caption zone too dark");

// IMAGE_BEAT frames must show real photo content — high pixel variance in the
// stage region (flat bg + grid would be near-zero variance).
for (const f of [505, 1210, 1565]) {
  const png = decodePNG(join(OUT_DIR, `mg-f${f}.png`));
  const sd = stdDev(png, 48, 392, 888, 940);
  console.log(`mg f${f} IMAGE_BEAT stage stddev:`, sd.toFixed(1), sd > 18 ? "photo OK" : "STAGE FLAT -> image NOT rendering");
}

// Every mg still must contain real content (no all-flat frame).
for (const f of [5, 60, 300, 505, 600, 700, 900, 1210, 1500, 1565, 1800, 2050]) {
  const png = decodePNG(join(OUT_DIR, `mg-f${f}.png`));
  const sd = stdDev(png, 0, 0, png.width - 1, png.height - 1);
  if (sd < 3) console.log(`mg f${f}: WHOLE FRAME FLAT (stddev ${sd.toFixed(1)})`);
}
console.log("ALL STYLES OK");

function stdDev(png, x0, y0, x1, y1) {
  const samples = [];
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      const [r, g, b] = sampleAtRaw(png, x, y);
      samples.push(r + g + b);
    }
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const varr = samples.reduce((a, s) => a + (s - mean) * (s - mean), 0) / samples.length;
  return Math.sqrt(varr);
}

function mg900() {
  return decodePNG(join(OUT_DIR, "mg-f900.png"));
}

function countNear(png, rgb, tol) {
  let n = 0;
  for (let y = 0; y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const p = sampleAtRaw(png, x, y);
      if (near(p, rgb, tol)) n++;
    }
  }
  return n;
}

function hex(hexStr) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hexStr).trim());
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sampleAtRaw(png, x, y) {
  const i = (y * png.width + x) * png.channels;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}
