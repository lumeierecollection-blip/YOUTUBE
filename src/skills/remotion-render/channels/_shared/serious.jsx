// Serious kit: the dark, fully motion-graphics look shared by the "serious" sample cuts (AI Tested, Dopamine Loop, Court & Spotlight, Rival Lines).
// Studied from high-view faceless explainers (fern, SunnyV2, Hoog, Tifo): one accent colour on a dark field, real source text on a document card
// with a highlight that sweeps across the quoted words, giant counted numbers, thin rules, mono labels. No characters, no stickers, no tape.
// Each channel passes its own theme; nothing here knows a channel. Picture area is y 150..1400, captions sit at 1430..1570 (clear of the Shorts UI).
import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FACES } from "../../fonts-loader.js";
import { abs, clamp } from "./parts.jsx";

export const COND = '"Roboto Condensed", "Arial Narrow", sans-serif';
export const SANS = '"Inter", sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';
export const SERIF = '"Playfair Display", Georgia, serif';
export const BODY = '"Noto Serif", Georgia, serif';
const out = Easing.out(Easing.cubic), expo = Easing.out(Easing.exp);
export const ramp = (f, a, b, e = out) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
export const lerp = (f, a, b, from, to, e = out) => interpolate(f, [a, b], [from, to], { ...clamp, easing: e });

/** Dark field: soft light from the top, a faint drifting grid, a vignette. */
export function Backdrop({ t, grid = true }) {
  const f = useCurrentFrame(), d = (f * 0.25) % 90;
  return (
    <AbsoluteFill style={{ background: t.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 70% at 50% 18%, ${t.glow} 0%, rgba(0,0,0,0) 62%)` }} />
      {grid && <AbsoluteFill style={{ backgroundImage: `linear-gradient(${t.line} 2px, transparent 2px), linear-gradient(90deg, ${t.line} 2px, transparent 2px)`, backgroundSize: "90px 90px", backgroundPosition: `0 ${d}px` }} />}
      <AbsoluteFill style={{ background: "radial-gradient(90% 75% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.62) 100%)" }} />
    </AbsoluteFill>
  );
}

/** A full-bleed picture under a dark wash, pushed in slowly. Used for public-domain paintings and, on Rival Lines, match footage frames. */
export function Plate({ src, dur, from = 1.04, to = 1.13, wash = 0.5, pos = "50% 50%", children }) {
  const f = useCurrentFrame(), s = interpolate(f, [0, dur], [from, to], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {src && <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: `scale(${s})`, filter: "saturate(0.78) contrast(1.05)" }} />}
      {children}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${wash + 0.25}) 0%, rgba(0,0,0,${wash * 0.55}) 34%, rgba(0,0,0,${wash * 0.7}) 62%, rgba(0,0,0,${Math.min(0.96, wash + 0.42)}) 100%)` }} />
    </AbsoluteFill>
  );
}

/** Small mono label with a square of the accent colour in front. */
export function Kicker({ t, x = 70, y, w = 940, delay = 0, color, size = 26, children }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 10);
  return (
    <div style={abs(x, y, w, size * 1.6, { display: "flex", alignItems: "center", gap: 16, fontFamily: MONO, fontWeight: 700, fontSize: size, letterSpacing: "0.12em", color: color || t.dim, textTransform: "uppercase", opacity: a, whiteSpace: "nowrap" })}>
      <span style={{ width: size * 0.55, height: size * 0.55, background: t.accent, flex: "none", transform: `scale(${a})` }} />{children}
    </div>
  );
}

