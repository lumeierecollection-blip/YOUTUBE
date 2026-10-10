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
import { POP, PHOTO_COMPS, popGroups, popInState, popOutState } from "./pop-groups.js";
export { POP, popGroups };
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { StudioBG } from "./studio-bg.jsx";
import { ICON_SET } from "./icon-set.js";
import { dateParts } from "./date-parts.js";
import { KineticText, rowsOf } from "./kinetic.jsx";
import { wordPops } from "./word-sync.js";
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
  canvasLayout, contentBounds, focusBox, textWidth, normalizeCanvas, liftAccent, L_EDGE, R_EDGE,
  TOP, BOTTOM, ZONES, ZONE_TOL, flattenBoxes, elementType, zonesOf, backgroundOf, PAPER_OPACITY, BG_RULE, BG_GRADIENT,
  FRAMED_PHOTO_COMPS, FULL_PHOTO_COMPS, HERO_COMPS, TYPE_CARD_COMPS, CAMERA, readableAccent,
} from "./canvas-layout.js";

// Paper texture (part C.3): fractal noise in grey at PAPER_OPACITY over the white ground —
// a difference the eye registers, not a design change. Static: it does not crawl.
function PaperTexture({ drift = 0 }) {
  return (
    <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0, opacity: PAPER_OPACITY, transform: `translate(${drift.toFixed(3)}px, ${(drift * 0.6).toFixed(3)}px)` }}>
      <filter id="paper-noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width={FRAME.w} height={FRAME.h} filter="url(#paper-noise)" />
    </svg>
  );
}
import {
  ROLE_HEADLINE, ROLE_NUMBER, ROLE_DATA, ROLE_EMPHASIS, SERIF, SANS_STACK, roleFont, roleTracking, numberSlots, measure,
  SUPERSCRIPT_SCALE, capHeightEm,
} from "./typography.js";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
const lerp = (a, b, t) => a + (b - a) * t;
// CAMERA (owner, 2026-10-09: "real camera moves of 8% or more" on photos and graphs). A photo pushes
// in 1.00 -> 1.10 across the beat (its frame crops it, so the push never shows an edge). A graph is
// laid out at its full size and STARTS 10% smaller, growing to it about its floor: it is inside its
// band at every frame, and the move is 1 / 0.909 = 10%. Both ease over the first 90% of the beat.
// Everything else holds still (the pop compositor draws nothing else in space).
// `start`: the frame the picture itself appears (a photo that pops on its spoken word, canvas.entity_pop) — the move
// runs from there to the end of the beat, so the viewer sees all of it (board 37925838913 ch-8 beat 6: the photo
// landed at ~60% of its beat, and a camera that had been running since frame 0 was mostly spent when it did).
// Compositions that carry their own motion across the beat (a photo pushes, a graph grows, a map outlines, entity art lives).
// The ambient push runs at a CONSTANT speed (2%/s, at most 10% over the beat), not as a fixed share of the beat: a 7 s beat that only
// settled 3% moved 0.4%/s — under what a viewer (or the pace check) sees (board 37967524047: TYPE-FULL static 3.5 s, TYPE-CHAPTER 3.25 s).
export const AMBIENT = Object.freeze({ amp: 0.15, rate: 0.03 });   // 3%/s, at most 15% over a long beat (7 s: 2.1%/s)
/** The push's scale at beat-local frame `local` of `dur`: it starts smaller and arrives at 1 as the beat ends (always inside its zone). */
// A capped push stops once it hits its cap (board 37978510400: plates and numbers static 2.5-3.5 s in the last half of a 7 s beat). The ambient is
// a slow continuous ease-in-out sweep instead — in and out over `period` seconds, never beyond its range — so a beat of any length keeps moving.
// The ambient push is MONOTONE (owner, 2026-10-10: nothing wobbles, nothing settles): one slow push-in across the whole beat, linear,
// arriving at 1 on the beat's last frame — never in-and-out. `push(local, dur, fps, amp)` grows 0 -> amp over the beat.
export const push = (local, dur, fps, amp = AMBIENT.amp) => { const s = Math.max(1, dur / fps), a = Math.min(amp, AMBIENT.rate * s); return a * clamp01(local / Math.max(1, dur)); };
// Words alone (a TYPE beat) have nothing else that moves once the last word is in: their push runs 3.5%/s to 25% on a long beat.
// The push decelerates (ease-out, monotone, never past 1): fastest at the beat's start, when only the first words are in and the frame
// is sparse, slowing as the frame fills (layout-proof 38017734111: a linear push left the first 2 s of a long words-only beat under the
// pace threshold while the rest moved).
export const ambientScale = (local, dur, fps, words = false) => { const s = Math.max(1, dur / fps), amp = words ? 0.26 : AMBIENT.amp, rate = words ? 0.04 : AMBIENT.rate, a = Math.min(amp, rate * s), u = clamp01(local / Math.max(1, dur)); return 1 - a + a * (0.5 * (1 - Math.pow(1 - u, 2.2)) + 0.5 * u); };   // half ease-out, half linear: quick while sparse, never stopping before the cut
export const sweep = (local, fps, amp, dur = 6 * fps) => push(local, dur, fps, amp);
// A long beat needs a longer move, not a slower one (board 38034289156: the Gemini narrator's beats run 6-10 s and a fixed 6-10% push sat
// still 8-10 s). `grow(local, dur, fps, floor)` is the push a picture makes over its beat: at least `floor`, else 3%/s up to 30%, as
// half ease-out / half linear (monotone, never past its end, never reversing).
export const grow = (local, dur, fps, floor = 0.06) => { const s = Math.max(1, dur / fps), a = Math.max(floor, Math.min(0.30, 0.03 * s)), u = clamp01(local / Math.max(1, dur)); return a * (0.5 * (1 - Math.pow(1 - u, 2.2)) + 0.5 * u); };
const AMBIENT_SKIP = [...FULL_PHOTO_COMPS, ...FRAMED_PHOTO_COMPS, "DATA-FULL", "MAP-CENTERED", "ENTITY-ART"];
const camP = (local, dur, start = 0) => easeInOut(clamp01((local - start) / Math.max(1, (dur - start) * CAMERA.endAt)));
export const cameraStart = (c) => (Number.isFinite(c?.entity_pop?.frame) && c.photo ? Math.max(0, c.entity_pop.frame) : 0);
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

/**
 * FLAT entrance for drawn art (flag, plate, date card, time scale): an ease-in-out settle 0.97 -> 1 with a fade over 6 frames — no
 * overshoot, no bounce, no rise (owner, 2026-10-09: components must not look playful). Text keeps the kinetic POP family.
 */
const flatState = (f, frames = 6) => { const e = f < 0 ? 0 : easeInOut(clamp01(f / frames)); return { o: f < 0 ? 0 : 0.4 + 0.6 * e, s: 0.97 + 0.03 * e }; };   // visible from its first frame: a beat boundary is never empty (pop-transitions)
function flatCss(f, origin = "50% 50%") { const p = flatState(f); return { opacity: p.o, transform: `scale(${p.s.toFixed(4)})`, transformOrigin: origin }; }
function flatSvg(f, cx, cy) { const p = flatState(f); return { opacity: p.o, transform: `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${p.s.toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})` }; }

// ── motion helpers ────────────────────────────────────────────────────
function useMotion(c, local, dur, fps) {
  const tier = c.motion_tier || "medium";
  const s = (sec) => sec * fps;
  const build = (share = 0.4, delay = 0) => (tier === "micro" ? easeOut(clamp01((local - delay) / s(0.35))) : easeOut(clamp01((local - delay) / Math.max(1, dur * share))));
  const breathe = 1;          // nothing breathes or wobbles (owner, 2026-10-10)
  const jitter = (k = 0) => 0 * k;
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
  // (A number beat's headline waited until 50% of the beat when every group was drawn settled;
  // drawn live, the beat's top was empty for half its length — CI run 37141128792 ch-26.)
  void hasNum;
  // Shares of the beat, capped in seconds: on a 7 s beat 40% / 30% left the first 2-3 s with only the header on screen (the pace gate).
  return { headlineAt: 0, numberAt: 0, labelAt: Math.min(sec(0.4), 1.2), splitAt: Math.min(sec(0.3), 0.8) };
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
    <KineticText b={b} color={color} accent={accent || A?.accent || color} local={local} dur={dur} start={start} resolveBy={resolveBy} exitAt={9}
      entrances={A?.kinetic?.entrances?.[role]} font={SERIF} lineHeight={b.size * ROLE_HEADLINE.lineHeight} tracking={roleTracking(ROLE_HEADLINE, b.size)}
      group="headline" edge={!!A?.kinetic?.edge} wordAt={wordPops(rowsOf(b).flat().map((w) => w.text), A?.spoken, dur)} />
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
        resolveBy={Math.min(0.85, startFrac + 0.2)} exitAt={9} entrances={A?.kinetic?.entrances?.[role]} upper={!!b.upper}
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
      transformOrigin: b.align === "right" ? "right bottom" : b.align === "center" ? "center bottom" : "left bottom" }}>
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
  return <div style={{ position: "absolute", left: b.x + (b.anchor === "right" ? b.w - w : b.anchor === "center" ? (b.w - w) / 2 : 0), top: b.y, width: w, height: b.h, backgroundColor: color }} />;
};

