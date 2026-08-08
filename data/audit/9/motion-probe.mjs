/**
 * data/audit/9/motion-probe.mjs — stage-9 motion audit probe (timing domain).
 *
 * Renders the 7 owned components (Statement, HeroNumber, TermDefine,
 * Relation, ImageBeat, Contrast, ListItem) as standalone Remotion
 * compositions — shorts + longform — through the same fromBeats → compile
 * pipeline the renderer uses, then verifies the claim-card gates:
 *
 *   G1   settled headline: DOM rect == compiled rect (±0.5), opacity 1,
 *        scale 1, translate none (all 7 archetypes, hold frame)
 *   G2a  HERO numeral counter reads "47" at hold (A2 raised floor)
 *   G2b  HERO headline text == compiled headline text ("47%")
 *   G3   HERO numeral style: fs 220 / w800 / accent color
 *   G4   HERO numeral optically centred on the stage (468, 666 shortform)
 *   G5   TERM rule scaleX ∈ (0,1) at tA+9 (mid-draw), icon settled
 *   G6a  LIST at f18: chips 0-2 arrived, all three in flight (POP + staggered shift)
 *   G6c  LIST at f28: 5 chips in DOM, oldest (Alpha) mid-drop fade
 *   G6b  LIST at f45: drop done — 4 chips settled, bottom-anchored, first = Beta/15
 *   img-push IMAGE at f30: image scale > 1.0 (spring push mid-run)
 *   G1   IMAGE at f70: settled (push done at 66)
 *   C17  pixel-identity (stage+headline region): TERM 29/30, RELATION 60/61
 *        and 70/71 — decoded via png-identity.mjs (no pngjs dependency)
 *
 * Gate frames are composition-relative (beat starts at 0; tA = 10 =
 * anchorFrame 310 − startFrame 300, matching compile's beat-relative
 * anchorFrame map and the live renderer's tA).
 *
 * Exit 0 = all gates green, 1 = any failure. Report → motion-report.json.
 */
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
import { pngRegionDiff } from "./png-identity.mjs";

// ── CONFIG ────────────────────────────────────────────────────────────────

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUBLIC_DIR = "src/skills/remotion-render/public";
const ENTRY = "src/skills/remotion-render/_motion-entry.jsx";
const OUT_DIR = "data/audit/9/out/";
const REPORT = "data/audit/9/motion-report.json";
const DUR = 90;
const FPS = 30;
const START = 300; // wallclock beat start (stage-8 convention)
const ANCHOR = 310; // wallclock anchor
const tA = ANCHOR - START; // beat-relative anchor = 10 (compile anchorFrame map)

// Probe palette → derived roles object (rolesFromPalette passthrough shape).
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

// SCHEDULE/C17 identify compositions by slug ("hero", "term", ...); beat ids
// are single letters ("h", "t", ...). Map them once.
const RUN_SLUG = { h: "hero", t: "term", l: "list", c: "contrast", r: "relation", i: "image", s: "statement" };

// Scene headlines — carried on each beat as `beat.scene` (fromBeats reads
// beat.scene.headline, NOT fromOpts.scene — sceneOr()/heroNumberHeadline();
// LIST has no headline producer, so its headline stays null → no layer).
const SCENE = {
  h: { headline: "47%", unit: "%" },
  t: { headline: "Inflation", term: "inflation" },
  l: { headline: null, items: LIST_ITEMS },
  c: { headline: "47%" },
  r: { headline: "DRIVES INFLATION" },
  i: { headline: "ALAMEDA COURT" },
  s: { headline: "Views are earned" }, // ≤16 chars → 1 line at fs 84 in the 840px shorts slot
};

// ── FIXTURES (one beat per owned archetype; LIST carries 5 items) ──────────

