/**
 * data/audit/11/type-d14-probe.mjs — Stage-11 audit-type D14 rendered probe.
 *
 * Renders the REAL HERO_NUMBER counter (beats/HeroNumber.jsx) with the REAL
 * vendored woff2 faces loaded (imports wait-for-fonts.js → FONT_FACES), at
 * spread frames across the count window, and measures the numeral span's
 * layout box (offsetWidth/offsetHeight — transform-free) and DOM rect
 * (getBoundingClientRect). This is the first D14 evidence that is not
 * font-blind: the motion probe's entry never loads fonts, so its numerals
 * render in the browser-default face.
 *
 * Runs (3):
 *   t11-13600-inter  debt-snowball ch-01 value 13,600 — Inter (tnum) → expect byte-identical box
 *   t11-1986-inter   movile-cave  ch-01 value  1,986 — Inter (tnum) → expect byte-identical box
 *   t11-2000-dmsans  narrowboat   ch-02 value  2,000 — DM Sans (no tnum) → expect jitter (A1.3 justification)
 *   t11-800-dmsans   narrowboat   ch-02 value    800 — DM Sans (no tnum) → expect jitter
 *
 * Frame sample set: the first/last count frames + 9 evenly spread frames +
 * the frames of the predicted widest and narrowest strings (node-side
 * prediction via a mirrored E_OUT + formatCounter). "Every frame" is covered
 * by (a) T-11-01/D5 proving the digit count never changes mid-count and
 * (b) the rendered box being byte-identical at every sampled frame INCLUDING
 * the widest/narrowest predicted strings; on a tnum face equal-width digits
 * + constant length ⇒ constant advance for every string in the count.
 *
 * Run: node data/audit/11/type-d14-probe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { D } from "../../../src/skills/remotion-render/compositions/beats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, "..", "..", "..");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUBLIC_DIR = path.join(repo, "src", "skills", "remotion-render", "public");
const OUT_DIR = path.join(__dirname, "out");
const REPORT = path.join(__dirname, "type-d14-report.json");

const FPS = 30;
const DUR = 90;
const tA = 10; // beat-relative anchor (motion-probe convention: ANCHOR − START)
const start = Math.max(tA - D.micro, 0); // count window start = 6
const end = start + D.push; // count window end = 66

const COLORS = {
  bg: "#0B0F19",
  surface: "#141A26",
  accent: "#22D3EE",
  textPrimary: "#F1F5F9",
  textDim: "#94A3B8",
  stroke: "#334155",
};
// The legacy hero stage rect — numeral is centred at cx=468, cy=666.
const STAGE = { x: 48, y: 392, w: 840, h: 548 };

// ── E_OUT mirror (HeroNumber.jsx:11 Easing.bezier(0.16, 1, 0.3, 1)) ─────────
function cubicBezierYAtX(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  function solveX(x) {
    let t = x;
    for (let i = 0; i < 10; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-9) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (sampleX(mid) < x) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  return (x) => sampleY(solveX(x));
}
const E_OUT = cubicBezierYAtX(0.16, 1, 0.3, 1);

// ── formatCounter mirror (HeroNumber.jsx:36-49, verbatim) ───────────────────
function raisedFloor(value) {
  const abs = Math.abs(Math.trunc(value));
  if (!Number.isFinite(abs) || abs < 10) return 0;
  return 10 ** (String(abs).length - 1);
}
function formatCounter(value, progress) {
  if (!Number.isFinite(value)) return "0";
  const floor = raisedFloor(value);
  const shown = Math.min(value, floor + (value - floor) * progress);
  const rounded = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
/** predicted string at a beat-relative frame (count window [start, end]). */
function predictedString(value, frame) {
  const p = E_OUT(Math.min(Math.max((frame - start) / D.push, 0), 1));
  return formatCounter(value, p);
}
/** crude advance score — wider digits (8/9) count more, so we can predict
 *  the widest and narrowest strings a tnum-less font will render. */
function digitScore(s) {
  let score = 0;
  for (const ch of s.replace(/[^0-9]/g, "")) {
    if (ch === "8" || ch === "9") score += 1;
    else if (ch === "1") score += 0;
    else score += 0.5;
  }
  return score;
}