// The header every composition with a compact top shares: the hairline rule,
// the lead-in / folio as a small data label, the headline. Pinned outside the
// camera, so a push or a major zoom never crops it.
function HeaderBlock({ B, th, local, fps, m, idx, tl, halo = null }) {
  return (
    <>
      <Rule b={B.rule} t={m.build(0.3, m.s(0.1))} color={th.ink} />
      {B.kicker ? <DataLabel b={B.kicker} name="kicker" color={B.kicker.muted ? th.soft : th.ink} local={local} fps={fps} at={tl.labelAt} /> : null}
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
        {/* No label: a hairline holds the middle zone's floor under the figure (canvas-layout.js NUMBER-FULL). */}
        {B.floor_rule ? <Rule b={B.floor_rule} t={m.build(0.3, m.s(0.1))} color={th.ink} /> : null}
      </>
    );
  }
  if (B.emphasis) return <Emphasis b={B.emphasis} color={th.ink} local={local} fps={fps} />;
  if (B.portrait) return <Portrait b={B.portrait} local={local} fps={fps} at={tl.headlineAt + 0.3} dur={dur} />;
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
        {/* The visual's own delay is 0.45 s behind the headline (headline-then-visual). Under
            "visual-first" the visual is the group that lands FIRST (pop-groups.js: visual at 0, the
            headline's group at 14), so that delay stacks on top of the group's: ch-05 beat 5 (CI run
            37687564970) drew nothing between the outgoing beat's fade (gone at frame 6) and the
            visual's own pop at frame ~14 — the group was "in" at frame 2, so the hold in CanvasVideo
            (incomingHasInk reads group opacity) had already released. Under visual-first the visual
            lands with its group. */}
        {[B.cutout0, B.cutout1, B.cutout2].filter(Boolean).map((v, i) => (
          // HERO-OVER: the object sits ABOVE its words and is alone in its band — waiting 0.45 s
          // behind the words left that band empty across the boundary (shot-proof run 37859081660,
          // pop-transitions frames 7-9). The object lands first there.
          <ConceptVisual key={i} b={v} local={local} fps={fps} at={(c.entrance_style === "visual-first" || L.composition === "HERO-OVER" ? 0 : tl.headlineAt + 0.45) + i * 0.12} accent={accent} dur={dur} />
        ))}
        {/* A logo's company name types on below it (part D.2). */}
        {B.cutout_name && B.cutout0?.logo ? <DataLabel b={B.cutout_name} name="cutout_name" color={th.ink} local={local} fps={fps} at={tl.headlineAt + 0.8} /> : null}
      </>
    );
  }
  // A name card (canvas-layout.js: a named entity with no verified photo): the name, then the key phrase under it.
  if (B.lead_phrase) {
    return (
      <>
        <Headline b={st} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={tl.headlineAt} major={major} hero accent={accent} />
        <DataLabel b={B.lead_phrase} name="label" color={th.ink} local={local} fps={fps} at={tl.headlineAt + 0.4} />
      </>
    );
  }
  // TYPE-SPLIT: the second half lands 0.5 s after the first (the header's headline).
  // Part D.2 (TYPE-FULL): every word pops in one at a time (KineticText), the whole statement
  // holds with a 0.5% breath, and a thin rule draws under it at 60% of the beat.
  const breath = 1;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${st.x + st.w / 2}px ${st.y + st.h / 2}px`, transform: `scale(${breath.toFixed(5)})` }}>
        {/* TYPE-SPLIT's second half waits tl.splitAt (30% of the beat) so it lands after the header's
            headline. Under "visual-first" that order is reversed by the groups (pop-groups.js: this,
            the middle band, at 0; the header at 14), so the wait stacked on top: ch-05 run 37700319999
            beat 5 was empty at frames 7-15 (outgoing beat gone, header not yet in, this half due at ~38).
            Under visual-first it lands with its group, as the concept visual does. */}
        <Headline b={st} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={B.headline && c.entrance_style !== "visual-first" ? tl.splitAt : tl.headlineAt} major={major} hero accent={accent} />
      </div>
      {B.underline ? <Rule b={B.underline} t={easeOut(clamp01((local - 0.6 * dur) / (0.12 * dur)))} color={accent} /> : null}
    </>
  );
}

/**
 * One concept visual in its layout box (concept-visuals.js): a CUTOUT is the
 * verified PNG (public/cutouts-live/ or png-bank/), contained in the box, with a soft drop
 * shadow (2 px, 20 px blur, 0.15); a SYMBOL is the drawn SVG in the channel
 * accent (no shadow — symbols are flat by design). Both pop in place (the
 * pop family, kinetic.js POP_STANDARD) from the bottom edge they stand on.
 */
// A named person's verified portrait (canvas-layout.js PORTRAIT): the photo at
// its own aspect in its box (not a circle, not a square), a soft drop shadow,
// popping in place from the floor it stands on.
function Portrait({ b, local, fps, at, dur = 150 }) {
  const pop = popCss("POP_STANDARD", local - Math.round(at * fps), "50% 100%");
  // Part D.2: the portrait pushes in 2% across the beat (from the floor it stands on), and its
  // soft shadow shifts 4 px.
  const p = clamp01(local / Math.max(1, dur));
  // clipPath: the soft shadow may spread sideways and up but never below the floor the portrait stands on —
  // it read as ink across y 1340 in 227 columns of a wide portrait (board 37937708124 ch-2 beat 4).
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, clipPath: "inset(-120px -120px 0 -120px)", ...pop }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 100%", transform: `scale(${(1 + 0.02 * p).toFixed(4)})` }}>
        <Img src={staticFile(b.asset)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 30%", boxShadow: `${(4 * p).toFixed(1)}px 14px 44px rgba(0,0,0,0.18)` }} />
      </div>
    </div>
  );
}

// Where each drawn symbol's ink ends, as a fraction of its 100-unit viewBox (symbols/*.jsx geometry).
const SYMBOL_INK_BOTTOM = { "warning-triangle": 0.90, checkmark: 0.89, "upward-arrow": 0.94, "downward-arrow": 0.94, radar: 0.96, "dollar-sign": 0.98, "broken-chain": 0.97, crosshair: 1 };
function ConceptVisual({ b, local, fps, at, accent, dur = 150 }) {
  const pop = popCss("POP_STANDARD", local - Math.round(at * fps), "50% 100%");
  // Part D.2. A logo pops in at 1.15x and settles over 8 frames; its soft shadow turns 2 deg
  // across the beat. A cutout pushes in 2% across the beat. (Both stand on their floor.)
  const p = clamp01(local / Math.max(1, dur));
  const since = local - Math.round(at * fps);
  const lift = b.logo ? 1 + 0.15 * (1 - easeOut(clamp01(since / 8))) : 1 + 0.02 * p;
  const ang = ((90 + 2 * p) * Math.PI) / 180;
  const shadow = b.logo ? `drop-shadow(${(6 * Math.cos(ang)).toFixed(2)}px ${(6 * Math.sin(ang)).toFixed(2)}px 18px rgba(0,0,0,0.16))` : "drop-shadow(2px 2px 20px rgba(0,0,0,0.15))";
  if (b.class === "cutout" && b.asset && b.img) {
    // The hero cutout (canvas-layout.js): the box is the ink's box; the image
    // rectangle (b.img, relative to it) may be larger — transparent margin —
    // and is rotated about its centre when the object is set on a diagonal.
    // A cropped scene (b.crop) is clipped to the box at the sides.
    return (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: b.crop ? "hidden" : "visible", ...pop }}>
        <Img src={staticFile(b.asset)} style={{ position: "absolute", left: b.img[0], top: b.img[1], width: b.img[2], height: b.img[3], maxWidth: "none",
          // A tilted object turns about its centre, as laid out (its ink box depends on it): no push.
          transform: b.tilt ? `rotate(${-b.tilt}deg)` : `scale(${lift.toFixed(4)})`, transformOrigin: b.tilt ? "50% 50%" : "50% 100%", filter: shadow }} />
      </div>
    );
  }
  if (b.class === "cutout" && b.asset) {
    return (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, ...pop }}>
        <Img src={staticFile(b.asset)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: b.align === "center" ? "50% 50%" : b.align === "right" ? "100% 100%" : "0% 100%",
          filter: "drop-shadow(2px 2px 20px rgba(0,0,0,0.15))" }} />
      </div>
    );
  }
  if (b.class === "symbol") {
    const s = Math.min(b.w, b.h);
    // Each symbol's ink stops short of its 100-unit viewBox (warning triangle at 90): the
    // symbol is lowered by that gap so its INK stands on the box floor, as a cutout's does.
    // Without it a warning-triangle hero spanned 59.2% (CI run 37126933290 ch-26 beat 4).
    const gap = s * (1 - (SYMBOL_INK_BOTTOM[b.concept] ?? 1));
    return (
      <div style={{ position: "absolute", left: b.align === "center" ? b.x + (b.w - s) / 2 : b.x, top: (b.align === "center" ? b.y + (b.h - s) / 2 : b.y + b.h - s) + gap, width: s, height: s, ...pop }}>
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
            // The rows stand on the chart's floor: the last bar ends at ch.y + ch.h. At 0.36 the
            // last row left 22% of a row empty under it — two bars stopped at y 1263 and the
            // beat read canvas-coverage 58.8% (CI run 37086054975 ch-44 beat 3).
            const y = ch.y + row * i + row * 0.58;
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
          })() : (() => {
            // Part D.2: the reference line at the top value, drawn down the chart once the bars have landed.
            const r = easeOut(clamp01((local - 0.55 * dur) / (0.12 * dur)));
            const x = ch.x + Wfull;
            return r > 0 ? <line x1={x} y1={ch.y} x2={x} y2={ch.y + ch.h * r} stroke={th.ink} strokeWidth={3} strokeDasharray="14 12" opacity={0.55} /> : null;
          })()}
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
                <text x={cx} y={base + 34} textAnchor="middle" style={{ font: dataFont(Math.max(24, ls)), letterSpacing: 0.4 }} fill={th.ink}
                  {...popSvg("POP_SOFT", g0, cx, base + 34 - ls * 0.35)}>{String(b.label).toUpperCase()}</text>
              </React.Fragment>
            );
          })}
          {modern && cid === "BAR_COMPARE" ? (() => {
            const r = stOf(primary).ref;
            return <line x1={ch.x} y1={base - plotH} x2={ch.x + ch.w * r} y2={base - plotH} stroke={th.ink} strokeWidth={4} strokeDasharray="14 12" opacity={0.7} />;
          })() : (() => {
            // Part D.2 (DATA-FULL): a reference line draws across the chart at the top value once the bars have landed.
            const r = easeOut(clamp01((local - 0.55 * dur) / (0.12 * dur)));
            return r > 0 ? <line x1={ch.x} y1={base - plotH} x2={ch.x + ch.w * r} y2={base - plotH} stroke={th.ink} strokeWidth={3} strokeDasharray="14 12" opacity={0.55} /> : null;
          })()}
        </svg>
      );
    }
  } else if (vt === "PIE") {
    const pct = Number(d.percent) || 0;
    const st = pieState(cid || "PIE_SWEEP", tb, count);
    const { r, cx, cy } = ch, sw = 40, rr = r - sw / 2;
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
    const r = ch.r, cx = 540, cy = ch.cy, sw = 36, rr = r - sw / 2;
    const arc = (p) => { const a = Math.PI * (1 - p); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    const [ex, ey] = arc(clamp01((pct / 100) * st.arc));
    chart = (
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }} opacity={st.o}>
        <g transform={`translate(0 ${st.dy.toFixed(1)}) translate(${cx} ${cy}) scale(${st.ringScale.toFixed(4)}) translate(${-cx} ${-cy})`}>
          <path d={`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${cx + rr} ${cy}`} fill="none" stroke={th.mid} strokeWidth={sw} />
          <path d={`M ${cx - rr} ${cy} A ${rr} ${rr} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`} fill="none" stroke={accent} strokeWidth={sw} />
          <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={th.ink} strokeWidth={4} />
          <circle cx={cx} cy={cy} r={10} fill={th.ink} />
        </g>
      </svg>
    );
  } else if (vt === "TREND") {
    // A stated rise or fall with no figures (scripts/composition-variety.js, owner's spec
    // 2026-10-03 B.4): one smooth line across the chart box to a single accent dot, its
    // label the sentence's own subject. No axis values, no numbers — nothing the sentence
    // does not say. The line draws on, then the dot and the label pop.
    const up = d.direction !== "down";
    const x0 = ch.x + 30, x1 = ch.x + ch.w - 70;
    // The baseline is INK on the chart box's floor (as LINE draws it): a light track line is not
    // content to canvas-coverage, and the beat measured 59.5% (CI run 37125010644 ch-1 beat 0).
    const yLo = ch.y + ch.h - 50, yHi = ch.y + 150, yBase = ch.y + ch.h - 6;
    const y0 = up ? yLo : yHi, y1 = up ? yHi : yLo;
    // An eased S-curve: flat at the start, committed at the end.
    const path = `M ${x0} ${y0} C ${x0 + (x1 - x0) * 0.45} ${y0}, ${x0 + (x1 - x0) * 0.55} ${y1}, ${x1} ${y1}`;
    const t = m.build(0.55, m.s(0.1));
    const dot = clamp01((t - 0.85) / 0.15);
    const label = String(d.label || "").toUpperCase();
    // The label sits at the dot's height on the LEFT edge — the corner the curve never visits
    // (a rising line is low on the left, a falling one high) — so the curve cannot cross it
    // (QA renders 2026-10-03: beside the dot and above the start, the curve ran through it).
    const lx = x0, ly = y1 + 16;
    chart = (
      <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0 }}>
        <line x1={ch.x} y1={yBase} x2={ch.x + ch.w} y2={yBase} stroke={th.ink} strokeWidth={4} />
        <path d={path} fill="none" stroke={accent} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t} />
        <g opacity={dot} transform={`translate(${x1} ${y1}) scale(${(0.4 + 0.6 * Math.min(1, dot * 1.2)).toFixed(3)}) translate(${-x1} ${-y1})`}>
          <circle cx={x1} cy={y1} r={13} fill={accent} />
          <circle cx={x1} cy={y1} r={13} fill="none" stroke={th.ink} strokeWidth={3} />
        </g>
        {label ? <text x={lx} y={ly} textAnchor="start" style={{ font: dataFont(48, 700), letterSpacing: 0.6 }} fill={th.ink} opacity={clamp01(t * 3)}>{label}</text> : null}
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
        <path d={path} fill="none" stroke={accent} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - drawT} />
        {/* Part D.2: a reference line draws across at the last value once the line has arrived. */}
        {pts.length ? (() => { const r = easeOut(clamp01((local - 0.6 * dur) / (0.12 * dur))), y = py(pts[pts.length - 1].q.magnitude);
          return r > 0 ? <line x1={ch.x} y1={y} x2={ch.x + ch.w * r} y2={y} stroke={th.ink} strokeWidth={3} strokeDasharray="14 12" opacity={0.45} /> : null; })() : null}
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
                <circle cx={px(i)} cy={py(p.q.magnitude)} r={10} fill={i === pts.length - 1 ? accent : th.ink} />
              </g>
              <text x={px(i)} y={vy} textAnchor="middle" style={{ font: dataFont(72, 800), letterSpacing: -2 }} fill={th.ink} {...popSvg("NUMBER", r0, px(i), vy - 25)}>{rollQuantity(p.q, 1)}</text>
              <text x={px(i)} y={base + 60} textAnchor="middle" style={{ font: dataFont(36), letterSpacing: 0.4 }} fill={th.ink} {...popSvg("POP_SOFT", r0, px(i), base + 47)}>{String(p.label).toUpperCase()}</text>
            </React.Fragment>
          );
        })}
      </svg>
    );
  }
  // The graph's camera: the whole figure (chart, its number, its label) grows from 1/(1+CAMERA.graph) to its
  // laid-out size about its floor on the frame's axis — inside its band at every frame.
  // the graph grows to its laid-out size; a long beat grows it further than CAMERA.graph so it keeps moving (never past 1)
  const gA = Math.max(CAMERA.graph, Math.min(0.30, 0.03 * Math.max(1, dur / fps)));
  const gk = 1 / (1 + gA) + (1 - 1 / (1 + gA)) * (grow(local, dur, fps, gA) / gA);
  // About the chart's own floor: the middle band's floor, or — a chart in the upper middle band (its headline under it) — its bottom edge.
  const pivotY = ch && ch.y + ch.h < BOTTOM - 100 ? ch.y + ch.h : BOTTOM;
  return (
    <div style={{ position: "absolute", inset: 0, transformOrigin: `540px ${pivotY}px`, transform: `scale(${gk.toFixed(4)})` }}>
      <HeroEl name="chart" b={ch}>{chart}</HeroEl>
      {B.number && (vt === "PIE" || vt === "GAUGE") ? <NumberHero b={B.number} q={parseQuantity(`${d.percent}%`)} t={count} local={local} fps={fps} at={tl.numberAt} color={th.ink} m={m} hero={false} /> : null}
      {B.label ? <DataLabel b={B.label} name="label" color={th.ink} local={local} fps={fps} at={tl.labelAt} /> : null}
    </div>
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
    // Owner's spec 2026-10-09: the photo pushes in CAMERA.photo (10%) across the beat, about an
    // off-centre point that alternates by beat, so it is a push AND a drift sideways.
    const p01 = camP(local, dur, cameraStart(c));
    // SCENE-FULL: a slow push. ARCHITECTURE: a tilt up the facade (the frame
    // is scaled 1.28 and travels from the base to the top over the beat).
    // DOCUMENT: a slow scroll down the page. MONEY: a slow push.
    const scale = 1 + CAMERA.photo * p01;
    const ty = comp === "DOCUMENT" ? lerp(0, -4, p01) : 0;
    // (The major beat's circle reveal is gone: a mask is not a pop — owner's spec 2026-10-02.)
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
          {/* th.photo is false until the photo has popped in (word-level sync): ink on white, then white on the photo. */}
          <Rule b={B.rule} t={m.build(0.3, m.s(0.2))} color={th.photo ? "#FFFFFF" : th.ink} />
          {B.kicker ? <DataLabel b={B.kicker} name="kicker" color={th.photo ? "#FFFFFF" : th.ink} local={local} fps={fps} at={tl.labelAt + 0.3} shadow={th.photo} /> : null}
          {band}
          {/* On the DOCUMENT callout every word sits on the accent band, so the
              accent word takes the band's ink too (it was drawn accent on
              accent — unreadable, QA render 2026-09-30). */}
          {/* Over a photo the accent word is the LIFTED accent: the channel navy on the Baku
              montage was unreadable (CI run 37082751699 ch-9 beat 4). */}
          <Headline b={B.headline} color={comp === "DOCUMENT" ? onAccent(accent) : th.photo ? "#FFFFFF" : th.ink} accent={comp === "DOCUMENT" ? onAccent(accent) : th.photo ? liftAccent(accent, 0.72) : accent} local={local} fps={fps} m={m} idx={idx} at={0.3} shadow={comp !== "DOCUMENT" && th.photo} />
          {B.number && c.data?.value ? <NumberHero b={B.number} q={parseQuantity(c.data.value)} t={easeOut(clamp01((local - 0.5 * fps) / Math.max(1, dur * 0.6)))} local={local} fps={fps} at={0.5} color={th.photo ? "#FFFFFF" : th.ink} m={m} hero={false} /> : null}
          {/* Part D.2: a small corner label — what the photo shows — pops at 20% of the beat. */}
          {th.photo && (c.photo.entity || c.data?.entity) ? <div style={{ position: "absolute", left: L_EDGE, top: 56, font: dataFont(24, 700), letterSpacing: 1.2, color: "#FFFFFF",
            textShadow: "0 2px 10px rgba(0,0,0,0.6)", textTransform: "uppercase", whiteSpace: "nowrap", ...popCss("POP_SOFT", local - Math.round(0.2 * dur), "0% 50%") }}>{String(c.photo.entity || c.data?.entity).slice(0, 40)}</div> : null}
          {c.photo.credit && th.photo ? <div style={{ position: "absolute", left: L_EDGE, top: 1416, font: dataFont(20, 500), color: "rgba(255,255,255,0.72)", maxWidth: 700, textAlign: "left", ...popCss("POP_SOFT", local - 0.3 * fps, "0% 60%") }}>{c.photo.credit}</div> : null}
        </>
      );
    }
    const veil = comp === "MONEY" ? "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.30) 36%, rgba(0,0,0,0.22) 58%, rgba(0,0,0,0.80) 100%)"
      // SCENE-LOW (shots 11 / 16): the words sit low in the middle band, over a darkened foot.
      : comp === "SCENE-LOW" ? "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0.30) 52%, rgba(0,0,0,0.78) 74%, rgba(0,0,0,0.66) 100%)"
      : comp === "DOCUMENT" ? "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.05) 62%, rgba(0,0,0,0.70) 100%)"
      // place / building: the overlay eases from 0.45 to 0.35 across the beat (owner's spec
      // 2026-10-03 D.2; it was a flat 0.35 — 2026-10-02 task 3.1).
      : `rgba(0,0,0,${(0.45 - 0.10 * easeInOut(clamp01(local / Math.max(1, dur)))).toFixed(3)})`;
    return (
      <HeroEl name="photo" b={B.photo}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", }}>
          <Img src={staticFile(c.photo.asset)} style={{ width: "100%", height: "100%", objectFit: "cover",
            objectPosition: c.photo.position || B.photo?.focus || (comp === "DOCUMENT" ? "50% 0%" : comp === "ARCHITECTURE" ? "50% 50%" : "50% 30%"),
            transformOrigin: comp === "DOCUMENT" ? "50% 0%" : `${idx % 2 ? 35 : 65}% 40%`,
            transform: `translateY(${ty.toFixed(2)}%) scale(${scale.toFixed(4)})`, filter: comp === "DOCUMENT" ? "none" : "saturate(0.92) contrast(1.05)" }} />
          <div style={{ position: "absolute", inset: 0, background: veil }} />
        </div>
      </HeroEl>
    );
  }
  // No image resolved (compositionFor sends such a beat to TYPE-FULL, so this is a safety net): the header alone.
  return part === "header" ? <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} /> : null;
}

// ── WORDS-ONLY CARDS (canvas-layout.js typeCardLayout) ────────────────
// TYPE-TITLE / TYPE-CHAPTER / TYPE-DEFINITION: the words (Headline, word by word, as every statement),
// the label in the header, and each card's own furniture in the accent — the title's heavy bar, the
// definition's double rule — drawing in as the words land; the definition's body text pops soft after.
function BodyText({ b, color, local, fps, at }) {
  const pop = popCss("POP_SOFT", local - Math.round(at * fps), b.align === "right" ? "100% 0%" : "0% 0%");
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, font: dataFont(b.size, 400), lineHeight: 1.32, color, textAlign: b.align, ...pop }}>
      {b.lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
    </div>
  );
}
function TypeCard({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const draw = m.build(0.3, m.s(0.25));
  return (
    <>
      {B.statement ? <Headline b={B.statement} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={tl.headlineAt} major={m.tier === "major"} hero accent={accent} /> : null}
      {B.bar ? <Rule b={B.bar} t={draw} color={accent} /> : null}
      {B.rule_a ? <Rule b={B.rule_a} t={draw} color={accent} /> : null}
      {B.rule_b ? <Rule b={B.rule_b} t={m.build(0.3, m.s(0.35))} color={accent} /> : null}
      {B.lead_body ? <BodyText b={B.lead_body} color={th.ink} local={local} fps={fps} at={tl.headlineAt + 0.5} /> : null}
    </>
  );
}

// ── ENTITY-ART (canvas-layout.js entityArtLayout) ──────────────────────
// What a sentence NAMES, drawn when no photo / logo / figure answers it (owner, 2026-10-09). The art is centred in
// the middle band and ALIVE across the beat — a flag pushes in, a track fills, a plate breathes — and the caption's words
// pop on under it. Nothing here is a photograph of a person: a person with no verified portrait is a plate with a
// silhouette (never a stand-in face), an organisation with no logo a plate with a building.
function LucideIcon({ name, size, color, stroke = 2, style }) {
  const parts = ICON_SET[name];
  if (!parts) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="butt" strokeLinejoin="miter" style={{ display: "block", ...style }}>
      {parts.map(([tag, at], i) => React.createElement(tag, { key: i, ...at }))}
    </svg>
  );
}
/**
 * A plate for a named entity: its real mark inside a hairline box, or — when no free, verified mark exists — its NAME set in the serif
 * (style "mono": its initials large with the name small under them). Sharp corners, ink and the one accent. No stock icon, ever.
 */
function MarkPlate({ side, name, item, style, accent, th, hair }) {
  // The fixture look (owner, 2026-10-10: "the test images ... look better than the actual video"): no box. A real mark stands free on the
  // ground; with no free mark the NAME is set large in the serif between a hairline and the accent rule — a type card, not a placeholder box.
  const label = String(name || "").trim();
  if (item?.asset) {
    return (
      <div style={{ position: "absolute", left: 0, top: 0, width: side, height: side }}>
        <Img src={staticFile(item.asset)} style={{ position: "absolute", left: "4%", top: "4%", width: "92%", height: "92%", objectFit: "contain" }} />
      </div>
    );
  }
  const words = label.split(/\s+/).filter(Boolean);
  const mono = style === "mono" && words.length > 1;
  const shown = mono ? words.slice(0, 3).map((x) => x[0]).join("").toUpperCase() : label;
  const lw = shown.split(/\s+/);
  const cut = Math.ceil(lw.length / 2);
  const lines = lw.length <= 2 ? (lw.length && shown.length > 14 ? lw : [shown]) : [lw.slice(0, cut).join(" "), lw.slice(cut).join(" ")];
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const W = side * 1.6;   // the name may run wider than the square it was laid out in
  const size = Math.max(40, Math.min(mono ? side * 0.5 : side * 0.34, (W * 0.92) / (longest * 0.56)));
  const block = Math.round(size * 1.05 * lines.length);
  return (
    <div style={{ position: "absolute", left: (side - W) / 2, top: 0, width: W, height: side }}>
      <div style={{ position: "absolute", left: (W - 120) / 2, top: Math.max(0, (side - block) / 2 - 44), width: 120, height: hair, backgroundColor: th.ink }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: (side - block) / 2, height: block, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", font: `800 ${Math.round(size)}px ${SERIF}`, lineHeight: 1.05, letterSpacing: -1, color: th.ink, whiteSpace: "nowrap" }}>
        {lines.map((l, i) => <span key={i}>{l}</span>)}
      </div>
      {mono ? <div style={{ position: "absolute", left: 0, right: 0, top: (side + block) / 2 + 14, textAlign: "center", font: `700 30px ${SANS_STACK}`, letterSpacing: 3, color: th.ink, whiteSpace: "nowrap" }}>{label.toUpperCase()}</div> : null}
      <div style={{ position: "absolute", left: (W - 160) / 2, top: Math.min(side - 8, (side + block) / 2 + (mono ? 62 : 26)), width: 160, height: 8, backgroundColor: accent }} />
    </div>
  );
}
function EntityArt({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  if (part === "header") return <Rule b={B.rule} t={m.build(0.3, m.s(0.1))} color={th.ink} />;
  const a = c.art || {}, b = B.art;
  const at = tl.headlineAt;
  const pop = popCss("POP_STANDARD", local - Math.round(at * fps), "50% 50%");
  const live = clamp01((local - at * fps) / Math.max(1, dur * 0.9));
  const glyph = onAccent(accent);
  const push = 1 + grow(local, dur, fps, 0.06);   // the art's push across the beat, scaled to its length: never reverses, never smaller than its box
  const breathe = push;
  let art = null;
  // FLAT (owner, 2026-10-09: "they shouldn't look playful"): the reference's drawn parts are hairline-ruled and typographic —
  // sharp corners, ink plus the channel's one accent, no shadow, an ease-in-out settle with no overshoot.
  const flat = flatCss(local - Math.round(at * fps));
  const hair = 3;
  if (b && a.kind === "flag" && a.asset) {
    art = (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, ...flat }}>
        <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", border: `${hair}px solid ${th.ink}`, overflow: "hidden" }}>
          <Img src={staticFile(a.asset)} style={{ width: "100%", height: "100%", objectFit: "cover", transformOrigin: "50% 50%", transform: `scale(${(1 + CAMERA.photo * easeInOut(live)).toFixed(4)})` }} />
        </div>
      </div>
    );
  } else if (b && (String(a.kind).startsWith("plate-") || a.kind === "plates")) {
    // The entity's REAL mark (a verified, freely-licensed logo) or its NAME set in type — never a stock icon standing in for it
    // (owner, 2026-10-09: "a typographic treatment is honest; a generic icon is not"). A row of plates when several are named together.
    const names = a.kind === "plates" ? (a.names || []).slice(0, 4) : [a.name];
    const items = names.map((_, i) => (Array.isArray(a.items) ? a.items[i] : null) || null);
    const n = names.length, gap = n === 1 ? 0 : 32, labelled = items.some((it) => it?.asset);
    const side = Math.max(120, Math.min(b.h - (labelled ? 70 : 0), Math.floor((b.w - gap * (n - 1)) / n)));
    const rowW = n * side + (n - 1) * gap, x0 = (b.w - rowW) / 2;
    art = (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, transform: `scale(${push.toFixed(4)})`, transformOrigin: "50% 50%" }}>
        {names.map((nm, i) => {
          const it = items[i], label = String(nm).toUpperCase(), fs = Math.max(24, Math.min(40, Math.floor((side * 1.7) / Math.max(4, label.length))));
          return (
            <div key={i} style={{ position: "absolute", left: x0 + i * (side + gap), top: 0, width: side, height: b.h, ...flatCss(local - Math.round((at + i * 0.18) * fps)) }}>
              <MarkPlate side={side} name={nm} item={it} style={a.style} accent={accent} th={th} hair={hair} />
              {it?.asset ? <div style={{ position: "absolute", left: -20, right: -20, top: side + 16, textAlign: "center", font: `700 ${fs}px ${SANS_STACK}`, letterSpacing: 2, color: th.ink, whiteSpace: "nowrap" }}>{label}</div> : null}
            </div>
          );
        })}
      </div>
    );
  } else if (b && a.kind === "date") {
    // A typographic date card, not a wall calendar: a hairline above, the month letterspaced, the day (or year) set large, the
    // accent rule drawn along the hairline below.
    const d = dateParts(a.text || a.name);
    const big = d.day || d.year || "";
    const sub = d.day ? [d.month, d.year].filter(Boolean).join(" ") : d.month || "";
    const f0 = local - Math.round(at * fps), rule = easeInOut(clamp01((local - Math.round((at + 0.1) * fps)) / Math.max(1, dur * 0.4)));
    art = (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h }}>
        <svg viewBox="0 0 600 470" width={b.w} height={b.h} style={{ display: "block", overflow: "visible" }}>
          <g {...flatSvg(f0, 300, 235)}>
            <line x1="0" y1="40" x2="600" y2="40" stroke={th.ink} strokeWidth={hair} />
            <line x1="0" y1="430" x2="600" y2="430" stroke={th.ink} strokeWidth={hair} />
          </g>
          <line x1="0" y1="430" x2={600 * rule} y2="430" stroke={accent} strokeWidth="8" />
          <g transform={`translate(300 300) scale(${push.toFixed(4)}) translate(-300 -300)`}>
          {sub ? <text x="300" y={a.style === "alt" ? 400 : 120} textAnchor="middle" fill={th.ink} style={{ font: `700 54px ${SANS_STACK}`, letterSpacing: 10 }} {...flatSvg(local - Math.round((at + 0.2) * fps), 300, a.style === "alt" ? 380 : 100)}>{sub.toUpperCase()}</text> : null}
          <text x="300" y={a.style === "alt" ? 300 : 370} textAnchor="middle" fill={th.ink} style={{ font: `800 ${big.length > 2 ? 190 : 250}px ${SERIF}` }} {...flatSvg(f0 - 3, 300, 300)}>{big}</text>
          </g>
        </svg>
      </div>
    );
  } else if (b && a.kind === "span") {
    // A time scale: a hairline with tick marks, an accent fill drawn along it, then one marker sweeping its length.
    const t = easeInOut(clamp01((local - (at + 0.15) * fps) / Math.max(1, dur * 0.55)));
    const label = String(a.name || a.text || "").toUpperCase();
    const head = 30 + 860 * t;
    art = (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, transform: `scale(${push.toFixed(4)})`, transformOrigin: "50% 50%" }}>
        <svg viewBox="0 0 920 330" width={b.w} height={b.h} style={{ display: "block", overflow: "visible" }}>
          <text x="30" y={a.style === "alt" ? 320 : 150} fill={th.ink} style={{ font: `800 ${label.length > 9 ? 120 : 150}px ${SERIF}` }} {...flatSvg(local - Math.round(at * fps), 30, a.style === "alt" ? 270 : 100)}>{label}</text>
          <g transform={a.style === "alt" ? "translate(0 -190)" : undefined}>
          <line x1="30" y1="250" x2="890" y2="250" stroke={th.ink} strokeWidth={hair} />
          <line x1="30" y1="250" x2={head} y2="250" stroke={accent} strokeWidth="10" />
          {Array.from({ length: 9 }, (_, k) => 30 + (860 * (k + 1)) / 10).map((x, k) => (head >= x - 1 ? <line key={k} x1={x} y1="236" x2={x} y2="264" stroke={th.ink} strokeWidth={hair} /> : null))}
          <line x1="30" y1="200" x2="30" y2="300" stroke={th.ink} strokeWidth={hair} />
          <line x1="890" y1="200" x2="890" y2="300" stroke={th.ink} strokeWidth={hair} />
          {/* Once filled, one marker keeps travelling along the scale: it stays alive to the end of the beat. */}
          {t >= 0.98 ? (() => { const ph = ((local / fps) / 1.6) % 1, x1 = 30 + 860 * (ph < 0.5 ? ph * 2 : 2 - ph * 2); return <line x1={x1} y1="214" x2={x1} y2="286" stroke={th.ink} strokeWidth="6" />; })() : null}
          {Array.isArray(a.ends) && a.ends.length === 2 ? (
            <>
              <text x="30" y="326" fill={th.ink} style={{ font: `700 40px ${SANS_STACK}` }}>{a.ends[0]}</text>
              <text x="890" y="326" textAnchor="end" fill={th.ink} style={{ font: `700 40px ${SANS_STACK}` }}>{a.ends[1]}</text>
            </>
          ) : null}
          </g>
        </svg>
      </div>
    );
  }
  return (
    <>
      {art}
      {B.rule_end ? <Rule b={B.rule_end} t={m.build(0.3, m.s(0.2))} color={th.ink} /> : null}
      {B.statement ? <Headline b={B.statement} color={th.ink} local={local} fps={fps} m={m} idx={idx} at={tl.headlineAt + 0.35} major={m.tier === "major"} hero accent={accent} /> : null}
    </>
  );
}

// ── SHOT FRAMES (docs/REFERENCE-SHOT-GRAMMAR.md) ──────────────────────
// A shot's photo drawn in its box (canvas-layout.js shotLayout), on the beat's own ground, with the
// header in ink. `frame` is the treatment the reference uses:
//   band   bleeds off the top and both sides (shot 2)
//   edge   cropped by one frame edge; an accent bar holds its foot (shots 5 / 25)
//   card   a heavy dark mat with a soft shadow (shots 4 / 19)
//   inset  rounded, with a solid block shadow down and away (shot 18)
//   strip  a torn-paper band across the middle, accent bars on its edges (shot 17)
// Each frame puts solid ink at the photo's lowest edge (mat, block shadow, bar), so the beat's span
// does not depend on how bright the photo happens to be there (canvas-coverage measures ink).
// The photo pushes in CAMERA.photo (10%) across the beat, about a point that alternates by beat, inside its frame (overflow hidden);
// nothing else moves.
function tornEdge(seed, n = 18, amp = 1.4) {
  // A deterministic jagged edge: percentages along the width, small depths (the reference's torn paper).
  let x = seed * 9301 + 49297;
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  return Array.from({ length: n + 1 }, (_, i) => [(i / n) * 100, rnd() * amp]);
}
function PhotoFrame({ c, L, local, dur, fps, accent, idx, part = "body" }) {
  const m = useMotion(c, local, dur, fps);
  const th = useTheme();
  const B = L.boxes, tl = timeline(c, B, dur, fps);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} />;
  const b = B.photo;
  if (!b || !c.photo?.asset) return null;
  const p = clamp01(local / Math.max(1, dur));
  const img = (extra = {}) => (
    <Img src={staticFile(c.photo.asset)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: c.photo.position || b.focus || "50% 40%",
      transformOrigin: `${idx % 2 ? 30 : 70}% 40%`, transform: `scale(${(1 + Math.max(CAMERA.photo * camP(local, dur, cameraStart(c)), grow(local - cameraStart(c), dur - cameraStart(c), fps, CAMERA.photo))).toFixed(4)})`, filter: "saturate(0.92) contrast(1.05)", ...extra }} />
  );
  const bar = (x, y, w, h) => <div style={{ position: "absolute", left: x, top: y, width: w, height: h, backgroundColor: accent }} />;
  const f = b.frame;
  if (f === "card") {
    const mat = 14;
    return (
      <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, backgroundColor: th.dark ? "#F2F0EB" : "#151515", boxShadow: th.dark ? "none" : "0 8px 22px rgba(0,0,0,0.16)" }}>
        <div style={{ position: "absolute", left: mat, top: mat, right: mat, bottom: mat, overflow: "hidden" }}>{img()}</div>
      </div>
    );
  }
  if (f === "inset") {
    const off = 14, r = 22;
    return (
      <>
        <div style={{ position: "absolute", left: b.x + off, top: b.y + off, width: b.w, height: b.h, borderRadius: r, backgroundColor: th.dark ? "#F2F0EB" : INK }} />
        <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: r, overflow: "hidden", backgroundColor: LIGHT }}>{img()}</div>
      </>
    );
  }
  if (f === "strip") {
    const top = tornEdge((Number(b.seed) || idx) + 3), bot = tornEdge((Number(b.seed) || idx) + 11);
    const clip = `polygon(${[...top.map(([x, d]) => `${x}% ${d}%`), ...bot.reverse().map(([x, d]) => `${x}% ${100 - d}%`)].join(", ")})`;
    return (
      <>
        <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, clipPath: clip, overflow: "hidden" }}>{img()}</div>
        {bar(L_EDGE, b.y - 6, 380, 14)}
        {bar(R_EDGE - 380, b.y + b.h - 14, 380, 14)}
      </>
    );
  }
  if (f === "edge") {
    return (
      <>
        <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h - 12, overflow: "hidden" }}>{img()}</div>
        {bar(b.side === "left" ? b.x : b.x + 40, b.y + b.h - 12, b.w - 40, 12)}
      </>
    );
  }
  // band: bleeds off the top and both sides.
  return <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, overflow: "hidden" }}>{img()}</div>;
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
          // Part D.2: once the arrow has drawn, a small dot travels along it (one pass per 1.2 s).
          const f = ((local / fps) / 1.2 + i * 0.37) % 1;
          return (
            <React.Fragment key={i}>
              <line x1={sx} y1={sy} x2={lerp(sx, ex, t)} y2={lerp(sy, ey, t)} stroke={accent} strokeWidth={6} markerEnd={t > 0.05 ? "url(#pf-arrow)" : undefined} />
              {t > 0.98 ? <circle cx={lerp(sx, ex, f)} cy={lerp(sy, ey, f)} r={8} fill={th.dark ? "#0E0E0E" : "#FFFFFF"} stroke={th.ink} strokeWidth={3} /> : null}
            </React.Fragment>
          );
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
              <rect x={cx - n.w / 2} y={cy - n.w / 2} width={n.w} height={n.w} fill={mid ? `rgba(${ink},${fill.toFixed(3)})` : nodeFill} stroke={th.ink} strokeWidth={4} />
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
  const tone = th.ground || (th.dark ? DARK_BG : GROUND);
  if (part === "header") return <HeaderBlock B={B} th={th} local={local} fps={fps} m={m} idx={idx} tl={tl} halo={tone} />;
  return (
    <HeroEl name="map" b={B.map}>
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(${Math.max(0, B.map.y)}px 0 ${Math.max(0, FRAME.h - B.map.y - B.map.h)}px 0)` }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${B.map.x + B.map.w / 2}px ${B.map.y + B.map.h / 2}px`, transform: `scale(${(1 + grow(local, dur, fps, 0.08)).toFixed(4)})` }}>
      <CenteredMap data={c.data} bounds={B.map} local={local} dur={dur} font={SERIF_FAMILY_NAME} accent={accent} ground={tone} ink={th.ink} />
      {/* Part D.2: a pin settles onto the region at 25% of the beat (ease-in-out, no bounce). The
          map is zoomed on the region, so its centre is the region; the pin sits above the
          region's label (drawn at the region's centre). */}
      {(() => {
        const f = local - Math.round(0.25 * dur);
        if (f < 0) return null;
        const drop = f < 8 ? -40 * (1 - easeInOut(f / 8)) : 0;
        const px = B.map.x + B.map.w / 2, py = B.map.y + B.map.h * 0.3 + drop;
        return (
          <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0, opacity: clamp01(f / 3) }}>
            <path d={`M ${px} ${py} C ${px - 26} ${py - 34}, ${px - 26} ${py - 70}, ${px} ${py - 72} C ${px + 26} ${py - 70}, ${px + 26} ${py - 34}, ${px} ${py} Z`} fill={accent} stroke={th.ink} strokeWidth={4} />
            <circle cx={px} cy={py - 50} r={9} fill={tone} />
          </svg>
        );
      })()}
      </div>
      </div>
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
            <div style={{ position: "absolute", left: mm.dot.x, top: mm.dot.y, width: mm.dot.w, height: mm.dot.h, backgroundColor: newest ? accent : th.ink, transform: `scale(${pop.toFixed(3)})` }} />
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
  if (["SCENE-FULL", "ARCHITECTURE", "DOCUMENT", "MONEY", "SCENE-LOW", "MAP-CENTERED", "COMPARISON-SPLIT", ...FRAMED_PHOTO_COMPS, ...HERO_COMPS, ...TYPE_CARD_COMPS, "NUMBER-STAT"].includes(L.composition)) return null;
  const h = L.boxes[L.hero] || null;
  const st = L.boxes.statement;
  if (st && st.rotate) return null;
  if (L.composition === "TYPE-FULL" && h && h.w) {
    const right = h.align === "right";
    const oy = h.y + h.h > 1200 ? BOTTOM : h.y < 400 ? TOP : h.y + h.h / 2;
    // A centred statement (part C.1) zooms about the frame's axis.
    return { k: Math.min(1.15, (R_EDGE - L_EDGE) / h.w), ox: h.align === "center" ? 540 : right ? R_EDGE : L_EDGE, oy };
  }
  // A chart / process spanning the safe width: 1.05 keeps a 24 px margin at the end of the zoom.
  return { k: 1.05, ox: 540, oy: 960 };
}

const themeFor = (c, onPhoto) => (onPhoto ? { ink: "#FFFFFF", soft: "rgba(255,255,255,0.7)", mid: "#A7A7AD", track: "rgba(255,255,255,0.25)", dark: true, photo: true }
  : c.dark ? { ink: "#F2F0EB", soft: "#9A9A9F", mid: "#6E6E73", track: "#2B2B2E", dark: true, photo: false, ground: c.ground_color || DARK_BG }
  : { ink: INK, soft: INK_SOFT, mid: MID, track: LIGHT, dark: false, photo: false, ground: c.ground_color || GROUND });

const COMPONENTS = {
  "TYPE-FULL": TypeFull, "TYPE-SPLIT": TypeFull, "NUMBER-FULL": TypeFull, "PORTRAIT": TypeFull, "DATA-FULL": DataFull, "PROCESS-FULL": ProcessFull,
  "SCENE-FULL": SceneFull, "ARCHITECTURE": SceneFull, "DOCUMENT": SceneFull, "MONEY": SceneFull, "SCENE-LOW": SceneFull,
  "PHOTO-BAND": PhotoFrame, "PHOTO-EDGE": PhotoFrame, "PHOTO-CARD": PhotoFrame, "PHOTO-INSET": PhotoFrame, "PHOTO-STRIP": PhotoFrame,
  "HERO-LOW": TypeFull, "HERO-SCATTER": TypeFull, "HERO-OVER": TypeFull,
  "TYPE-TITLE": TypeCard, "TYPE-CHAPTER": TypeCard, "TYPE-DEFINITION": TypeCard, "NUMBER-STAT": TypeFull, "ENTITY-ART": EntityArt,
  "MAP-CENTERED": MapCentered, "LIST-BUILD": ListBuild, "TIMELINE": Timeline, "COMPARISON-SPLIT": ComparisonSplit,
};


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
  // The body's bottom edge is pinned (it may rise <= 12 px): a push toward a
  // top target lifted a bottom-anchored statement 140 px inside its zone and
  // emptied the zone's bottom — canvas-coverage 56% (CI run 36953236514 ch-9).
  const lowest = limits.reduce((a, l) => (l.b.y + l.b.h > a.b.y + a.b.h ? l : a), limits[0]);
  const pinY = lowest.b.y + lowest.b.h;
  const ox = zoom ? zoom.ox : 540, oy = zoom ? zoom.oy : 960;
  const at = (f) => {
    const s = 1 + (cam.s - 1) * f, tx = cam.x * f, ty = cam.y * f, k = 1 + (zk - 1) * f;
    const T = (px, py) => [((px - ox) * k + ox - 540) * s + 540 + tx, ((py - oy) * k + oy - 960) * s + 960 + ty];
    const ok = limits.every(({ b, lo, hi, left, right }) => {
      const [ax, ay] = T(b.x, b.y), [bx, by] = T(b.x + b.w, b.y + b.h);
      return ay >= lo - 0.5 && by <= hi + 0.5 && ax >= left - 0.5 && bx <= right + 0.5;
    }) && T(0, pinY)[1] >= pinY - 12;
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
// local frame (PopGroups passes the settled frame — see the pop compositor): the incoming beat's
// text pops only once the transition has landed.
// photoShown: false while a full-bleed photo has not popped in yet (word-level sync): the
// header is then drawn in ink on the white ground, and turns white as the photo lands.
function BeatCanvas({ beat, idx, bodyLocal, headerLocal = bodyLocal, fps, accent, hero, show = "all", still = false, photoShown = true }) {
  const c = normalizeCanvas(beat.scene.canvas, idx);
  const dur = beat.duration_frames;
  const L = canvasLayout(c);
  const Comp = COMPONENTS[L.composition] || TypeFull;
  const theme = themeFor(c, PHOTO_COMPS.includes(L.composition) && !!c.photo && photoShown);
  // The accent word is drawn at 3:1 or better against THIS beat's ground (canvas-layout.js readableAccent): lighter
  // on a dark ground, darker on a light one, the channel's hue kept. (It was a fixed lift on dark beats only.)
  if (c.dark && !c.photo) accent = liftAccent(accent);
  if (!c.photo) accent = readableAccent(accent, c.ground_color || GROUND);
  const zoom0 = (c.motion_tier || "medium") === "major" ? majorZoom(L) : null;
  const zk0 = zoom0 ? 1 + (zoom0.k - 1) * easeInOut(clamp01(bodyLocal / Math.max(1, dur))) : 1;
  // Zones: the camera and the major zoom move only as far as keeps the body inside its zone.
  const fitted = keepBodyInZone(L, cameraAt(c, L, bodyLocal, dur, fps), zoom0, zk0, !!c.photo && PHOTO_COMPS.includes(L.composition));
  // still: the pop-up compositor (PopGroups) — the camera is static, no push, no zoom.
  // A shot's framed photo is not a zoned element the camera clamp can see (elementType: photo), so a
  // push could carry it across a zone edge: the camera is still on those shots, as in the reference.
  const shotStill = still || FRAMED_PHOTO_COMPS.includes(L.composition);
  const cam = shotStill ? { s: 1, x: 0, y: 0 } : fitted.cam, zoom = zoom0, zk = shotStill ? 1 : fitted.zk;
  // AMBIENT (owner, 2026-10-09: "the screen must never be static inside a beat"): a beat whose picture has no motion of its
  // own (words, numbers, objects, lists, diagrams) settles into place — it grows from 97% to 100% of its size about the
  // body's floor across the beat, so it is inside its zone at every frame and something is always moving. A photo, a graph,
  // a map and an entity card already move; the header (rule, kicker, headline) stays pinned.
  const amb = AMBIENT_SKIP.includes(L.composition) ? 1 : ambientScale(bodyLocal, dur, fps, String(L.composition).startsWith("TYPE"));
  // About the body's floor when it fills the frame (it then stays inside its zone and keeps its span); about its own centre when it is a
  // small line — a line standing on the floor barely moves about the floor (board 37983616641: TYPE-CHAPTER static 3 s). Either way the
  // shrink stays inside the content's own box.
  // A statement standing on the floor (TYPE-SPLIT's second half, a TYPE-FULL hero) moves about ITS centre: about the floor it barely moves.
  const cbd = contentBounds(L), hb = L.hero && L.boxes[L.hero];
  const ambOriginY = String(L.composition).startsWith("TYPE") && hb && hb.h < 700 ? Math.round(hb.y + hb.h / 2) : cbd && cbd.h < 700 ? Math.round(cbd.y + cbd.h / 2) : BOTTOM;
  return (
    <Theme.Provider value={theme}>
      <Anim.Provider value={{ ...(c.anim || {}), dur, accent, kinetic: c.kinetic || null, beat: idx, spoken: beat.spoken || null }}>
      <Hero.Provider value={hero}>
        {/* The camera moves through the information (the body); the header —
            rule, kicker and headline — stays pinned, so a push or a major zoom
            never crops it. */}
        {show === "header" ? null : (
          <div style={{ position: "absolute", inset: 0, transformOrigin: `540px ${amb !== 1 ? ambOriginY : 960}px`, transform: `translate(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px) scale(${(cam.s * amb).toFixed(4)})` }}>
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

// ── pop-up transitions (owner's spec 2026-10-02) ──────────────────────
// A beat is shown as element GROUPS — the full-bleed photo (if any), the
// top-zone group (headline), the middle-zone group (chart / map / number /
// statement / cutout) — each rendered SETTLED (fully composed: no internal
// draw, sweep, mask, roll or word-exit is ever on screen), clipped to its
// zone band and popped IN PLACE about its own centre:
//   arriving  frames 0-6: scale 0.94 -> 1.04 -> 1.00, opacity 0 -> 1
//   leaving   frames 0-6 of the next beat: scale 1.00 -> 0.94, opacity 1 -> 0
// Within a beat the groups arrive in order, 8 frames apart (photo, headline,
// middle). Across a boundary the outgoing groups shrink and fade while the
// incoming ones pop, so at the crossover (frame 4) the leaving group is at
// ~40% and the arriving one at ~60%: the frame is never empty. Nothing moves
// in space: no slide, wipe, mask, iris, flip, match cut or camera move.
// popInState / popOutState live in pop-groups.js (pure, so the no-overshoot gate tests them).

/** The frame a beat is drawn at: every element in, none leaving (word exits start at >= 70%). */
// LIST-BUILD / TIMELINE add items as the narrator reaches them (up to 0.6 s before
// the end) and have no word exits: they settle at the last frame, or later items
// never show (CI run 36988420698 ch-48: a list beat at 34.8% coverage).
const settleFrame = (dur, comp) => Math.max(0, Math.min(dur - 1, ["LIST-BUILD", "TIMELINE"].includes(comp) ? dur - 1 : Math.round(dur * 0.66)));

// live: the beat's own frame — the full-bleed photo group is drawn at it (its 2% drift
// runs across the beat); every other group is drawn settled.
// The live build starts 12 frames in: a group pops in with its first words / bars / node
// already landed. From frame 0 the beat's first frames were EMPTY while the outgoing beat had
// faded and the first entrances had not landed yet (CI run 37141128792 ch-26: pop-transitions,
// frames 6-10 empty on three beats).
const LIVE_HEAD_START = 12;
function PopGroups({ beat, idx, fps, accent, state, live = null }) {
  const c = normalizeCanvas(beat.scene.canvas, idx);
  const L = canvasLayout(c);
  const settled = settleFrame(beat.duration_frames, L.composition);
  // The header (kicker, headline) settles at the ordinary 66% frame even when the body
  // settles at the last (LIST-BUILD / TIMELINE): at the last frame the kicker's word exit
  // had already run and the frame lost it — canvas-coverage 59.3% (CI run 37082751699 ch-2).
  const headerSettled = settleFrame(beat.duration_frames, "");
  const groups = popGroups(c, L);
  const pg = groups.find((g) => g.key === "photo");
  const photoShown = !pg || state(pg).o >= 0.6;
  return groups.map((g) => {
    const p = state(g);
    if (p.o <= 0.001) return null;
    const clip = g.clip ? `inset(${g.clip[0]}px 0 ${FRAME.h - g.clip[1]}px 0)` : "none";
    return (
      <div key={`${idx}-${g.key}`} style={{ position: "absolute", inset: 0, clipPath: clip, opacity: p.o }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${g.cx.toFixed(0)}px ${g.cy.toFixed(0)}px`, transform: `scale(${p.s.toFixed(4)})` }}>
          {/* Part D (owner's spec 2026-10-03, "motion on every beat"): every group is drawn at the
              beat's LIVE frame, so its own build plays — words pop one by one, bars grow, the
              line and the arrows draw, nodes pop in sequence, the number counts up, the map
              outlines its region. (Until today the compositor drew every group SETTLED.) Word
              exits are off (exitAt 9), so nothing leaves before the beat's pop-out. The
              outgoing beat is drawn at its last frame: complete. */}
          <BeatCanvas beat={beat} idx={idx} bodyLocal={live != null ? Math.max(LIVE_HEAD_START, Math.min(beat.duration_frames - 1, live)) : settled} headerLocal={live != null ? Math.max(LIVE_HEAD_START, Math.min(beat.duration_frames - 1, live)) : headerSettled} fps={fps} accent={accent} hero={null} show={g.show} still photoShown={photoShown} />
        </div>
      </div>
    );
  });
}

