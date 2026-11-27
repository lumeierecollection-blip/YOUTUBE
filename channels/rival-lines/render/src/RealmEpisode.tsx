import React, { createContext, useContext } from "react";
import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";
import { loadFont as loadCond } from "@remotion/google-fonts/Anton";

// The Football Realm look, measured from its frames (data/rival-lines/paperpitch-footballrealm-reference-study.md and the frame sheet
// built from one of its videos): a maroon halftone ground, people cut out of their photos and set in a salmon circle with a thin
// outline, price-tag cards, short bottom captions with one accent word. Every colour comes from props.theme (channels.json realm_colors).
// The reference runs press-conference and match footage under all of it. Broadcast footage is not ours to use; the footage scene here
// plays only clips with a verified open licence (Wikimedia Commons), labelled with what and when they really are. Photos are
// Wikimedia Commons files with their credit shown on screen.
const sans = loadSans("normal", { weights: ["500", "700", "900"], subsets: ["latin"] }).fontFamily;
const cond = loadCond("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const back = (x: number) => { const c = 1.6, t = clamp(x) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
const pg = (t: number, at: number, dur = 0.5) => ease((t - at) / dur);
const pop = (t: number, at: number, dur = 0.45) => back((t - at) / dur);
const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9é,.:]/g, "").replace(/^[,.:]+|[,.:]+$/g, "");

type Ctx = { theme: any; images: any; footage: any };
const C = createContext<Ctx>({ theme: {}, images: {}, footage: {} });
const useCtx = () => useContext(C);
const useT = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };
const shade = (c: string, pctv: number) => `color-mix(in srgb, ${c} ${pctv}%, transparent)`;
const cue = (v: any, i: number, def: number) => (v.cues && v.cues[i] != null ? v.cues[i] : def);
const mmn = (n: number) => n.toLocaleString("en-GB");

const outline = (c: string, k = 3) => `drop-shadow(${k}px 0 0 ${c}) drop-shadow(-${k}px 0 0 ${c}) drop-shadow(0 ${k}px 0 ${c}) drop-shadow(0 -${k}px 0 ${c})`;

/* a person cut out of the photo, set in the circle; the head may rise above the circle edge, the body is cut at its base */
const Person: React.FC<{ img: string; d: number; ring?: boolean; lift?: number; style?: React.CSSProperties }> = ({ img, d, ring = true, lift = 1.12, style }) => {
  const { theme } = useCtx();
  return (
    <div style={{ position: "relative", width: d, height: d, ...style }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: d, background: theme.circle }} />
      <div style={{ position: "absolute", left: -d * 0.25, right: -d * 0.25, top: -d * 0.45, bottom: 0, clipPath: `inset(0 0 0 0)`, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", borderRadius: `0 0 ${d}px ${d}px` }}>
        <Img src={staticFile(`ep/images/cutout-${img}.png`)} style={{ height: d * lift + d * 0.0, maxWidth: d * 1.45, width: "auto", objectFit: "contain", objectPosition: "center bottom", filter: ring ? outline(theme.outline, 3) : undefined }} />
      </div>
    </div>
  );
};

/* a face only, for rows and avatars */
const Face: React.FC<{ img?: string; d: number; n?: number; hot?: boolean }> = ({ img, d, n, hot }) => {
  const { theme } = useCtx();
  return (
    <div style={{ width: d, height: d, borderRadius: d, background: hot ? theme.accent_word : theme.circle, overflow: "hidden", position: "relative", flex: "none", border: `3px solid ${theme.outline}` }}>
      {img ? <Img src={staticFile(`ep/images/cutout-${img}.png`)} style={{ position: "absolute", left: "50%", top: "8%", height: "150%", width: "auto", transform: "translateX(-50%)", objectFit: "cover", objectPosition: "center top" }} />
        : <div style={{ width: d, height: d, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: cond, fontSize: d * 0.5, color: theme.card_ink }}>{n}</div>}
    </div>
  );
};

/* the price tag: cream card, heavy figure */
const Tag: React.FC<{ value: string; label?: string; size?: number; tilt?: number; hot?: boolean }> = ({ value, label, size = 76, tilt = 0, hot }) => {
  const { theme } = useCtx();
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", transform: `rotate(${tilt}deg)` }}>
      {label ? <div style={{ fontFamily: sans, fontWeight: 900, fontSize: size * 0.4, letterSpacing: 2, color: theme.text, textTransform: "uppercase", marginBottom: 8 }}>{label}</div> : null}
      <div style={{ background: hot ? theme.accent_word : theme.card, color: theme.card_ink, fontFamily: cond, fontSize: size, lineHeight: 1, padding: `${size * 0.12}px ${size * 0.3}px ${size * 0.06}px`, border: `3px solid ${theme.card_ink}`, boxShadow: `6px 8px 0 ${shade(theme.black, 45)}` }}>{value}</div>
    </div>
  );
};

/* ---------- scenes ---------- */
const Versus: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const a = pop(t, 0.15), b = pop(t, 0.45);
  const tagA = pop(t, cue(v, 0, 1.0)), tagB = pop(t, cue(v, 1, 2.0)), mid = pop(t, cue(v, 2, 3.0));
  const D = 560;
  return (
    <>
      <div style={{ position: "absolute", left: 130, top: 130, transform: `translateX(${(1 - ease(a)) * -300}px)`, opacity: clamp(a) }}><Person img={v.left.img} d={D} /></div>
      <div style={{ position: "absolute", right: 130, top: 130, transform: `translateX(${(1 - ease(b)) * 300}px)`, opacity: clamp(b) }}><Person img={v.right.img} d={D} /></div>
      <div style={{ position: "absolute", left: 130, width: D, top: 740, display: "flex", justifyContent: "center", transform: `scale(${clamp(tagA, 0, 1.2)})` }}><Tag value={v.left.value} label={v.left.label} tilt={-3} hot /></div>
      <div style={{ position: "absolute", right: 130, width: D, top: 740, display: "flex", justifyContent: "center", transform: `scale(${clamp(tagB, 0, 1.2)})` }}><Tag value={v.right.value} label={v.right.label} tilt={3} /></div>
      {v.mid ? (
        <div style={{ position: "absolute", left: 710, width: 500, top: 330, textAlign: "center", transform: `scale(${clamp(mid, 0, 1.2)})` }}>
          <div style={{ fontFamily: cond, fontSize: 250, lineHeight: 1, color: theme.accent_word, textShadow: `0 8px 0 ${shade(theme.black, 40)}` }}>{v.mid}</div>
          <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 36, letterSpacing: 4, color: theme.text }}>POINTS APART</div>
        </div>
      ) : null}
    </>
  );
};

