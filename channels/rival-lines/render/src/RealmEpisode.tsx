import React, { createContext, useContext } from "react";
import { AbsoluteFill, Audio, Img, Loop, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";
import { loadFont as loadCond } from "@remotion/google-fonts/Anton";

// The Football Realm look, read from 60 frames of one of its videos (data/rival-lines/paperpitch-footballrealm-reference-study.md):
// about 60% of the screen time is real footage (press conferences, interviews, wide match play) under small white uppercase word
// captions, with a source lowerthird at top left and, now and then, a larger mixed-case caption with one orange italic word. The
// rest is a few maroon graphics: a person cut out on a salmon circle, a person on a drawn crowd-and-pitch strip, three photo cards
// with tags, and a short logo sting. Every colour comes from props.theme (channels.json realm_colors).
// Footage is third-party YouTube video, trimmed to a few seconds, muted, with narration commenting over it and the owner named on
// screen (see the footage gate in scripts/gate-realm.mjs). Photos are Wikimedia Commons files with their credit shown on screen.
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

const outline = (c: string, k = 3) => `drop-shadow(${k}px 0 0 ${c}) drop-shadow(-${k}px 0 0 ${c}) drop-shadow(0 ${k}px 0 ${c}) drop-shadow(0 -${k}px 0 ${c})`;

/* a person cut out of the photo, set in the circle; the head may rise above the circle edge, the body is cut at its base */
const Person: React.FC<{ img: string; d: number; ring?: boolean; lift?: number; style?: React.CSSProperties }> = ({ img, d, ring = true, lift = 1.12, style }) => {
  const { theme } = useCtx();
  return (
    <div style={{ position: "relative", width: d, height: d, ...style }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: d, background: theme.circle }} />
      <div style={{ position: "absolute", left: -d * 0.25, right: -d * 0.25, top: -d * 0.45, bottom: 0, clipPath: `inset(0 0 0 0)`, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", borderRadius: `0 0 ${d}px ${d}px` }}>
        <Img src={staticFile(`ep/images/cutout-${img}.png`)} style={{ height: d * lift, maxWidth: d * 1.45, width: "auto", objectFit: "contain", objectPosition: "center bottom", filter: ring ? outline(theme.outline, 3) : undefined }} />
      </div>
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

const TagPop: React.FC<{ v: any }> = ({ v }) => {
  const t = useT();
  const p = pop(t, v.cue ?? 1.0);
  return (
    <div style={{ position: "absolute", left: v.left, right: v.right, top: v.top ?? 90, transform: `scale(${clamp(p, 0, 1.08)})`, opacity: clamp(p) }}>
      <Tag value={v.value} label={v.label} size={v.size ?? 84} tilt={v.tilt ?? 2} hot={v.hot !== false} />
    </div>
  );
};

/* a large mixed-case caption; text between *stars* is the orange italic word; "|" breaks a line */
const BigCap: React.FC<{ v: any; at: number }> = ({ v, at }) => {
  const { theme } = useCtx(); const t = useT();
  if (!v) return null;
  const p = pop(t, v.cue ?? at, 0.35);
  if (p <= 0.01) return null;
  const left = v.pos !== "center";
  const x = v.pos === "right" ? 1000 : 110;
  return (
    <div style={{ position: "absolute", left: left ? x : 0, right: left ? undefined : 0, top: v.top ?? 380, textAlign: left ? "left" : "center", transform: `scale(${clamp(p, 0, 1.04)})`, transformOrigin: left ? "left center" : "center", opacity: clamp(p), textShadow: `0 3px 14px ${shade(theme.black, 85)}, 0 0 34px ${shade(theme.black, 80)}` }}>
      {String(v.text).split("|").map((ln, i) => (
        <div key={i} style={{ fontFamily: sans, fontWeight: 900, fontSize: v.size ?? 78, lineHeight: 1.08, color: theme.white }}>
          {ln.split(/(\*[^*]+\*)/).map((part, j) => (part.startsWith("*") ? <span key={j} style={{ color: theme.circle, fontStyle: "italic" }}>{part.slice(1, -1)}</span> : <span key={j}>{part}</span>))}
        </div>
      ))}
      {v.src ? <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 28, color: theme.white, opacity: 0.85, marginTop: 10 }}>{v.src}</div> : null}
    </div>
  );
};

/* ---------- the footage scene: full-bleed muted clips, a slow push-in, a source lowerthird ---------- */
const Lower: React.FC<{ clip: any; t: number; hold?: boolean }> = ({ clip, t, hold }) => {
  const { theme } = useCtx();
  if (!clip.lower_name) return null;
  const a = pg(t, 0.25, 0.4) * (hold ? 1 : 1 - pg(t, 3.4, 0.4));
  if (a <= 0.01) return null;
  return (
    <div style={{ position: "absolute", left: 56, top: 44, display: "flex", gap: 14, opacity: a, transform: `translateX(${(1 - a) * -24}px)` }}>
      <div style={{ width: 6, background: theme.circle, borderRadius: 3 }} />
      <div style={{ textShadow: `0 2px 10px ${shade(theme.black, 80)}` }}>
        <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 36, color: theme.white }}>{clip.lower_name}</div>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 25, color: theme.white, opacity: 0.88, marginTop: 2 }}>{clip.lower_sub}</div>
      </div>
    </div>
  );
};

