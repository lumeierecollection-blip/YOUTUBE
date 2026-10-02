/**
 * CanvasVideo — full-canvas editorial motion graphics (owner's rebuild,
 * 2026-09-29). There is no paper and no card: every beat is composed for
 * the whole 1080x1920 frame on uniform white (backgrounds.js GROUND: one
 * solid colour on every beat, no shadows, tint or dark beats; a full-bleed
 * photo covers it for its own beat), on a 3x4 grid,
 * asymmetrically (canvas-layout.js). Type is one of four roles
 * (typography.js): a Fraunces headline, an oversized Fraunces numeral, an
 * Inter data label, and — once a video at most — one emphasis word.
 *
 *   TYPE-FULL     the statement, or one hero number with its label
 *   DATA-FULL     bars / donut / line / gauge / map filling the canvas
 *   SCENE-FULL    a real photo edge to edge (objectFit cover), type over it
 *   PROCESS-FULL  2-3 nodes, thick arrows drawing between them
 *
 * Motion has two axes.
 * Tier (beat.canvas.motion_tier), how much the FRAME moves:
 *   micro   ALWAYS: studio shadows drift, grain re-seeds every frame, type
 *           breathes 0.5%, numbers keep a small oscillation AFTER they land
 *           (their position, never their value: a displayed figure is always
 *           the sourced one)
 *   medium  once per beat: bars grow, photo pushes in, arrows draw, the donut
 *           sweeps, nodes connect. A "micro" beat builds its shapes faster.
 *   major   2-3 per video: full-canvas zoom 1.0 -> 1.15 (TYPE-FULL; the words
 *           still pop in place), the photo expanding from a small circle to
 *           the whole frame (SCENE-FULL), or the chart composition rotating
 *           in across the boundary (its header is outside the rotation).
 * Text entrances — the POP family only (kinetic.js, owner's spec
 * 2026-09-30). Every piece of text appears IN PLACE from a smaller scale and
 * settles; nothing slides in, drops in, wipes, blurs in, types on or fades in:
 *   headline  word by word, 4-6 frames apart: POP_STANDARD, the emphasis
 *             word POP_EMPHASIS; the hook / CTA POP_HARD; one beat a video
 *             may be POP_LETTER, a short statement POP_WORD_STACK
 *   number    pops fully formed 1.3 -> 1.0 (8 frames), then a quantity's
 *             digit slots roll 0 -> value (20 frames); a year / identifier
 *             only pops
 *   data      labels, kickers, chart labels, captions: POP_SOFT
 *   emphasis  the one-word beat: POP_EMPHASIS
 * Beat transitions never carry the incoming beat's text in: the header is
 * drawn outside the transition layer and pops once the outgoing beat is gone.
 *
 * Camera through information (beat.canvas.camera_focus): each focus event
 * {at_percent, target} moves the camera over 0.7 s to frame that element
 * (canvas-layout.js focusBox). No focus events: one slow push across the
 * beat.
 *
 * Continuity: a beat with persists_from / match_cut_prev keeps the previous
 * beat's hero element across the 0.5 s boundary — match cut: the new hero
 * starts exactly where the old one was and settles into its own place while
 * the rest of the frame changes; persisted: the old hero also stays visible,
 * moving and scaling into the new hero's box as it fades (a FLIP morph).
 * Where this stops: the morph moves and scales the element's box; it does
 * not re-draw one chart type's geometry as another (bars are not bent into
 * a donut ring, they cross-fade into it while moving).
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { StudioBG } from "./studio-bg.jsx";
import { KineticText } from "./kinetic.jsx";
import { countProgress, numberPop, numberRoll, digitRoll, popState, NUMBER_POP_FRAMES } from "./kinetic.js";
import { GROUND } from "./backgrounds.js";
import { parseQuantity, rollQuantity } from "./primitives/quantity.js";
import { PaperMap, CenteredMap } from "./primitives/map.jsx";
import { Symbol } from "./symbols/index.jsx";
import {
  animationById, entrance, exitState, unitOf, entranceSeconds, STAGGER, numberState, rollOffset, countValue, barState, pieState, lineState,
} from "./animations.js";
import {
  FRAME, CAPTION, CAPTION_R, INK, INK_SOFT, MID, LIGHT, STUDIO, DARK_BG, SANS, TRANSITION_SEC,
  canvasLayout, focusBox, textWidth, normalizeCanvas, liftAccent, L_EDGE, R_EDGE,
  TOP, BOTTOM, ZONES, ZONE_TOL, flattenBoxes, elementType, zonesOf,
} from "./canvas-layout.js";
import {
  ROLE_HEADLINE, ROLE_NUMBER, ROLE_DATA, ROLE_EMPHASIS, SERIF, SANS_STACK, roleFont, roleTracking, numberSlots, measure,
  SUPERSCRIPT_SCALE, capHeightEm,
} from "./typography.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const Hero = React.createContext(null);
// The colours a beat's text and chart furniture are drawn in. A dark beat
// (texture layer) swaps them; a photo beat draws white on the picture.
const Theme = React.createContext({ ink: INK, soft: INK_SOFT, mid: MID, track: LIGHT, dark: false, photo: false });
const useTheme = () => React.useContext(Theme);
// The beat's animation choices (animation-plan.js): { headline, number, label, chart, exit, dur } or null (the pre-rebuild motion).
const Anim = React.createContext(null);
const useAnim = () => React.useContext(Anim);

/** entrance() state -> CSS. */
function styleOf(e, origin) {
  const t = [];
  if (e.dx || e.dy) t.push(`translate(${e.dx.toFixed(1)}px, ${e.dy.toFixed(1)}px)`);
  if (e.rot) t.push(`rotate(${e.rot.toFixed(2)}deg)`);
  if (e.s !== 1) t.push(`scale(${e.s.toFixed(4)})`);
  return { opacity: e.o, transform: t.join(" ") || "none", filter: e.blur > 0.2 ? `blur(${e.blur.toFixed(1)}px)` : "none", transformOrigin: origin };
}

/** A pop (kinetic.js popState) `f` frames in, as CSS on an HTML element. */
function popCss(style, f, origin = "50% 60%") {
  const p = popState(style, f);
  return { opacity: p.o, transform: `translateY(${p.dy.toFixed(2)}px) scale(${p.s.toFixed(4)})`, transformOrigin: origin };
}
/** The same pop as SVG attributes, scaling about (cx, cy). */
function popSvg(style, f, cx, cy) {
  const p = popState(style, f);
  return { opacity: p.o, transform: `translate(${cx.toFixed(1)} ${(cy + p.dy).toFixed(1)}) scale(${p.s.toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})` };
}

// ── motion helpers ────────────────────────────────────────────────────
function useMotion(c, local, dur, fps) {
  const tier = c.motion_tier || "medium";
  const s = (sec) => sec * fps;
  const build = (share = 0.4, delay = 0) => (tier === "micro" ? easeOut(clamp01((local - delay) / s(0.35))) : easeOut(clamp01((local - delay) / Math.max(1, dur * share))));
  const breathe = 1 + 0.005 * Math.sin((local / fps) * 2.1);
  const jitter = (k = 0) => Math.sin(local / fps * 7.3 + k) * 1.2;
  return { tier, s, build, breathe, jitter, fps, dur, local };
}

// Choreography, in fractions of the beat: a number enters first (0-0.4, counted
// / impacted / rolled over that window); its label types on word by word
// (0.4-0.5); the headline follows (0.5-0.85). With no number the headline
// takes 0-0.4 and the kicker / label types on 0.4-0.6. Never stacked, never
// simultaneous.
function timeline(c, B, dur, fps) {
  const sec = (f) => (f * dur) / fps;
  const hasNum = !!B.number;
  return { headlineAt: hasNum ? sec(0.5) : 0, numberAt: 0, labelAt: sec(0.4), splitAt: sec(0.3) };
}

// ── the four roles ────────────────────────────────────────────────────
const HEADLINE_MOTIONS = ROLE_HEADLINE.motions;
export const headlineMotionFor = (idx) => HEADLINE_MOTIONS[((idx % 3) + 3) % 3];

/**
 * ROLE_HEADLINE, kinetic: every word its own event (kinetic.jsx). Mixed
 * weight and colour per word; each word enters on its own frame with its own
 * entrance, the emphasis word grows, the phrase resolves by 40% of the beat,
 * holds, and exits word by word. `at` (s) is when the phrase starts.
 */
function Headline({ b, color, local, fps, m, idx, at = 0, shadow = false, halo = null, major = false, hero = false, accent = null }) {
  const A = useAnim();
  if (!b || !b.lines?.length) return null;
  const dur = A?.dur || m.dur || 90;
  const start = at * fps, startFrac = start / dur;
  const role = hero ? "statement" : "headline";
  const resolveBy = Math.min(0.8, startFrac + 0.4);
  // A header stays with its chart / list / photo until the cut; only a hero statement exits word by word.
  const box = (
    <KineticText b={b} color={color} accent={accent || A?.accent || color} local={local} dur={dur} start={start} resolveBy={resolveBy} exitAt={hero ? Math.min(0.92, Math.max(0.7, resolveBy + 0.1)) : 9}
      entrances={A?.kinetic?.entrances?.[role]} font={SERIF} lineHeight={b.size * ROLE_HEADLINE.lineHeight} tracking={roleTracking(ROLE_HEADLINE, b.size)}
      group="headline" edge={!!A?.kinetic?.edge} />
  );
  return hero ? <HeroEl name="statement" b={b}>{box}</HeroEl> : box;
}

