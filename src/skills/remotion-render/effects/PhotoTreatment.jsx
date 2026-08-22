import React, { useMemo, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useLoader, useThree } from "@react-three/fiber";
import { EffectComposer, Vignette, Noise, ChromaticAberration, LUT } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { LUTCubeLoader } from "three/examples/jsm/loaders/LUTCubeLoader.js";
import { staticFile, useDelayRender } from "remotion";

/**
 * vox-style-treatment SKILL.md's "Photo/asset treatment" checklist,
 * implemented via real, tested libraries — never freehand shader math:
 *   - Vignette, Noise (grain), ChromaticAberration: postprocessing's own
 *     tested Effect classes (pmndrs/postprocessing, Zlib), used through
 *     @react-three/postprocessing's JSX wrappers, not hand-rolled GLSL.
 *   - Desaturated editorial base grade: a real 3D LUT (.cube), loaded via
 *     Three.js's own LUTCubeLoader and applied via postprocessing's real
 *     LUT3DEffect (the <LUT> component) — see
 *     effects/generate-editorial-lut.mjs for why this LUT is generated
 *     in-repo from a documented formula rather than a found third-party
 *     file (the most promising candidate researched had an unverifiable
 *     provenance disclaimer on the grade data itself, not just the code).
 *
 * SAME parameter recipe on every photo regardless of source (the whole
 * point per the skill file: "what makes many different stock photos read
 * as one continuous piece") — no per-asset tuning, no conditional
 * parameters below.
 *
 * Rendering sync, part 1 (texture/LUT loading): deliberately NO manual
 * delayRender/continueRender for asset loading. @remotion/three's
 * ThreeCanvas already wraps its children in a real Suspense boundary
 * (confirmed by reading node_modules/@remotion/three/dist/esm/index.mjs
 * directly — remotion.dev's own docs were proxy-blocked in this sandbox,
 * so the installed package's real source is the source of truth here, not
 * memory). A first pass at this file used manual useEffect + useState for
 * texture loading instead of Suspense, which does NOT trip that boundary —
 * every rendered frame came out blank white (data/audit/13's first real
 * render caught this; "no crash" was not evidence of a working image).
 * useLoader() below is React-Suspense-integrated, which is what actually
 * makes ThreeCanvas's SuspenseLoader wait correctly for assets.
 *
 * Rendering sync, part 2 (EffectComposer's own extra async hop): fixing
 * asset loading was NOT sufficient — a second, separate bug remained,
 * caught the same way (real renders still came out blank, this time with
 * NO texture-loading problem at all — confirmed via data/audit/13's
 * isolation probes: a bare useLoader'd textured plane with no
 * postprocessing rendered correctly at every frame tested; the exact same
 * plane wrapped in <EffectComposer> did not, with ANY combination of
 * effects, including none). Root cause, read directly from
 * node_modules/@react-three/postprocessing/dist/index.js: EffectComposer
 * builds its actual postprocessing.EffectComposer instance inside a plain
 * (passive) useEffect, then calls a useState setter to publish it — a
 * second React render is required after mount before EffectComposer's
 * useFrame-priority render callback (or its children, i.e. Vignette/Noise/
 * LUT/etc — EffectComposer literally renders null until that state lands)
 * does anything at all. Meanwhile it also claims R3F's render priority, so
 * while it's not ready, R3F's own default gl.render() is suppressed too —
 * nothing paints, not even the raw photo. ThreeCanvas's Suspense-driven
 * "ready" signal (SuspenseLoader's fallback continueRender, released
 * synchronously in the commit's layout-effect phase) has no idea this
 * second async hop exists and can resolve before it. PostFxReadyGate below
 * closes that gap explicitly: it holds its own delayRender and retries
 * advance() across real render cycles (via a counter-driven useEffect,
 * not an assumption about effect ordering) until composerRef.current
 * (EffectComposer's own imperative handle, populated by the same state
 * update) confirms the composer actually exists — only then does it
 * release Remotion's delay, guaranteeing at least one advance() happens
 * after EffectComposer is truly ready to render.
 */

const LUT_URL = staticFile("luts/editorial-grade.cube");

// One recipe, everywhere — see file header.
const VIGNETTE_PROPS = { eskil: false, offset: 0.15, darkness: 0.65 };
const NOISE_PROPS = { opacity: 0.06, blendFunction: BlendFunction.OVERLAY };
const CHROMATIC_ABERRATION_PROPS = { offset: [0.0009, 0.0009], radialModulation: true, modulationOffset: 0.4 };

