#!/usr/bin/env node
/**
 * FRAME-BOUNDS GATE — does any scene draw its subject off the frame?
 *
 * Usage:
 *   node qa-scripts/frame-bounds.mjs            # render + assert, exit 1 on violation
 *   node qa-scripts/frame-bounds.mjs --keep     # also keep every rendered PNG
 *   node qa-scripts/frame-bounds.mjs --only=COMPARISON,ACCUMULATION
 *                                               # one or more strategies, for a
 *                                               # cheap regression proof (the full
 *                                               # sweep renders 16 stills)
 *
 * WHY THIS EXISTS
 *
 * Three defects found in one session — ComparisonScene's larger figure
 * running past the canvas edge, ScaleComparisonScene rendering its figure
 * entirely off-canvas for a whole beat, and CinematicStatementScene's
 * phrase box overflowing on an off-centre framing — were all "the subject
 * left the frame", and `visual/run-visual-tests.js` (74 checks) caught
 * NONE of them. It cannot: two of the three are CSS behaviours (a
 * `transform` silently becoming a containing block; absolutely-positioned
 * siblings painting over static ones) that only exist once a browser has
 * laid the scene out. The one pre-existing bounds check
 * ("a document page never draws outside the safe rect") is geometry math
 * for one scene, not a pixel test, and is blind to all three.
 *
 * So this renders the real anchor frame of every strategy it can reach,
 * through the same `renderStill` path `inspect-anchors.mjs` uses, and
 * measures the pixels.
 *
 * WHAT IT ASSERTS, AND WHY EACH THRESHOLD IS THE NUMBER IT IS
 *
 * Every threshold below was derived by measuring REAL frames from this
 * repo — the known-bad renders captured before each fix and the known-good
 * renders captured after — not chosen by eye. The measurements are in
 * CHECK-REGISTER §3.12.20.
 *
 *  1. NO HIGH-CONTRAST INK IN THE LEFT/RIGHT EDGE BANDS.
 *     A glyph clipped by the frame edge leaves bright ink hard against
 *     that edge. Ground, atmosphere and foreground planes also reach the
 *     edge — by design — but they are quiet: the highest edge contrast
 *     measured on any good frame was 48.75/255 (ch-02's ridge). The lowest
 *     measured on a real violation was 199.75/255. EDGE_CONTRAST sits
 *     between them at 140.
 *
 *     LEFT AND RIGHT ONLY, deliberately. All three real defects were
 *     horizontal overflow. Vertical bleed is a designed feature — the
 *     PROCESS track runs from -12% to +112% of frame height on purpose,
 *     and foreground planes are meant to leave the frame — so banding the
 *     top and bottom would flag intent as failure and the check would be
 *     suppressed everywhere within a week. A check that has to be ignored
 *     is worse than no check.
 *
 *  2. THE FRAME IS NOT EMPTY.
 *     ScaleComparisonScene's off-canvas bug produced a frame with nothing
 *     in it — no clipping to detect, because the subject was gone
 *     entirely. Ink is measured with the SAME definition the rest of this
 *     repo's frame audits use (`inspect-anchors.mjs`: background from the
 *     frame's own corners, delta threshold 26/255). Measured: the blank
 *     frame read 0.1%; the sparsest legitimate frame (a bare "$215" on
 *     white) read 0.5%. MIN_INK is 0.25%, between them.
 *
 *     This is deliberately a floor for "the scene drew nothing at all",
 *     NOT a composition-density opinion. §3.12.6's pixel audit is where
 *     density is argued; this only catches absence.
 *
 * WHAT IT DOES NOT CLAIM
 *
 * Passing means no subject was clipped horizontally and no frame came back
 * blank, on the strategies it actually reached. It says nothing about
 * whether a frame is good, readable, or on-concept — the muted-
 * comprehension read is still the acceptance test. Strategy COVERAGE is
 * reported explicitly: any strategy no input script routes a beat to is
 * listed as uncovered rather than silently counted as passing.
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";
import { buildMgPackage } from "../compositions/mg-package.js";
import { chunkTextClauseAware } from "../compositions/beats.js";
import { narrationSections } from "../../../utils/script-narration.js";
import { resolveBrollFiles } from "../broll.js";
import { paletteFromHues } from "../styles/tokens.js";
import { findChrome } from "../find-chrome.js";
import { decodePNG } from "../decode-png.js";
import { STRATEGIES } from "../visual/strategies.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
const OUT_DIR = join(ROOT, "data", "audit", "frame-bounds");
const KEEP = process.argv.includes("--keep");
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY = ONLY_ARG ? new Set(ONLY_ARG.slice(7).split(",").map((s) => s.trim()).filter(Boolean)) : null;

// ── thresholds, all measured (see the header) ────────────────────────────
const EDGE_CONTRAST = 140; // 255-scale delta; good max 48.75, bad min 199.75
const EDGE_BAND_FRAC = 0.02; // of frame width, each side
const MIN_INK = 0.0025; // blank measured 0.001, sparsest real 0.005
const INK_THRESHOLD = 26; // identical to inspect-anchors.mjs
/**
 * A clipped glyph leaves a TALL contiguous run against the edge; isolated
 * antialiasing does not. Measured: the real COMPARISON clipping ran 21px
 * at full scale (45px on the half-scale capture of the same defect), while
 * DATA_CHART's lone false positive was a single 1px hit at rgb 100 against
 * a 249 background — the antialiased corner of an element grazing the band
 * boundary at x=21 of a 21px band. Requiring a run of 4 separates them with
 * room to spare in both directions.
 */
