/**
 * DirectedShots — renders a RESOLVED scene direction (schemas/scene-direction.json, materials carrying resolved.file)
 * as shots: each beat's 1-4 shots in sequence inside [t_start, t_end], each shot a virtual camera moving over a
 * world larger than the frame in which the shot's materials sit and physically act (shots/mechanisms.js).
 *
 * Inputs (props, built by scripts/visual-director/render-direction.mjs):
 *   direction   the resolved direction
 *   materials   { [material id]: { src, w, h, alpha, focus, status } }  src is a public/-relative path (staticFile)
 *   words       [{ word, start, end }] voiceover word timings (seconds)
 *   captions    caption pages from compositions/beats.js buildCaptionPages (the production page builder)
 *   audio       public/-relative voiceover path, or null
 *   sfx         [{ file, db, atFrame }] for the existing SfxPalette layer (visual/audio-mix.js)
 *   channel     { font, palette: { ground, ink, paper, accent } }  every colour from config/channels.json
 *   proof       true: an unverified/missing material draws a marked placeholder. false: it is simply not drawn
 *               (the render entry refuses to render such a direction in production, so false never meets one).
 *
 * Not reused on purpose: the 15-type canvas compositions. Reused: fonts (wait-for-fonts.js), the SFX layer,
 * the caption page builder, the credit line rule, and the channel palette roles (clone/clone-palette.js).
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import "../wait-for-fonts.js";
import { SfxPalette } from "../visual/audio-mix.js";
import {
  FW, FH, FPS, clamp01, EASE, scheduleShots, layoutWorld, resolveCamera, cameraAt, coverWidth, framingToCamera,
  subjectOnScreen, textSlotFor, textSlotForAll, TEXT_SLOTS, CAPTION_BAND, syncFrame, finishCamera, AR_VIEW,
} from "./geometry.js";
import { mechanismPieces } from "./mechanisms.js";

const T_WHIP = 7;   // frames each side of the cut
const T_PUSH = 8;

/** Everything about the video that does not depend on the frame. */
export function planShots(props) {
  const { direction, materials = {}, words = [], totalFrames } = props;
  const sched = scheduleShots(direction, FPS, totalFrames);
  let prev = null;
  for (const s of sched) {
    const family = s.beat.mechanism.family;
    const drawable = (m) => m.kind !== "data" && materials[m.id];
    s.family = family;
    s.world = layoutWorld(s.shot, family, materials);
    s.ids = s.shot.materials.filter(drawable).map((m) => m.id);
    s.cam = resolveCamera(s.shot, family, s.world, materials);
    let matched = false;
    if (prev && (prev.shot.transition_out === "match-cut" || s.shot.camera.move === "match-cut") && s.ids.length && prev.ids.length) {
      matched = true;
      // MATCH CUT: the incoming shot opens on its focus at the same relative scale the outgoing one ended on
      const pr = prev.world.rects[prev.ids[0]], r = s.world.rects[s.ids[0]];
      const rel = coverWidth(pr) / prev.cam.b.w;
      s.cam.a = framingToCamera({ zoom: rel, fx: null, fy: null }, r, materials[s.ids[0]].focus || { x: 0.5, y: 0.5 });
    }
    const onRect = (cam, order) => order.find((id) => { const r = s.world.rects[id]; return cam.cx >= r.x && cam.cx <= r.x + r.w && cam.cy >= r.y && cam.cy <= r.y + r.h; }) || order[0];
    const mainIds = s.ids.filter((id) => !s.world.rects[id].inset);
    const idA = mainIds.length ? onRect(s.cam.a, mainIds) : null, idB = mainIds.length ? onRect(s.cam.b, [...mainIds].reverse()) : null;
    if (idA) {
      finishCamera(s.cam, s.shot.camera.move, s.world.rects[idA], materials[idA], matched, s.world.rects[idB], materials[idB]);
      if (matched && s.cam.ratio < 1.2 && /push-in|pull-out/.test(s.shot.camera.move)) {
        // the matched scale left no room for the move (the picture cannot be magnified further without going soft):
        // the MOVE wins over the match — re-resolve without the held start, and say so in proof mode
        s.cam = resolveCamera(s.shot, family, s.world, materials);
        finishCamera(s.cam, s.shot.camera.move, s.world.rects[idA], materials[idA], false, s.world.rects[idB], materials[idB]);
        s.matchDropped = true;
      }
    }
    s.prevTransition = prev ? prev.shot.transition_out || "cut" : null;
    const sync = syncFrame(s, words, FPS);
    s.textFrame = Math.max(s.from, Math.min(s.from + s.dur - 10, sync.frame));
    s.textSynced = sync.matched;
    const pts = [];
    for (const q of [(s.textFrame - s.from) / s.dur, 0.6, 1]) {
      const c = cameraAt(s.cam, q);
      for (const id of mainIds) pts.push(subjectOnScreen(s.world.rects[id], materials[id].focus, c));
    }
    if (!pts.length) pts.push({ x: FW / 2, y: FH / 2 });
    s.textSlot = textSlotForAll(pts);
    s.subjectAtText = pts[0];
    prev = s;
  }
  return sched;
}

