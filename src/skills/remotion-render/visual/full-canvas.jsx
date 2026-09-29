/**
 * CanvasVideo — full-canvas editorial motion graphics (owner's rebuild,
 * 2026-09-29). There is no paper and no card: every beat is composed for
 * the whole 1080x1920 frame on the off-white studio ground, on a 3x4 grid,
 * asymmetrically (canvas-layout.js). Type is one of four roles
 * (typography.js): a Fraunces headline, an oversized Fraunces numeral, an
 * Inter data label, and — once a video at most — one emphasis word.
 *
 *   TYPE-FULL     the statement, or one hero number with its label
 *   DATA-FULL     bars / donut / line / gauge / map filling the canvas
 *   SCENE-FULL    a real photo edge to edge (objectFit cover), type over it;
 *                 or an isolated object cutout, large, on the studio
 *   PROCESS-FULL  2-3 nodes, thick arrows drawing between them
 *
 * Motion has two axes.
 * Tier (beat.canvas.motion_tier), how much the FRAME moves:
 *   micro   ALWAYS: studio shadows drift, grain re-seeds every frame, type
 *           breathes 0.5%, numbers keep a small oscillation AFTER they land
 *           (their position, never their value: a displayed figure is always
 *           the sourced one)
 *   medium  once per beat: bars grow, photo pushes in, arrows draw, the donut
 *           sweeps, nodes connect. A "micro" beat builds with a plain fade.
 *   major   2-3 per video: full-canvas zoom 1.0 -> 1.15 with the words flying
 *           in from scattered positions (TYPE-FULL), the photo expanding from
 *           a small circle to the whole frame (SCENE-FULL), or the
 *           composition rotating in 180 degrees across the boundary.
 * Role, how each KIND of text moves (never a fade, never one animation for
 * every role):
 *   headline  one of mask-reveal (0.5 s) / slide-land (0.45 s) / crop-open
 *             (0.6 s), rotating with the beat index so no two beats in a row
 *             share one
 *   number    counts 0 -> value over 60% of the beat, ease-out; a year or an
 *             identifier snaps in (0.15 s, scale from 0.92)
 *   data      fades in over 0.25 s to 60% opacity, settles to 100% over
 *             0.15 s, moves <= 4 px
 *   emphasis  scales 0.6 -> 1.6 over 0.4 s, holds 0.3 s, settles to 1.0
 * Choreography: headline lands 0-0.5 s, then the number counts from 0.5 s,
 * then its label fades at 1.1-1.35 s.
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
import { parseQuantity, rollQuantity } from "./primitives/quantity.js";
import { PaperMap, CenteredMap } from "./primitives/map.jsx";
import { iconElements } from "./concept-visuals.js";
import {
  animationById, entrance, exitState, unitOf, entranceSeconds, STAGGER, numberState, rollOffset, countValue, barState, pieState, lineState,
} from "./animations.js";
import {
  FRAME, CAPTION, CAPTION_R, INK, INK_SOFT, MID, LIGHT, STUDIO, DARK_BG, SANS, TRANSITION_SEC,
  canvasLayout, focusBox, textWidth, normalizeCanvas, liftAccent, L_EDGE, R_EDGE,
} from "./canvas-layout.js";
import {
  ROLE_HEADLINE, ROLE_NUMBER, ROLE_DATA, ROLE_EMPHASIS, SERIF, SANS_STACK, roleFont, roleTracking, numberSlots, measure,
  SUPERSCRIPT_SCALE, capHeightEm,
} from "./typography.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a, b, t) => a + (b - a) * t;
export const GRAIN_OPACITY = 0.055;   // brief: 0.03-0.06
export const VIGNETTE = 0.08;
const Hero = React.createContext(null);
// The colours a beat's text and chart furniture are drawn in. A dark beat
// (texture layer) swaps them; a photo beat draws white on the picture.
const Theme = React.createContext({ ink: INK, soft: INK_SOFT, mid: MID, track: LIGHT, dark: false, photo: false });
const useTheme = () => React.useContext(Theme);
// The beat's animation choices (animation-plan.js): { headline, number, label, chart, token0, exit, dur } or null (the pre-rebuild motion).
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

/**
 * Text lines under the animation `id` (animations.js). `common` is the text
 * style, `lh` the line height, `at` the start (s). Once every unit has landed
 * the plain lines are returned, so the settled frame is the same text node it
 * always was (no per-letter boxes, no lost kerning).
 */
