import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { currentAudio } from "../audio.js";
import "../wait-for-fonts.js";
import { resolveColors, resolveFontFamily } from "./visual.js";

/**
 * MotionGraphics — icon/scene-based animated explainer style.
 * Each section renders a purpose-built graphic scene that illustrates the
 * voiceover (flow diagram, data chart, composite hub, hero stat, end screen).
 * Shorts (9:16) and longform (16:9).
 * Props: { sections, ttsAudioPath, thumbnailStyle, tone, font, palette }
 */

const COLORS = {
  bg: "#0F0F1A",
  accent: "#E94560",
  accent2: "#EF4444",
  textPrimary: "#F8FAFC",
  textDim: "#94A3B8",
};

// Motion system (research-backed, see MOTION-GRAPHICS-RULES.md):
// - Pops and entrances use springs with overshoot + settle (squash & stretch).
// - Lines/bars that reveal length use an ease-out draw; nothing animates linear.
// - One primary mover per beat; background stays calm.
const TIMING = {
  entrance: 8, // frames @30fps ≈ 267ms
  stagger: 4, // frames between secondary elements
  barStagger: 5, // frames between chart bars (3-5f is the charting norm)
  draw: 14, // frames for line/bar draw
  zoom: 150, // hero zoom duration (5s)
  pulse: 90, // pulse period frames
};

const EASE = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const WORD_NUM = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function extractFlowLines(voiceover) {
  const re = /Line\s+(one|two|three|four|1|2|3|4)\s*[:.-]?\s*([^.\n]+)/gi;
  const lines = [];
  let m;
  while ((m = re.exec(voiceover || "")) && lines.length < 4) {
    lines.push(m[2].replace(/[\.\s]+$/, "").trim());
  }
  return lines;
}

function extractStats(voiceover) {
  const re = /(\d[\d,.]*)\s*(%|percent|per\s*cent)?(?:\s*(?:of|in|by|at|on|to|for|within|as)\s*([A-Za-z][A-Za-z\- ]{1,24}))?/gi;
  const out = [];
  let m;
  while ((m = re.exec(voiceover || "")) && out.length < 4) {
    const raw = m[1].replace(/,/g, "");
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) continue;
    const label = m[3] ? m[3].replace(/[.,;:]+$/, "").trim() : "";
    const percent = !!m[2];
    if (!percent && !label && value < 2) continue;
    out.push({ value, percent, label });
  }
  return out;
}