const placeholderStyle = (palette) => ({
  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
  background: `repeating-linear-gradient(45deg, ${palette.ink} 0 40px, ${palette.accent} 40px 80px)`,
  color: palette.paper, fontSize: 64, fontWeight: 800, fontFamily: "Inter, sans-serif", padding: 60,
});

function MaterialPiece({ m, rect, pc, palette, proof }) {
  const style = {
    position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h,
    transform: `translate(${pc.dx}px, ${pc.dy}px) rotate(${pc.rot}deg) scale(${pc.scale})`, transformOrigin: "50% 50%",
    zIndex: pc.z,
  };
  if (m.status !== "verified") {
    if (!proof) return null;
    return <div style={{ ...style, clipPath: pc.clip || undefined }}><div style={placeholderStyle(palette)}>PROOF PLACEHOLDER — material “{m.id}” is {m.status}; not drawn in production</div></div>;
  }
  const print = rect.print || rect.cutout || pc.border;
  const cut = rect.cutout && m.alpha;
  const border = print && !cut ? Math.max(10, rect.w * 0.018) : 0;
  const shadow = (pc.shadow || print) && !cut ? `0 ${rect.w * 0.03}px ${rect.w * 0.06}px rgba(0,0,0,0.45)` : "none";
  const img = (
    <Img src={staticFile(m.src)} style={{
      width: "100%", height: "100%", objectFit: "cover", display: "block",
      filter: [pc.filter, cut ? `drop-shadow(0 ${rect.w * 0.025}px ${rect.w * 0.035}px rgba(0,0,0,0.5))` : null].filter(Boolean).join(" ") || undefined,
    }} />
  );
  if (rect.clip) {
    // split treatment: the material covers its half of the frame and is cropped to it
    const c = rect.clip;
    return (
      <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, overflow: "hidden", zIndex: pc.z }}>
        <div style={{ ...style, left: rect.x - c.x, top: rect.y - c.y, clipPath: pc.clip || undefined }}>{img}</div>
      </div>
    );
  }
  return (
    <div style={{ ...style, clipPath: pc.clip || undefined }}>
      <div style={{ position: "absolute", inset: 0, background: border ? palette.paper : "transparent", padding: border, boxShadow: shadow, boxSizing: "border-box" }}>
        {rect.mask ? <div style={{ width: "100%", height: "100%", clipPath: `circle(42% at ${((m.focus?.x ?? 0.5) * 100).toFixed(1)}% ${((m.focus?.y ?? 0.5) * 100).toFixed(1)}%)` }}>{img}</div> : img}
      </div>
      {pc.edge ? <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 0, boxShadow: "0 0 40px 18px rgba(0,0,0,0.55)" }} /> : null}
    </div>
  );
}