function AnimLines({ id, lines, local, fps, at, lh, common, align, color, size }) {
  const ts = (local - at * fps) / fps;
  const side = align === "right" ? -1 : 1;
  const origin = align === "right" ? "right center" : "left center";
  const unit = unitOf(id);
  const dur = animationById(id)?.dur ?? 0.5;
  const nUnits = unit === "letter" ? lines.join("").length : unit === "word" ? lines.join(" ").split(" ").length : lines.length;
  const total = entranceSeconds(id, Math.max(1, nUnits)) + (id === "TYPE_IN" ? 0.25 : 0);
  const plain = lines.map((l, i) => <div key={i} style={{ height: lh, ...common, textAlign: align }}>{l}</div>);
  if (ts >= total + 0.02) return plain;
  const P = (t, d) => (d > 0 ? t / d : t >= 0 ? 1 : 0);
  if (id === "LETTER_STAGGER" || id === "TYPE_IN") {
    let ci = 0;
    const typed = id === "TYPE_IN" ? Math.floor(Math.max(0, ts) / STAGGER.TYPE_IN) : 0;
    return lines.map((l, i) => (
      <div key={i} style={{ height: lh, ...common, textAlign: align }}>
        {[...l].map((ch, k) => {
          const idx = ci++;
          if (ch === " ") return " ";
          if (id === "TYPE_IN") {
            const caret = idx === typed - 1 && ts < total ? (
              <span style={{ position: "relative", display: "inline-block", width: 0 }}><span style={{ position: "absolute", left: 4, top: lh * 0.14, height: lh * 0.7, width: Math.max(4, size * 0.05), backgroundColor: color }} /></span>
            ) : null;
            return <React.Fragment key={k}><span style={{ display: "inline-block", opacity: idx < typed ? 1 : 0 }}>{ch}</span>{caret}</React.Fragment>;
          }
          return <span key={k} style={{ display: "inline-block", ...styleOf(entrance("FADE_LIFT", P(ts - idx * STAGGER.LETTER_STAGGER, 0.3), { side }), "50% 80%") }}>{ch}</span>;
        })}
      </div>
    ));
  }
  if (id === "WORD_STAGGER") {
    let wi = 0;
    return lines.map((l, i) => {
      const ws = l.split(" ");
      return (
        <div key={i} style={{ height: lh, ...common, textAlign: align }}>
          {ws.map((w, k) => {
            const idx = wi++;
            return <React.Fragment key={k}><span style={{ display: "inline-block", ...styleOf(entrance("FADE_LIFT", P(ts - idx * STAGGER.WORD_STAGGER, dur), { side }), "50% 80%") }}>{w}</span>{k < ws.length - 1 ? " " : ""}</React.Fragment>;
          })}
        </div>
      );
    });
  }
  if (id === "RISE_FROM_BASE") {
    return lines.map((l, i) => {
      const e = entrance(id, P(ts - i * 0.07, dur), { side });
      return <div key={i} style={{ height: lh, overflow: "hidden", ...common, textAlign: align }}><div style={{ transform: `translateY(${((e.rise ?? 0) * lh).toFixed(1)}px)` }}>{l}</div></div>;
    });
  }
  if (id === "SPLIT_REVEAL") {
    return lines.map((l, i) => {
      const e = entrance("SLIDE_FROM_L", P(ts - i * 0.07, dur), { side });
      const k = Math.max(0, -e.dx / 180);                          // 0 at rest, 1 at the start
      const half = (clip, dir) => <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: lh, ...common, textAlign: align, clipPath: clip, opacity: clamp01(1 - k * 1.1), transform: `translateX(${(dir * 320 * k).toFixed(1)}px)` }}>{l}</div>;
      return <div key={i} style={{ position: "relative", height: lh }}>{half("inset(0 0 50% 0)", -1)}{half("inset(50% 0 0 0)", 1)}</div>;
    });
  }
  // Every other entrance is a state of the whole line: the lines follow each other 50 ms apart.
  return lines.map((l, i) => (
    <div key={i} style={{ height: lh, ...common, textAlign: align, ...styleOf(entrance(id, P(ts - i * 0.05, dur), { side }), origin) }}>{l}</div>
  ));
}

/** A supporting element's exit (animations.js EXITS) over the last ~0.35 s of the beat: wraps `children`, positioned in frame px. */
function ExitWrap({ name, b, local, fps, children }) {
  const A = useAnim();
  const ex = A?.exit;
  if (!ex || ex.element !== name || !A.dur || !b) return children;
  const d = animationById(ex.id)?.dur ?? 0.3;
  const start = A.dur / fps - d - 0.08;
  const t = local / fps - start;
  const p = d > 0 ? t / d : t >= 0 ? 1 : 0;
  if (p <= 0) return children;
  const e = exitState(ex.id, p, { side: b.align === "right" ? -1 : 1 });
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const clip = e.rx < 1 ? (b.align === "right" ? `inset(0 0 0 ${(b.x + b.w * (1 - e.rx)).toFixed(1)}px)` : `inset(0 ${(FRAME.w - (b.x + b.w * e.rx)).toFixed(1)}px 0 0)`) : "none";
  return <div style={{ position: "absolute", inset: 0, ...styleOf(e, `${cx}px ${cy}px`), clipPath: clip }}>{children}</div>;
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

// Choreography: the headline lands first (0-0.5 s), the number counts from
// 0.5 s, its label fades at 1.1-1.35 s. With no headline the number starts
// at 0.15 s; with no number a label follows the headline at 0.5 s.
function timeline(c, B) {
  const hasHead = !!(B.headline || B.statement || B.emphasis);
  const numberAt = hasHead ? 0.5 : 0.15;
  return { headlineAt: 0, numberAt, labelAt: B.number ? numberAt + 0.6 : hasHead ? 0.5 : 0.15 };
}

// ── the four roles ────────────────────────────────────────────────────
const HEADLINE_MOTIONS = ROLE_HEADLINE.motions;
export const headlineMotionFor = (idx) => HEADLINE_MOTIONS[((idx % 3) + 3) % 3];

/** ROLE_HEADLINE: Fraunces, sentence case, left/right anchored. */
function Headline({ b, color, local, fps, m, idx, at = 0, motion, shadow = false, halo = null, major = false, hero = false }) {
  const A = useAnim();
  if (!b || !b.lines?.length) return null;
  const aid = A?.headline || null;
  const kind = aid ? (aid === "WORD_FLY" ? "words" : aid === "MASK_SWEEP" ? "mask-reveal" : aid === "CROP_OPEN" ? "crop-open" : aid === "SLIDE_LAND" ? "slide-land" : "anim")
    : major ? "words" : motion || headlineMotionFor(idx);
  const t0 = local - at * fps;
  const right = b.align === "right";
  const lh = b.size * ROLE_HEADLINE.lineHeight;
  const font = roleFont(ROLE_HEADLINE, b.size);
  const n = b.lines.length;
  const lineW = (l) => measure(l, b.size, { family: ROLE_HEADLINE.family, weight: ROLE_HEADLINE.weight, tracking: ROLE_HEADLINE.tracking });
  const common = { font, lineHeight: `${lh}px`, letterSpacing: roleTracking(ROLE_HEADLINE, b.size), color, whiteSpace: "nowrap",
    textShadow: shadow ? "0 4px 28px rgba(0,0,0,0.55)" : halo ? `0 0 22px ${halo}, 0 0 9px ${halo}, 0 0 3px ${halo}` : "none", fontOpticalSizing: "auto" };
  let content;
  if (kind === "mask-reveal") {
    // A shape sweeps across each line, revealing it: the text shows behind a
    // travelling edge, and an ink bar trails that edge and closes up.
    content = b.lines.map((l, i) => {
      const t = easeInOut(clamp01((t0 - i * 0.07 * fps) / (0.5 * fps)));
      const w = lineW(l);
      const edge = t * w;
      const bar = Math.max(0, (1 - t) * 0.22 * w);
      const from = right ? w - edge : 0;
      return (
        <div key={i} style={{ position: "relative", height: lh, ...common, textAlign: b.align }}>
          <span style={{ display: "inline-block", clipPath: right ? `inset(0 0 0 ${(100 * (1 - t)).toFixed(2)}%)` : `inset(0 ${(100 * (1 - t)).toFixed(2)}% 0 0)` }}>{l}</span>
          {t > 0 && t < 1 ? <span style={{ position: "absolute", top: lh * 0.12, height: lh * 0.76, width: bar, backgroundColor: color,
            [right ? "right" : "left"]: right ? Math.max(0, edge - bar) : Math.max(0, edge - bar) }} /> : null}
        </div>
      );
    });
  } else if (kind === "crop-open") {
    // Starts cropped to one line, expands to reveal the whole phrase.
    const t = easeInOut(clamp01(t0 / (0.6 * fps)));
    if (n > 1) {
      const shown = 1 + (n - 1) * t;
      content = (
        <div style={{ ...common, textAlign: b.align, clipPath: `inset(0 0 ${(100 * (1 - shown / n)).toFixed(2)}% 0)` }}>
          {b.lines.map((l, i) => <div key={i} style={{ height: lh }}>{l}</div>)}
        </div>
      );
    } else {
      content = <div style={{ ...common, textAlign: b.align, clipPath: right ? `inset(0 0 0 ${(100 * (1 - t)).toFixed(2)}%)` : `inset(0 ${(100 * (1 - t)).toFixed(2)}% 0 0)` }}>{b.lines[0]}</div>;
    }
  } else if (kind === "words") {
    // Major: the words fly in from scattered positions and reform.
    let wi = 0;
    content = b.lines.map((l, li) => (
      <div key={li} style={{ height: lh, ...common, textAlign: b.align }}>
        {l.split(" ").map((w, k) => {
          const i = wi++;
          const a = easeOut(clamp01((t0 - m.s(0.12) - i * m.s(0.16)) / m.s(0.45)));
          const sx = Math.sin(i * 2.3) * 520 * (1 - a), sy = Math.cos(i * 1.7) * 700 * (1 - a), rot = (1 - a) * (i % 2 ? 24 : -18);
          return <span key={k} style={{ display: "inline-block", marginRight: b.size * 0.22, opacity: a, transform: `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)` }}>{w}</span>;
        })}
      </div>
    ));
  } else if (kind === "anim") {
    content = <AnimLines id={aid} lines={b.lines} local={local} fps={fps} at={at} lh={lh} common={common} align={b.align} color={color} size={b.size} />;
  } else {
    // slide-land: slides in from 60 px off and settles.
    content = b.lines.map((l, i) => {
      const t = easeOut(clamp01((t0 - i * 0.06 * fps) / (0.45 * fps)));
      const dx = (right ? 60 : -60) * (1 - t);
      return <div key={i} style={{ height: lh, ...common, textAlign: b.align, transform: `translateX(${dx.toFixed(1)}px)` }}>{l}</div>;
    });
  }
  const box = (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, transform: `scale(${m.breathe.toFixed(4)})`, transformOrigin: right ? "right center" : "left center" }}>{content}</div>
  );
  return hero ? <HeroEl name="statement" b={b}>{box}</HeroEl> : box;
}