const ClipShot: React.FC<{ id: string; len: number; k: number }> = ({ id, len, k }) => {
  const { footage, theme } = useCtx(); const t = useT(); const { fps } = useVideoConfig();
  const [cid, st] = id.split("@");
  const start = st ? Number(st) : 0;
  const clip = footage[cid];
  if (!clip) return null;
  const z = 1 + 0.06 * clamp(t / Math.max(0.5, len));
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: theme.black }}>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: k % 2 ? "35% 55%" : "62% 45%" }}>
        <Loop durationInFrames={Math.max(1, Math.floor((clip.dur - start) * fps))}>
          <OffthreadVideo src={staticFile(clip.file)} trimBefore={Math.round(start * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Loop>
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${shade(theme.black, 72)} 0%, ${shade(theme.black, 38)} 40%, transparent 68%)` }} />
      <Lower clip={clip} t={t} />
    </AbsoluteFill>
  );
};

const ClipScene: React.FC<{ v: any; dur: number }> = ({ v, dur }) => {
  const { fps } = useVideoConfig();
  const n = v.shots.length, each = dur / n;
  return (
    <>
      {v.shots.map((id: string, i: number) => (
        <Sequence key={i} from={Math.round(i * each * fps)} durationInFrames={Math.max(1, Math.round(each * fps))}>
          <ClipShot id={id} len={each} k={i} />
        </Sequence>
      ))}
      <BigCap v={v.bigcap} at={0.6} />
      {v.tag ? <TagPop v={v.tag} /> : null}
    </>
  );
};

/* ---------- graphics, kept to what the reference uses ---------- */
const Ground: React.FC<{ photo?: string }> = ({ photo }) => {
  const { theme } = useCtx();
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 42%, ${theme.bg} 0%, ${theme.bg} 45%, ${theme.bg_dark} 100%)` }} />
      {photo ? <Img src={staticFile(`ep/images/cutout-${photo}.png`)} style={{ position: "absolute", right: 60, top: -60, height: 1300, width: "auto", filter: "blur(22px)", opacity: 0.32 }} /> : null}
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${shade(theme.halftone, 90)} 2.2px, transparent 2.8px)`, backgroundSize: "15px 15px", WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, transparent 25%, black 100%)", maskImage: "radial-gradient(ellipse at 50% 45%, transparent 25%, black 100%)" }} />
    </>
  );
};

/* a person on a salmon circle, with an optional price tag and a big caption; two people sit side by side */
const CircleScene: React.FC<{ v: any }> = ({ v }) => {
  const t = useT();
  const two = Array.isArray(v.imgs) && v.imgs.length > 1;
  const a = pop(t, 0.1, 0.55), b = pop(t, 0.4, 0.55);
  return (
    <AbsoluteFill>
      <Ground photo={v.img || v.imgs?.[0]} />
      {two ? (
        <>
          <div style={{ position: "absolute", left: 300, top: 200, transform: `translateY(${(1 - ease(a)) * 240}px)`, opacity: clamp(a) }}><Person img={v.imgs[0]} d={520} /></div>
          <div style={{ position: "absolute", left: 960, top: 270, transform: `translateY(${(1 - ease(b)) * 240}px)`, opacity: clamp(b) }}><Person img={v.imgs[1]} d={520} /></div>
        </>
      ) : (
        <div style={{ position: "absolute", left: v.side === "left" ? 190 : 1010, top: 130, transform: `translateY(${(1 - ease(a)) * 260}px)`, opacity: clamp(a) }}><Person img={v.img} d={640} /></div>
      )}
      {v.bigcap ? <BigCap v={{ ...v.bigcap, pos: v.bigcap.pos ?? (v.side === "left" ? "right" : "left") }} at={0.8} /> : null}
      {v.tag ? <TagPop v={{ ...v.tag, left: v.tag.left, right: v.tag.right ?? (two ? 140 : v.side === "left" ? undefined : 150), top: v.tag.top ?? 150, size: v.tag.size ?? 110 }} /> : null}
    </AbsoluteFill>
  );
};

/* heavy white text lines that pop in on cues; *stars* mark the orange italic word */
const TextBlock: React.FC<{ lines: string[]; cues?: number[]; style: React.CSSProperties; size?: number; align?: "left" | "center" }> = ({ lines, cues, style, size = 84, align = "left" }) => {
  const { theme } = useCtx(); const t = useT();
  return (
    <div style={{ textAlign: align, ...style }}>
      {lines.map((ln, i) => {
        const p = pop(t, cues && cues[i] != null ? cues[i] : 0.5 + i * 0.5, 0.35);
        return (
          <div key={i} style={{ fontFamily: sans, fontWeight: 900, fontSize: size, lineHeight: 1.1, color: theme.white, marginBottom: 14, transform: `scale(${clamp(p, 0, 1.04)})`, transformOrigin: align === "left" ? "left center" : "center", opacity: clamp(p), textShadow: `0 3px 14px ${shade(theme.black, 70)}` }}>
            {ln.split(/(\*[^*]+\*)/).map((part, j) => (part.startsWith("*") ? <span key={j} style={{ color: theme.circle, fontStyle: "italic" }}>{part.slice(1, -1)}</span> : <span key={j}>{part}</span>))}
          </div>
        );
      })}
    </div>
  );
};

/* one or two people cut out at natural size on the maroon ground, a block of lines beside (or between) them */
const PlainScene: React.FC<{ v: any }> = ({ v }) => {
  const t = useT();
  const imgs: string[] = v.imgs || [v.img];
  const two = imgs.length > 1;
  const a = pop(t, 0.1, 0.6);
  const h0 = two ? 860 : 980;
  return (
    <AbsoluteFill>
      <Ground />
      {imgs.map((im, i) => {
        const onLeft = two ? i === 0 : v.side === "left";
        const p = i === 0 ? a : pop(t, 0.4, 0.6);
        const h = v.heights?.[i] ?? h0;
        return (
          <div key={i} style={{ position: "absolute", bottom: 0, [onLeft ? "left" : "right"]: two ? 40 : 130, height: h, display: "flex", alignItems: "flex-end", transform: `translateY(${(1 - ease(p)) * 260}px)`, opacity: clamp(p) }}>
            <Img src={staticFile(`ep/images/cutout-${im}.png`)} style={{ height: h, width: "auto", maxWidth: 760, objectFit: "contain", objectPosition: "center bottom" }} />
          </div>
        );
      })}
      <TextBlock lines={v.lines || []} cues={v.cues} size={v.size ?? (two ? 84 : 92)} align={two ? "center" : "left"} style={two ? { position: "absolute", left: 640, width: 640, top: 280 } : { position: "absolute", left: v.side === "left" ? 880 : 130, width: 900, top: 330 }} />
    </AbsoluteFill>
  );
};

/* the opening quote: the subject's own words with real sound, big mixed-case subtitles, source label at top left */
const QuoteScene: React.FC<{ v: any; dur: number }> = ({ v }) => {
  const { footage, theme } = useCtx(); const t = useT();
  const clip = footage[v.clip];
  if (!clip) return null;
  const words: any[] = clip.words || [];
  const emph = new Set((clip.emph || []).map((e: string) => norm(e)));
  const clauses: any[][] = [];
  let cur: any[] = [];
  for (const w of words) { cur.push(w); if (/[,.?!]$/.test(w.w)) { clauses.push(cur); cur = []; } }
  if (cur.length) clauses.push(cur);
  let active: any[] | null = null;
  for (const c of clauses) if (t >= c[0].t0 - 0.08) active = c;
  const half = active ? Math.ceil(active.length / 2) : 0;
  const lines = active ? [active.slice(0, half), active.slice(half)] : [];
  const z = 1 + 0.04 * clamp(t / 4);
  return (
    <AbsoluteFill style={{ background: theme.black, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: "50% 40%" }}>
        <OffthreadVideo src={staticFile(clip.file)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${shade(theme.black, 80)} 0%, ${shade(theme.black, 40)} 30%, transparent 55%)` }} />
      <Lower clip={clip} t={t} hold />
      <div style={{ position: "absolute", left: 160, right: 160, bottom: 90, textAlign: "center", fontFamily: sans, fontWeight: 900, fontSize: 74, lineHeight: 1.12, color: theme.white, textShadow: `0 3px 14px ${shade(theme.black, 85)}, 0 0 34px ${shade(theme.black, 70)}` }}>
        {lines.map((ln, i) => (
          <div key={i}>
            {ln.map((w: any, j: number) => <span key={j} style={emph.has(norm(w.w)) ? { color: theme.circle, fontStyle: "italic" } : undefined}>{w.w}{j < ln.length - 1 ? " " : ""}</span>)}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* a score card on the maroon ground: the two names and the score build up on the narration's cues (no club crests: none are on Wikimedia Commons) */
const ScoreScene: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const [c0, c1, c2] = [cue(v, 0, 0.4), cue(v, 1, 1.4), cue(v, 2, 2.4)];
  const name = (txt: string, at: number, side: "left" | "right") => {
    const p = pop(t, at, 0.45);
    return (
      <div style={{ position: "absolute", top: 200, [side]: 90, width: 700, textAlign: "center", fontFamily: cond, fontSize: 130, lineHeight: 1, color: theme.white, textTransform: "uppercase", transform: `scale(${clamp(p, 0, 1.05)})`, opacity: clamp(p), textShadow: `0 6px 0 ${shade(theme.black, 55)}` }}>{txt}</div>
    );
  };
  const ps = pop(t, c1, 0.5);
  return (
    <AbsoluteFill>
      <Ground />
      {name(v.away, c0, "right")}
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: cond, fontSize: 320, lineHeight: 1, color: theme.circle, transform: `scale(${clamp(ps, 0, 1.06)})`, opacity: clamp(ps), textShadow: `0 10px 0 ${shade(theme.black, 55)}` }}>{v.hs}<span style={{ color: theme.white }}>–</span>{v.as}</div>
      {name(v.home, c2, "left")}
    </AbsoluteFill>
  );
};

