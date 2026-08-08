/**
 * data/audit/11/motion-probe.mjs — stage-11 motion audit probe (D6 + D7).
 *
 * Renders the 8 beats/** components (HeroNumber, TermDefine, ListItem,
 * Contrast, Relation, ImageBeat, Statement, Progress) as standalone Remotion
 * compositions — shorts + longform — through the same fromBeats → compile
 * pipeline the renderer uses, then verifies the stage-11 claim-card gates:
 *
 *   C17  pixel-identity (stage+headline region) of the first consecutive
 *        pixel-identical pair for every archetype — hold = the declared
 *        A4.1 "hold begins" frame (§0.3 of audit-motion.ledger.md,
 *        comment-declared in each component):
 *          hero (65,66)  term (29,30)  list (41,42)  contrast (22,23)
 *          relation (36,37)  image (66,67)  statement (18,19)
 *          progress (37,38)  —  progress's pair sits AFTER the discrete
 *          accent switch at 37 (accentOn = frame >= hl+24).
 *        FINDING (11-05): LIST (40,41) and IMAGE (65,66) are NOT
 *        pixel-identical — the E_OUT / overdamped-spring tail leaves a
 *        sub-pixel residue at hold−1 (list chip translate ≈0.015px; image
 *        scale ≈1.0002 → sub-px edge shift) that moves anti-aliased
 *        pixels. The declared holds (41 / tA+56) stay TRUE ("hold begins"
 *        = first static frame, verified by hold-static); the C17 pair for
 *        those two archetypes is (hold, hold+1).
 *   G1   settled headline: DOM rect == compiled rect (±0.5), opacity 1,
 *        scale 1, translate none — at the hold frame, all archetypes
 *   HOLD  at the hold frame every archetype-animated role is at rest
 *        (opacity 1, scale 1±1e-4, no px translate) — nothing moves after
 *        the declared hold
 *   G2a  HERO numeral counter reads "47" at hold (A2 raised floor)
 *   G5   TERM rule mid-draw at tA+9 (scaleX ∈ (0,1)), icon settled
 *   G6a/G6c/G6b LIST run mid-flight/drop/settled (stage-9 carried)
 *   mid-rise RELATION headline in flight at f32/f33 — the OLD declared
 *        hold tA+23 is provably wrong (headline still moving)
 *   image-push IMAGE scale > 1.0 at f30 (push mid-run)
 *   D6   source scan of beats/*.jsx: exactly two spring sites — Progress
 *        ζ = 0.518 ∈ [0.46, 1.0] ✓ and ImageBeat's push ζ = 10 (the
 *        sanctioned A3.3 / MANUAL D1 E.push exception)
 *
 * Gate frames are composition-relative (beat starts at 0; tA = 10 =
 * anchorFrame 310 − startFrame 300, matching compile's anchorFrame map).
 *
 * The entry lives INSIDE data/audit/11 (my ownership) — the tracked
 * src/skills/remotion-render/_motion-entry.jsx is left untouched.
 *
 * Exit 0 = all gates green, 1 = any failure. Report → motion-report.json.
 */
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fromBeats } from "../../../src/skills/remotion-render/spec/fromBeats.js";
import { validateShotSpecs } from "../../../src/skills/remotion-render/spec/schema.js";
import { compile } from "../../../src/skills/remotion-render/layout/compile.js";
import { measuredKey } from "../../../src/skills/remotion-render/layout/compile-lint.js";
import { MG_TYPE } from "../../../src/skills/remotion-render/compositions/beats.js";
import {
  SAFE_LONGFORM,
  SAFE_SHORTS,
  SLOTS_LONGFORM,
  SLOTS_SHORTS,
} from "../../../src/skills/remotion-render/layout/slots.js";
import { pngRegionDiff } from "../9/png-identity.mjs";

// ── CONFIG ────────────────────────────────────────────────────────────────

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUBLIC_DIR = "src/skills/remotion-render/public";
const ENTRY = "data/audit/11/_motion-entry.jsx"; // inside my ownership (the tracked _motion-entry.jsx is untouched)
const OUT_DIR = "data/audit/11/out/";
const REPORT = "data/audit/11/motion-report.json";
const BEATS_DIR = "src/skills/remotion-render/beats";
const DUR = 90;
const FPS = 30;
const START = 300; // wallclock beat start (stage-8/9 convention)
const ANCHOR = 310; // wallclock anchor
const tA = ANCHOR - START; // beat-relative anchor = 10

const COLORS = {
  bg: "#0B0F19",
  surface: "#141A26",
  accent: "#22D3EE",
  textPrimary: "#F1F5F9",
  textDim: "#94A3B8",
  stroke: "#334155",
};