/** ROLE_DATA: Inter, uppercase label — fades in to 60% (0.25 s), settles to 100% (0.15 s), moves <= 4 px. */
function DataLabel({ b, color, local, fps, at = 0.5, shadow = false, name = null }) {
  const A = useAnim();
  if (!b || !b.lines?.length) return null;
  const aid = name ? A?.[name] : null;
  if (aid) {
    const common = { font: roleFont(ROLE_DATA, b.size, b.weight || ROLE_DATA.weight), letterSpacing: roleTracking(ROLE_DATA, b.size), color, whiteSpace: "nowrap", textTransform: b.upper ? "uppercase" : "none",
      textShadow: shadow ? "0 3px 16px rgba(0,0,0,0.6)" : "none" };
    const lh = b.size * ROLE_DATA.lineHeight;
    return (
      <ExitWrap name={name} b={b} local={local} fps={fps}>
        <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, textAlign: b.align }}>
          <AnimLines id={aid} lines={b.lines} local={local} fps={fps} at={at} lh={lh} common={common} align={b.align} color={color} size={b.size} />
        </div>
      </ExitWrap>
    );
  }
  const t = local - at * fps;
  const a = t <= 0 ? 0 : t < 0.25 * fps ? 0.6 * easeOut(t / (0.25 * fps)) : 0.6 + 0.4 * easeOut(clamp01((t - 0.25 * fps) / (0.15 * fps)));
  const dy = 4 * (1 - easeOut(clamp01(t / (0.4 * fps))));
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, textAlign: b.align, font: roleFont(ROLE_DATA, b.size, b.weight || ROLE_DATA.weight),
      lineHeight: ROLE_DATA.lineHeight, letterSpacing: roleTracking(ROLE_DATA, b.size), color, opacity: a, transform: `translateY(${dy.toFixed(2)}px)`,
      textTransform: b.upper ? "uppercase" : "none", textShadow: shadow ? "0 3px 16px rgba(0,0,0,0.6)" : "none" }}>
      {b.lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
    </div>
  );
}

// The rolled numeric string of a quantity at fraction t: digits and its own
// separators, worded as the narration says it.
function rolledNumeric(q, t) {
  const v = q.num * clamp01(t);
  return q.comma ? v.toLocaleString("en-US", { minimumFractionDigits: q.dec, maximumFractionDigits: q.dec }) : v.toFixed(q.dec);
}

/**
 * ROLE_NUMBER: the hero numeral. Laid out in slots at the FINAL number's own
 * advances (numberSlots), so counting never moves it; the rolled digits fill
 * the digit slots right to left (an odometer), separators show once a digit
 * stands to their left. "$" is set at 0.5x raised to the cap line, "M/B/K" at
 * 0.59x on the baseline, "%" at 0.8x. A year or identifier (not a quantity)
 * snaps in instead of counting.
 */
