import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont as loadCond } from "@remotion/google-fonts/Anton";
import { loadFont as loadSerif } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";

// Three thumbnail formulas read off The Football Realm's own thumbnails (see data/rival-lines/paperpitch-footballrealm-reference-study.md):
//   dual    two faces cut out on a red vignette, a short italic word either side ("HE / KNEW")
//   bigword a near-black ground and one huge red condensed word, a cut-out person in front of it ("BETRAYED.")
//   serif   a white ground, a serif headline and a red arrow pointing at the person
// Every colour is a token from channels.json realm_colors. Photos are the same licensed Commons files as the video, with the credit printed small.
const cond = loadCond("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const serif = loadSerif("italic", { weights: ["700", "900"], subsets: ["latin"] }).fontFamily;
const sans = loadSans("normal", { weights: ["700", "900"], subsets: ["latin"] }).fontFamily;

const outline = (c: string, k: number) => `drop-shadow(${k}px 0 0 ${c}) drop-shadow(-${k}px 0 0 ${c}) drop-shadow(0 ${k}px 0 ${c}) drop-shadow(0 -${k}px 0 ${c})`;
const shade = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;

const Cut: React.FC<{ img: string; h: number; style: React.CSSProperties; ring: string; k?: number }> = ({ img, h, style, ring, k = 5 }) => (
  <Img src={staticFile(`ep/images/cutout-${img}.png`)} style={{ position: "absolute", height: h, width: "auto", filter: `${outline(ring, k)} drop-shadow(0 14px 22px ${"black"})`, ...style }} />
);

const Credit: React.FC<{ images: any; ids: string[]; color: string }> = ({ images, ids, color }) => (
  <div style={{ position: "absolute", right: 14, bottom: 8, fontFamily: sans, fontWeight: 700, fontSize: 13, color, opacity: 0.7, maxWidth: 700, textAlign: "right" }}>
    Photo: {[...new Set(ids.map((i) => images[i]?.credit).filter(Boolean))].join(" · ")}
  </div>
);

export const RealmThumb: React.FC<any> = ({ theme, thumb, images }) => {
  const t = thumb;
  if (t.kind === "dual") {
    return (
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 55%, ${theme.red} 0%, ${theme.red} 28%, ${theme.black} 100%)` }}>
        <Cut img={t.left.img} h={t.left.h || 690} ring={theme.white} style={{ left: t.left.x ?? -30, bottom: 0 }} />
        <Cut img={t.right.img} h={t.right.h || 690} ring={theme.white} style={{ right: t.right.x ?? -30, bottom: 0 }} />
        <div style={{ position: "absolute", left: 34, top: 60, fontFamily: serif, fontWeight: 900, fontSize: 150, lineHeight: 0.95, color: theme.white, textShadow: `0 8px 0 ${shade(theme.black, 60)}` }}>
          {t.left.words.map((w: string, i: number) => <div key={i}>{w}</div>)}
        </div>
        <div style={{ position: "absolute", right: 34, top: 60, textAlign: "right", fontFamily: serif, fontWeight: 900, fontSize: 150, lineHeight: 0.95, color: theme.white, textShadow: `0 8px 0 ${shade(theme.black, 60)}` }}>
          {t.right.words.map((w: string, i: number) => <div key={i}>{w}</div>)}
        </div>
        {t.centre ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, textAlign: "center", fontFamily: cond, fontSize: 168, lineHeight: 1, color: theme.white, textShadow: `0 8px 0 ${shade(theme.black, 70)}` }}>{t.centre}</div> : null}
        <Credit images={images} ids={[t.left.img, t.right.img]} color={theme.white} />
      </AbsoluteFill>
    );
  }
  if (t.kind === "bigword") {
    return (
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 60% 50%, ${theme.card_ink} 0%, ${theme.black} 75%)` }}>
        <div style={{ position: "absolute", left: 28, top: 60, fontFamily: cond, fontSize: t.size || 330, lineHeight: 1, color: theme.red, whiteSpace: "nowrap", letterSpacing: 2 }}>{t.word}</div>
        <Cut img={t.img} h={t.h || 640} ring={theme.white} style={{ right: t.x ?? 40, bottom: 0 }} />
        {t.card ? (
          <div style={{ position: "absolute", left: 40, bottom: 56, width: 640, background: theme.card, border: `4px solid ${theme.card_ink}`, boxShadow: `10px 12px 0 ${shade(theme.black, 60)}`, padding: "20px 26px", transform: "rotate(-2deg)" }}>
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 24, letterSpacing: 2, color: theme.red, textTransform: "uppercase" }}>{t.card.who}</div>
            <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 54, lineHeight: 1.05, color: theme.card_ink, marginTop: 6 }}>{t.card.text}</div>
          </div>
        ) : null}
        <Credit images={images} ids={[t.img]} color={theme.white} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: theme.white }}>
      <div style={{ position: "absolute", left: 50, top: 60, width: 700, fontFamily: serif, fontWeight: 900, fontSize: t.size || 138, lineHeight: 1.0, color: theme.black }}>
        {t.lines.map((l: string, i: number) => <div key={i} style={{ color: i === t.hot ? theme.red : theme.black }}>{l}</div>)}
      </div>
      <svg width={420} height={220} viewBox="0 0 420 220" style={{ position: "absolute", left: 360, top: 470 }}>
        <path d="M 10 30 C 160 10 280 80 340 170" fill="none" stroke={theme.red} strokeWidth={16} strokeLinecap="round" />
        <path d="M 340 170 L 300 122 M 340 170 L 392 138" fill="none" stroke={theme.red} strokeWidth={16} strokeLinecap="round" />
      </svg>
      <Cut img={t.img} h={t.h || 700} ring={theme.card_ink} style={{ right: t.x ?? 20, bottom: 0 }} k={3} />
      <Credit images={images} ids={[t.img]} color={theme.card_ink} />
    </AbsoluteFill>
  );
};
