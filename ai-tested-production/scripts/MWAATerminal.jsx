/**
 * MWAATerminal.jsx — AWS MWAA AI Agent Skills terminal insert.
 * Format: 9:16 (1080×1920, 30fps), 11 seconds (330 frames).
 * Background: clean dark charcoal #15181B.
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
  staticFile,
} from "remotion";

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FPS = 30;
const DURATION_SEC = 11;
const TOTAL_FRAMES = DURATION_SEC * FPS; // 330

const BG_COLOR = "#15181B";
const TERMINAL_BG = "#101214";
const TERMINAL_BORDER = "#3a3a3a";
const TEXT_COLOR = "#e8e8e8";
const MUTED = "#8a8a8a";
const ACCENT = "#8B5CF6"; // flat channel purple, no glow
const SUCCESS = "#4F8F6D"; // subdued terminal green

const ease = Easing.inOut(Easing.cubic);

const COMMAND = "~ $ /plugin install aws-data-analytics@claude-plugins-official";
const TYPING_START = 25; // frame
const TYPING_SPEED = 2; // frames per character

const CLI_ROWS = [
  "◇ skill added: brand-rules ✓",
  "◇ skill added: slide-fit-checker ✓",
  "◇ skill added: remotion-frame-guard ✓",
  "◇ skill added: export-reviewer",
];

const LOADED_START = TYPING_START + COMMAND.length * TYPING_SPEED + 10; // 141
const ROW_START = LOADED_START + 15; // 156
const ROW_SPACING = 12;
const SUCCESS_START = ROW_START + CLI_ROWS.length * ROW_SPACING + 10; // 214

function TerminalScene() {
  const frame = useCurrentFrame();

  // ── Terminal entrance: scale + opacity (frames 0-20) ──
  const terminalScale = interpolate(frame, [0, 10, 20], [0, 0.8, 1], {
    easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const terminalOpacity = interpolate(frame, [0, 10, 20], [0, 0.5, 1], {
    easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Perspective rotation (frames 0-20) ──
  const rotX = interpolate(frame, [0, 10, 20], [30, 20, 18], {
    easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const rotY = interpolate(frame, [0, 10, 20], [-10, -5, -3], {
    easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Command typing (starts frame 25) ──
  const typedChars = Math.floor(Math.max(0, frame - TYPING_START) / TYPING_SPEED);
  const typedText = COMMAND.slice(0, Math.min(typedChars, COMMAND.length));
  const typingComplete = typedChars >= COMMAND.length;

  // ── LOADED word appears after typing (frame 141) ──
  const loadedOpacity = interpolate(frame, [LOADED_START, LOADED_START + 10], [0, 1], {
    easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const loadedScale = interpolate(frame, [LOADED_START, LOADED_START + 10], [0.5, 1], {
    easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ── Success line ──
  const successOpacity = interpolate(frame, [SUCCESS_START, SUCCESS_START + 10], [0, 1], {
    easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: BG_COLOR }}>
      <div
        style={{
          position: "absolute",
          left: 0, top: 0, width: CANVAS_W, height: CANVAS_H,
          transform: `translate(${cx}px, ${cy}px) scale(${terminalScale}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          opacity: terminalOpacity,
        }}
      >
        {/* Terminal window */}
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
          {/* Title bar with traffic lights */}
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
              <div
                key={i}
                style={{
                  width: 12, height: 12, borderRadius: 6, backgroundColor: color,
                }}
              />
            ))}
            <div style={{
              marginLeft: 24,
              color: MUTED,
              fontSize: 13,
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "nowrap",
            }}>
              aws-data-analytics • Agent Toolkit for AWS
            </div>
          </div>

          {/* Terminal content area */}
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
            {/* Prompt + typing command */}
            <div
              style={{
                position: "absolute",
                left: 0, top: 0,
                whiteSpace: "pre",
              }}
            >
              {typedText}
              {!typingComplete && frame % 4 < 2 ? "▊" : ""}
            </div>

            {/* LOADED word */}
            <div
              style={{
                position: "absolute",
                left: 0, top: 44,
                opacity: loadedOpacity,
                transform: `scale(${loadedScale})`,
                transformOrigin: "left center",
                fontSize: 52,
                fontWeight: 700,
                color: ACCENT,
                whiteSpace: "pre",
              }}
            >
              LOADED
            </div>

            {/* CLI rows */}
            {CLI_ROWS.map((row, i) => {
              const rowStartFrame = ROW_START + i * ROW_SPACING;
              const rowOpacity = interpolate(frame, [rowStartFrame, rowStartFrame + 10], [0, 1], {
                easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp",
              });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0, top: 108 + i * 30,
                    opacity: rowOpacity,
                    whiteSpace: "pre",
                  }}
                >
                  {row}
                </div>
              );
            })}

            {/* Success line */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 108 + CLI_ROWS.length * 30 + 24,
                opacity: successOpacity,
                color: SUCCESS,
                whiteSpace: "pre",
              }}
            >
              ✓ carousel QA skill ready
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

TerminalScene.defaultProps = {
  durationInFrames: TOTAL_FRAMES,
};

function Root() {
  return (
    <Composition
      id="MWAATerminal"
      component={TerminalScene}
      durationInFrames={TOTAL_FRAMES}
      width={CANVAS_W}
      height={CANVAS_H}
      fps={FPS}
    />
  );
}

registerRoot(Root);
