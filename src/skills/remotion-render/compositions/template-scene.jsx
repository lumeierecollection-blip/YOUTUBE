import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { ObjectShape } from "./objects/index.jsx";
import { SAFE_SHORTS } from "../layout/slots.js";
import { paletteRoles } from "../visual/palette-roles.js";

/**
 * Step 5 — the renderer, as section 6 requires it: a pure function of the plan.
 *
 * It takes ONE input, the structured plan, and it makes no decisions. There is
 * no `channel` here, no `strategy`, no script, no branching on either. Search
 * this file for a channel id or a strategy name and you will not find one: the
 * only reason a Money Mind frame differs from a Legal Brief frame is that their
 * plans differ. That is the whole architectural point, and it is checkable by
 * reading the imports.
 *
 * WHAT IT IS ALLOWED TO COMPUTE. Only the mechanical resolution of what the
 * plan already fixed: an anchor fraction into safe-rect pixels, a camera move
 * name into a transform, a palette slot into a colour, a frame window into an
 * opacity. Every one of those is a lookup, not a choice.
 */

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const SAFE = SAFE_SHORTS;

/** Section 2's motion_curve values, resolved to real easings. A lookup, not a decision. */
const CURVES = {
  linear: (t) => t,
  "ease-in": Easing.in(Easing.cubic),
  "ease-out": Easing.out(Easing.cubic),
  "ease-in-out": Easing.inOut(Easing.cubic),
  bounce: Easing.bounce,
  elastic: Easing.elastic(1),
};

/**
 * Section 2's camera moves, resolved to a world transform. Each is the literal
 * reading of its own name — `push-in` scales up, `track-left` translates the
 * world rightwards so the viewport travels left — so the plan's CAMERA MOTION
 * SCRIPT and the pixels cannot drift apart.
 */
const MOVES = {
  static: () => ({ scale: 1, x: 0, y: 0 }),
  "push-in": (e) => ({ scale: 1 + 0.14 * e, x: 0, y: 0 }),
  "pull-out": (e) => ({ scale: 1.14 - 0.14 * e, x: 0, y: 0 }),
  "pan-left": (e) => ({ scale: 1.05, x: 70 * e, y: 0 }),
  "pan-right": (e) => ({ scale: 1.05, x: -70 * e, y: 0 }),
  "tilt-up": (e) => ({ scale: 1.05, x: 0, y: 90 * e }),
  "tilt-down": (e) => ({ scale: 1.05, x: 0, y: -90 * e }),
  "track-left": (e) => ({ scale: 1.06, x: 150 * e, y: 0 }),
  "track-right": (e) => ({ scale: 1.06, x: -150 * e, y: 0 }),
  "top-down": () => ({ scale: 1, x: 0, y: 0 }),
  "low-angle": (e) => ({ scale: 1.08, x: 0, y: -40 * e }),
  "high-angle": (e) => ({ scale: 1.08, x: 0, y: 40 * e }),
};

/**
 * How much of the frame the subject occupies, from the plan's `framing`. The
 * numbers differ per framing because that is what framing MEANS; they do not
 * differ per channel, because the channel already chose its framing.
 */
const FRAMING_SPAN = { wide: 0.94, medium: 0.7, "close-up": 0.52, "extreme-close-up": 0.36 };

/** Section 2's text_placement, resolved against the safe rect. */
function placementBox(placement, rect) {
  const SAFE = rect;
  const w = SAFE.right - SAFE.left;
  switch (placement) {
    case "centre": return { x: SAFE.left, y: (SAFE.top + SAFE.bottom) / 2 - 60, w, align: "center" };
    case "upper-third": return { x: SAFE.left, y: SAFE.top + 40, w, align: "left" };
    case "corner-overlay": return { x: SAFE.left, y: SAFE.top + 20, w: w * 0.6, align: "left" };
    case "lower-third":
    default: return { x: SAFE.left, y: SAFE.bottom - 190, w, align: "left" };
  }
}

/**
 * The camera at this frame. The plan's keyframes are absolute frames, so this
 * finds the segment containing `frame` and eases between the two moves with
 * the plan's own `motion_curve`.
 */
