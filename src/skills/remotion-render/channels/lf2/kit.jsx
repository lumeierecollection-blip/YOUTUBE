// Long form v2 shared kit: type, timing helpers, the transition components and the audio layer. Channel looks live in their own files.
// Transitions here are real two-scene blends (both scenes render and are combined per frame), not a swap between two pictures.
import React from "react";
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";

export const F = { cond: '"Roboto Condensed", "Arial Narrow", sans-serif', sans: '"Inter", sans-serif', mono: '"JetBrains Mono", monospace', serif: '"Noto Serif", Georgia, serif', display: '"Playfair Display", Georgia, serif', grot: '"Space Grotesk", "Inter", sans-serif' };
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
export const eo = Easing.out(Easing.cubic), eio = Easing.inOut(Easing.cubic), expo = Easing.out(Easing.exp);
export const ramp = (f, a, b, e = eo) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
export const lerp = (f, a, b, x, y, e = eo) => interpolate(f, [a, b], [x, y], { ...clamp, easing: e });
export const Fonts = () => <style>{FONT_FACES}</style>;

/** Runs children with their own clock starting at `from` (so a scene inside a transition animates from its own frame 0 or a held frame). */
export function At({ from = 0, hold, children }) { return <Sequence from={from} layout="none">{hold == null ? children : <Freeze at={hold}>{children}</Freeze>}</Sequence>; }
import { Freeze as RFreeze } from "remotion";
const Freeze = ({ at, children }) => <RFreeze frame={at}>{children}</RFreeze>;

/**
 * Transition between two rendered scenes over `dur` frames. `a` is shown from its frame `aAt` onward (it keeps moving), `b` starts at its frame 0.
 * kinds: cut | dissolve | dip (through black) | push (b pushes a out, direction dir) | blurwhip (directional blur + slide) | zoomthrough
 * (a scales up and blurs while b scales in from small: used map-to-map) | wipe (a hard edge with a thin accent line crosses the frame).
 */
export function Transition({ kind = "dissolve", dur = 15, a, b, aAt = 60, dir = "left", accent = "#fff" }) {
  const f = useCurrentFrame(), { width: W, height: H } = useVideoConfig(), p = interpolate(f, [0, dur], [0, 1], { ...clamp, easing: eio });
  const A = <RFreeze frame={aAt + f}>{a}</RFreeze>, B = b;
  const sx = dir === "left" ? -1 : dir === "right" ? 1 : 0, sy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
  if (kind === "cut") return <AbsoluteFill>{f < dur / 2 ? A : B}</AbsoluteFill>;
  if (kind === "dissolve") return <AbsoluteFill>{A}<AbsoluteFill style={{ opacity: p }}>{B}</AbsoluteFill></AbsoluteFill>;
  if (kind === "dip") { const k = p < 0.5 ? p * 2 : (1 - p) * 2; return <AbsoluteFill style={{ background: "#000" }}>{p < 0.5 ? A : B}<AbsoluteFill style={{ background: "#000", opacity: k }} /></AbsoluteFill>; }
  if (kind === "push") return <AbsoluteFill style={{ background: "#000" }}><AbsoluteFill style={{ transform: `translate(${sx * p * W}px, ${sy * p * H}px)` }}>{A}</AbsoluteFill><AbsoluteFill style={{ transform: `translate(${-sx * (1 - p) * W}px, ${-sy * (1 - p) * H}px)` }}>{B}</AbsoluteFill></AbsoluteFill>;
  if (kind === "blurwhip") { const blur = Math.sin(p * Math.PI) * 16; return <AbsoluteFill style={{ background: "#000" }}><AbsoluteFill style={{ transform: `translateX(${sx * p * W}px)`, filter: `blur(${blur}px)` }}>{A}</AbsoluteFill><AbsoluteFill style={{ transform: `translateX(${-sx * (1 - p) * W}px)`, filter: `blur(${blur}px)` }}>{B}</AbsoluteFill></AbsoluteFill>; }
  if (kind === "zoomthrough") return <AbsoluteFill style={{ background: "#000" }}><AbsoluteFill style={{ transform: `scale(${1 + p * 2.2})`, filter: `blur(${p * 14}px)`, opacity: 1 - ramp(p, 0.45, 0.9) }}>{A}</AbsoluteFill><AbsoluteFill style={{ transform: `scale(${0.55 + 0.45 * p})`, filter: `blur(${(1 - p) * 14}px)`, opacity: ramp(p, 0.25, 0.75) }}>{B}</AbsoluteFill></AbsoluteFill>;
  if (kind === "wipe") { const x = p * (W + 40) - 20; return <AbsoluteFill>{A}<AbsoluteFill style={{ clipPath: `inset(0 ${Math.max(0, W - x)}px 0 0)` }}>{B}</AbsoluteFill><div style={{ position: "absolute", left: x - 3, top: 0, width: 6, height: H, background: accent, opacity: p > 0.02 && p < 0.98 ? 1 : 0 }} /></AbsoluteFill>; }
  return <AbsoluteFill>{B}</AbsoluteFill>;
}

/**
 * Audio layer for a scene or an episode. Sound profile comes from config/longform-audio.json (per channel): a music bed that ducks under the
 * voice, and timed effects. cues: [{ at (frame), file (under public/), gain }]. bed: { file, gain, duckTo }. voice: { file }.
 * Stills carry no sound; this is rendered only in a timeline, which waits for approval.
 */
export function AudioLayer({ bed, voice, cues = [], voiceRanges = [] }) {
  const { fps } = useVideoConfig();
  const duck = (f) => { if (!bed) return 0; let v = bed.gain ?? 0.5; for (const [s, e] of voiceRanges) { const k = Math.min(ramp(f, s - fps * 0.25, s), 1 - ramp(f, e, e + fps * 0.6)); v = Math.min(v, (bed.gain ?? 0.5) + ((bed.duckTo ?? 0.12) - (bed.gain ?? 0.5)) * Math.max(0, k)); } return v; };
  return (<>
    {bed && <Audio src={staticFile(bed.file)} loop volume={duck} />}
    {voice && <Audio src={staticFile(voice.file)} />}
    {cues.map((c, i) => <Sequence key={i} from={c.at} layout="none"><Audio src={staticFile(c.file)} volume={c.gain ?? 0.6} /></Sequence>)}
  </>);
}

/** Film grain + vignette finishing layer, deterministic per frame. */
export function Finish({ grain = 0.05, vignette = 0.5 }) {
  const f = useCurrentFrame();
  return (<>
    <AbsoluteFill style={{ background: `radial-gradient(90% 85% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${vignette}) 100%)`, pointerEvents: "none" }} />
    {grain > 0 && <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: grain, mixBlendMode: "overlay", pointerEvents: "none" }}><filter id={`g${f % 7}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 7} /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter={`url(#g${f % 7})`} /></svg>}
  </>);
}

/** Types text by frame: returns the visible part. cps = characters per second. */
export const typed = (text, f, fps, cps = 22, start = 0) => text.slice(0, Math.max(0, Math.floor(((f - start) / fps) * cps)));