const MIN_EDGE_RUN = 4;
/**
 * Materials whose whole point is to fill the frame. `footage` is a
 * photograph (composition.js MATERIALS: IMAGE_EVIDENCE -> M.FOOTAGE), and a
 * photograph bleeding edge to edge is the intent, not a defect — the
 * IMAGE_EVIDENCE anchor frame is a real sourced image of a cave mouth at
 * 73.9% ink, high-contrast rock texture running to both margins. Exempting
 * by MATERIAL rather than by strategy name keeps this honest: any future
 * strategy that also renders a photograph is covered, and nothing that
 * merely draws is.
 */
const EDGE_EXEMPT_MATERIALS = new Set(["footage"]);

/**
 * ONLY motion-graphics. This is not a shortcut — it is the only style whose
 * composition consumes `visualPlan` at all.
 *
 * `compositions/cinematic-documentary.jsx` and `compositions/minimal.jsx`
 * contain zero references to SemanticScene or visualPlan; they render their
 * own way from the beat text. Rendering a strategy's anchor frame through
 * one of them therefore measures a frame that strategy never drew, and
 * counting it as coverage is a lie the gate tells itself. Caught when
 * ENUMERATION was first reached on ch-04 (cinematic-documentary) and the
 * "covered" frame came back as that composition's serif title card, with
 * EnumerationScene never invoked.
 *
 * The first 16 strategies were unaffected — every one was first seen on a
 * motion-graphics channel (verified against the report's own `case`/
 * `channel` columns) — but the hole was real and would have swallowed the
 * next strategy to land on ch-04.
 */
const COMPOSITION = {
  "motion-graphics": "MotionGraphicsShorts",
};

const channels = JSON.parse(readFileSync(join(ROOT, "config", "channels.json"), "utf-8")).channels;
const byId = (cid) => channels.find((c) => c.channel_id === cid);

// ch-fixture is not a production channel. It is the only source of real
// sourced photos on this branch, so it is the only way IMAGE_EVIDENCE can
// be reached at all — the strategy fires only when a real asset resolves.
const FIXTURE_CHANNEL = {
  channel_id: "ch-fixture", channel_name: "ch-fixture", style: "motion-graphics",
  bg_mode: "black", font: "Inter", thumbnail_spec: { accentHue: 150 }, tone: "investigative",
};