/* a person on a drawn crowd-and-pitch strip, with up to a few text blocks */
const StripScene: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const a = pop(t, 0.1, 0.55);
  const left = v.side === "left";
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="seat" width={34} height={30} patternUnits="userSpaceOnUse">
            <path d="M3 28 L17 4 L31 28 Z" fill={theme.text} opacity={0.82} />
          </pattern>
        </defs>
        <rect width={1920} height={1080} fill={theme.red} />
        <rect width={1920} height={640} fill="url(#seat)" />
        <rect y={640} width={1920} height={440} fill={theme.pitch} />
        {Array.from({ length: 6 }, (_, i) => <rect key={i} x={i * 330 - 80} y={640} width={165} height={440} fill={theme.pitch_dark} opacity={0.5} />)}
        <rect y={630} width={1920} height={12} fill={theme.white} />
      </svg>
      <div style={{ position: "absolute", left: left ? 120 : 1000, bottom: 0, height: 1000, display: "flex", alignItems: "flex-end", transform: `translateY(${(1 - ease(a)) * 300}px)`, opacity: clamp(a) }}>
        <Img src={staticFile(`ep/images/cutout-${v.img}.png`)} style={{ height: 1000, width: "auto", filter: outline(theme.black, 3) }} />
      </div>
      {v.lines ? <TextBlock lines={v.lines} cues={v.cues} style={{ position: "absolute", left: left ? 840 : 120, top: 200, width: 960 }} size={78} /> : null}
      {v.tag ? <TagPop v={{ ...v.tag, left: v.tag.left, right: v.tag.right ?? (left ? 140 : undefined), top: v.tag.top ?? 90 }} /> : null}
    </AbsoluteFill>
  );
};

