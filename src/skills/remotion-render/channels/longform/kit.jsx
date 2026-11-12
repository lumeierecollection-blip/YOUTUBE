// Long-form shared kit (16:9, 1920x1080). Nothing in here knows a channel. The Shorts kit (channels/_shared/*) is not used.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { clamp } from "../_shared/parts.jsx";

export const W = 1920, H = 1080;
export const ramp = (f, a, b, e = Easing.out(Easing.cubic)) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
export const abs = (x, y, w, h, extra) => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });

/**
 * Transition stage: scene A leaves and scene B arrives, driven by progress p (0 to 1), so a still at p = 0, 0.5 and 1 shows the real transition.
 * Each kind is used for a reason, never one on every cut:
 *   dissolve  = time passing / same place        push = moving on to the next place or era      wipe = reveal of a document or answer
 *   iris      = focus on one detail (a pin, a face) slate = a hard cut with a dip for a change of subject
 */
export function TransitionStage({ kind = "dissolve", p, a, b }) {
  const e = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, p)));
  const layer = (style, child) => <AbsoluteFill style={style}>{child}</AbsoluteFill>;
  if (kind === "push") return <AbsoluteFill style={{ overflow: "hidden" }}>{layer({ transform: `translateX(${-e * W}px)` }, a)}{layer({ transform: `translateX(${(1 - e) * W}px)` }, b)}</AbsoluteFill>;
  if (kind === "wipe") return <AbsoluteFill>{layer({}, a)}{layer({ clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` }, b)}<div style={abs(e * W - 6, 0, 12, H, { background: "rgba(255,255,255,0.9)", opacity: e > 0 && e < 1 ? 1 : 0 })} /></AbsoluteFill>;
  if (kind === "iris") return <AbsoluteFill>{layer({}, a)}{layer({ clipPath: `circle(${e * 1500}px at 50% 50%)` }, b)}</AbsoluteFill>;
  if (kind === "slate") return <AbsoluteFill>{layer({ opacity: 1 - Math.min(1, e * 2) }, a)}{layer({ opacity: Math.max(0, e * 2 - 1) }, b)}<AbsoluteFill style={{ background: "#000", opacity: 1 - Math.abs(e * 2 - 1) }} /></AbsoluteFill>;
  return <AbsoluteFill>{layer({ opacity: 1 - e }, a)}{layer({ opacity: e }, b)}</AbsoluteFill>;
}

/** A label strip that says what a still is, for the approval sheets only (never part of a video). */
export const Tag = ({ children }) => <div style={abs(0, H - 36, W, 36, { background: "rgba(0,0,0,0.75)", color: "#fff", fontFamily: "monospace", fontSize: 20, padding: "6px 14px", boxSizing: "border-box" })}>{children}</div>;