function NumberHero({ b, q, t, local, fps, at, color, m, hero = true, settled = true }) {
  const A = useAnim();
  const nid = A?.number || null;
  const slots = numberSlots(b.parts, b.size).slots;
  const size = b.size;
  const capEm = capHeightEm(size >= ROLE_NUMBER.largeFrom ? "Fraunces" : "Inter");
  const B = size * 0.8;                        // baseline inside the box (box = cap line -0.1 em .. baseline +0.1 em)
  const base = 0.862;                          // baseline offset in a line-height:1 box, em
  // COUNT_UP / COUNT_DOWN count; ROLL_DIGIT rolls each digit; FLIP_CARD / SNAP_IN / SCALE_IMPACT show the figure and move it.
  const fixed = nid === "FLIP_CARD" || nid === "SNAP_IN" || nid === "SCALE_IMPACT";
  const snap = !b.parts.isQuantity || !q || fixed;
  const roll = nid === "ROLL_DIGIT";
  const dA = nid ? animationById(nid)?.dur ?? 0.5 : 0.15;
  const snapT = easeOut(clamp01((local - at * fps) / (0.15 * fps)));
  const started = local >= at * fps;
  if (!started) return null;
  const secIn = (local - at * fps) / fps;
  const digitSlots = slots.map((s, i) => (s.kind === "digit" ? i : -1)).filter((i) => i >= 0);
  const val = !snap && q ? countValue(nid === "COUNT_DOWN" ? "COUNT_DOWN" : "COUNT_UP", q.num, q.dec, clamp01(t)) : 0;
  const shown = snap || roll ? null : (q.comma ? val.toLocaleString("en-US", { minimumFractionDigits: q.dec, maximumFractionDigits: q.dec }) : val.toFixed(q.dec)).replace(/[^0-9]/g, "");
  const first = snap || roll ? 0 : Math.max(0, digitSlots.length - shown.length);       // index into digitSlots of the first displayed digit
  const fam = size >= ROLE_NUMBER.largeFrom ? SERIF : SANS_STACK;
  // The currency symbol travels with the first visible digit, so a counting
  // "$83M" never reads "$ 83M".
  const preShift = snap || roll || first <= 0 ? 0 : slots[digitSlots[first]].x - slots[digitSlots[0]].x;
  const finalDigits = slots.filter((s) => s.kind === "digit").map((s) => s.ch);
  const glyphs = slots.map((s, i) => {
    let ch = s.ch, visible = true;
    const gf = `${ROLE_NUMBER.weight} ${s.size}px ${s.size >= ROLE_NUMBER.largeFrom ? SERIF : SANS_STACK}`;
    if (s.kind === "digit" && !snap && !roll) {
      const di = digitSlots.indexOf(i);
      visible = di >= first;
      ch = visible ? shown[di - first] : "";
    } else if (s.kind === "sep" && !snap && !roll) {
      const di = digitSlots.filter((k) => k < i).length;            // digits to the left of the separator
      visible = di - 1 >= first && di >= 1;
      if (!visible) ch = "";
    }
    // Vertical: baseline of every glyph on B, except "$" (top on the cap line).
    const off = s.kind === "pre" ? capEm * (size - s.size) : 0;
    const top = B - base * s.size - off;
    if (roll && s.kind === "digit") {
      // An odometer wheel: this slot's digit scrolls to its target, right-most first.
      const di = digitSlots.indexOf(i), kr = digitSlots.length - 1 - di, target = Number(s.ch) || 0;
      const o = rollOffset(secIn / dA, kr, target), v = target + o, fl = Math.floor(v), fr = v - fl;
      const cell = (n, y) => <span style={{ position: "absolute", left: 0, top: y * s.size, width: "100%", height: s.size, lineHeight: 1, textAlign: "center" }}>{n}</span>;
      return (
        <span key={i} style={{ position: "absolute", left: s.x, top, width: s.w, height: s.size, overflow: "hidden", font: gf, fontOpticalSizing: "auto", letterSpacing: 0, color }}>
          {cell(fl % 10, -fr)}{cell((fl + 1) % 10, 1 - fr)}
        </span>
      );
    }
    return (
      <span key={i} style={{ position: "absolute", left: s.x + (s.kind === "pre" ? preShift : 0), top, width: s.w, height: s.size, lineHeight: 1, textAlign: "center", whiteSpace: "nowrap",
        font: gf, fontOpticalSizing: "auto",
        letterSpacing: 0, color }}>{visible ? ch : ""}</span>
    );
  });
  const osc = (t >= 1 || snap) && settled ? m.jitter() : 0;           // micro: position only, never the value
  // FLIP_CARD / SNAP_IN / SCALE_IMPACT: the figure itself moves (never its value).
  const ns = fixed ? numberState(nid, secIn / Math.max(0.01, dA)) : null;
  const sc = ns ? ns.s : snap ? lerp(0.92, 1, snapT) : m.tier === "major" ? lerp(0.6, 1, easeOut(clamp01((local - at * fps) / (0.5 * fps)))) : 1;
  const wrap = (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h,
      transform: `${ns && ns.rotX ? `perspective(1400px) rotateX(${ns.rotX.toFixed(2)}deg) ` : ""}translateY(${(osc + (ns ? ns.dy : 0)).toFixed(2)}px) scale(${(sc * m.breathe).toFixed(4)})`,
      transformOrigin: b.align === "right" ? "right center" : "left center", opacity: ns ? ns.o : 1, filter: ns && ns.blur > 0.2 ? `blur(${ns.blur.toFixed(1)}px)` : "none" }}>
      {glyphs}
    </div>
  );
  return hero ? <HeroEl name="number" b={b}>{wrap}</HeroEl> : wrap;
}

/** ROLE_EMPHASIS: one word, scaled 0.6 -> 1.6 (0.4 s), held 0.3 s, settled to 1.0. */
function Emphasis({ b, color, local, fps }) {
  if (!b) return null;
  const s = local / fps;
  const scale = s < 0.4 ? lerp(0.6, 1.6, easeOut(s / 0.4)) : s < 0.7 ? 1.6 : lerp(1.6, 1, easeInOut(clamp01((s - 0.7) / 0.35)));
  return (
    <HeroEl name="emphasis" b={b}>
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, font: roleFont(ROLE_EMPHASIS, b.size), lineHeight: `${b.h}px`, letterSpacing: roleTracking(ROLE_EMPHASIS, b.size),
        color, whiteSpace: "nowrap", textAlign: b.align, fontOpticalSizing: "auto", transform: `scale(${scale.toFixed(4)})`, transformOrigin: b.align === "right" ? "right center" : "left center" }}>{b.text}</div>
    </HeroEl>
  );
}

/**
 * A concept token (concept-visuals.js): a Lucide icon drawn large, its
 * strokes drawing on (pathLength 1) as the narrator reaches the concept, then
 * floating a few px so the frame is never still. The stroke is recomputed at
 * video scale (manual A4.3): ~4.5% of the icon's size, 8-16 px. Growth rises,
 * decline sinks; everything else drifts.
 */