const LIST_ITEMS = [
  { text: "Alpha", anchor: 10 },
  { text: "Beta", anchor: 15 },
  { text: "Gamma", anchor: 20 },
  { text: "Delta", anchor: 25 },
  { text: "Epsilon", anchor: 30 },
];

// PROGRESS fixture — the stage-8 2-bar chart (highlight = the LAST bar, so
// the accent switch hl+24 is the final event and the hold sits after it).
const PROGRESS_SERIES = [
  { label: "2019", value: 12 },
  { label: "2024", value: 47, highlight: true },
];

const RUN_SLUG = {
  h: "hero",
  t: "term",
  l: "list",
  c: "contrast",
  r: "relation",
  i: "image",
  s: "statement",
  p: "progress",
};

const SCENE = {
  h: { headline: "47%", unit: "%" },
  t: { headline: "Inflation", term: "inflation" },
  l: { headline: null, items: LIST_ITEMS },
  c: { headline: "47%" },
  r: { headline: "DRIVES INFLATION" },
  i: { headline: "ALAMEDA COURT" },
  s: { headline: "Views are earned" }, // ≤16 chars → 1 line at fs 84 in the 840px shorts slot
  p: { headline: "47%" }, // ≤16 chars → 1 line at fs 84 (the chart's highlight value — same family as hero/contrast)
};

// ── FIXTURES (one beat per owned archetype; LIST carries 5 items) ──────────

