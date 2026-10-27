/**
 * EditorTimeline — the composition that draws a persisted editor timeline
 * (schemas/editor-timeline.json). It has no layout opinions of its own: every
 * asset, in/out frame, rect, crop, keyframe, caption and effect it draws comes
 * from the timeline passed as the `timeline` prop. Change the timeline, the
 * frames change; that is the contract the e2e test checks.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { stateAt, imageBox, CANVAS_W, CANVAS_H, FPS } from "./layer-math.js";

function layerFilter(s) {
  const f = [];
  if (s.blur > 0.01) f.push(`blur(${s.blur}px)`);
  if (s.brightness !== 1) f.push(`brightness(${s.brightness})`);
  if (s.saturate !== 1) f.push(`saturate(${s.saturate})`);
  if (s.sepia > 0.001) f.push(`sepia(${s.sepia})`);
  return f.length ? f.join(" ") : undefined;
}

function clipPath(s) {
  if (!(s.clipL || s.clipR || s.clipT || s.clipB)) return undefined;
  return `inset(${s.clipT}% ${s.clipR}% ${s.clipB}% ${s.clipL}%)`;
}

function ImageLayer({ layer, s, asset }) {
  const box = imageBox(layer, s, asset);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: layer.radius || 0 }}>
      <Img
        src={staticFile(asset.path)}
        style={{
          position: "absolute",
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          maxWidth: "none",
          filter: layerFilter(s),
        }}
      />
    </div>
  );
}

function TextLayer({ layer, s, tl }) {
  const st = layer.style || {};
  const reveal = Math.max(0, Math.min(1, s.reveal));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: st.valign === "top" ? "flex-start" : st.valign === "bottom" ? "flex-end" : "center",
        justifyContent: st.align === "left" ? "flex-start" : st.align === "right" ? "flex-end" : "center",
        textAlign: st.align || "center",
        fontFamily: `"${st.font || tl.fonts.primary}", serif`,
        fontWeight: st.weight || 700,
        fontSize: st.size || 64,
        lineHeight: st.lineHeight || 1.12,
        letterSpacing: st.tracking ? `${st.tracking}em` : undefined,
        textTransform: st.upper ? "uppercase" : undefined,
        color: st.color || tl.palette.text,
        textShadow: st.shadow === false ? undefined : "0 2px 14px rgba(0,0,0,0.55)",
        clipPath: reveal < 0.999 ? `inset(0 ${(1 - reveal) * 100}% 0 0)` : undefined,
        padding: st.pad || 0,
        whiteSpace: "pre-wrap",
      }}
    >
      {layer.text}
    </div>
  );
}

function SvgLayer({ layer, s }) {
  const vb = layer.viewBox || [0, 0, layer.rect.w, layer.rect.h];
  return (
    <svg viewBox={vb.join(" ")} width="100%" height="100%" style={{ overflow: "visible" }}>
      {(layer.paths || []).map((p, i) => (
        <path
          key={i}
          d={p.d}
          pathLength={1}
          fill={p.fill || "none"}
          stroke={p.stroke || "none"}
          strokeWidth={p.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={1}
          strokeDashoffset={1 - Math.max(0, Math.min(1, s.draw))}
          fillOpacity={p.fill ? Math.max(0, Math.min(1, s.draw)) : undefined}
        />
      ))}
    </svg>
  );
}

function SolidLayer({ layer }) {
  const st = layer.style || {};
  return <div style={{ position: "absolute", inset: 0, background: st.background || "#000", borderRadius: layer.radius || 0 }} />;
}

function Layer({ layer, frame, tl }) {
  const local = frame - layer.in;
  const s = stateAt(layer, local);
  if (s.opacity <= 0.001) return null;
  const asset = layer.asset_id ? tl.assets[layer.asset_id] : null;
  const rect = layer.rect;
  const tf = [`translate(${s.tx}px, ${s.ty}px)`];
  if (s.rotate) tf.push(`rotate(${s.rotate}deg)`);
  return (
    <div
      data-layer={layer.id}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        opacity: s.opacity,
        transform: tf.join(" "),
        clipPath: clipPath(s),
        mixBlendMode: layer.blend || undefined,
        zIndex: layer.z,
      }}
    >
      {layer.type === "image" && asset ? <ImageLayer layer={layer} s={s} asset={asset} /> : null}
      {layer.type === "text" ? <TextLayer layer={layer} s={s} tl={tl} /> : null}
      {layer.type === "svg" ? <SvgLayer layer={layer} s={s} /> : null}
      {layer.type === "solid" ? <SolidLayer layer={layer} /> : null}
    </div>
  );
}

function Captions({ tl, frame }) {
  const c = (tl.captions || []).find((x) => frame >= x.start_f && frame < x.end_f);
  if (!c) return null;
  const st = tl.caption_style || {};
  return (
    <div
      data-captions
      style={{
        position: "absolute",
        left: st.x ?? 90,
        width: st.w ?? CANVAS_W - 180,
        top: st.y ?? 1500,
        height: st.h ?? 190,
        display: "flex",
        flexWrap: "wrap",
        alignContent: "center",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
        fontFamily: `"${tl.fonts.primary}", serif`,
        fontWeight: 700,
        fontSize: st.size ?? 52,
        lineHeight: 1.15,
        color: tl.palette.text,
        textShadow: "0 2px 12px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)",
        zIndex: 9000,
      }}
    >
      {c.words.map((w, i) => (
        <span key={i} style={{ color: frame >= w.start_f ? tl.palette.accent : tl.palette.text, marginRight: "0.28em" }}>
          {w.text}
        </span>
      ))}
    </div>
  );
}

export function EditorTimeline({ timeline: tl, ttsAudioPath }) {
  const frame = useCurrentFrame();
  const layers = (tl.layers || []).filter((l) => frame >= l.in && frame < l.out);
  layers.sort((a, b) => a.z - b.z);
  return (
    <AbsoluteFill style={{ backgroundColor: tl.palette.bg }}>
      {ttsAudioPath ? <Audio src={currentAudio} /> : null}
      {layers.map((l) => (
        <Layer key={l.id} layer={l} frame={frame} tl={tl} />
      ))}
      <Captions tl={tl} frame={frame} />
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "EditorTimeline",
    component: EditorTimeline,
    durationInFrames: 30,
    fps: FPS,
    width: CANVAS_W,
    height: CANVAS_H,
    defaultProps: {
      timeline: {
        palette: { bg: "#000000", accent: "#D4A574", text: "#F5EFE6" },
        fonts: { primary: "Cormorant Garamond" },
        assets: {},
        layers: [],
        captions: [],
      },
    },
  },
];
