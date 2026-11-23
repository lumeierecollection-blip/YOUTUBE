import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { loadFont as loadSG } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily: sg } = loadSG();
const { fontFamily: inter } = loadInter();

type Scene = { t: number; dur: number; type: string; headline: string[]; sub: string; logos?: string[]; photo?: string; photo_credit?: string };
type Story = { id: string; slug: string; title: string; script: string; sources: string[]; scenes: Scene[]; duration_target_sec: number };
export type AIShortProps = { story: Story; audioSrc: string; audioDurationSec: number };

const C = { bg: "#050510", panel: "#0A0A1A", panel2: "#1A1A3A", accent: "#8B5CF6", white: "#FFFFFF", muted: "#A1A1AA", red: "#EF4444" };

const Bg: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const y = interpolate(frame, [0, durationInFrames], [0, -40]);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", inset: -60, transform: `translateY(${y}px)`, backgroundImage: `linear-gradient(rgba(139,92,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.08) 1px, transparent 1px)`, backgroundSize: "72px 72px" }} />
      <div style={{ position: "absolute", top: -200, right: -120, width: 520, height: 520, borderRadius: 999, background: "rgba(139,92,246,0.10)" }} />
      <div style={{ position: "absolute", bottom: -260, left: -160, width: 620, height: 620, borderRadius: 999, background: "rgba(139,92,246,0.06)" }} />
    </AbsoluteFill>
  );
};

const LogoRow: React.FC<{ logos?: string[] }> = ({ logos = [] }) => {
  if (!logos.length) return null;
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
      {logos.map((l) => (
        <div key={l} style={{ width: 110, height: 110, borderRadius: 24, background: C.panel2, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(139,92,246,0.35)" }}>
          <Img src={staticFile(`logos/${l}-white.svg`)} style={{ width: 64, height: 64, objectFit: "contain" }} />
        </div>
      ))}
    </div>
  );
};

const SceneView: React.FC<{ scene: Scene; index: number; total: number; story: Story }> = ({ scene, index, total }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });
  const y = interpolate(enter, [0, 1], [70, 0]);
  const o = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.03]);
  const accentW = interpolate(frame, [4, Math.min(50, durationInFrames - 5)], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const isStat = scene.type === "stat";
  const big = scene.headline[0] || "";
  const mid = scene.headline[1] || "";
  const photoSrc = scene.photo ? `photos/${scene.photo}` : null;

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Bg />
      <div style={{ position: "absolute", inset: 0, padding: "90px 72px 120px", transform: `scale(${scale})`, opacity: o }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 46 }}>
          <div style={{ fontFamily: sg, fontWeight: 700, fontSize: 30, letterSpacing: "0.18em", color: C.accent }}>AI TESTED</div>
          <div style={{ fontFamily: inter, fontWeight: 600, fontSize: 28, color: C.muted }}>{String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}</div>
        </div>

        <div style={{ transform: `translateY(${y}px)` }}>
          <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 34, letterSpacing: "0.12em", color: C.accent, marginBottom: 22 }}>{scene.sub}</div>
          <div style={{ fontFamily: sg, fontWeight: 700, fontSize: isStat ? 132 : 104, lineHeight: 0.92, color: C.white, textTransform: "uppercase", wordBreak: "break-word" }}>
            {big}
          </div>
          {mid ? <div style={{ marginTop: 18, fontFamily: sg, fontWeight: 700, fontSize: isStat ? 96 : 78, lineHeight: 0.95, color: C.accent, textTransform: "uppercase", wordBreak: "break-word" }}>{mid}</div> : null}
          <div style={{ marginTop: 28, height: 8, width: `${accentW}%`, background: C.accent }} />
        </div>

        <div style={{ position: "absolute", left: 72, right: 72, bottom: 220 }}>
          {scene.photo ? (
            <div style={{ display: "flex", gap: 28, alignItems: "flex-end" }}>
              <div style={{ width: 430, height: 560, borderRadius: 28, overflow: "hidden", background: C.panel, border: "1px solid rgba(139,92,246,0.35)", boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
                <Img src={staticFile(photoSrc!)} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={undefined as any} />
              </div>
              <div style={{ flex: 1, paddingBottom: 20 }}>
                <LogoRow logos={scene.logos} />
                {scene.photo_credit ? <div style={{ marginTop: 20, fontFamily: inter, fontSize: 20, lineHeight: 1.3, color: C.muted }}>{scene.photo_credit}</div> : null}
              </div>
            </div>
          ) : (
            <div>
              <LogoRow logos={scene.logos} />
              <div style={{ marginTop: 34, padding: "30px 32px", background: C.panel, border: "1px solid rgba(139,92,246,0.28)", borderRadius: 24 }}>
                <div style={{ fontFamily: inter, fontWeight: 600, fontSize: 36, lineHeight: 1.35, color: C.white }}>{scene.sub}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "absolute", left: 72, right: 72, bottom: 90, display: "flex", justifyContent: "space-between", fontFamily: inter, fontSize: 22, color: C.muted }}>
          <div>SOURCES VERIFIED</div>
          <div>AI TESTED</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const AIShort: React.FC<AIShortProps> = ({ story, audioSrc, audioDurationSec }) => {
  const { fps } = useVideoConfig();
  const totalDur = audioDurationSec + 0.8;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Audio src={staticFile(audioSrc)} />
      {story.scenes.map((scene, i) => (
        <Sequence key={i} from={Math.round(scene.t * fps)} durationInFrames={Math.round(scene.dur * fps)}>
          <SceneView scene={scene} index={i} total={story.scenes.length} story={story} />
        </Sequence>
      ))}
      <Sequence from={Math.round(totalDur * fps) - 6} durationInFrames={6}><AbsoluteFill style={{ background: C.bg }} /></Sequence>
    </AbsoluteFill>
  );
};