/** An inset-detail: the material magnified on its focus point, a framed print laid over the scene (screen space). */
function InsetDetail({ m, palette, p, slot }) {
  const k = EASE.out(clamp01((p - 0.2) / 0.2));
  if (k <= 0 || m.status !== "verified") return null;
  const size = 470, f = m.focus || { x: 0.5, y: 0.5 };
  const pos = slot === "top" ? { left: 520, top: 1020 } : { left: 520, top: 300 };
  return (
    <div style={{ position: "absolute", ...pos, width: size, height: size, background: palette.paper, padding: 12, boxShadow: "0 30px 60px rgba(0,0,0,0.5)", transform: `translateY(${(1 - k) * 260}px) rotate(${(1 - k) * 4 - 1.5}deg)`, zIndex: 20 }}>
      <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
        <Img src={staticFile(m.src)} style={{ position: "absolute", width: "260%", height: "auto", left: `${-(f.x * 260 - 50)}%`, top: `${-(f.y * 260 * (m.h / m.w) - 50)}%` }} />
      </div>
    </div>
  );
}

/** Sourced data values only, set into the scene as type. Values without a source are not drawn. */
function DataValues({ m, palette, font, slot, frame, at }) {
  const d = m.data || {};
  const rows = (Array.isArray(d.values) ? d.values : Object.entries(d).filter(([k]) => k !== "source" && k !== "sources").map(([label, value]) => ({ label, value })))
    .filter((r) => r && r.value != null && (r.source || d.source || (d.sources && d.sources.length)));
  if (!rows.length) return null;
  const s = slot === "top" ? TEXT_SLOTS.low : TEXT_SLOTS.top; // the slot the shot text is NOT using
  return (
    <div style={{ position: "absolute", left: s.x, top: s.y, width: s.w, zIndex: 25 }}>
      {rows.slice(0, 3).map((r, i) => {
        const k = EASE.out(clamp01((frame - at - i * 6) / 10));
        return (
          <div key={i} style={{ overflow: "hidden", marginBottom: 10 }}>
            <div style={{ transform: `translateY(${(1 - k) * 110}%)`, color: palette.paper, fontFamily: font, textShadow: "0 4px 24px rgba(0,0,0,0.7)" }}>
              <span style={{ fontSize: 132, fontWeight: 800, color: palette.accent }}>{String(r.value)}{r.unit ? <span style={{ fontSize: 64 }}> {r.unit}</span> : null}</span>
              <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: 1 }}>{r.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Shot text: word-by-word, each word rising from its own mask, the first word on the sync_word's spoken frame. */
function ShotText({ s, frame, palette, font }) {
  const t = s.shot.text;
  if (!t || !t.words) return null;
  const words = t.words.split(/\s+/);
  const lf = frame - s.textFrame;
  if (lf < 0) return null;
  const size = { figure: 168, date: 150, "key-word": 116, name: 96, quote: 72 }[t.role] || 100;
  const align = s.textSlot === "top" ? "flex-start" : s.textSlot === "mid" ? "center" : "flex-end";
  const big = t.role === "figure" || t.role === "date";
  const slot = TEXT_SLOTS[s.textSlot];
  const color = big ? palette.accent : palette.paper;
  return (
    <div style={{ position: "absolute", left: slot.x, top: slot.y, width: slot.w, height: slot.h, display: "flex", flexWrap: "wrap", alignContent: align, zIndex: 30 }}>
      {words.map((w, i) => {
        const k = EASE.out(clamp01((lf - i * 3) / 9));
        return (
          <div key={i} style={{ overflow: "hidden", marginRight: size * 0.28, padding: "0.06em 0" }}>
            <div style={{
              transform: `translateY(${((1 - k) * 110).toFixed(1)}%)`, fontFamily: font, fontSize: size, lineHeight: 1.02,
              fontWeight: t.role === "quote" ? 500 : 800, fontStyle: t.role === "quote" ? "italic" : "normal", color,
              textShadow: "0 6px 30px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.6)", letterSpacing: big ? -2 : 0,
            }}>{w}</div>
          </div>
        );
      })}
    </div>
  );
}

/** One shot at a frame, with an extra screen transform for transitions. */
function ShotView({ s, frame, props, xform }) {
  const { materials, channel, proof } = props;
  const palette = channel.palette;
  const p = clamp01((frame - s.from) / s.dur);
  const cam = cameraAt(s.cam, p);
  const scale = FW / cam.w;
  const x0 = cam.cx - cam.w / 2, y0 = cam.cy - (cam.w * FH / FW) / 2;
  const mainIds = s.ids.filter((id) => !s.world.rects[id].inset);
  const r0 = mainIds.length ? s.world.rects[mainIds[0]] : null;
  // the opening framing in the first material's own 0..1 units: a reveal opens OUTWARD FROM WHAT THE CAMERA SHOWS FIRST
  const vh = s.cam.a.w * AR_VIEW;
  const view = r0 ? { x: (s.cam.a.cx - s.cam.a.w / 2 - r0.x) / r0.w, y: (s.cam.a.cy - vh / 2 - r0.y) / r0.h, w: s.cam.a.w / r0.w, h: vh / r0.h } : null;
  const { pieces } = mechanismPieces(s.family, p, mainIds, s.world.rects, (id) => materials[id]?.focus || { x: 0.5, y: 0.5 }, view);
  if (s.shot.camera.move === "rack" && mainIds.length >= 2) {
    // RACK: focus is pulled from the first material to the last as the camera reframes (depth of field, not a fade)
    const e = s.cam.ease(p);
    mainIds.forEach((id, j) => {
      const blur = j === 0 ? 16 * e : j === mainIds.length - 1 ? 16 * (1 - e) : 16;
      pieces[id] = (pieces[id] || []).map((pc) => ({ ...pc, filter: [pc.filter, `blur(${blur.toFixed(1)}px)`].filter(Boolean).join(" ") }));
    });
  }
  const insets = s.ids.filter((id) => s.world.rects[id].inset);
  const data = s.shot.materials.filter((m) => m.kind === "data");
  const statement = s.family === "statement";
  return (
    <AbsoluteFill style={{ background: palette.ground, overflow: "hidden", ...xform }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, transformOrigin: "0 0", transform: `scale(${scale}) translate(${-x0}px, ${-y0}px)` }}>
        {mainIds.flatMap((id) => (pieces[id] || []).map((pc, k) => (
          <MaterialPiece key={`${id}-${k}`} m={{ ...materials[id], id }} rect={s.world.rects[id]} pc={pc} palette={palette} proof={proof} />
        )))}
      </div>
      {statement ? <AbsoluteFill style={{ background: "rgba(0,0,0,0.45)" }} /> : null}
      {/* photographic finish: a vignette and the paper grain the references carry; no colour is added */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)", pointerEvents: "none" }} />
      <AbsoluteFill style={{ backgroundImage: `url(${staticFile("fx/grain.png")})`, opacity: 0.12, mixBlendMode: "overlay" }} />
      {insets.map((id) => <InsetDetail key={id} m={{ ...materials[id], id }} palette={palette} p={p} slot={s.textSlot} />)}
      {data.map((m) => <DataValues key={m.id} m={m} palette={palette} font={channel.font} slot={s.textSlot} frame={frame} at={s.textFrame} />)}
      {/* a soft scrim only behind the text slot in use, so type reads without a card */}
      {s.shot.text ? <AbsoluteFill style={{ background: s.textSlot === "top" ? "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 38%)" : s.textSlot === "mid" ? "linear-gradient(180deg, rgba(0,0,0,0) 36%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 64%)" : "linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 45%)", opacity: frame >= s.textFrame ? 1 : 0 }} /> : null}
      <ShotText s={s} frame={frame} palette={palette} font={channel.font} />
      {proof && !s.textSynced && s.shot.text?.sync_word ? <div style={{ position: "absolute", left: 20, bottom: 20, fontSize: 26, color: "#fff", background: "#000", padding: 6, zIndex: 50 }}>sync_word “{s.shot.text.sync_word}” not in timings</div> : null}
    </AbsoluteFill>
  );
}

function Captions({ pages = [], frame, channel }) {
  const ms = (frame / FPS) * 1000;
  const page = pages.find((pg) => ms >= pg.startMs && ms < pg.endMs);
  if (!page) return null;
  return (
    <div style={{ position: "absolute", left: CAPTION_BAND.x, top: CAPTION_BAND.y, width: CAPTION_BAND.w, textAlign: "center", zIndex: 60 }}>
      <span style={{ fontFamily: channel.font, fontSize: 58, fontWeight: 700, lineHeight: 1.2, color: channel.palette.paper, textShadow: "0 3px 12px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)" }}>
        {(page.tokens || []).map((tk, i) => <span key={i} style={{ color: ms >= tk.fromMs ? channel.palette.paper : "rgba(255,255,255,0.55)" }}>{tk.text}{" "}</span>)}
      </span>
    </div>
  );
}

export function DirectedShots(props) {
  const frame = useCurrentFrame();
  const plan = useMemo(() => planShots(props), [props]);
  const i = Math.max(0, plan.findIndex((s) => frame >= s.from && frame < s.from + s.dur));
  const cur = plan[i], next = plan[i + 1], prev = plan[i - 1];
  const layers = [];
  const outT = cur.shot.transition_out || "cut";
  const cutOut = cur.from + cur.dur;
  const inT = cur.prevTransition;
  if (next && outT === "whip" && frame >= cutOut - T_WHIP) {
    const u = EASE.inOut((frame - (cutOut - T_WHIP)) / (2 * T_WHIP)), blur = Math.sin(Math.PI * u) * 48;
    layers.push(<ShotView key="o" s={cur} frame={frame} props={props} xform={{ transform: `translateX(${-u * FW}px)`, filter: `blur(${blur}px)` }} />);
    layers.push(<ShotView key="n" s={next} frame={next.from} props={props} xform={{ transform: `translateX(${(1 - u) * FW}px)`, filter: `blur(${blur}px)` }} />);
  } else if (prev && inT === "whip" && frame < cur.from + T_WHIP) {
    const u = EASE.inOut((frame - (cur.from - T_WHIP)) / (2 * T_WHIP)), blur = Math.sin(Math.PI * u) * 48;
    layers.push(<ShotView key="o" s={prev} frame={cur.from - 1} props={props} xform={{ transform: `translateX(${-u * FW}px)`, filter: `blur(${blur}px)` }} />);
    layers.push(<ShotView key="n" s={cur} frame={frame} props={props} xform={{ transform: `translateX(${(1 - u) * FW}px)`, filter: `blur(${blur}px)` }} />);
  } else if (next && outT === "push-through" && frame >= cutOut - T_PUSH) {
    const k = clamp01((frame - (cutOut - T_PUSH)) / T_PUSH);
    layers.push(<ShotView key="o" s={cur} frame={frame} props={props} xform={{ transform: `scale(${1 + 1.8 * k * k})`, filter: `blur(${k * k * 30}px)` }} />);
  } else if (prev && inT === "push-through" && frame < cur.from + T_PUSH) {
    const k = 1 - EASE.out(clamp01((frame - cur.from) / T_PUSH));
    layers.push(<ShotView key="n" s={cur} frame={frame} props={props} xform={{ transform: `scale(${1 + 0.6 * k})`, filter: `blur(${k * 24}px)` }} />);
  } else {
    layers.push(<ShotView key="c" s={cur} frame={frame} props={props} xform={{}} />);
  }
  return (
    <AbsoluteFill style={{ background: props.channel.palette.ground }}>
      {layers}
      <Captions pages={props.captions} frame={frame} channel={props.channel} />
      {props.audio ? <Audio src={staticFile(props.audio)} /> : null}
      <SfxPalette events={props.sfx || []} />
      {props.proof ? <ProofLabel s={cur} frame={frame} /> : null}
    </AbsoluteFill>
  );
}

/** Proof mode only: the shot id, move, mechanism and transition burned into a corner so a contact sheet is legible. */
function ProofLabel({ s, frame }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, padding: "8px 14px", background: "rgba(0,0,0,0.75)", color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 26, zIndex: 100 }}>
      {s.shot.id} · {s.shot.camera.move} · {s.family} · out:{s.shot.transition_out || "cut"} · f{frame}
    </div>
  );
}

export const compositions = [
  {
    id: "DirectedShots",
    component: DirectedShots,
    width: FW,
    height: FH,
    fps: FPS,
    durationInFrames: 300,
    defaultProps: {
      direction: { schema_version: 1, channel_id: "none", script: "", beats: [] },
      materials: {}, words: [], captions: [], audio: null, sfx: [], proof: true, totalFrames: 300,
      channel: { font: "Inter", palette: { ground: "#111111", ink: "#141414", paper: "#FBF8F1", accent: "#8B1E1E" } },
    },
    calculateMetadata: ({ props }) => ({ durationInFrames: Math.max(1, props.totalFrames || 300) }),
  },
];