/** Headline: each line rises out of its own mask, one after the other. */
export function Head({ t, x = 70, y, w = 940, size = 120, lines, delay = 0, step = 5, font = COND, color, weight = 700, upper = true, lh = 1.02, align = "left", italic = false }) {
  const f = useCurrentFrame();
  return (
    <div style={abs(x, y, w, "auto", { fontFamily: font, fontWeight: weight, fontStyle: italic ? "italic" : "normal", fontSize: size, lineHeight: lh, color: color || t.ink, textTransform: upper ? "uppercase" : "none", textAlign: align, letterSpacing: font === COND ? "-0.01em" : "-0.015em" })}>
      {lines.map((l, i) => { const a = ramp(f, delay + i * step, delay + i * step + 12, expo); return (
        <div key={i} style={{ overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}><div style={{ transform: `translateY(${(1 - a) * 105}%)` }}>{l}</div></div>); })}
    </div>
  );
}

/** A number that counts up to its value. */
export function Count({ t, x, y, w = 600, size = 300, to, delay = 0, len = 22, color, prefix = "", suffix = "", decimals = 0, align = "left", font = COND }) {
  const f = useCurrentFrame(), v = interpolate(f, [delay, delay + len], [0, to], { ...clamp, easing: out }), a = ramp(f, delay, delay + 6);
  return <div style={abs(x, y, w, size, { fontFamily: font, fontWeight: 700, fontSize: size, lineHeight: 1, color: color || t.ink, textAlign: align, letterSpacing: "-0.03em", opacity: a, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" })}>{prefix}{v.toFixed(decimals)}{suffix}</div>;
}

/** A thin rule that draws from the left. */
export function Rule({ t, x = 70, y, w = 940, delay = 0, color, h = 3 }) {
  const f = useCurrentFrame();
  return <div style={abs(x, y, w * ramp(f, delay, delay + 16, expo), h, { background: color || t.rule })} />;
}

/** Status label: filled (a verdict) or outlined (everything else). Lands with a short scale-down, like a stamp without the cartoon. */
export function Chip({ t, x, y, delay = 0, color, filled = true, size = 44, children, rot = 0 }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 7, expo), c = color || t.accent;
  return (
    <div style={abs(x, y, "auto", "auto", { opacity: a, transform: `rotate(${rot}deg) scale(${1.5 - 0.5 * a})`, transformOrigin: "0% 50%", fontFamily: COND, fontWeight: 700, fontSize: size, letterSpacing: "0.08em", textTransform: "uppercase", padding: `${size * 0.22}px ${size * 0.5}px`, background: filled ? c : "transparent", color: filled ? (t.onAccent || "#fff") : c, border: `${Math.max(3, size * 0.08)}px solid ${c}`, whiteSpace: "nowrap", lineHeight: 1.05 })}>{children}</div>
  );
}

const splitHl = (text, hl = []) => {
  const parts = []; let rest = text;
  for (const h of hl) { const i = rest.indexOf(h); if (i < 0) continue; if (i) parts.push([rest.slice(0, i), false]); parts.push([h, true]); rest = rest.slice(i + h.length); }
  if (rest) parts.push([rest, false]);
  return parts;
};
/** Source text with a highlight that sweeps across the quoted words. hl is a list of exact substrings, in reading order. */
export function Marked({ text, hl, delay = 0, step = 22, len = 16, color, ink }) {
  const f = useCurrentFrame(); let n = 0;
  return <>{splitHl(text, hl).map(([s, on], i) => { if (!on) return <span key={i}>{s}</span>; const k = n++, m = ramp(f, delay + k * step, delay + k * step + len, Easing.inOut(Easing.cubic)); return <span key={i} style={{ backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: "no-repeat", backgroundSize: `${m * 100}% 100%`, color: m > 0.5 && ink ? ink : undefined, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "0.06em 0" }}>{s}</span>; })}</>;
}

/** The document card: a sheet of real source text. Header names the source; the body is quoted text; highlights sweep in. Tilts flat as it lands. */
export function Doc({ t, x = 70, y, w = 940, delay = 0, source, meta, title, text, hl, size = 40, font = BODY, hlDelay = 12, hlStep = 24, paper, children, quote = false }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 14, expo), p = paper || t.paper;
  return (
    <div style={abs(x, y, w, "auto", { perspective: 1600, opacity: ramp(f, delay, delay + 5) })}>
      <div style={{ transform: `translateY(${(1 - a) * 120}px) rotateX(${(1 - a) * 22}deg)`, transformOrigin: "50% 100%", background: p, boxShadow: `14px 14px 0 ${t.accent}, 0 40px 90px rgba(0,0,0,0.55)`, color: t.paperInk || "#14161A" }}>
        {source && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 34px", borderBottom: "2px solid rgba(20,22,26,0.16)", fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(20,22,26,0.62)" }}><span>{source}</span><span>{meta}</span></div>}
        <div style={{ padding: "30px 34px 38px" }}>
          {title && <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: size * 1.22, lineHeight: 1.12, marginBottom: 22 }}>{title}</div>}
          {text && <div style={{ fontFamily: font, fontSize: size, lineHeight: 1.42 }}>{quote ? "“" : ""}<Marked text={text} hl={hl} delay={delay + hlDelay} step={hlStep} color={t.mark} />{quote ? "”" : ""}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** A framed photograph. Never zoomed. The credit sits under it in mono. */
export function Photo({ t, src, x, y, w, h, delay = 0, gray = false, credit, pos = "50% 20%", fit = "cover" }) {
  const f = useCurrentFrame(), a = ramp(f, delay, delay + 14, expo);
  return (
    <div style={abs(x, y, w, h, { opacity: ramp(f, delay, delay + 6), transform: `translateY(${(1 - a) * 70}px)` })}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#1a1a1c", boxShadow: `14px 14px 0 ${t.accent}, 0 40px 90px rgba(0,0,0,0.55)` }}>
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: pos, filter: gray ? "grayscale(1) contrast(1.08)" : "none" }} />
      </div>
      {credit && <div style={{ position: "absolute", left: 0, top: h + 26, width: w + 200, fontFamily: MONO, fontSize: 20, letterSpacing: "0.06em", color: t.dim, textTransform: "uppercase" }}>{credit}</div>}
    </div>
  );
}

