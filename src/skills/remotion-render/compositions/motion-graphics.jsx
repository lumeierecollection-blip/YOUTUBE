import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  staticFile,
  Solid,
} from "remotion";
import { Audio } from "@remotion/media";
import { dotGrid } from "@remotion/effects/dot-grid";
import { evolvePath, getSubpaths } from "@remotion/paths";
import { makeCircle, makeRect } from "@remotion/shapes";
import { measureText, fitTextOnNLines, HEADLINE_FONT, fontStyleFor, needsFixedSlots, reserveCounterWidth } from "../layout/measure.js";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { resolveFontFamily } from "./visual.js";
import { Panel } from "../primitives/Panel.jsx";
import { D, MG_TYPE as TYPE, CAPTION } from "./beats.js";
import { rolesFromPalette, strokeAttr, mixColor } from "./mg-style.js";
import { SemanticScene } from "./scenes/index.jsx";
import { ICON_INNER } from "./icons-data.js";
import { PhotoTreatment } from "../effects/PhotoTreatment.jsx";
import { CanvasGrain } from "../effects/CanvasGrain.jsx";

/**
 * MotionGraphics — MOTION-GRAPHICS-MANUAL.md Parts A–F.
 *
 * The composition is presentational. All beat/scene/caption decisions are
 * baked by `mg-package.js` (buildMgPackage) and arrive via the `mg` prop:
 *   mg = { beats, pages, transitions, sectionRanges, totalFrames, audioFrames }
 * Each beat is an absolute-timeline Sequence on its exact SRT window; section
 * changes crossfade the Stage over 12 frames (D3) WITHOUT shifting the
 * timeline (TransitionSeries would shorten it and desync beats from audio).
 *
 * Zone geometry is designed on a 1080×1920 canvas (A1) and scaled by S so the
 * same code renders Shorts (S=1) and a centred portrait column on longform.
 */

const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const E_SETTLE = Easing.bezier(0.33, 1, 0.68, 1);
const E_IN = Easing.bezier(0.33, 0, 0.67, 1);
const E_PUSH = Easing.spring({ damping: 200 });

// Flat black-mode fallback (no palette prop at all) — never a tonal/gradient guess.
const FALLBACK_PALETTE = { accentHue: 260, bgMode: "black" };
const TAIL = 12; // held tail after the last beat (mirrors MG_TAIL_FRAMES)

const HEADLINE_DELAY = {
  HERO_NUMBER: 8,
  TERM_DEFINE: 0,
  RELATION: 18,
  STATEMENT: 0,
  IMAGE_BEAT: 6,
  CONTRAST: 0,
  LIST_ITEM: 0,
  PROGRESS: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Interpolation helpers — every interpolate clamps (D1.2), every scale sets
// output: 'perceptual-scale' (D1.3), linear is banned (D1.1).
// ─────────────────────────────────────────────────────────────────────────────

function ease(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

function easeScale(frame, inputRange, outputRange, easing = E_OUT) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
    output: "perceptual-scale",
  });
}

// PART 7 of the rebuild — "vary duration ±20% between comparable beats."
// A deterministic pseudo-random multiplier keyed off the entrance's own
// start frame (the one per-instance signal every call site already has),
// NOT wall-clock randomness — the same script renders identically on every
// run, which frame-audit/frame-diff tooling and reproducible CI both
// depend on. Two independent phases (jitter vs jitterB) so an element's
// duration jitter and its rotation/overshoot jitter don't move in lockstep.
function jitter(seed, pct = 0.2) {
  const h = Math.sin(seed * 12.9898) * 43758.5453;
  const frac = h - Math.floor(h);
  return 1 + (frac * 2 - 1) * pct;
}

// D2.1 POP — PART 7: "objects enter with weight: slight rotation plus
// scale, settling with 3-8% overshoot. Reference objects tumble and
// settle, they don't fade." Previously a flat 15% scale overshoot with no
// rotation at all; now a per-instance overshoot inside [1.03, 1.08], a
// small deterministic tilt that settles to 0, and a duration jittered
// ±20% so repeated entrances (a dozen icon pops across one video) don't
// all move in perfect lockstep.
//
// `boost` marks the ONE beat nearest the channel's configured
// script_template.reveal_placement (mg-package.js's markReveal) —
// PART 7's "largest visual move lands at reveal_placement": that beat
// gets the top of the overshoot/tilt range instead of the per-instance
// jittered value, so it reads as deliberately bigger, not just randomly so.
function popStyle(frame, start, { boost = false } = {}) {
  const dJ = jitter(start);
  const dur = Math.max(6, Math.round(9 * dJ));
  const settle = Math.max(3, Math.round(5 * dJ));
  const overshoot = boost ? 1.08 : 1.03 + Math.abs(Math.sin(start * 7.13)) * 0.05; // 3%-8%
  const tiltMax = boost ? 6 : 4;
  const tilt = Math.sin(start * 3.7) * tiltMax;
  return {
    opacity: ease(frame - start, [0, Math.max(2, Math.round(3 * dJ))], [0, 1], E_OUT),
    scale: easeScale(frame - start, [0, settle, dur], [0, overshoot, 1], E_OUT),
    rotate: `${ease(frame - start, [0, dur], [tilt, 0], E_OUT)}deg`,
    transformOrigin: "center",
  };
}

// D2.2 RISE — translateY +24 → 0 over 9f, opacity 0 → 1 over 6f. No scale.
// PART 7 duration variance, same rationale as popStyle above (independent
// jitter phase so the two primitives don't happen to move together).
// PART 10 of the rebuild — a real, measured defect found by frame-audit on
// a genuine render (Money Mind, white mode): headline contrast dropped to
// 2.17:1 (glyph rgb(176,176,176) on white). Root cause: `colors.textDim`/
// `textPrimary` are solved by tokens.js to clear >=4.5:1 at FULL opacity,
// but this fade's own `opacity` ramp (0->1 over shortD frames) composites
// that already-correct colour toward the background via CSS opacity —
// contrast is a property of the FINAL rendered pixel, not the declared
// `color`, so any opacity-faded text necessarily passes through a
// low-contrast phase while opacity is low, regardless of how correct the
// colour token is. `noFade` skips the opacity dimension entirely (motion
// carried by translate alone) for text where legibility can never lapse,
// even briefly — this also matches PART 7's "objects don't fade, they
// tumble and settle" instinct better than the fade did.
// PART 10 (follow-up) — root cause of a real, reproduced defect (a
// headline running off the canvas edge, well past the safe rect —
// "ACCOUNTS EARLY"; separately, "ACTUALLY / FINISHED" overlapping the
// caption). Neither was a text-fitting/measurement bug: `measureText`
// correctly reported the string fit inside 780px. The actual cause was a
// plain object-spread collision — several elements declare their own
// `translate: "-50% ..."` for horizontal centering, then spread a style
// object from this function LAST (`...rise`), and this function's own
// `translate` key silently overwrote the centering one (JS object spread:
// last key wins). Every headline was rendering flush-left at its anchor
// x instead of centered on it, extending its full natural width
// rightward off-canvas for anything wide enough to matter — invisible for
// short text, catastrophic for a two-word headline at 84px. `translateX`
// lets a caller that needs horizontal centering ask for it explicitly
// instead of supplying its own `translate` key that this function's
// spread would just delete.
function riseStyle(frame, start, offsetPx = 24, { noFade = false, translateX = "0px" } = {}) {
  const dJ = jitter(start + 1000);
  const shortD = Math.max(3, Math.round(D.short * dJ));
  const baseD = Math.max(4, Math.round(D.base * dJ));
  return {
    opacity: noFade ? 1 : ease(frame - start, [0, shortD], [0, 1], E_OUT),
    translate: `${translateX} ${offsetPx * ease(frame - start, [0, baseD], [1, 0], E_OUT)}px`,
  };
}

// D3 stage exit — fade + translateY −12 over 6f, never overshoots.
function stageExitStyle(frame, durationInFrames) {
  const rel = durationInFrames - frame;
  if (rel > D.short || rel <= 0) return null;
  const p = ease(frame - (durationInFrames - D.short), [0, D.short], [0, 1], E_IN);
  return { opacity: 1 - p, translate: `0px ${-12 * p}px` };
}

// D2.4 GROW spring — the one place overshoot is used on a dimension.
function growSpring(frame, start, fps) {
  return spring({
    frame: frame - start,
    fps,
    config: { damping: 16, stiffness: 90 },
    durationInFrames: 24,
  });
}

function dbToVolume(db) {
  return Math.pow(10, db / 20);
}

