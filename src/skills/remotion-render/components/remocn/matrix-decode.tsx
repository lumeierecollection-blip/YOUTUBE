"use client";

// LOCAL DEVIATION from the component as published by remocn: the original
// root element carried `background: "white"`, painting an opaque white card
// behind the digits. Standalone that is the component's own look; embedded
// as a number treatment it is exactly the "card furniture" this renderer's
// rebuild exists to remove — on a black channel a real rendered frame showed
// a white block around a green "7" with the "%" beside it, which reads as a
// UI chip, not as a figure in the scene. The fill is now transparent so the
// digits sit on whatever the scene already drew; nothing else is changed.
//
// Lifeprompt's TextScramble (lifeprompt-team/remotion-scenes,
// src/scenes/TextAnimations/TextScramble.tsx) was read as the alternative
// before choosing this, and rejected on its real source: it has the SAME
// defect inverted (`<AbsoluteFill style={{ background: C.black }}>`, line
// 31), hardcodes its palette instead of taking the channel's, is a
// full-screen scene rather than an embeddable treatment, and prints a
// literal "DECODING COMPLETE" sub-caption — invented on-screen words from
// no source, which CLAUDE.md's grounding rule forbids outright.
import { random, useCurrentFrame, useVideoConfig } from "remotion";

export interface MatrixDecodeProps {
  text: string;
  charset?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  revealDuration?: number;
  speed?: number;
  className?: string;
}

export function MatrixDecode({
  text,
  charset = "!@#$%^&*()_+-=<>?/\\|",
  fontSize = 72,
  color = "#22c55e",
  fontWeight = 600,
  revealDuration = 60,
  speed = 1,
  className,
}: MatrixDecodeProps) {
  const frame = useCurrentFrame() * speed;
  // useVideoConfig kept for consistency with sibling primitives
  useVideoConfig();

  let output = "";
  for (let i = 0; i < text.length; i++) {
    const revealFrame = (i / Math.max(text.length, 1)) * revealDuration;
    if (text[i] === " ") {
      output += " ";
    } else if (frame >= revealFrame) {
      output += text[i];
    } else {
      const r = random(`${i}-${Math.floor(frame / 2)}`);
      const ch = charset[Math.floor(r * charset.length)];
      output += ch;
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        className={className}
        style={{
          fontSize,
          fontWeight,
          color,
          letterSpacing: "0.05em",
          whiteSpace: "pre",
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {output}
      </span>
    </div>
  );
}