/** Captions: the phrase being spoken, words lighting as they are said. */
export function Cap({ t, captions, y = 1436, font = SANS }) {
  const f = useCurrentFrame(), c = captions.find((x) => f >= x.from && f < x.to);
  if (!c) return null;
  return (
    <div style={abs(70, y, 940, 140, { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "0 14px", fontFamily: font, fontWeight: 800, fontSize: 52, lineHeight: 1.16, textAlign: "center", textShadow: "0 3px 18px rgba(0,0,0,0.85)" })}>
      {(c.words || [{ text: c.text, from: c.from }]).map((w, i) => <span key={i} style={{ color: f >= w.from ? t.ink : t.dim, opacity: f >= w.from ? 1 : 0.55 }}>{w.text}</span>)}
    </div>
  );
}

/** One scene: fades up over 4 frames, so cuts on the measured sentence boundaries are quick but not hard. */
export function Beat({ dur, children }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, 4, dur - 3, dur], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>;
}

/** The whole Short: backdrop, the scenes on their measured frames, the channel line, captions, a progress line. */
export function Shell({ t, durationInFrames, scenes, captions, beats, pass, label, grid = true, capFont }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: t.bg }}><style>{FONT_FACES}</style>
      <Backdrop t={t} grid={grid} />
      {scenes.map((s) => { const B = beats[s.kind], dur = s.to - s.from, ws = captions.flatMap((c) => c.words || []).filter((w) => w.from >= s.from && w.from < s.to), at = (re, fb) => { const w = ws.find((x) => re.test(x.text)); return w ? w.from - s.from : fb; }; return B ? <Sequence key={s.id} from={s.from} durationInFrames={dur}><Beat dur={dur}><B dur={dur} at={at} cues={captions.filter((c) => c.from >= s.from && c.from < s.to).map((c) => c.from - s.from)} {...pass} /></Beat></Sequence> : null; })}
      {label && <div style={abs(70, 96, 940, 34, { display: "flex", justifyContent: "space-between", fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", color: t.dim, textTransform: "uppercase" })}><span>{label[0]}</span><span>{label[1]}</span></div>}
      <div style={abs(70, 140, 940, 2, { background: t.rule, opacity: 0.6 })} />
      <Cap t={t} captions={captions} font={capFont} />
      <div style={abs(0, 1912, 1080 * (f / durationInFrames), 8, { background: t.accent })} />
    </AbsoluteFill>
  );
}
export const baseComp = { fps: 30, width: 1080, height: 1920, durationInFrames: 900 };

// ── Long form (16:9) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The same evidence beats play in a column on the right (the 1080-wide picture area, scaled). The left carries the sentence being spoken in large
// type, each word lighting as it is said, or a picture (a photograph, a painting, match footage) with the sentence under it. `side(scene)` returns
// that picture or null. Beats receive `wide` so a channel can drop its own full-bleed plate.
const COL = 0.76;
function Say({ t, words, h, font, upper, from }) {
  const f = useCurrentFrame(), chars = words.reduce((n, w) => n + w.text.length + 1, 0), size = Math.max(40, Math.min(132, Math.sqrt((880 * h) / (Math.max(chars, 12) * 0.74))));
  return (
    <div style={{ width: 880, height: h, display: "flex", flexWrap: "wrap", alignContent: "center", gap: `0 ${size * 0.26}px`, fontFamily: font, fontWeight: 700, fontSize: size, lineHeight: 1.08, textTransform: upper ? "uppercase" : "none", letterSpacing: "-0.01em" }}>
      {words.map((w, i) => { const a = ramp(f, w.from - from - 2, w.from - from + 5); return <span key={i} style={{ color: t.ink, opacity: 0.2 + 0.8 * a, transform: `translateY(${(1 - a) * 8}px)`, display: "inline-block" }}>{w.text}</span>; })}
    </div>
  );
}
export function WideShell({ t, durationInFrames, scenes, captions, beats, pass, label, grid = true, side, sayFont = COND, upper = true }) {
  const f = useCurrentFrame(), all = captions.flatMap((c) => c.words || []);
  return (
    <AbsoluteFill style={{ background: t.bg }}><style>{FONT_FACES}</style>
      <Backdrop t={t} grid={grid} />
      {label && <div style={abs(56, 36, 1808, 34, { display: "flex", justifyContent: "space-between", fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", color: t.dim, textTransform: "uppercase" })}><span>{label[0]}</span><span>{label[1]}</span></div>}
      <div style={abs(56, 80, 1808, 2, { background: t.rule, opacity: 0.6 })} />
      <div style={abs(56, 110, 880, 880)}>
        {scenes.map((s) => { const dur = s.to - s.from, ws = all.filter((w) => w.from >= s.from && w.from < s.to), media = side ? side(s, dur) : null; return (
          <Sequence key={s.id} from={s.from} durationInFrames={dur}><Beat dur={dur}>
            {media && <div style={abs(0, 0, 880, 620, { overflow: "hidden", background: "#000", boxShadow: `12px 12px 0 ${t.accent}, 0 30px 70px rgba(0,0,0,0.55)` })}>{media}</div>}
            <div style={abs(0, media ? 660 : 0, 880, media ? 220 : 880)}><Say t={t} words={ws} h={media ? 220 : 880} font={sayFont} upper={upper} from={s.from} /></div>
          </Beat></Sequence>); })}
      </div>
      <div style={abs(1010, 96, 1080, 1250, { transform: `scale(${COL})`, transformOrigin: "0 0" })}>
        <div style={abs(0, -150, 1080, 1400)}>
          {scenes.map((s) => { const B = beats[s.kind], dur = s.to - s.from, ws = all.filter((w) => w.from >= s.from && w.from < s.to), at = (re, fb) => { const w = ws.find((x) => re.test(x.text)); return w ? w.from - s.from : fb; }; return B ? <Sequence key={s.id} from={s.from} durationInFrames={dur}><Beat dur={dur}><B dur={dur} at={at} wide cues={captions.filter((c) => c.from >= s.from && c.from < s.to).map((c) => c.from - s.from)} {...pass} /></Beat></Sequence> : null; })}
        </div>
      </div>
      <div style={abs(0, 1072, 1920 * (f / durationInFrames), 8, { background: t.accent })} />
    </AbsoluteFill>
  );
}
export const wideComp = { fps: 30, width: 1920, height: 1080, durationInFrames: 900 };
