/**
 * LayeredScene — a beat as a composed, moving frame, not a picture.
 *
 * A VISUAL beat is up to four layers, drawn in this order, each with its
 * OWN continuous motion at its OWN speed (so the frame has parallax):
 *
 *   base     a real photo (asset-library/…) filling the stage, or — when no
 *            real asset resolved — the beat's fallback library drawing.
 *            Entrance: slides in from above on an ease-out while a blur
 *            resolves (0 -> 0.45 s). Then a continuous push or drift for the
 *            whole beat. Never still.
 *   texture  film grain over the base (procedural SVG noise, re-seeded
 *            every 2 frames). Keeps a stock photo from reading as clean.
 *   overlay  the sentence's number, entering from the right with a blur
 *            that resolves, then drifting at 2x the base's rate (parallax).
 *   type     the kinetic phrase: words slam in one at a time on a flat band,
 *            or (mask) the words are FILLED WITH THE PHOTO — the image shows
 *            through the letters.
 *
 * Everything is clipped to the stage (scene-primitives SAFE, the 8% / 15%
 * margin area) because frame-audit.js requires the margins outside it to be
 * flat background; a full-bleed photo would fail that gate on every frame.
 * The camera (the stage itself) stays put; the layers move inside it.
 *
 * Built by the asset resolver (render-and-qa.js) — the planner never writes
 * layers. Colours come only from the channel's editorial palette (ed.*).
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, Easing } from "remotion";
import { SAFE, SAFE_W, SAFE_H } from "../visual/scene-primitives.js";
import { ComposedScene } from "./composed-scene.jsx";

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

function Stage({ children, ed }) {
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: SAFE.top, width: SAFE_W, height: SAFE_H, overflow: "hidden", backgroundColor: ed.bg }}>
      {children}
    </div>
  );
}

// Continuous motion over the whole beat, after the entrance.
function camera(motion, p, amp = 1) {
  const t = clamp01(p);
  switch (motion) {
    case "drift-left": return { tx: -0.03 * amp * SAFE_W * t, scale: 1.04 };
    case "drift-right": return { tx: 0.03 * amp * SAFE_W * t, scale: 1.04 };
    case "push-slow": return { tx: 0, scale: 1.02 + 0.03 * amp * t };
    case "push":
    default: return { tx: 0, scale: 1.02 + 0.06 * amp * t };
  }
}

function BaseLayer({ layer, p, local, fps, ed, font }) {
  const enter = easeOut(clamp01(local / (0.45 * fps)));
  const cam = camera(layer.motion, p);
  const dy = (1 - enter) * -0.08 * SAFE_H;
  const blur = (1 - enter) * 14;
  if (layer.kind === "photo") {
    const fit = layer.variant && layer.variant !== "photo" ? "contain" : "cover";
    return (
      <div style={{ position: "absolute", inset: 0, filter: `blur(${blur.toFixed(2)}px)`, transform: `translate(${cam.tx}px, ${dy}px) scale(${cam.scale})`, transformOrigin: "center" }}>
        <Img src={staticFile(layer.asset)} style={{ width: "100%", height: "100%", objectFit: fit }} />
      </div>
    );
  }
  // Fallback drawing as the base: the library drawing, laid out by
  // ComposedScene in page coordinates, moved by the same camera.
  return (
    <div style={{ position: "absolute", left: -SAFE.left, top: -SAFE.top, width: 1080, height: 1920, filter: `blur(${blur.toFixed(2)}px)`,
      transform: `translate(${cam.tx}px, ${dy}px) scale(${cam.scale})`, transformOrigin: `${SAFE.left + SAFE_W / 2}px ${SAFE.top + SAFE_H / 2}px` }}>
      {/* No label here: the type layer carries the words. Passing it drew a
          second, clipped copy beside the type band (run 36355665493 ch-48). */}
      <ComposedScene scene={{ objects: [{ kind: "library_shape", name: layer.name, anchor: "center", motion: "appear", emphasis: true }] }}
        p={1} ed={ed} font={font} local={local} fps={fps} />
    </div>
  );
}

