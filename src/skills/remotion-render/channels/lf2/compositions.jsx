// Long form v2 (rebuilt from the 20 fixed references, docs/longform/DESIGN-LAWS.md). Two generic compositions:
//   LF2Scene: props { ch, type, t (theme), ...scene data }   -> one scene of a channel's library
//   LF2Tx:    props { kind, dur, aAt, a: scene, b: scene }   -> a real transition between two scenes
// Scene data arrives as props from platform/longform/stills/specs.mjs now, and from an episode storyboard later. Nothing is hard-coded here.
import React from "react";
import { AbsoluteFill } from "remotion";
import { Transition } from "./kit.jsx";
import { RIVAL } from "./rival.jsx";
import { HIDDEN } from "./hidden.jsx";
import { AITEST } from "./aitest.jsx";
import { COURT } from "./court.jsx";
import { SPACE } from "./space.jsx";
import { PSYCH } from "./psych.jsx";
import { CELEB } from "./celebnews.jsx";

const LIB = { "rival-lines": RIVAL, "hidden-past": HIDDEN, "ai-tested": AITEST, "court-and-spotlight": COURT, "red-space-facts": SPACE, psychology: PSYCH, "celebrity-news": CELEB };
export function renderScene(s) {
  const C = LIB[s.ch] && LIB[s.ch][s.type];
  if (!C) return <AbsoluteFill style={{ background: "#300", color: "#fff", fontSize: 60, alignItems: "center", justifyContent: "center" }}>no scene {s.ch}/{s.type}</AbsoluteFill>;
  return <><C {...s} />{s.autoCredit && s.autoCredit.length ? <AutoCredit lines={s.autoCredit} /> : null}</>;
}
// Generic credit line for an authentic picture whose scene has no credit of its own (platform/longform/v2/credits.mjs): small, lower-left, on a soft dark strip for legibility.
const AutoCredit = ({ lines }) => <div style={{ position: "absolute", left: 0, bottom: 0, padding: "10px 34px 14px", fontFamily: "Inter, Helvetica, Arial, sans-serif", fontSize: 18, lineHeight: 1.25, color: "rgba(255,255,255,0.92)", background: "linear-gradient(90deg, rgba(0,0,0,0.62), rgba(0,0,0,0))", maxWidth: 1300, textShadow: "0 1px 3px #000" }}>{lines.join("  ·  ")}</div>;
const Scene = (p) => renderScene(p);
const Tx = ({ kind, dur, aAt, a, b, dir, accent }) => <Transition kind={kind} dur={dur} aAt={aAt} dir={dir} accent={accent} a={renderScene(a)} b={renderScene(b)} />;

export const compositions = [
  { id: "LF2Scene", component: Scene, durationInFrames: 600, fps: 30, width: 1920, height: 1080, defaultProps: { ch: "rival-lines", type: "number", t: { accent: "#C8F04B" }, value: 0 } },
  { id: "LF2Tx", component: Tx, durationInFrames: 120, fps: 30, width: 1920, height: 1080, defaultProps: { kind: "dissolve", dur: 15, aAt: 60, a: { ch: "rival-lines", type: "number", t: { accent: "#C8F04B" }, value: 1 }, b: { ch: "rival-lines", type: "number", t: { accent: "#C8F04B" }, value: 2 } } },
];
