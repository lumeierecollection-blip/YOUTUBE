// "SX" Shorts kit (1080x1920, 30 fps), measured frame by frame from two reference Shorts (channel-reverse/reports/shorts-study-2026-11-19.md,
// flash analysis in channel-reverse/uploads-1119): every state is held for 2-3 frames (motion steps "on threes", never smooth), a new picture every
// 0.3-0.6 s, glitch frames (inverted, posterised, colour-split) before a key word, key words revealed letter by letter out of order inside a highlighter
// bar that flips blue/yellow while the ground flips black/paper, 1-frame black bars, ink-brush strokes behind key words, framed inset pictures on grey
// grain paper, mixed-size serif-italic + bold-sans captions (style "v1"); real photographs with a centred name, split photos sliding in, giant years,
// a white page with one italic word, real article captures with a highlighter sweep, counting bars, a comment CTA (style "v3").
// Everything comes from props built by platform/shorts-sx/build.mjs (word timings from faster-whisper on our own narration). Their art is not used.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { F, Fonts } from "../lf2/kit.jsx";

const SERIF = F.display, SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';
const src = (p) => (p && (p.startsWith("http") || p.startsWith("data:")) ? p : staticFile(p));
const step = (f, n = 3) => f - (f % n);                     // motion "on threes", as measured (median hold 3 frames)
const PAPER = "#E2E2E0", BLUE = "#1F2BD6", YELLOW = "#E9F25A", TEAL = "#38D9C0", RED = "#D9302C";

function Grain({ f, o = 0.12 }) {
  return <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: o, mixBlendMode: "multiply", pointerEvents: "none" }}>
    <filter id={`sg${step(f) % 4}`}><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed={step(f) % 4} /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="1080" height="1920" filter={`url(#sg${step(f) % 4})`} />
  </svg>;
}
const Media = ({ s, style, ss = 0 }) => s.video
  ? <OffthreadVideo src={src(s.video)} muted startFrom={Math.round(ss * 30)} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />
  : <Img src={src(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.pos || "50% 40%", ...style }} />;