function Plane({ src, treatment, containerWidth, containerHeight }) {
  const texture = useLoader(THREE.TextureLoader, src);
  texture.colorSpace = THREE.SRGBColorSpace;

  // Reproduce CSS object-fit contain/cover in plane-scale terms, matching
  // the sizing the plain <img> path used (isCutout -> contain within
  // 88%/92% of the box, matching ImageBeatScene's existing maxWidth/
  // maxHeight; fullbleed -> cover the full box) — same visual footprint,
  // different render path.
  const boxW = treatment === "cutout" ? containerWidth * 0.88 : containerWidth;
  const boxH = treatment === "cutout" ? containerHeight * 0.92 : containerHeight;
  const boxAspect = boxW / boxH;
  const imgAspect = texture.image.width / texture.image.height;
  const fit = treatment === "cutout" ? "contain" : "cover";
  let planeW;
  let planeH;
  if (fit === "contain" ? imgAspect > boxAspect : imgAspect < boxAspect) {
    planeW = boxW;
    planeH = boxW / imgAspect;
  } else {
    planeH = boxH;
    planeW = boxH * imgAspect;
  }

  return (
    <mesh>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function LutLayer() {
  const { texture3D } = useLoader(LUTCubeLoader, LUT_URL);
  return <LUT lut={texture3D} blendFunction={BlendFunction.NORMAL} />;
}

// See the file-header comment ("Rendering sync, part 2") for why this
// exists. Caps at MAX_RETRIES attempts so a genuinely broken composer
// can't hang the whole render forever — that ceiling should never be hit
// in practice (the composer is normally ready within 1-2 real R3F ticks),
// so hitting it is logged loudly rather than failing silently.
const MAX_RETRIES = 20;
const RETRY_DELAY_MS = 30;

function PostFxReadyGate({ composerRef }) {
  const { advance } = useThree();
  const { delayRender, continueRender } = useDelayRender();

  // Registration AND retries both live inside this single mount-only
  // effect — never in the render body, not even ref-guarded. A real bug
  // caught here (data/audit/13): React can invoke this component's render
  // function more than once for what becomes ONE logical mount while a
  // Suspense boundary above it resolves (one invocation gets committed,
  // the other is discarded) — a side effect like delayRender() in the
  // render body runs for BOTH, permanently orphaning one handle even
  // though only one fiber ever gets a useEffect/cleanup cycle to release
  // it (the discarded one silently never runs its effects at all, which
  // is how this was diagnosed: its console.log calls in the render body
  // fired, but its useEffect-guarded logging never did). useEffect with an
  // empty dependency array does not have this problem — React only runs
  // effects for fibers that actually commit.
  React.useEffect(() => {
    const handle = delayRender("Waiting for PhotoTreatment's EffectComposer to paint a real frame");
    let released = false;
    let attempts = 0;
    let timeoutId = null;

    function attempt() {
      if (released) return;
      advance(performance.now());
      attempts += 1;
      if (composerRef.current) {
        released = true;
        continueRender(handle);
        return;
      }
      if (attempts >= MAX_RETRIES) {
        console.warn(
          `PhotoTreatment: EffectComposer did not become ready after ${MAX_RETRIES} attempts — releasing Remotion's render anyway. This frame likely has no post-fx treatment; investigate before trusting this render.`
        );
        released = true;
        continueRender(handle);
        return;
      }
      timeoutId = setTimeout(attempt, RETRY_DELAY_MS);
    }
    attempt();

    return () => {
      released = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * @param {object} props
 * @param {string} props.src        staticFile()-resolved image URL
 * @param {"cutout"|"fullbleed"} props.treatment
 * @param {number} props.width      container box width, px
 * @param {number} props.height     container box height, px
 */
export function PhotoTreatment({ src, treatment, width, height }) {
  const orthoCamera = useMemo(
    () => ({ left: -width / 2, right: width / 2, top: height / 2, bottom: -height / 2, near: -1000, far: 1000, position: [0, 0, 10] }),
    [width, height]
  );
  const composerRef = useRef(null);

  return (
    <ThreeCanvas
      width={width}
      height={height}
      orthographic
      camera={orthoCamera}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={1} />
      <Plane src={src} treatment={treatment} containerWidth={width} containerHeight={height} />
      <EffectComposer ref={composerRef} enableNormalPass={false} autoClear={false}>
        <Vignette {...VIGNETTE_PROPS} />
        <Noise {...NOISE_PROPS} />
        <ChromaticAberration {...CHROMATIC_ABERRATION_PROPS} />
        <LutLayer />
      </EffectComposer>
      <PostFxReadyGate composerRef={composerRef} />
    </ThreeCanvas>
  );
}

export default PhotoTreatment;