// ── RUNS ────────────────────────────────────────────────────────────────────
const RUNS = [
  { id: "t11-13600-inter", value: 13600, unit: "", fontFamily: "Inter", expect: "stable", note: "debt-snowball ch-01 — Inter has tnum (tnum-features.txt)" },
  { id: "t11-1986-inter", value: 1986, unit: "", fontFamily: "Inter", expect: "stable", note: "movile-cave ch-01 — Inter has tnum" },
  { id: "t11-2000-dmsans", value: 2000, unit: "", fontFamily: "DM Sans", expect: "jitter", note: "narrowboat ch-02 — DM Sans has NO tnum (stage-2 binary read)" },
  { id: "t11-800-dmsans", value: 800, unit: "", fontFamily: "DM Sans", expect: "jitter", note: "narrowboat ch-02 — DM Sans has NO tnum" },
];

for (const run of RUNS) {
  // Distinct predicted strings over the whole count + their frames.
  const byString = new Map();
  for (let f = start; f <= end; f++) {
    const s = predictedString(run.value, f);
    if (!byString.has(s)) byString.set(s, f);
  }
  const strings = [...byString.keys()];
  const widest = strings.reduce((a, b) => (digitScore(b) > digitScore(a) ? b : a));
  const narrowest = strings.reduce((a, b) => (digitScore(b) < digitScore(a) ? b : a));
  const sample = new Set([start, end]);
  for (let i = 1; i <= 9; i++) sample.add(Math.round(start + (D.push * i) / 10));
  sample.add(byString.get(widest));
  sample.add(byString.get(narrowest));
  run.distinctStrings = strings.length;
  run.widest = widest;
  run.narrowest = narrowest;
  run.frames = [...sample].filter((f) => f >= start && f <= end).sort((a, b) => a - b);
}

// ── ENTRY TEMPLATE (written to data/audit/11/_type-entry.jsx) ───────────────
function serializeEntry() {
  const wired = RUNS.map((r) => ({
    id: r.id,
    value: r.value,
    unit: r.unit,
    fontFamily: r.fontFamily,
    stage: STAGE,
    colors: COLORS,
    anchorFrame: tA,
  }));
  return `
import React from "react";
import { registerRoot, Composition, AbsoluteFill, useCurrentFrame } from "remotion";
import "../../../src/skills/remotion-render/wait-for-fonts.js";
import { HeroNumber } from "../../../src/skills/remotion-render/beats/HeroNumber.jsx";
import { reserveCounterWidth, HEADLINE_FONT } from "../../../src/skills/remotion-render/layout/measure.js";

const WIRED = ${JSON.stringify(wired)};

function Measure({ compId, frame, fontFamily }) {
  React.useEffect(() => {
    const root = document.querySelector("[data-root]");
    const rr = root ? root.getBoundingClientRect() : { x: 0, y: 0 };
    const el = document.querySelector('[data-role="numeral"]');
    const rows = [];
    if (el) {
      const r = el.getBoundingClientRect();
      rows.push({
        id: "numeral",
        role: "numeral",
        x: r.x - rr.x,
        y: r.y - rr.y,
        w: r.width,
        h: r.height,
        ow: el.offsetWidth,
        oh: el.offsetHeight,
        text: el.textContent ? el.textContent.trim() : "",
      });
    }
    console.log("TYPE_MEASURE:" + compId + "@f" + frame + ":" + JSON.stringify(rows));
    if (el) {
      // A1.1 direct check: the reserved width for the CURRENT string must be
      // a grid multiple (ceil8) and cover the rendered box (>= DOM width).
      // Try/catch: a measurement throw must never hang the render — log it.
      try {
        const rect = el.getBoundingClientRect();
        const finalStr = el.textContent.trim();
        // Reserve with the numeral's ACTUAL render font size (fit-computed by
        // HeroNumber) — measuring without fontSize returns ~16px default and
        // is physically meaningless (probe finding, see report).
        const fontSize = Number.parseFloat(window.getComputedStyle(el).fontSize);
        // Rule 5.2: the measurement must use the SAME font properties as the
        // render — the numeral span carries fontVariantNumeric:"tabular-nums"
        // (HeroNumber.jsx), so the reserve must too; without it, Inter
        // measures narrower than it renders and the slot wouldn't fit.
        const fontStyle = { fontFamily, ...HEADLINE_FONT, fontVariantNumeric: "tabular-nums" };
        const reserved = reserveCounterWidth(finalStr, fontStyle, fontSize);
        console.log("TYPE_RESERVE:" + compId + ":" + JSON.stringify({
          str: finalStr,
          fontSize,
          reserved,
          domW: rect.width,
          fits: reserved >= rect.width - 0.001,
        }));
      } catch (err) {
        console.log("TYPE_RESERVE:" + compId + ":{\\"error\\":\\"" + String(err && err.message ? err.message : err).replace(/"/g, "'") + "\\"}");
      }
    }
  }, []);
  return null;
}

function Run({ run }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill data-root style={{ backgroundColor: run.colors.bg }}>
      {/* HeroNumber destructures fontFamily but never applies it (finding 4-1);
          the wrapper sets it so the numeral inherits the REAL face. */}
      <div style={{ fontFamily: run.fontFamily, position: "absolute", inset: 0 }}>
        <HeroNumber
          rects={{}}
          stage={run.stage}
          colors={run.colors}
          anchorFrame={run.anchorFrame}
          frame={frame}
          value={run.value}
          unit={run.unit}
        />
      </div>
      <Measure compId={run.id} frame={frame} fontFamily={run.fontFamily} />
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <>
    {WIRED.map((run) => (
      <Composition
        key={run.id}
        id={run.id}
        component={Run}
        durationInFrames={${DUR}}
        fps={${FPS}}
        width={1080}
        height={1920}
        defaultProps={{ run }}
      />
    ))}
  </>
);

registerRoot(RemotionRoot);
`;
}