/** The picture layer of one shot. l = local frame. */
function Plate({ s, l, ground, calm }) {
  // calm (owner, 19 Nov 2026: "too flashy... moving too quickly"): smooth slow push, no glitch frames
  const z = calm ? 1 + 0.0012 * l : 1 + 0.004 * step(l), g = !calm && s.glitch && l < 3;
  const fx = g ? { filter: "invert(1) grayscale(1) contrast(3.5)" } : {};
  const ins = (w, top) => ({ position: "absolute", left: (1080 - w) / 2, top, width: w, height: w * (s.ratio || 0.75), background: "#fff", padding: s.mat ? 14 : 0, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" });
  if (s.kind === "inset") return <AbsoluteFill style={{ background: ground }}>
    <div style={{ ...ins(s.w || 760, s.top || 560), transform: `scale(${z})`, ...fx }}><div style={{ width: "100%", height: "100%", overflow: "hidden", outline: s.mat ? "3px solid #111" : "none", outlineOffset: -6 }}><Media s={s} ss={s.ss} /></div></div>
    {g && <div style={{ ...ins(s.w || 760, s.top || 560), mixBlendMode: "screen", transform: "translateX(14px)", background: "rgba(255,0,90,0.35)" }} />}
    {s.label && <div style={{ position: "absolute", left: 60, right: 60, top: (s.top || 560) + (s.w || 760) * (s.ratio || 0.75) + 40, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 40, color: "#1a1a1a", opacity: Math.min(1, l / 8) }}>{s.label}</div>}   {/* who or what the photo shows (owner: people must be visibly named) */}
  </AbsoluteFill>;
  if (s.kind === "full" || s.kind === "year") return <AbsoluteFill style={{ background: "#000", ...fx }}>
    <div style={{ position: "absolute", inset: 0, transform: `scale(${z})` }}><Media s={s} ss={s.ss} style={s.kind === "year" || (s.sil && l < 4) ? { filter: "brightness(0.55)" } : {}} /></div>
    {/* v3 reference: the person's cut-out flashes as a flat white silhouette for ~4 frames before the photo shows (frames 12.75 s, 16.25 s) */}
    {s.sil && l < 4 && <Img src={src(s.sil)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: s.pos || "50% 40%", filter: "brightness(0) invert(1)" }} />}
    {s.kind === "year" && <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 330, color: "#fff", letterSpacing: -12, textShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>{s.year}</div>}
  </AbsoluteFill>;
  // v3 reference: a full-frame brand card, the wordmark in white on the brand colour (Anthropic card measured #DD7354 at 15.6 s)
  if (s.kind === "brand") { const k = Math.min(1, step(l) / 6); return <AbsoluteFill style={{ background: s.bg || "#111", display: "flex", alignItems: "center", justifyContent: "center", ...fx }}>
    <Img src={src(s.img)} style={{ width: s.lw || 820, maxHeight: 360, objectFit: "contain", filter: "brightness(0) invert(1)", transform: `scale(${0.94 + 0.06 * k})` }} /></AbsoluteFill>; }
  // v1 reference: pictures (photos, logos, page captures, cut-outs) pile up one every 3 frames on the paper, each slightly offset ("plan", "a team from Google")
  if (s.kind === "collage") return <AbsoluteFill style={{ background: ground }}>
    {(s.items || []).filter((_, i) => step(l) >= i * 3).map((it, i) => <div key={i} style={{ position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h || it.w * 0.72, background: it.cut || it.logo ? "transparent" : "#fff", padding: it.cut || it.logo ? 0 : 10, boxShadow: it.cut ? "none" : "0 8px 26px rgba(0,0,0,0.2)", transform: `rotate(${it.rot || 0}deg) scale(${z})`, filter: it.cut ? "drop-shadow(0 10px 18px rgba(0,0,0,0.3))" : "none" }}>
      {it.logo ? <div style={{ width: "100%", height: "100%", background: it.tile ? "#0d0d0d" : "#fff", borderRadius: it.tile ? 40 : 6, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 26px rgba(0,0,0,0.2)" }}><Img src={src(it.img)} style={{ maxWidth: "74%", maxHeight: "74%", objectFit: "contain", filter: it.tile ? it.lf || "invert(1)" : "none" }} /></div>
        : <div style={{ width: "100%", height: "100%", overflow: "hidden" }}><Media s={it} style={it.cut ? { objectFit: "contain" } : it.top ? { objectPosition: "50% 0%" } : {}} /></div>}
    </div>)}</AbsoluteFill>;
  // a background-removed photo standing on the paper ground (cut-out), steps up on threes
  if (s.kind === "cutout") return <AbsoluteFill style={{ background: ground }}>
    <Img src={src(s.img)} style={{ position: "absolute", left: 90, right: 90, bottom: s.bottom ?? 0, width: 900, height: s.h || 1150, objectFit: "contain", objectPosition: "50% 100%", transform: `scale(${z})`, transformOrigin: "50% 100%", filter: "drop-shadow(0 16px 30px rgba(0,0,0,0.28))", ...fx }} /></AbsoluteFill>;
  if (s.kind === "split") { const k = interpolate(step(l), [0, 9], [0, 1], { extrapolateRight: "clamp" }); return <AbsoluteFill style={{ background: "#000" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080 - 520 * k, height: 1920, overflow: "hidden" }}><Media s={{ img: s.img, pos: s.pos }} /></div>
    <div style={{ position: "absolute", left: 1080 - 520 * k, top: 0, width: 540, height: 1920, overflow: "hidden" }}><Media s={{ img: s.img2, pos: s.pos2 }} /></div>
    {s.lab1 && <div style={{ position: "absolute", left: 0, width: 540, top: 1480, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 40, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)", opacity: k }}>{s.lab1}</div>}
    {s.lab2 && <div style={{ position: "absolute", left: 540, width: 540, top: 1480, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 40, color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.7)", opacity: k }}>{s.lab2}</div>}
  </AbsoluteFill>; }
  if (s.kind === "page") return <AbsoluteFill style={{ background: "#F7F7F5" }}><div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 92, color: "#111" }}>{s.page}</div></AbsoluteFill>;
  if (s.kind === "capture") { const W = 1000, sc = W / (s.cw || 1280), cx = s.cx || 0, k = interpolate(step(l), [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <AbsoluteFill style={{ background: g ? "#111" : "#F7F7F5" }}>
      <div style={{ position: "absolute", left: 40, top: 640, width: W, height: (s.ch || 900) * sc, boxShadow: "0 10px 40px rgba(0,0,0,0.18)", background: "#fff", overflow: "hidden", ...(g ? { filter: "invert(1)" } : {}) }}>
        <Img src={src(s.img)} style={{ width: (s.pw || 1280) * sc, maxWidth: "none", position: "absolute", left: -cx * sc, top: -(s.cy || 0) * sc }} />
        {(s.rects || []).map((r, i) => <div key={i} style={{ position: "absolute", left: (r.x - cx) * sc, top: (r.y - (s.cy || 0)) * sc, width: r.w * sc * k, height: r.h * sc, background: i === 0 ? "rgba(240,230,40,0.55)" : "rgba(225,40,40,0.45)", mixBlendMode: "multiply" }} />)}
      </div></AbsoluteFill>; }
  if (s.kind === "bars") { const k = interpolate(step(l), [3, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), mx = Math.max(...s.bars.map((b) => b.value));
    return <AbsoluteFill style={{ background: "#F7F7F5" }}>{s.bars.map((b, i) => <div key={i} style={{ position: "absolute", left: 90, top: 760 + i * 230 }}>
      <div style={{ width: 760 * (b.value / mx) * k, height: 110, background: i === 0 ? "#D9775A" : "#151515" }} />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: "#111", marginTop: 12 }}>{b.label} · {b.prefix || ""}{Math.round(b.value * k)}{b.suffix || ""}</div></div>)}</AbsoluteFill>; }
  if (s.kind === "logo") { const k = Math.min(1, step(l) / 6); return <AbsoluteFill style={{ background: s.white ? "#F7F7F5" : ground }}>
    <div style={{ position: "absolute", left: (1080 - (s.tile ? 340 : 760)) / 2, top: s.tile ? 640 : 720, width: s.tile ? 340 : 760, height: s.tile ? 340 : 220, borderRadius: s.tile ? 64 : 0, background: s.tile ? "#0d0d0d" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.9 + 0.1 * k})`, boxShadow: s.tile ? "0 10px 30px rgba(0,0,0,0.25)" : "none" }}>
      <Img src={src(s.img)} style={s.tile ? { maxWidth: "78%", maxHeight: "78%", objectFit: "contain", filter: s.lf || "invert(1)" } : { width: "100%", height: "100%", objectFit: "contain" }} /></div></AbsoluteFill>; }   {/* lf: per-logo filter (the ChatGPT knot sits on its own teal square) */}
  if (s.kind === "cta") return <AbsoluteFill style={{ background: "#3A3A3A" }}>
    {(s.logos || []).map((g, i, all) => <Img key={i} src={src(g)} style={{ position: "absolute", left: 540 - (all.length * 330) / 2 + i * 330 + 15, top: 1130, width: 300, height: 110, objectFit: "contain", filter: "invert(1)" }} />)}</AbsoluteFill>;
  // ---- system kinds (owner, 19 Nov 2026: show the people named, numbers as objects, no page screenshots); calm motion, one element at a time
  const appear = (i, gap = 7) => Math.max(0, Math.min(1, (l - i * gap) / 8));
  if (s.kind === "people") { const n = s.people.length, cols = n <= 2 ? n : n <= 4 ? 2 : 3, D = n <= 2 ? 420 : n <= 4 ? 340 : 260, cw = 1000 / cols, rows = Math.ceil(n / cols), top0 = 960 - (rows * (D + 120)) / 2 + 40;
    return <AbsoluteFill style={{ background: s.bg || ground }}>
      {s.title && <div style={{ position: "absolute", left: 60, right: 60, top: top0 - 150, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 64, color: s.bg ? "#fff" : "#111" }}>{s.title}</div>}
      {s.people.map((pp, i) => { const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols, x = 40 + (1000 - inRow * cw) / 2 + c * cw + (cw - D) / 2, y = top0 + r * (D + 120), a = appear(i);
        return <div key={i} style={{ position: "absolute", left: x, top: y + (1 - a) * 24, width: D, opacity: a }}>
          <div style={{ width: D, height: D, borderRadius: "50%", overflow: "hidden", background: "#cfcfcd", boxShadow: "0 10px 30px rgba(0,0,0,0.22)", border: "6px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {pp.img ? <Img src={src(pp.img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pp.pos || "50% 22%" }} /> : <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: D * 0.32, color: "#666" }}>{pp.name.split(" ").map((w) => w[0]).join("")}</span>}
          </div>
          <div style={{ marginTop: 14, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: D > 300 ? 40 : 30, color: s.bg ? "#fff" : "#111", lineHeight: 1.1 }}>{pp.name}</div>
          {pp.role && <div style={{ textAlign: "center", fontFamily: SANS, fontSize: D > 300 ? 30 : 22, color: s.bg ? "rgba(255,255,255,0.8)" : "#555" }}>{pp.role}</div>}
        </div>; })}
    </AbsoluteFill>; }
  if (s.kind === "person") { const a = appear(0); return <AbsoluteFill style={{ background: s.bg || ground }}>
    {s.cut ? <Img src={src(s.cut)} style={{ position: "absolute", left: 40, right: 40, bottom: 0, width: 1000, height: 1250, objectFit: "contain", objectPosition: "50% 100%", transform: `scale(${z})`, transformOrigin: "50% 100%", opacity: a, filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.25))" }} />
      : <div style={{ ...ins(820, 520), transform: `scale(${z})`, opacity: a }}><div style={{ width: "100%", height: "100%", overflow: "hidden" }}><Media s={s} /></div></div>}
    <div style={{ position: "absolute", left: 60, right: 60, top: 300, textAlign: "center", opacity: appear(1) }}>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 72, color: s.bg ? "#fff" : "#111" }}>{s.name}</div>
      {s.role && <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 44, color: s.bg ? "rgba(255,255,255,0.85)" : "#444", marginTop: 8 }}>{s.role}</div>}
    </div></AbsoluteFill>; }
  if (s.kind === "money") { const n = s.stacks || 3; return <AbsoluteFill style={{ background: s.bg || ground }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: s.value.length > 7 ? 150 : 190, letterSpacing: -4, color: s.bg ? "#fff" : "#111", opacity: appear(0) }}>{s.value}</div>
    {s.unit && <div style={{ position: "absolute", left: 0, right: 0, top: 600, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 52, color: s.bg ? "rgba(255,255,255,0.85)" : "#444", opacity: appear(1) }}>{s.unit}</div>}
    {s.img && Array.from({ length: n }, (_, i) => <Img key={i} src={src(s.img)} style={{ position: "absolute", left: 540 + (i - (n - 1) / 2) * 230, top: 860 + Math.abs(i - (n - 1) / 2) * 60, width: 560, transform: `translateX(-50%) scale(${z}) rotate(${(i - (n - 1) / 2) * 4}deg)`, opacity: appear(i + 1, 6), filter: "drop-shadow(0 16px 24px rgba(0,0,0,0.3))" }} />)}
  </AbsoluteFill>; }
  // two people as cut-outs on their companies' colours, side by side (owner: a mix of PNG cut-outs and photos, not photos everywhere)
  // a transparent PNG object (gavel, statue, money...) centred on the paper, the way motion designers use stock PNGs
  if (s.kind === "object") return <AbsoluteFill style={{ background: s.bg || ground }}>
    <Img src={src(s.img)} style={{ position: "absolute", left: 140, width: 800, top: s.top ?? 470, height: s.h ?? 860, objectFit: "contain", opacity: appear(0), transform: `scale(${z})`, filter: "drop-shadow(0 22px 30px rgba(0,0,0,0.28))" }} />
    {s.label && <div style={{ position: "absolute", left: 60, right: 60, top: (s.top ?? 470) + (s.h ?? 860) + 30, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 40, color: "#1a1a1a", opacity: appear(1) }}>{s.label}</div>}
  </AbsoluteFill>;
  if (s.kind === "versus") return <AbsoluteFill>
    <div style={{ position: "absolute", left: 0, top: 0, width: 540, height: 1920, background: s.bgA || "#111" }} /><div style={{ position: "absolute", left: 540, top: 0, width: 540, height: 1920, background: s.bgB || "#DD7354" }} />
    {[[s.cutA, s.labA, 0], [s.cutB, s.labB, 540]].map(([c, lab, x], i) => <React.Fragment key={i}>
      {c && <Img src={src(c)} style={{ position: "absolute", left: x - 60, bottom: 0, width: 660, height: 1150, objectFit: "contain", objectPosition: "50% 100%", opacity: appear(i, 9), transform: `scale(${z})`, transformOrigin: "50% 100%", filter: "drop-shadow(0 16px 26px rgba(0,0,0,0.35))" }} />}
      <div style={{ position: "absolute", left: x + 20, width: 500, top: 330, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 46, color: "#fff", lineHeight: 1.15, opacity: appear(i, 9) }}>{lab}</div></React.Fragment>)}
  </AbsoluteFill>;
  if (s.kind === "stat") { const pct = s.pct, a = appear(0), R = 230, C = 2 * Math.PI * R, k = Math.min(1, l / 24); return <AbsoluteFill style={{ background: s.bg || ground }}>
    {pct != null && <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}><circle cx="540" cy="900" r={R} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="56" /><circle cx="540" cy="900" r={R} fill="none" stroke={s.color || RED} strokeWidth="56" strokeDasharray={`${C * pct / 100 * k} ${C}`} transform="rotate(-90 540 900)" /></svg>}
    <div style={{ position: "absolute", left: 0, right: 0, top: pct != null ? 790 : 640, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: pct != null ? 170 : 260, color: "#111", opacity: a }}>{s.value}</div>
    {s.unit && <div style={{ position: "absolute", left: 60, right: 60, top: pct != null ? 1200 : 960, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 56, color: "#333", opacity: appear(1) }}>{s.unit}</div>}
    {s.img && <Img src={src(s.img)} style={{ position: "absolute", left: 240, width: 600, top: 1300, objectFit: "contain", opacity: appear(2), filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.25))" }} />}
  </AbsoluteFill>; }
  return <AbsoluteFill style={{ background: ground }} />;
}

/** v1 key word: letters appear out of order over ~9 frames inside a bar that flips blue/yellow every 3 frames. */
function KeyWord({ w, l, hl, brush, counter, calm }) {
  if (calm) { const a = Math.min(1, l / 6), size = Math.min(150, Math.floor(980 / (w.length * 0.6)));   // calm: the word fades in once, a marker sweeps under it, nothing flips
    return <span style={{ position: "relative", display: "inline-block", padding: "0 16px", fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: -size / 30, lineHeight: 1, color: "#111", opacity: a }}>
      {(hl || brush) && <span style={{ position: "absolute", left: 0, top: size * 0.12, bottom: size * 0.02, width: `${Math.min(1, l / 10) * 100}%`, background: brush === "red" ? "rgba(217,48,44,0.85)" : brush ? "rgba(56,217,192,0.85)" : YELLOW }} />}
      <span style={{ position: "relative" }}>{w}</span></span>; }
  const n = w.length, order = [...Array(n).keys()].sort((a, b) => ((a * 7 + 3) % n) - ((b * 7 + 3) % n)), shown = Math.min(n, Math.floor(step(l) / 3 * (n / 3)) + 1);
  const vis = new Set(order.slice(0, shown)), bar = hl ? (Math.floor(l / 3) % 2 && l < 15 ? BLUE : YELLOW) : null;
  const size = Math.min(176, Math.floor(980 / (n * 0.6)));
  return <span style={{ position: "relative", display: "inline-block", padding: "0 18px", fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: -size / 30, lineHeight: 1, color: bar === BLUE ? "#fff" : "#111" }}>
    {brush && <svg width="760" height="190" style={{ position: "absolute", left: -40, top: 0 }}><path d="M10 120 C120 40 300 70 420 60 S640 40 740 90 L730 140 C600 120 420 150 260 160 S60 170 20 150 Z" fill={brush === "red" ? RED : TEAL} opacity={0.9} /></svg>}
    {bar && <span style={{ position: "absolute", left: 0, right: 0, top: 18, bottom: 8, background: bar }} />}
    {counter && <span style={{ position: "absolute", right: "100%", top: 60, fontFamily: SANS, fontWeight: 500, fontSize: 52, color: "#111", marginRight: 10 }}>({counter})</span>}
    <span style={{ position: "relative" }}>{w.split("").map((ch, i) => <span key={i} style={{ opacity: vis.has(i) ? 1 : 0 }}>{ch}</span>)}</span>
  </span>;
}

/** Captions: the current phrase builds word by word. v1: small serif italic words of mixed sizes + bold sans key words; v3: white sans, centred. */
function Captions({ words, f, styleName, dark, top, calm }) {
  const t = f / 30, cur = words.findIndex((w, i) => t >= w.t0 && (i + 1 >= words.length || t < words[i + 1].t0));
  if (cur < 0) return null;
  const ph = words[cur].p, list = words.filter((w) => w.p === ph && w.t0 <= t && !w.hide);   // hide: the word is already on screen as a graphic (no doubling)
  if (styleName === "v3") return <div style={{ position: "absolute", left: 60, right: 60, top: top ?? 1000, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 76, color: dark ? "#fff" : "#111", textShadow: dark ? "0 3px 16px rgba(0,0,0,0.6)" : "none", lineHeight: 1.1 }}>{list.map((w) => w.w).join(" ")}</div>;
  return <div style={{ position: "absolute", left: 40, right: 40, top: top ?? 860, textAlign: "center", lineHeight: 1.05, textShadow: dark ? "0 3px 14px rgba(0,0,0,0.75)" : "none" }}>
    {list.map((w, i) => w.key
      ? <KeyWord key={i} w={w.w} l={f - Math.round(w.t0 * 30)} hl={w.hl} brush={w.brush} counter={calm ? null : w.counter} calm={calm} />
      : <span key={i} style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: [70, 112, 92, 132][(w.i * 5) % 4], color: dark ? "#f2f2f2" : "#151515", margin: "0 10px", verticalAlign: "middle" }}>{w.w}</span>)}
  </div>;
}

export function SX({ words = [], shots = [], styleName = "v1", tag, handle, cta, calm = false }) {
  const f = useCurrentFrame();
  let si = 0; for (let i = 0; i < shots.length; i++) if (shots[i].f0 <= f) si = i;
  const s = shots[si] || { kind: "paper" }, l = f - (s.f0 || 0);
  const strobe = !calm && s.strobe && l < 15, ground = strobe ? (Math.floor(l / 2) % 2 ? "#050505" : PAPER) : s.kind === "black" ? "#050505" : PAPER;
  const dark = ["full", "year", "split", "black", "cta", "brand"].includes(s.kind) || (["people", "person", "money", "stat"].includes(s.kind) && !!s.bg) || s.kind === "versus" || ground === "#050505";
  return <AbsoluteFill style={{ background: ground }}>
    <Fonts />
    <AbsoluteFill style={{ opacity: calm && si > 0 ? Math.min(1, 0.35 + l / 8) : 1 }}><Plate s={s} l={l} ground={ground} calm={calm} /></AbsoluteFill>   {/* calm: a short fade into each picture instead of a hard flash */}
    {s.kind !== "page" && s.kind !== "cta" && s.kind !== "bars" && s.kind !== "capture" && !(s.kind === "logo" && s.white) && s.kind !== "brand" && !s.cap && <Captions calm={calm} words={words} f={f} styleName={styleName} dark={dark || (s.kind === "inset" && !calm)} top={s.kind === "inset" ? (calm ? (s.top || 560) + (s.w || 760) * (s.ratio || 0.75) + (s.label ? 120 : 60) : (s.top || 560) + (s.w || 760) * (s.ratio || 0.75) / 2 - 70) : s.kind === "logo" && calm ? 1100 : s.kind === "object" ? Math.min(1680, (s.top ?? 470) + (s.h ?? 860) + (s.label ? 110 : 50)) : s.kind === "collage" ? s.capTop ?? 1380 : s.kind === "cutout" ? 380 : ["people", "money", "stat", "versus"].includes(s.kind) ? 1660 : s.kind === "person" ? 1700 : undefined} />}
    {s.cap && <div style={{ position: "absolute", left: 0, right: 0, top: 1040, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 78, color: "#fff", textShadow: "0 3px 18px rgba(0,0,0,0.65)" }}>{s.cap}</div>}
    {s.kind === "cta" && <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 110, color: "#fff", lineHeight: 1.05 }}>{cta}</div>}
    {!calm && s.blackbar && l === 4 && <div style={{ position: "absolute", left: 0, right: 0, top: 930, height: 26, background: "#000" }} />}
    {styleName === "v1" && s.kind !== "full" && <Grain f={f} />}
    {tag && <div style={{ position: "absolute", right: 46, top: 52, background: "#111", color: "#fff", fontFamily: F.mono, fontSize: 22, letterSpacing: 2, padding: "4px 10px" }}>{tag}</div>}
    {handle && dark && s.kind !== "cta" && <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 34, color: "rgba(255,255,255,0.85)" }}>{handle}</div>}
    {s.credit && <div style={{ position: "absolute", left: 30, bottom: 30, fontFamily: SANS, fontSize: 20, color: dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.55)" }}>{s.credit}</div>}
  </AbsoluteFill>;
}

export const compositions = [{ id: "SX", component: SX, durationInFrames: 1200, fps: 30, width: 1080, height: 1920, defaultProps: { words: [], shots: [], styleName: "v1" } }];
