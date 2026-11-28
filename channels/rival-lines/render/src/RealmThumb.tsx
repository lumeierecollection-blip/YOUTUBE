import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont as loadCond } from "@remotion/google-fonts/Anton";
import { loadFont as loadSerif } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";

// Two thumbnail formulas read off The Football Realm's own recent thumbnails (frame-by-frame in the reference sheet of 30):
//   faces   two head-and-shoulders crops filling the frame on a red vignette, one short bold italic word either side ("HE / KNEW", "WATCH / HIM"). No outline, no credit line on the image.
//   serif   a pale ground, a centred serif headline with one bold word, a waist-up cut-out, a red hand-drawn arrow and a small italic note.
// Every colour is a token from channels.json realm_colors. Photo credits go in the video description (publish.md), not on the thumbnail.
const cond = loadCond("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const serif = loadSerif("italic", { weights: ["400", "700", "900"], subsets: ["latin"] }).fontFamily;
const serifUp = loadSerif("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;
const sans = loadSans("normal", { weights: ["700", "900"], subsets: ["latin"] }).fontFamily;

const shade = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;

const Face: React.FC<{ img: string; h: number; side: "left" | "right"; x?: number; ink: string }> = ({ img, h, side, x = -120, ink }) => (
  <Img
    src={staticFile(`ep/images/face-${img}.png`)}
    style={{ position: "absolute", height: h, width: "auto", bottom: 0, [side]: x, filter: `drop-shadow(0 0 28px ${shade(ink, 55)})` }}
  />
);

const Word: React.FC<{ children: React.ReactNode; color: string; ink: string; style: React.CSSProperties; size?: number }> = ({ children, color, ink, style, size = 150 }) => (
  <div style={{ position: "absolute", fontFamily: cond, fontSize: size, lineHeight: 1, color, letterSpacing: 2, transform: "skewX(-9deg)", textShadow: `0 7px 0 ${shade(ink, 75)}, 0 0 30px ${shade(ink, 50)}`, whiteSpace: "nowrap", ...style }}>{children}</div>
);

export const RealmThumb: React.FC<any> = ({ theme, thumb }) => {
  const t = thumb;
  if (t.kind === "faces") {
    return (
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, ${theme.red} 0%, ${theme.red} 35%, ${shade(theme.black, 100)} 125%)` }}>
        <Face ink={theme.black} img={t.left.img} h={t.left.h || 720} side="left" x={t.left.x} />
        <Face ink={theme.black} img={t.right.img} h={t.right.h || 720} side="right" x={t.right.x} />
        <Word ink={theme.black} color={theme.white} style={{ left: 36, top: t.left.y ?? 270 }} size={t.size}>{t.left.word}</Word>
        <Word ink={theme.black} color={theme.white} style={{ right: 36, top: t.right.y ?? 270 }} size={t.size}>{t.right.word}</Word>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${theme.white} 0%, color-mix(in srgb, ${theme.white} 90%, ${theme.black}) 100%)` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 26, textAlign: "center", fontFamily: serifUp, fontWeight: 400, fontSize: t.size || 108, lineHeight: 1.04, color: theme.black }}>
        {t.lines.map((l: string, i: number) => <div key={i} style={i === t.hot ? { fontWeight: 700, color: theme.red } : undefined}>{l}</div>)}
      </div>
      <Img src={staticFile(`ep/images/cutout-${t.img}.png`)} style={{ position: "absolute", height: t.h || 1020, width: "auto", right: t.x ?? 300, bottom: -(t.drop ?? 330), filter: `drop-shadow(0 12px 24px ${shade(theme.black, 35)})` }} />
      <svg width={300} height={180} viewBox="0 0 300 180" style={{ position: "absolute", left: t.arrowX ?? 250, top: t.arrowY ?? 330 }}>
        <path d="M 10 20 C 110 0 200 50 250 130" fill="none" stroke={theme.red} strokeWidth={9} strokeLinecap="round" />
        <path d="M 250 130 L 214 92 M 250 130 L 290 100" fill="none" stroke={theme.red} strokeWidth={9} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", left: t.noteX ?? 70, top: t.noteY ?? 400, width: 340, fontFamily: serif, fontWeight: 400, fontSize: 40, lineHeight: 1.1, color: theme.black }}>{t.note}</div>
    </AbsoluteFill>
  );
};