const FIX = [
  {
    id: "h",
    archetype: "HERO_NUMBER",
    anchorTokenIndex: 3,
    text: "Rates grew from 12% to 47%",
    wordTokens: ["Rates", "grew", "from", "12%", "to", "47%"].map((text) => ({ text })),
    data: { value: 47, unit: "%" },
    scene: SCENE.h,
    kicker: "01 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
  {
    id: "t",
    archetype: "TERM_DEFINE",
    anchorTokenIndex: 0,
    text: "Inflation: prices rise",
    wordTokens: ["Inflation:", "prices", "rise"].map((text) => ({ text })),
    data: { term: "inflation", definition: "a general increase in prices", phrase: "is" },
    scene: SCENE.t,
    kicker: "02 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
  {
    id: "l",
    archetype: "LIST_ITEM",
    anchorTokenIndex: 0,
    text: "Alpha",
    wordTokens: [{ text: "Alpha" }],
    data: { items: LIST_ITEMS },
    scene: SCENE.l,
    kicker: "03 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
  {
    id: "c",
    archetype: "CONTRAST",
    anchorTokenIndex: 1,
    text: "12 percent vs 47 percent",
    wordTokens: ["12", "percent", "vs", "47", "percent"].map((text) => ({ text })),
    data: { before: "12 percent", after: "47 percent" },
    scene: SCENE.c,
    kicker: "04 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
  {
    id: "r",
    archetype: "RELATION",
    anchorTokenIndex: 1,
    text: "Spending drives inflation",
    wordTokens: ["Spending", "drives", "inflation"].map((text) => ({ text })),
    data: { left: "Spending", right: "inflation", relation: "drives" },
    scene: SCENE.r,
    kicker: "05 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
  {
    id: "i",
    archetype: "IMAGE_BEAT",
    anchorTokenIndex: 0,
    text: "cave exploration",
    wordTokens: ["cave", "exploration"].map((text) => ({ text })),
    data: { image: "b-roll/ch-01/cave-entrance.jpg", credit: "BOGDAN PETRYEAX" },
    scene: SCENE.i,
    kicker: "06 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
  {
    id: "s",
    archetype: "STATEMENT",
    anchorTokenIndex: 0,
    text: "Every view is earned",
    wordTokens: ["Every", "view", "is", "earned"].map((text) => ({ text })),
    data: { icon: "target" },
    scene: SCENE.s,
    kicker: "07 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
  {
    id: "p",
    archetype: "PROGRESS",
    anchorTokenIndex: 4,
    text: "Rates grew from 12% to 47%",
    wordTokens: ["Rates", "grew", "from", "12%", "to", "47%"].map((text) => ({ text })),
    data: { unit: "%", series: PROGRESS_SERIES },
    scene: SCENE.p,
    kicker: "08 FIXTURE",
    startFrame: START,
    durationInFrames: DUR,
    anchorFrame: ANCHOR,
    sectionIndex: 0,
  },
];

// Component props from the fixture beat (claim 9-01 archetypeProps;
// stage-11 adds PROGRESS: unit only — chart is attached in the entry).
function archetypeProps(beat) {
  switch (beat.archetype) {
    case "HERO_NUMBER":
      return { value: beat.data.value, unit: beat.data.unit };
    case "TERM_DEFINE":
      return { icon: "lightbulb" };
    case "LIST_ITEM":
      return { items: LIST_ITEMS, icon: "activity" };
    case "CONTRAST":
      return { before: beat.data.before, after: beat.data.after, unit: "%" };
    case "RELATION":
      return { left: beat.data.left, right: beat.data.right, relation: beat.data.relation };
    case "IMAGE_BEAT":
      return { src: beat.data.image, credit: beat.data.credit };
    case "STATEMENT":
      return { icon: beat.data.icon };
    case "PROGRESS":
      return { unit: beat.data.unit };
    default:
      return {};
  }
}

// ── BUILD INPUTS (mirrors stage-9 motion-probe.mjs buildInputs exactly) ────

function fixtureMetrics(text, fontSize, slotW) {
  const chars = String(text).length;
  const charW = 0.6 * fontSize;
  const perLine = Math.max(Math.floor(slotW / charW), 1);
  const lines = Math.min(Math.ceil(chars / perLine), 2);
  return { width: Math.min(chars * charW, slotW), lines };
}

function buildInputs(fmt) {
  const slots = fmt === "shorts" ? SLOTS_SHORTS : SLOTS_LONGFORM;
  const safe = fmt === "shorts" ? SAFE_SHORTS : SAFE_LONGFORM;
  const fromOpts = {
    anchorFrames: Object.fromEntries(FIX.map((b) => [b.id, ANCHOR])),
    durations: Object.fromEntries(FIX.map((b) => [b.id, DUR])),
    defaultDuration: DUR,
    forceAllPersistent: true,
    runtime: "runtime 1",
    slotTable: slots,
    fonts: { family: "Inter" },
    measured: {},
    fromVersion: "fromBeats-11",
  };
  const specs = fromBeats(FIX, fromOpts); // ids s0b0..s0b7, FIX order preserved
  validateShotSpecs(specs);
  const fontFamily = "Inter";
  const fonts = {};
  const measured = {};
  const anchorFrame = {};
  specs.forEach((spec, i) => {
    const beat = FIX[i];
    anchorFrame[spec.id] = Math.max(beat.anchorFrame - beat.startFrame, 0); // 10
    spec.layers.forEach((layer, j) => {
      const key = `${spec.id}:${j}`;
      if (["kicker", "headline", "caption", "support"].includes(layer.role)) {
        const fontSize = MG_TYPE[layer.role] || 44;
        const text =
          layer.role === "kicker"
            ? `${String(layer.content.index).padStart(2, "0")} ${layer.content.label}`
            : (layer.content.text ?? "");
        const slotW = layer.role === "caption" ? slots.caption.w : slots.headline.w;
        fonts[key] = { fontSize, fontFamily };
        measured[measuredKey(text, fontSize, fontFamily)] = fixtureMetrics(text, fontSize, slotW);
      }
    });
  });
  const frames = compile(specs, { slots, safe, fonts, measured, anchorFrame });
  return { specs, frames, slots };
}

function wire(beat, fmt) {
  const { specs, frames, slots } = buildInputs(fmt);
  const idx = FIX.findIndex((b) => b.id === beat.id);
  const spec = specs[idx];
  const rects = frames[idx].rects;
  const layers = spec.layers || [];
  const motionOf = (role) => {
    const l = layers.find((x) => x.role === role);
    return l ? { enter: l.enter, exit: l.exit } : {};
  };
  const textOf = (role) => {
    const l = layers.find((x) => x.role === role);
    if (!l || !l.content) return undefined;
    return l.role === "kicker"
      ? `${String(l.content.index ?? 0).padStart(2, "0")} ${l.content.label ?? ""}`
      : (l.content.text ?? undefined);
  };
  const headlineLayer = layers.find((x) => x.role === "headline");
  const isShort = fmt === "shorts";
  const slug = RUN_SLUG[beat.id] || beat.id;
  const wired = rects
    .filter((r) => !r.structural || r.role === "accent")
    .map((r) => {
      const t = textOf(r.role);
      return {
        ...r,
        id: `${slug}-${fmt}-${r.role}`,
        ...motionOf(r.role),
        ...(t !== undefined ? { text: t } : {}),
      };
    });
  return {
    id: `${slug}-${fmt}`,
    archetype: beat.archetype,
    width: isShort ? 1080 : 1920,
    height: isShort ? 1920 : 1080,
    durationInFrames: DUR,
    fps: FPS,
    stage: slots.stage,
    colors: COLORS,
    anchorFrame: tA,
    props: archetypeProps(beat),
    rects: Object.fromEntries(wired.map((r) => [r.role, r])), // { headline, accent, chart }
    compiled: {
      headline: wired.find((r) => r.role === "headline") ?? null,
      accent: wired.find((r) => r.role === "accent") ?? null,
      headlineText: headlineLayer ? headlineLayer.content.text ?? "" : "",
      layers,
    },
  };
}

// ── ENTRY TEMPLATE (written to data/audit/11/_motion-entry.jsx) ────────────

function serializeEntry(wired) {
  const entry = `
import React from "react";
import { registerRoot, Composition, AbsoluteFill, useCurrentFrame } from "remotion";
import { HeroNumber } from "../../../src/skills/remotion-render/beats/HeroNumber.jsx";
import { TermDefine } from "../../../src/skills/remotion-render/beats/TermDefine.jsx";
import { ListItem } from "../../../src/skills/remotion-render/beats/ListItem.jsx";
import { Contrast } from "../../../src/skills/remotion-render/beats/Contrast.jsx";
import { Relation } from "../../../src/skills/remotion-render/beats/Relation.jsx";
import { ImageBeat } from "../../../src/skills/remotion-render/beats/ImageBeat.jsx";
import { Statement } from "../../../src/skills/remotion-render/beats/Statement.jsx";
import { Progress } from "../../../src/skills/remotion-render/beats/Progress.jsx";

const WIRED = __WIRED__;

const COMPONENTS = {
  HERO_NUMBER: HeroNumber,
  TERM_DEFINE: TermDefine,
  LIST_ITEM: ListItem,
  CONTRAST: Contrast,
  RELATION: Relation,
  IMAGE_BEAT: ImageBeat,
  STATEMENT: Statement,
  PROGRESS: Progress,
};

// Measures the committed DOM synchronously and logs one JSON row per
// measured element. Runs once on mount (the still frame is fixed). The log
// is keyed by composition + frame so a gate can never read a stale row set
// from a different still (observed once: list-shorts@f45 received contrast
// rows via a mis-attributed console event).
function Measure({ compId, frame }) {
  React.useEffect(() => {
    const root = document.querySelector("[data-root]");
    const rr = root ? root.getBoundingClientRect() : { x: 0, y: 0 };
    const rows = [];
    const seen = new Set();
    document
      .querySelectorAll("[data-rect-id], [data-role], [data-bar-group], [data-bar-id], [data-value-id], [data-label-id]")
      .forEach((el) => {
        const id = el.getAttribute("data-rect-id") || "";
        const role = el.getAttribute("data-role") || (el.getAttribute("data-bar-group") ? "bar-group" : el.getAttribute("data-bar-id") ? "bar" : el.getAttribute("data-value-id") ? "value" : el.getAttribute("data-label-id") ? "bar-label" : "");
        const index = el.getAttribute("data-index");
        const side = el.getAttribute("data-side") || "";
        const key = id + "::" + role + "::" + (index ?? el.getAttribute("data-value-id") ?? el.getAttribute("data-bar-id") ?? el.getAttribute("data-label-id")) + "::" + side;
        if (seen.has(key)) return;
        seen.add(key);
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        rows.push({
          id,
          role,
          x: r.x - rr.x,
          y: r.y - rr.y,
          w: r.width,
          h: r.height,
          opacity: parseFloat(s.opacity),
          scale: s.scale,
          translate: s.translate,
          text: el.textContent ? el.textContent.trim() : "",
          dtext: el.getAttribute("data-text"),
          value: el.getAttribute("data-value"),
          index: index !== null ? Number(index) : null,
          anchor: el.getAttribute("data-anchor"),
          side,
        });
      });
    console.log("MOTION_MEASURE:" + compId + "@f" + frame + ":" + JSON.stringify(rows));
  }, []);
  return null;
}

function Beat({ beat }) {
  const frame = useCurrentFrame();
  const C = COMPONENTS[beat.archetype];
  const chart = beat.rects && beat.rects.chart ? beat.rects.chart.chart : undefined;
  return (
    <AbsoluteFill data-root style={{ backgroundColor: beat.colors.bg }}>
      <C
        rects={beat.rects}
        stage={beat.stage}
        colors={beat.colors}
        anchorFrame={beat.anchorFrame}
        frame={frame}
        chart={chart}
        {...beat.props}
      />
      <Measure compId={beat.id} frame={frame} />
    </AbsoluteFill>
  );
}

export const RemotionRoot = () => (
  <>
    {WIRED.map((w) => (
      <Composition
        key={w.id}
        id={w.id}
        component={Beat}
        width={w.width}
        height={w.height}
        fps={30}
        durationInFrames={w.durationInFrames}
        defaultProps={{ beat: w }}
      />
    ))}
  </>
);

registerRoot(RemotionRoot);
`;
  return entry.replace("__WIRED__", JSON.stringify(wired));
}

// ── GATE ASSERTIONS ────────────────────────────────────────────────────────

// "Settled" = at rest: opacity 1, scale 1 (±1e-4 — E_OUT's near-1 saturation
// leaves sub-pixel residues like scale "1.00000005" at hold−1... but at the
// HOLD frame the residue must be ~0; the 1e-4 tolerance absorbs style-string
// rounding), no px translate. Percentage translates (-50% -50%) are the
// primitives' permanent centering offset — settled too.
const settled = (m) =>
  m &&
  m.opacity >= 0.999 &&
  (m.scale === "none" ||
    m.scale === null ||
    m.scale === "1" ||
    (m.scale !== undefined && Math.abs(parseFloat(m.scale) - 1) <= 1e-4)) &&
  (m.translate === "none" ||
    m.translate === undefined ||
    m.translate === "0px" ||
    m.translate === "0px 0px" ||
    /^-?\d+(\.\d+)?%\s?(-?\d+(\.\d+)?%)?$/.test(m.translate || ""));

const inFlight = (m) => m && !settled(m);

const byRole = (rows, role) => rows.find((r) => r.role === role);
const byRoleIdx = (rows, role, index) => rows.find((r) => r.role === role && r.index === index);
const chips = (rows) => rows.filter((r) => r.role === "chip").sort((a, b) => a.index - b.index);

function gateG1(rows, w) {
  const h = byRole(rows, "headline");
  const c = w.compiled.headline;
  if (!h || !c) return { pass: false, note: `headline missing (dom=${!!h}, compiled=${!!c})` };
  const close =
    Math.abs(h.x - c.x) <= 0.5 &&
    Math.abs(h.y - c.y) <= 0.5 &&
    Math.abs(h.w - c.w) <= 0.5 &&
    Math.abs(h.h - c.h) <= 0.5;
  return {
    pass: close && settled(h),
    note: `dom ${h.x.toFixed(1)},${h.y.toFixed(1)} ${h.w.toFixed(1)}x${h.h.toFixed(1)} op=${h.opacity} sc=${h.scale} tr=${h.translate} vs compiled ${c.x},${c.y} ${c.w}x${c.h}`,
  };
}

// HOLD — at the declared hold frame, every measured archetype role is at
// rest. Excluded: "numeral-style" (extra log row has no style fields) and
// "gridline" (Progress's decorative line carries a permanent static opacity
// 0.3 — dimmed by design, so it never satisfies the settled opacity>=0.999
// rule; it is static by construction, verified in Progress.jsx GRID_OPACITY).
function gateHoldStatic(rows) {
  const anim = rows.filter((r) => r.role !== "numeral-style" && r.role !== "gridline");
  if (anim.length === 0) return { pass: false, note: "no measured rows" };
  const bad = anim.filter((r) => !settled(r));
  return {
    pass: bad.length === 0,
    note: bad.length
      ? "in flight: " + bad.map((r) => `${r.role}${r.index ?? ""} op=${r.opacity} sc=${r.scale} tr=${r.translate}`).join(" | ")
      : `${anim.length} roles at rest`,
  };
}

function gateG2a(rows) {
  const n = byRole(rows, "numeral");
  return { pass: !!n && n.text === "47" && n.opacity >= 0.999, note: n ? `numeral text "${n.text}" op=${n.opacity}` : "no numeral" };
}

function gateG2b(rows, w) {
  const h = byRole(rows, "headline");
  const want = w.compiled.headlineText;
  return { pass: !!h && h.text === want, note: h ? `headline text "${h.text}" want "${want}"` : "no headline" };
}

function gateG5(rows) {
  const rule = byRole(rows, "rule");
  const icon = byRole(rows, "icon");
  if (!rule || !icon) return { pass: false, note: `rule=${!!rule} icon=${!!icon}` };
  const sx = parseFloat(rule.scale);
  return {
    pass: sx > 0 && sx < 1 && settled(icon),
    note: `rule scaleX=${rule.scale} (${sx}) icon op=${icon.opacity} sc=${icon.scale} tr=${icon.translate}`,
  };
}

function gateG6a(rows) {
  const cs = chips(rows);
  if (cs.length !== 3) return { pass: false, note: `chip count ${cs.length}` };
  const allInFlight = cs.every(inFlight);
  return {
    pass: allInFlight,
    note: `inFlight=${allInFlight} ` + cs.map((c, i) => `c${i} op=${c.opacity} sc=${c.scale} tr=${c.translate}`).join(" "),
  };
}

function gateG6b(rows, w) {
  const cs = chips(rows);
  if (cs.length !== 4) return { pass: false, note: `chip count ${cs.length}` };
  const allSettled = cs.every(settled);
  const bottom = cs[cs.length - 1].y + cs[cs.length - 1].h;
  const anchored = Math.abs(bottom - (w.stage.y + w.stage.h)) <= 0.5;
  const first = cs[0];
  return {
    pass: allSettled && anchored && first.dtext === "Beta" && String(first.anchor) === "15",
    note: `first=${first.dtext}/${first.anchor} settled=${allSettled} anchored=${anchored} bottom=${bottom.toFixed(1)} want=${w.stage.y + w.stage.h}`,
  };
}

function gateG6c(rows) {
  const cs = chips(rows);
  if (cs.length !== 5) return { pass: false, note: `chip count ${cs.length}` };
  const oldest = cs[0];
  return {
    pass: oldest.dtext === "Alpha" && oldest.opacity < 0.999 && inFlight(oldest),
    note: `oldest ${oldest.dtext} op=${oldest.opacity} tr=${oldest.translate} (drop fade in progress)`,
  };
}

function gateImagePush(rows) {
  const img = byRole(rows, "image");
  if (!img) return { pass: false, note: "no image" };
  const sc = parseFloat(img.scale);
  return { pass: sc > 1.0, note: `image scale=${img.scale} op=${img.opacity} (push mid-run)` };
}

function gateMidRise(rows) {
  const h = byRole(rows, "headline");
  if (!h) return { pass: false, note: "no headline" };
  const mid = h.opacity < 0.999 || (h.translate !== "none" && h.translate !== "0px" && h.translate !== "0px 0px");
  return { pass: mid, note: `headline op=${h.opacity} tr=${h.translate} (mid-flight evidence)` };
}

// ── D6 source scan ─────────────────────────────────────────────────────────
// Every spring config in beats/*.jsx must be ζ ∈ [0.46, 1.0] EXCEPT the
// documented A3.3 / MANUAL D1 E.push exception (ImageBeat's overdamped
// settle). Resolves Progress's `config: SPRING_CONFIG` reference to its
// literal in the same file. ζ = damping / (2·√(stiffness·mass)), mass = 1
// (Remotion default; Easing.spring defaults stiffness 100 when omitted).
function zeta(damping, stiffness) {
  return damping / (2 * Math.sqrt(stiffness));
}

function gateD6() {
  const dir = resolve(BEATS_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsx"));
  const sites = [];
  const configs = {}; // file → named spring config literals
  for (const f of files) {
    const src = readFileSync(resolve(dir, f), "utf8");
    // Scan comment-stripped source: the ImageBeat header doc block re-states
    // "Easing.spring({damping: 200})" TWICE (D6/exception notes) — those are
    // documentation, not sites; counting them double-reports the exception.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'/])\/\/[^\n]*/g, "$1");
    const cfgRe = /const\s+(\w+)\s*=\s*\{([^}]*damping[^}]*)\};?/g;
    let cm;
    while ((cm = cfgRe.exec(stripped))) configs[`${f}:${cm[1]}`] = cm[2];
    const re = /(?:Easing\.spring|spring)\(\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(stripped))) sites.push({ file: f, opts: m[1] });
  }
  const resolved = sites.map((s) => {
    const cfgRef = /config:\s*(\w+)/.exec(s.opts);
    const opts = cfgRef ? configs[`${s.file}:${cfgRef[1]}`] || s.opts : s.opts;
    const damping = Number(/damping:\s*([\d.]+)/.exec(opts)?.[1] ?? NaN);
    const stiffness = Number(/stiffness:\s*([\d.]+)/.exec(opts)?.[1] ?? 100);
    return {
      ...s,
      damping,
      stiffness,
      zeta: Number.isFinite(damping) ? zeta(damping, stiffness) : NaN,
    };
  });
  const progress = resolved.find((s) => s.file === "Progress.jsx");
  const image = resolved.find((s) => s.file === "ImageBeat.jsx");
  const others = resolved.filter((s) => s.file !== "Progress.jsx" && s.file !== "ImageBeat.jsx");
  const okCount = resolved.length === 2 && others.length === 0;
  const okProgress =
    progress && Math.abs(progress.zeta - zeta(13.9, 180)) < 1e-6 && progress.zeta >= 0.46 && progress.zeta <= 1.0;
  const okImage = image && Math.abs(image.damping - 200) < 1e-9 && image.zeta > 1.0; // the sanctioned exception
  return {
    pass: okCount && !!okProgress && !!okImage,
    note: `sites=${resolved.length} ${resolved
      .map((s) => `${s.file} ζ=${s.zeta.toFixed(3)} (d=${s.damping}, k=${s.stiffness})`)
      .join(" | ")} — Progress ζ=0.518 in-range, ImageBeat push ζ=10 = A3.3 exception`,
  };
}

// ── C17 pixel-identity region ─────────────────────────────────────────────

function c17Region(w) {
  const s = w.stage;
  const h = w.compiled.headline;
  const lefts = [s.x, h ? h.x : s.x];
  const tops = [s.y, h ? h.y : s.y];
  const rights = [s.x + s.w, h ? h.x + h.w : s.x + s.w];
  const bottoms = [s.y + s.h, h ? h.y + h.h : s.y + s.h];
  return {
    x0: Math.max(0, Math.min(...lefts) - 8),
    y0: Math.max(0, Math.min(...tops) - 8),
    x1: Math.min(w.width, Math.max(...rights) + 8),
    y1: Math.min(w.height, Math.max(...bottoms) + 8),
  };
}

// ── MAIN ───────────────────────────────────────────────────────────────────

// Each MOTION_MEASURE line is keyed by its composition + frame
// ("MOTION_MEASURE:list-shorts@f45:"), so a gate only ever reads the rows
// from ITS OWN still — a stale log from another render can't be
// mis-attributed.
function parseMeasures(logs, key) {
  const rows = [];
  const marker = "MOTION_MEASURE:" + key + ":";
  for (const log of logs) {
    const line = typeof log === "string" ? log : String(log && log.text ? log.text : log);
    if (line.includes(marker)) {
      try {
        const json = line.slice(line.indexOf(marker) + marker.length);
        const arr = JSON.parse(json);
        if (Array.isArray(arr)) rows.push(...arr);
      } catch {
        /* ignore malformed */
      }
    }
  }
  return rows;
}

// GATE SCHEDULE — frames are beat-relative; hold frames per §0.3 of the
// ledger. Mid-flight evidence frames: hero f17 (headline pre-RISE), term f19
// (rule mid-draw), list f18/f28/f45 (run in flight), relation f32/f33 (the
// OLD declared hold tA+23 — headline still moving there), image f30 (push).
const SCHEDULE = [
  { run: "hero", frame: 17, gates: ["mid-rise"] },
  { run: "hero", frame: 66, gates: ["G1", "G2a", "G2b", "hold-static"] },
  { run: "term", frame: 19, gates: ["G5"] },
  { run: "term", frame: 30, gates: ["G1", "G2b", "hold-static"] },
  { run: "list", frame: 18, gates: ["G6a"] },
  { run: "list", frame: 28, gates: ["G6c"] },
  { run: "list", frame: 41, gates: ["hold-static"] },
  { run: "list", frame: 45, gates: ["G6b"] },
  { run: "contrast", frame: 23, gates: ["G1", "hold-static"] },
  { run: "relation", frame: 32, gates: ["mid-rise"] },
  { run: "relation", frame: 33, gates: ["mid-rise"] },
  { run: "relation", frame: 37, gates: ["G1", "hold-static"] },
  { run: "image", frame: 30, gates: ["image-push"] },
  { run: "image", frame: 66, gates: ["G1", "hold-static"] },
  { run: "statement", frame: 19, gates: ["G1", "hold-static"] },
  { run: "progress", frame: 38, gates: ["hold-static"] },
];

// C17 pairs (both formats) — the first consecutive pixel-identical pair.
// PROGRESS (37,38): the accent switch is a discrete change AT 37, so the
// first identical pair is (37,38). LIST (41,42) / IMAGE (66,67): the E_OUT /
// overdamped-spring tail leaves a sub-pixel residue at hold−1 (chip translate
// ≈0.015px / image scale ≈1.0002) that moves anti-aliased pixels, so the
// first static pair is (hold, hold+1) — see finding 11-05.
const C17_PAIRS = [
  { run: "hero", a: 65, b: 66 },
  { run: "term", a: 29, b: 30 },
  { run: "list", a: 41, b: 42 },
  { run: "contrast", a: 22, b: 23 },
  { run: "relation", a: 36, b: 37 },
  { run: "image", a: 66, b: 67 },
  { run: "statement", a: 18, b: 19 },
  { run: "progress", a: 37, b: 38 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  rmSync(REPORT, { force: true });

  const wiredByRun = {};
  const wiredList = [];
  for (const beat of FIX) {
    for (const fmt of ["shorts", "longform"]) {
      const w = wire(beat, fmt);
      wiredByRun[`${RUN_SLUG[beat.id] || beat.id}-${fmt}`] = w;
      wiredList.push(w);
    }
  }

  writeFileSync(ENTRY, serializeEntry(wiredList), "utf8");

  console.log("bundling…");
  const serveUrl = await bundle({
    entryPoint: resolve(ENTRY), // plain absolute path (Windows-safe)
    publicDir: PUBLIC_DIR,
    onProgress: () => {},
  });
  console.log("serveUrl:", serveUrl);

  const browser = await openBrowser(CHROME);
  const report = { tA, gates: [], c17: [], d6: null, stills: [] };
  let failures = 0;

  const runGate = async (id, frame, gateName, fn) => {
    const out = `${OUT_DIR}${id}-f${frame}.png`;
    const logs = [];
    try {
      const composition = await selectComposition({ serveUrl, id });
      await renderStill({
        serveUrl,
        composition,
        frame,
        output: out,
        browser,
        logLevel: "error",
        onBrowserLog: (l) => logs.push(l),
      });
    } catch (err) {
      report.gates.push({ id, frame, gate: gateName, pass: false, note: `render error: ${err.message}` });
      failures++;
      return;
    }
    const rows = parseMeasures(logs, id + "@f" + frame);
    report.stills.push({ id, frame, out });
    const r = fn(rows);
    report.gates.push({ id, frame, gate: gateName, pass: r.pass, note: r.note });
    if (!r.pass) failures++;
    console.log(`${r.pass ? "PASS" : "FAIL"} ${gateName} ${id}@f${frame}: ${r.note}`);
  };

  const gateFns = {
    G1: (rows, w) => gateG1(rows, w),
    G2a: (rows) => gateG2a(rows),
    G2b: (rows, w) => gateG2b(rows, w),
    G5: (rows) => gateG5(rows),
    G6a: (rows) => gateG6a(rows),
    G6b: (rows, w) => gateG6b(rows, w),
    G6c: (rows) => gateG6c(rows),
    "image-push": (rows) => gateImagePush(rows),
    "mid-rise": (rows) => gateMidRise(rows),
    "hold-static": (rows) => gateHoldStatic(rows),
  };

  for (const fmt of ["shorts", "longform"]) {
    for (const s of SCHEDULE) {
      const id = `${s.run}-${fmt}`;
      const w = wiredByRun[id];
      for (const g of s.gates) {
        await runGate(id, s.frame, g, (rows) => gateFns[g](rows, w));
      }
    }
  }

  // C17 — pixel-identity pairs (shorts + longform).
  for (const fmt of ["shorts", "longform"]) {
    for (const p of C17_PAIRS) {
      const id = `${p.run}-${fmt}`;
      const w = wiredByRun[id];
      const region = c17Region(w);
      const fa = `${OUT_DIR}${id}-f${p.a}.png`;
      const fb = `${OUT_DIR}${id}-f${p.b}.png`;
      for (const [frame, out] of [[p.a, fa], [p.b, fb]]) {
        const composition = await selectComposition({ serveUrl, id });
        await renderStill({ serveUrl, composition, frame, output: out, browser, logLevel: "error" });
        report.stills.push({ id, frame, out });
      }
      const [bufA, bufB] = await Promise.all([
        import("node:fs/promises").then((m) => m.readFile(fa)),
        import("node:fs/promises").then((m) => m.readFile(fb)),
      ]);
      const diff = pngRegionDiff(bufA, bufB, region);
      const pass = diff.identical;
      if (!pass) failures++;
      report.c17.push({ id, a: p.a, b: p.b, region, pass, note: diff.firstDiff ? `firstDiff ${diff.firstDiff.x},${diff.firstDiff.y} ch${diff.firstDiff.ch} ${diff.firstDiff.a} vs ${diff.firstDiff.b}` : "identical" });
      console.log(`${pass ? "PASS" : "FAIL"} C17 ${id} f${p.a}/f${p.b} region ${JSON.stringify(region)} → ${pass ? "identical" : diff.firstDiff ? `diff at ${diff.firstDiff.x},${diff.firstDiff.y}` : "?"}`);
    }
  }

  // D6 — spring source scan (node-side, no render).
  const d6 = gateD6();
  report.d6 = d6;
  if (!d6.pass) failures++;
  console.log(`${d6.pass ? "PASS" : "FAIL"} D6: ${d6.note}`);

  report.pass = failures === 0;
  writeFileSync(REPORT, JSON.stringify(report, null, 2), "utf8");
  try {
    await browser.close();
  } catch {}
  console.log(`\n${failures === 0 ? "ALL GATES GREEN" : failures + " FAILURES"} — report: ${REPORT}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("probe crashed:", err);
  process.exit(1);
});