const TOKEN_IDLE = { growth: -1, gain: -1, decline: 1, loss: 1 };
function ConceptToken({ b, color, local, fps, at, i = 0, name = `token${i}` }) {
  const A = useAnim();
  const els = iconElements(b.icon);
  const t = local - at * fps;
  if (!els || t <= 0) return null;
  const aid = A?.[name] || null;
  const draw = easeOut(clamp01(t / (0.75 * fps)));
  const pop = easeOut(clamp01(t / (0.45 * fps)));
  const k = b.size / 24;
  const sw = Math.max(8, Math.min(16, b.size * 0.045)) / k;
  const dir = TOKEN_IDLE[b.kind] || 0;
  const sec = t / fps;
  const idleY = dir ? dir * (Math.sin(sec * 2.4) * 0.5 + 0.5) * 9 : Math.sin(sec * 1.7 + i * 1.9) * 5;
  // The entrance the planner chose (animations.js); with none, the pre-rebuild pop.
  const ent = aid ? entrance(aid, animationById(aid)?.dur ? sec / animationById(aid).dur : 1, { side: 1 }) : null;
  const es = ent ? styleOf(ent, "50% 50%") : { opacity: clamp01(pop * 1.4), transform: `scale(${lerp(0.84, 1, pop).toFixed(4)})`, transformOrigin: "50% 50%", filter: "none" };
  // Mask entrances reveal the icon by clipping; RISE_FROM_BASE lifts it out of its own box.
  let clip = "none";
  if (ent && aid === "MASK_SWEEP") clip = `inset(0 ${(100 * (1 - ent.rx)).toFixed(2)}% 0 0)`;
  if (ent && aid === "SPLIT_REVEAL") clip = `inset(0 ${(50 * (1 - ent.rx)).toFixed(2)}% 0 ${(50 * (1 - ent.rx)).toFixed(2)}%)`;
  const rise = ent && aid === "RISE_FROM_BASE" ? (ent.rise ?? 0) * b.size : 0;
  const icon = (
    <svg viewBox="0 0 24 24" width={b.size} height={b.size} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ position: "absolute", left: aid === "RISE_FROM_BASE" ? 0 : b.x, top: aid === "RISE_FROM_BASE" ? 0 : b.y, overflow: "visible", color, ...es, clipPath: clip,
        transform: `translateY(${(idleY + rise).toFixed(2)}px) ${es.transform === "none" ? "" : es.transform}` }}>
      {els.map(([tag, attrs], j) => React.createElement(tag, draw >= 1 ? { key: j, ...attrs } : { key: j, ...attrs, pathLength: 1, strokeDasharray: 1, strokeDashoffset: (1 - draw).toFixed(4) }))}
    </svg>
  );
  return (
    <ExitWrap name={name} b={b} local={local} fps={fps}>
      {aid === "RISE_FROM_BASE" && rise > 0.5 ? <div style={{ position: "absolute", left: b.x, top: b.y, width: b.size, height: b.size, overflow: "hidden" }}>{icon}</div> : aid === "RISE_FROM_BASE" ? <div style={{ position: "absolute", left: b.x, top: b.y, width: b.size, height: b.size }}>{icon}</div> : icon}
    </ExitWrap>
  );
}
function ConceptTokens({ L, local, fps, accent }) {
  const th = useTheme();
  return (
    <>
      {[0, 1].map((i) => {
        const b = L.boxes[`token${i}`];
        if (!b) return null;
        return <ConceptToken key={i} b={b} i={i} local={local} fps={fps} at={0.3 + i * 0.4} color={b.tint === "accent" ? accent : th.ink} />;
      })}
    </>
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
  const B = L.boxes, tl = timeline(c, B);
  const major = m.tier === "major";
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  if (B.number) {
    const q = parseQuantity(c.data?.value);
    const count = easeOut(clamp01((local - tl.numberAt * fps) / Math.max(1, dur * 0.6)));
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
    // The one vertical beat of a video: the statement rotated along the left edge.
    const t = easeOut(clamp01(local / (0.5 * fps)));
    return (
      <HeroEl name="statement" b={st}>
        <div style={{ position: "absolute", left: st.x, top: st.y, width: st.w, height: st.h }}>
          <div style={{ position: "absolute", left: 0, top: st.h, width: st.textW + 8, height: st.w, transformOrigin: "0 0", transform: `rotate(-90deg) translateX(${((1 - t) * -80).toFixed(1)}px)`,
            font: roleFont(ROLE_HEADLINE, st.size), lineHeight: `${st.w}px`, letterSpacing: roleTracking(ROLE_HEADLINE, st.size), color: th.ink, whiteSpace: "nowrap", clipPath: `inset(0 ${(100 * (1 - t)).toFixed(1)}% 0 0)` }}>{st.lines[0]}</div>
        </div>
      </HeroEl>
    );
  }
  // TYPE-SPLIT: the second half lands 0.5 s after the first (the header's headline).
  return <Headline b={st} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={B.headline ? 0.5 : tl.headlineAt} major={major} hero />;
}

// ── DATA-FULL ─────────────────────────────────────────────────────────
// ROLE_DATA in a chart: small uppercase Inter labels; figures beside bars in
// Inter (ROLE_NUMBER below 100 px).
const dataFont = (size, w = 600) => `${w} ${size}px ${SANS_STACK}`;

function DataFull({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, vt = String(c.visual_type).toUpperCase(), d = c.data || {}, tl = timeline(c, B);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  let chart = null;
  const ch = B.chart;
  // The percentage the donut / gauge shows counts with its arc: 60% of the beat, ease-out.
  const count = easeOut(clamp01((local - tl.numberAt * fps) / Math.max(1, dur * 0.6)));
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
            const inside = ch.x + w + 18 > ch.x + ch.w - 200;
            const cx = ch.x + w / 2, cy = y + th2;
            return (
              <g key={i} opacity={st ? st.o : 0.6 + 0.4 * t} transform={st ? `translate(0 ${(st.dy * 0.4).toFixed(1)}) translate(${cx} ${cy}) scale(${st.pulse.toFixed(4)}) translate(${-cx} ${-cy})` : undefined}>
                <text x={ch.x} y={y - 18} style={{ font: dataFont(Math.max(24, lsz)), letterSpacing: 0.4 }} fill={th.ink}>{String(b.label).toUpperCase()}</text>
                <rect x={bx} y={y} width={w} height={th2} fill={i === primary ? accent : th.mid} />
                <text x={Math.min(bx + w + 18, ch.x + ch.w - 10)} y={y + th2 * 0.72} textAnchor={inside ? "end" : "start"}
                  style={{ font: dataFont(Math.round(th2 * 0.55), 800), letterSpacing: -1 }} fill={inside ? (th.dark ? "#0E0E0E" : "#fff") : th.ink}>{rollQuantity(b.q, t)}</text>
              </g>
            );
          })}
          {modern && cid === "BAR_COMPARE" ? (() => {
            const r = stOf(primary).ref;
            return <line x1={ch.x + (bars[primary].q.magnitude / max) * Wfull} y1={ch.y} x2={ch.x + (bars[primary].q.magnitude / max) * Wfull} y2={ch.y + ch.h * r} stroke={th.ink} strokeWidth={4} strokeDasharray="14 12" opacity={0.7} />;
          })() : null}
        </svg>
      );
    } else {
      const base = ch.baseline, plotTop = ch.y + 70, plotH = base - plotTop;
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
            return (
              <g key={i} opacity={st ? st.o : 1} transform={st ? `translate(0 ${st.dy.toFixed(1)}) translate(${cx} ${base}) scale(${st.pulse.toFixed(4)}) translate(${-cx} ${-base})` : undefined}>
                <rect x={x} y={yTop} width={bw} height={h} fill={i === primary ? accent : th.mid} />
                <text x={x + bw / 2} y={yTop - 22 + (t >= 1 ? m.jitter(i) : 0)} textAnchor="middle" style={{ font: dataFont(vs, 800), letterSpacing: -vs * 0.03 }} fill={th.ink}>{rollQuantity(b.q, t)}</text>
                <text x={x + bw / 2} y={base + 50} textAnchor="middle" opacity={0.6 + 0.4 * t} style={{ font: dataFont(Math.max(24, ls)), letterSpacing: 0.4 }} fill={th.ink}>{String(b.label).toUpperCase()}</text>
              </g>
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
          <circle cx={cx} cy={cy} r={rr} fill="none" stroke={th.track} strokeWidth={sw} />
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
          <path d={`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`} fill="none" stroke={th.track} strokeWidth={sw} />
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
          return (
            <g key={i} opacity={clamp01(on)} transform={ls ? `translate(0 ${dy.toFixed(1)}) translate(${px(i)} ${py(p.q.magnitude)}) scale(${(0.4 + 0.6 * Math.min(on, 1.3)).toFixed(3)}) translate(${-px(i)} ${-py(p.q.magnitude)})` : undefined}>
              <circle cx={px(i)} cy={py(p.q.magnitude)} r={20} fill={i === pts.length - 1 ? accent : th.ink} />
              <text x={px(i)} y={py(p.q.magnitude) - 44} textAnchor="middle" style={{ font: dataFont(72, 800), letterSpacing: -2 }} fill={th.ink}>{rollQuantity(p.q, 1)}</text>
              <text x={px(i)} y={base + 60} textAnchor="middle" style={{ font: dataFont(36), letterSpacing: 0.4 }} fill={th.ink}>{String(p.label).toUpperCase()}</text>
            </g>
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
  const B = L.boxes, tl = timeline(c, B);
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
          <Headline b={B.headline} color={comp === "DOCUMENT" ? onAccent(accent) : "#FFFFFF"} local={local} fps={fps} m={m} idx={idx} at={0.3} shadow={comp !== "DOCUMENT"} />
          {B.number && c.data?.value ? <NumberHero b={B.number} q={parseQuantity(c.data.value)} t={easeOut(clamp01((local - 0.5 * fps) / Math.max(1, dur * 0.6)))} local={local} fps={fps} at={0.5} color="#FFFFFF" m={m} hero={false} /> : null}
          {c.photo.credit ? <div style={{ position: "absolute", left: L_EDGE, top: 1416, font: dataFont(20, 500), color: "rgba(255,255,255,0.72)", maxWidth: 700, textAlign: "left" }}>{c.photo.credit}</div> : null}
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
  // An isolated object, large on the studio. Hard rule: only an image the
  // resolver isolated (rembg alpha mask, >= 15% transparent) — never a rectangle.
  if (!(c.cutout?.isolated === true && Number(c.cutout.transparent) >= 0.15)) {
    throw new Error(`[cutout] isolation failed, no alpha mask (${c.cutout?.asset}) — the resolver must convert this beat to TYPE`);
  }
  const cu = B.cutout, t = m.build(0.35, m.s(0.1));
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  return (
    <HeroEl name="cutout" b={cu}>
      <div style={{ position: "absolute", left: cu.x, top: cu.y + (1 - t) * 120, width: cu.w, height: cu.h, opacity: t,
        transform: `rotate(${((1 - t) * -5).toFixed(2)}deg) scale(${(m.breathe * (1 + 0.03 * clamp01(local / dur))).toFixed(4)})`,
        filter: "drop-shadow(18px 30px 26px rgba(0,0,0,0.28))" }}>
        <Img src={staticFile(c.cutout.asset)} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "grayscale(1) contrast(1.12)" }} />
      </div>
    </HeroEl>
  );
}

