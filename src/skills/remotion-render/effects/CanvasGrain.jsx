import { useMemo, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { EffectComposer, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { PostFxReadyGate } from "./PostFxReadyGate.jsx";

/**
 * vox-style-treatment SKILL.md's photo/asset grain, extended from photo
 * assets to the flat canvas background itself ("paper grain... breaking
 * the digital feel" — the same research this pipeline's photo treatment
 * is already built on). Same real-library rule as PhotoTreatment.jsx:
 * postprocessing's own tested NoiseEffect (@react-three/postprocessing's
 * <Noise>), never hand-rolled noise math.
 *
 * This mounts for the ENTIRE video (Background renders once at the top of
 * MotionGraphicsShorts, not per-beat) — a real, worth-naming tradeoff
 * against this render package's OTHER real, already-tested grain
 * mechanism, @remotion/effects' noise() (used elsewhere in Background,
 * on the dotGrid/paper texture layer this file does NOT touch): that one
 * is a lightweight single WebGL2 draw call via Remotion's own Solid/
 * effects system, no persistent 3D scene. This file exists because a
 * specific, explicit ask was for the SAME mechanism as the photo grain
 * (postprocessing's NoiseEffect via @remotion/three) for consistency
 * across photo and canvas — not because the lighter alternative was
 * broken or fake; both are real, tested libraries.
 *
 * NoiseEffect's actual shader (read from node_modules/postprocessing/
 * build/postprocessing.js, same rule as DotScreen/PhotoTreatment):
 *   `vec3 noise = vec3(rand(uv*(1.0+time)))`
 * — ONE scalar random value broadcast into r, g, AND b equally. This is
 * achromatic/luminance-only by construction: every pixel's noise delta is
 * identical across channels, so no blend of this effect can shift hue,
 * regardless of blendFunction or opacity. That's what makes "grain,
 * never a tint" a property of the library itself here, not something this
 * file has to separately guarantee.
 *
 * blendFunction is NORMAL, not OVERLAY (which PhotoTreatment.jsx's Noise
 * uses for photo grain) — a real, confirmed difference, not a copy-paste
 * inconsistency. OVERLAY/SCREEN/MULTIPLY are all multiplicative blends
 * that mathematically degenerate to a CONSTANT, independent of the blend
 * layer, at the exact extremes of the [0,1] range: overlay's result at a
 * base of pure white (1.0) collapses to `1 - 2*(1-1)*(1-noise) = 1`
 * regardless of noise. tokens.js's BG_WHITE/BG_BLACK are exactly #FFFFFF/
 * #000000 — precisely those extremes, by design (CLAUDE.md's flat-canvas
 * rule) — so OVERLAY produced measured stddev of EXACTLY 0.000 in a real
 * render (data/audit/17), not just "too subtle to see": zero effect,
 * confirmed via raw pixel stats, not assumed from a visual crop that
 * turned out to be misleadingly inconclusive on its own. NORMAL (a plain
 * linear alpha blend, base*(1-opacity) + noise*opacity) has no such
 * degenerate case at any base value, which is why it's correct here
 * specifically — this component's base is always at one of those two
 * exact extremes, unlike a photo's continuous range of midtones.
 *
 * Even fixed, the SAME opacity is not visually equal at both extremes —
 * a second real, measured effect, not a guess: opacity 0.05 measured
 * stddev 1.1 on white (data/audit/17/out/grain-white-crop.png — correctly
 * subtle) but stddev 11.0 on black (grain-black-crop.png — a real render
 * showed this as closer to sensor noise than paper grain, not just a
 * hunch from the number). Whatever the renderer's internal color-space
 * handling is doing, a fixed nominal opacity reads far stronger toward
 * the shadow end than the highlight end. Rather than force one number
 * that's wrong for one of this pipeline's only two canvas modes (white/
 * black — see tokens.js's paletteFromHues, there is no continuous
 * spectrum here to design a smooth formula against), NOISE_OPACITY_LIGHT/
 * DARK below are calibrated directly from those two measurements: lower for a dark base,
 * unchanged for a light one. Picking by the base color's OWN relative
 * luminance (not a separate bgMode prop threaded down) keeps this correct
 * even if a future palette lands somewhere other than pure #FFFFFF/
 * #000000, at the cost of only having two real calibration points today.
 */

const NOISE_OPACITY_LIGHT = 0.05; // confirmed subtle on white (data/audit/17)
const NOISE_OPACITY_DARK = 0.006; // ~1/10th — confirmed subtle on black at this value, not the 0.05 that measured 10x stronger

function relativeLuminanceOfHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return 1; // unrecognized input — default to the "light" calibration, the safer of the two to fall back to
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function FlatPlane({ color, width, height }) {
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/**
 * @param {object} props
 * @param {string} props.color   the channel's flat bg color (colors.bg)
 * @param {number} props.width   canvas width, px
 * @param {number} props.height  canvas height, px
 */
export function CanvasGrain({ color, width, height }) {
  const orthoCamera = useMemo(
    () => ({ left: -width / 2, right: width / 2, top: height / 2, bottom: -height / 2, near: -1000, far: 1000, position: [0, 0, 10] }),
    [width, height]
  );
  const composerRef = useRef(null);
  const opacity = relativeLuminanceOfHex(color) >= 0.5 ? NOISE_OPACITY_LIGHT : NOISE_OPACITY_DARK;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      orthographic
      camera={orthoCamera}
      gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={1} />
      <FlatPlane color={color} width={width} height={height} />
      <EffectComposer ref={composerRef} enableNormalPass={false} autoClear={false}>
        <Noise opacity={opacity} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
      <PostFxReadyGate composerRef={composerRef} label="CanvasGrain" />
    </ThreeCanvas>
  );
}

export default CanvasGrain;