/**
 * ROLE_DATA: Inter, uppercase label, typed on word by word (kinetic.jsx) from
 * `at` seconds; the label window is 20% of the beat, so it never overlaps the
 * number (0-0.4) it labels.
 */
function DataLabel({ b, color, local, fps, at = 0.5, shadow = false, name = null, accent = null }) {
  const A = useAnim();
  if (!b || !b.lines?.length) return null;
  const dur = A?.dur || 90;
  const start = at * fps, startFrac = start / dur;
  const role = name === "kicker" ? "kicker" : "label";
  return (
    <div style={{ textShadow: shadow ? "0 3px 16px rgba(0,0,0,0.6)" : "none" }}>
      <KineticText b={{ ...b, x: b.x, w: b.w, h: b.h || b.size * ROLE_DATA.lineHeight * b.lines.length }} color={color} accent={accent || A?.accent || color} local={local} dur={dur} start={start}
        resolveBy={Math.min(0.85, startFrac + 0.2)} exitAt={name ? Math.min(0.94, Math.max(0.7, startFrac + 0.3)) : 9} entrances={A?.kinetic?.entrances?.[role]} upper={!!b.upper}
        font={SANS_STACK} lineHeight={b.size * ROLE_DATA.lineHeight} tracking={roleTracking(ROLE_DATA, b.size)} baseWeight={b.weight || ROLE_DATA.weight} group="label" />
    </div>
  );
}
const idx0 = (A) => A?.beat ?? 0;

// The rolled numeric string of a quantity at fraction t: digits and its own
// separators, worded as the narration says it.
function rolledNumeric(q, t) {
  const v = q.num * clamp01(t);
  return q.comma ? v.toLocaleString("en-US", { minimumFractionDigits: q.dec, maximumFractionDigits: q.dec }) : v.toFixed(q.dec);
}

/**
 * ROLE_NUMBER: the hero numeral. Laid out in slots at the FINAL number's own
 * advances (numberSlots), so rolling never moves it. "$" is set at 0.5x
 * raised to the cap line, "M/B/K" at 0.59x on the baseline, "%" at 0.8x.
 * The whole figure POPS fully formed, 1.3 -> 1.0 over 8 frames with a slight
 * settle (kinetic.js numberPop); a quantity's digit slots then roll from 0 to
 * their digits over 20 frames, right-most first (an odometer; separators and
 * units stand from the start). A year or identifier (not a quantity) pops and
 * never rolls. `t` is unused (kept for the callers' signature).
 */
function NumberHero({ b, q, t, local, fps, at, color, m, hero = true, settled = true }) {
  const A = useAnim();
  const slots = numberSlots(b.parts, b.size).slots;
  const size = b.size;
  const capEm = capHeightEm(size >= ROLE_NUMBER.largeFrom ? "Fraunces" : "Inter");
  const B = size * 0.8;                        // baseline inside the box (box = cap line -0.1 em .. baseline +0.1 em)
  const base = 0.862;                          // baseline offset in a line-height:1 box, em
  const since = local - at * fps;
  if (since < 0) return null;
  const pop = numberPop(since);
  // A quantity rolls unless the plan says this figure only pops (SNAP_IN).
  const rolls = !!b.parts.isQuantity && !!q && A?.number !== "SNAP_IN";
  const rp = rolls ? numberRoll(since) : 1;
  const digitSlots = slots.map((s, i) => (s.kind === "digit" ? i : -1)).filter((i) => i >= 0);
  const glyphs = slots.map((s, i) => {
    const gf = `${ROLE_NUMBER.weight} ${s.size}px ${s.size >= ROLE_NUMBER.largeFrom ? SERIF : SANS_STACK}`;
    // Vertical: baseline of every glyph on B, except "$" (top on the cap line).
    const off = s.kind === "pre" ? capEm * (size - s.size) : 0;
    const top = B - base * s.size - off;
    if (rolls && rp < 1 && s.kind === "digit") {
      // An odometer wheel: this slot turns 0 -> its digit, right-most first.
      const di = digitSlots.indexOf(i), kr = digitSlots.length - 1 - di, target = Number(s.ch) || 0;
      const v = digitRoll(rp, kr, target), fl = Math.floor(v), fr = v - fl;
      const cell = (n, y) => <span style={{ position: "absolute", left: 0, top: y * s.size, width: "100%", height: s.size, lineHeight: 1, textAlign: "center" }}>{n}</span>;
      // The wheel's window ends at the number box's bottom (+1% overshoot):
      // a full-em window showed the next digit sliding up BELOW the box,
      // across the zone edge (CI run 36947929123 ch-26 "42%": ink to y 1382).
      const winH = Math.max(0, Math.min(s.size, b.h + size * 0.01 - top));
      return (
        <span key={i} style={{ position: "absolute", left: s.x, top, width: s.w, height: winH, overflow: "hidden", font: gf, fontOpticalSizing: "auto", letterSpacing: 0, color }}>
          {cell(fl % 10, -fr)}{cell((fl + 1) % 10, 1 - fr)}
        </span>
      );
    }
    return (
      <span key={i} style={{ position: "absolute", left: s.x, top, width: s.w, height: s.size, lineHeight: 1, textAlign: "center", whiteSpace: "nowrap",
        font: gf, fontOpticalSizing: "auto", letterSpacing: 0, color }}>{s.ch}</span>
    );
  });
  const osc = rp >= 1 && pop.done && settled ? m.jitter() : 0;           // micro: position only, never the value
  const wrap = (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, opacity: pop.o,
      transform: `translateY(${Math.min(0, osc).toFixed(2)}px) scale(${(pop.s * m.breathe).toFixed(4)})`,
      // From the BOTTOM edge: the pop (1.3 -> 1.0) and the breathe grow the
      // figure upward, never below a box that sits on a zone's edge.
      transformOrigin: b.align === "right" ? "right bottom" : "left bottom" }}>
      {glyphs}
    </div>
  );
  return hero ? <HeroEl name="number" b={b}>{wrap}</HeroEl> : wrap;
}

/** ROLE_EMPHASIS: one word, popping with POP_EMPHASIS (0.75 -> 1.08 -> 1.0 over 10 frames), in place. */
function Emphasis({ b, color, local, fps }) {
  if (!b) return null;
  return (
    <HeroEl name="emphasis" b={b}>
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, font: roleFont(ROLE_EMPHASIS, b.size), lineHeight: `${b.h}px`, letterSpacing: roleTracking(ROLE_EMPHASIS, b.size),
        color, whiteSpace: "nowrap", textAlign: b.align, fontOpticalSizing: "auto", ...popCss("POP_EMPHASIS", local, b.align === "right" ? "right center" : "left center") }}>{b.text}</div>
    </HeroEl>
  );
}

// A rule grows from its anchored side (left, or right when the beat is right-anchored).
const Rule = ({ b, t, color }) => {
  if (!b || t <= 0) return null;
  const w = b.w * t;
  return <div style={{ position: "absolute", left: b.x + (b.anchor === "right" ? b.w - w : 0), top: b.y, width: w, height: b.h, backgroundColor: color }} />;
};

// The header every composition with a compact top shares: the hairline rule,
// the lead-in / folio as a small data label, the headline. Pinned outside the
// camera, so a push or a major zoom never crops it.
function HeaderBlock({ B, th, local, fps, m, idx, tl, halo = null }) {
  return (
    <>
      <Rule b={B.rule} t={m.build(0.3, m.s(0.1))} color={th.ink} />
      {B.kicker ? <DataLabel b={B.kicker} name="kicker" color={th.ink} local={local} fps={fps} at={tl.labelAt} /> : null}
      {B.headline ? <Headline b={B.headline} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={tl.headlineAt} halo={halo} /> : null}
    </>
  );
}