// ── PROCESS-FULL ──────────────────────────────────────────────────────
function ProcessFull({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, nodes = B.nodes || [], tl = timeline(c, B);
  const nodeT = (i) => m.build(0.18, m.s(0.15) + i * dur * 0.26);
  const arrowT = (i) => m.build(0.2, m.s(0.3) + i * dur * 0.26);
  const center = (n) => [n.x + n.w / 2, n.y + n.h / 2];
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const nodeFill = th.dark ? "#1B1B1D" : "#FFFFFF";
  return (
    <HeroEl name="nodes" b={{ x: 0, y: nodes[0]?.y || 0, w: FRAME.w, h: 1400 - (nodes[0]?.y || 0) }}>
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
            color: fill > 0.5 ? (th.dark ? "#0E0E0E" : "#FFFFFF") : th.ink, opacity: nodeT(i) }}>{String(n.label).toUpperCase()}</div>
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
  const B = L.boxes, tl = timeline(c, B);
  // The header floats over the map's linework: a ground-coloured halo lifts it off.
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} halo={th.dark ? DARK_BG : STUDIO} />;
  return (
    <HeroEl name="map" b={B.map}>
      <CenteredMap data={c.data} bounds={B.map} local={local} dur={dur} font={SERIF_FAMILY_NAME} accent={accent} ground={th.dark ? DARK_BG : STUDIO} ink={th.ink} />
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
  const B = L.boxes, tl = timeline(c, B);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const items = B.items || [];
  const times = appearTimes(items.map((it) => String(it.label).split(/\s+/)[0]), spoken, dur, fps);
  return (
    <HeroEl name="items" b={{ x: L_EDGE, y: items[0]?.rule?.y ?? 470, w: R_EDGE - L_EDGE, h: BOTTOM_EDGE - (items[0]?.rule?.y ?? 470) }}>
      {items.map((it, i) => {
        const t0 = times[i], t = local - t0;
        if (t < 0) return null;
        const snap = lerp(0.92, 1, easeOut(clamp01(t / (0.15 * fps))));
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            <Rule b={it.rule} t={easeOut(clamp01(t / (0.3 * fps)))} color={th.ink} />
            <div style={{ position: "absolute", left: it.index.x, top: it.index.y, width: it.index.w, height: it.index.h, textAlign: it.index.align, font: roleFont(ROLE_NUMBER, 120),
              lineHeight: "120px", color: last ? accent : th.mid, transform: `scale(${snap.toFixed(4)})`, transformOrigin: it.index.align === "right" ? "right center" : "left center", fontOpticalSizing: "auto" }}>{it.index.text}</div>
            <DataLabel b={it} color={th.ink} local={local} fps={fps} at={(t0 + 0.1 * fps) / fps} />
          </React.Fragment>
        );
      })}
      <Rule b={B.end} t={items.length && local >= times[items.length - 1] + 0.3 * fps ? easeOut(clamp01((local - times[items.length - 1] - 0.3 * fps) / (0.4 * fps))) : 0} color={th.ink} />
    </HeroEl>
  );
}
const BOTTOM_EDGE = 1400;

