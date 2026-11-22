// Long form v2 (rebuilt from the 20 fixed references, docs/longform/DESIGN-LAWS.md). Two generic compositions:
//   LF2Scene: props { ch, type, t (theme), ...scene data }   -> one scene of a channel's library
//   LF2Tx:    props { kind, dur, aAt, a: scene, b: scene }   -> a real transition between two scenes
// Scene data arrives as props from platform/longform/stills/specs.mjs now, and from an episode storyboard later. Nothing is hard-coded here.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Transition } from "./kit.jsx";
import { RIVAL } from "./rival.jsx";
import { HIDDEN } from "./hidden.jsx";
import { AITEST } from "./aitest.jsx";
import { COURT } from "./court.jsx";
import { SPACE } from "./space.jsx";
import { PSYCH } from "./psych.jsx";
import { CELEB } from "./celebnews.jsx";

import { IX } from "./ix.jsx";
import { EP } from "./ep.jsx";
import { FX } from "./fx.jsx";

const LIB = { "rival-lines": { ...RIVAL, ...IX }, "hidden-past": { ...HIDDEN, ...EP, ...FX }, "ai-tested": AITEST, "court-and-spotlight": COURT, "red-space-facts": SPACE, psychology: PSYCH, "celebrity-news": CELEB, "fx-stick": FX, "fx-toon": FX, "fx-doc": { ...HIDDEN, ...EP, ...IX, ...FX } };
// Quick full-frame shots, the references' rhythm (a new picture every ~2.5-4 s, hard cuts, something always moving).
//  s.cutaways: [{ at, dur, video|image, ss?, pos?, zoom? , credit? }]  seconds; drawn over any scene
//  type "montage": s.shots: [{ dur, video|image, ss?, pos?, zoom? }] one after another
const Shot = ({ sh, n }) => {
  const f = useCurrentFrame(), z = sh.zoom || [1.0, 1.1], dir = n % 2 ? 1 : -1, dur = Math.max(1, Math.round((sh.dur || 3) * 30));
  const k = interpolate(f, [0, dur], [0, 1], { extrapolateRight: "clamp" }), scale = z[0] + (z[1] - z[0]) * k, shift = dir * (k - 0.5) * 36;
  const media = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: sh.pos || "50% 50%", transform: `scale(${scale}) translateX(${shift}px)` };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {sh.video ? <OffthreadVideo src={staticFile(sh.video)} muted startFrom={Math.round((sh.ss || 0) * 30)} style={media} /> : <Img src={staticFile(sh.image)} style={media} />}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.5) 100%)" }} />
      <div style={{ position: "absolute", right: 28, bottom: 18, fontFamily: "Inter, Helvetica, Arial, sans-serif", fontSize: 16, color: "rgba(255,255,255,0.8)", textShadow: "0 1px 3px #000" }}>{sh.credit || "Footage: Pixabay Content License · illustrative"}</div>
    </AbsoluteFill>
  );
};
const Cutaways = ({ list }) => <>{list.map((c, i) => <Sequence key={i} from={Math.round((c.at || 0) * 30)} durationInFrames={Math.max(1, Math.round((c.dur || 2.5) * 30))} layout="none"><Shot sh={c} n={i} /></Sequence>)}</>;
// The shots repeat in order until the beat ends: a beat longer than its shots used to end on the black background (2.75 s and 6.75 s of black in the
// 18 Nov 2026 home-advantage render). Repeats start later in each clip (ss + 1.5 s per pass, wrapped at 5 s so it stays inside a 9 s clip) so a repeat is not the identical picture.
const Montage = ({ shots = [] }) => { const { durationInFrames: total } = useVideoConfig(); const list = []; let at = 0, pass = 0;
  while (shots.length && at < total && pass < 20) { for (const sh of shots) { if (at >= total) break; const d = Math.round((sh.dur || 3) * 30); list.push({ sh: pass ? { ...sh, ss: ((sh.ss || 0) + 1.5 * pass) % 5 } : sh, from: at, d }); at += d; } pass++; }
  return <AbsoluteFill style={{ background: "#000" }}>{list.map((x, i) => <Sequence key={i} from={x.from} durationInFrames={x.d} layout="none"><Shot sh={x.sh} n={i} /></Sequence>)}</AbsoluteFill>; };

export function renderScene(s) {
  if (s.type === "montage") return <Montage shots={s.shots} />;
  const C = LIB[s.ch] && LIB[s.ch][s.type];
  if (!C) return <AbsoluteFill style={{ background: "#300", color: "#fff", fontSize: 60, alignItems: "center", justifyContent: "center" }}>no scene {s.ch}/{s.type}</AbsoluteFill>;
  return <><C {...s} />{s.cutaways && s.cutaways.length ? <Cutaways list={s.cutaways} /> : null}{s.autoCredit && s.autoCredit.length ? <AutoCredit lines={s.autoCredit} /> : null}</>;
}
// Generic credit line for an authentic picture whose scene has no credit of its own (platform/longform/v2/credits.mjs): small, lower-left, on a soft dark strip for legibility.
const AutoCredit = ({ lines }) => <div style={{ position: "absolute", left: 0, bottom: 0, padding: "10px 34px 14px", fontFamily: "Inter, Helvetica, Arial, sans-serif", fontSize: 18, lineHeight: 1.25, color: "rgba(255,255,255,0.92)", background: "linear-gradient(90deg, rgba(0,0,0,0.62), rgba(0,0,0,0))", maxWidth: 1300, textShadow: "0 1px 3px #000" }}>{lines.join("  ·  ")}</div>;
const Scene = (p) => renderScene(p);
const Tx = ({ kind, dur, aAt, a, b, dir, accent }) => <Transition kind={kind} dur={dur} aAt={aAt} dir={dir} accent={accent} a={renderScene(a)} b={renderScene(b)} />;

export const compositions = [
  { id: "LF2Scene", component: Scene, durationInFrames: 600, fps: 30, width: 1920, height: 1080, defaultProps: { ch: "rival-lines", type: "number", t: { accent: "#C8F04B" }, value: 0 } },
  { id: "LF2Tx", component: Tx, durationInFrames: 120, fps: 30, width: 1920, height: 1080, defaultProps: { kind: "dissolve", dur: 15, aAt: 60, a: { ch: "rival-lines", type: "number", t: { accent: "#C8F04B" }, value: 1 }, b: { ch: "rival-lines", type: "number", t: { accent: "#C8F04B" }, value: 2 } } },
];