const FIX = [
  {
    id: "h",
    archetype: "HERO_NUMBER",
    anchorTokenIndex: 3,
    text: "Rates grew from 12% to 47%", // caption = beat.text (captionLayer); ≤26 chars keeps a 1-line longform caption
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
    text: "Inflation: prices rise", // caption = beat.text; ≤26 chars → 1-line longform caption
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
];

// Component props from the fixture beat (claim 9-01 archetypeProps).
function archetypeProps(beat) {
  switch (beat.archetype) {
    case "HERO_NUMBER":
      return { value: beat.data.value, unit: beat.data.unit };
    case "TERM_DEFINE":
      return { icon: "lightbulb" }; // "info" absent from the vendored icon set
    case "LIST_ITEM":
      return { items: LIST_ITEMS, icon: "activity" }; // "pulse" absent; activity is the pulse waveform
    case "CONTRAST":
      return { before: beat.data.before, after: beat.data.after, unit: "%" };
    case "RELATION":
      return { left: beat.data.left, right: beat.data.right, relation: beat.data.relation };
    case "IMAGE_BEAT":
      return { src: beat.data.image, credit: beat.data.credit };
    case "STATEMENT":
      return { icon: beat.data.icon };
    default:
      return {};
  }
}

// ── BUILD INPUTS ───────────────────────────────────────────────────────────
// Mirrors data/audit/9/contract-probe.mjs buildInputs exactly: ONE fromBeats
// call over all 7 beats (spec ids s0b0..s0b6 — single-beat arrays would be
// renamed s0b0 and trip the ENC-18/ENC-01 archetype-mix guards), then a
// per-layer fonts/measured map and a per-spec anchorFrame map keyed by the
// SPEC id (compile's textRect needs fonts[`${spec.id}:${i}`] + measured, and
// headline entrances resolve from anchorFrame[spec.id] + the atFrame offset).

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
    fromVersion: "fromBeats-9",
  };
  const specs = fromBeats(FIX, fromOpts); // ids s0b0..s0b6, FIX order preserved
  validateShotSpecs(specs);
  const fontFamily = "Inter";
  const fonts = {};
  const measured = {};
  const anchorFrame = {};
  specs.forEach((spec, i) => {
    const beat = FIX[i]; // specs[i] ↔ FIX[i] — spec.id is s0b{i}, not beat.id
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
  const rects = frames[idx].rects; // frames[i] = { beatId: specs[i].id, rects }
  const layers = spec.layers || [];
  const motionOf = (role) => {
    const l = layers.find((x) => x.role === role);
    return l ? { enter: l.enter, exit: l.exit } : {};
  };
  // Components read rects.headline / rects.accent AND render rect.text — the
  // compiled rects carry no text, so it is attached here from the spec layer
  // content (same rendering as compile-lint's renderedTextForContent).
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
    rects: Object.fromEntries(wired.map((r) => [r.role, r])), // { headline, accent }
    compiled: {
      headline: wired.find((r) => r.role === "headline") ?? null,
      accent: wired.find((r) => r.role === "accent") ?? null,
      headlineText: headlineLayer ? headlineLayer.content.text ?? "" : "",
      layers,
    },
  };
}

// ── ENTRY TEMPLATE (written to ENTRY, bundled, rendered headlessly) ───────