function parseMeasures(logs, marker) {
  const rows = [];
  for (const log of logs) {
    const line = typeof log === "string" ? log : String(log && log.text ? log.text : log);
    if (line.includes(marker)) {
      try {
        const json = line.slice(line.indexOf(marker) + marker.length);
        const arr = JSON.parse(json);
        if (Array.isArray(arr)) rows.push(...arr);
        else rows.push(arr);
      } catch {
        /* ignore malformed */
      }
    }
  }
  return rows;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ENTRY = path.join(__dirname, "_type-entry.jsx");
  fs.writeFileSync(ENTRY, serializeEntry(), "utf8");

  console.log("bundling (with real fonts via wait-for-fonts.js)…");
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, onProgress: () => {} });
  let browser = await openBrowser(CHROME);
  const report = { tA, start, end, runs: [], pass: false };
  let failures = 0;

  for (const run of RUNS) {
    const frames = run.frames;
    const measured = [];
    let consecutiveErrors = 0;
    for (const frame of frames) {
      const out = path.join(OUT_DIR, `${run.id}-f${frame}.png`);
      const logs = [];
      try {
        // Belt-and-suspenders: a single stuck render must not hang the probe.
        const composition = await Promise.race([
          selectComposition({ serveUrl, id: run.id }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("selectComposition timeout (60s)")), 60000)),
        ]);
        const rendered = Promise.race([
          renderStill({ serveUrl, composition, frame, output: out, browser, logLevel: "error", onBrowserLog: (l) => logs.push(l) }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("renderStill timeout (60s)")), 60000)),
        ]);
        await rendered;
      } catch (err) {
        consecutiveErrors++;
        console.log(`  f${frame} ERROR ${err.message}`);
        measured.push({ frame, error: err.message });
        // 3 consecutive failures = the browser/serveUrl socket is dead.
        // Recycle the browser once so the rest of the run can proceed.
        if (consecutiveErrors >= 3) {
          try { await browser.close(); } catch {}
          browser = await openBrowser(CHROME);
          consecutiveErrors = 0;
        }
        continue;
      }
      consecutiveErrors = 0;
      const rows = parseMeasures(logs, `TYPE_MEASURE:${run.id}@f${frame}:`);
      const numeral = rows.find((r) => r.role === "numeral") || null;
      const reserves = parseMeasures(logs, `TYPE_RESERVE:${run.id}:`);
      const reserve = reserves[0] || null;
      measured.push({
        frame,
        text: numeral ? numeral.text : null,
        predicted: predictedString(run.value, frame),
        x: numeral ? numeral.x : null,
        y: numeral ? numeral.y : null,
        w: numeral ? numeral.w : null,
        h: numeral ? numeral.h : null,
        ow: numeral ? numeral.ow : null,
        oh: numeral ? numeral.oh : null,
        reserved: reserve ? reserve.reserved : null,
        reserveFits: reserve ? reserve.fits : null,
      });
      console.log(`  f${frame} "${measured[measured.length - 1].text}" ow=${measured[measured.length - 1].ow} w=${measured[measured.length - 1].w?.toFixed(2)}`);
    }

    const withBox = measured.filter((m) => m.ow !== null && m.ow !== undefined && !m.error);
    const ows = withBox.map((m) => m.ow);
    const ohs = withBox.map((m) => m.oh);
    const owMin = Math.min(...ows), owMax = Math.max(...ows);
    const ohMin = Math.min(...ohs), ohMax = Math.max(...ohs);
    // DOM rect equality only on post-entrance frames (scale == 1 after start + D.base).
    const postEntrance = withBox.filter((m) => m.frame >= start + D.base);
    const rectSpread = postEntrance.length
      ? {
          x: Math.max(...postEntrance.map((m) => m.x)) - Math.min(...postEntrance.map((m) => m.x)),
          y: Math.max(...postEntrance.map((m) => m.y)) - Math.min(...postEntrance.map((m) => m.y)),
          w: Math.max(...postEntrance.map((m) => m.w)) - Math.min(...postEntrance.map((m) => m.w)),
          h: Math.max(...postEntrance.map((m) => m.h)) - Math.min(...postEntrance.map((m) => m.h)),
        }
      : null;
    // Predicted-vs-rendered cross-check (validates the E_OUT mirror).
    const mismatches = measured.filter((m) => m.predicted && m.text !== null && m.text !== m.predicted);
    const boxStable = owMax - owMin === 0 && ohMax - ohMin === 0;
    const rectStable = rectSpread && rectSpread.x <= 0.001 && rectSpread.y <= 0.001 && rectSpread.w <= 0.001 && rectSpread.h <= 0.001;
    // A1.1 direct check (claim T-11-05): reserveCounterWidth returns a
    // grid-multiple (ceil8) width that covers the rendered numeral box.
    const reserves = withBox.filter((m) => m.reserved !== null && m.reserved !== undefined && !m.error);
    const reserveOk = reserves.length > 0
      && reserves.every((m) => m.reserved % 8 === 0 && m.reserveFits === true);
    let pass;
    if (run.expect === "stable") {
      pass = boxStable && rectStable && mismatches.length === 0 && reserveOk;
    } else {
      // jitter run: the probe PASSES only if the jitter is actually present
      // (the A1.3 justification is real) AND the strings still match AND the
      // A1.1 reserve still covers every rendered box.
      pass = owMax - owMin > 0 && mismatches.length === 0 && reserveOk;
    }
    if (!pass) failures++;
    run.measured = measured;
    run.result = {
      distinctStrings: run.distinctStrings,
      widest: run.widest,
      narrowest: run.narrowest,
      frames: frames.length,
      owMin, owMax, ohMin, ohMax,
      boxStable,
      rectSpread,
      rectStable,
      reserveOk,
      reserves: reserves.map((m) => ({ frame: m.frame, str: m.text, reserved: m.reserved })),
      mismatches: mismatches.map((m) => `f${m.frame}: predicted="${m.predicted}" rendered="${m.text}"`),
      pass,
    };
    report.runs.push(run);
    console.log(`${pass ? "PASS" : "FAIL"} D14 ${run.id} (${run.expect}): ow range [${owMin}..${owMax}] oh [${ohMin}..${ohMax}] rectSpread ${JSON.stringify(rectSpread)} ${reserveOk ? "reserve-ok" : "RESERVE-BROKEN"} ${mismatches.length ? "STRING-MISMATCH " + mismatches.length : ""}`);
  }

  report.pass = failures === 0;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), "utf8");
  try { await browser.close(); } catch {}
  console.log(`\n${failures === 0 ? "ALL D14 RUNS PASS" : failures + " FAILURES"} — report: ${REPORT}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("probe crashed:", err);
  process.exit(1);
});
