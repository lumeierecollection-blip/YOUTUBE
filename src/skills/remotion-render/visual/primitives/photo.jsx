/**
 * Photo primitive — a real, fetched image (photograph, screenshot, scanned
 * document or real chart) drawn from the Remotion public dir.
 *
 * Only the asset resolver in scripts/render-and-qa.js writes photo objects
 * into a plan (the planner describes a `concept`; it never names a file).
 * The asset is one of public/asset-library/manifest.json's entries, each
 * with its source URL and license recorded — see scripts/fetch-assets.cjs.
 *
 * ONE movement per photo beat, continuous across the beat, set by the
 * resolver deterministically from the concept (`movement`):
 *   push          scale 1.00 -> 1.03 over the whole beat
 *   drift-left    translate 0 -> -2% of the width over the whole beat
 *   drift-right   translate 0 -> +2%
 *   reveal-left   wipe in from the left over the first 0.4 s, then hold
 *   reveal-right  wipe in from the right over the first 0.4 s, then hold
 * The composition camera is static; this moves the image inside its own
 * clipped container only.
 */
import React from "react";
import { Img, staticFile } from "remotion";

export const PHOTO_VARIANTS = ["photo", "screenshot", "document", "chart"];
export const PHOTO_MOVEMENTS = ["push", "drift-left", "drift-right", "reveal-left", "reveal-right"];

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));

export function Photo({ obj, rect, ed, p, local = 0, fps = 30 }) {
  const prog = clamp01(p);
  const mv = obj.movement || "push";
  let scale = 1, tx = 0, clip = "inset(0 0 0 0)";
  if (mv === "push") scale = 1 + 0.03 * prog;
  else if (mv === "drift-left") tx = -0.02 * rect.w * prog;
  else if (mv === "drift-right") tx = 0.02 * rect.w * prog;
  else if (mv === "reveal-left" || mv === "reveal-right") {
    const r = clamp01(local / (0.4 * fps));
    const hidden = (1 - r) * 100;
    clip = mv === "reveal-left" ? `inset(0 ${hidden}% 0 0)` : `inset(0 0 0 ${hidden}%)`;
  }
  // Screenshots, documents and charts carry text that must stay legible, so
  // they are fitted whole (contain); a photograph fills its frame (cover).
  const fit = obj.variant && obj.variant !== "photo" ? "contain" : "cover";
  return (
    <div style={{
      position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h,
      overflow: "hidden", clipPath: clip, backgroundColor: ed.bg,
    }}>
      <Img src={staticFile(obj.asset)} style={{
        width: "100%", height: "100%", objectFit: fit,
        transform: `translateX(${tx}px) scale(${scale})`, transformOrigin: "center center",
      }} />
    </div>
  );
}

export default Photo;