function TextureLayer({ local, uid }) {
  const seed = Math.floor(local / 2) % 97;
  const id = `grain-${uid}`;
  return (
    <svg width={SAFE_W} height={SAFE_H} style={{ position: "absolute", inset: 0, opacity: 0.1, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <filter id={id}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

function OverlayNumber({ layer, p, local, fps, ed, font, baseMotion }) {
  const enter = easeOut(clamp01((local - 0.25 * fps) / (0.4 * fps)));
  const par = camera(baseMotion, p, 2);             // 2x the base: parallax
  const tx = (1 - enter) * 0.5 * SAFE_W + par.tx * 0.5;
  return (
    <div style={{ position: "absolute", right: SAFE_W * 0.06, top: SAFE_H * 0.06, transform: `translateX(${tx}px)`,
      filter: `blur(${((1 - enter) * 10).toFixed(2)}px)`, opacity: enter,
      padding: "10px 22px", backgroundColor: ed.bg, color: ed.accentText || ed.text,
      font: `900 ${Math.round(SAFE_H * 0.075)}px ${font}, sans-serif`, letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>
      {layer.text}
    </div>
  );
}

function TypeLayer({ layer, p, local, fps, ed, font, photo }) {
  const words = String(layer.text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const start = 0.35 * fps, step = 0.16 * fps;
  const size = Math.round(Math.min(SAFE_W / Math.max(6, String(layer.text).length * 0.62), SAFE_H * 0.085));
  const mask = layer.style === "mask" && photo;
  const bandIn = easeOut(clamp01((local - start + 4) / 8));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: SAFE_H * 0.07, display: "flex", justifyContent: "center" }}>
      <div style={{ padding: "18px 28px", backgroundColor: mask ? ed.bg : ed.bg, opacity: bandIn, transform: `scaleX(${0.9 + 0.1 * bandIn})`,
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${Math.round(size * 0.28)}px`, maxWidth: SAFE_W * 0.9 }}>
        {words.map((w, i) => {
          const t = easeOut(clamp01((local - start - i * step) / (0.22 * fps)));
          const common = { display: "inline-block", font: `900 ${size}px ${font}, sans-serif`, letterSpacing: -size * 0.02, lineHeight: 1.05,
            opacity: t, transform: `scale(${1.25 - 0.25 * t})`, transformOrigin: "center bottom" };
          return mask
            ? <span key={i} style={{ ...common, backgroundImage: `url(${staticFile(photo)})`, backgroundSize: `${SAFE_W}px ${SAFE_H}px`,
                backgroundPosition: "center", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" }}>{w}</span>
            : <span key={i} style={{ ...common, color: ed.text }}>{w}</span>;
        })}
      </div>
    </div>
  );
}

export function LayeredScene({ layers, p, local = 0, fps = 30, ed, font, uid = "0" }) {
  const base = layers.find((l) => l.role === "base");
  if (!base) throw new Error("LayeredScene: a layered beat must have a base layer (photo or fallback drawing)");
  const overlay = layers.find((l) => l.role === "overlay");
  const type = layers.find((l) => l.role === "type");
  const texture = layers.find((l) => l.role === "texture");
  const photo = base.kind === "photo" ? base.asset : null;
  return (
    <AbsoluteFill>
      <Stage ed={ed}>
        <BaseLayer layer={base} p={p} local={local} fps={fps} ed={ed} font={font} />
        {texture && base.kind === "photo" ? <TextureLayer local={local} uid={uid} /> : null}
        {overlay ? <OverlayNumber layer={overlay} p={p} local={local} fps={fps} ed={ed} font={font} baseMotion={base.motion} /> : null}
        {type ? <TypeLayer layer={type} p={p} local={local} fps={fps} ed={ed} font={font} photo={photo} /> : null}
      </Stage>
    </AbsoluteFill>
  );
}

export default LayeredScene;