/**
 * Inputs, chosen to spread across as many strategies as possible.
 * `srt: "fixture"` means the script has no real TTS on this branch and a
 * modelled SRT is generated for it — fine here, since this gate measures
 * WHERE things land in the frame, not speech timing.
 */
const CASES = [
  { name: "finance-accumulation", channel: byId("ch-01"),
    script: "src/skills/remotion-render/qa-scripts/fixtures/finance-accumulation.fixture.json", srt: "fixture" },
  { name: "tech-process", channel: byId("ch-48") || byId("ch-01"),
    script: "src/skills/remotion-render/qa-scripts/fixtures/tech-process.fixture.json", srt: "fixture" },
  { name: "uncovered-strategies", channel: byId("ch-01"),
    script: "src/skills/remotion-render/qa-scripts/fixtures/uncovered-strategies.fixture.json", srt: "fixture" },
  { name: "legal-geofence", channel: byId("ch-02"),
    script: "data/research/2/google-location-history-chatrie-ruling-shorts-script.json", srt: "fixture" },
  { name: "legal-traffic-stop", channel: byId("ch-02"),
    script: "data/research/2/what-to-say-traffic-stop-script.json",
    srt: "data/tts/2/what-to-say-traffic-stop-script-vo.srt" },
  { name: "history-great-fire", channel: byId("ch-04"),
    script: "data/research/4/great-fire-of-london-script.json",
    srt: "data/tts/4/great-fire-of-london-script-vo.srt" },
  { name: "fixture-photos", channel: FIXTURE_CHANNEL,
    script: "data/scripts/ch-fixture/movile-cave-shorts-script.json",
    srt: "data/tts/ch-fixture/movile-cave-shorts-script-vo.srt" },
];

/**
 * Modelled SRT for a script with no real TTS (same generator the render lane
 * uses). Written to the system temp dir, not OUT_DIR: these are pure
 * intermediates regenerated on every run, and OUT_DIR holds report.json,
 * which IS committed because the test suite gates on it.
 */
function fixtureSrt(scriptPath, name) {
  const tmp = join(tmpdir(), `frame-bounds-${name}-vo.fixture.srt`);
  execFileSync(process.execPath, [join(__dirname, "make-fixture-srt.mjs"), scriptPath, tmp], { stdio: "pipe" });
  return tmp;
}

/**
 * Ink coverage plus edge-band violations.
 *
 * Background comes from the frame's own corners, not the channel's `bg`:
 * the motion-graphics background carries its own texture, and a fixed
 * comparison would count that as subject ink. Same approach, and the same
 * 26/255 threshold, as inspect-anchors.mjs.
 */
function measure(pngPath) {
  const { width, height, data, channels: ch } = decodePNG(pngPath);
  const px = (x, y) => { const i = (y * width + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
  const corners = [px(4, 4), px(width - 5, 4), px(4, height - 5), px(width - 5, height - 5)];
  const bg = [0, 1, 2].map((c) => corners.reduce((a, p) => a + p[c], 0) / corners.length);
  const delta = (x, y) => {
    const p = px(x, y);
    return Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2]));
  };

  let inkPx = 0, sampled = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) { sampled++; if (delta(x, y) >= INK_THRESHOLD) inkPx++; }
  }

  // Edge bands, left and right only — see the header for why not top/bottom.
  const band = Math.max(2, Math.round(width * EDGE_BAND_FRAC));
  let edgeHits = 0, tallestRun = 0, worstDelta = 0;
  for (const [x0, x1] of [[0, band], [width - band, width]]) {
    for (let x = x0; x < x1; x++) {
      let run = 0;
      for (let y = 0; y < height; y++) {
        const d = delta(x, y);
        if (d > worstDelta) worstDelta = d;
        if (d >= EDGE_CONTRAST) { edgeHits++; run++; if (run > tallestRun) tallestRun = run; }
        else run = 0;
      }
    }
  }
  return { ink: inkPx / sampled, edgeHits, tallestRun, worstEdgeDelta: worstDelta, width, height };
}