function serializeEntry(wired) {
  const entry = `
import React from "react";
import { registerRoot, Composition, AbsoluteFill, useCurrentFrame } from "remotion";
import { HeroNumber } from "./beats/HeroNumber.jsx";
import { TermDefine } from "./beats/TermDefine.jsx";
import { ListItem } from "./beats/ListItem.jsx";
import { Contrast } from "./beats/Contrast.jsx";
import { Relation } from "./beats/Relation.jsx";
import { ImageBeat } from "./beats/ImageBeat.jsx";
import { Statement } from "./beats/Statement.jsx";

const WIRED = __WIRED__;

const COMPONENTS = {
  HERO_NUMBER: HeroNumber,
  TERM_DEFINE: TermDefine,
  LIST_ITEM: ListItem,
  CONTRAST: Contrast,
  RELATION: Relation,
  IMAGE_BEAT: ImageBeat,
  STATEMENT: Statement,
};

// Measures the committed DOM synchronously (forces layout) and logs one JSON
// row per [data-rect-id]/[data-role] element. Runs once on mount — the still
// frame is fixed, so one measurement per composition suffices. Coordinates
// are read relative to the [data-root] canvas (headless stills position the
// canvas ~1e6 px up the page; the offset is uniform, so relative is exact).
function Measure() {
  React.useEffect(() => {
    const root = document.querySelector("[data-root]");
    const rr = root ? root.getBoundingClientRect() : { x: 0, y: 0 };
    const rows = [];
    const seen = new Set();
    document.querySelectorAll("[data-rect-id], [data-role]").forEach((el) => {
      const id = el.getAttribute("data-rect-id") || "";
      const role = el.getAttribute("data-role") || "";
      const index = el.getAttribute("data-index");
      const side = el.getAttribute("data-side") || "";
      const key = id + "::" + role + "::" + index + "::" + side; // chips share id/role; index disambiguates (NOTE: no backticks — this line lives inside the entry template literal)
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
    console.log("MOTION_MEASURE:" + JSON.stringify(rows));
    // G3: computed numeral style (fontSize/fontWeight/color) — one extra row.
    const numeral = document.querySelector('[data-role="numeral"]');
    if (numeral) {
      const ns = getComputedStyle(numeral);
      console.log(
        "MOTION_MEASURE:" +
          JSON.stringify([
            {
              role: "numeral-style",
              fontSize: ns.fontSize,
              fontWeight: ns.fontWeight,
              color: ns.color,
            },
          ])
      );
    }
  }, []);
  return null;
}

function Beat({ beat }) {
  const frame = useCurrentFrame();
  const C = COMPONENTS[beat.archetype];
  return (
    <AbsoluteFill data-root style={{ backgroundColor: beat.colors.bg }}>
      <C
        rects={beat.rects}
        stage={beat.stage}
        colors={beat.colors}
        anchorFrame={beat.anchorFrame}
        frame={frame}
        {...beat.props}
      />
      <Measure />
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

// "Settled" = at rest: opacity 1, scale 1, no px translate. Percentage
// translates (-50% -50%) are the primitives' permanent centering offset, not
// motion, so they count as settled too.
const settled = (m) =>
  m &&
  m.opacity >= 0.999 &&
  (m.scale === "none" || m.scale === "1" || (m.scale !== null && parseFloat(m.scale) === 1)) &&
  (m.translate === "none" ||
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
  const close = Math.abs(h.x - c.x) <= 0.5 && Math.abs(h.y - c.y) <= 0.5 && Math.abs(h.w - c.w) <= 0.5 && Math.abs(h.h - c.h) <= 0.5;
  return {
    pass: close && settled(h),
    note: `dom ${h.x.toFixed(1)},${h.y.toFixed(1)} ${h.w.toFixed(1)}x${h.h.toFixed(1)} op=${h.opacity} sc=${h.scale} tr=${h.translate} vs compiled ${c.x},${c.y} ${c.w}x${c.h}`,
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

function gateG3(rows) {
  const n = byRole(rows, "numeral");
  if (!n) return { pass: false, note: "no numeral" };
  // computed fontSize/color are read from the row's style by the measure fn
  // (fontSize/color added below in the probe) — see gateG3Style.
  return gateG3Style(rows, n);
}

function gateG4(rows, w) {
  const n = byRole(rows, "numeral");
  if (!n) return { pass: false, note: "no numeral" };
  const cx = w.stage.x + w.stage.w / 2;
  const cy = w.stage.y + w.stage.h / 2;
  const nx = n.x + n.w / 2;
  const ny = n.y + n.h / 2;
  return {
    pass: Math.abs(nx - cx) <= 1 && Math.abs(ny - cy) <= 1,
    note: `numeral centre (${nx.toFixed(1)}, ${ny.toFixed(1)}) vs stage (${cx}, ${cy})`,
  };
}

function gateG5(rows) {
  const rule = byRole(rows, "rule");
  const icon = byRole(rows, "icon");
  if (!rule || !icon) return { pass: false, note: `rule=${!!rule} icon=${!!icon}` };
  const sx = parseFloat(rule.scale); // "0.58 1" → 0.58
  return {
    pass: sx > 0 && sx < 1 && settled(icon),
    note: `rule scaleX=${rule.scale} (${sx}) icon op=${icon.opacity} sc=${icon.scale} tr=${icon.translate}`,
  };
}

function gateG6a(rows) {
  // f18 (A4 item stagger 5): chips 0-2 arrived (entrances 6/11/16). Chip 2 is
  // mid-POP (16-25), chips 0/1 are mid-shift (shift starts 2 f after the
  // newcomer's POP + 2 f per-chip stagger — chip 1's for Gamma starts at 18,
  // chip 0's at 20) → all three in flight.
  const cs = chips(rows);
  if (cs.length !== 3) return { pass: false, note: `chip count ${cs.length}` };
  const allInFlight = cs.every(inFlight);
  return {
    pass: allInFlight,
    note: `inFlight=${allInFlight} ` + cs.map((c, i) => `c${i} op=${c.opacity} sc=${c.scale} tr=${c.translate}`).join(" "),
  };
}

function gateG6b(rows, w) {
  // f45 (drop complete): the 5th chip arrived at 26 and dropped chip 0 at
  // 32 → exactly 4 chips remain (Beta..Epsilon), all settled, bottom-anchored
  // at the stage bottom (restTop = stageBottom − 3·88 − 88). f45 not f40:
  // Beta's last shift (for Epsilon, entrance 26) starts at 32 (26+2 drag +
  // 4 stagger) and runs 9 f → done at 41.
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
  // f28 (mid-drop): all 5 chips in the DOM; the oldest (Alpha) is mid-drop
  // fade (opacity < 1, E_IN over D.short from dropStart 26) while the 4
  // remaining chips are present.
  const cs = chips(rows);
  if (cs.length !== 5) return { pass: false, note: `chip count ${cs.length}` };
  const oldest = cs[0];
  return {
    pass: oldest.dtext === "Alpha" && oldest.opacity < 0.999 && inFlight(oldest),
    note: `oldest ${oldest.dtext} op=${oldest.opacity} tr=${oldest.translate} (drop fade in progress)`,
  };
}

function gateImagePush(rows) {
  // f30 (mid-push): image fade 9 f from tA−4=6 is done (opacity 1) but the
  // 1.05→1.00 spring push over D.push runs to tA+56=66 → scale must still
  // be > 1.0.
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

function parseMeasures(logs) {
  const rows = [];
  for (const log of logs) {
    const line = typeof log === "string" ? log : String(log && log.text ? log.text : log);
    if (line.includes("MOTION_MEASURE:")) {
      try {
        const json = line.slice(line.indexOf("MOTION_MEASURE:") + "MOTION_MEASURE:".length);
        const arr = JSON.parse(json);
        if (Array.isArray(arr)) rows.push(...arr);
      } catch {
        /* ignore malformed */
      }
    }
  }
  return rows;
}

// GATE SCHEDULE: run → frames → gates. (G2a at f70: the numeral counter
// ramps from tA−4 over D.push=60, so it reads "47" from frame tA+56=66 on.
// LIST items arrive per A4 "stagger 5" (anchors 10,15,20,25,30 → entrances
// tA−4 = 6,11,16,21,26): G6a@18 = 3 chips in flight, G6c@28 = 5 chips with
// the oldest mid-drop fade, G6b@45 = 4 chips settled + bottom-anchored
// (Beta's last shift — for Epsilon at 26 — starts 26+2+4 = 32, done 41).
// IMAGE fade 9f from tA−4=6, push 1.05→1.00 over D.push runs to tA+56=66:
// image-push@30 asserts scale > 1.0 mid-run, G1@70 asserts settled.)
const SCHEDULE = [
  { run: "hero", frame: 55, gates: ["G1", "G2b", "G3", "G4"] },
  { run: "hero", frame: 70, gates: ["G2a"] },
  { run: "term", frame: 19, gates: ["G5"] },
  { run: "term", frame: 55, gates: ["G1", "G2b"] },
  { run: "list", frame: 18, gates: ["G6a"] },
  { run: "list", frame: 28, gates: ["G6c"] },
  { run: "list", frame: 45, gates: ["G6b"] },
  { run: "contrast", frame: 55, gates: ["G1"] },
  { run: "relation", frame: 32, gates: ["mid-rise"] },
  { run: "relation", frame: 33, gates: ["mid-rise"] },
  { run: "relation", frame: 55, gates: ["G1"] },
  { run: "image", frame: 30, gates: ["image-push"] },
  { run: "image", frame: 70, gates: ["G1"] },
  { run: "statement", frame: 55, gates: ["G1"] },
];

const C17_PAIRS = [
  { run: "term", a: 29, b: 30 },
  { run: "relation", a: 60, b: 61 },
  { run: "relation", a: 70, b: 71 },
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
    entryPoint: resolve(ENTRY), // plain absolute path — the bundler path.resolve()s it (a file:// URL gets mangled on Windows)
    publicDir: PUBLIC_DIR,
    onProgress: () => {},
  });
  console.log("serveUrl:", serveUrl);

  const browser = await openBrowser(CHROME);
  const report = { tA, gates: [], c17: [], stills: [] };
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
    const rows = parseMeasures(logs);
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
    G3: (rows) => gateG3(rows),
    G4: (rows, w) => gateG4(rows, w),
    G5: (rows) => gateG5(rows),
    G6a: (rows) => gateG6a(rows),
    G6b: (rows, w) => gateG6b(rows, w),
    G6c: (rows) => gateG6c(rows),
    "image-push": (rows) => gateImagePush(rows),
    "mid-rise": (rows) => gateMidRise(rows),
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

  // C17 — pixel-identity pairs (shorts + longform). The pair frames are not
  // covered by the gate loop, so render both stills here first.
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

  report.pass = failures === 0;
  writeFileSync(REPORT, JSON.stringify(report, null, 2), "utf8");
  try {
    await browser.close();
  } catch {}
  console.log(`\n${failures === 0 ? "ALL GATES GREEN" : failures + " FAILURES"} — report: ${REPORT}`);
  process.exit(failures === 0 ? 0 : 1);
}

// G3 needs computed style values — extend the measure row capture at render
// time: patch gateG3Style to read fontSize/fontWeight/color from a second
// dedicated log line (numeral style). We capture these in the entry instead.
function gateG3Style(rows, n) {
  // The entry logs numeral style in a "MOTION_STYLE:" line parsed into rows
  // with role "numeral-style" — fall back to the row if present.
  const s = byRole(rows, "numeral-style");
  if (!s) return { pass: false, note: "numeral style row missing" };
  const fs = parseFloat(s.fontSize);
  const fw = s.fontWeight;
  const col = s.color;
  return {
    pass: fs === 220 && fw === "800" && col === "rgb(34, 211, 238)",
    note: `fs=${s.fontSize} fw=${s.fontWeight} color=${s.color}`,
  };
}

main().catch((err) => {
  console.error("probe crashed:", err);
  process.exit(1);
});