/* three photo cards: a small kicker over each, a price-tag figure on it */
const TrioScene: React.FC<{ v: any }> = ({ v }) => {
  const { theme } = useCtx(); const t = useT();
  const n = v.items.length, w = 440, gap = 70, x0 = (1920 - (n * w + (n - 1) * gap)) / 2;
  return (
    <AbsoluteFill>
      <Ground />
      {v.items.map((it: any, i: number) => {
        const p = pop(t, cue(v, i, 0.4 + i * 0.7), 0.45);
        return (
          <div key={i} style={{ position: "absolute", left: x0 + i * (w + gap), top: 110, width: w, textAlign: "center", transform: `translateY(${(1 - clamp(p)) * 200}px)`, opacity: clamp(p) }}>
            <div style={{ fontFamily: sans, fontWeight: 900, fontSize: 38, letterSpacing: 2, color: theme.text, textTransform: "uppercase", background: theme.bg_dark, display: "inline-block", padding: "6px 18px" }}>{it.kicker}</div>
            <div style={{ position: "relative", marginTop: 10, height: 680, background: theme.circle, border: `6px solid ${theme.card}`, boxShadow: `10px 12px 0 ${shade(theme.black, 45)}`, overflow: "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <Img src={staticFile(`ep/images/cutout-${it.img}.png`)} style={{ height: 660, width: "auto", maxWidth: "100%", objectFit: "contain", objectPosition: "center bottom" }} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", transform: `scale(${clamp(p, 0, 1.1)})` }}><Tag value={it.value} label={it.label} size={80} tilt={(i - (n - 1) / 2) * 3} hot={!!it.hot} /></div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* the short black logo sting over the first moments of a scene */
const Sting: React.FC<{ t: number }> = ({ t }) => {
  const { theme } = useCtx();
  if (t > 1.45) return null;
  const a = 1 - pg(t, 1.1, 0.3);
  const p = pop(t, 0.1, 0.4);
  return (
    <AbsoluteFill style={{ background: theme.black, opacity: a, alignItems: "center", justifyContent: "center", display: "flex" }}>
      <div style={{ transform: `scale(${clamp(p, 0, 1.05)})`, border: `14px solid ${theme.outline}`, borderBottom: "none", padding: "20px 60px 0", fontFamily: cond, fontSize: 280, lineHeight: 1, color: theme.white, textTransform: "lowercase" }}>rl</div>
    </AbsoluteFill>
  );
};

/* a run of scenes inside one beat: each part starts at its "at" second (the plan resolves "from" words to seconds) */
const shiftCues = (v: any, at: number): any => {
  if (Array.isArray(v)) return v.map((x) => shiftCues(x, at));
  if (v && typeof v === "object") {
    const o: any = {};
    for (const [k, val] of Object.entries(v)) o[k] = k === "cue" && typeof val === "number" ? val - at : k === "cues" && Array.isArray(val) ? (val as number[]).map((c) => c - at) : shiftCues(val, at);
    return o;
  }
  return v;
};

const SeqScene: React.FC<{ v: any; dur: number }> = ({ v, dur }) => {
  const { fps } = useVideoConfig();
  const n = v.parts.length;
  const starts: number[] = v.parts.map((p: any, i: number) => (typeof p.at === "number" ? p.at : (dur * i) / n));
  return (
    <>
      {v.parts.map((p: any, i: number) => {
        const end = i + 1 < n ? starts[i + 1] : dur;
        return (
          <Sequence key={i} from={Math.round(starts[i] * fps)} durationInFrames={Math.max(1, Math.round((end - starts[i]) * fps))}>
            <AbsoluteFill style={{ background: "inherit" }}>{renderVisual(shiftCues(p, starts[i]), end - starts[i])}</AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};

const renderVisual = (v: any, dur: number) =>
  v.type === "clip" ? <ClipScene v={v} dur={dur} /> : v.type === "quote" ? <QuoteScene v={v} dur={dur} /> : v.type === "score" ? <ScoreScene v={v} /> : v.type === "plain" ? <PlainScene v={v} /> : v.type === "circle" ? <CircleScene v={v} /> : v.type === "strip" ? <StripScene v={v} /> : v.type === "trio" ? <TrioScene v={v} /> : v.type === "seq" ? <SeqScene v={v} dur={dur} /> : null;

/* ---------- shell: small word captions, photo credit, sting ---------- */
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
  const tt = t - (scene.speechStart - scene.t0);
  if (tt < -0.2) return null;
  let active = chunks[0];
  for (const ch of chunks) if (tt >= ch[0].t0 - 0.05) active = ch;
  return (
    <div style={{ position: "absolute", left: 200, right: 200, bottom: 48, textAlign: "center", fontFamily: sans, fontWeight: 900, fontSize: 36, letterSpacing: 1.5, textTransform: "uppercase", color: theme.white, textShadow: `0 2px 0 ${shade(theme.black, 80)}, 0 0 14px ${shade(theme.black, 70)}` }}>
      {active.map((w: any, i: number) => <span key={i} style={{ color: acc.has(norm(w.w)) ? theme.circle : theme.white }}>{w.w}{i < active.length - 1 ? " " : ""}</span>)}
    </div>
  );
};

const SceneShell: React.FC<{ scene: any }> = ({ scene }) => {
  const { theme, images } = useCtx();
  const t = useT();
  const v = scene.visual;
  const dur = scene.t1 - scene.t0;
  const credit = [...new Set([...collectImgs(v)].map((i) => images[i]?.credit).filter(Boolean))].join("  ·  ");
  return (
    <AbsoluteFill style={{ background: theme.bg_dark }}>
      {renderVisual(v, dur)}
      {credit ? <div style={{ position: "absolute", right: 36, top: 24, maxWidth: 900, textAlign: "right", fontFamily: sans, fontWeight: 500, fontSize: 17, color: theme.white, opacity: 0.55 }}>Photo: {credit}</div> : null}
      <Captions scene={scene} />
      {v.sting ? <Sting t={t} /> : null}
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