// ── captions (outside the camera; never move with it) ─────────────────
const norm = (w) => String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function CanvasCaption({ words, local, fps, emphasis, onPhoto, dark, align, blend = false, maxSize = 58 }) {
  if (!Array.isArray(words) || !words.length) throw new Error("CanvasCaption: beat has no word timings — the voiceover's word boundaries are required");
  // maxSize 40 under a hero cutout (owner spec 2026-10-02: caption 32-40 px, type supports the object).
  const size = Math.min(maxSize, Math.floor(CAPTION.w / (Math.max(1, ...words.map((w) => String(w.text).length)) * 0.62)));
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

// The planner's pull phrase (canvas-layout.js finalizeChrome): one static phrase, popped in once.
// Tone "accent" = the channel accent from channels.json (never a colour written in a plan).
function PullPhrase({ pull, local, accent, light, onPhoto }) {
  const color = pull.tone === "accent" ? accent : light ? "#FFFFFF" : INK;
  return (
    <div style={{ position: "absolute", left: pull.x, top: pull.y, width: pull.w, textAlign: pull.align, font: `700 ${pull.size}px ${SANS_STACK}`,
      lineHeight: 1.18, color, textShadow: onPhoto ? "0 3px 18px rgba(0,0,0,0.7)" : "none", ...popCss("POP_SOFT", local - 6) }}>
      {pull.lines.map((l, i) => <div key={i}>{l}</div>)}
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
  const c = normalizeCanvas(beat.scene.canvas, i);
  const cLayout = canvasLayout(c);
  const start = prev ? POP.START : 0;
  // White caption only once the photo group has popped in behind it.
  // (the photo group may pop on its word — word-level sync — so its own arrival frame is used)
  const photoAt = popGroups(c, cLayout).find((g) => g.key === "photo")?.at ?? 0;
  const onPhoto = PHOTO_COMPS.includes(cLayout.composition) && !!c.photo && local >= start + photoAt + 3;
  // The outgoing beat must stay mounted until the incoming one actually has something on
  // screen. It used to be unmounted on a fixed count (`local <= POP.OUT`, 6 frames), which
  // can only honour "the frame is never empty" if the incoming beat's FIRST group always
  // lands inside those 6 frames. It does not: arrival is content-dependent, and
  // entrance_style "visual-first" on a TYPE beat schedules the top band — the headline,
  // i.e. the sentence's own statement — at `at: ENTRANCE.TEXT_AFTER_VISUAL` (14). Measured
  // on run 37380168306 ch-2 (avalonbay beat 5, TYPE-FULL + visual-first): ink rows above
  // the caption fell 360 -> 319 -> 0 for seven frames (f6-f12) and only returned at f14, so
  // pop-transitions rejected the video. The same class is recorded at pop-groups.js:45-48
  // from run 36985423031 ch-44.
  //
  // So the gate is the incoming beat's own opacity, not a frame budget. The outgoing beat
  // keeps rendering its LAST frame (live={prev.duration_frames - 1}), so holding it is a
  // complete, static frame - not a frozen or half-drawn one - and it releases as soon as the
  // incoming group is visible.
  const inGroups = popGroups(c, cLayout);
  const incomingHasInk = inGroups.some((g) => popInState(local - start - g.at).o > 0.001);
  const holdingPrev = !!prev && (local <= POP.OUT || !incomingHasInk);
  // The ground changes WITH the pop, not after it. It used to be the outgoing beat's until the hold
  // released (frame ~7) and the incoming beat's from then on: across a dark -> white boundary the
  // incoming beat's black type popped in on a still-dark ground (invisible, frames 3-6 of ch-05
  // run 37694022496 beat 8, "Rulings") and the ground then flipped to white in one frame. Now the
  // incoming ground is laid over the outgoing one at the incoming beat's own pop opacity, so the
  // ground reaches the incoming colour as the incoming type reaches full opacity, and the outgoing
  // type (fading out over the same frames) is never left on a colour it cannot be read on for long.
  const prevCanvas = prev ? normalizeCanvas(prev.scene.canvas, i - 1) : null;
  const inProgress = holdingPrev ? Math.max(0, ...inGroups.map((g) => popInState(local - start - g.at).o)) : 1;
  const shown = holdingPrev && inProgress < 0.5 ? prevCanvas : c;
  const groundBase = holdingPrev ? (prevCanvas.ground_color || GROUND) : null;
  const groundTop = c.ground_color || (holdingPrev ? GROUND : null);
  return (
    <ShadowOn.Provider value={false}>
    {/* Uniform white on every beat (backgrounds.js); a full-bleed photo beat
        covers it, the next beat shows it again. */}
    <StudioBG>
      {/* Background variation (part C.3, canvas-layout.js backgroundOf): every 3rd beat the
          paper texture, every 5th a thin rule above the headline zone. */}
      {/* A beat's own ground (the planner's `ground`, canvas ground_color) is painted here while that
          beat is the one on screen; with none declared the StudioBG white shows, as before. While the
          outgoing beat is held, its ground is the one painted so its ink never sits on the wrong colour. */}
      {groundBase ? <div style={{ position: "absolute", inset: 0, backgroundColor: groundBase }} /> : null}
      {groundTop ? <div style={{ position: "absolute", inset: 0, backgroundColor: groundTop, opacity: inProgress }} /> : null}
      {(() => { const bg = backgroundOf(i, cLayout.composition, !!c.ground_color); return (<>
        {bg.paper ? <PaperTexture drift={clamp01(local / Math.max(1, beat.duration_frames)) * 0.5} /> : null}
        {bg.rule ? <div style={{ position: "absolute", left: L_EDGE, top: BG_RULE.y, width: R_EDGE - L_EDGE, height: BG_RULE.h, backgroundColor: BG_RULE.color }} /> : null}
        {bg.gradient ? <div style={{ position: "absolute", inset: 0, background: BG_GRADIENT }} /> : null}
      </>); })()}
      {holdingPrev ? <PopGroups key="out" beat={prev} idx={i - 1} fps={fps} accent={accent} state={() => popOutState(local)} live={prev.duration_frames - 1} /> : null}
      {/* Micro motion (part D.1, every beat): the composition is never still — a 1 px drift
          across the beat and a 0.3% breath (one cycle per 3 s), about the frame's centre. */}
      <div style={{ position: "absolute", inset: 0, transformOrigin: "540px 960px",
        transform: `translate(${(-0.5 + clamp01(local / Math.max(1, beat.duration_frames))).toFixed(3)}px, 0px)` }}>
        <PopGroups key="in" beat={beat} idx={i} fps={fps} accent={accent} state={(g) => popInState(local - start - g.at)} live={local} />
      </div>
      {/* The live word caption on every beat was the bottom-phrase device (owner, 2026-10-08):
          only the planner's pull phrase is drawn, where it put it, when it asked for one. */}
      {cLayout.pull ? <PullPhrase pull={cLayout.pull} local={local - start} accent={accent} light={onPhoto || (!!shown.dark && !onPhoto)} onPhoto={onPhoto} /> : null}
      {/* Source credit (owner's spec 2026-10-03, part C): only on a beat that shows a fetched
          image; bottom-right, 40 px in from the right and bottom edges, 20 px sans, #888,
          fading in from frame 40 of the beat (after the pops have settled). */}
      {c.source_credit ? (
        <div style={{ position: "absolute", right: 40, bottom: 40, font: `500 20px ${SANS_STACK}`, color: "#888888", whiteSpace: "nowrap",
          opacity: Math.max(0, Math.min(1, (local - 40) / 8)) }}>Source: {c.source_credit}</div>
      ) : null}
    </StudioBG>
    </ShadowOn.Provider>
  );
}

export default CanvasVideo;