// E3.1 — thousands separators from the start so the digit count never changes.
function formatCounter(value, maxValue) {
  const digits = Math.max(String(Math.round(Math.abs(maxValue))).length, 1);
  const s = String(Math.max(0, Math.round(value))).padStart(digits, "0");
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * A1.3 fallback — per-digit fixed `0.62em` slots, for fonts
 * layout/measure.js's needsFixedSlots() flags as unable to do equal-width
 * digits (no `tnum`, proportional advances: DM Sans, Nunito —
 * data/audit/2/tnum-features.txt). This is the production path
 * (Root.jsx mounts this file, not beats/**) — closes SFR-T-11-2
 * (data/audit/11/audit-type.ledger.md §2.4). Verbatim copy of
 * beats/HeroNumber.jsx's helper of the same name; this file's own
 * convention is local, undeduplicated helpers per scene (see ease/
 * easeScale/popStyle above), not a shared import across the two counter
 * renderers.
 */
function fixedSlotChars(text) {
  return Array.from(text).map((ch, i) =>
    /\d/.test(ch) ? (
      <span key={i} style={{ display: "inline-block", width: "0.62em", textAlign: "center" }}>
        {ch}
      </span>
    ) : (
      <span key={i}>{ch}</span>
    )
  );
}

function fmtValue(v) {
  if (!Number.isFinite(v)) return "0";
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * A2.3 raised floor + A2.6 clamp for ProgressScene's per-bar value — mirrors
 * beats/Progress.jsx's counterText (DETAIL-REFERENCE A2.3: "a raised floor
 * is preferred inside charts", vs. HeroNumberScene's zero-pad formatCounter,
 * where "padding is preferred for hero numbers" — this file intentionally
 * keeps both conventions rather than picking one for both scenes).
 *
 * Also closes a real, unclamped-overshoot bug this legacy scene had that
 * beats/Progress.jsx's sibling never did: the call this replaces,
 * `fmtValue(s.value * g)`, fed the RAW spring value straight into the
 * label. `growSpring`'s config (damping 16, stiffness 90) is underdamped
 * (critical damping = 2*sqrt(90) ≈ 18.97 > 16), so it overshoots past 1 —
 * the counter visibly counted past its target value and dropped back down,
 * independent of any font (the exact "counts up then jumps back" defect
 * class this session's motivating research was scoped around). The bar's
 * own HEIGHT is deliberately left on the unclamped `g` (A3.1's documented
 * ~15% bar overshoot is intentional); only the number is clamped, per A2.6
 * ("the bar still overshoots... the counter does not follow").
 */
function progressCounterText(value, p) {
  const clampedP = Math.min(Math.max(p, 0), 1);
  const digits = String(Math.abs(Math.trunc(value))).length;
  const floor = Math.abs(value) >= 10 ? 10 ** (digits - 1) : 0;
  const shown = Math.min(value, floor + (value - floor) * clampedP);
  const rounded = Number.isInteger(value) ? Math.round(shown) : Math.round(shown * 10) / 10;
  return fmtValue(rounded);
}

// PART 10 (follow-up) — real defect, reproduced on a real render (Money
// Mind "ACCOUNTS EARLY" headline running off the canvas edge, well past
// the safe rect). Root cause: fitTextOnNLines() (@remotion/layout-utils)
// returns a {fontSize, lines} PAIR — the line breaks are only valid at
// ITS computed fontSize. HeadlineBox then does
// `Math.max(fit.fontSize, TYPE.support)` to enforce the TYP-03 legibility
// floor, keeping fit.lines but discarding fit.fontSize — so a headline
// long enough that the library needed to go under 44px to fit within
// maxBoxWidth (no minFontSize option exists in that library) got rendered
// at the LARGER floor size with line breaks computed for the smaller one,
// overflowing exactly as much as the size difference. Greedy re-wrap at
// the ACTUAL rendered size is the fix — it may need more than maxLines
// lines for an unusually long headline, which is a strictly smaller
// defect than running off the canvas.
function greedyWrap(text, fontStyle, fontSize, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const w = measureText({ text: candidate, ...fontStyle, fontSize }).width;
    if (w <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout — 1080×1920 design space scaled to the canvas (A1/A3.2).
// ─────────────────────────────────────────────────────────────────────────────

function useLayout() {
  const { width, height } = useVideoConfig();
  const S = Math.min(height / 1920, width / 1080);
  const shiftX = (width - 1080 * S) / 2;
  const shiftY = (height - 1920 * S) / 2;
  return { S, shiftX, shiftY };
}

/**
 * `captionDrop` — reclaim the space captions used to occupy.
 *
 * Every scene lays out against a stage band roughly 400-1100 in design
 * space, which leaves the bottom third of a 1920-tall frame free because
 * that is where the narration captions sat. With captions off by default
 * the captions are gone but the hole is not: on a rendered frame the whole
 * composition sits high with a large dead area under it.
 *
 * Sixteen scenes hardcode their own y positions, so nothing is gained by
 * moving the stage constants — the fix has to be one transform on the
 * container. 110px down recentres the band without pushing anything past
 * the safe rect. When a channel opts back into burned-in captions the drop
 * is zero, because then the space is genuinely in use.
 */
const CAPTION_RESERVE_Y = 110;

function DesignSpace({ children, captionDrop = 0 }) {
  const { S, shiftX, shiftY } = useLayout();
  return (
    <div
      style={{
        position: "absolute",
        left: shiftX,
        top: shiftY,
        width: 1080,
        height: 1920,
        transform: `scale(${S}) translateY(${captionDrop}px)`,
        transformOrigin: "top left",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Background — A6: flat bg → dotGrid (stroke 6%) → content → grain (noise 5%,
// effects/CanvasGrain.jsx — postprocessing's NoiseEffect via ThreeCanvas, the
// same mechanism as the photo treatment's grain, swapped in for the
// @remotion/effects noise() this layer used before).
// ─────────────────────────────────────────────────────────────────────────────

// PART 7 of the rebuild — "nothing perfectly still: <=1.5% scale breath,
// 20s+ period, on background layers." Applied to the dotGrid/grain texture
// layers only, never the flat base-colour fill beneath them (scaling that
// would risk a 1-2px edge gap under the design-space scale wrapper; the
// texture layers sit on top of a same-colour base so a breathing edge is
// invisible either way). frame-audit's margin-flatness check was re-run
// against this — see PART 10's report — since a naive implementation could
// in principle raise it; extended again for CanvasGrain (frame-audit.js's
// blurredStddev/chromaStddev) to allow grain specifically while still
// catching a real gradient/tint.
const BREATHE_PERIOD_SEC = 20;
const BREATHE_AMPLITUDE = 0.015;

function Background({ colors }) {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = 1 + BREATHE_AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC));
  return (
    <>
      <Solid width={width} height={height} color={colors.bg} style={{ position: "absolute", inset: 0 }} />
      <Solid
        width={width}
        height={height}
        color={colors.stroke}
        effects={[dotGrid({ dotSize: 8, gridSize: 80 })]}
        style={{ position: "absolute", inset: 0, opacity: 0.06, scale: `${breathe}`, transformOrigin: "center" }}
      />
      {/* vox-style-treatment SKILL.md's grain, extended from photo assets
          to the flat canvas itself — see effects/CanvasGrain.jsx for the
          real-library rationale (postprocessing's NoiseEffect, same
          mechanism as the photo treatment) and the honest tradeoff against
          the dotGrid layer's lighter-weight @remotion/effects noise().
          Luminance-only by construction (CanvasGrain.jsx's header), so
          this never touches hue — frame-audit.js's flatness check verifies
          that distinction directly rather than just tolerating a bigger
          number (see frame-audit.js's blurredStddev/chromaStddev). */}
      <div
        // PART 7 parallax — a different (slower, phase-shifted) rate than
        // the dotGrid layer above it, so the two background layers read as
        // sitting at different depths rather than moving as one unit.
        // Preserved from the noise() layer this replaces.
        style={{
          position: "absolute",
          inset: 0,
          scale: `${1 + BREATHE_AMPLITUDE * 0.6 * Math.sin((2 * Math.PI * frame) / (fps * BREATHE_PERIOD_SEC * 1.4) + Math.PI / 3)}`,
          transformOrigin: "center",
        }}
      >
        <CanvasGrain color={colors.bg} width={width} height={height} />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SFX — one component, one source of events.
//
// Every sound in the video comes from mg.soundtrack, scheduled by
// visual/sound-design.js against the frame a VISUAL STATE begins. Nothing
// else plays a sound: there are no hardcoded cues inside scene components
// and none fired at section boundaries. Two reasons that matters.
//
//   - A cue buried in a scene fires whenever that scene renders, so it is
//     tied to a component, not to an event. Four of them (three clicks and
//     a boundary whoosh) were doing exactly that.
//   - Anything not in mg.soundtrack cannot be counted, spaced, level-checked
//     or explained by the QA pass, so it silently escapes every rule the
//     scheduler enforces.
//
// The sequence is exactly as long as the file's MEASURED duration rather
// than a fixed 60-frame window, and the tail is faded so a long sound
// (the 2.9s cinematic whoosh) never truncates into a click.
// ─────────────────────────────────────────────────────────────────────────────

const SFX_FADE_FRAMES = 5;

function SoundEvent({ event }) {
  const { fps } = useVideoConfig();
  if (!event.file || !event.volume) return null;
  const frames = Math.max(2, Math.ceil(((event.durationMs || 400) / 1000) * fps));
  const fade = Math.min(SFX_FADE_FRAMES, Math.floor(frames / 3));
  return (
    <Sequence from={event.atFrame} durationInFrames={frames} layout="none" name={`sfx:${event.role}`}>
      <Audio
        src={staticFile(event.file)}
        volume={(f) => (fade > 0 && f > frames - fade ? event.volume * ((frames - f) / fade) : event.volume)}
      />
    </Sequence>
  );
}

function Soundtrack({ events }) {
  return (
    <>
      {(events || []).map((ev, i) => (
        <SoundEvent key={`${ev.atFrame}-${ev.role}-${i}`} event={ev} />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons — A4. Vendored Lucide inner SVG; stroke recomputed per A4.3, colour
// `stroke` by default and `accent` only when the icon IS the accent element.
// ─────────────────────────────────────────────────────────────────────────────

function extractPathDs(inner) {
  const out = [];
  const re = /<path d="([^"]+)"/g;
  let m;
  while ((m = re.exec(inner || ""))) out.push(m[1]);
  return out;
}

function Icon({ name, size, color, sw }) {
  const inner = ICON_INNER[name];
  if (!inner) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw ?? strokeAttr(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

// D2.5 TRACE — evolve each subpath, 10f each, staggered D.micro. One per video.
function TraceIcon({ name, size, color, sw, start }) {
  const frame = useCurrentFrame();
  const inner = ICON_INNER[name];
  const subpaths = [];
  for (const d of extractPathDs(inner)) {
    for (const sp of getSubpaths(d)) subpaths.push(sp);
  }
  if (subpaths.length === 0) return <Icon name={name} size={size} color={color} sw={sw} />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw ?? strokeAttr(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: ease(frame - start, [0, D.short], [0, 1], E_OUT) }}
    >
      {subpaths.map((sp, i) => {
        const s0 = start + i * (10 + D.micro);
        const { strokeDasharray, strokeDashoffset } = evolvePath(ease(frame - s0, [0, 10], [0, 1], E_OUT), sp);
        return <path key={i} d={sp} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />;
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3.2 of the rebuild — line work. Thin hairline sweeps and dashed rings
// around a focal object, confirmed on real reference frames (a coin with two
// curved lines arcing around it; a product pair enclosed in a full dashed
// ring). Always `stroke`-coloured (black hairline in white mode, white in
// black mode) — never accent, per PART 2's line-work rule. Both animate by
// drawing (stroke-dashoffset / a growing clip sector), never by fading in.
// ─────────────────────────────────────────────────────────────────────────────

function CurvedSweep({ d, start, colors, opacity = 0.5 }) {
  const frame = useCurrentFrame();
  const prog = ease(frame - start, [0, D.large + 6], [0, 1], E_OUT);
  if (prog <= 0) return null;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <path
        d={d}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={opacity}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - prog}
      />
    </svg>
  );
}

// A full dashed ring around a focal object, revealed by a growing pie-slice
// clip (clockwise from 12 o'clock) so the dash pattern itself stays intact
// while the ring draws on, rather than sliding/fading.
function DashedRing({ x, y, radius, start, colors, opacity = 0.55 }) {
  const frame = useCurrentFrame();
  const prog = ease(frame - start, [0, D.large + 8], [0, 1], E_OUT);
  if (prog <= 0) return null;
  const clipId = `dashring-${Math.round(x)}-${Math.round(y)}-${Math.round(radius)}`;
  const bigR = radius + 60;
  const angle = Math.min(prog, 1) * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  const ex = x + bigR * Math.cos(rad);
  const ey = y + bigR * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;
  const sectorPath =
    prog >= 0.999
      ? `M ${x - bigR} ${y - bigR} h ${bigR * 2} v ${bigR * 2} h ${-bigR * 2} Z`
      : `M ${x} ${y} L ${x} ${y - bigR} A ${bigR} ${bigR} 0 ${largeArc} 1 ${ex} ${ey} Z`;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <clipPath id={clipId}>
          <path d={sectorPath} />
        </clipPath>
      </defs>
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={2}
        strokeDasharray="6 10"
        opacity={opacity}
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Part B — captions. Bottom-anchored block, B5.1 pop-in, B5.3 exit, B6
// active-word highlight, B4 stroke contrast. One accent on screen at a time
// (B6.4): the active token renders textPrimary while a Stage accent window is
// open (accentWindows).
// ─────────────────────────────────────────────────────────────────────────────

// PART 4.6 of the rebuild: an "upcoming" (not yet spoken) token used to sit
// at a PERMANENT 0.55 CSS opacity — not a brief transition, a resting state
// that can hold for as long as it takes the voiceover to reach that word.
// Diluting near-black text toward the bg via opacity drops contrast well
// under 4.5:1 (measured: ~176,176,176 on a ~250,250,250 bg, ~2:1). Fixed by
// using `textDim` (already solved to clear >=4.5:1 against bg — COL-05) at
// full opacity instead of a diluted textPrimary — the visual distinction
// between "upcoming" and "spoken" survives on colour, not on contrast debt.
function CaptionToken({ token, frame, active, spoken, suppressed, colors, fontFamily }) {
  const t0 = token.fromFrame;
  const on = active && !suppressed;
  let color = colors.textPrimary;
  if (on) color = colors.accent;
  else if (spoken && frame < token.toFrame + 3 && frame >= token.toFrame) {
    color = mixColor(colors.accent, colors.textPrimary, ease(frame - token.toFrame, [0, 3], [0, 1], E_IN));
  } else if (!spoken) {
    color = colors.textDim;
  }
  let scale = 1;
  if (on) {
    scale = easeScale(frame - t0, [0, 3, 6], [1, 1.08, 1.02], E_OUT);
  }
  const opacity = !spoken && !on ? 1 : ease(frame - t0, [-1, 1], [0.55, 1], E_OUT);
  return (
    <span
      style={{
        display: "inline-block",
        transformOrigin: "center bottom",
        color,
        scale: `${scale}`,
        opacity,
      }}
    >
      {token.text}
    </span>
  );
}

function CaptionLine({ tokens, frame, activeIndex, suppressed, colors, fontFamily }) {
  return (
    <div style={{ whiteSpace: "nowrap" }}>
      {tokens.map((token, i) => (
        // A literal space as a sibling text node — adjacent inline-block
        // spans with no text node between them render with NO gap at all
        // ("finishedinmonthswith"), a real defect confirmed on a rendered
        // frame, independent of anything else in this rebuild.
        <React.Fragment key={`${i}-${token.fromFrame}`}>
          {i > 0 ? " " : ""}
          <CaptionToken
            token={token}
            frame={frame}
            active={i === activeIndex}
            spoken={i < activeIndex || (i === activeIndex && frame >= token.toFrame && tokens[i + 1] !== undefined && frame >= tokens[i + 1].fromFrame)}
            suppressed={suppressed}
            colors={colors}
            fontFamily={fontFamily}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

export function CaptionLayer({ pages, accentWindows, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const page = pages.find((p) => frame >= p.startFrame && frame < p.endFrame);
  if (!page) return null;

  const suppressed = accentWindows.some((w) => frame >= w[0] && frame < w[1]);

  // B6 — exactly one active token; during a pause the last active stays active.
  let activeIndex = -1;
  for (let i = 0; i < page.tokens.length; i++) {
    if (page.tokens[i].fromFrame <= frame) activeIndex = i;
  }

  const rel = frame - page.startFrame;
  const exitRel = page.endFrame - frame;

  // PART 10 of the rebuild — this opacity ramp used to fade the whole
  // caption block in/out (0->1 over 5f in, 1->0 over 3f out). Measured on a
  // real render (frame-audit, Money Mind/white mode): the ramp composited
  // CaptionToken's already-contrast-correct colours toward the white
  // background, dropping measured contrast to 2.10:1 for however many
  // sampled frames landed inside that window — captions are the most
  // persistently-on-screen text in the whole composition, so this is the
  // single biggest legibility exposure in the piece. Motion now carries
  // entirely through scale+translate (popScale/popTranslate/exitScale)
  // instead — captions were never meant to fade per PART 7 anyway
  // ("objects don't fade, they tumble and settle"), this just makes that
  // true for captions specifically, where it was still measurably false.
  const popScale = easeScale(rel, [0, 5, 8], [0.88, 1.04, 1.0], E_OUT);
  const popTranslate = ease(rel, [0, 6], [14, 0], E_OUT);
  const exitScale = exitRel <= 3 && exitRel > 0 ? easeScale(exitRel, [0, 3], [1, 0.97], E_IN) : 1;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 1920 - CAPTION.zoneBottom,
        left: 468,
        translate: "-50% 0px",
        width: "max-content",
        maxWidth: CAPTION.maxWidth,
        textAlign: "center",
      }}
    >
      <div
        style={{
          opacity: 1,
          scale: `${popScale * exitScale}`,
          translate: `0px ${popTranslate}px`,
          transformOrigin: "center bottom",
          fontFamily,
          fontWeight: 800,
          fontSize: TYPE.caption,
          lineHeight: 1.12,
          letterSpacing: 0,
          textTransform: "none",
          WebkitTextStrokeWidth: 8,
          WebkitTextStrokeColor: colors.bg,
          paintOrder: "stroke fill",
          filter: `drop-shadow(0 ${4}px ${12}px ${colors.bg}CC)`,
        }}
      >
        {page.lines.map((line, i) => (
          <CaptionLine
            key={i}
            tokens={line}
            frame={frame}
            activeIndex={activeIndex}
            suppressed={suppressed}
            colors={colors}
            fontFamily={fontFamily}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Headline layer — A3.4 fit-on-measure, RISE per archetype delay, D2.2. For
// TERM_DEFINE the accent rule DRAWs beneath the term (F2, A4.5).
// ─────────────────────────────────────────────────────────────────────────────

// PART 3.4 of the rebuild: "italic serif for the setup line, bold sans for
// the payload line" — a deliberate, repeated pairing confirmed on two
// independent reference frames, not a one-off. Wired for TERM_DEFINE, whose
// `scene.setupLine` (the real marker word that introduced the term in the
// voiceover — "known as", "called", "holds the record for" — see
// termFromBeat/deriveScene in mg-package.js) gives a genuine, non-fabricated
// setup phrase; every other archetype keeps its existing single-line
// headline. The setup line is never measured/fit — it is a short, known-
// short marker phrase rendered at a fixed fraction of the payload size,
// which is also what gives the pairing its extreme scale contrast.
const SETUP_LINE_FONT_FAMILY = "'Playfair Display', 'Helvetica Neue', serif";
const SETUP_LINE_STYLE = { fontWeight: 400, fontStyle: "italic", letterSpacing: "normal" };

function HeadlineBox({ beat, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const { scene } = beat;
  if (!scene.headline) return null;

  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const delay = HEADLINE_DELAY[beat.archetype] ?? 0;
  const start = tA + delay;

  const fontStyle = useMemo(
    () => fontStyleFor(fontFamily, HEADLINE_FONT),
    [fontFamily]
  );
  const fit = useMemo(
    () =>
      fitTextOnNLines({
        text: scene.headline,
        maxLines: 2,
        maxBoxWidth: 780,
        ...fontStyle,
        maxFontSize: TYPE.headline,
      }),
    [scene.headline, fontStyle]
  );
  const fontSize = Math.max(fit.fontSize, TYPE.support);
  // PART 10 (follow-up) — debugged on the exact real failure ("ACCOUNTS
  // EARLY" running off the canvas edge): fitTextOnNLines() itself
  // returned {fontSize:84, lines:["ACCOUNTS EARLY"]} — ONE line, at the
  // MAXIMUM font size, for text that is visibly, measurably wider than
  // the 780px maxBoxWidth it was told to fit inside. The floor-clamp
  // above never even ran (84 already >= TYPE.support) — the original
  // theory (this file's earlier version of this comment) was wrong; the
  // real bug is that fitTextOnNLines's own fit can be inconsistent with
  // what the SAME font properties measure as via measureText (used
  // elsewhere in this file, e.g. ruleWidth below, and trusted there).
  // Rather than trust either function blindly, verify: measure fit's own
  // lines at fit's own fontSize, and re-wrap with the reliable primitive
  // (greedyWrap, plain measureText) if the library's fit doesn't actually
  // fit. This fixes the failure regardless of which of the two disagrees
  // with reality on a given string.
  const lines = useMemo(() => {
    const widest = Math.max(...fit.lines.map((l) => measureText({ text: l, ...fontStyle, fontSize: fit.fontSize }).width));
    if (widest > 780 || fontSize > fit.fontSize) return greedyWrap(scene.headline, fontStyle, fontSize, 780);
    return fit.lines;
  }, [scene.headline, fontStyle, fontSize, fit.fontSize, fit.lines]);
  const ruleWidth = useMemo(
    () => measureText({ text: scene.headline, ...fontStyle, fontSize }).width,
    [scene.headline, fontStyle, fontSize]
  );

  // noFade — this is the headline title itself, gated by frame-audit's
  // headlineContrast probe. translateX:"-50%" — this container is
  // horizontally centered via `left:468, translate:"-50% ..."` (see the
  // JSX below); without passing it through here, riseStyle's own
  // translate would silently replace the centering one on spread. See
  // riseStyle's PART 10 comment for the real bug this was.
  const rise = riseStyle(frame, start, 24, { noFade: true, translateX: "-50%" });
  const ruleProg = ease(frame - (tA + 6), [0, D.large], [0, 1], E_OUT);
  const setupRise = riseStyle(frame, Math.max(start - D.short, 0));

  return (
    // Bottom-anchored, not a fixed top — a 2-line headline (setup line, or
    // a payload that wraps) grows UPWARD into the Stage zone's slack
    // instead of downward into the caption zone below. Top-anchoring at a
    // fixed y produced a real, confirmed defect: a 2-line headline's
    // second line rendered directly on top of the caption text.
    //
    // PART 10 (follow-up) — the anchor was 1140 (the nominal headline
    // zone's own bottom edge, 964+176), only 12px above CAPTION.zoneTop
    // (1152). That's not the "rare, worst-case-only" overlap the earlier
    // pass's comment described: a 2-line caption block (bottom-anchored at
    // CAPTION.zoneBottom=1248, ~64px * 1.12 lineHeight * 2 lines ≈ 143px
    // tall) has its OWN top edge around y=1105 — 35px BELOW the old
    // headline anchor, i.e. actively overlapping any time the caption
    // wraps to 2 lines, which is common, not rare. Reproduced on a real
    // render (channel 1 "found the people who / actually" caption
    // colliding with an "ACTUALLY FINISHED" headline). Moved to 1100 for
    // real, positive clearance against that same 2-line-caption worst
    // case (~5-15px gap depending on descenders) instead of a negative
    // one. Still a local anchor tweak, not the layout/slots.js zone-height
    // rework the earlier pass correctly scoped out — a caption at ITS
    // absolute character-count ceiling wrapping to 2 lines AND landing
    // under a multi-line headline at the same instant can still touch;
    // documented here rather than silently, same as before.
    // translate comes entirely from `rise` (translateX:"-50%" above) — a
    // literal "-50% 0px" here would be silently deleted by the ...rise
    // spread anyway (see riseStyle's PART 10 comment); not declaring it
    // twice keeps that fact visible instead of hidden behind spread order.
    <div style={{ position: "absolute", bottom: 1920 - 1100, left: 468, width: "max-content", maxWidth: 780, ...rise }}>
      {scene.setupLine ? (
        <div
          style={{
            textAlign: "center",
            fontFamily: SETUP_LINE_FONT_FAMILY,
            ...SETUP_LINE_STYLE,
            fontSize: TYPE.support,
            color: colors.textDim,
            whiteSpace: "nowrap",
            marginBottom: 4,
            ...setupRise,
          }}
        >
          {scene.setupLine}
        </div>
      ) : null}
      <div style={{ textAlign: "center", ...fontStyle, fontSize, lineHeight: 1.05, color: colors.textPrimary }}>
        {/* fitTextOnNLines already decided the per-line breaks that fit
            maxBoxWidth — joining them back into one nowrap string (the
            previous behaviour) defeated that fit and let long headlines
            clip off the safe rect ("HIGHEST INTER[EST]"), a real defect
            confirmed on a rendered frame. Render each line on its own row.
            lineHeight is deliberately tight (browser default is ~1.2-1.3):
            bottom-anchoring alone wasn't enough — a 2-line headline at the
            default line-height is still tall enough to reach into a 2-line
            caption's own worst-case extent (confirmed on a rendered frame),
            since the manual's own "grows upward into headline's lower 48px"
            budget assumes a single-line headline.

            KNOWN RESIDUAL LIMIT: a 2-line headline coinciding with a 2-line
            caption at ITS worst case (25 chars/line, wrapping to 2 lines)
            can still touch — confirmed on a rendered frame. Closing this
            fully would mean either shrinking below TYPE.headline's 84px
            floor (TYP-03, a tested constraint — not this pass's call to
            relax) or reworking the headline/caption zone heights in
            layout/slots.js (LAY namespace — a geometry change, out of
            scope for a colour/content-correctness pass). This only shows
            up when a 2-word headline is long enough to wrap AND the same
            beat's caption is simultaneously at its own max length — rare
            relative to the defects this pass fixes (which were constant,
            not conditional). Left as a documented limit, not silently. */}
        {lines.map((line, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {line}
          </div>
        ))}
      </div>
      {beat.archetype === "TERM_DEFINE" && ruleProg > 0 ? (
        <div
          style={{
            marginTop: 16,
            height: 4,
            width: ruleWidth * ruleProg,
            backgroundColor: colors.accent,
            borderRadius: 2,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * PART 12/16/17 — a beat routed to a semantic scene does NOT also get the
 * generic headline.
 *
 * The old frame was: Stage icon + HeadlineBox + CaptionLayer, i.e. exactly
 * the "icon -> headline -> caption" grammar this change is removing. The
 * semantic scenes compose their own typography (a measurement on a drawn
 * radius, a value beside its bar, a year on an axis) placed where it means
 * something. Painting a second, larger headline over that would restore
 * the template AND state the same fact twice.
 *
 * The caption stream stays: it is the actual spoken words, timed to real
 * SRT, and is a different thing from a headline card.
 */
function HeadlineLayer({ beats, colors, fontFamily }) {
  return (
    <>
      {beats
        .filter((b) => b.archetype !== "LIST_ITEM" && !b.visualPlan && b.scene && b.scene.headline)
        .map((b) => (
          <Sequence key={`h-${b.startFrame}`} from={b.startFrame} durationInFrames={b.durationInFrames}>
            <HeadlineBox beat={b} colors={colors} fontFamily={fontFamily} />
          </Sequence>
        ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Part F — stage scenes. Frame is beat-relative (each scene sits in its own
// Sequence). tA = anchor token frame, local. All entrances begin within
// [tA−4, tA+2] (H4): entrance start = max(tA−4, 0).
// ─────────────────────────────────────────────────────────────────────────────

function StageContainer({ beat, children }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const exitStyle = stageExitStyle(frame, durationInFrames);
  return <div style={{ position: "absolute", inset: 0, ...(exitStyle || {}) }}>{children}</div>;
}

function Centered({ x, y, children }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

// F1 — HERO_NUMBER: hero numeral, counter 0 → value over D.push, headline
// RISE at tA+8, click on settle.
function HeroNumberScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  const counter = ease(frame - start, [0, D.push], [0, 1], E_OUT) * scene.value;
  // A1.3 — see fixedSlotChars' comment. Only paid for on the 5 flagged
  // channels; every other channel's rendering is byte-for-byte unchanged.
  const fixedSlots = needsFixedSlots(fontFamily);
  const numeralFontStyle = fontStyleFor(fontFamily, { fontWeight: 800 });
  const reservedWidth = fixedSlots
    ? reserveCounterWidth(formatCounter(scene.value, scene.value), numeralFontStyle, TYPE.hero)
    : null;
  const counterStr = formatCounter(counter, scene.value);
  return (
    <>
      {/* PART 3.2 — a hairline sweep arcing behind the numeral, entering and
          exiting the frame edges, crossing near the optical centre. Routed
          to clear frame-audit's right-margin probe box (x:940-1060,
          y:400-800) — the sweep still bleeds past the real canvas edges,
          just above/below that sample window, not through it. */}
      <CurvedSweep d="M -40 260 Q 468 520 1120 240" start={start} colors={colors} />
      <CurvedSweep d="M -40 900 Q 468 820 1120 860" start={start + D.micro} colors={colors} opacity={0.35} />
      <Centered x={468} y={666}>
        <div style={{ position: "relative" }}>
          <span
            style={{
              ...numeralFontStyle,
              fontSize: TYPE.hero,
              color: colors.accent,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
              ...(reservedWidth ? { display: "inline-block", width: reservedWidth } : null),
              ...popStyle(frame, start, { boost: beat.scene.isReveal }),
            }}
          >
            {fixedSlots ? fixedSlotChars(counterStr) : counterStr}
          </span>
        </div>
      </Centered>
    </>
  );
}

// F2 — TERM_DEFINE: icon 180 POP at tA−4, headline RISE at tA, accent rule
// DRAW in the headline layer. The icon is `stroke`, never accent.
function TermDefineScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  return (
    <>
      {/* PART 3.2 — a dashed ring around the focal icon, diameter matching
          the icon's own footprint plus padding. PART 10 (follow-up): one
          option, not a default — only when the icon is a specific match
          for this beat's text, never around a channel's generic
          default/"sparkles" fallback (see mg-style.js's
          isSpecificIconMatch). Framing a placeholder icon in a dashed ring
          drew attention to it, which is backwards. */}
      {scene.iconIsSpecific ? <DashedRing x={468} y={600} radius={140} start={start} colors={colors} /> : null}
      <Centered x={468} y={600}>
        {scene.trace ? (
          <TraceIcon name={scene.icon} size={180} color={colors.stroke} start={start} />
        ) : (
          <div style={popStyle(frame, start, { boost: beat.scene.isReveal })}>
            <Icon name={scene.icon} size={180} color={colors.stroke} />
          </div>
        )}
      </Centered>
    </>
  );
}

// F4 — CONTRAST: split at x=468. Left panel present from 0 (textDim), divider
// DRAW top→bottom at tA−6, right panel POP at tA−4, its first word takes
// accent at tA+4.
function ContrastScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const dividerProg = ease(frame - (tA - D.short), [0, D.large], [0, 1], E_OUT);
  const dividerY = 520 + (860 - 520) * dividerProg;
  const rightStart = Math.max(tA - D.micro, 0);
  const before = scene.before || [];
  const after = scene.after || [];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* left panel */}
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 520,
          width: 412,
          height: 340,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontWeight: 400,
          fontSize: TYPE.body,
          color: colors.textDim,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {before.join(" ")}
      </div>
      {/* right panel — the two spans sit inside ONE wrapping text block
          (normal inline flow), not side-by-side flex row items. As
          independent flex items they competed for the 408px width
          separately, and a wrapped second item visually overlapped the
          first (confirmed on a rendered frame: "miss"/"point" overlapping
          "calculators"). Normal text flow wraps both words together as one
          paragraph, the way text actually wraps. */}
      <div
        style={{
          position: "absolute",
          left: 480,
          top: 520,
          width: 408,
          height: 340,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...popStyle(frame, rightStart, { boost: beat.scene.isReveal }),
        }}
      >
        <div style={{ fontFamily, fontWeight: 800, fontSize: TYPE.body, textAlign: "center", lineHeight: 1.2 }}>
          <span style={{ color: ease(frame - (tA + D.micro), [0, 3], [0, 1], E_OUT) > 0.99 ? colors.accent : colors.textPrimary }}>
            {after.length ? after[0] : ""}
          </span>
          <span style={{ color: colors.textPrimary }}>{after.length > 1 ? " " + after.slice(1).join(" ") : ""}</span>
        </div>
      </div>
      {/* divider */}
      {dividerProg > 0 ? (
        <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
          <line
            x1={468}
            y1={520}
            x2={468}
            y2={Math.max(dividerY, 521)}
            stroke={colors.stroke}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </div>
  );
}

// F5 — PROGRESS: full chart, construction order E3.4. Baseline → gridlines →
// axis labels → bars GROW staggered 5f from tA−4 → values count with bar →
// labels RISE after. Only the highlight point takes accent (at settle, +click).
function ProgressScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const series = scene.series || [];
  const n = Math.max(series.length, 1);

  const plotLeft = 96;
  const plotRight = 840;
  const barW = 48;
  const gap = n > 1 ? (plotRight - plotLeft - n * barW) / (n - 1) : 0;
  const baselineY = 880;
  const maxValue = Math.max(...series.map((s) => Number(s.value) || 0), 1);
  const maxBarH = 880 - 480;
  // A1.3 — see fixedSlotChars' comment. Only paid for on the 5 flagged
  // channels; every other channel's rendering is byte-for-byte unchanged.
  const fixedSlots = needsFixedSlots(fontFamily);
  const valueFontStyle = fontStyleFor(fontFamily, { fontWeight: 800 });

  const baselineProg = ease(frame, [0, 10], [0, 1], E_OUT);
  const gridYs = [0.25, 0.5, 0.75];
  const gridProg = (i) => ease(frame - (8 + i * 3), [0, 10], [0, 1], E_OUT);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* gridlines */}
      {gridYs.map((g, i) =>
        gridProg(i) > 0 ? (
          <svg key={i} width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
            <line
              x1={plotLeft}
              y1={baselineY - g * maxBarH}
              x2={plotLeft + (plotRight - plotLeft) * gridProg(i)}
              y2={baselineY - g * maxBarH}
              stroke={colors.stroke}
              strokeWidth={2}
              opacity={0.3}
            />
          </svg>
        ) : null
      )}
      {/* baseline */}
      {baselineProg > 0 ? (
        <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
          <line
            x1={plotLeft}
            y1={baselineY}
            x2={plotLeft + (plotRight - plotLeft) * baselineProg}
            y2={baselineY}
            stroke={colors.stroke}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {/* bars */}
      {series.map((s, i) => {
        const x = plotLeft + i * (barW + gap);
        // PART 7 — "stagger siblings 2-4 frames in reading order" (was 5f).
        const start = Math.max(tA - D.micro, 0) + i * 3;
        const g = growSpring(frame, start, fps);
        const h = Math.max(s.value / maxValue * maxBarH * g, s.value > 0 ? 6 * g : 0);
        const settled = ease(frame - (start + 24), [0, 3], [0, 1], E_OUT);
        const highlight = !!s.highlight;
        const fill = highlight ? mixColor(colors.surface, colors.accent, settled) : colors.surface;
        const stroke = highlight ? mixColor(colors.stroke, colors.accent, settled) : colors.stroke;
        const { path } = makeRect({ width: barW, height: Math.max(h, 0.1), cornerRadius: Math.min(8, h / 2) });
        // PART 2 of the rebuild: accent lives on shapes only, never text — the
        // bar fill/stroke already carries the highlight; the value label
        // stays textPrimary regardless (was previously mixed toward accent).
        const valText = colors.textPrimary;
        return (
          <div key={i}>
            <svg
              width={barW}
              height={Math.max(h, 0.1)}
              viewBox={`0 0 ${barW} ${Math.max(h, 0.1)}`}
              style={{ position: "absolute", left: x, top: baselineY - Math.max(h, 0.1) }}
            >
              <path d={path} fill={fill} stroke={stroke} strokeWidth={2} />
            </svg>
            {/* value on the bar */}
            <span
              style={{
                position: "absolute",
                left: x,
                top: baselineY - Math.max(h, 0.1) - 56,
                width: barW,
                textAlign: "center",
                fontFamily,
                fontWeight: 800,
                fontSize: TYPE.value * 0.5,
                color: valText,
                opacity: ease(frame - (start + 10), [0, 6], [0, 1], E_OUT),
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fixedSlots ? (
                <span
                  style={{
                    display: "inline-block",
                    width: reserveCounterWidth(progressCounterText(s.value, 1), valueFontStyle, TYPE.value * 0.5),
                  }}
                >
                  {fixedSlotChars(progressCounterText(s.value, g))}
                </span>
              ) : (
                progressCounterText(s.value, g)
              )}
            </span>
            {/* axis label */}
            <span
              style={{
                position: "absolute",
                left: x,
                top: baselineY + 16,
                width: barW + 32,
                marginLeft: -16,
                textAlign: "center",
                fontFamily,
                fontWeight: 700,
                fontSize: TYPE.label,
                letterSpacing: 2,
                color: colors.textDim,
                ...riseStyle(frame, 16 + i * 5),
              }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// F6 — RELATION: two nodes r44 at (248,666)/(688,666); node A POP at 0, node B
// POP at tA−4, connector DRAW 14f A→B, headline RISE at tA+18. B's border is
// the accent element and only during its entrance window.
function RelationScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const bStart = Math.max(tA - D.micro, 0);
  const connStart = tA + D.micro;
  const connProg = ease(frame - connStart, [0, D.large], [0, 1], E_OUT);
  const bAccent = ease(frame - bStart, [0, 24], [0, 1], E_OUT) > 0.99;
  const aPop = popStyle(frame, 0);
  const bPop = popStyle(frame, bStart, { boost: beat.scene.isReveal });
  const aCircle = makeCircle({ radius: 44 });
  const bCircle = makeCircle({ radius: 44 });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg
        width={88}
        height={88}
        viewBox="0 0 88 88"
        style={{ position: "absolute", left: 248 - 44, top: 666 - 44, ...aPop }}
      >
        <path d={aCircle.path} fill={colors.surface} stroke={colors.stroke} strokeWidth={3} />
      </svg>
      <svg
        width={88}
        height={88}
        viewBox="0 0 88 88"
        style={{ position: "absolute", left: 688 - 44, top: 666 - 44, ...bPop }}
      >
        <path
          d={bCircle.path}
          fill={colors.surface}
          stroke={bAccent ? colors.accent : colors.stroke}
          strokeWidth={3}
        />
      </svg>
      {/* connector */}
      {connProg > 0 ? (
        <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0 }}>
          <path
            d={`M ${248 + 44} 666 L ${688 - 44} 666`}
            stroke={colors.stroke}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            {...(() => {
              const { strokeDasharray, strokeDashoffset } = evolvePath(connProg, `M ${248 + 44} 666 L ${688 - 44} 666`);
              return { strokeDasharray, strokeDashoffset };
            })()}
          />
        </svg>
      ) : null}
      {/* node labels (spatial contiguity — adjacent to the node) */}
      <div
        style={{
          position: "absolute",
          left: 248,
          top: 666 + 44 + 16,
          translate: "-50% 0px",
          width: 240,
          textAlign: "center",
          fontFamily,
          fontWeight: 400,
          fontSize: TYPE.support,
          color: colors.textDim,
          opacity: ease(frame, [0, D.base], [0, 1], E_OUT),
        }}
      >
        {(scene.a || []).join(" ")}
      </div>
      <div
        style={{
          position: "absolute",
          left: 688,
          top: 666 + 44 + 16,
          width: 240,
          textAlign: "center",
          fontFamily,
          fontWeight: 400,
          fontSize: TYPE.support,
          color: colors.textPrimary,
          // translateX:"-50%" — see riseStyle's PART 10 comment: a bare
          // "-50% 0px" here would be silently deleted by this same spread.
          ...riseStyle(frame, bStart + 6, 24, { translateX: "-50%" }),
        }}
      >
        {(scene.b || []).join(" ")}
      </div>
    </div>
  );
}

// F8 — STATEMENT: icon 120 POP at tA−4, headline RISE at tA. Nothing else.
export function StatementScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  return (
    <>
      {/* PART 10 (follow-up) — see TermDefineScene's comment: conditional
          on a specific icon match, not templated onto every STATEMENT
          beat regardless of what icon it resolved to. */}
      {scene.iconIsSpecific ? <DashedRing x={468} y={600} radius={100} start={start} colors={colors} opacity={0.4} /> : null}
      <Centered x={468} y={600}>
        {scene.trace ? (
          <TraceIcon name={scene.icon} size={120} color={colors.stroke} start={start} />
        ) : (
          <div style={popStyle(frame, start, { boost: beat.scene.isReveal })}>
            <Icon name={scene.icon} size={120} color={colors.stroke} />
          </div>
        )}
      </Centered>
    </>
  );
}

// F7 — IMAGE_BEAT: fade 9f at tA−4 scale 1.05, push 1.05 → 1.00 over D.push,
// headline RISE at tA+6.
//
// REBUILT for PART 2/3/4 of the rebuild:
//  - No accent tint over the photo (PART 2 — photographic assets keep their
//    own tone, never tinted to the accent). No partial-desaturation filter
//    either — that was neither full colour nor real black-and-white, just a
//    muddy wash by another name.
//  - No rounded-corner inset card (PART 4.5 "no floating bordered
//    rectangles"). The frame bleeds to the canvas's real right and bottom
//    edges (PART 3.1 "objects are cropped by the frame edge deliberately")
//    instead of sitting fully inset with visible corners. The left edge
//    stays at the stage/rail line (48px) so the persistent rail is never
//    painted over.
//  - The credit line — real sourced-image attribution, not fabricated text
//    — runs vertically along the image's right edge (PART 3.4 "one element
//    may run vertically along a frame edge as an anchor").
//
// PART 6 of the rebuild — "no raw photo reaches a frame." scene.image now
// carries scene.imageTreatment from asset-sourcing/treat.js:
//  - "cutout": a rembg-isolated subject on a transparent PNG with its
//    contact shadow already baked in (treat.js). Rendered `object-fit:
//    contain` and centred in the stage box — a product shot, not a photo
//    meant to fill the frame — never `cover`-cropped, which would clip the
//    subject or the shadow arbitrarily.
//  - "fullbleed" (or no treatment at all, e.g. an untreated legacy b-roll
//    fixture): unchanged pre-PART-6 behaviour — `object-fit: cover`,
//    bleeding to the canvas edge.
// Stage box in DesignSpace's 1080×1920 design-space pixels (see the
// left/top/right/bottom literals below) — ThreeCanvas needs explicit
// numeric width/height (unlike <img>, it can't just fill a flexible CSS
// box), and DesignSpace's own `transform: scale(S)` wrapper (useLayout(),
// above) already scales this whole subtree to the real output resolution
// exactly like it does for every other beat's design-space coordinates,
// so these stay fixed design-space pixels, not useVideoConfig()'s output
// pixels.
const IMAGE_STAGE_W = 1080 - 48 - 0; // left:48, right:0
const IMAGE_STAGE_H = 1920 - 392 - 780; // top:392, bottom:780

// vox-style-treatment SKILL.md's "Fallback: cutout quality fails the rembg
// gate" section. treat.js's classify() (src/skills/asset-sourcing/treat.js)
// is that gate — a photo only ever gets imageTreatment:"fullbleed" because
// rembg's segmentation didn't find a clean, isolated subject (coverage too
// high or the alpha mask touches 3+ edges: "texture/landscape filling the
// frame, not an isolated object"). treat.js already does NOT discard that
// photo — it saves a tone-normalized fullbleed JPEG instead of a cutout PNG,
// and select.js/image-assets.js already carry it through unfiltered. What
// WAS missing: at render time, a fullbleed photo was just filling the same
// bounded stage box a cutout uses, not reading as "that beat's own
// background" the way the skill asks for. This stage box is fullbleed-only:
// edge-to-edge width, and tall enough to run underneath the caption zone
// (CAPTION.zoneBottom=1248) rather than stopping short of it, so the photo
// genuinely reads as a background instead of a bounded panel.
const FULLBLEED_STAGE_TOP = 392; // same top as the cutout stage — HeadlineBox grows upward into the slack above this, never below it
const FULLBLEED_STAGE_BOTTOM_EDGE = 1290; // ~40px past CAPTION.zoneBottom (1248)
const FULLBLEED_STAGE_H = 1920 - FULLBLEED_STAGE_TOP - (1920 - FULLBLEED_STAGE_BOTTOM_EDGE);

export function ImageBeatScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  const push = Easing.spring({ damping: 200 })(ease(frame - start, [0, D.push], [0, 1], E_OUT));
  if (!scene.image) return null;
  const isCutout = scene.imageTreatment === "cutout";
  const stageW = isCutout ? IMAGE_STAGE_W : 1080;
  const stageH = isCutout ? IMAGE_STAGE_H : FULLBLEED_STAGE_H;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: isCutout ? 48 : 0,
          top: FULLBLEED_STAGE_TOP, // 392 either way
          right: 0, // bleeds past the 888 safe-right edge to the real canvas edge (1080)
          bottom: isCutout ? 780 : 1920 - FULLBLEED_STAGE_BOTTOM_EDGE,
          opacity: ease(frame - start, [0, D.base], [0, 1], E_OUT),
          scale: `${1.05 - push * 0.05}`,
          transformOrigin: "center",
        }}
      >
        {/* vox-style-treatment SKILL.md's per-photo treatment: real,
            tested libraries (postprocessing's Vignette/Noise/
            ChromaticAberration/DotScreen + a real 3D LUT), never freehand
            shader math — see effects/PhotoTreatment.jsx. Contain/cover
            sizing for cutout/fullbleed now happens INSIDE PhotoTreatment's
            own Plane (matching the old <img> maxWidth:88%/maxHeight:92%-
            contain vs 100%-cover logic exactly), so this wrapper no longer
            needs the flex-centering the plain <img> required — the canvas
            is always the full stage box and the plane is centered within
            it. */}
        <PhotoTreatment
          src={staticFile(scene.image)}
          treatment={isCutout ? "cutout" : "fullbleed"}
          width={stageW}
          height={stageH}
        />
        {!isCutout ? (
          // Gradient scrim WITHIN the photo layer only (never the canvas —
          // cutout and typography-only beats have no gradient, unchanged).
          // Fades to the channel's own bg color, fully opaque well before
          // the caption zone starts (80% of this box's height = y≈1110,
          // CAPTION.zoneTop=1152) so the caption's existing stroke-outlined
          // text — unchanged, "same type rules as elsewhere" — sits on a
          // clean, consistent surface exactly like it does over the flat
          // canvas on every other beat type, instead of directly on top of
          // uncontrolled photo detail.
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(to bottom, transparent 0%, transparent 45%, ${colors.bg} 80%, ${colors.bg} 100%)`,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The stage router.
 *
 * PRIMARY PATH — the visual plan (visual/director.js) decides what the
 * viewer sees, and SemanticScene (scenes/index.jsx) draws it. The plan
 * carries its own timed visual states, so one authored concept can play
 * through several meaningful moments instead of holding one static card.
 *
 * LEGACY PATH — the archetype switch below. It survives for exactly two
 * cases, both real:
 *   1. a caller that builds beats without going through buildMgPackage
 *      (verify-compositions.js fixtures, older tests),
 *   2. LIST_ITEM, which is not stage-routed at all — consecutive LIST_ITEM
 *      beats accumulate as chips via ListRuns, which is already a real
 *      non-icon visual system and had no reason to be replaced (PART 26).
 *
 * The old default case was StatementScene: a single 120px icon, and
 * nothing else, for any beat the classifier couldn't read. That is the
 * template this whole change exists to remove, so the default now routes
 * through the plan-aware path instead.
 */
function StageScene({ beat, colors, fontFamily }) {
  const { scene } = beat;

  if (beat.visualPlan) {
    return <SemanticScene beat={beat} colors={colors} fontFamily={fontFamily} />;
  }

  switch (beat.archetype) {
    case "HERO_NUMBER":
      return <HeroNumberScene beat={beat} scene={scene} colors={colors} fontFamily={fontFamily} />;
    case "TERM_DEFINE":
      return <TermDefineScene beat={beat} scene={scene} colors={colors} fontFamily={fontFamily} />;
    case "CONTRAST":
      return <ContrastScene beat={beat} scene={scene} colors={colors} fontFamily={fontFamily} />;
    case "PROGRESS":
      return <ProgressScene beat={beat} scene={scene} colors={colors} fontFamily={fontFamily} />;
    case "RELATION":
      return <RelationScene beat={beat} scene={scene} colors={colors} fontFamily={fontFamily} />;
    case "IMAGE_BEAT":
      return <ImageBeatScene beat={beat} scene={scene} colors={colors} fontFamily={fontFamily} />;
    default:
      return <StatementScene beat={beat} scene={scene} colors={colors} fontFamily={fontFamily} />;
  }
}

// F3 — LIST_ITEM runs. Chips accumulate; prior chips dim + shift up 88u;
// max 4 visible; a 5th drops the first with a 6-frame fade. The whole run is
// one Sequence so chips persist across item beats.
//
// REBUILT for PART 3.2/3.3 of the rebuild: the whole visible stack now sits
// inside ONE flat card (Panel — MANUAL A5.1, a hairline border, no per-item
// box) with a faint dot-grid behind it (spatial reference, not decoration —
// PART 3.2), matching the reference "a card listing short items stacked
// vertically". Each row's marker is a small "+" glyph, not a number/bullet/
// dash (PART 3.3), sized to match the item text.
const LIST_PANEL = { left: 64, top: 560, width: 824, height: 400 };

function ListRunScene({ beats, startFrame, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const chipFrames = beats.map((b) => Math.max(b.anchorFrame - startFrame - D.micro, 0));
  let lastArrived = -1;
  for (let i = 0; i < chipFrames.length; i++) {
    if (chipFrames[i] <= frame) lastArrived = i;
  }
  if (lastArrived < 0) return null;

  const dropIdx = lastArrived - 4;
  const visible = [];
  for (let k = 0; k <= lastArrived; k++) {
    if (k === dropIdx) visible.push({ k, dropping: true });
    else if (k >= lastArrived - 3) visible.push({ k, dropping: false });
  }
  const panelOpacity = ease(chipFrames[0] !== undefined ? frame - chipFrames[0] : frame, [0, D.base], [0, 1], E_OUT);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: LIST_PANEL.left,
          top: LIST_PANEL.top,
          width: LIST_PANEL.width,
          height: LIST_PANEL.height,
          opacity: panelOpacity,
        }}
      >
        <Panel colors={colors} style={{ border: `1px solid ${colors.stroke}`, overflow: "hidden" }}>
          <Solid
            width={LIST_PANEL.width}
            height={LIST_PANEL.height}
            color={colors.stroke}
            effects={[dotGrid({ dotSize: 6, gridSize: 56 })]}
            style={{ position: "absolute", inset: 0, opacity: 0.1 }}
          />
        </Panel>
      </div>
      {visible.map(({ k, dropping }) => {
        const beat = beats[k];
        const tA = Math.max(beat.anchorFrame - startFrame, 0);
        const entrance = chipFrames[k];
        const shiftBase = 940 - (lastArrived - 1 - k) * 88;
        const shiftProg = k < lastArrived
          ? ease(frame - entrance, [0, 5], [0, 1], E_OUT)
          : 1;
        const bottom = shiftBase - (k < lastArrived ? shiftProg * 88 : 0);
        const dimProg = k < lastArrived ? ease(frame - entrance, [0, 5], [0, 1], E_OUT) : 0;
        const dropOpacity = dropping ? ease(frame - entrance, [0, D.short], [1, 0], E_IN) : 1;
        const pop = popStyle(frame, entrance);
        const markerAccent = frame >= tA && frame < tA + D.short + 2;
        const textColor = k === lastArrived ? colors.textPrimary : mixColor(colors.textPrimary, colors.textDim, dimProg);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 88,
              bottom,
              width: 760,
              height: 88,
              display: "flex",
              alignItems: "center",
              gap: 20,
              paddingLeft: 24,
              paddingRight: 24,
              opacity: dropOpacity,
              ...pop,
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 800,
                fontSize: TYPE.body,
                lineHeight: 1,
                color: markerAccent ? colors.accent : colors.textDim,
              }}
            >
              +
            </span>
            <span style={{ fontFamily, fontWeight: 700, fontSize: TYPE.body, color: textColor }}>
              {beat.scene.item || beat.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function listRuns(beats) {
  const runs = [];
  let cur = null;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i].archetype === "LIST_ITEM") {
      if (!cur) cur = [];
      cur.push(i);
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration — absolute-timeline beats + list runs + per-section kicker.
// ─────────────────────────────────────────────────────────────────────────────

function BeatStages({ beats, colors, fontFamily }) {
  const last = beats.length - 1;
  return (
    <>
      {beats.map((b, i) => {
        if (b.archetype === "LIST_ITEM") return null;
        const exit = i < last && beats[i + 1].sectionIndex !== b.sectionIndex;
        return (
          <Sequence
            key={b.startFrame}
            from={b.startFrame}
            durationInFrames={b.durationInFrames + (i === last ? TAIL : 0)}
          >
            <StageContainer beat={{ ...b, scene: { ...b.scene, exit } }}>
              <StageScene beat={{ ...b, scene: { ...b.scene, exit } }} colors={colors} fontFamily={fontFamily} />
            </StageContainer>
          </Sequence>
        );
      })}
    </>
  );
}

function ListRuns({ beats, colors, fontFamily }) {
  return (
    <>
      {listRuns(beats).map((run) => {
        const first = beats[run[0]];
        const lastBeat = beats[run[run.length - 1]];
        const duration = lastBeat.startFrame + lastBeat.durationInFrames - first.startFrame;
        return (
          <Sequence key={`run-${first.startFrame}`} from={first.startFrame} durationInFrames={duration}>
            <ListRunScene beats={run.map((i) => beats[i])} startFrame={first.startFrame} colors={colors} fontFamily={fontFamily} />
          </Sequence>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level composition
// ─────────────────────────────────────────────────────────────────────────────

function MotionGraphicsContent({ mg, colors, fontFamily, showCaptions }) {
  const beats = mg.beats || [];
  const accentWindows = useMemo(
    () => beats.map((b) => b.scene && b.scene.accentWindow).filter(Boolean),
    [beats]
  );
  return (
    <>
      <DesignSpace captionDrop={showCaptions ? 0 : CAPTION_RESERVE_Y}>
        <BeatStages beats={beats} colors={colors} fontFamily={fontFamily} />
        <ListRuns beats={beats} colors={colors} fontFamily={fontFamily} />
        <HeadlineLayer beats={beats} colors={colors} fontFamily={fontFamily} />
        {/* NARRATION CAPTIONS ARE OFF BY DEFAULT.

            The viewer already has the narration in audio. Printing it again
            along the bottom made the video an animated transcript: the eye
            reads the sentence, the picture becomes decoration behind it, and
            the visual never has to carry the meaning. That is the single
            biggest reason the output read as "narration on a background".

            The SRT itself is untouched and remains load-bearing — it is
            still the timing source for beats, anchors and visual states
            (compositions/beats.js). What changed is only whether the words
            are DRAWN.

            CaptionLayer is preserved in full, not deleted: a channel that
            wants burned-in captions for accessibility sets
            `captions: "burned-in"` in channels.json and gets exactly the
            previous behaviour. See render.js's showCaptions. */}
        {showCaptions ? (
          <CaptionLayer pages={mg.pages || []} accentWindows={accentWindows} colors={colors} fontFamily={fontFamily} />
        ) : null}
      </DesignSpace>
      {/* The ONLY sound source in the video besides the voiceover and the
          optional underscore. mg.soundtrack is already spaced, capped,
          level-normalised against each file's measured loudness, and
          filtered out of the deliberate reveal silence (mg-package.js).
          Every event in it carries the visual state and the reason it
          fired, which is what qa-scripts/audio-qa.mjs checks. */}
      <Soundtrack events={mg.soundtrack} />
    </>
  );
}

function MotionGraphicsShorts({
  mg = null,
  sections = [],
  ttsAudioPath,
  hasUnderscore = false,
  font = "DM Sans",
  palette = null,
  channelName = "",
  // Default FALSE: narration belongs in the audio track, not printed over
  // the picture. render.js sets this true only when a channel opts in.
  showCaptions = false,
}) {
  const colors = rolesFromPalette(
    palette && typeof palette === "object" && !Array.isArray(palette)
      ? palette
      : Array.isArray(palette) && palette.length >= 3
        ? palette
        : FALLBACK_PALETTE
  );
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Background colors={colors} />
      {mg ? (
        <MotionGraphicsContent mg={mg} colors={colors} fontFamily={fontFamily} showCaptions={showCaptions} />
      ) : null}
      {/* music-sourcing/SKILL.md's whole-video underscore bed — distinct
          from the sound-design events above (short one-shot cues, not a
          continuous track). Static gain staging (a fixed, low level for
          the ENTIRE bed), not dynamic sidechain ducking: this pipeline
          has no VO-amplitude analysis to react to, and a fixed level well
          under both the voiceover and the sound events (-24dB here against
          the -20 to -30dB targets in sound-design.js's ROLE_GAIN_DB, itself
          already under the voiceover) reads as "present but never
          competing" without that added machinery.
          hasUnderscore comes from render.js checking whether
          the committed public/music/underscore.mp3 actually exists —
          optional, so no static import (that would break the bundle on
          any checkout that hasn't fetched a track). */}
      {hasUnderscore ? <Audio src={staticFile("music/underscore.mp3")} volume={dbToVolume(-24)} loop /> : null}
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
    </AbsoluteFill>
  );
}

function MotionGraphicsLongform(props) {
  return <MotionGraphicsShorts {...props} />;
}

export const compositions = [
  {
    id: "MotionGraphicsShorts",
    component: MotionGraphicsShorts,
    durationInFrames: 30 * 60,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: "MotionGraphicsLongform",
    component: MotionGraphicsLongform,
    durationInFrames: 30 * 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },
];

export { MotionGraphicsShorts, MotionGraphicsLongform };