function buildProps(c, scriptPath, srtPath) {
  const script = JSON.parse(readFileSync(scriptPath, "utf-8"));
  const sections = narrationSections(script)
    .filter((s) => s.voiceover && s.voiceover.trim())
    .map((s) => ({
      id: s.id, timing: s.timing, voiceover: s.voiceover,
      content: chunkTextClauseAware(s.voiceover), sfxCue: s.sfx_cue || null,
      bRoll: Array.isArray(s.b_roll) ? s.b_roll : null,
      beats: Array.isArray(s.beats) ? s.beats : null,
    }));
  for (const s of sections) s.bRollFiles = resolveBrollFiles(s.bRoll || [], c.channel_id, script.topic_slug);
  const mg = buildMgPackage(readFileSync(srtPath, "utf-8"), {
    sections, hook: script.hook || null, channel: c,
    bRollFiles: sections.flatMap((s) => s.bRollFiles || []),
    imageForSection: (i) => (sections[i] && sections[i].bRollFiles && sections[i].bRollFiles[0]) || null,
  });
  const palette = typeof c.thumbnail_spec?.accentHue === "number"
    ? paletteFromHues({ accentHue: c.thumbnail_spec.accentHue, bgMode: c.bg_mode, accent: (c.colors || {}).accent })
    : null;
  return {
    mg,
    props: {
      channelId: c.channel_id, style: c.style, format: "shorts", sections, mg,
      ttsAudioPath: null, hasUnderscore: false,
      thumbnailStyle: c.thumbnail_spec?.style || "dramatic-visual", tone: c.tone,
      font: c.font || "Inter", channelName: c.channel_name || "", palette,
      showCaptions: c.captions === "burned-in",
    },
  };
}

mkdirSync(OUT_DIR, { recursive: true });
const CHROME = findChrome();
console.log("bundling once...");
const serveUrl = await bundle({ entryPoint: join(RENDER_DIR, "Root.jsx"), onProgress: () => {} });

const results = [];
const seen = new Set();