// ── TIMELINE ──────────────────────────────────────────────────────────
// A vertical line draws down the frame; each dated event lands on it in turn:
// the dot pops, the date snaps in (a date is not a quantity, it does not
// count), its label fades up. The latest date is the accent.
function Timeline({ c, L, local, dur, fps, accent, idx, spoken, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B);
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
        const snap = lerp(0.92, 1, easeOut(clamp01(t / (0.15 * fps))));
        const newest = i === mk.length - 1;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: mm.dot.x, top: mm.dot.y, width: mm.dot.w, height: mm.dot.h, borderRadius: "50%", backgroundColor: newest ? accent : th.ink, transform: `scale(${pop.toFixed(3)})` }} />
            <div style={{ position: "absolute", left: mm.date.x, top: mm.date.y, width: mm.date.w, height: mm.date.h, textAlign: mm.date.align, whiteSpace: "nowrap",
              font: roleFont(ROLE_NUMBER, mm.date.size), lineHeight: `${mm.date.h}px`, letterSpacing: roleTracking(ROLE_NUMBER, mm.date.size), color: newest ? accent : th.ink,
              transform: `scale(${snap.toFixed(4)})`, transformOrigin: mm.date.align === "right" ? "right center" : "left center", fontOpticalSizing: "auto" }}>{mm.date.text}</div>
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
  const B = L.boxes, tl = timeline(c, B), d = c.data || {};
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const qa = parseQuantity(d.a?.value), qb = parseQuantity(d.b?.value);
  const bigger = d.relation === "from-to" || !qa || !qb || qb.magnitude >= qa.magnitude ? "b" : "a";
  const wipe = easeInOut(clamp01(local / (0.5 * fps)));
  const count = (delay) => easeOut(clamp01((local - (tl.numberAt + delay) * fps) / Math.max(1, dur * 0.6)));
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
// A soft, large, very low-opacity shadow under the primary element (the
// number, the chart, the statement): it suggests the element is a physical
// object on the studio surface. Pure black at 0.06, blur 80 px. Not a photo
// (full-bleed) and not a cutout (which carries its own shadow).
const HERO_SHADOW = "drop-shadow(0 34px 80px rgba(0,0,0,0.06))";
// plan.hero_shadow === false turns it off (the blur is a full-frame filter on
// every frame; the switch exists so its render cost can be measured and, if a
// CI time cap demands it, dropped without a code change).
const ShadowOn = React.createContext(true);
function HeroEl({ name, b, children }) {
  const ctx = React.useContext(Hero);
  const shadowOn = React.useContext(ShadowOn);
  const lit = shadowOn && name !== "photo" && name !== "cutout";
  if (!ctx || !ctx.from || ctx.name !== name || !b) return lit ? <div style={{ position: "absolute", inset: 0, filter: HERO_SHADOW }}>{children}</div> : children;
  // Start exactly on the previous beat's hero box, settle into this one.
  const t = easeInOut(ctx.t);
  const sx = ctx.from.w / Math.max(1, b.w), sy = ctx.from.h / Math.max(1, b.h);
  const s = lerp(Math.min(sx, sy), 1, t);
  const dx = lerp(ctx.from.x + ctx.from.w / 2 - (b.x + b.w / 2), 0, t), dy = lerp(ctx.from.y + ctx.from.h / 2 - (b.y + b.h / 2), 0, t);
  return (
    <div style={{ position: "absolute", inset: 0, filter: lit ? HERO_SHADOW : undefined, transformOrigin: `${b.x + b.w / 2}px ${b.y + b.h / 2}px`, transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})` }}>
      {children}
    </div>
  );
}

// ── camera ────────────────────────────────────────────────────────────
function cameraAt(c, L, local, dur, fps) {
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
    const oy = h.y + h.h > 1200 ? 1400 : h.y < 400 ? 180 : h.y + h.h / 2;
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

function BeatCanvas({ beat, idx, local, fps, accent, hero, bodyOnly = false }) {
  const c = normalizeCanvas(beat.scene.canvas, idx);
  const dur = beat.duration_frames;
  const L = canvasLayout(c);
  const cam = cameraAt(c, L, local, dur, fps);
  const Comp = COMPONENTS[L.composition] || TypeFull;
  const theme = themeFor(c, ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY"].includes(L.composition) && !!c.photo);
  if (c.dark && !c.photo) accent = liftAccent(accent);
  const zoom = (c.motion_tier || "medium") === "major" ? majorZoom(L) : null;
  return (
    <Theme.Provider value={theme}>
      <Anim.Provider value={c.anim ? { ...c.anim, dur } : null}>
      <Hero.Provider value={hero}>
        {c.dark && !c.photo ? <div style={{ position: "absolute", inset: 0, backgroundColor: "#0E0E0E" }} /> : null}
        {/* The camera moves through the information (the body); the header —
            rule, kicker and headline — stays pinned, so a push or a major zoom
            never crops it. */}
        <div style={{ position: "absolute", inset: 0, transformOrigin: "540px 960px", transform: `translate(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px) scale(${cam.s.toFixed(4)})` }}>
          <div style={{ position: "absolute", inset: 0, transformOrigin: `${zoom ? zoom.ox : 540}px ${zoom ? zoom.oy : 960}px`,
            transform: `scale(${zoom ? (1 + (zoom.k - 1) * easeInOut(clamp01(local / Math.max(1, dur)))).toFixed(4) : 1})` }}>
            <Comp c={c} L={L} idx={idx} local={local} dur={dur} fps={fps} accent={accent} spoken={beat.spoken} part="body" />
            <ConceptTokens L={L} local={local} fps={fps} accent={accent} />
          </div>
        </div>
        {bodyOnly ? null : <Comp c={c} L={L} idx={idx} local={local} dur={dur} fps={fps} accent={accent} spoken={beat.spoken} part="header" />}
      </Hero.Provider>
      </Anim.Provider>
    </Theme.Provider>
  );
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
        const since = local - w.from;
        const e = clamp01(since / 3);
        const isE = emph && norm(w.text).includes(emph);
        return (
          <span key={i} style={{ display: "inline-block", marginRight: size * 0.28, opacity: since < 0 ? 0.28 : 1,
            transform: `translateY(${(6 * (1 - e)).toFixed(1)}px)`, borderBottom: isE && since >= 0 ? `6px solid ${dark || onPhoto || blend ? "#FFFFFF" : INK}` : "6px solid transparent" }}>{w.text}</span>
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
  const TR = Math.round(TRANSITION_SEC * fps);
  const prev = i > 0 ? beats[i - 1] : null;
  const inT = prev && local < TR ? local / TR : 1;
  const c = normalizeCanvas(beat.scene.canvas, i);
  const cLayout = canvasLayout(c);
  const onPhoto = ["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY"].includes(cLayout.composition) && !!c.photo;

  // Transition style at the boundary into this beat.
  let style = "slide";
  if (prev) {
    const pc = normalizeCanvas(prev.scene.canvas, i - 1);
    const pL = canvasLayout(pc), cL = cLayout;
    if (c.match_cut_prev || Number.isInteger(c.persists_from)) style = Number.isInteger(c.persists_from) ? "persist" : "match";
    else if (c.motion_tier === "major" && !pc.photo && (cL.composition === "DATA-FULL" || cL.composition === "PROCESS-FULL")) style = "flip";
    else if (pc.photo && c.photo) style = "push";
    // A match / persist needs a hero of the same kind on both sides.
    if ((style === "match" || style === "persist") && pL.hero !== cL.hero) style = "slide";
    var prevHeroBox = style === "match" || style === "persist" ? pL.boxes[pL.hero] : null;
    var heroName = cL.hero;
  }

  const e = easeInOut(clamp01(inT));
  const eOut = easeInOut(clamp01(inT / 0.55)), eIn = easeInOut(clamp01((inT - 0.35) / 0.65));
  const layers = [];
  if (prev && inT < 1) {
    const plocal = prev.duration_frames + local;
    let outStyle = { opacity: 1 - eOut };
    if (style === "slide") outStyle = { opacity: 1 - eOut, transform: `translateY(${(-90 * eOut).toFixed(1)}px)` };
    if (style === "push") outStyle = { opacity: 1, transform: `translateX(${(-FRAME.w * e).toFixed(1)}px)` };
    if (style === "flip") outStyle = { opacity: e < 0.5 ? 1 : 0, transform: `perspective(2400px) rotateY(${(180 * Math.min(0.5, e)).toFixed(2)}deg)` };
    if (style === "match" || style === "persist") outStyle = { opacity: 1 - clamp01(e * 2.5) };
    layers.push(
      <div key="out" style={{ position: "absolute", inset: 0, ...outStyle }}>
        <BeatCanvas beat={prev} idx={i - 1} local={plocal} fps={fps} accent={accent} hero={null} />
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
            <BeatCanvas beat={prev} idx={i - 1} local={plocal} fps={fps} accent={accent} hero={null} bodyOnly />
          </div>
        );
      }
    }
  }
  let inStyle = {};
  if (prev && inT < 1) {
    if (style === "slide") inStyle = { opacity: eIn, transform: `translateY(${(90 * (1 - eIn)).toFixed(1)}px)` };
    if (style === "push") inStyle = { transform: `translateX(${(FRAME.w * (1 - e)).toFixed(1)}px)` };
    if (style === "flip") inStyle = { opacity: e >= 0.5 ? 1 : 0, transform: `perspective(2400px) rotateY(${(-180 * (1 - Math.max(0.5, e))).toFixed(2)}deg)` };
    if (style === "persist") inStyle = { opacity: e };
  }
  const hero = prev && inT < 1 && (style === "match" || style === "persist") && prevHeroBox ? { name: heroName, from: prevHeroBox, t: inT } : null;
  layers.push(
    <div key="in" style={{ position: "absolute", inset: 0, ...inStyle }}>
      <BeatCanvas beat={beat} idx={i} local={local} fps={fps} accent={accent} hero={hero} />
    </div>
  );

  return (
    <ShadowOn.Provider value={plan.hero_shadow !== false}>
    <StudioBG color={STUDIO} drift={frame / fps}>
      {layers}
      {/* Paper grain, on every beat: a noise tile re-seeded every frame (a new
          offset and a new mirror), multiplied into the studio ground at 0.055
          (screened at 0.05 on a dark beat, where multiply would vanish). */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${staticFile("fx/grain.png")})`, backgroundSize: "256px 256px",
        backgroundPosition: `${(frame * 97) % 256}px ${(frame * 57) % 256}px`, opacity: c.dark ? 0.05 : GRAIN_OPACITY, mixBlendMode: c.dark ? "screen" : "multiply", pointerEvents: "none",
        transform: `scale(${frame % 2 ? -1 : 1}, ${(frame >> 1) % 2 ? -1 : 1})` }} />
      {/* Film vignette: black at 0.08 at the corners, clear inside 58% of the radius. */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse farthest-corner at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,${VIGNETTE}) 100%)`, pointerEvents: "none" }} />
      <CanvasCaption words={beat.spoken} local={local} fps={fps} emphasis={c.emphasis_word} onPhoto={onPhoto} dark={!!c.dark} align={cLayout.flip ? "right" : "left"} blend={cLayout.composition === "COMPARISON-SPLIT"} />
    </StudioBG>
    </ShadowOn.Provider>
  );
}

export default CanvasVideo;
