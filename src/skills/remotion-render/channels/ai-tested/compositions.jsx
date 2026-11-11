// AI Tested Short. Props come from platform/channels/ai-tested/preview.mjs: real capture crops,
// real terminal output, per-scene timings measured from the generated voice.
import React from "react";
import { AbsoluteFill, Sequence, staticFile, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { experimentCompositions } from "./experiment.jsx";
import { honestyCompositions } from "./honesty.jsx";
import { spelloutCompositions } from "./spellout.jsx";
import { randomCompositions } from "./randompick.jsx";
import { pushbackCompositions } from "./pushback.jsx";
import { linksCompositions } from "./links.jsx";
import { privacyCompositions } from "./privacy.jsx";
import { unknownCompositions } from "./unknown.jsx";

const C = { bg: "#FFFFFF", surface: "#F3F4F6", ink: "#111827", dim: "#6B7280", stroke: "#D1D5DB", accent: "#0E7490", termBg: "#111418", termHead: "#1F2429", termText: "#E5E7EB", termGreen: "#4ADE80" };
const SANS = '"Space Grotesk", sans-serif', MONO = '"JetBrains Mono", monospace';
const ease = Easing.out(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

const useIn = (delay = 0, len = 10) => interpolate(useCurrentFrame(), [delay, delay + len], [0, 1], { ...clamp, easing: ease });
const Rise = ({ delay = 0, children, style }) => { const t = useIn(delay); return <div style={{ opacity: t, transform: `translateY(${(1 - t) * 24}px)`, ...style }}>{children}</div>; };
const abs = (x, y, w, h, extra) => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });

/** Scene wrapper: fades the scene in and out so a cut follows the narration, not a template. */
function SceneBox({ dur, children }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6, dur - 6, dur], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

/** Marker stroke drawn left to right over real pixels. rect is in the displayed image's coordinates. */
function Marker({ rect, delay = 6, len = 14 }) {
  const t = useIn(delay, len);
  return <div style={{ ...abs(rect.x - 6, rect.y - 4, (rect.w + 12) * t, rect.h + 8), background: C.accent, opacity: 0.28, borderRadius: 6, mixBlendMode: "multiply" }} />;
}

/** A real capture in a browser window frame, with highlight and a feature callout. */
function CaptureWindow({ cap, x, y, w, url, markDelay = 8, callout, calloutDelay = 24 }) {
  const chrome = 64, inner = w - 24, scale = inner / cap.w, h = Math.round(cap.h * scale);
  const hl = { x: cap.hl.x * scale, y: cap.hl.y * scale, w: cap.hl.w * scale, h: cap.hl.h * scale };
  return (
    <Rise style={abs(x, y, w, chrome + h + 12)}>
      <div style={{ ...abs(0, 0, w, chrome + h + 12), background: C.surface, border: `2px solid ${C.stroke}`, borderRadius: 24, overflow: "hidden" }}>
        <div style={abs(0, 0, w, chrome, { display: "flex", alignItems: "center", gap: 10, padding: "0 20px" })}>
          {["#EF4444", "#F59E0B", "#22C55E"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
          <div style={{ marginLeft: 16, flex: 1, height: 36, borderRadius: 18, background: C.bg, border: `1px solid ${C.stroke}`, fontFamily: MONO, fontSize: 20, color: C.dim, display: "flex", alignItems: "center", padding: "0 18px", overflow: "hidden", whiteSpace: "nowrap" }}>{url}</div>
        </div>
        <div style={abs(12, chrome, inner, h, { overflow: "hidden", borderRadius: 8, background: "#fff" })}>
          <img src={staticFile(cap.file)} style={{ width: inner, height: h, display: "block" }} />
          <Marker rect={hl} delay={markDelay} />
        </div>
      </div>
      {callout ? <Callout x={Math.min(w - 40, 12 + hl.x + hl.w * 0.5)} y={chrome + hl.y + hl.h} text={callout} delay={calloutDelay} w={w} dy={h - hl.y - hl.h + 40} /> : null}
    </Rise>
  );
}

/** Callout: a line from the highlighted pixels to a label that names the feature. */
function Callout({ x, y, text, delay, w, dy }) {
  const t = useIn(delay, 10);
  return (
    <>
      <div style={{ ...abs(0, y + dy, w, 96), opacity: t, display: "flex", justifyContent: "center" }}>
        <div style={{ background: C.ink, color: "#fff", borderRadius: 16, padding: "16px 28px", fontFamily: SANS, fontWeight: 700, fontSize: 38, lineHeight: 1.15, maxWidth: w - 40, textAlign: "center" }}>{text}</div>
      </div>
    </>
  );
}

const Headline = ({ children, size = 84, delay = 0, top = 260 }) => <Rise delay={delay} style={abs(70, top, 940, 300, { fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.06, color: C.ink, letterSpacing: "0.01em" })}>{children}</Rise>;
const Source = ({ text, y }) => <div style={abs(70, y, 940, 40, { fontFamily: MONO, fontSize: 24, color: C.dim, textAlign: "center" })}>{text}</div>;

function Hook({ dur, p }) {
  return (
    <SceneBox dur={dur}>
      <Headline size={128} top={300}>NO CHAT.<br /><span style={{ color: C.accent }}>ONE ANSWER.</span></Headline>
      <Rise delay={18} style={abs(70, 800, 940, 520)}>
        {[["claude", "Start interactive session", false], ['claude -p "query"', "Query via SDK, then exit", true]].map(([cmd, d, on], i) => (
          <div key={cmd} style={{ marginBottom: 36, padding: "30px 36px", borderRadius: 24, background: on ? C.bg : C.surface, border: `${on ? 4 : 2}px solid ${on ? C.accent : C.stroke}` }}>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 52, color: C.ink }}>{cmd}</div>
            <div style={{ fontFamily: SANS, fontSize: 40, color: on ? C.accent : C.dim, marginTop: 10, fontWeight: 700 }}>{d}</div>
          </div>
        ))}
        <div style={{ fontFamily: MONO, fontSize: 24, color: C.dim }}>Wording from the CLI reference command table</div>
      </Rise>
    </SceneBox>
  );
}