// ── TYPE-FULL ─────────────────────────────────────────────────────────
function TypeFull({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  const major = m.tier === "major";
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  if (B.number) {
    const q = parseQuantity(c.data?.value);
    const count = countProgress(local, dur, tl.numberAt * fps);
    const numColor = c.number_accent === false ? th.ink : accent;
    return (
      <>
        <NumberHero b={B.number} q={q} t={count} local={local} fps={fps} at={tl.numberAt} color={numColor} m={m} />
        {B.label ? <DataLabel b={B.label} name="label" color={th.ink} local={local} fps={fps} at={tl.labelAt} /> : null}
      </>
    );
  }
  if (B.emphasis) return <Emphasis b={B.emphasis} color={th.ink} local={local} fps={fps} />;
  const st = B.statement;
  if (st.rotate) {
    // The one vertical beat of a video (retired: canvas-style.js never sets
    // it now): the statement rotated along the left edge, popping in place.
    const p = popState("POP_STANDARD", local);
    return (
      <HeroEl name="statement" b={st}>
        <div style={{ position: "absolute", left: st.x, top: st.y, width: st.w, height: st.h }}>
          <div style={{ position: "absolute", left: 0, top: st.h, width: st.textW + 8, height: st.w, transformOrigin: "0 0", transform: `rotate(-90deg) translateY(${p.dy.toFixed(2)}px) scale(${p.s.toFixed(4)})`, opacity: p.o,
            font: roleFont(ROLE_HEADLINE, st.size), lineHeight: `${st.w}px`, letterSpacing: roleTracking(ROLE_HEADLINE, st.size), color: th.ink, whiteSpace: "nowrap" }}>{st.lines[0]}</div>
        </div>
      </HeroEl>
    );
  }
  // Concept visuals (canvas-layout.js TYPE-FULL with concept_visuals): the
  // statement in the top zone, the cutouts / symbols in the middle zone.
  if (B.cutout0) {
    return (
      <>
        <Headline b={st} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={tl.headlineAt} major={major} hero accent={accent} />
        {[B.cutout0, B.cutout1, B.cutout2].filter(Boolean).map((v, i) => (
          <ConceptVisual key={i} b={v} local={local} fps={fps} at={tl.headlineAt + 0.45 + i * 0.12} accent={accent} />
        ))}
      </>
    );
  }
  // TYPE-SPLIT: the second half lands 0.5 s after the first (the header's headline).
  return <Headline b={st} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={B.headline ? tl.splitAt : tl.headlineAt} major={major} hero accent={accent} />;
}

/**
 * One concept visual in its layout box (concept-visuals.js): a CUTOUT is the
 * verified PNG (public/cutouts/), contained in the box, with a soft drop
 * shadow (2 px, 20 px blur, 0.15); a SYMBOL is the drawn SVG in the channel
 * accent (no shadow — symbols are flat by design). Both pop in place (the
 * pop family, kinetic.js POP_STANDARD) from the bottom edge they stand on.
 */
function ConceptVisual({ b, local, fps, at, accent }) {
  const pop = popCss("POP_STANDARD", local - Math.round(at * fps), "50% 100%");
  if (b.class === "cutout" && b.asset) {
    return (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, ...pop }}>
        <Img src={staticFile(b.asset)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: b.align === "right" ? "100% 100%" : "0% 100%",
          filter: "drop-shadow(2px 2px 20px rgba(0,0,0,0.15))" }} />
      </div>
    );
  }
  if (b.class === "symbol") {
    const s = Math.min(b.w, b.h);
    return (
      <div style={{ position: "absolute", left: b.x, top: b.y + b.h - s, width: s, height: s, ...pop }}>
        <Symbol name={b.concept} size={s} color={accent} />
      </div>
    );
  }
  return null;
}

// ── DATA-FULL ─────────────────────────────────────────────────────────
// ROLE_DATA in a chart: small uppercase Inter labels; figures beside bars in
// Inter (ROLE_NUMBER below 100 px).
const dataFont = (size, w = 600) => `${w} ${size}px ${SANS_STACK}`;

