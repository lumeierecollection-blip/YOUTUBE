import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/InterTight";

const { fontFamily } = loadFont("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });

// Design canvas is 608x1080 (the reference's native size); the whole thing is scaled to 1080x1920.
const W = 608, H = 1080;
const INK = "#111111", GREY = "#8d8d8d", BG = "#f2f2f2";
const asset = (p: string) => staticFile(p);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

type Word = { w: string; t: number; sz?: number; wt?: number; pill?: boolean; ink?: string };
type Line = { y: number; words: Word[]; sz?: number; wt?: number; align?: "center" | "left"; x?: number };
export type El =
  | { k: "lines"; lines: Line[] }
  | { k: "card"; img: string; y: number; w: number; h: number; t: number; pos?: string }
  | { k: "bullets"; y: number; gap: number; sz?: number; items: { words: Word[] }[] }
  | { k: "chip"; img: string; label: string; y: number; t: number }
  | { k: "props"; t: number }
  | { k: "mark"; y: number; t: number };
export type Scene = { t0: number; t1: number; grid?: boolean; els: El[] };
export type IFProps = { plan: { scenes: Scene[]; sfx: { t: number; src: string; vol: number; dur: number }[]; watermark: string }; audioSrc: string; audioDurationSec: number };

const shadowText = "0 2px 5px rgba(0,0,0,0.10)";

const WordSpan: React.FC<{ word: Word; time: number; baseSz: number; baseWt: number }> = ({ word, time, baseSz, baseWt }) => {
  const a = time - (word.t - 0.12);
  const op = clamp(a / 0.12);
  const k = clamp(a / 0.42);
  const ty = (1 - easeOut(clamp(a / 0.28))) * 9;
  const g = Math.round(0x8d + (0x11 - 0x8d) * k);
  const color = word.pill ? "#fff" : word.ink ?? `rgb(${g},${g},${g})`;
  return (
    <span style={{ display: "inline-block", opacity: op, transform: `translateY(${ty}px)`, color, fontSize: word.sz ?? baseSz, fontWeight: word.wt ?? baseWt, textShadow: word.pill ? "none" : shadowText, whiteSpace: "pre" }}>{word.w}</span>
  );
};

const LineView: React.FC<{ line: Line; time: number }> = ({ line, time }) => {
  const sz = line.sz ?? 40, wt = line.wt ?? 500;
  const pillWords = line.words.filter((w) => w.pill);
  const hasPill = pillWords.length > 0;
  const wipe = hasPill ? clamp((time - (pillWords[0].t - 0.2)) / 0.32) : 1;
  const row = (
    <div style={{ display: "flex", gap: sz * 0.26, justifyContent: line.align === "left" ? "flex-start" : "center", alignItems: "baseline", whiteSpace: "pre" }}>
      {line.words.map((w, i) => <WordSpan key={i} word={w} time={time} baseSz={sz} baseWt={wt} />)}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: line.align === "left" ? (line.x ?? 40) : 0, width: line.align === "left" ? undefined : W, top: line.y - sz * 0.62, textAlign: "center", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
      {hasPill ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ background: "#292929", padding: `${sz * 0.12}px ${sz * 0.3}px`, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)` }}>{row}</div>
        </div>
      ) : row}
    </div>
  );
};

const Card: React.FC<{ el: Extract<El, { k: "card" }>; time: number }> = ({ el, time }) => {
  const a = clamp((time - el.t) / 0.55);
  const e = easeOut(a);
  return (
    <div style={{ position: "absolute", left: (W - el.w) / 2, top: el.y - el.h / 2 + (1 - e) * 70, width: el.w, height: el.h, opacity: clamp(a / 0.35), borderRadius: 15, background: "#faf8f6", padding: 4, boxSizing: "border-box", boxShadow: "0 26px 34px -6px rgba(0,0,0,0.30), 0 3px 6px rgba(0,0,0,0.16), inset 0 0 0 1px rgba(0,0,0,0.05)" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 11, overflow: "hidden", position: "relative", background: "#fff" }}>
        <Img src={asset(el.img)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: el.pos ?? "50% 0%" }} />
      </div>
    </div>
  );
};

const Star: React.FC<{ x: number; y: number; r: number; rot: number; seed: number; color?: string }> = ({ x, y, r, rot, seed, color = "#1a1a1a" }) => {
  const n = 9, pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 === 0 ? r * (0.82 + 0.18 * Math.abs(Math.sin(seed * 3.1 + i))) : r * 0.34;
    const ang = (i / (n * 2)) * Math.PI * 2;
    pts.push(`${(r + Math.cos(ang) * rr).toFixed(1)},${(r + Math.sin(ang) * rr).toFixed(1)}`);
  }
  return (
    <svg width={r * 2} height={r * 2} style={{ position: "absolute", left: x - r, top: y - r, transform: `rotate(${rot}deg)`, filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.30))" }}>
      <polygon points={pts.join(" ")} fill={color} strokeLinejoin="round" stroke={color} strokeWidth={12} />
    </svg>
  );
};

const Disc: React.FC<{ x: number; y: number; d: number; img: string; wide?: boolean }> = ({ x, y, d, img, wide }) => (
  <div style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: "50%", background: "linear-gradient(160deg,#ffffff,#d9d9d9)", boxShadow: "0 26px 34px -4px rgba(0,0,0,0.28), inset 0 0 0 5px #fff, inset 0 -6px 12px rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Img src={asset(img)} style={{ width: d * (wide ? 0.78 : 0.56), height: d * (wide ? 0.5 : 0.56), borderRadius: 12, objectFit: "contain" }} />
  </div>
);

const Props: React.FC<{ time: number; t: number }> = ({ time, t }) => {
  const a = clamp((time - t) / 0.55), e = easeOut(a), drift = (time - t) * 5;
  const fly = (dx: number, dy: number) => `translate(${(1 - e) * dx}px, ${(1 - e) * dy}px)`;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: fly(120, -120) }}><Star x={540} y={40} r={150} rot={drift} seed={1} /></div>
      <div style={{ position: "absolute", inset: 0, transform: fly(-120, 120) }}><Star x={60} y={1050} r={160} rot={-drift} seed={2} /></div>
      <div style={{ position: "absolute", inset: 0, transform: fly(-140, -60) }}><Disc x={166} y={198} d={190} img="v7/25/google-g-logo-tile.png" /></div>
      <div style={{ position: "absolute", inset: 0, transform: fly(140, 80) }}><Disc x={424} y={872} d={190} img="v7/25/tabletop-logo-endcard-crop.png" wide /></div>
    </>
  );
};

const Grid: React.FC = () => {
  const xs: number[] = [], ys: number[] = [];
  for (let x = 88; x <= 540; x += 72) xs.push(x);
  for (let y = 258; y <= 826; y += 72) ys.push(y);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 48%, #000 55%, transparent 100%)" }}>
      {xs.map((x) => <line key={"v" + x} x1={x} x2={x} y1={248} y2={832} stroke="#cfcfcf" strokeWidth={1.4} strokeDasharray="2 5" />)}
      {ys.map((y) => <line key={"h" + y} x1={22} x2={590} y1={y} y2={y} stroke="#cfcfcf" strokeWidth={1.4} strokeDasharray="2 5" />)}
      {xs.flatMap((x) => ys.map((y) => <circle key={x + "_" + y} cx={x} cy={y} r={3} fill="#c6c6c6" />))}
    </svg>
  );
};

const Sparkle: React.FC<{ s: number }> = ({ s }) => (
  <svg width={s} height={s} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.18))" }}>
    <path d="M50 0 C54 30 70 46 100 50 C70 54 54 70 50 100 C46 70 30 54 0 50 C30 46 46 30 50 0Z" fill="#161616" />
  </svg>
);

const Bullets: React.FC<{ el: Extract<El, { k: "bullets" }>; time: number }> = ({ el, time }) => {
  const sz = el.sz ?? 34;
  return (
    <>
      {el.items.map((it, i) => {
        const t0 = it.words[0].t;
        const a = clamp((time - (t0 - 0.2)) / 0.3);
        return (
          <div key={i} style={{ position: "absolute", left: 92, top: el.y + i * el.gap - sz * 0.7, display: "flex", alignItems: "center", gap: 28, letterSpacing: "-0.025em" }}>
            <div style={{ opacity: a, transform: `scale(${0.3 + 0.7 * easeOut(a)}) rotate(${(1 - a) * -60}deg)` }}><Sparkle s={44} /></div>
            <div style={{ display: "flex", gap: sz * 0.26, alignItems: "baseline", whiteSpace: "pre" }}>
              {it.words.map((w, j) => <WordSpan key={j} word={w} time={time} baseSz={sz} baseWt={500} />)}
            </div>
          </div>
        );
      })}
    </>
  );
};

const Chip: React.FC<{ el: Extract<El, { k: "chip" }>; time: number }> = ({ el, time }) => {
  const a = clamp((time - el.t) / 0.4), e = easeOut(a);
  return (
    <div style={{ position: "absolute", left: 0, width: W, top: el.y - 24 + (1 - e) * 30, display: "flex", justifyContent: "center", opacity: a }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#f7f7f7", borderRadius: 10, padding: "9px 16px 9px 10px", boxShadow: "0 10px 18px rgba(0,0,0,0.20), inset 0 0 0 1.5px #fff" }}>
        <Img src={asset(el.img)} style={{ width: 34, height: 34, borderRadius: 8 }} />
        <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.01em", color: INK }}>{el.label}</span>
      </div>
    </div>
  );
};

const Mark: React.FC<{ el: Extract<El, { k: "mark" }>; time: number }> = ({ el, time }) => {
  const a = clamp((time - el.t) / 0.5), e = easeOut(a);
  return <div style={{ position: "absolute", left: W / 2 - 90, top: el.y - 90, opacity: a, transform: `scale(${0.5 + 0.5 * e})` }}><svg width={180} height={180} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 18px 20px rgba(0,0,0,0.28))" }}><path d="M50 2 C54 32 70 46 98 50 C70 54 54 70 50 98 C46 70 30 54 2 50 C30 46 46 32 50 2Z" fill="#161616" /></svg></div>;
};

const SceneView: React.FC<{ scene: Scene; time: number }> = ({ scene, time }) => (
  <>
    {scene.grid ? <Grid /> : null}
    {scene.els.map((el, i) => {
      if (el.k === "lines") return <React.Fragment key={i}>{el.lines.map((l, j) => <LineView key={j} line={l} time={time} />)}</React.Fragment>;
      if (el.k === "card") return <Card key={i} el={el} time={time} />;
      if (el.k === "bullets") return <Bullets key={i} el={el} time={time} />;
      if (el.k === "chip") return <Chip key={i} el={el} time={time} />;
      if (el.k === "props") return <Props key={i} time={time} t={el.t} />;
      return <Mark key={i} el={el} time={time} />;
    })}
  </>
);

export const IFShort: React.FC<IFProps> = ({ plan, audioSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const scene = plan.scenes.find((s) => time >= s.t0 && time < s.t1) ?? plan.scenes[plan.scenes.length - 1];
  return (
    <AbsoluteFill style={{ background: BG, fontFamily }}>
      <div style={{ width: W, height: H, transform: `scale(${1080 / W})`, transformOrigin: "0 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, width: W, top: 927 - 24, textAlign: "center", fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", color: "#cacaca", textShadow: "0 1px 0 rgba(255,255,255,0.9)" }}>{plan.watermark}</div>
        <SceneView scene={scene} time={time} />
      </div>
      <Audio src={asset(audioSrc)} volume={1} />
      {plan.sfx.map((s, i) => {
        const d = Math.max(3, Math.round(s.dur * fps)), fo = Math.min(6, d);
        return <Sequence key={i} from={Math.max(0, Math.round(s.t * fps))} durationInFrames={d} layout="none"><Audio src={asset(s.src)} volume={(fr) => s.vol * Math.min(1, (d - fr) / fo)} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