function Reference({ dur, p }) {
  return (
    <SceneBox dur={dur}>
      <Headline size={64} top={250}>THE FLAG IS DOCUMENTED</Headline>
      <CaptureWindow cap={p.captures.print} x={60} y={380} w={960} url={p.pageUrl} callout="--print / -p: no interactive mode" />
      <Source text={`SOURCE: ${p.pageHost} (capture taken in this render)`} y={1480} />
    </SceneBox>
  );
}

function Terminal({ dur, p }) {
  const f = useCurrentFrame();
  const cmd = p.terminal.display, out = p.terminal.lines;
  const typeEnd = Math.round(dur * 0.38);
  const typed = Math.min(cmd.length, Math.floor((f / typeEnd) * cmd.length));
  const done = f >= typeEnd;
  const blink = Math.floor(f / 15) % 2 === 0;
  const lineW = 36;
  const wrapped = []; { let cur = ""; for (const w of cmd.split(" ")) { if ((cur + " " + w).trim().length > lineW) { wrapped.push(cur + " "); cur = w; } else cur = (cur + " " + w).trim(); } wrapped.push(cur); }
  let shown = typed;
  const cmdLines = wrapped.map((l, i) => { const s = Math.max(0, Math.min(l.length, shown)); shown -= l.length; return l.slice(0, s); });
  const outFrom = typeEnd + 8;
  const th = 120 + (wrapped.length + out.length) * 58 + 40;
  return (
    <SceneBox dur={dur}>
      <Headline size={64} top={250}>RUN IT. READ THE OUTPUT.</Headline>
      <div style={abs(60, 470, 960, th, { background: C.termBg, borderRadius: 24, overflow: "hidden", border: `2px solid ${C.ink}` })}>
        <div style={abs(0, 0, 960, 56, { background: C.termHead, display: "flex", alignItems: "center", gap: 10, padding: "0 22px" })}>
          {["#EF4444", "#F59E0B", "#22C55E"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
          <span style={{ fontFamily: MONO, fontSize: 22, color: "#9CA3AF", marginLeft: 14 }}>bash - ubuntu runner</span>
        </div>
        <div style={abs(36, 84, 890, th - 90, { fontFamily: MONO, fontSize: 35, lineHeight: "58px", color: C.termText, whiteSpace: "pre" })}>
          {cmdLines.map((l, i) => <div key={i}>{i === 0 ? <span style={{ color: C.termGreen }}>$ </span> : "  "}{l}{(!done && i === cmdLines.findLastIndex((x) => x.length)) || (done && f < outFrom && i === cmdLines.length - 1) ? <span style={{ opacity: blink ? 1 : 0 }}>{"█"}</span> : null}</div>)}
          {out.map((l, i) => { const t = interpolate(f, [outFrom + i * 5, outFrom + i * 5 + 4], [0, 1], clamp); return <div key={i} style={{ opacity: t, color: "#FDE68A" }}>{l}</div>; })}
        </div>
      </div>
      <Rise delay={outFrom} style={abs(60, 470 + th + 24, 960, 120, { fontFamily: SANS, fontSize: 32, color: C.dim, textAlign: "center" })}>
        Real output of this command, captured in this render.<br />Runs of spaces are collapsed and long lines cut, for display only.
      </Rise>
    </SceneBox>
  );
}

function Pipe({ dur, p }) {
  const f = useCurrentFrame();
  const nodes = [["logs.txt", "file"], ['claude -p "explain"', "print mode"], ["response", "printed"]];
  const xs = [165, 540, 915];
  const dot = interpolate(f, [14, dur - 10], [0, 1], clamp);
  return (
    <SceneBox dur={dur}>
      <Headline size={64} top={250}>PIPE IN. ANSWER OUT.</Headline>
      <div style={abs(0, 560, 1080, 500)}>
        {[0, 1].map((i) => { const t = interpolate(f, [8 + i * 12, 22 + i * 12], [0, 1], clamp); return <div key={i} style={abs(xs[i] + 115, 222, (xs[i + 1] - xs[i] - 230) * t, 8, { background: C.stroke })} />; })}
        <div style={abs(xs[0] + 115 + dot * (xs[2] - xs[0] - 230), 211, 30, 30, { background: C.accent, borderRadius: 15, opacity: dot > 0 && dot < 1 ? 1 : 0 })} />
        {nodes.map(([a, b], i) => (
          <Rise key={a} delay={i * 8} style={abs(xs[i] - 115, 110, 230, 230, { background: i === 1 ? C.bg : C.surface, border: `${i === 1 ? 4 : 2}px solid ${i === 1 ? C.accent : C.stroke}`, borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center" })}>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: i === 1 ? 30 : 36, color: C.ink }}>{a}</div>
            <div style={{ fontFamily: SANS, fontSize: 32, color: C.dim, marginTop: 10 }}>{b}</div>
          </Rise>
        ))}
      </div>
      <Rise delay={26} style={abs(60, 960, 960, 200, { background: C.ink, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center" })}>
        <span style={{ fontFamily: MONO, fontSize: 40, color: "#fff" }}>cat logs.txt | claude -p "explain"</span>
      </Rise>
      <Source text="Example as written in the CLI reference table" y={1190} />    </SceneBox>
  );
}

function Controls({ dur, p }) {
  return (
    <SceneBox dur={dur}>
      <Headline size={56} top={236}>TWO CONTROLS, PRINT MODE</Headline>
      <CaptureWindow cap={p.captures.format} x={80} y={350} w={920} url={p.pageUrl} markDelay={6} callout="--output-format: text, json, stream-json" calloutDelay={20} />
      <CaptureWindow cap={p.captures.turns} x={80} y={900} w={920} url={p.pageUrl} markDelay={dur * 0.45} callout="--max-turns: limits agentic turns" calloutDelay={dur * 0.45 + 14} />
      <Source text={`SOURCE: ${p.pageHost}`} y={1480} />
    </SceneBox>
  );
}

function Close({ dur, p }) {
  return (
    <SceneBox dur={dur}>
      <Headline size={120} top={380}>CHAT IS<br /><span style={{ color: C.accent }}>OPTIONAL.</span></Headline>
      <Rise delay={14} style={abs(60, 900, 960, 150, { background: C.surface, border: `2px solid ${C.stroke}`, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center" })}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 56, color: C.ink }}>claude -p "query"</span>
      </Rise>
      <Source text={`Checked against ${p.pageHost}/docs/en/cli-reference`} y={1090} />
    </SceneBox>
  );
}

const SCENES = { hook: Hook, reference: Reference, terminal: Terminal, pipe: Pipe, controls: Controls, close: Close };

function Caption({ chunks }) {
  const f = useCurrentFrame();
  const c = chunks.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return <div style={abs(60, 1590, 960, 170, { display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 24, padding: "0 28px", fontFamily: SANS, fontWeight: 700, fontSize: 54, lineHeight: 1.1, color: C.ink, textAlign: "center" })}>{c.text}</div>;
}

function AiTestedShort(props) {
  const f = useCurrentFrame();
  const total = props.durationInFrames;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <style>{FONT_FACES}</style>
      <div style={abs(0, 130, 1080, 50, { textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.24em", color: C.accent })}>AI  TESTED</div>
      {props.scenes.map((s) => { const Scene = SCENES[s.kind]; return <Sequence key={s.id} from={s.from} durationInFrames={s.to - s.from}><Scene dur={s.to - s.from} p={props} /></Sequence>; })}
      <Caption chunks={props.captionChunks} />
      <div style={abs(0, 1912, 1080 * (f / total), 8, { background: C.accent })} />
    </AbsoluteFill>
  );
}

const sample = { kind: "hook", id: "s1", from: 0, to: 90 };
export const compositions = [...experimentCompositions, ...honestyCompositions, ...spelloutCompositions, ...randomCompositions, ...pushbackCompositions, ...linksCompositions, ...privacyCompositions, ...unknownCompositions, { id: "AiTestedShort", component: AiTestedShort, durationInFrames: 900, fps: 30, width: 1080, height: 1920, defaultProps: { durationInFrames: 900, scenes: [sample], captionChunks: [], captures: {}, terminal: { display: "", lines: [] }, pageUrl: "", pageHost: "" } }];
