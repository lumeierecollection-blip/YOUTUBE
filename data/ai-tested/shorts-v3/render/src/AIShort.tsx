import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { loadFont as loadSG } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: sg } = loadSG();
const { fontFamily: inter } = loadInter();

type Scene = {
  t: number; dur: number; type: string; big: string; sub: string;
  logos?: string[]; photo?: string; photo_credit?: string; accent?: string; cta?: string;
};
type Story = { id: string; slug: string; title: string; script: string; sources: string[]; scenes: Scene[]; duration_target_sec: number };
export type AIShortProps = { story: Story; audioSrc: string; audioDurationSec: number };

const C = { bg: "#FAFAF8", paper: "#FFFFFF", ink: "#111111", muted: "#5A5A58", line: "#E2E2DC" };

const Bg: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, -24]);
  const pulse = interpolate(frame, [0, durationInFrames], [0.04, 0.07]);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", inset: -60, transform: `translateY(${drift}px)`, backgroundImage: `linear-gradient(rgba(17,17,17,${pulse}) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,${pulse}) 1px, transparent 1px)`, backgroundSize: "72px 72px" }} />
      <div style={{ position: "absolute", top: -220, right: -140, width: 520, height: 520, borderRadius: 999, background: accent, opacity: 0.07 }} />
      <div style={{ position: "absolute", bottom: 180, left: -180, width: 480, height: 480, borderRadius: 999, background: accent, opacity: 0.05 }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14, background: C.ink }} />
    </AbsoluteFill>
  );
};

const LogoCluster: React.FC<{ logos?: string[]; accent: string; large?: boolean }> = ({ logos = [], accent, large }) => {
  if (!logos.length) return null;
  const size = large ? 170 : 124;
  const icon = large ? 96 : 68;
  return (
    <div style={{ display: "flex", gap: large ? 28 : 20, alignItems: "center", justifyContent: "center", flexWrap: "wrap" }}>
      {logos.map((l) => (
        <div key={l} style={{ width: size, height: size, borderRadius: 34, background: C.paper, border: `2px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 40px rgba(17,17,17,0.08)" }}>
          <Img src={staticFile(`logos/${l}-white.svg`)} style={{ width: icon, height: icon, objectFit: "contain", filter: "brightness(0)" }} />
        </div>
      ))}
    </div>
  );
};

const SceneView: React.FC<{ scene: Scene; index: number; total: number }> = ({ scene, index, total }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 13 });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [54, 0]);
  const o = interpolate(enter, [0, 1], [0, 1]) * exit;
  const scale = interpolate(frame, [0, durationInFrames], [1.01, 1.045]);
  const bar = interpolate(frame, [2, Math.min(22, durationInFrames - 2)], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const accent = scene.accent || "#111111";
  const hasPhoto = !!scene.photo;
  const isStat = scene.type === "stat";
  const bigSize = isStat ? 150 : scene.big.length > 18 ? 96 : scene.big.length > 12 ? 116 : 134;
  const cta = scene.cta || (scene.type === "close" ? "Follow AI Tested for the next AI signal." : "");

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Bg accent={accent} />
      <div style={{ position: "absolute", inset: 0, padding: "72px 62px 88px", transform: `scale(${scale})`, opacity: o }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 30, letterSpacing: "0.16em", color: C.ink }}>AI TESTED</div>
          <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 24, color: C.muted, letterSpacing: "0.04em" }}>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</div>
        </div>

        <div style={{ transform: `translateY(${y}px)` }}>
          <div style={{ display: "inline-flex", alignItems: "center", padding: "10px 18px", background: accent, color: C.paper, fontFamily: inter, fontWeight: 800, fontSize: 24, letterSpacing: "0.10em" }}>
            {scene.type.toUpperCase()}
          </div>
          <div style={{ marginTop: 28, fontFamily: sg, fontWeight: 800, fontSize: bigSize, lineHeight: 0.88, letterSpacing: "-0.035em", color: C.ink, textTransform: "uppercase", maxWidth: 956, textWrap: "balance" as any }}>
            {scene.big}
          </div>
          <div style={{ marginTop: 24, width: `${bar}%`, maxWidth: 920, height: 10, background: accent }} />
          <div style={{ marginTop: 24, fontFamily: inter, fontWeight: 700, fontSize: 40, lineHeight: 1.2, color: C.muted, maxWidth: 940 }}>
            {scene.sub}
          </div>
        </div>

        <div style={{ position: "absolute", left: 62, right: 62, top: 820, bottom: 150, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          {hasPhoto ? (
            <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "absolute", width: 700, height: 700, borderRadius: 999, background: accent, opacity: 0.07 }} />
              <Img
                src={staticFile(`photos/${scene.photo}`)}
                style={{
                  maxWidth: "92%", maxHeight: "88%", objectFit: "contain", objectPosition: "center center",
                  filter: "drop-shadow(0 28px 40px rgba(17,17,17,0.18))"
                }}
              />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                <LogoCluster logos={scene.logos} accent={accent} />
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
              <LogoCluster logos={scene.logos} accent={accent} large={scene.logos && scene.logos.length <= 2} />
              <div style={{ width: "100%", padding: "34px 36px", background: C.paper, border: `2px solid ${C.line}`, borderLeft: `14px solid ${accent}`, boxShadow: "0 16px 44px rgba(17,17,17,0.06)" }}>
                <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 46, lineHeight: 1.22, color: C.ink, textAlign: "center" }}>{scene.sub}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "absolute", left: 62, right: 62, bottom: 58, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
          <div style={{ fontFamily: inter, fontSize: 20, lineHeight: 1.3, color: C.muted, maxWidth: 640 }}>
            {scene.photo_credit ? scene.photo_credit : (cta ? cta : "Sources in description")}
          </div>
          {cta ? <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 22, color: accent, textAlign: "right", maxWidth: 360 }}>{cta}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const AIShort: React.FC<AIShortProps> = ({ story, audioSrc, audioDurationSec }) => {
  const { fps } = useVideoConfig();
  const totalDur = Math.max(audioDurationSec + 0.6, story.duration_target_sec + 0.6);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Audio src={staticFile(audioSrc)} />
      {story.scenes.map((scene, i) => (
        <Sequence key={i} from={Math.round(scene.t * fps)} durationInFrames={Math.round(scene.dur * fps)}>
          <SceneView scene={scene} index={i} total={story.scenes.length} />
        </Sequence>
      ))}
      <Sequence from={Math.round(totalDur * fps) - 5} durationInFrames={5}><AbsoluteFill style={{ background: C.bg }} /></Sequence>
    </AbsoluteFill>
  );
};