function cameraAt(plan, frame) {
  const ks = plan.camera;
  if (!ks.length) return { scale: 1, x: 0, y: 0 };
  const curve = CURVES[plan.motion_curve] || CURVES["ease-in-out"];
  let i = 0;
  while (i < ks.length - 1 && frame >= ks[i + 1].frame) i++;
  const a = ks[i];
  const b = ks[Math.min(i + 1, ks.length - 1)];
  const span = Math.max(1, b.frame - a.frame);
  const raw = Math.max(0, Math.min(1, (frame - a.frame) / span));
  const e = typeof curve === "function" ? curve(raw) : raw;
  const A = (MOVES[a.move] || MOVES.static)(1);
  const B = (MOVES[b.move] || MOVES.static)(e);
  return {
    scale: A.scale + (B.scale - A.scale) * e,
    x: A.x + (B.x - A.x) * e,
    y: A.y + (B.y - A.y) * e,
  };
}

/**
 * Where a repeated object's nth copy sits. Copies fan along the reading
 * direction and step back slightly, so a pile reads as a pile of separate
 * things rather than one thick object. Deterministic in n.
 */
function copyOffset(n, i, size) {
  if (n <= 1) return { dx: 0, dy: 0, s: 1 };
  const t = i / (n - 1);
  return { dx: (t - 0.5) * size * 0.5, dy: (t - 0.5) * size * 0.22, s: 1 - t * 0.12 };
}


/**
 * The rect that is still inside SAFE at every keyframe of THIS plan's camera.
 *
 * Each move resolves to `translate(d) scale(s)` about the canvas centre, so
 * inverting it at a keyframe gives the world rect that lands inside SAFE
 * there; the intersection over all keyframes is what survives the whole move.
 */
function planSafeRect(plan) {
  const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
  let left = -Infinity, right = Infinity, top = -Infinity, bottom = Infinity;
  const ends = (plan.camera || []).map((k) => (MOVES[k.move] || MOVES.static)(1));
  if (!ends.length) ends.push({ scale: 1, x: 0, y: 0 });
  for (const t of ends) {
    const s = t.scale || 1;
    left = Math.max(left, cx + (SAFE.left - cx - t.x) / s);
    right = Math.min(right, cx + (SAFE.right - cx - t.x) / s);
    top = Math.max(top, cy + (SAFE.top - cy - t.y) / s);
    bottom = Math.min(bottom, cy + (SAFE.bottom - cy - t.y) / s);
  }
  return { left, right, top, bottom };
}

