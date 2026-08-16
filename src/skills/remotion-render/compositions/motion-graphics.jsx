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
import { noise } from "@remotion/effects/noise";
import { evolvePath, getSubpaths } from "@remotion/paths";
import { makeCircle, makeRect } from "@remotion/shapes";
import { measureText, fitTextOnNLines, HEADLINE_FONT, fontStyleFor } from "../layout/measure.js";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { resolveFontFamily } from "./visual.js";
import { Panel } from "../primitives/Panel.jsx";
import { D, MG_TYPE as TYPE, CAPTION } from "./beats.js";
import { rolesFromPalette, strokeAttr, mixColor } from "./mg-style.js";
import { ICON_INNER } from "./icons-data.js";

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

// D2.1 POP — scale 0 → 1.15 → 1.00 over 9f, opacity 0 → 1 over 3f.
function popStyle(frame, start) {
  return {
    opacity: ease(frame - start, [0, 3], [0, 1], E_OUT),
    scale: easeScale(frame - start, [0, 5, 9], [0, 1.15, 1], E_OUT),
    transformOrigin: "center",
  };
}

// D2.2 RISE — translateY +24 → 0 over 9f, opacity 0 → 1 over 6f. No scale.
function riseStyle(frame, start, offsetPx = 24) {
  return {
    opacity: ease(frame - start, [0, D.short], [0, 1], E_OUT),
    translate: `0px ${offsetPx * ease(frame - start, [0, D.base], [1, 0], E_OUT)}px`,
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

function fmtValue(v) {
  if (!Number.isFinite(v)) return "0";
  if (Number.isInteger(v)) return v.toLocaleString("en-US");
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
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

function DesignSpace({ children }) {
  const { S, shiftX, shiftY } = useLayout();
  return (
    <div
      style={{
        position: "absolute",
        left: shiftX,
        top: shiftY,
        width: 1080,
        height: 1920,
        transform: `scale(${S})`,
        transformOrigin: "top left",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Background — A6: flat bg → dotGrid (stroke 6%) → content → grain (noise 4%).
// ─────────────────────────────────────────────────────────────────────────────

function Background({ colors }) {
  const { width, height } = useVideoConfig();
  return (
    <>
      <Solid width={width} height={height} color={colors.bg} style={{ position: "absolute", inset: 0 }} />
      <Solid
        width={width}
        height={height}
        color={colors.stroke}
        effects={[dotGrid({ dotSize: 8, gridSize: 80 })]}
        style={{ position: "absolute", inset: 0, opacity: 0.06 }}
      />
      <Solid
        width={width}
        height={height}
        color="#ffffff"
        effects={[noise({ amount: 0.05 })]}
        style={{ position: "absolute", inset: 0, opacity: 0.04 }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome — rail (D5) + kicker (A1.3). Continuous furniture, identical every
// beat; the only accent on them is the section rule + the rail fill.
// ─────────────────────────────────────────────────────────────────────────────

function Rail({ colors, progress }) {
  return (
    <div style={{ position: "absolute", left: 48, top: 288, width: 4, height: 1248 - 288 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: colors.stroke,
          opacity: 0.25,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 4,
          height: progress * (1248 - 288),
          backgroundColor: colors.accent,
          borderRadius: 2,
        }}
      />
    </div>
  );
}

// PART 4.3 of the rebuild: the kicker used to fall back to the channel name
// ("— MONEY MIND") and, before that, to the script's raw section id
// ("SECTION 1", "HOOK") — both are scaffolding, not content the viewer can
// use ("Kicker: position in the argument", MOTION-GRAPHICS-MANUAL.md C3.1
// table — never the channel name, which is exactly "content"). There is no
// script field that reliably names a section without either fabricating
// text or leaking structure, so the kicker renders ONLY what is genuinely
// known and non-fabricated: the accent progress tick (a shape) and the
// section's ordinal (a number, not a word). No word label.
function Kicker({ colors, fontFamily, sectionNumber }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 90, stiffness: 80 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 312,
        left: 80,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: p,
      }}
    >
      <div
        style={{
          width: 40,
          height: 6,
          backgroundColor: colors.accent,
          borderRadius: 3,
          transformOrigin: "left",
          scale: `${p}`,
        }}
      />
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: TYPE.kicker,
          letterSpacing: 4,
          color: colors.textDim,
        }}
      >
        {String(sectionNumber).padStart(2, "0")}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SFX — E4. Fires on the frame the visual lands, never on the word (E4.3).
// Sequence `from` is relative to the enclosing sequence timeline.
// ─────────────────────────────────────────────────────────────────────────────

function Sfx({ file, at, db }) {
  if (!file) return null;
  return (
    <Sequence from={at} durationInFrames={60}>
      <Audio src={staticFile(file)} volume={dbToVolume(db)} />
    </Sequence>
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

function CaptionLayer({ pages, accentWindows, colors, fontFamily }) {
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

  const popOpacity = ease(rel, [0, 5], [0, 1], E_OUT);
  const popScale = easeScale(rel, [0, 5, 8], [0.88, 1.04, 1.0], E_OUT);
  const popTranslate = ease(rel, [0, 6], [14, 0], E_OUT);

  const exitOpacity = exitRel <= 3 && exitRel > 0 ? ease(exitRel, [0, 3], [0, 1], E_IN) : 1;
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
          opacity: popOpacity * exitOpacity,
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
  const ruleWidth = useMemo(
    () => measureText({ text: scene.headline, ...fontStyle, fontSize }).width,
    [scene.headline, fontStyle, fontSize]
  );

  const rise = riseStyle(frame, start);
  const ruleProg = ease(frame - (tA + 6), [0, D.large], [0, 1], E_OUT);
  const setupRise = riseStyle(frame, Math.max(start - D.short, 0));

  return (
    // Bottom-anchored at the headline zone's own bottom edge (964+176=1140),
    // not a fixed top — a 2-line headline (setup line, or a payload that
    // wraps) grows UPWARD into the Stage zone's slack instead of downward
    // into the caption zone below. Top-anchoring at a fixed y produced a
    // real, confirmed defect: a 2-line headline's second line rendered
    // directly on top of the caption text.
    <div style={{ position: "absolute", bottom: 1920 - 1140, left: 468, translate: "-50% 0px", width: "max-content", maxWidth: 780, ...rise }}>
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
        {fit.lines.map((line, i) => (
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

function HeadlineLayer({ beats, colors, fontFamily }) {
  return (
    <>
      {beats
        .filter((b) => b.archetype !== "LIST_ITEM" && b.scene && b.scene.headline)
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
              fontFamily,
              fontWeight: 800,
              fontSize: TYPE.hero,
              color: colors.accent,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              ...popStyle(frame, start),
            }}
          >
            {formatCounter(counter, scene.value)}
          </span>
        </div>
        <Sfx file="sfx/ui/click_004.ogg" at={start + D.push} db={-22} />
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
          the icon's own footprint plus padding. */}
      <DashedRing x={468} y={600} radius={140} start={start} colors={colors} />
      <Centered x={468} y={600}>
        {scene.trace ? (
          <TraceIcon name={scene.icon} size={180} color={colors.stroke} start={start} />
        ) : (
          <div style={popStyle(frame, start)}>
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
          ...popStyle(frame, rightStart),
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
        const start = Math.max(tA - D.micro, 0) + i * 5;
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
              {fmtValue(s.value * g)}
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
      {series.some((s) => s.highlight) ? (
        <Sfx
          file="sfx/ui/click_004.ogg"
          at={Math.max(tA - D.micro, 0) + series.findIndex((s) => s.highlight) * 5 + 24}
          db={-22}
        />
      ) : null}
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
  const bPop = popStyle(frame, bStart);
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
          translate: "-50% 0px",
          width: 240,
          textAlign: "center",
          fontFamily,
          fontWeight: 400,
          fontSize: TYPE.support,
          color: colors.textPrimary,
          ...riseStyle(frame, bStart + 6),
        }}
      >
        {(scene.b || []).join(" ")}
      </div>
    </div>
  );
}

// F8 — STATEMENT: icon 120 POP at tA−4, headline RISE at tA. Nothing else.
function StatementScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  return (
    <>
      <DashedRing x={468} y={600} radius={100} start={start} colors={colors} opacity={0.4} />
      <Centered x={468} y={600}>
        {scene.trace ? (
          <TraceIcon name={scene.icon} size={120} color={colors.stroke} start={start} />
        ) : (
          <div style={popStyle(frame, start)}>
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
function ImageBeatScene({ beat, scene, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tA = Math.max(beat.anchorFrame - beat.startFrame, 0);
  const start = Math.max(tA - D.micro, 0);
  const push = Easing.spring({ damping: 200 })(ease(frame - start, [0, D.push], [0, 1], E_OUT));
  if (!scene.image) return null;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 48,
          top: 392,
          right: 0, // bleeds past the 888 safe-right edge to the real canvas edge (1080)
          bottom: 780, // bleeds down toward the caption zone (past the 940 stage floor)
          overflow: "hidden",
          opacity: ease(frame - start, [0, D.base], [0, 1], E_OUT),
          scale: `${1.05 - push * 0.05}`,
          transformOrigin: "center",
        }}
      >
        <img
          src={staticFile(scene.image)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          alt=""
        />
      </div>
      {scene.credit ? (
        <span
          style={{
            position: "absolute",
            right: 24,
            top: 392 + 24,
            transformOrigin: "top right",
            transform: "rotate(90deg) translateX(0)",
            whiteSpace: "nowrap",
            fontFamily,
            fontWeight: 400,
            fontSize: TYPE.label,
            letterSpacing: 1,
            color: colors.textDim,
            textShadow: `0 0 8px ${colors.bg}, 0 0 8px ${colors.bg}`,
            ...riseStyle(frame, start + D.short),
          }}
        >
          {scene.credit}
        </span>
      ) : null}
    </div>
  );
}

function StageScene({ beat, colors, fontFamily }) {
  const { scene } = beat;
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
      <Sfx file="sfx/ui/click_001.ogg" at={chipFrames[lastArrived] + D.micro} db={-24} />
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

function SectionKickers({ beats, sectionRanges, colors, fontFamily }) {
  const indices = Object.keys(sectionRanges || {})
    .map(Number)
    .sort((a, b) => a - b);
  return (
    <>
      {indices.map((idx) => {
        const range = sectionRanges[idx];
        return (
          <Sequence key={`k-${idx}`} from={range.from} durationInFrames={Math.max(range.to - range.from, 1)}>
            <Kicker colors={colors} fontFamily={fontFamily} sectionNumber={idx + 1} />
          </Sequence>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level composition
// ─────────────────────────────────────────────────────────────────────────────

function MotionGraphicsContent({ mg, colors, fontFamily }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const beats = mg.beats || [];
  const accentWindows = useMemo(
    () => beats.map((b) => b.scene && b.scene.accentWindow).filter(Boolean),
    [beats]
  );
  const railProgress = ease(frame, [0, durationInFrames - 1], [0, 1]);
  const boundaryFrames = beats
    .map((b, i) => (i > 0 && beats[i - 1].sectionIndex !== b.sectionIndex ? b.startFrame : null))
    .filter((v) => v !== null);

  return (
    <>
      <DesignSpace>
        <Rail colors={colors} progress={railProgress} />
        <SectionKickers beats={beats} sectionRanges={mg.sectionRanges} colors={colors} fontFamily={fontFamily} />
        <BeatStages beats={beats} colors={colors} fontFamily={fontFamily} />
        <ListRuns beats={beats} colors={colors} fontFamily={fontFamily} />
        <HeadlineLayer beats={beats} colors={colors} fontFamily={fontFamily} />
        <CaptionLayer pages={mg.pages || []} accentWindows={accentWindows} colors={colors} fontFamily={fontFamily} />
      </DesignSpace>
      {boundaryFrames.map((f) => (
        <Sfx key={`w-${f}`} file="sfx/transitions/close_001.ogg" at={f} db={-18} />
      ))}
    </>
  );
}

function MotionGraphicsShorts({
  mg = null,
  sections = [],
  ttsAudioPath,
  font = "DM Sans",
  palette = null,
  channelName = "",
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
        <MotionGraphicsContent mg={mg} colors={colors} fontFamily={fontFamily} />
      ) : null}
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