function extractHeroNumber(text) {
  const m = (text || "").match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,3}(?:,\d{3})*)\b/i);
  if (!m) return null;
  const w = m[1].toLowerCase();
  if (WORD_NUM[w] !== undefined) return WORD_NUM[w];
  const n = parseInt(w.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function pickScene(section, index) {
  const id = section.id || "";
  const cue = `${section.animationCue?.element || ""} ${section.animationCue?.action || ""} ${section.visualCue || ""}`.toLowerCase();
  if (id === "close" || section.textOverlay?.text) return "end";
  if (id === "hook") return "hero";
  if (/\b(chart|bar|timeline|data|stat|counter|graph|visuali[sz]ation)\b/.test(cue)) return "chart";
  if (/\b(flow diagram|node|connecting line|line draw|sequential)\b/.test(cue)) return "flow";
  if (/\b(composite|illustration|hub|connect|converge|unite|click into place|fly in)\b/.test(cue)) return "composite";
  return "statement";
}

const ICON_PATHS = {
  spark: "M12 2l2.2 5.8L20 10l-5.8 2.2L12 18l-2.2-5.8L4 10l5.8-2.2zM18.5 15.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z",
  shield: "M12 3l7 2.5v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10v-5z",
  check: "M9 12l2 2 4-4",
  scale: "M12 4v14M5 4h14M7 4l-3 7h6zM17 4l-3 7h6zM4 18h16",
  gavel: "M5 20h10M8 20v-3M7 10L4 14l2 2M7 10l2-2M7 14l7-7M12 9l3 3",
  doc: "M6 2h8l4 4v16H6zM14 2v4h4M9 12h6M9 16h6",
  alert: "M12 3l10 17H2zM12 10v5M12 18v.01",
  phone: "M5 4h4l2 5-2.5 1.5a12 12 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  flag: "M5 3v18M5 3h13l-3 4 3 4H5",
};

function iconFor(section) {
  const text = `${section.id || ""} ${section.voiceover || ""}`.toLowerCase();
  if (/\b(lawyer|attorney|court|judge|trial|legal)\b/.test(text)) return "gavel";
  if (/\b(custody|detain|arrest|free to go|handcuff)\b/.test(text)) return "scale";
  if (/\b(evidence|document|record|case file)\b/.test(text)) return "doc";
  if (/\b(lie|warning|risk|wrong|trap)\b/.test(text)) return "alert";
  if (/\b(say|ask|speak|talk|say nothing)\b/.test(text)) return "phone";
  return "spark";
}

const SCENE_LABELS = {
  hook: "The Hook",
  section_1: "The Overview",
  section_2: "The Deep Dive",
  section_3: "The Implication",
  close: "The Close",
};

function headerLabel(section, index) {
  if (SCENE_LABELS[section.id]) return SCENE_LABELS[section.id];
  const el = section.animationCue?.element;
  if (el && typeof el === "string") {
    const short = el.split(/[\(\[\/]/)[0].replace(/\s+/g, " ").trim();
    if (short && short.length <= 30) return short.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return `Section ${index + 1}`;
}

/* Designed scene kicker — "01 · THE OVERVIEW". Real explainer mograph labels
   each beat so viewers always know where in the argument they are. */
function SceneHeader({ section, index, colors = COLORS, fontFamily, u }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 90, stiffness: 80 } });
  const label = headerLabel(section, index);
  return (
    <div style={{ position: "absolute", top: 44 * u, left: 52 * u, display: "flex", alignItems: "center", gap: 14 * u, opacity: p }}>
      <div style={{ width: 40 * u, height: 6 * u, backgroundColor: colors.accent, borderRadius: 3, transform: `scaleX(${p})`, transformOrigin: "left" }} />
      <span style={{ fontFamily, fontWeight: 800, fontSize: 22 * u, letterSpacing: 3, color: colors.accent }}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <span style={{ fontFamily, fontWeight: 700, fontSize: 22 * u, letterSpacing: 3, color: colors.textPrimary, textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function Icon({ name, size, color }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name] || ICON_PATHS.shield} />
    </svg>
  );
}

function GridBackground({ colors = COLORS }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = 1 + 0.012 * Math.sin((frame / fps / 4) * Math.PI * 2);
  const dots = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 5; c++) {
      dots.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: `${6 + c * 22}%`,
            top: `${6 + r * 11}%`,
            width: 3,
            height: 3,
            borderRadius: 999,
            backgroundColor: `${colors.accent}1f`,
          }}
        />
      );
    }
  }
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 18%, ${colors.accent}14 0%, transparent 60%)` }} />
      {dots}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 520,
          height: 520,
          marginLeft: -260,
          marginTop: -260,
          borderRadius: 999,
          border: `2px solid ${colors.accent}22`,
          transform: `scale(${breathe})`,
          opacity: 0.5,
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Full-screen accent sweep at section boundaries.
 * Spec: "Full-screen color wipes between sections" (Half as Interesting).
 */
function ColorWipe({ colors = COLORS, accent2 = false }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, Math.round(fps * 0.7)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const color = accent2 ? colors.accent2 : colors.accent;
  const x = interpolate(p, [0, 1], [-35, 135]);
  const fade = p >= 1 ? 0 : 1;
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: -100,
          bottom: -100,
          left: `${x}%`,
          width: "38%",
          background: `linear-gradient(90deg, transparent 0%, ${color} 30%, ${color} 55%, transparent 100%)`,
          transform: "skewX(-18deg)",
          opacity: fade * 0.65,
        }}
      />
    </AbsoluteFill>
  );
}

function VoiceoverAudio({ src }) {
  if (!src) return null;
  return <Audio src={src} />;
}

/* Hero scene — hook: zoom a hero stat/number from 200% to 100%, then breathe. */
function HeroScene({ section, colors = COLORS, fontFamily, u, channelName = "" }) {
  const frame = useCurrentFrame();
  const num = extractHeroNumber(section.voiceover);
  const p = interpolate(frame, [0, TIMING.zoom], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const scale = interpolate(p, [0, 1], [2.0, 1.0]);
  const breath = 1 + 0.01 * Math.sin((frame / 90) * Math.PI * 2);
  const label = (section.voiceover || "Four lines").match(/\b([A-Za-z]+)\s+([A-Za-z]+)\b/);
  const head = label ? `${label[1]} ${label[2]}`.toUpperCase() : "";
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 * u }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 * u, opacity: Math.min(frame / 12, 1) }}>
        <Icon name="spark" size={56 * u} color={colors.accent} />
        <div style={{ fontFamily, fontWeight: 700, fontSize: 26 * u, letterSpacing: 4, color: colors.textDim, textTransform: "uppercase" }}>
          {channelName ? channelName.toUpperCase() : "Key Facts"}
        </div>
      </div>
      {num !== null ? (
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 320 * u,
            lineHeight: 1,
            color: colors.accent,
            transform: `scale(${scale * breath})`,
            textShadow: `0 0 60px ${colors.accent}55`,
          }}
        >
          {num}
        </div>
      ) : null}
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 64 * u,
          color: colors.textPrimary,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: interpolate(frame - 40, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out }),
        }}
      >
        {head || "Key Facts"}
      </div>
    </AbsoluteFill>
  );
}

/* Flow diagram — nodes appear sequentially with connecting lines that draw. */
function FlowNode({ index, text, delay, colors = COLORS, fontFamily, u }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 120 } });
  const opacity = interpolate(p, [0, 0.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(p, [0, 1], [0.88, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 * u, opacity, transform: `scale(${scale})` }}>
      <div
        style={{
          minWidth: 56 * u,
          height: 56 * u,
          borderRadius: 999,
          backgroundColor: colors.accent,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontWeight: 800,
          fontSize: 24 * u,
        }}
      >
        {index + 1}
      </div>
      <div style={{ fontFamily, fontWeight: 600, fontSize: 28 * u, color: colors.textPrimary, lineHeight: 1.3, maxWidth: "78%" }}>
        {text}
      </div>
    </div>
  );
}

function FlowConnector({ delay, colors = COLORS, u, landscape }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, TIMING.draw], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  return (
    <div
      style={{
        width: landscape ? 44 * u : 3 * u,
        height: landscape ? 3 * u : 44 * u,
        backgroundColor: colors.accent,
        transform: landscape ? `scaleX(${p})` : `scaleY(${p})`,
        transformOrigin: landscape ? "left" : "top",
      }}
    />
  );
}

function FlowDiagramScene({ section, sectionDuration, colors = COLORS, fontFamily, u, landscape }) {
  const lines = extractFlowLines(section.voiceover);
  const nodes = lines.length ? lines : (section.content || []).slice(0, 4);
  const n = Math.min(nodes.length, 4);
  const t = (i) => Math.floor((sectionDuration / n) * i) + 4;
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: landscape ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: landscape ? 28 * u : 18 * u,
        padding: 60 * u,
      }}
    >
      {nodes.slice(0, n).map((text, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <FlowConnector delay={t(i)} colors={colors} u={u} landscape={landscape} /> : null}
          <FlowNode index={i} text={text} delay={t(i)} colors={colors} fontFamily={fontFamily} u={u} />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
}

/* Data chart — real infographic: gridlines + axis labels appear first
   (anticipation), then bars spring in with overshoot + settle (squash &
   stretch), staggered 3-5 frames, values count up, labels land after. */
function ChartBar({ value, percent, label, delay, max, last, colors = COLORS, fontFamily, u, barW }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 90 } });
  const h = Math.max(3 * u, 340 * u * (value / max) * grow);
  const count = Math.round(interpolate(grow, [0, 1], [0, value]));
  const labelP = spring({ frame: frame - (delay + 10), fps, config: { damping: 100, stiffness: 80 } });
  const done = frame - delay > 40;
  const pulse = last && done ? 1 + 0.05 * Math.sin(((frame - delay) / 24) * Math.PI * 2) : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: barW }}>
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 40 * u,
          lineHeight: `${48 * u}px`,
          height: 48 * u,
          color: last ? colors.accent : colors.textPrimary,
          opacity: labelP,
        }}
      >
        {count}
        {percent ? "%" : ""}
      </div>
      <div
        style={{
          width: barW,
          height: Math.max(h, 3 * u),
          background: `linear-gradient(180deg, ${colors.accent} 0%, ${last ? colors.accent2 : colors.accent} 100%)`,
          borderRadius: `${10 * u}px ${10 * u}px ${6 * u}px ${6 * u}px`,
          transform: `scaleY(${pulse})`,
          transformOrigin: "bottom",
          boxShadow: last ? `0 0 28px ${colors.accent}55` : "none",
        }}
      />
      <div
        style={{
          marginTop: 14 * u,
          maxWidth: barW + 44 * u,
          fontFamily,
          fontWeight: 600,
          fontSize: 20 * u,
          lineHeight: 1.2,
          color: colors.textDim,
          textAlign: "center",
          opacity: labelP,
        }}
      >
        {label || "—"}
      </div>
    </div>
  );
}

function DataChartScene({ section, colors = COLORS, fontFamily, u, landscape }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stats = extractStats(section.voiceover);
  const points = stats.length ? stats : [{ value: 100, percent: true, label: "" }];
  const max = Math.max(...points.map((p) => p.value), 1);
  const isPct = points.some((p) => p.percent);
  const chartW = landscape ? 780 * u : 560 * u;
  const chartH = 360 * u;
  const axisW = 96 * u;
  const axisP = spring({ frame, fps, config: { damping: 100, stiffness: 70 } });
  const barW = landscape ? 72 * u : 56 * u;
  const steps = 4;
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: axisW + chartW, height: chartH + 150 * u }}>
        {Array.from({ length: steps + 1 }).map((_, k) => {
          const top = (1 - k / steps) * chartH;
          const val = Math.round((max * k) / steps);
          return (
            <React.Fragment key={k}>
              <div
                style={{
                  position: "absolute",
                  right: axisW + chartW + 12 * u,
                  top: top - 12 * u,
                  width: axisW - 8 * u,
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 16 * u,
                  color: colors.textDim,
                  textAlign: "right",
                  opacity: axisP,
                }}
              >
                {val}
                {isPct ? "%" : ""}
              </div>
              {k > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    left: axisW,
                    top,
                    width: chartW,
                    height: 1,
                    backgroundColor: colors.accent,
                    opacity: axisP * 0.16,
                  }}
                />
              ) : null}
            </React.Fragment>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: axisW,
            top: chartH - 2,
            width: chartW,
            height: 4 * u,
            backgroundColor: colors.accent,
            borderRadius: 2 * u,
            opacity: axisP,
            transform: `scaleX(${axisP})`,
            transformOrigin: "left",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: axisW,
            top: 0,
            width: chartW,
            height: chartH,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-around",
          }}
        >
          {points.map((p, i) => (
            <ChartBar
              key={i}
              value={p.value}
              percent={p.percent}
              label={p.label}
              delay={12 + i * TIMING.barStagger}
              max={max}
              last={i === points.length - 1}
              colors={colors}
              fontFamily={fontFamily}
              u={u}
              barW={barW}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* Composite hub — elements converge into a single illustration around a hub. */
function CompositeHub({ delay, colors = COLORS, u }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
  const breath = 1 + 0.02 * Math.sin((frame / 80) * Math.PI * 2);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 120 * u,
        height: 120 * u,
        marginLeft: -60 * u,
        marginTop: -60 * u,
        borderRadius: 999,
        backgroundColor: colors.bg,
        border: `3px solid ${colors.accent}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(p, [0, 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        transform: `scale(${p * breath})`,
      }}
    >
      <Icon name="spark" size={56 * u} color={colors.accent} />
    </div>
  );
}