const Timeline: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const n = v.items.length, x0 = 260, x1 = 1660;
  const line = pg(t, 0.2, 1.2);
  return (
    <>
      <div style={{ position: "absolute", left: x0, top: 520, width: (x1 - x0) * line, height: 10, background: theme.circle, borderRadius: 5 }} />
      {v.items.map((it: any, i: number) => {
        const x = x0 + ((x1 - x0) * i) / (n - 1);
        const p = pop(t, cue(v, i, 0.6 + i * 1.2));
        const up = i % 2 === 0;
        return (
          <div key={i} style={{ position: "absolute", left: x - 230, width: 460, top: 0, height: 1080, opacity: clamp(p) }}>
            <div style={{ position: "absolute", left: 190, top: 490, width: 80, height: 80, borderRadius: 80, background: theme.circle, border: `6px solid ${theme.text}`, transform: `scale(${clamp(p, 0, 1.2)})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: cond, fontSize: 46, color: theme.card_ink }}>{i + 1}</div>
            <div style={{ position: "absolute", left: 0, width: 460, textAlign: "center", top: up ? 190 : 640, transform: `translateY(${(1 - ease(p)) * (up ? 30 : -30)}px)` }}>
              <div style={{ fontFamily: cond, fontSize: 80, lineHeight: 1, color: theme.accent_word }}>{it.when}</div>
              <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 38, letterSpacing: 2, color: theme.text, marginTop: 12, textTransform: "uppercase" }}>{it.what}</div>
            </div>
          </div>
        );
      })}
    </>
  );
};

const Clock: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const [hh, mm] = v.time.split(":").map(Number);
  const c0 = cue(v, 0, 1.0) - 0.2;
  const k = pg(t, c0, 1.4);
  const ha = ((hh % 12) + mm / 60) * 30, ma = mm * 6;
  const R = 330;
  const hand = (deg: number, len: number, w: number, col: string) => (
    <line x1={0} y1={0} x2={Math.sin((deg * Math.PI) / 180) * len} y2={-Math.cos((deg * Math.PI) / 180) * len} stroke={col} strokeWidth={w} strokeLinecap="round" />
  );
  return (
    <>
      <svg width={760} height={760} viewBox="-380 -380 760 760" style={{ position: "absolute", left: 180, top: 140 }}>
        <circle r={R + 20} fill={theme.circle} />
        <circle r={R} fill={theme.card} stroke={theme.card_ink} strokeWidth={8} />
        {Array.from({ length: 12 }, (_, i) => <line key={i} x1={Math.sin((i * 30 * Math.PI) / 180) * (R - 14)} y1={-Math.cos((i * 30 * Math.PI) / 180) * (R - 14)} x2={Math.sin((i * 30 * Math.PI) / 180) * (R - 56)} y2={-Math.cos((i * 30 * Math.PI) / 180) * (R - 56)} stroke={theme.card_ink} strokeWidth={i % 3 === 0 ? 12 : 6} />)}
        {hand(ha * k + (1 - k) * 200, 170, 20, theme.card_ink)}
        {hand(ma * k + (1 - k) * 720, 260, 12, theme.outline)}
        <circle r={20} fill={theme.card_ink} />
      </svg>
      <div style={{ position: "absolute", left: 1020, top: 330, width: 760, opacity: clamp(k) }}>
        <div style={{ fontFamily: cond, fontSize: 210, lineHeight: 1, color: theme.accent_word }}>5:15 PM</div>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 40, letterSpacing: 3, color: theme.text, textTransform: "uppercase", marginTop: 14 }}>{v.label}</div>
        <div style={{ marginTop: 26, display: "inline-block", fontFamily: sans, fontWeight: 900, fontSize: 32, letterSpacing: 2, color: theme.card_ink, background: theme.card, padding: "8px 20px", transform: "rotate(-1.5deg)" }}>{v.sub}</div>
      </div>
    </>
  );
};

const Headlines: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  return (
    <>
      {v.items.map((it: any, i: number) => {
        const p = pop(t, cue(v, i, 0.5 + i * 1.1));
        const y = 150 + i * 255;
        return (
          <div key={i} style={{ position: "absolute", left: 360, top: y, width: 1200, height: 215, background: theme.card, border: `4px solid ${theme.card_ink}`, boxShadow: `10px 12px 0 ${shade(theme.black, 45)}`, transform: `translateX(${(1 - ease(p)) * (i % 2 ? 500 : -500)}px) rotate(${(i - 1) * 1.2}deg)`, opacity: clamp(p), overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 24, top: 18, width: 180, height: 180 }}><Face img={it.img} d={180} /></div>
            <div style={{ position: "absolute", left: 240, top: 24, fontFamily: cond, fontSize: 82, color: theme.card_ink, lineHeight: 1 }}>{String(it.label).toUpperCase()}</div>
            {[0, 1, 2].map((r) => <div key={r} style={{ position: "absolute", left: 240, top: 118 + r * 28, width: 760 - r * 140, height: 14, borderRadius: 7, background: shade(theme.card_ink, 22) }} />)}
            <div style={{ position: "absolute", right: 20, top: 20, fontFamily: sans, fontWeight: 900, fontSize: 24, letterSpacing: 2, color: theme.card, background: theme.outline, padding: "6px 14px" }}>BEFORE THE CEREMONY</div>
          </div>
        );
      })}
    </>
  );
};

const Quote: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const p = pop(t, Math.max(0, cue({ cues: [v.cue] }, 0, 0.3) - 0.3), 0.6);
  return (
    <>
      <div style={{ position: "absolute", left: v.img ? 130 : 200, top: 190, width: v.img ? 1000 : 1000, transform: `scale(${clamp(p, 0, 1.05)})`, transformOrigin: "left center", opacity: clamp(p) }}>
        <div style={{ fontFamily: cond, fontSize: 380, lineHeight: 0.6, color: theme.circle, height: 160 }}>“</div>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 70, lineHeight: 1.12, color: theme.text }}>{v.text}</div>
        <div style={{ marginTop: 34, display: "inline-block", fontFamily: sans, fontWeight: 900, fontSize: 32, letterSpacing: 3, color: theme.card_ink, background: theme.accent_word, padding: "8px 20px", textTransform: "uppercase" }}>{v.who}</div>
      </div>
      {v.img ? <div style={{ position: "absolute", right: 120, top: 220, opacity: clamp(p), transform: `translateX(${(1 - ease(p)) * 200}px)` }}><Person img={v.img} d={640} /></div> : null}
      {v.deco === "drafts" ? (
        <div style={{ position: "absolute", right: 170, top: 230, width: 560, height: 700 }}>
          {[2, 1, 0].map((i) => {
            const q = pop(t, 0.5 + (2 - i) * 0.35);
            return (
              <div key={i} style={{ position: "absolute", left: i * 40, top: i * 50, width: 440, height: 560, background: theme.card, border: `4px solid ${theme.card_ink}`, boxShadow: `10px 12px 0 ${shade(theme.black, 45)}`, transform: `rotate(${(i - 1) * 5}deg) scale(${clamp(q, 0, 1.05)})`, opacity: clamp(q) }}>
                {[0, 1, 2, 3, 4, 5, 6].map((r) => <div key={r} style={{ position: "absolute", left: 40, top: 60 + r * 58, width: 360 - (r % 3) * 70, height: 16, borderRadius: 8, background: shade(theme.card_ink, 22) }} />)}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

const Dots: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const c0 = cue({ cues: [v.cue] }, 0, 0.8);
  const cols = 4, size = 190, gap = 34;
  return (
    <>
      <div style={{ position: "absolute", left: 130, top: 230, width: 620 }}>
        <div style={{ fontFamily: cond, fontSize: 520, lineHeight: 0.9, color: theme.accent_word, textShadow: `0 10px 0 ${shade(theme.black, 40)}`, opacity: pg(t, 0.2, 0.6) }}>{v.count}</div>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 44, letterSpacing: 3, color: theme.text, textTransform: "uppercase", opacity: pg(t, 0.6, 0.6) }}>{v.label}</div>
      </div>
      <div style={{ position: "absolute", left: 890, top: 150 }}>
        {Array.from({ length: v.count }, (_, i) => {
          const p = pop(t, c0 - 0.2 + i * 0.12, 0.4);
          const r = Math.floor(i / cols), c = i % cols;
          return (
            <div key={i} style={{ position: "absolute", left: c * (size + gap), top: r * (size + gap), width: size, height: size, borderRadius: size, background: theme.circle, border: `5px solid ${theme.outline}`, overflow: "hidden", transform: `scale(${clamp(p, 0, 1.1)})` }}>
              <svg width={size} height={size} viewBox="0 0 100 100">
                <circle cx={50} cy={40} r={18} fill={theme.card_ink} />
                <path d="M 14 100 Q 14 62 50 62 Q 86 62 86 100 Z" fill={theme.card_ink} />
              </svg>
            </div>
          );
        })}
      </div>
    </>
  );
};

const Coins: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const c0 = cue({ cues: [v.cue] }, 0, 0.8);
  const k = pg(t, c0 - 0.3, 1.8);
  const target = Number(String(v.value).replace(/,/g, ""));
  return (
    <>
      <svg width={760} height={760} viewBox="0 0 400 400" style={{ position: "absolute", left: 120, top: 150 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const p = clamp(k * 14 - i);
          const x = 70 + (i % 2) * 18, y = 360 - i * 22 - (i > 6 ? 0 : 0);
          return <g key={i} opacity={p} transform={`translate(0 ${(1 - p) * -30})`}>
            <ellipse cx={200 + (x - 80)} cy={y + 16} rx={110} ry={34} fill={theme.card_ink} />
            <ellipse cx={200 + (x - 80)} cy={y} rx={110} ry={34} fill={theme.circle} stroke={theme.card_ink} strokeWidth={5} />
            <ellipse cx={200 + (x - 80)} cy={y} rx={74} ry={20} fill="none" stroke={theme.card_ink} strokeWidth={4} />
          </g>;
        })}
      </svg>
      <div style={{ position: "absolute", left: 930, top: 320, width: 900 }}>
        <div style={{ fontFamily: cond, fontSize: 250, lineHeight: 1, color: theme.accent_word, textShadow: `0 10px 0 ${shade(theme.black, 40)}` }}>€{mmn(Math.round(target * k))}</div>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 44, letterSpacing: 3, color: theme.text, textTransform: "uppercase", marginTop: 8 }}>{v.unit}</div>
        <div style={{ marginTop: 30, display: "inline-block", fontFamily: sans, fontWeight: 900, fontSize: 32, letterSpacing: 2, color: theme.card, background: theme.outline, padding: "8px 20px", transform: "rotate(-1.5deg)", opacity: pg(t, c0 + 1.5, 0.5) }}>REPORTED, NOT PROVEN</div>
      </div>
    </>
  );
};

const Faces: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const n = v.imgs.length, D = n <= 3 ? 400 : v.kind === "close" ? 300 : 260, step = D * 0.82;
  const total = step * (n - 1) + D, x0 = (1920 - total) / 2;
  return (
    <>
      {v.imgs.map((im: string, i: number) => {
        const p = pop(t, 0.2 + i * 0.18);
        return <div key={i} style={{ position: "absolute", left: x0 + i * step, top: 250 + (i % 2 ? 40 : 0), transform: `scale(${clamp(p, 0, 1.1)})`, zIndex: i % 2 }}><Person img={im} d={D} /></div>;
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: Math.max(690, 250 + D + 80), textAlign: "center", fontFamily: cond, fontSize: v.kind === "close" ? 190 : 120, lineHeight: 1, color: theme.accent_word, textTransform: "uppercase", textShadow: `0 8px 0 ${shade(theme.black, 40)}`, opacity: pg(t, 0.9, 0.6) }}>{v.caption}</div>
    </>
  );
};

const Ladder: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const max = Math.max(...v.ranks);
  return (
    <div style={{ position: "absolute", left: 280, top: 70, width: 1360 }}>
      {v.ranks.map((pts: number, i: number) => {
        const p = pg(t, cue(v, i, 0.3 + i * 0.5), 0.45);
        const hot = i < 3;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", height: 86, marginBottom: 7, opacity: clamp(p) }}>
            <div style={{ width: 100, fontFamily: cond, fontSize: 64, color: theme.text }}>{i + 1}</div>
            <div style={{ flex: 1, height: 64, position: "relative" }}>
              <div style={{ width: `${(pts / max) * 100 * p}%`, height: 64, background: hot ? theme.accent_word : theme.circle, border: `3px solid ${theme.outline}` }} />
            </div>
            <div style={{ width: 160, textAlign: "right", fontFamily: cond, fontSize: 68, color: hot ? theme.accent_word : theme.text }}>{pts}</div>
          </div>
        );
      })}
    </div>
  );
};

const Ranking: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  return (
    <div style={{ position: "absolute", left: 200, top: 36, width: 1520 }}>
      {v.rows.map((r: any, i: number) => {
        const p = pg(t, cue(v, i, 0.3 + i * 0.6), 0.45);
        const hot = i < 2;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", height: 80, marginBottom: 4, opacity: clamp(p), transform: `translateX(${(1 - p) * -60}px)` }}>
            <Face img={r.img} d={68} n={i + 1} hot={hot} />
            <div style={{ width: 330, marginLeft: 20, fontFamily: sans, fontWeight: 900, fontSize: 38, letterSpacing: 1, color: theme.text, textTransform: "uppercase" }}>{r.name}</div>
            <div style={{ flex: 1, height: 52, position: "relative", marginRight: 20 }}>
              <div style={{ width: `${(r.value / v.max) * 100 * p}%`, height: 52, background: hot ? theme.accent_word : theme.circle, border: `3px solid ${theme.outline}` }} />
            </div>
            <div style={{ width: 150, textAlign: "right", fontFamily: cond, fontSize: 64, color: hot ? theme.accent_word : theme.text }}>{mmn(r.value)}</div>
          </div>
        );
      })}
    </div>
  );
};

const Ruler: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const W = 1500, x0 = 210, y = 600, k = pg(t, 0.3, 1.2);
  const c0 = cue({ cues: [v.cue] }, 0, 1.2);
  const g = pop(t, c0);
  const xa = x0 + (v.a.value / v.max) * W, xb = x0 + (v.b.value / v.max) * W;
  return (
    <>
      <div style={{ position: "absolute", left: x0, top: y, width: W, height: 60, background: shade(theme.text, 14), border: `3px solid ${theme.outline}` }} />
      <div style={{ position: "absolute", left: x0, top: y, width: (xa - x0) * k, height: 60, background: theme.circle }} />
      <div style={{ position: "absolute", left: xa, top: y, width: (xb - xa) * clamp(g), height: 60, background: theme.accent_word }} />
      {[0, 250, 500, 750, 1000, 1250, 1500].map((m) => (
        <div key={m} style={{ position: "absolute", left: x0 + (m / v.max) * W - 40, width: 80, top: y + 78, textAlign: "center", fontFamily: sans, fontWeight: 700, fontSize: 28, color: theme.text, opacity: 0.8 }}>{mmn(m)}</div>
      ))}
      <div style={{ position: "absolute", left: xa - 200, width: 200, top: y - 150, textAlign: "right", opacity: pg(t, 0.9, 0.5) }}>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 34, color: theme.text, textTransform: "uppercase" }}>{v.a.label}</div>
        <div style={{ fontFamily: cond, fontSize: 70, color: theme.text }}>{mmn(v.a.value)}</div>
      </div>
      <div style={{ position: "absolute", left: xb + 12, width: 260, top: y - 150, opacity: pg(t, 1.0, 0.5) }}>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 34, color: theme.accent_word, textTransform: "uppercase" }}>{v.b.label}</div>
        <div style={{ fontFamily: cond, fontSize: 70, color: theme.accent_word }}>{mmn(v.b.value)}</div>
      </div>
      <div style={{ position: "absolute", left: (xa + xb) / 2 - 300, width: 600, top: 30, textAlign: "center", transform: `scale(${clamp(g, 0, 1.15)})` }}>
        <div style={{ fontFamily: cond, fontSize: 260, lineHeight: 1, color: theme.accent_word, textShadow: `0 10px 0 ${shade(theme.black, 40)}` }}>{v.gap}</div>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 36, letterSpacing: 4, color: theme.text }}>POINTS, ON A SCALE OF {mmn(v.max)}</div>
      </div>
    </>
  );
};

const Ballot: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const known: Record<number, string> = Object.fromEntries(v.rows.map((r: any) => [r.rank, r.name]));
  const c0 = cue({ cues: [v.cue] }, 0, 3);
  const p = pop(t, 0.2, 0.6);
  return (
    <>
      <div style={{ position: "absolute", left: 360, top: 50, width: 1200, height: 910, background: theme.card, border: `5px solid ${theme.card_ink}`, boxShadow: `14px 16px 0 ${shade(theme.black, 45)}`, transform: `rotate(-1deg) scale(${clamp(p, 0, 1.03)})`, opacity: clamp(p) }}>
        <div style={{ position: "absolute", left: 50, top: 24, fontFamily: cond, fontSize: 64, color: theme.card_ink }}>ONE JUROR'S BALLOT</div>
        <div style={{ position: "absolute", right: 50, top: 40, fontFamily: sans, fontWeight: 700, fontSize: 24, color: theme.card_ink, opacity: 0.7 }}>only the reported rows are filled in</div>
        {v.points.map((pts: number, i: number) => {
          const hot = i + 1 === v.mark;
          const q = pg(t, 0.6 + i * 0.12, 0.4);
          const rowHot = pg(t, c0 - 0.2, 0.4);
          return (
            <div key={i} style={{ position: "absolute", left: 40, right: 40, top: 112 + i * 78, height: 68, display: "flex", alignItems: "center", opacity: clamp(q), background: hot ? shade(theme.accent_word, 85 * rowHot) : "transparent", borderBottom: `3px solid ${shade(theme.card_ink, 30)}` }}>
              <div style={{ width: 90, fontFamily: cond, fontSize: 52, color: theme.card_ink, paddingLeft: 14 }}>{i + 1}</div>
              <div style={{ flex: 1, fontFamily: sans, fontWeight: 900, fontSize: 40, color: theme.card_ink, textTransform: "uppercase" }}>{known[i + 1] || ""}</div>
              <div style={{ width: 200, whiteSpace: "nowrap", textAlign: "right", fontFamily: cond, fontSize: 52, color: theme.card_ink, paddingRight: 14 }}>{pts} pts</div>
            </div>
          );
        })}
      </div>
    </>
  );
};

const CutoutScene: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const right = v.side === "right";
  const p = pop(t, 0.15, 0.6), tg = pop(t, cue({ cues: [v.cue] }, 0, 1.0));
  return (
    <>
      <div style={{ position: "absolute", [right ? "right" : "left"]: 170, top: 90, transform: `translateX(${(1 - ease(p)) * (right ? 300 : -300)}px)`, opacity: clamp(p) }}><Person img={v.img} d={780} /></div>
      <div style={{ position: "absolute", [right ? "left" : "right"]: 170, top: 360, width: 800, textAlign: right ? "left" : "right", transform: `scale(${clamp(tg, 0, 1.1)})`, transformOrigin: right ? "left center" : "right center" }}>
        <div style={{ fontFamily: cond, fontSize: 150, lineHeight: 1, color: theme.accent_word, textTransform: "uppercase", textShadow: `0 8px 0 ${shade(theme.black, 40)}` }}>{v.label}</div>
        <div style={{ marginTop: 20, display: "inline-block", fontFamily: sans, fontWeight: 900, fontSize: 40, letterSpacing: 2, color: theme.card_ink, background: theme.card, padding: "8px 22px", transform: "rotate(-1.5deg)", textTransform: "uppercase" }}>{v.sub}</div>
      </div>
    </>
  );
};

const Cards3: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const p = pop(t, 0.15, 0.6);
  return (
    <>
      <div style={{ position: "absolute", left: 100, top: 160, transform: `translateX(${(1 - ease(p)) * -300}px)`, opacity: clamp(p) }}><Person img={v.img} d={640} /></div>
      {v.cards.map((c: any, i: number) => {
        const q = pop(t, cue(v, i, 0.8 + i * 1.0));
        return (
          <div key={i} style={{ position: "absolute", left: 790 + i * 370, top: 250 + (i === 2 ? 60 : 0), width: 340, textAlign: "center", transform: `scale(${clamp(q, 0, 1.1)})` }}>
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 36, letterSpacing: 2, color: theme.text, textTransform: "uppercase", marginBottom: 14 }}>{c.label}</div>
            <div style={{ background: i === 2 ? theme.accent_word : theme.card, color: theme.card_ink, border: `4px solid ${theme.card_ink}`, boxShadow: `10px 12px 0 ${shade(theme.black, 45)}`, fontFamily: cond, fontSize: v.size || 210, whiteSpace: "nowrap", lineHeight: 1, padding: "26px 0 8px", transform: `rotate(${(i - 1) * 3}deg)` }}>{c.value}</div>
          </div>
        );
      })}
      {v.noop ? null : <div style={{ position: "absolute", left: 1075, top: 500, fontFamily: cond, fontSize: 120, color: theme.text, opacity: pg(t, cue(v, 1, 1.8), 0.3) }}>−</div>}
      {v.noop ? null : <div style={{ position: "absolute", left: 1445, top: 500, fontFamily: cond, fontSize: 120, color: theme.text, opacity: pg(t, cue(v, 2, 2.8), 0.3) }}>=</div>}
    </>
  );
};

const Icon: React.FC<{ kind: string; size: number }> = ({ kind, size }) => {
  const { theme } = useCtx();
  const s = { fill: theme.card_ink };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {kind === "bars" ? <g {...s}><rect x={14} y={50} width={18} height={36} /><rect x={41} y={26} width={18} height={60} /><rect x={68} y={38} width={18} height={48} /></g> : null}
      {kind === "ballot" ? <g><rect x={20} y={10} width={60} height={80} fill="none" stroke={theme.card_ink} strokeWidth={6} /><path d="M 32 40 L 42 50 L 62 28" fill="none" stroke={theme.card_ink} strokeWidth={7} /><rect x={32} y={62} width={36} height={6} {...s} /><rect x={32} y={74} width={26} height={6} {...s} /></g> : null}
      {kind === "warn" ? <g><path d="M 50 12 L 92 86 L 8 86 Z" fill="none" stroke={theme.card_ink} strokeWidth={7} strokeLinejoin="round" /><rect x={46} y={36} width={8} height={26} {...s} /><circle cx={50} cy={73} r={5} {...s} /></g> : null}
      {kind === "person" ? <g {...s}><circle cx={50} cy={34} r={18} /><path d="M 14 92 Q 14 58 50 58 Q 86 58 86 92 Z" /></g> : null}
      {kind === "page" ? <g><rect x={24} y={10} width={52} height={80} fill="none" stroke={theme.card_ink} strokeWidth={6} /><rect x={34} y={28} width={32} height={6} {...s} /><rect x={34} y={42} width={32} height={6} {...s} /><rect x={34} y={56} width={22} height={6} {...s} /></g> : null}
    </svg>
  );
};

const Tiles: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const n = v.tiles.length, w = 390, gap = 40, x0 = (1920 - (n * w + (n - 1) * gap)) / 2;
  return (
    <>
      {v.tiles.map((c: any, i: number) => {
        const q = pop(t, cue(v, i, 0.6 + i * 1.0));
        return (
          <div key={i} style={{ position: "absolute", left: x0 + i * (w + gap), top: 200, width: w, height: 620, background: theme.card, border: `5px solid ${theme.card_ink}`, boxShadow: `12px 14px 0 ${shade(theme.black, 45)}`, transform: `translateY(${(1 - clamp(q)) * 200}px) rotate(${(i - 1.5) * 2}deg) scale(${clamp(q, 0, 1.05)})`, opacity: clamp(q), textAlign: "center" }}>
            <div style={{ marginTop: 34, display: "flex", justifyContent: "center" }}><Icon kind={c.icon} size={150} /></div>
            <div style={{ fontFamily: cond, fontSize: 250, lineHeight: 1, color: i === 3 ? theme.outline : theme.card_ink }}>{c.value}</div>
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 38, letterSpacing: 1, color: theme.card_ink, textTransform: "uppercase", padding: "10px 24px" }}>{c.label}</div>
          </div>
        );
      })}
    </>
  );
};

/* ---------- table, results and big-number scenes used by the Manchester United episode ---------- */
const Table: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  return (
    <div style={{ position: "absolute", left: 260, top: 130, width: 1400 }}>
      {v.rows.map((r: any, i: number) => {
        const p = pg(t, cue(v, i, 0.2 + i * 0.12), 0.35);
        const hot = !!r.hot;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", height: 110, marginBottom: 10, opacity: clamp(p), background: hot ? theme.accent_word : shade(theme.text, 8), border: hot ? `3px solid ${theme.outline}` : "none", transform: `translateX(${(1 - p) * 80}px)` }}>
            <div style={{ width: 110, textAlign: "center", fontFamily: cond, fontSize: 72, color: hot ? theme.card_ink : theme.text }}>{r.pos}</div>
            <div style={{ flex: 1, fontFamily: sans, fontWeight: 900, fontSize: 52, color: hot ? theme.card_ink : theme.text, textTransform: "uppercase" }}>{r.team}</div>
            <div style={{ width: 150, textAlign: "center", fontFamily: sans, fontWeight: 700, fontSize: 48, color: hot ? theme.card_ink : theme.text }}>{r.played}</div>
            <div style={{ width: 190, textAlign: "center", fontFamily: cond, fontSize: 80, color: hot ? theme.card_ink : theme.text }}>{r.points}</div>
          </div>
        );
      })}
      <div style={{ display: "flex", fontFamily: sans, fontWeight: 700, fontSize: 30, color: theme.text, opacity: 0.8, marginTop: 12 }}>
        <div style={{ width: 110 }} /><div style={{ flex: 1 }}>{v.note || ""}</div><div style={{ width: 150, textAlign: "center" }}>P</div><div style={{ width: 190, textAlign: "center" }}>PTS</div>
      </div>
    </div>
  );
};

const BigStat: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const p = pop(t, 0.2, 0.6), q = pop(t, cue({ cues: [v.cue] }, 0, 0.9));
  const target = Number(String(v.value).replace(/[^0-9.]/g, ""));
  const k = v.count ? pg(t, cue({ cues: [v.cue] }, 0, 0.9) - 0.2, 1.2) : 1;
  const shown = v.count ? String(v.value).replace(/[0-9,.]+/, mmn(Math.round(target * k))) : v.value;
  return (
    <>
      {v.img ? <div style={{ position: "absolute", left: 120, top: 150, transform: `translateX(${(1 - ease(p)) * -300}px)`, opacity: clamp(p) }}><Person img={v.img} d={700} /></div> : null}
      <div style={{ position: "absolute", left: v.img ? 900 : 200, top: 260, width: v.img ? 900 : 1520, textAlign: v.img ? "left" : "center", transform: `scale(${clamp(q, 0, 1.08)})`, transformOrigin: v.img ? "left center" : "center" }}>
        <div style={{ fontFamily: cond, fontSize: v.size || 360, lineHeight: 1, color: theme.accent_word, textShadow: `0 12px 0 ${shade(theme.black, 40)}` }}>{shown}</div>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 48, letterSpacing: 3, color: theme.text, textTransform: "uppercase" }}>{v.label}</div>
        {v.sub ? <div style={{ marginTop: 24, display: "inline-block", fontFamily: sans, fontWeight: 900, fontSize: 34, letterSpacing: 2, color: theme.card_ink, background: theme.card, padding: "8px 20px", transform: "rotate(-1.5deg)", textTransform: "uppercase" }}>{v.sub}</div> : null}
      </div>
    </>
  );
};

const Results: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const n = v.items.length, w = 250, gap = 28, perRow = Math.min(n, 5);
  const rows = Math.ceil(n / perRow);
  const x0 = (1920 - (perRow * w + (perRow - 1) * gap)) / 2;
  const col = (r: string) => (r === "W" ? theme.good : r === "L" ? theme.bad : theme.card);
  return (
    <>
      {v.title ? <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: cond, fontSize: 96, color: theme.accent_word, textTransform: "uppercase" }}>{v.title}</div> : null}
      {v.items.map((it: any, i: number) => {
        const p = pop(t, cue(v, i, 0.4 + i * 0.35), 0.4);
        const r = Math.floor(i / perRow), c = i % perRow;
        return (
          <div key={i} style={{ position: "absolute", left: x0 + c * (w + gap), top: 240 + r * 330, width: w, height: 290, background: theme.card, border: `4px solid ${theme.card_ink}`, boxShadow: `8px 10px 0 ${shade(theme.black, 45)}`, transform: `scale(${clamp(p, 0, 1.08)})`, opacity: clamp(p), textAlign: "center", overflow: "hidden" }}>
            <div style={{ background: col(it.r), height: 84, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: cond, fontSize: 64, color: theme.card_ink, borderBottom: `4px solid ${theme.card_ink}` }}>{it.r}</div>
            <div style={{ fontFamily: cond, fontSize: 96, lineHeight: 1, color: theme.card_ink, marginTop: 20 }}>{it.score}</div>
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 28, color: theme.card_ink, textTransform: "uppercase", marginTop: 8, padding: "0 10px" }}>{it.vs}</div>
            <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 22, color: theme.card_ink, opacity: 0.7, marginTop: 4 }}>{it.when}</div>
          </div>
        );
      })}
      {rows > 0 && v.foot ? <div style={{ position: "absolute", left: 0, right: 0, top: 240 + rows * 330 + 10, textAlign: "center", fontFamily: sans, fontWeight: 900, fontSize: 38, letterSpacing: 2, color: theme.text, textTransform: "uppercase" }}>{v.foot}</div> : null}
    </>
  );
};

const Bars: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const n = v.items.length, max = v.max || Math.max(...v.items.map((x: any) => x.value));
  const bw = Math.min(260, 1300 / n - 30), x0 = (1920 - n * (bw + 30)) / 2;
  return (
    <>
      {v.title ? <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: cond, fontSize: 90, color: theme.accent_word, textTransform: "uppercase" }}>{v.title}</div> : null}
      {v.items.map((it: any, i: number) => {
        const p = pg(t, cue(v, i, 0.5 + i * 0.7), 0.7);
        const h = (it.value / max) * 480 * p;
        return (
          <div key={i} style={{ position: "absolute", left: x0 + i * (bw + 30), width: bw, top: 230, height: 700 }}>
            <div style={{ position: "absolute", bottom: 90, left: 0, width: bw, height: h, background: it.hot ? theme.accent_word : theme.circle, border: `4px solid ${theme.outline}` }} />
            <div style={{ position: "absolute", bottom: 90 + h + 8, left: 0, width: bw, textAlign: "center", fontFamily: cond, fontSize: 84, color: it.hot ? theme.accent_word : theme.text, opacity: clamp(p) }}>{it.display ?? it.value}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, width: bw, textAlign: "center", fontFamily: sans, fontWeight: 900, fontSize: 32, letterSpacing: 1, color: theme.text, textTransform: "uppercase" }}>{it.label}</div>
          </div>
        );
      })}
    </>
  );
};

const Cards: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const n = v.items.length, w = 440, gap = 40, x0 = (1920 - (n * w + (n - 1) * gap)) / 2;
  return (
    <>
      {v.items.map((it: any, i: number) => {
        const p = pop(t, cue(v, i, 0.5 + i * 1.0));
        return (
          <div key={i} style={{ position: "absolute", left: x0 + i * (w + gap), top: 130, width: w, textAlign: "center", transform: `translateY(${(1 - clamp(p)) * 180}px) scale(${clamp(p, 0, 1.05)})`, opacity: clamp(p) }}>
            {it.img ? <div style={{ display: "flex", justifyContent: "center" }}><Person img={it.img} d={w - 60} /></div> : null}
            <div style={{ marginTop: 26, display: "inline-block" }}><Tag value={it.value} label={it.label} size={92} tilt={(i - (n - 1) / 2) * 3} hot={!!it.hot} /></div>
            {it.sub ? <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 30, letterSpacing: 2, color: theme.text, marginTop: 20, textTransform: "uppercase" }}>{it.sub}</div> : null}
          </div>
        );
      })}
    </>
  );
};

/* real licensed footage in a framed panel; the label says exactly what the clip is and when it was filmed */
const Footage: React.FC<{ v: any }> = ({ v }) => {
  const { theme, footage } = useCtx(); const t = useT(); const { fps } = useVideoConfig();
  const clip = footage[v.clip];
  if (!clip) return null;
  const portrait = clip.h > clip.w;
  const H = portrait ? 790 : 664, W = portrait ? Math.round((790 * clip.w) / clip.h) : 1180;
  const left = portrait ? 220 : 150, top = portrait ? 110 : 150;
  const a = pop(t, 0.1), b = pop(t, cue(v, 0, 1.2)), c = pop(t, cue(v, 1, 2.4));
  const colX = left + W + 90;
  return (
    <>
      <div style={{ position: "absolute", left, top, width: W, height: H, border: `8px solid ${theme.outline}`, boxShadow: `14px 16px 0 ${shade(theme.black, 55)}`, overflow: "hidden", background: theme.black, transform: `scale(${clamp(a, 0, 1.03)}) rotate(${portrait ? -1.2 : -0.8}deg)`, opacity: clamp(a) }}>
        <Loop durationInFrames={Math.max(1, Math.floor(clip.dur * fps))}>
          <OffthreadVideo src={staticFile(clip.file)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Loop>
      </div>
      <div style={{ position: "absolute", left: colX, top: top + 20, right: 80, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 34 }}>
        {v.tag ? <div style={{ transform: `scale(${clamp(b, 0, 1.1)})`, transformOrigin: "left center" }}><Tag value={v.tag.value} label={v.tag.label} size={portrait ? 120 : 84} tilt={2} hot /></div> : null}
        <div style={{ transform: `scale(${clamp(c, 0, 1.05)})`, transformOrigin: "left center", background: theme.card, color: theme.card_ink, border: `3px solid ${theme.card_ink}`, boxShadow: `6px 8px 0 ${shade(theme.black, 45)}`, padding: "16px 22px", maxWidth: portrait ? 760 : 420 }}>
          <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 22, letterSpacing: 3, color: theme.red, textTransform: "uppercase" }}>{clip.archive ? "Archive footage" : "Footage"}</div>
          <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 30, lineHeight: 1.15, marginTop: 4 }}>{clip.label}</div>
        </div>
      </div>
    </>
  );
};

const VISUALS: Record<string, React.FC<{ v: any }>> = {
  versus: Versus, timeline: Timeline, clock: Clock, headlines: Headlines, quote: Quote, dots: Dots, coins: Coins, faces: Faces, ladder: Ladder,
  ranking: Ranking, ruler: Ruler, ballot: Ballot, cutout: CutoutScene, cards3: Cards3, tiles: Tiles, table: Table, bigstat: BigStat, results: Results, bars: Bars, cards: Cards, footage: Footage,
};

/* ---------- shell: ground, captions, credit ---------- */
const collectImgs = (v: any, out = new Set<string>()): Set<string> => {
  if (!v || typeof v !== "object") return out;
  if (Array.isArray(v)) { v.forEach((x) => (typeof x === "string" ? null : collectImgs(x, out))); return out; }
  for (const [k, val] of Object.entries(v)) {
    if (k === "img" && typeof val === "string") out.add(val);
    else if (k === "imgs" && Array.isArray(val)) (val as string[]).forEach((x) => out.add(x));
    else if (val && typeof val === "object") collectImgs(val, out);
  }
  return out;
};

const Captions: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme } = useCtx(); const t = useT();
  const words: any[] = scene.words || [];
  const acc = new Set((scene.accent || []).map((a: string) => norm(a)));
  if (!words.length) return null;
  const chunks: any[][] = [];
  let cur: any[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= 5 || /[.?!]$/.test(w.w)) { chunks.push(cur); cur = []; }
    else if (/[,;:]$/.test(w.w) && cur.length >= 3) { chunks.push(cur); cur = []; }
  }
  if (cur.length) chunks.push(cur);
  const off = scene.speechStart - scene.t0;
  const tt = t - off;
  let active = chunks[0];
  for (const ch of chunks) if (tt >= ch[0].t0 - 0.05) active = ch;
  if (tt < -0.2) return null;
  return (
    <div style={{ position: "absolute", left: 140, right: 140, bottom: 62, textAlign: "center", fontFamily: sans, fontWeight: 900, fontSize: 46, letterSpacing: 2, textTransform: "uppercase", color: theme.text, textShadow: `0 3px 0 ${shade(theme.black, 70)}, 0 0 18px ${shade(theme.black, 60)}` }}>
      {active.map((w: any, i: number) => <span key={i} style={{ color: acc.has(norm(w.w)) ? theme.accent_word : theme.text }}>{w.w}{i < active.length - 1 ? " " : ""}</span>)}
    </div>
  );
};

const SceneShell: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, images, footage } = useCtx();
  const t = useT();
  const V = VISUALS[scene.visual.type];
  const imgs = [...collectImgs(scene.visual)];
  const credit = [...new Set(imgs.map((i) => images[i]?.credit).filter(Boolean))].join("  ·  ");
  const clipCredit = scene.visual.clip && footage[scene.visual.clip] ? footage[scene.visual.clip].credit : "";
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${theme.bg} 0%, ${theme.bg} 45%, ${theme.bg_dark} 100%)`, opacity: ease(t / 0.25) }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${shade(theme.halftone, 90)} 2.2px, transparent 2.8px)`, backgroundSize: "15px 15px", WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, transparent 25%, black 100%)", maskImage: "radial-gradient(ellipse at 50% 45%, transparent 25%, black 100%)" }} />
      <div style={{ position: "absolute", left: 40, top: 32, width: 70, height: 70, borderRadius: 70, background: theme.card, border: `4px solid ${theme.card_ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: cond, fontSize: 36, color: theme.card_ink }}>RL</div>
      {V ? <V v={scene.visual} /> : null}
      {credit ? <div style={{ position: "absolute", right: 36, top: 36, maxWidth: 900, textAlign: "right", fontFamily: sans, fontWeight: 500, fontSize: 18, color: theme.text, opacity: 0.6 }}>Photo: {credit}</div> : null}
      {clipCredit ? <div style={{ position: "absolute", right: 36, top: 36, maxWidth: 900, textAlign: "right", fontFamily: sans, fontWeight: 500, fontSize: 18, color: theme.text, opacity: 0.6 }}>Video: {clipCredit}</div> : null}
      <Captions scene={scene} />
    </AbsoluteFill>
  );
};

export const RealmEpisode: React.FC<any> = ({ theme, scenes, images, footage, audioSrc, fps }) => (
  <C.Provider value={{ theme, images, footage: footage || {} }}>
    <AbsoluteFill style={{ background: theme.bg_dark }}>
      {scenes.map((s: any) => (
        <Sequence key={s.id} from={Math.round(s.t0 * fps)} durationInFrames={Math.max(1, Math.round((s.t1 - s.t0) * fps))}>
          <SceneShell scene={s} />
        </Sequence>
      ))}
      {audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
    </AbsoluteFill>
  </C.Provider>
);