function DataFull({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, vt = String(c.visual_type).toUpperCase(), d = c.data || {}, tl = timeline(c, B, dur, fps);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  let chart = null;
  const ch = B.chart;
  // The donut / gauge arc sweeps with its percentage: the figure pops, then
  // rolls 0 -> value over 20 frames (kinetic.js numberRoll), and the arc
  // follows that same roll.
  const count = numberRoll(local - tl.numberAt * fps);
  // The chart's animation (animations.js): BAR_GROW / PIE_SWEEP / LINE_DRAW are the pre-rebuild motions, drawn by the original code below; the others by
  // barState / pieState / lineState. tb = the chart's own build progress 0..1 (micro beats build faster).
  const A = useAnim();
  const cid = A?.chart || null;
  const modern = !!cid && !["BAR_GROW", "PIE_SWEEP", "LINE_DRAW"].includes(cid);
  const tb = cid ? clamp01((local - 0.15 * fps) / ((animationById(cid)?.dur || 1) * fps * (m.tier === "micro" ? 0.6 : 1))) : 0;
  const sec = local / fps;
  const chartClip = modern ? `inset(${Math.max(0, ch.y - 44)}px 0 ${Math.max(0, FRAME.h - (ch.y + ch.h))}px 0)` : "none";
  if (vt === "BAR") {
    const bars = (d.bars || []).map((b) => ({ ...b, q: parseQuantity(b.value) })).filter((b) => b.q);
    const max = Math.max(...bars.map((b) => b.q.magnitude)) || 1;
    const primary = bars.reduce((a, b, i) => (b.q.magnitude > bars[a].q.magnitude ? i : a), 0);
    const stOf = (i) => (modern ? barState(cid, tb, i, bars.length, { primary, sec }) : null);
    const tOf = (i, st) => (st ? clamp01(st.grow) : m.build(0.45, i * (ch.orient === "h" ? 4 : 5)));
    // The frame bar i starts to grow: its figure and label pop there, at
    // their FINAL places, outside the bar's own motion (a bar that drops or
    // pulses in never carries its text with it). The figure then rolls with
    // the bar, so the drawn length and the shown value always agree.
    const growAt = (i) => {
      for (let f = 0; f <= dur; f++) {
        const g = modern ? barState(cid, clamp01((f - 0.15 * fps) / ((animationById(cid)?.dur || 1) * fps * (m.tier === "micro" ? 0.6 : 1))), i, bars.length, { primary, sec: f / fps }).grow
          : easeOut(clamp01((f - i * (ch.orient === "h" ? 4 : 5)) / (m.tier === "micro" ? m.s(0.35) : Math.max(1, dur * 0.45))));
        if (g > 0.001) return f;
      }
      return dur;
    };
    if (ch.orient === "h") {
      const row = ch.h / Math.max(1, bars.length), th2 = row * 0.42;
      const Wfull = (ch.w - 40);
      chart = (
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0, clipPath: chartClip }}>
          {bars.map((b, i) => {
            const st = stOf(i), t = tOf(i, st);
            const y = ch.y + row * i + row * 0.36;
            const wFinal = (b.q.magnitude / max) * Wfull;
            const w = Math.max(6, wFinal * (st ? Math.min(st.grow, 1.1) : t));
            const bx = st && st.from === "center" ? ch.x + wFinal / 2 - w / 2 : ch.x;
            const lsz = Math.min(ROLE_DATA.sizeBand[1] - 6, Math.floor(ch.w / Math.max(1, String(b.label).length * 0.62)));
            // The figure's final place: past the finished bar's end, or inside
            // its end when the bar runs to the edge — ink until the growing bar
            // reaches it, then on the bar.
            const inside = ch.x + wFinal + 18 > ch.x + ch.w - 200;
            const vx = Math.min(ch.x + wFinal + 18, ch.x + ch.w - 10), vy = y + th2 * 0.72, vsz = Math.round(th2 * 0.55);
            const covered = inside && bx + w >= vx - 4;
            const cx = ch.x + w / 2, cy = y + th2;
            const g0 = local - growAt(i);
            return (
              <React.Fragment key={i}>
                <g opacity={st ? st.o : 1} transform={st ? `translate(0 ${(st.dy * 0.4).toFixed(1)}) translate(${cx} ${cy}) scale(${st.pulse.toFixed(4)}) translate(${-cx} ${-cy})` : undefined}>
                  <rect x={bx} y={y} width={w} height={th2} fill={i === primary ? accent : th.mid} />
                </g>
                <text x={ch.x} y={y - 18} style={{ font: dataFont(Math.max(24, lsz)), letterSpacing: 0.4 }} fill={th.ink} {...popSvg("POP_SOFT", g0, ch.x, y - 18 - lsz * 0.35)}>{String(b.label).toUpperCase()}</text>
                <text x={vx} y={vy} textAnchor={inside ? "end" : "start"} {...popSvg("NUMBER", g0, inside ? vx - vsz : vx + vsz, vy - vsz * 0.35)}
                  style={{ font: dataFont(vsz, 800), letterSpacing: -1 }} fill={covered ? (th.dark ? "#0E0E0E" : "#fff") : th.ink}>{rollQuantity(b.q, t)}</text>
              </React.Fragment>
            );
          })}
          {modern && cid === "BAR_COMPARE" ? (() => {
            const r = stOf(primary).ref;
            return <line x1={ch.x + (bars[primary].q.magnitude / max) * Wfull} y1={ch.y} x2={ch.x + (bars[primary].q.magnitude / max) * Wfull} y2={ch.y + ch.h * r} stroke={th.ink} strokeWidth={4} strokeDasharray="14 12" opacity={0.7} />;
          })() : null}
        </svg>
      );
    } else {
      // plotTop: room above the tallest bar for its value label inside the
      // chart box (at +70 the "50%" over the tallest bar rose through y 620
      // into the headline's zone — QA render 2026-10-02).
      const base = ch.baseline, plotTop = ch.y + 120, plotH = base - plotTop;
      const slot = ch.w / bars.length, bw = Math.min(300, slot * 0.64);
      chart = (
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0, clipPath: chartClip }}>
          <line x1={ch.x} y1={base} x2={ch.x + ch.w} y2={base} stroke={th.ink} strokeWidth={4} />
          {bars.map((b, i) => {
            const st = stOf(i), t = tOf(i, st);
            const Hf = (b.q.magnitude / max) * plotH;
            const h = Math.max(4, Hf * (st ? Math.min(st.grow, 1.1) : t));
            const x = ch.x + slot * i + (slot - bw) / 2;
            const yTop = st && st.from === "center" ? base - Hf / 2 - h / 2 : base - h;
            const vs = Math.min(96, Math.floor((slot * 0.96) / Math.max(1, rollQuantity(b.q, 1).length * 0.6)));
            const ls = Math.min(ROLE_DATA.sizeBand[1] - 6, Math.floor((slot * 0.96) / Math.max(1, String(b.label).length * 0.66)));
            const cx = x + bw / 2;
            // Figure and label pop at their final places (above the finished
            // bar / under the baseline), outside the bar's own motion.
            const vy = base - Hf - 22;
            const g0 = local - growAt(i);
            return (
              <React.Fragment key={i}>
                <g opacity={st ? st.o : 1} transform={st ? `translate(0 ${st.dy.toFixed(1)}) translate(${cx} ${base}) scale(${st.pulse.toFixed(4)}) translate(${-cx} ${-base})` : undefined}>
                  <rect x={x} y={yTop} width={bw} height={h} fill={i === primary ? accent : th.mid} />
                </g>
                <text x={cx} y={vy + (t >= 1 ? m.jitter(i) : 0)} textAnchor="middle" style={{ font: dataFont(vs, 800), letterSpacing: -vs * 0.03 }} fill={th.ink}
                  {...popSvg("NUMBER", g0, cx, vy - vs * 0.35)}>{rollQuantity(b.q, t)}</text>
                <text x={cx} y={base + 50} textAnchor="middle" style={{ font: dataFont(Math.max(24, ls)), letterSpacing: 0.4 }} fill={th.ink}
                  {...popSvg("POP_SOFT", g0, cx, base + 50 - ls * 0.35)}>{String(b.label).toUpperCase()}</text>
              </React.Fragment>
            );
          })}
          {modern && cid === "BAR_COMPARE" ? (() => {
            const r = stOf(primary).ref;
            return <line x1={ch.x} y1={base - plotH} x2={ch.x + ch.w * r} y2={base - plotH} stroke={th.ink} strokeWidth={4} strokeDasharray="14 12" opacity={0.7} />;
          })() : null}
        </svg>
      );
    }
  } else if (vt === "PIE") {
    const pct = Number(d.percent) || 0;
    const st = pieState(cid || "PIE_SWEEP", tb, count);
    const { r, cx, cy } = ch, sw = 110, rr = r - sw / 2;
    const C = 2 * Math.PI * rr;
    const mid = (-90 + (360 * pct) / 200) * (Math.PI / 180);
    chart = (
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }} opacity={st.o}>
        <g transform={`translate(0 ${st.dy.toFixed(1)}) rotate(${st.rot.toFixed(2)} ${cx} ${cy}) translate(${cx} ${cy}) scale(${st.ringScale.toFixed(4)}) translate(${-cx} ${-cy})`}>
          <circle cx={cx} cy={cy} r={rr} fill="none" stroke={th.mid} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={rr} fill="none" stroke={accent} strokeWidth={sw} strokeDasharray={`${(C * pct / 100) * st.arc} ${C}`} transform={`translate(${(Math.cos(mid) * st.explode).toFixed(1)} ${(Math.sin(mid) * st.explode).toFixed(1)}) rotate(-90 ${cx} ${cy})`} />
        </g>
      </svg>
    );
  } else if (vt === "GAUGE") {
    const pct = Number(d.percent) || 0;
    const st = pieState(cid || "PIE_SWEEP", tb, count);
    const r = ch.r, cx = 540, cy = ch.cy, sw = 96, rr = r - sw / 2;
    const arc = (p) => { const a = Math.PI * (1 - p); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    const [ex, ey] = arc(clamp01((pct / 100) * st.arc));
    chart = (
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }} opacity={st.o}>
        <g transform={`translate(0 ${st.dy.toFixed(1)}) translate(${cx} ${cy}) scale(${st.ringScale.toFixed(4)}) translate(${-cx} ${-cy})`}>
          <path d={`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`} fill="none" stroke={th.mid} strokeWidth={sw} />
          <path d={`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`} fill="none" stroke={accent} strokeWidth={sw} />
          <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={th.ink} strokeWidth={10} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={22} fill={th.ink} />
        </g>
      </svg>
    );
  } else if (vt === "LINE") {
    const pts = (d.points || []).map((p) => ({ ...p, q: parseQuantity(p.value) })).filter((p) => p.q);
    const max = Math.max(...pts.map((p) => p.q.magnitude)) || 1, min = Math.min(0, ...pts.map((p) => p.q.magnitude));
    const px = (i) => ch.x + 40 + (i * (ch.w - 80)) / Math.max(1, pts.length - 1);
    const base = ch.y + ch.h - 90;
    const py = (v) => base - ((v - min) / (max - min || 1)) * (ch.h - 260);
    const t = m.build(0.55, m.s(0.1));
    const lsOf = (i) => (modern ? lineState(cid, tb, i, pts.length) : null);
    const drawT = modern ? lsOf(0).draw : t;
    const path = pts.map((p, i) => `${i ? "L" : "M"} ${px(i).toFixed(1)} ${py(p.q.magnitude).toFixed(1)}`).join(" ");
    chart = (
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
        <line x1={ch.x} y1={base} x2={ch.x + ch.w} y2={base} stroke={th.ink} strokeWidth={4} />
        {[0.33, 0.66].map((f) => <line key={f} x1={ch.x} y1={base - f * (ch.h - 260)} x2={ch.x + ch.w} y2={base - f * (ch.h - 260)} stroke={th.track} strokeWidth={2} />)}
        <path d={path} fill="none" stroke={accent} strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawT} />
        {pts.map((p, i) => {
          const ls = lsOf(i);
          const on = ls ? ls.dot : clamp01(t * (pts.length - 1) - i + 1);
          const dy = ls ? ls.dropY : 0;
          // The point's figure and label pop in place when the line reaches
          // the point. The figure pops fully formed and does not roll: the
          // line drawing up to it is the motion (a roll starting at the last
          // point ran to ~90% of the beat).
          let reach = dur;
          for (let f = 0; f <= dur; f++) {
            const o = modern ? lineState(cid, clamp01((f - 0.15 * fps) / ((animationById(cid)?.dur || 1) * fps * (m.tier === "micro" ? 0.6 : 1))), i, pts.length).dot
              : clamp01(easeOut(clamp01((f - m.s(0.1)) / (m.tier === "micro" ? m.s(0.35) : Math.max(1, dur * 0.55)))) * (pts.length - 1) - i + 1);
            if (o >= 0.98) { reach = f; break; }
          }
          const r0 = local - reach, vy = py(p.q.magnitude) - 44;
          return (
            <React.Fragment key={i}>
              <g opacity={clamp01(on)} transform={ls ? `translate(0 ${dy.toFixed(1)}) translate(${px(i)} ${py(p.q.magnitude)}) scale(${(0.4 + 0.6 * Math.min(on, 1.3)).toFixed(3)}) translate(${-px(i)} ${-py(p.q.magnitude)})` : undefined}>
                <circle cx={px(i)} cy={py(p.q.magnitude)} r={20} fill={i === pts.length - 1 ? accent : th.ink} />
              </g>
              <text x={px(i)} y={vy} textAnchor="middle" style={{ font: dataFont(72, 800), letterSpacing: -2 }} fill={th.ink} {...popSvg("NUMBER", r0, px(i), vy - 25)}>{rollQuantity(p.q, 1)}</text>
              <text x={px(i)} y={base + 60} textAnchor="middle" style={{ font: dataFont(36), letterSpacing: 0.4 }} fill={th.ink} {...popSvg("POP_SOFT", r0, px(i), base + 47)}>{String(p.label).toUpperCase()}</text>
            </React.Fragment>
          );
        })}
      </svg>
    );
  }
  return (
    <>
      <HeroEl name="chart" b={ch}>{chart}</HeroEl>
      {B.number && (vt === "PIE" || vt === "GAUGE") ? <NumberHero b={B.number} q={parseQuantity(`${d.percent}%`)} t={count} local={local} fps={fps} at={tl.numberAt} color={th.ink} m={m} hero={false} /> : null}
      {B.label ? <DataLabel b={B.label} name="label" color={th.ink} local={local} fps={fps} at={tl.labelAt} /> : null}
    </>
  );
}

// ── SCENE-FULL ────────────────────────────────────────────────────────
// Text colour on the accent (the DOCUMENT callout's highlighter band).
const onAccent = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16), lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.35 ? "#0B0B0C" : "#FFFFFF";
};