function CompositeSpoke({ x, y, cx, cy, delay, index, text, colors = COLORS, fontFamily, u }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dist = Math.hypot(x - cx, y - cy);
  const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  const drawP = interpolate(frame - delay, [0, TIMING.draw], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  const popP = spring({ frame: frame - (delay + TIMING.draw), fps, config: { damping: 12, stiffness: 110 } });
  const short = text.split(" ").slice(0, 2).join(" ");
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: dist,
          height: 3 * u,
          backgroundColor: colors.accent,
          transformOrigin: "left center",
          transform: `rotate(${angle}deg) scaleX(${drawP})`,
          opacity: drawP,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-50%,-50%)",
          opacity: popP,
        }}
      >
        <div
          style={{
            backgroundColor: colors.bg,
            border: `2px solid ${colors.accent}`,
            borderRadius: 12 * u,
            padding: `10px ${14 * u}px`,
            fontFamily,
            fontWeight: 700,
            fontSize: 20 * u,
            color: colors.textPrimary,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: colors.accent, fontWeight: 800, marginRight: 6 * u }}>{index + 1}</span>
          {short}
        </div>
      </div>
    </>
  );
}

function CompositeScene({ section, colors = COLORS, fontFamily, u }) {
  const { width, height } = useVideoConfig();
  const lines = extractFlowLines(section.voiceover);
  const chips = lines.length ? lines : (section.content || []).slice(0, 4);
  const n = Math.min(chips.length, 4);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.3;
  return (
    <AbsoluteFill>
      <CompositeHub delay={4} colors={colors} u={u} />
      {chips.slice(0, n).map((text, i) => {
        const angle = (-90 + (i * 360) / n) * (Math.PI / 180);
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        return (
          <CompositeSpoke
            key={i}
            x={x}
            y={y}
            cx={cx}
            cy={cy}
            delay={8 + i * 8}
            index={i}
            text={text}
            colors={colors}
            fontFamily={fontFamily}
            u={u}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/* End screen — channel branding + subscribe call to action. */
function EndScene({ section, colors = COLORS, fontFamily, u }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const name = section.textOverlay?.text || "SUBSCRIBE";
  const p = spring({ frame, fps, config: { damping: 100, stiffness: 70 } });
  const pulse = 1 + 0.05 * Math.sin((frame / 50) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 30 * u }}>
      <div
        style={{
          width: 96 * u,
          height: 6 * u,
          backgroundColor: colors.accent,
          borderRadius: 3,
          opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          transform: `scaleX(${p})`,
          transformOrigin: "center",
        }}
      />
      <div style={{ fontFamily, fontWeight: 800, fontSize: 88 * u, color: colors.textPrimary, letterSpacing: 6, textAlign: "center", opacity: p }}>
        {name}
      </div>
      <div
        style={{
          padding: "16px 44px",
          border: `3px solid ${colors.accent}`,
          borderRadius: 999,
          fontFamily,
          fontWeight: 700,
          fontSize: 32 * u,
          color: colors.accent,
          opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          transform: `scale(${interpolate(p, [0, 1], [0.9, 1]) * pulse})`,
          letterSpacing: 2,
        }}
      >
        SUBSCRIBE
      </div>
    </AbsoluteFill>
  );
}

/* Statement scene — fallback: icon + headline + support lines, staggered in. */
function StatementScene({ section, colors = COLORS, fontFamily, u }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const icon = iconFor(section);
  const headline = section.content?.[0] || (section.voiceover || "").split(".")[0] || "";
  const rest = (section.content || []).slice(1, 4);
  const hp = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 64 * u, gap: 24 * u }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 * u, opacity: hp, transform: `translateX(${(1 - hp) * 24 * u}px)` }}>
        <Icon name={icon} size={64 * u} color={colors.accent} />
        <div style={{ fontFamily, fontWeight: 800, fontSize: 46 * u, color: colors.textPrimary, lineHeight: 1.15 }}>{headline}</div>
      </div>
      {rest.map((line, i) => {
        const lp = spring({ frame: frame - (12 + i * 6), fps, config: { damping: 16, stiffness: 110 } });
        return (
          <div
            key={i}
            style={{
              fontFamily,
              fontWeight: 500,
              fontSize: 28 * u,
              color: colors.textDim,
              lineHeight: 1.35,
              opacity: lp,
              transform: `translateY(${(1 - lp) * 12 * u}px)`,
            }}
          >
            {line}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function MotionSections({ sections, colors = COLORS, fontFamily, channelName = "" }) {
  const { durationInFrames, width, height } = useVideoConfig();
  const landscape = width > height;
  const u = Math.min(width, height) / 1080;
  const sectionDuration = Math.floor(durationInFrames / Math.max(sections.length, 1));

  return (
    <>
      {sections.map((section, i) => {
        const start = i * sectionDuration;
        const scene = pickScene(section, i);
        const props = { section, sectionDuration, colors, fontFamily, u, landscape, channelName };
        return (
          <Sequence key={i} from={start} durationInFrames={sectionDuration}>
            <GridBackground colors={colors} />
            {i > 0 ? <ColorWipe colors={colors} accent2={i % 2 === 0} /> : null}
            {scene !== "hero" && scene !== "end" ? (
              <SceneHeader section={section} index={i} colors={colors} fontFamily={fontFamily} u={u} />
            ) : null}
            <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              {scene === "hero" ? <HeroScene {...props} /> : null}
              {scene === "flow" ? <FlowDiagramScene {...props} /> : null}
              {scene === "chart" ? <DataChartScene {...props} /> : null}
              {scene === "composite" ? <CompositeScene {...props} /> : null}
              {scene === "end" ? <EndScene {...props} /> : null}
              {scene === "statement" ? <StatementScene {...props} /> : null}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
}

export function MotionGraphicsShorts({ sections = [], ttsAudioPath, font = "DM Sans", palette = null, channelName = "" }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <MotionSections sections={sections} colors={colors} fontFamily={fontFamily} channelName={channelName} />
      <VoiceoverAudio src={ttsAudioPath ? currentAudio : null} />
    </AbsoluteFill>
  );
}

export function MotionGraphicsLongform({ sections = [], ttsAudioPath, font = "DM Sans", palette = null, channelName = "" }) {
  const colors = resolveColors(palette, COLORS);
  const fontFamily = resolveFontFamily(font);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <MotionSections sections={sections} colors={colors} fontFamily={fontFamily} channelName={channelName} />
      <VoiceoverAudio src={ttsAudioPath ? currentAudio : null} />
    </AbsoluteFill>
  );
}

export const compositions = [
  {
    id: "MotionGraphicsShorts",
    component: MotionGraphicsShorts,
    durationInFrames: 30 * 60,
    fps: 30,
    width: 1080,
    height: 1920,
  },
  {
    id: "MotionGraphicsLongform",
    component: MotionGraphicsLongform,
    durationInFrames: 30 * 600,
    fps: 30,
    width: 1920,
    height: 1080,
  },
];