export function TemplateScene({ plan }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const colors = paletteRoles(plan.palette);
  const cam = cameraAt(plan, frame);
  const p = Math.max(0, Math.min(1, (frame - plan.beat.startFrame) / Math.max(1, plan.beat.durationInFrames)));

  const safeW = SAFE.right - SAFE.left;
  const span = FRAMING_SPAN[plan.framing] ?? 0.7;

  /**
   * THE OBJECTS GET WHAT THE TEXT LEAVES.
   *
   * The first render put the pile across the text and off the left edge: the
   * subject was sized against the full safe rect, the copy fan pushed it a
   * further half-width sideways, and the lower-third band was drawn straight
   * over it. Measured on that frame, the pile spanned x[27..909] against a
   * safe rect of [48..888].
   *
   * So the text band is reserved FIRST and the objects are fitted into what is
   * left. Reserving rather than overlaying is the honest order: the plan fixed
   * where the type goes, and the type is the thing that must stay legible.
   */
  const TEXT_BAND = 260;
  const bands = new Set(plan.typography.map((t) => t.placement));
  /**
   * ...AND WHAT THE CAMERA LEAVES.
   *
   * Same lesson as CHECK-REGISTER 3.12.26, one engine later: content laid out
   * against SAFE and then transformed by a camera is not inside SAFE. ch-02's
   * pile was fitted correctly to x[114..] and the pan-right keyframe (scale
   * 1.05, x -70) carried it to x=23 against a left edge of 48.
   *
   * `camSafe` inverts the plan's OWN keyframes -- every move it actually uses,
   * at its extreme -- so the rect returned is what survives the whole move.
   * Because the plan lists its keyframes explicitly, this needs no sampling
   * and no assumption about which one is worst.
   */
  const camSafe = planSafeRect(plan);
  const contentTop = camSafe.top + (bands.has("upper-third") || bands.has("corner-overlay") ? TEXT_BAND : 0);
  const contentBottom = camSafe.bottom - (bands.has("lower-third") ? TEXT_BAND : 0);
  const contentH = Math.max(200, contentBottom - contentTop);
  const contentW = camSafe.right - camSafe.left;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.ground }}>
      <AbsoluteFill
        style={{
          transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
          transformOrigin: "50% 50%",
        }}
      >
        <svg width={CANVAS_W} height={CANVAS_H} style={{ position: "absolute", left: 0, top: 0 }}>
          {plan.objects.map((o, oi) => {
            // The subject gets the framing's span; supporting and context sit
            // back from it. Fractions, not pixels, so the same plan is correct
            // at any output size.
            const rel = o.role === "subject" ? 1 : o.role === "supporting" ? 0.42 : 0.34;
            /**
             * The fan widens the footprint, so it is taken out of the width
             * BEFORE the object is sized rather than added after. `copyOffset`
             * spreads copies over 0.5 of the base width and 0.22 of its height,
             * so the full footprint is base * (1 + 0.5) horizontally.
             */
            const fan = o.count > 1 ? 1.5 : 1;
            const wantW = contentW * span * rel * (o.anchor.scale ?? 1);
            const maxW = (contentW * 0.98) / fan;
            const maxH = (contentH * 0.98) / (1.32 * (o.count > 1 ? 1.22 : 1));
            const base = Math.min(wantW, maxW, maxH);
            const cx = camSafe.left + contentW * o.anchor.x;
            const cy = contentTop + contentH * o.anchor.y;
            return Array.from({ length: o.count }).map((_, i) => {
              const off = copyOffset(o.count, i, base);
              const w = base * off.s;
              const h = w * 1.32;
              // Copies arrive in order across the beat, which is what makes an
              // accumulation accumulate rather than appear all at once.
              const a = o.count > 1 ? Math.max(0, Math.min(1, p * o.count - i)) : 1;
              if (a <= 0) return null;
              return (
                <g key={`${oi}-${i}`} opacity={a}
                  transform={`translate(${cx - w / 2 + off.dx}, ${cy - h / 2 + off.dy})`}>
                  <ObjectShape name={o.object} colors={colors} p={p}
                    box={{ x: 0, y: 0, w, h }} />
                </g>
              );
            });
          })}
        </svg>
      </AbsoluteFill>

      {plan.typography.map((t, i) => {
        if (frame < t.from || frame > t.to) return null;
        const box = placementBox(t.placement, camSafe);
        const face = t.face === "primary" ? plan.fonts.primary : plan.fonts.secondary;
        const fade = interpolate(frame, [t.from, t.from + 8, t.to - 8, t.to], [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{
            position: "absolute", left: box.x, top: box.y, width: box.w,
            color: colors.onGround, opacity: fade,
            fontFamily: `${face}, sans-serif`, fontWeight: 700, fontSize: 42,
            letterSpacing: 0.5, lineHeight: 1.25, textAlign: box.align,
          }}>
            {t.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/**
 * Registered once. `defaultProps.plan` is a placeholder only so Remotion can
 * enumerate the composition; every real render passes a plan through
 * `inputProps`.
 */
export const compositions = [
  {
    id: "TemplatePlanShorts",
    component: TemplateScene,
    durationInFrames: 150,
    fps: 30,
    width: CANVAS_W,
    height: CANVAS_H,
    defaultProps: {
      plan: {
        version: 1, beat: { startFrame: 0, durationInFrames: 150 },
        palette: { primary: ["#0F172A", "#1E293B", "#22C55E", "#FAFAFA"], secondary: ["#16A34A", "#94A3B8", "#F8FAFC"] },
        fonts: { primary: "Inter", secondary: "JetBrains Mono" },
        environment: { type: "desk-flatlay", ground: "placeholder", lighting: "flat-overhead" },
        motion_curve: "ease-in-out", framing: "medium", negative_space: "high",
        objects: [], camera: [{ frame: 0, move: "static", target: null, reason: "placeholder" }],
        typography: [], transitions: [],
      },
    },
  },
];