function SceneFull({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  if (c.photo) {
    const comp = L.composition;
    const push = m.tier === "micro" ? 0.02 : 0.035;
    const p01 = clamp01(local / Math.max(1, dur));
    // SCENE-FULL: a slow push. ARCHITECTURE: a tilt up the facade (the frame
    // is scaled 1.28 and travels from the base to the top over the beat).
    // DOCUMENT: a slow scroll down the page. MONEY: a slow push.
    const scale = comp === "ARCHITECTURE" ? 1.28 : comp === "DOCUMENT" ? 1.06 : 1 + push * p01;
    const ty = comp === "ARCHITECTURE" ? lerp(7, -7, easeInOut(p01)) : comp === "DOCUMENT" ? lerp(0, -2.5, p01) : 0;
    // Major: the photo expands from a small circle to the whole frame.
    const iris = m.tier === "major" ? easeInOut(clamp01(local / m.s(0.9))) : 1;
    const R = lerp(160, 1200, iris);
    if (part === "header") {
      const hb = B.headline;
      // DOCUMENT: the headline is a callout — a highlighter band in the accent draws behind each line.
      const band = comp === "DOCUMENT" && hb && hb.lines?.length ? (
        <>
          {hb.lines.map((l, i) => {
            const lw = measure(l, hb.size, { family: ROLE_HEADLINE.family, weight: ROLE_HEADLINE.weight, tracking: ROLE_HEADLINE.tracking }) + 40;
            const t = easeOut(clamp01((local - (0.15 + i * 0.08) * fps) / (0.4 * fps)));
            const lh = hb.size * ROLE_HEADLINE.lineHeight;
            return <div key={i} style={{ position: "absolute", left: hb.align === "right" ? hb.x + hb.w - lw : hb.x - 20, top: hb.y + i * lh + lh * 0.06, width: lw * t, height: lh * 0.9,
              backgroundColor: accent, opacity: 0.94, transformOrigin: hb.align === "right" ? "right center" : "left center" }} />;
          })}
        </>
      ) : null;
      return (
        <>
          <Rule b={B.rule} t={m.build(0.3, m.s(0.2))} color="#FFFFFF" />
          {B.kicker ? <DataLabel b={B.kicker} name="kicker" color="#FFFFFF" local={local} fps={fps} at={tl.labelAt + 0.3} shadow /> : null}
          {band}
          {/* On the DOCUMENT callout every word sits on the accent band, so the
              accent word takes the band's ink too (it was drawn accent on
              accent — unreadable, QA render 2026-09-30). */}
          <Headline b={B.headline} color={comp === "DOCUMENT" ? onAccent(accent) : "#FFFFFF"} accent={comp === "DOCUMENT" ? onAccent(accent) : null} local={local} fps={fps} m={m} idx={idx} at={0.3} shadow={comp !== "DOCUMENT"} />
          {B.number && c.data?.value ? <NumberHero b={B.number} q={parseQuantity(c.data.value)} t={easeOut(clamp01((local - 0.5 * fps) / Math.max(1, dur * 0.6)))} local={local} fps={fps} at={0.5} color="#FFFFFF" m={m} hero={false} /> : null}
          {c.photo.credit ? <div style={{ position: "absolute", left: L_EDGE, top: 1416, font: dataFont(20, 500), color: "rgba(255,255,255,0.72)", maxWidth: 700, textAlign: "left", ...popCss("POP_SOFT", local - 0.3 * fps, "0% 60%") }}>{c.photo.credit}</div> : null}
        </>
      );
    }
    const veil = comp === "MONEY" ? "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.30) 36%, rgba(0,0,0,0.22) 58%, rgba(0,0,0,0.80) 100%)"
      : comp === "DOCUMENT" ? "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.05) 62%, rgba(0,0,0,0.70) 100%)"
      : "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0) 44%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.78) 100%)";
    return (
      <HeroEl name="photo" b={B.photo}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: iris < 1 ? `circle(${R.toFixed(0)}px at 540px 820px)` : "none" }}>
          <Img src={staticFile(c.photo.asset)} style={{ width: "100%", height: "100%", objectFit: "cover",
            objectPosition: c.photo.position || (comp === "DOCUMENT" ? "50% 0%" : comp === "ARCHITECTURE" ? "50% 50%" : "50% 30%"),
            transform: `translateY(${ty.toFixed(2)}%) scale(${scale.toFixed(4)})`, filter: comp === "DOCUMENT" ? "none" : "saturate(0.92) contrast(1.05)" }} />
          <div style={{ position: "absolute", inset: 0, background: veil }} />
        </div>
      </HeroEl>
    );
  }
  // No image resolved (compositionFor sends such a beat to TYPE-FULL, so this is a safety net): the header alone.
  return part === "header" ? <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} /> : null;
}

// ── PROCESS-FULL ──────────────────────────────────────────────────────
function ProcessFull({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, nodes = B.nodes || [], tl = timeline(c, B, dur, fps);
  const nodeT = (i) => m.build(0.18, m.s(0.15) + i * dur * 0.26);
  const arrowT = (i) => m.build(0.2, m.s(0.3) + i * dur * 0.26);
  const center = (n) => [n.x + n.w / 2, n.y + n.h / 2];
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const nodeFill = th.dark ? "#1B1B1D" : "#FFFFFF";
  return (
    <HeroEl name="nodes" b={{ x: 0, y: nodes[0]?.y || 0, w: FRAME.w, h: BOTTOM - (nodes[0]?.y || 0) }}>
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker id="pf-arrow" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L4,2 L0,4 Z" fill={accent} />
          </marker>
        </defs>
        {nodes.slice(0, -1).map((n, i) => {
          const [x1, y1] = center(n), [x2, y2] = center(nodes[i + 1]);
          const ang = Math.atan2(y2 - y1, x2 - x1);
          const r1 = n.w / 2 + 18, r2 = nodes[i + 1].w / 2 + 44;
          const sx = x1 + Math.cos(ang) * r1, sy = y1 + Math.sin(ang) * r1, ex = x2 - Math.cos(ang) * r2, ey = y2 - Math.sin(ang) * r2;
          const t = arrowT(i);
          return <line key={i} x1={sx} y1={sy} x2={lerp(sx, ex, t)} y2={lerp(sy, ey, t)} stroke={accent} strokeWidth={18} strokeLinecap="round" markerEnd={t > 0.05 ? "url(#pf-arrow)" : undefined} />;
        })}
        {nodes.map((n, i) => {
          const t = nodeT(i);
          const [cx, cy] = center(n);
          // The middle of a 3-node chain transforms: it fills in as the flow arrives.
          const mid = nodes.length === 3 && i === 1;
          const fill = mid ? clamp01((arrowT(0) - 0.8) * 5) : 0;
          const ink = th.dark ? "242,240,235" : "11,11,12";
          return (
            <g key={i} opacity={t} transform={`translate(${cx} ${cy}) scale(${(lerp(0.7, 1, t) * m.breathe).toFixed(4)}) translate(${-cx} ${-cy})`}>
              <circle cx={cx} cy={cy} r={n.w / 2} fill={mid ? `rgba(${ink},${fill.toFixed(3)})` : nodeFill} stroke={th.ink} strokeWidth={8} />
            </g>
          );
        })}
      </svg>
      {nodes.map((n, i) => {
        const words = String(n.label || "").toUpperCase().split(/\s+/);
        const inner = n.w * 0.74;
        let size = ROLE_DATA.sizeBand[1];
        while (size > ROLE_DATA.sizeBand[0] && words.some((w) => textWidth(w, size, false, 700) > inner)) size -= 2;
        const mid = nodes.length === 3 && i === 1, fill = mid ? clamp01((arrowT(0) - 0.8) * 5) : 0;
        return (
          <div key={i} style={{ position: "absolute", left: n.x + (n.w - inner) / 2, top: n.y, width: inner, height: n.h, display: "flex", alignItems: "center", justifyContent: "center",
            textAlign: "center", font: dataFont(size, 700), lineHeight: ROLE_DATA.lineHeight, letterSpacing: roleTracking(ROLE_DATA, size),
            color: fill > 0.5 ? (th.dark ? "#0E0E0E" : "#FFFFFF") : th.ink, ...popCss("POP_STANDARD", local - (m.s(0.15) + i * dur * 0.26) - 2, "50% 50%") }}>{String(n.label).toUpperCase()}</div>
        );
      })}
    </HeroEl>
  );
}

// ── MAP-CENTERED ──────────────────────────────────────────────────────
// The map fills the frame, zoomed on the region, the region named at the
// region (primitives/map.jsx CenteredMap).
function MapCentered({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  // The header floats over the map's linework: a ground-coloured halo lifts it off.
  const tone = th.dark ? DARK_BG : GROUND;
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} halo={tone} />;
  return (
    <HeroEl name="map" b={B.map}>
      <CenteredMap data={c.data} bounds={B.map} local={local} dur={dur} font={SERIF_FAMILY_NAME} accent={accent} ground={tone} ink={th.ink} />
    </HeroEl>
  );
}
const SERIF_FAMILY_NAME = "Fraunces";

// When each list item / timeline marker appears: as the narrator says it
// (the item's first word found in the beat's spoken words, in order), else
// evenly across the first 60% of the beat.
function appearTimes(firstWords, spoken, dur, fps) {
  const norm = (w) => String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let from = 0;
  const last = Math.max(0, dur - fps * 0.6);
  return firstWords.map((fw, i) => {
    const key = norm(fw);
    const hit = key ? (spoken || []).findIndex((w, k) => k >= from && norm(w.text) === key) : -1;
    if (hit >= 0) { from = hit + 1; return Math.min(last, Math.max(Math.round(fps * 0.5), spoken[hit].from - 3)); }
    return Math.min(last, Math.round(fps * 0.6 + (i * dur * 0.6) / Math.max(1, firstWords.length)));
  });
}

// ── LIST-BUILD ────────────────────────────────────────────────────────
// Items accumulate in a column, each as the narrator says it: a hairline
// draws, its index numeral snaps in, the item (ROLE_DATA) fades up.
function ListBuild({ c, L, local, dur, fps, accent, idx, spoken, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const items = B.items || [];
  const times = appearTimes(items.map((it) => String(it.label).split(/\s+/)[0]), spoken, dur, fps);
  return (
    <HeroEl name="items" b={{ x: L_EDGE, y: items[0]?.rule?.y ?? 470, w: R_EDGE - L_EDGE, h: BOTTOM_EDGE - (items[0]?.rule?.y ?? 470) }}>
      {items.map((it, i) => {
        const t0 = times[i], t = local - t0;
        if (t < 0) return null;
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            <Rule b={it.rule} t={easeOut(clamp01(t / (0.3 * fps)))} color={th.ink} />
            <div style={{ position: "absolute", left: it.index.x, top: it.index.y, width: it.index.w, height: it.index.h, textAlign: it.index.align, font: roleFont(ROLE_NUMBER, 120),
              lineHeight: "120px", color: last ? accent : th.mid, fontOpticalSizing: "auto", ...popCss("POP_STANDARD", t, it.index.align === "right" ? "right center" : "left center") }}>{it.index.text}</div>
            <DataLabel b={it} color={th.ink} local={local} fps={fps} at={(t0 + 0.1 * fps) / fps} />
          </React.Fragment>
        );
      })}
      <Rule b={B.end} t={items.length && local >= times[items.length - 1] + 0.3 * fps ? easeOut(clamp01((local - times[items.length - 1] - 0.3 * fps) / (0.4 * fps))) : 0} color={th.ink} />
    </HeroEl>
  );
}
const BOTTOM_EDGE = BOTTOM;

// ── TIMELINE ──────────────────────────────────────────────────────────
// A vertical line draws down the frame; each dated event lands on it in turn:
// the dot pops, the date snaps in (a date is not a quantity, it does not
// count), its label fades up. The latest date is the accent.
function Timeline({ c, L, local, dur, fps, accent, idx, spoken, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const mk = B.markers || [];
  const times = appearTimes(mk.map(() => ""), spoken, dur, fps);
  const drawT = easeOut(clamp01((local - 0.1 * fps) / Math.max(1, dur * 0.55)));
  const line = B.line;
  return (
    <HeroEl name="markers" b={{ x: L_EDGE, y: line.y, w: R_EDGE - L_EDGE, h: line.h }}>
      <div style={{ position: "absolute", left: line.x, top: line.y, width: line.w, height: line.h * drawT, backgroundColor: th.ink }} />
      {mk.map((mm, i) => {
        const t = local - times[i];
        if (t < 0) return null;
        const pop = easeOut(clamp01(t / (0.2 * fps)));
        const newest = i === mk.length - 1;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: mm.dot.x, top: mm.dot.y, width: mm.dot.w, height: mm.dot.h, borderRadius: "50%", backgroundColor: newest ? accent : th.ink, transform: `scale(${pop.toFixed(3)})` }} />
            <div style={{ position: "absolute", left: mm.date.x, top: mm.date.y, width: mm.date.w, height: mm.date.h, textAlign: mm.date.align, whiteSpace: "nowrap",
              font: roleFont(ROLE_NUMBER, mm.date.size), lineHeight: `${mm.date.h}px`, letterSpacing: roleTracking(ROLE_NUMBER, mm.date.size), color: newest ? accent : th.ink,
              fontOpticalSizing: "auto", ...popCss("POP_STANDARD", t, mm.date.align === "right" ? "right center" : "left center") }}>{mm.date.text}</div>
            <DataLabel b={mm.label} color={th.ink} local={local} fps={fps} at={(times[i] + 0.15 * fps) / fps} />
          </React.Fragment>
        );
      })}
    </HeroEl>
  );
}

