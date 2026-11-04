/**
 * MWAFullScene.jsx — Complete AI Tested Short: Amazon MWAA AI Agent Skills.
 * Format: 9:16 (1080×1920, 30fps), ~35 seconds.
 * All 5 narration beats sequenced with cinematic camera movement.
 * Motion driven by useCurrentFrame(), interpolate(), spring() — no CSS animation.
 * Zero neon, glow, bloom, or cyberpunk styling.
 */
import React from "react";
import {
  registerRoot,
  Composition,
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FPS = 30;

// Beat timing (frames): hook 0-120, setup 120-450, rehook 450-600, payoff 600-930, close 930-1050
const BEATS = [
  { id: "hook", start: 0, end: 120, narration: "Amazon Managed Workflows for Apache Airflow now includes four specific AI skills for AWS." },
  { id: "setup", start: 120, end: 450, narration: "Amazon Managed Workflows for Apache Airflow integrates with the Agent Toolkit for AWS. Which exact skill executes the upgrade process?" },
  { id: "rehook", start: 450, end: 600, narration: "Amazon MWAA enables upgrading environments using any AI coding assistant, but the toolkit also includes authoring-mwaa-workflow and debugging-mwaa-workflow." },
  { id: "payoff", start: 600, end: 930, narration: "Amazon Managed Workflows for Apache Airflow includes authoring-mwaa-workflow and debugging-mwaa-workflow skills." },
  { id: "close", start: 930, end: 1050, narration: "Use upgrading-mwaa-environments in Amazon Managed Workflows for Apache Airflow." },
];

const TOTAL_FRAMES = 1050; // 35 seconds

const BG_COLOR = "#15181B";
const TERMINAL_BG = "#101214";
const TERMINAL_BORDER = "#3a3a3a";
const TEXT_COLOR = "#e8e8e8";
const MUTED = "#8a8a8a";
const ACCENT = "#8B5CF6";
const SUCCESS = "#4F8F6D";

const ease = Easing.inOut(Easing.cubic);

function beatAt(frame) {
  for (let i = BEATS.length - 1; i >= 0; i--) {
    if (frame >= BEATS[i].start) return { ...BEATS[i], index: i };
  }
  return BEATS[0];
}

function beatProgress(frame, beat) {
  const span = beat.end - beat.start;
  return Math.max(0, Math.min(1, (frame - beat.start) / span));
}

function TerminalScene({ beat, p }) {
  // Terminal entrance perspective
  const rotX = interpolate(p, [0, 0.3, 0.6], [30, 20, 18], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rotY = interpolate(p, [0, 0.3, 0.6], [-10, -5, -3], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(p, [0, 0.2, 0.5], [0, 0.8, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(p, [0, 0.2, 0.5], [0, 0.5, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Command typing based on beat
  let command = "";
  let typingStart = 0;
  let typingSpeed = 2;
  let loadedStart = 0;
  let rowStart = 0;
  let successStart = 0;

  if (beat.id === "setup") {
    command = "~ $ /plugin install aws-data-analytics@claude-plugins-official";
    typingStart = 0.15;
    typingSpeed = 0.02;
    loadedStart = typingStart + command.length * typingSpeed + 0.1;
    rowStart = loadedStart + 0.15;
    successStart = rowStart + 4 * 0.12 + 0.1;
  } else if (beat.id === "close") {
    command = "~ $ upgrading-mwaa-environments";
    typingStart = 0.1;
    typingSpeed = 0.03;
    loadedStart = typingStart + command.length * typingSpeed + 0.08;
    rowStart = loadedStart + 0.12;
    successStart = rowStart + 3 * 0.1 + 0.08;
  }

  const typedChars = Math.floor(Math.max(0, p - typingStart) / typingSpeed);
  const typedText = command.slice(0, Math.min(typedChars, command.length));
  const typingComplete = typedChars >= command.length;

  const loadedOpacity = interpolate(p, [loadedStart, loadedStart + 0.1], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const loadedScale = interpolate(p, [loadedStart, loadedStart + 0.1], [0.5, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cliRows = beat.id === "setup"
    ? ["◇ skill added: brand-rules ✓", "◇ skill added: slide-fit-checker ✓", "◇ skill added: remotion-frame-guard ✓", "◇ skill added: export-reviewer"]
    : ["◇ planning blue-green upgrade...", "◇ preserving run history ✓", "◇ environment ready ✓"];

  const successText = beat.id === "setup" ? "✓ carousel QA skill ready" : "✓ environment ready";

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      <div
        style={{
          position: "absolute",
          left: 0, top: 0, width: CANVAS_W, height: CANVAS_H,
          transform: `translate(${cx}px, ${cy}px) scale(${scale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          opacity,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 60, top: 100, width: 960, height: 1250,
            backgroundColor: TERMINAL_BG,
            border: `1px solid ${TERMINAL_BORDER}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0, top: 0, width: "100%", height: 40,
              backgroundColor: "#1a1d20",
              borderBottom: `1px solid ${TERMINAL_BORDER}`,
              display: "flex",
              alignItems: "center",
              paddingLeft: 16,
              gap: 8,
            }}
          >
            {["#ff5f56", "#ffbd2e", "#27c93f"].map((color, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
            ))}
            <div style={{ marginLeft: 24, color: MUTED, fontSize: 13, fontFamily: "system-ui, -apple-system, sans-serif", whiteSpace: "nowrap" }}>
              aws-data-analytics • Agent Toolkit for AWS
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 24, top: 56, width: 912, height: 1170,
              color: TEXT_COLOR,
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              fontSize: 20,
              lineHeight: "1.5",
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, whiteSpace: "pre" }}>
              {typedText}
              {!typingComplete && p % 0.13 < 0.065 ? "▊" : ""}
            </div>
            <div
              style={{
                position: "absolute",
                left: 0, top: 44,
                opacity: loadedOpacity,
                transform: `scale(${loadedScale})`,
                transformOrigin: "left center",
                fontSize: 52, fontWeight: 700, color: ACCENT, whiteSpace: "pre",
              }}
            >
              LOADED
            </div>
            {cliRows.map((row, i) => {
              const rStart = rowStart + i * 0.12;
              const rOpacity = interpolate(p, [rStart, rStart + 0.1], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={i} style={{ position: "absolute", left: 0, top: 108 + i * 30, opacity: rOpacity, whiteSpace: "pre" }}>
                  {row}
                </div>
              );
            })}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 108 + cliRows.length * 30 + 24,
                opacity: interpolate(p, [successStart, successStart + 0.1], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                color: SUCCESS, whiteSpace: "pre",
              }}
            >
              {successText}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ArticleScene({ beat, p }) {
  // Article highlight: paper card with marker reveal
  const paperOpacity = interpolate(p, [0, 0.1, 0.3], [0, 0.8, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const paperScale = interpolate(p, [0, 0.1, 0.3], [0.8, 1, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const markerProgress = interpolate(p, [0.3, 0.7], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      <div
        style={{
          position: "absolute",
          left: cx, top: cy,
          transform: `translate(-50%, -50%) scale(${paperScale})`,
          transformOrigin: "center center",
          opacity: paperOpacity,
        }}
      >
        {/* Paper card */}
        <div
          style={{
            position: "absolute",
            left: -400, top: -500, width: 800, height: 1000,
            backgroundColor: "#fafaf0",
            border: `1px solid #d4d4d4`,
            borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          {/* Section label */}
          <div
            style={{
              position: "absolute",
              left: 60, top: 140,
              fontSize: 16, fontWeight: 700, color: ACCENT,
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "2px", textTransform: "uppercase",
              whiteSpace: "pre",
            }}
          >
            AWS WHAT'S NEW • OCT 15, 2026
          </div>
          {/* Headline */}
          <div
            style={{
              position: "absolute",
              left: 60, top: 190, width: 680,
              fontSize: 44, fontWeight: 700, color: "#1a1a1a",
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: "1.15",
              whiteSpace: "pre-wrap",
            }}
          >
            Amazon MWAA now offers AI agent skills
          </div>
          {/* Marker highlight */}
          <div
            style={{
              position: "absolute",
              left: 60, top: 300, width: 400 * markerProgress, height: 24,
              backgroundColor: "rgba(240, 220, 120, 0.5)",
              borderRadius: 4,
            }}
          />
          {/* Highlighted text */}
          <div
            style={{
              position: "absolute",
              left: 60, top: 295, width: 680,
              fontSize: 20, color: "#333333",
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: "1.4",
              whiteSpace: "pre-wrap",
            }}
          >
            "Amazon Managed Workflows for Apache Airflow now integrates with the Agent Toolkit for AWS to provide built-in AI agent skills that let you author, debug, and test MWAA workflows."
          </div>
          {/* Byline */}
          <div
            style={{
              position: "absolute",
              left: 60, bottom: 60,
              fontSize: 14, color: MUTED,
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "pre",
            }}
          >
            Source: AWS What's New • Agent Toolkit for AWS integration
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SkillTilesScene({ beat, p }) {
  const skills = [
    { id: "authoring-mwaa-workflow", desc: "authors & deploys DAGs / YAML workflows" },
    { id: "debugging-mwaa-workflow", desc: "finds root cause: failed runs, OOM, IAM errors" },
    { id: "testing-mwaa-workflow", desc: "triggers DAG, monitors completion, retests" },
    { id: "upgrading-mwaa-environments", desc: "blue-green or in-place upgrade, provisioned only" },
  ];

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      {skills.map((skill, i) => {
        const tileStart = 0.15 + i * 0.18;
        const tileOpacity = interpolate(p, [tileStart, tileStart + 0.15], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const tileScale = interpolate(p, [tileStart, tileStart + 0.15], [0.8, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const x = i % 2 === 0 ? -240 : 240;
        const y = i < 2 ? -180 : 180;

        return (
          <div
            key={skill.id}
            style={{
              position: "absolute",
              left: cx + x, top: cy + y,
              transform: `translate(-50%, -50%) scale(${tileScale})`,
              transformOrigin: "center center",
              opacity: tileOpacity,
              width: 400, height: 200,
            }}
          >
            {/* Tile card */}
            <div
              style={{
                position: "absolute",
                left: 0, top: 0, width: 400, height: 200,
                backgroundColor: "#1a1d20",
                border: `1px solid ${TERMINAL_BORDER}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {/* Accent bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0, top: 0, width: 4, height: 200,
                  backgroundColor: ACCENT,
                }}
              />
              {/* Skill name */}
              <div
                style={{
                  position: "absolute",
                  left: 24, top: 30,
                  fontSize: 22, fontWeight: 700, color: TEXT_COLOR,
                  fontFamily: "'JetBrains Mono', monospace",
                  whiteSpace: "pre-wrap",
                }}
              >
                {skill.id}
              </div>
              {/* Description */}
              <div
                style={{
                  position: "absolute",
                  left: 24, top: 70, width: 352,
                  fontSize: 16, color: MUTED,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  lineHeight: "1.4",
                  whiteSpace: "pre-wrap",
                }}
              >
                {skill.desc}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

export function MWAFullScene() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const beat = beatAt(frame);
  const p = beatProgress(frame, beat);

  // Crossfade between beats
  const prevBeat = beat.index > 0 ? BEATS[beat.index - 1] : null;
  const prevP = prevBeat ? beatProgress(frame, prevBeat) : 0;
  const prevOpacity = prevBeat ? interpolate(frame, [beat.start - 10, beat.start], [1, 0], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      {prevBeat && prevOpacity > 0 && (
        <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, opacity: prevOpacity }}>
          {prevBeat.id === "setup" || prevBeat.id === "close" ? <TerminalScene beat={prevBeat} p={prevP} /> : prevBeat.id === "hook" ? <ArticleScene beat={prevBeat} p={prevP} /> : <SkillTilesScene beat={prevBeat} p={prevP} />}
        </div>
      )}
      <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS_W, height: CANVAS_H, opacity: interpolate(frame, [beat.start, beat.start + 10], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        {beat.id === "hook" ? <ArticleScene beat={beat} p={p} /> : beat.id === "setup" || beat.id === "close" ? <TerminalScene beat={beat} p={p} /> : <SkillTilesScene beat={beat} p={p} />}
      </div>
    </AbsoluteFill>
  );
}

MWAFullScene.defaultProps = {
  durationInFrames: TOTAL_FRAMES,
};

function Root() {
  return (
    <Composition
      id="MWAFull"
      component={MWAFullScene}
      durationInFrames={TOTAL_FRAMES}
      width={CANVAS_W}
      height={CANVAS_H}
      fps={FPS}
    />
  );
}

registerRoot(Root);