for (const c of CASES) {
  if (!c.channel) { console.log(`SKIP ${c.name}: channel not in config`); continue; }
  if (!COMPOSITION[c.channel.style]) {
    // Not a strategy-driven style — see the COMPOSITION note above.
    console.log(`SKIP ${c.name}: style "${c.channel.style}" does not render visualPlan`);
    continue;
  }
  const scriptPath = join(ROOT, c.script);
  if (!existsSync(scriptPath)) { console.log(`SKIP ${c.name}: missing ${c.script}`); continue; }
  const srtPath = c.srt === "fixture" ? fixtureSrt(scriptPath, c.name) : join(ROOT, c.srt);
  if (!existsSync(srtPath)) { console.log(`SKIP ${c.name}: missing ${c.srt}`); continue; }

  let built;
  try { built = buildProps(c.channel, scriptPath, srtPath); }
  catch (err) { console.log(`SKIP ${c.name}: ${err.message.split("\n")[0]}`); continue; }
  const { mg, props } = built;

  // One beat per strategy, first occurrence.
  //
  // NO LIST_ITEM EXCLUSION. This filter used to carry
  // `b.archetype !== "LIST_ITEM"`, copied from inspect-anchors.mjs, from
  // when those beats had no visualPlan and were drawn by a separate
  // chip-in-a-card renderer. That exclusion meant the one piece of card
  // furniture left in the system was the one thing this gate could not
  // see. List beats plan as ENUMERATION now; the only condition is having
  // a plan to render.
  const staged = mg.beats.filter((b) => b.visualPlan && b.visualPlan.strategy);
  const id = COMPOSITION[c.channel.style];

  for (const beat of staged) {
    const strategy = beat.visualPlan.strategy;
    if (seen.has(strategy)) continue;
    if (ONLY && !ONLY.has(strategy)) continue;
    seen.add(strategy);

    const frame = Math.min(
      Number.isFinite(beat.anchorFrame) ? beat.anchorFrame : beat.startFrame,
      mg.totalFrames - 1
    );
    const png = join(OUT_DIR, `${strategy}.png`);
    try {
      const composition = await selectComposition({
        serveUrl, id, inputProps: props, ...(CHROME ? { browserExecutable: CHROME } : {}),
      });
      await renderStill({
        composition: { ...composition, durationInFrames: mg.totalFrames },
        serveUrl, output: png, frame, inputProps: props, imageFormat: "png",
        chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 180000, logLevel: "error",
        ...(CHROME ? { browserExecutable: CHROME } : {}),
      });
    } catch (err) {
      results.push({ strategy, case: c.name, status: "RENDER_FAIL", error: err.message.split("\n")[0] });
      console.log(`FAIL  ${strategy.padEnd(22)} render error: ${err.message.split("\n")[0]}`);
      continue;
    }

    const m = measure(png);
    const material = (beat.visualPlan.shot && beat.visualPlan.shot.material) || null;
    const edgeExempt = EDGE_EXEMPT_MATERIALS.has(material);
    const violations = [];
    if (!edgeExempt && m.edgeHits > 0 && m.tallestRun >= MIN_EDGE_RUN) {
      violations.push(`${m.edgeHits} high-contrast px in the L/R edge band (tallest run ${m.tallestRun}px) — subject clipped by the frame edge`);
    }
    if (m.ink < MIN_INK) {
      violations.push(`ink ${(m.ink * 100).toFixed(2)}% below ${(MIN_INK * 100).toFixed(2)}% — the scene drew essentially nothing`);
    }
    const status = violations.length ? "FAIL" : "PASS";
    results.push({
      strategy, case: c.name, channel: c.channel.channel_id, frame, status, violations,
      material, edgeExempt,
      ink: +(m.ink).toFixed(5), edgeHits: m.edgeHits, tallestRun: m.tallestRun,
      worstEdgeDelta: +m.worstEdgeDelta.toFixed(1),
    });
    console.log(
      `${status === "PASS" ? "ok  " : "FAIL"}  ${strategy.padEnd(22)} ink ${(m.ink * 100).toFixed(1).padStart(5)}%  ` +
      `edgeHits ${String(m.edgeHits).padStart(4)}  run ${String(m.tallestRun).padStart(3)}  ` +
      `worstEdgeDelta ${String(m.worstEdgeDelta.toFixed(0)).padStart(3)}` +
      (edgeExempt ? `  [edge-exempt: ${material}]` : "") +
      (violations.length ? `\n        ${violations.join("\n        ")}` : "")
    );
    if (!KEEP && status === "PASS") rmSync(png, { force: true });
  }
}

const covered = [...seen].sort();
const uncovered = Object.keys(STRATEGIES).filter((s) => !seen.has(s)).sort();
const failed = results.filter((r) => r.status !== "PASS");

// A filtered run must not overwrite the full report — it would claim
// coverage it did not measure, which is exactly the drift this gate exists
// to prevent.
if (!ONLY) writeFileSync(
  join(OUT_DIR, "report.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    thresholds: { EDGE_CONTRAST, EDGE_BAND_FRAC, MIN_EDGE_RUN, MIN_INK, INK_THRESHOLD,
      edgeExemptMaterials: [...EDGE_EXEMPT_MATERIALS] },
    covered, uncovered, results,
    passed: results.filter((r) => r.status === "PASS").length,
    failed: failed.length,
  }, null, 2) + "\n"
);

if (ONLY) {
  console.log(`\nfiltered run (--only) — report.json not rewritten`);
} else {
  console.log(`\ncovered ${covered.length}/${Object.keys(STRATEGIES).length} strategies`);
  if (uncovered.length) console.log(`uncovered (no input script routes a beat to these): ${uncovered.join(", ")}`);
  console.log(`report: data/audit/frame-bounds/report.json`);
}
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