// ── COMPARISON-SPLIT ──────────────────────────────────────────────────
// The frame is cut on a diagonal: value A on the studio, value B on the dark
// half. Both count up together; the larger figure is the accent (for a
// from-to change, the "after" value).
function ComparisonSplit({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps), d = c.data || {};
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const qa = parseQuantity(d.a?.value), qb = parseQuantity(d.b?.value);
  const bigger = d.relation === "from-to" || !qa || !qb || qb.magnitude >= qa.magnitude ? "b" : "a";
  const wipe = easeInOut(clamp01(local / (0.5 * fps)));
  const count = (delay) => countProgress(local, dur, (tl.numberAt + delay) * fps);
  const sp = B.split;
  const darkAccent = liftAccent(accent);
  return (
    <>
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${(100 * (1 - wipe)).toFixed(2)}%)` }}>
        <polygon points={`${sp.x0},0 ${FRAME.w},0 ${FRAME.w},${FRAME.h} ${sp.x1},${FRAME.h}`} fill={DARK_BG} />
      </svg>
      <NumberHero b={B.numberA} q={qa} t={count(0)} local={local} fps={fps} at={tl.numberAt} color={bigger === "a" ? accent : th.ink} m={m} hero={false} />
      <NumberHero b={B.numberB} q={qb} t={count(0.25)} local={local} fps={fps} at={tl.numberAt + 0.25} color={bigger === "b" ? darkAccent : "#F2F0EB"} m={m} hero={false} />
      {B.labelA ? <DataLabel b={B.labelA} color={th.ink} local={local} fps={fps} at={tl.labelAt} /> : null}
      {B.labelB ? <DataLabel b={B.labelB} color="#F2F0EB" local={local} fps={fps} at={tl.labelAt + 0.25} /> : null}
    </>
  );
}

// ── hero element (match cuts / persisted elements) ────────────────────
const ShadowOn = React.createContext(false);   // the hero drop-shadow experiment is retired (restrained studio ground)
function HeroEl({ name, b, children }) {
  const ctx = React.useContext(Hero);
  const shadowOn = React.useContext(ShadowOn);
  const lit = false && shadowOn && name !== "photo";
  if (!ctx || !ctx.from || ctx.name !== name || !b) return children;
  // Start exactly on the previous beat's hero box, settle into this one.
  const t = easeInOut(ctx.t);
  const sx = ctx.from.w / Math.max(1, b.w), sy = ctx.from.h / Math.max(1, b.h);
  const s = lerp(Math.min(sx, sy), 1, t);
  const dx = lerp(ctx.from.x + ctx.from.w / 2 - (b.x + b.w / 2), 0, t), dy = lerp(ctx.from.y + ctx.from.h / 2 - (b.y + b.h / 2), 0, t);
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h / 2}px`, transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})` }}>
      {children}
    </div>
  );
}

// ── camera ────────────────────────────────────────────────────────────
export function cameraAt(c, L, local, dur, fps) {
  const tier = c.motion_tier || "medium";
  const focus = Array.isArray(c.camera_focus) ? c.camera_focus.filter((f) => Number.isFinite(Number(f?.at_percent))) : [];
  const toXf = (bx) => {
    if (!bx) return { s: 1, x: 0, y: 0 };
    const s = Math.max(1, Math.min(1.35, (0.86 * FRAME.w) / bx.w, (0.8 * FRAME.h) / bx.h));
    const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2;
    const maxX = ((s - 1) * FRAME.w) / 2, maxY = ((s - 1) * FRAME.h) / 2;
    return { s, x: Math.max(-maxX, Math.min(maxX, (FRAME.w / 2 - cx) * s)), y: Math.max(-maxY, Math.min(maxY, (FRAME.h / 2 - cy) * s)) };
  };
  let cam = { s: 1, x: 0, y: 0 };
  if (focus.length) {
    const keys = [...focus].sort((a, b) => a.at_percent - b.at_percent);
    // A push held to the end crops the rest of the composition (run
    // 36504143080 ch-44: a gauge beat framed at 49%). The camera settles back
    // on the full frame by 80-90% of the beat unless the plan already did.
    const last = keys[keys.length - 1];
    if (String(last.target).toLowerCase() !== "full") keys.push({ at_percent: Math.min(0.9, Math.max(0.8, Number(last.at_percent) + 0.3)), target: "full" });
    for (const k of keys) {
      const start = clamp01(Number(k.at_percent)) * dur;
      const t = easeInOut(clamp01((local - start) / (0.7 * fps)));
      if (t <= 0) break;
      const to = toXf(focusBox(L, k.target));
      cam = { s: lerp(cam.s, to.s, t), x: lerp(cam.x, to.x, t), y: lerp(cam.y, to.y, t) };
    }
  } else {
    const push = tier === "micro" ? 0.015 : 0.04;
    cam = { s: 1 + push * easeInOut(clamp01(local / Math.max(1, dur))), x: 0, y: 0 };
  }
  return cam;
}

// Major on TYPE-FULL / DATA-FULL / PROCESS-FULL: the full-canvas zoom, 1.0 up
// to 1.15. A zoom about the frame centre pushes anything anchored on the 48 px
// grid edge off the frame (seen on "50/30/20" and a right-edge node), so the
// zoom pivots on the hero's anchored edge and stops at the scale at which the
// hero still fits the safe width: 1.15 for a narrow statement, less for a chart
// that already spans the frame.
export function majorZoom(L) {
  if (["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY", "MAP-CENTERED", "COMPARISON-SPLIT"].includes(L.composition)) return null;
  const h = L.boxes[L.hero] || null;
  const st = L.boxes.statement;
  if (st && st.rotate) return null;
  if (L.composition === "TYPE-FULL" && h && h.w) {
    const right = h.align === "right";
    const oy = h.y + h.h > 1200 ? BOTTOM : h.y < 400 ? TOP : h.y + h.h / 2;
    return { k: Math.min(1.15, (R_EDGE - L_EDGE) / h.w), ox: right ? R_EDGE : L_EDGE, oy };
  }
  // A chart / process spanning the safe width: 1.05 keeps a 24 px margin at the end of the zoom.
  return { k: 1.05, ox: 540, oy: 960 };
}

const themeFor = (c, onPhoto) => (onPhoto ? { ink: "#FFFFFF", soft: "rgba(255,255,255,0.7)", mid: "#A7A7AD", track: "rgba(255,255,255,0.25)", dark: true, photo: true }
  : c.dark ? { ink: "#F2F0EB", soft: "#9A9A9F", mid: "#6E6E73", track: "#2B2B2E", dark: true, photo: false }
  : { ink: INK, soft: INK_SOFT, mid: MID, track: LIGHT, dark: false, photo: false });

const COMPONENTS = {
  "TYPE-FULL": TypeFull, "TYPE-SPLIT": TypeFull, "NUMBER-FULL": TypeFull, "DATA-FULL": DataFull, "PROCESS-FULL": ProcessFull,
  "SCENE-FULL": SceneFull, "ARCHITECTURE": SceneFull, "DOCUMENT": SceneFull, "MONEY": SceneFull,
  "MAP-CENTERED": MapCentered, "LIST-BUILD": ListBuild, "TIMELINE": Timeline, "COMPARISON-SPLIT": ComparisonSplit,
};

const PHOTO_COMPS = ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY"];

/**
 * Zones (canvas-layout.js ZONES): the body — every element the camera moves,
 * i.e. all but the pinned header (kicker, headline) — must stay inside the
 * zone it was laid out in (+-ZONE_TOL) and inside the frame. The camera push
 * and the major zoom are scaled back by one factor f in [0, 1] (bisection)
 * until it does. A body that fills its 720 px zone therefore gets almost no
 * push: that is the cost of no element crossing into another's zone (it is
 * how a chart crossed the headline and a node left the frame: runs
 * 36915319430 ch-26, ch-9). A full-bleed photo is the ground, not a zoned
 * element, and keeps its own motion.
 */
export function keepBodyInZone(L, cam, zoom, zk, photoBeat) {
  if (photoBeat) return { cam, zk };
  const body = flattenBoxes(L.boxes).filter(([k, b]) => b && b.w > 0 && b.h > 0 && elementType(k, b) && !/^(kicker|headline)$/.test(k)).map(([, b]) => b);
  if (!body.length) return { cam, zk };
  // Each box against ITS zone (a concept beat's body spans two: the statement
  // top, the cutouts middle). The strict zone edges: ZONE_TOL is for layout
  // border cases, not for the camera to spend (QA render 2026-10-02: a pushed
  // timeline line reached y 1348 and the rendered pixels crossed the edge).
  const limits = body.map((b) => {
    const zs = zonesOf(b);
    return zs.length ? { b, lo: ZONES[zs[0]][0], hi: ZONES[zs[zs.length - 1]][1], left: Math.min(0, b.x), right: Math.max(FRAME.w, b.x + b.w) } : null;
  }).filter(Boolean);
  if (!limits.length) return { cam, zk };
  const ox = zoom ? zoom.ox : 540, oy = zoom ? zoom.oy : 960;
  const at = (f) => {
    const s = 1 + (cam.s - 1) * f, tx = cam.x * f, ty = cam.y * f, k = 1 + (zk - 1) * f;
    const T = (px, py) => [((px - ox) * k + ox - 540) * s + 540 + tx, ((py - oy) * k + oy - 960) * s + 960 + ty];
    const ok = limits.every(({ b, lo, hi, left, right }) => {
      const [ax, ay] = T(b.x, b.y), [bx, by] = T(b.x + b.w, b.y + b.h);
      return ay >= lo - 0.5 && by <= hi + 0.5 && ax >= left - 0.5 && bx <= right + 0.5;
    });
    return { ok, s, tx, ty, k };
  };
  let f = 1;
  if (!at(1).ok) {
    let a = 0, b = 1;
    for (let i = 0; i < 14; i++) { const m = (a + b) / 2; if (at(m).ok) a = m; else b = m; }
    f = a;
  }
  const r = at(f);
  return { cam: { s: r.s, x: r.tx, y: r.ty }, zk: r.k };
}

// show: "all" | "body" | "header". bodyLocal / headerLocal are the beat's
// local frame less its entry delays (transitionInto): the incoming beat's
// text pops only once the transition has landed.
function BeatCanvas({ beat, idx, bodyLocal, headerLocal = bodyLocal, fps, accent, hero, show = "all" }) {
  const c = normalizeCanvas(beat.scene.canvas, idx);
  const dur = beat.duration_frames;
  const L = canvasLayout(c);
  const Comp = COMPONENTS[L.composition] || TypeFull;
  const theme = themeFor(c, PHOTO_COMPS.includes(L.composition) && !!c.photo);
  if (c.dark && !c.photo) accent = liftAccent(accent);
  const zoom0 = (c.motion_tier || "medium") === "major" ? majorZoom(L) : null;
  const zk0 = zoom0 ? 1 + (zoom0.k - 1) * easeInOut(clamp01(bodyLocal / Math.max(1, dur))) : 1;
  // Zones: the camera and the major zoom move only as far as keeps the body inside its zone.
  const fitted = keepBodyInZone(L, cameraAt(c, L, bodyLocal, dur, fps), zoom0, zk0, !!c.photo && PHOTO_COMPS.includes(L.composition));
  const cam = fitted.cam, zoom = zoom0, zk = fitted.zk;
  return (
    <Theme.Provider value={theme}>
      <Anim.Provider value={{ ...(c.anim || {}), dur, accent, kinetic: c.kinetic || null, beat: idx }}>
      <Hero.Provider value={hero}>
        {/* The camera moves through the information (the body); the header —
            rule, kicker and headline — stays pinned, so a push or a major zoom
            never crops it. */}
        {show === "header" ? null : (
          <div style={{ position: "absolute", inset: 0, transformOrigin: "540px 960px", transform: `translate(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px) scale(${cam.s.toFixed(4)})` }}>
            <div style={{ position: "absolute", inset: 0, transformOrigin: `${zoom ? zoom.ox : 540}px ${zoom ? zoom.oy : 960}px`,
              transform: `scale(${zk.toFixed(4)})` }}>
              <Comp c={c} L={L} idx={idx} local={bodyLocal} dur={dur} fps={fps} accent={accent} spoken={beat.spoken} part="body" />
            </div>
          </div>
        )}
        {show === "body" ? null : <Comp c={c} L={L} idx={idx} local={headerLocal} dur={dur} fps={fps} accent={accent} spoken={beat.spoken} part="header" />}
      </Hero.Provider>
      </Anim.Provider>
    </Theme.Provider>
  );
}

// SceneFull's major-tier iris: 0.9 s from a 160 px circle to the frame.
const IRIS_SEC = 0.9;
const irisBeat = (c, L) => !!c.photo && (c.motion_tier || "medium") === "major" && PHOTO_COMPS.includes(L.composition);

/**
 * How beat k is entered. "cut" (the default): the previous beat pops out (a
 * fade and a 3% shrink) over the first 45% of the transition, then the new
 * beat's text pops in place — nothing slides (the old default slid the whole
 * incoming beat up 90 px, carrying its text in). "push" (photo -> photo) and
 * "flip" (a major chart beat) move only the body; the header pops once they
 * land. "match" / "persist" keep the hero element across the cut.
 * delay / headerDelay: frames the body's / header's entrances wait. The
 * header never pops while the outgoing beat is still visible.
 */
function transitionInto(beats, k, fps) {
  const TR = Math.round(TRANSITION_SEC * fps), GAP = Math.round(TR * 0.45);
  const prev = k > 0 ? beats[k - 1] : null;
  if (!prev) return { style: "none", delay: 0, headerDelay: 0, TR, GAP };
  const c = normalizeCanvas(beats[k].scene.canvas, k), pc = normalizeCanvas(prev.scene.canvas, k - 1);
  const pL = canvasLayout(pc), cL = canvasLayout(c);
  let style = "cut";
  if (c.match_cut_prev || Number.isInteger(c.persists_from)) style = Number.isInteger(c.persists_from) ? "persist" : "match";
  else if (c.motion_tier === "major" && !pc.photo && (cL.composition === "DATA-FULL" || cL.composition === "PROCESS-FULL")) style = "flip";
  else if (pc.photo && c.photo) style = "push";
  // A match / persist needs a hero of the same kind on both sides.
  if ((style === "match" || style === "persist") && pL.hero !== cL.hero) style = "cut";
  const delay = style === "cut" || style === "persist" ? GAP : 0;
  let headerDelay = style === "push" || style === "flip" ? TR : GAP;
  // A major photo opens as an iris over the light ground: its white header
  // waits until the photo fills the frame, or it would pop white-on-light.
  if (irisBeat(c, cL)) headerDelay = Math.max(headerDelay, delay + Math.round(IRIS_SEC * fps));
  return { style, pL, cL, TR, GAP, delay, headerDelay };
}

// ── captions (outside the camera; never move with it) ─────────────────
const norm = (w) => String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function CanvasCaption({ words, local, fps, emphasis, onPhoto, dark, align, blend = false }) {
  if (!Array.isArray(words) || !words.length) throw new Error("CanvasCaption: beat has no word timings — the voiceover's word boundaries are required");
  const size = Math.min(58, Math.floor(CAPTION.w / (Math.max(1, ...words.map((w) => String(w.text).length)) * 0.62)));
  const perChunk = Math.max(8, Math.floor((CAPTION.w / (size * 0.55)) * 2));
  const chunks = [];
  let cur = [], chars = 0;
  for (const w of words) {
    const len = String(w.text).length + 1;
    if (cur.length && chars + len > perChunk) { chunks.push(cur); cur = []; chars = 0; }
    cur.push(w); chars += len;
  }
  if (cur.length) chunks.push(cur);
  let ci = -1;
  chunks.forEach((ch, i) => { if (local >= ch[0].from) ci = i; });
  if (ci < 0) return null;
  const last = words[words.length - 1];
  if (ci === chunks.length - 1 && local > last.to + Math.round(0.4 * fps)) return null;
  const emph = norm(emphasis);
  const ink = onPhoto || dark ? "#FFFFFF" : INK;
  return (
    <div style={{ position: "absolute", left: (align === "right" ? CAPTION_R : CAPTION).x, top: CAPTION.y, width: CAPTION.w, textAlign: align, font: `700 ${size}px ${SANS_STACK}`,
      lineHeight: 1.18, color: blend ? "#FFFFFF" : dark && !onPhoto ? "#F2F0EB" : ink, textShadow: onPhoto ? "0 3px 18px rgba(0,0,0,0.7)" : "none",
      mixBlendMode: blend ? "difference" : "normal" }}>
      {chunks[ci].map((w, i) => {
        // Each caption word pops in place (POP_SOFT) as it is spoken; a word
        // not yet spoken keeps its place in the line but is not drawn (it
        // used to drop in 6 px from a dimmed preview).
        const since = local - w.from;
        const isE = emph && norm(w.text).includes(emph);
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.28, ...popCss("POP_SOFT", since + 1),
            borderBottom: isE && since >= 0 ? `6px solid ${dark || onPhoto || blend ? "#FFFFFF" : INK}` : "6px solid transparent" }}>{w.text}</span>
        );
      })}
    </div>
  );
}

// ── the whole video ───────────────────────────────────────────────────
export function CanvasVideo({ plan }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = plan.beats || [];
  const accent = plan.accent || INK;
  const i = Math.max(0, beats.findIndex((b) => frame >= b.start_frame && frame < b.start_frame + b.duration_frames));
  const beat = beats[i] || beats[beats.length - 1];
  beats.forEach((b, k) => { if (!b?.scene?.canvas) throw new Error(`CanvasVideo: beat ${k} has no canvas content — the asset resolver must build it`); });
  const local = frame - beat.start_frame;
  const prev = i > 0 ? beats[i - 1] : null;
  const tin = transitionInto(beats, i, fps);
  const { style, TR, GAP } = tin;
  const inT = prev && local < TR ? local / TR : 1;
  const c = normalizeCanvas(beat.scene.canvas, i);
  const cLayout = canvasLayout(c);
  // The caption turns white-on-photo only once the photo is behind it: an
  // iris (R = 160 + 1040 * open, centred at y 820) covers the caption's words
  // (y ~1530, ~710-740 px away) at ~55% open.
  const onPhoto = PHOTO_COMPS.includes(cLayout.composition) && !!c.photo
    && (!irisBeat(c, cLayout) || easeInOut(clamp01((local - tin.delay) / (IRIS_SEC * fps))) >= 0.56);
  const prevHeroBox = style === "match" || style === "persist" ? tin.pL.boxes[tin.pL.hero] : null;
  const heroName = prev ? tin.cL.hero : null;

  const e = easeInOut(clamp01(inT));
  const eOut = easeInOut(clamp01(inT / 0.45));
  const layers = [];
  if (prev && inT < 1) {
    const plocal = prev.duration_frames + local;
    const ptin = transitionInto(beats, i - 1, fps);
    const pb = { beat: prev, idx: i - 1, bodyLocal: plocal - ptin.delay, headerLocal: plocal - ptin.headerDelay, fps, accent, hero: null };
    let outStyle = { opacity: 1 - eOut };
    if (style === "cut") outStyle = { opacity: 1 - eOut, transform: `scale(${(1 - 0.03 * eOut).toFixed(4)})`, transformOrigin: "540px 860px" };
    if (style === "push") outStyle = { opacity: 1, transform: `translateX(${(-FRAME.w * e).toFixed(1)}px)` };
    if (style === "flip") outStyle = { opacity: e < 0.5 ? 1 : 0, transform: `perspective(2400px) rotateY(${(180 * Math.min(0.5, e)).toFixed(2)}deg)` };
    if (style === "match" || style === "persist") outStyle = { opacity: 1 - clamp01(e * 2.5) };
    layers.push(
      <div key="out" style={{ position: "absolute", inset: 0, ...outStyle }}>
        <BeatCanvas {...pb} />
      </div>
    );
    if (style === "persist" && prevHeroBox) {
      // The old hero stays, moving and scaling into the new hero's box as it fades.
      const to = cLayout.boxes[cLayout.hero];
      if (to) {
        const s = lerp(1, Math.min(to.w / Math.max(1, prevHeroBox.w), to.h / Math.max(1, prevHeroBox.h)), e);
        const dx = lerp(0, to.x + to.w / 2 - (prevHeroBox.x + prevHeroBox.w / 2), e), dy = lerp(0, to.y + to.h / 2 - (prevHeroBox.y + prevHeroBox.h / 2), e);
        layers.push(
          <div key="persist" style={{ position: "absolute", inset: 0, opacity: 1 - e, transformOrigin: `${prevHeroBox.x + prevHeroBox.w / 2}px ${prevHeroBox.y + prevHeroBox.h / 2}px`,
            transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})` }}>
            <BeatCanvas {...pb} show="body" />
          </div>
        );
      }
    }
  }
  // The incoming beat: its body takes the transition (cut / persist: appears
  // whole once the old beat is gone; push / flip: moves with it); its header
  // is never inside a transition transform — it pops in place.
  let inStyle = {};
  if (prev && inT < 1) {
    if (style === "cut" || style === "persist") inStyle = { opacity: local >= GAP ? 1 : 0 };
    if (style === "push") inStyle = { transform: `translateX(${(FRAME.w * (1 - e)).toFixed(1)}px)` };
    if (style === "flip") inStyle = { opacity: e >= 0.5 ? 1 : 0, transform: `perspective(2400px) rotateY(${(-180 * (1 - Math.max(0.5, e))).toFixed(2)}deg)` };
  }
  const hero = prev && inT < 1 && (style === "match" || style === "persist") && prevHeroBox ? { name: heroName, from: prevHeroBox, t: inT } : null;
  const cb = { beat, idx: i, bodyLocal: local - tin.delay, headerLocal: local - tin.headerDelay, fps, accent, hero };
  layers.push(
    <div key="in" style={{ position: "absolute", inset: 0, ...inStyle }}>
      <BeatCanvas {...cb} show="body" />
    </div>,
    <div key="in-header" style={{ position: "absolute", inset: 0 }}>
      <BeatCanvas {...cb} show="header" />
    </div>
  );

  return (
    <ShadowOn.Provider value={false}>
    {/* Uniform white on every beat (backgrounds.js); a full-bleed photo beat
        covers it, the next beat shows it again. */}
    <StudioBG>
      {layers}
      <CanvasCaption words={beat.spoken} local={local} fps={fps} emphasis={c.emphasis_word} onPhoto={onPhoto} dark={!!c.dark} align={cLayout.flip ? "right" : "left"} blend={cLayout.composition === "COMPARISON-SPLIT"} />
    </StudioBG>
    </ShadowOn.Provider>
  );
}

export default CanvasVideo;
