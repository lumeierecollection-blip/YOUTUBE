/**
 * CloneVideo — draws a clone plan (clone-plan.js) on the 1080x1920 frame. Presentation only: WHAT is shown, WHEN each element pops and WHERE
 * it goes are decided by the planner and clone-layout.js; this file decides how a treatment LOOKS.
 *
 * Owner, 2026-10-15: clone the reference videos' laws, not their frames. This family deliberately brings back what the canvas engine ruled
 * out (a ground that is not white, type beside objects, solid shapes) because the references do; what it keeps from the pipeline is every
 * rule that is not about those: pop-only entrances (no bounce, no overshoot), no zoom, real sourced pictures only, colour from channels.json.
 *
 * Every element enters with the pipeline's own pop (pop-groups.js popInState: 94% -> 100% over 6 frames, no pass beyond 1). The previous
 * shot stays under the new one for 6 frames, fading, so a cut is never an empty frame.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { popInState, popOutState } from "../visual/pop-groups.js";
import { sway, SWAY_X, SWAY_Y } from "../visual/sway.js";
import { readableAccent } from "../visual/canvas-layout.js";
import { planClone } from "./clone-plan.js";
import { treatmentBoxes, FRAME, parseDate } from "./clone-layout.js";

const HOLD = 6;   // frames the outgoing shot stays under the incoming one

// Width of a character in em, per family: conservative averages (a caps condensed face is narrow, a serif italic wider). The fit errs wide.
const ADV = { "Roboto Condensed": 0.5, "Playfair Display": 0.56, "Fraunces": 0.58, "DM Sans": 0.6, "JetBrains Mono": 0.62 };
const advOf = (fam, caps) => (ADV[fam] || 0.58) * (caps ? 1.06 : 1);

function fitLines(text, width, { family, caps, max, min, maxLines }) {
  const words = String(text).split(/\s+/).filter(Boolean);
  for (let size = max; size >= min; size -= 4) {
    const per = advOf(family, caps) * size;
    const lines = [];
    let cur = [];
    for (const w of words) {
      const next = [...cur, w].join(" ");
      if (next.length * per <= width || !cur.length) cur.push(w); else { lines.push(cur.join(" ")); cur = [w]; }
    }
    if (cur.length) lines.push(cur.join(" "));
    if (lines.length <= maxLines && Math.max(...lines.map((l) => l.length)) * per <= width * 1.0) return { lines, size };
  }
  const per = advOf(family, caps) * min;
  return { lines: [words.join(" ")], size: Math.max(28, Math.min(min, Math.floor(width / Math.max(1, words.join(" ").length * advOf(family, caps))))) , overflow: words.join(" ").length * per > width };
}

const toneFilter = (tone, bw) => (bw || tone === "grayscale" ? "grayscale(1) contrast(1.06)" : tone === "light-sepia" ? "sepia(0.22) saturate(0.92) contrast(1.03)" : "saturate(0.95) contrast(1.03)");

function Plate({ box, bg, children, style }) {
  return <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, backgroundColor: bg, ...style }}>{children}</div>;
}

function Display({ shot, B, st, P, profile }) {
  const d = profile.type.display;
  const caps = d.case === "upper";
  const text = caps ? shot.display.text.toUpperCase() : shot.display.text;
  const emph = shot.display.emphasis ? (caps ? shot.display.emphasis.toUpperCase() : shot.display.emphasis) : null;
  const plated = !!B.text.plated;
  const innerW = B.text.w - (plated ? 72 : 0);
  const { lines, size } = fitLines(text, innerW, { family: d.family, caps, max: shot.treatment === "type" ? 230 : (shot.hero || shot.subject || shot.excerpt) ? 118 : B.text.align === "center" ? 190 : 170, min: 56, maxLines: B.text.h > 450 ? 4 : 3 });
  const inkOn = plated ? P.paper : P.ink;
  const accent = readableAccent(P.accent, plated ? P.ink : P.ground);
  const word = (w, key) => {
    const hit = emph && w.replace(/[^\w$%]/g, "").toLowerCase() === emph.replace(/[^\w$%]/g, "").toLowerCase();
    if (!hit) return <span key={key}>{w}</span>;
    // On a solid plate (or in a highlight profile) the emphasised word is HIGHLIGHTED: paper on the accent, legible by construction. Coloured type
    // is only used on the paper ground, where readableAccent has measured it. (Dark red on an ink plate was invisible: CI 38746641163 dossier-mono.)
    // The MARKER highlight is reserved for quoted statements (owner, 2026-10-16); a display word is emphasised by colour only. On an ink plate the emphasis is
    // the paper colour, underlined, so it stays legible.
    return plated
      ? <span key={key} style={{ color: P.paper, borderBottom: `8px solid ${P.accent}` }}>{w}</span>
      : <span key={key} style={{ color: accent }}>{w}</span>;
  };
  return (
    <Plate box={B.text} bg={plated ? P.ink : "transparent"} style={{ zIndex: 5, padding: plated ? "28px 36px" : 0, boxSizing: "border-box", outline: plated ? `3px solid ${P.paper}` : "none", opacity: st.o, transform: `scale(${st.s})`, transformOrigin: B.text.align === "center" ? "50% 40%" : B.text.align === "right" ? "100% 40%" : "0% 40%", textAlign: B.text.align, width: plated ? "auto" : B.text.w, maxWidth: B.text.w }}>
      {lines.map((l, i) => (
        <div key={i} style={{ fontFamily: `"${d.family}", Helvetica, Arial, sans-serif`, fontStyle: d.style === "italic" ? "italic" : "normal", fontWeight: d.weight, fontSize: size, lineHeight: 1.02, letterSpacing: caps ? "0.01em" : "-0.01em", color: inkOn, whiteSpace: "nowrap" }}>
          {l.split(" ").map((w, k, a) => <React.Fragment key={k}>{word(w, k)}{k < a.length - 1 ? " " : ""}</React.Fragment>)}
        </div>
      ))}
    </Plate>
  );
}

function Figure({ shot, B, st, P, profile }) {
  const d = profile.type.display;
  const { size } = fitLines(shot.figure.value, B.text.w, { family: d.family, caps: false, max: 300, min: 90, maxLines: 1 });
  return (
    <Plate box={B.text} bg={B.text.plated ? P.ink : "transparent"} style={{ zIndex: 5, padding: B.text.plated ? "28px 36px" : 0, boxSizing: "border-box", outline: B.text.plated ? `3px solid ${P.paper}` : "none", width: B.text.plated ? "auto" : B.text.w, maxWidth: B.text.w, opacity: st.o, transform: `scale(${st.s})`, textAlign: B.text.align === "right" ? "right" : B.text.plated ? "left" : "center" }}>
      <div style={{ fontFamily: `"${d.family}", Helvetica, sans-serif`, fontStyle: d.style === "italic" ? "italic" : "normal", fontWeight: d.weight, fontSize: size, lineHeight: 1, color: B.text.plated ? P.paper : readableAccent(P.accent, P.ground), whiteSpace: "nowrap" }}>{shot.figure.value}</div>
      {shot.figure.label ? <div style={{ marginTop: 14, fontFamily: `"${profile.type.label.family}", Helvetica, sans-serif`, fontWeight: 500, fontSize: 40, letterSpacing: "0.12em", textTransform: "uppercase", color: B.text.plated ? P.paper : P.ink }}>{shot.figure.label}</div> : null}
    </Plate>
  );
}

function Shape({ shot, B, st, P }) {
  const kind = shot.shape;
  if (!kind) return null;
  const b = B.shape[kind];
  if (!b) return null;
  const style = { position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, opacity: st.o, transform: `scale(${st.s})`, transformOrigin: "0% 50%", zIndex: kind === "block" ? 0 : 3 };
  if (kind === "block") return <div style={{ ...style, backgroundColor: P.accent, opacity: st.o * 0.92 }} />;
  if (kind === "stripe") return <div style={{ ...style, backgroundColor: P.accent, transform: `rotate(-6deg) scale(${st.s})` }} />;
  if (kind === "pull") return <div style={{ ...style, transformOrigin: "50% 0%", backgroundColor: P.accent }} />;
  if (kind === "rule") return <div style={{ ...style, height: 0, borderTop: `3px solid ${P.ink}`, borderBottom: `3px solid ${P.ink}`, boxSizing: "content-box", paddingTop: 4 }} />;
  return <div style={{ ...style, backgroundColor: P.accent }} />;
}

function Hero({ shot, B, st, P, profile, bw, local, idx }) {
  const h = shot.hero;
  if (!h) return null;
  const t = shot.treatment, box = B.hero;
  const [fx, fy] = shot.crop;
  const swayX = sway(local / 30, SWAY_X) * 0.5, swayY = sway(local / 30, SWAY_Y) * 0.5;
  // FRAMELESS (owner, 2026-10-16: "the frames are not needed"). A cut-out is the object itself on the paper, with a soft shadow, as large as the references draw
  // them and allowed to run off the frame; a photo that could not be cut out is soft-edged. No mat, no border, no plate, no disc.
  if (box.cutout && (h.cutout || h.asset)) {
    const src = h.cutout || h.asset;
    const shadow = "drop-shadow(0 26px 34px rgba(0,0,0,0.30))";
    const tone = h.kind === "logo" ? "" : toneFilter(profile.photo_tone, bw) + " ";
    return (
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: st.o, zIndex: 6,
        transform: `translate(${swayX.toFixed(2)}px, ${swayY.toFixed(2)}px) rotate(${box.rot || 0}deg) scale(${st.s})`, transformOrigin: box.anchor === "bottom" ? "50% 100%" : "50% 50%" }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: box.anchor === "bottom" ? "50% 100%" : "50% 50%", filter: tone + shadow }} />
      </div>
    );
  }
  if (box.vignette) {
    const mask = "radial-gradient(ellipse 62% 58% at 50% 46%, #000 58%, rgba(0,0,0,0.6) 72%, transparent 88%)";
    return (
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: st.o, zIndex: 1, transform: `translate(${swayX.toFixed(2)}px, ${swayY.toFixed(2)}px) scale(${st.s})` }}>
        <Img src={staticFile(h.asset)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${fx}% ${fy}%`, filter: toneFilter(profile.photo_tone, bw), WebkitMaskImage: mask, maskImage: mask }} />
      </div>
    );
  }
  const logo = h.kind === "logo" || h.kind === "cutout" || h.kind === "symbol";
  const filter = toneFilter(profile.photo_tone, bw);
  const common = { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: st.o, zIndex: 1 };
  if (t === "bleed") {
    // the picture IS the frame: a static 8% overscan and a slow slide sideways, never a zoom
    const slide = (idx % 2 ? -1 : 1) * 30 * (Math.min(1, local / 60) - 0.5);
    return <div style={{ ...common, overflow: "hidden" }}><Img src={staticFile(h.asset)} style={{ width: "100%", height: "100%", objectFit: logo ? "contain" : "cover", objectPosition: `${fx}% ${fy}%`, transform: `scale(1.08) translateX(${slide.toFixed(2)}px)`, filter, backgroundColor: logo ? P.paper : undefined }} /></div>;
  }
  const mat = box.mat || 0;
  const shell = { ...common, transform: `translate(${swayX.toFixed(2)}px, ${swayY.toFixed(2)}px) rotate(${box.rot || 0}deg) scale(${st.s})`, boxShadow: t === "disc" ? "none" : "0 18px 40px rgba(0,0,0,0.22)", backgroundColor: logo || mat ? "#FFFFFF" : "transparent", padding: mat || (logo ? 40 : 0), boxSizing: "border-box", borderRadius: box.circle ? "50%" : 0, overflow: "hidden", border: box.circle ? `10px solid ${P.accent}` : "none" };
  return <div style={shell}><Img src={staticFile(h.asset)} style={{ width: "100%", height: "100%", objectFit: logo ? "contain" : "cover", objectPosition: `${fx}% ${fy}%`, filter, borderRadius: box.circle ? "50%" : 0 }} /></div>;
}

function Label({ text, B, st, P, profile, plated }) {
  if (!text) return null;
  const l = profile.type.label, bg = plated ? P.accent : "transparent";
  return (
    <div style={{ position: "absolute", left: B.label.x, top: B.label.y, width: B.label.w, opacity: st.o, transform: `scale(${st.s})`, transformOrigin: "0% 50%", textAlign: B.text.align === "right" ? "right" : B.text.align === "center" ? "center" : "left", zIndex: 4 }}>
      <span style={{ display: "inline-block", padding: plated ? "6px 16px" : 0, backgroundColor: bg, fontFamily: `"${l.family}", Helvetica, sans-serif`, fontWeight: l.weight, fontSize: 38, letterSpacing: `${l.tracking}em`, textTransform: l.case === "upper" ? "uppercase" : "none", color: plated ? P.paper : P.ink, whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
}

function Card({ shot, B, st, P, profile }) {
  // The narration itself, set as a tilted paper excerpt card: the visual of a shot that has no picture. The key words of the shot are marked inside it.
  const box = B.hero, c = (profile.type && profile.type.card) || { family: "DM Sans", style: "normal", weight: 500 };
  const marked = new Set(String((shot.display && shot.display.text) || "").toLowerCase().split(/\s+/).map((w) => w.replace(/[^\w$%]/g, "")).filter(Boolean));
  const words = String(shot.excerpt || "").split(" ");
  // Fit: the largest size at which the excerpt's estimated wrapped height fits the card's inner box (width and height less the padding).
  const innerW = box.w - 104, innerH = box.h - 112, adv = advOf(c.family, false) * 1.08, len = String(shot.excerpt || "").length;
  let size = 30;
  for (let z = 56; z >= 30; z -= 2) { const lines = Math.ceil((len * adv * z) / innerW); if (lines * z * 1.36 <= innerH) { size = z; break; } }
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", boxSizing: "border-box", padding: "56px 52px", backgroundColor: P.paper, boxShadow: "0 18px 40px rgba(0,0,0,0.22)", transform: `rotate(${box.rot || 0}deg) scale(${st.s})`, opacity: st.o, zIndex: 1, fontFamily: `"${c.family}", Georgia, serif`, fontStyle: c.style === "italic" ? "italic" : "normal", fontWeight: c.weight, fontSize: size, lineHeight: 1.36, color: P.ink }}>
      {words.map((w, i) => (marked.has(w.toLowerCase().replace(/[^\w$%]/g, ""))
        ? <span key={i} style={{ backgroundColor: P.accent, color: P.paper, padding: "0 0.18em" }}>{w}{" "}</span>
        : <span key={i}>{w}{" "}</span>))}
    </div>
  );
}

// GLYPH PLATES: when no picture of an entity exists, a generic, NON-IDENTIFYING mark stands for what KIND of thing it is (a person's silhouette, an
// organisation's building, a place's pin) with its name under it: the canvas engine's own fallback, drawn here. It never depicts the entity itself.
function GlyphMark({ type, color, size }) {
  const common = { width: size, height: size, viewBox: "0 0 100 100", fill: color };
  if (type === "person") return <svg {...common}><circle cx="50" cy="30" r="17" /><path d="M14 92 C14 62 30 52 50 52 C70 52 86 62 86 92 Z" /></svg>;
  if (type === "place") return <svg {...common}><path d="M50 6 C31 6 18 20 18 38 C18 62 50 94 50 94 C50 94 82 62 82 38 C82 20 69 6 50 6 Z M50 50 A12 12 0 1 1 50.01 50 Z" fillRule="evenodd" /></svg>;
  return <svg {...common}><path d="M50 8 L92 30 L92 38 L8 38 L8 30 Z" /><rect x="16" y="44" width="10" height="34" /><rect x="36" y="44" width="10" height="34" /><rect x="54" y="44" width="10" height="34" /><rect x="74" y="44" width="10" height="34" /><rect x="8" y="82" width="84" height="10" /></svg>;
}

// SUBJECT CELLS: the visual of a picture-less shot. An entity with no picture is a generic, NON-IDENTIFYING glyph (a person's silhouette, an organisation's
// building, a place's pin) with its name; a stated figure is the figure, big; a stated date is a calendar page. Each says what the beat is about without
// depicting anything it has no picture of (the canvas engine's own fallback, drawn here). One cell fills a plate; several share one panel as a grid, so the
// single frame the entity check samples shows every subject.
function SubjectCell({ g, w, h, P, profile, round, inv, free }) {
  const ink = inv ? P.paper : P.ink;
  const fam = profile.type.display.family, caps = profile.type.display.case === "upper";
  const small = Math.min(w, h) < 520;
  const face = { fontFamily: `"${fam}", Helvetica, Arial, sans-serif`, fontStyle: profile.type.display.style === "italic" ? "italic" : "normal", fontWeight: profile.type.display.weight, color: ink, whiteSpace: "nowrap", lineHeight: 1.04 };
  const labelFace = { fontFamily: `"${profile.type.label.family}", Helvetica, sans-serif`, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: ink, textAlign: "center" };
  const wrap = { width: w, height: h, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: round ? "10% 12%" : small ? "5% 6%" : "7%", overflow: "hidden" };
  if (g.kind === "figure") {
    const { size } = fitLines(g.name, w * 0.8, { family: fam, caps: false, max: small ? 150 : 300, min: 44, maxLines: 1 });
    return (
      <div style={wrap}>
        <div style={{ ...face, fontSize: size, color: inv ? P.paper : readableAccent(P.accent, "#FFFFFF") }}>{g.name}</div>
        {g.label ? <div style={{ ...labelFace, marginTop: 12, fontSize: small ? 26 : 40, whiteSpace: "normal", maxWidth: w * 0.84 }}>{g.label}</div> : null}
      </div>
    );
  }
  if (g.kind === "date") {
    const d = parseDate(g.name);
    const main = d.day || d.year || g.name;
    const { size } = fitLines(String(main), w * 0.7, { family: fam, caps: false, max: small ? 130 : 260, min: 44, maxLines: 1 });
    return (
      <div style={{ ...wrap, padding: 0, justifyContent: "flex-start" }}>
        <div style={free ? { ...labelFace, width: "100%", color: readableAccent(P.accent, P.ground), fontWeight: 700, padding: "6% 0 2%", fontSize: small ? 34 : 58, letterSpacing: "0.18em", borderBottom: `6px solid ${P.accent}` } : { ...labelFace, width: "100%", backgroundColor: P.accent, color: P.paper, fontWeight: 700, padding: round ? "16% 0 4%" : "4% 0", fontSize: small ? 30 : 50, letterSpacing: "0.16em" }}>{d.month || "DATE"}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...face, fontSize: size }}>{main}</div>
          {d.day && d.year ? <div style={{ ...labelFace, marginTop: 6, fontSize: small ? 28 : 52 }}>{d.year}</div> : null}
        </div>
      </div>
    );
  }
  const name = caps ? g.name.toUpperCase() : g.name;
  const { lines, size } = fitLines(name, w * 0.86, { family: fam, caps, max: small ? 56 : 96, min: 28, maxLines: 2 });
  return (
    <div style={{ ...wrap, justifyContent: "space-between" }}>
      <GlyphMark type={g.type} color={ink} size={Math.round(h * (small ? 0.4 : 0.46))} />
      <div style={{ textAlign: "center" }}>{lines.map((l, i) => <div key={i} style={{ ...face, fontSize: size }}>{l}</div>)}</div>
    </div>
  );
}

function SubjectPlate({ shot, B, st, P, profile }) {
  const box = B.hero, subs = (shot.subjects && shot.subjects.length ? shot.subjects : [shot.subject]).filter(Boolean);
  if (box.subject) {
    // FRAMELESS: the subjects straight on the paper. One fills the area; two sit side by side; three or four take two rows. Odd shots stagger the cells so
    // successive shots of a beat differ (a cut between identical frames adds nothing).
    const cols = subs.length <= 1 ? 1 : 2, rows = Math.ceil(subs.length / cols), cw = box.w / cols, ch = box.h / rows;
    const stagger = shot.inv ? 46 : 0;
    return (
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: st.o, transform: `scale(${st.s})`, zIndex: 1 }}>
        {subs.map((g, i) => (
          <div key={i} style={{ position: "absolute", left: (i % cols) * cw, top: Math.floor(i / cols) * ch + ((i % 2) ? stagger : -stagger), width: cw, height: ch }}>
            <SubjectCell g={g} w={cw} h={ch} P={P} profile={profile} round={false} inv={false} free />
          </div>
        ))}
      </div>
    );
  }
  const round = shot.treatment === "disc" && subs.length === 1;
  const shell = { position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: st.o, transform: `scale(${st.s})`, zIndex: 1, backgroundColor: shot.inv ? P.ink : "#FFFFFF", boxShadow: "0 18px 40px rgba(0,0,0,0.22)", boxSizing: "border-box", border: `10px solid ${P.accent}`, borderRadius: round ? "50%" : 0, overflow: "hidden" };
  const inner = { w: box.w - 20, h: box.h - 20 };
  if (subs.length === 1) return <div style={shell}><SubjectCell g={subs[0]} w={inner.w} h={inner.h} P={P} profile={profile} round={round} inv={!!shot.inv} /></div>;
  const cols = subs.length <= 2 ? subs.length : 2, rows = Math.ceil(subs.length / cols), cw = inner.w / cols, ch = inner.h / rows;
  return (
    <div style={{ ...shell, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
      {subs.map((g, i) => (
        <div key={i} style={{ borderRight: (i % cols) < cols - 1 ? `3px solid ${P.accent}` : "none", borderBottom: Math.floor(i / cols) < rows - 1 ? `3px solid ${P.accent}` : "none", boxSizing: "border-box" }}>
          <SubjectCell g={g} w={cw} h={ch} P={P} profile={profile} round={false} inv={!!shot.inv} />
        </div>
      ))}
    </div>
  );
}

// QUOTED STATEMENT (owner, 2026-10-16: "the highlighted text style should be quoted statements from sites and people"): verbatim words from a source the
// research found and quote-verify.mjs confirmed, in a serif line with ONE word marker-highlighted (ref-03), and who said it under it.
const QUOTE_STOP = new Set("the a an and or but of to in on at by for with from as is are was were be been it its this that these those he she they we you i his her their our your not no do does did has have had will would can could should may might than then so if into".split(" "));
const OPEN_Q = String.fromCharCode(8220), CLOSE_Q = String.fromCharCode(8221), DASH = String.fromCharCode(8212);
function Quote({ shot, B, st, P, profile }) {
  const q = shot.quote, box = B.quote || B.text;
  const bare = String(q.text).trim().split(OPEN_Q).join("").split(CLOSE_Q).join("").split('"').join("");
  const words = bare.split(" ").filter(Boolean);
  const plain = (w) => w.toLowerCase().split("").filter((ch) => (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")).join("");
  const key = words.reduce((a, w) => (!QUOTE_STOP.has(plain(w)) && plain(w).length > plain(a).length ? w : a), "");
  const fam = (profile.type.quote && profile.type.quote.family) || "Playfair Display";
  const { size } = fitLines(OPEN_Q + words.join(" ") + CLOSE_Q, box.w, { family: fam, caps: false, max: 72, min: 40, maxLines: 4 });
  const who = [q.speaker, q.source_name && q.source_name !== q.speaker ? q.source_name : null].filter(Boolean).join(", ");
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, zIndex: 7, opacity: st.o, transform: `scale(${st.s})`, transformOrigin: box.align === "right" ? "100% 0%" : box.align === "center" ? "50% 0%" : "0% 0%", textAlign: box.align }}>
      <div style={{ fontFamily: `"${fam}", Georgia, serif`, fontSize: size, lineHeight: 1.28, color: P.ink }}>
        {OPEN_Q}{words.map((w, i) => <React.Fragment key={i}>{w === key ? <>{(() => { let n = w.length; while (n > 0 && !plain(w[n - 1])) n--; return <><span style={{ backgroundColor: P.accent, color: P.paper, padding: "0 0.16em" }}>{w.slice(0, n)}</span>{w.slice(n)}</>; })()}</> : w}{i < words.length - 1 ? " " : ""}</React.Fragment>)}{CLOSE_Q}
      </div>
      {who ? <div style={{ marginTop: 18, fontFamily: `"${profile.type.label.family}", Helvetica, sans-serif`, fontWeight: 500, fontSize: 32, letterSpacing: "0.12em", textTransform: "uppercase", color: P.ink, opacity: 0.85 }}>{DASH + " " + who}</div> : null}
    </div>
  );
}

function ShotView({ shot, shotIndex, frame, hold, P, profile, bw }) {
  const B = treatmentBoxes(shot.treatment, shotIndex);
  const local = frame - shot.f0;
  const stateOf = (kind) => {
    const el = shot.elements.find((e) => e.kind === kind);
    if (!el) return null;
    return hold != null ? popOutState(hold) : popInState(frame - el.at);
  };
  const stHero = stateOf("hero") || { o: 1, s: 1 };
  const stShape = stateOf("shape"), stDisp = stateOf("display") || stateOf("figure"), stPlate = stateOf("plate");
  const plated = !!B.text.plated;
  return (
    <AbsoluteFill>
      {stShape ? <Shape shot={shot} B={B} st={stShape} P={P} /> : null}
      <Hero shot={shot} B={B} st={stHero} P={P} profile={profile} bw={bw} local={local} idx={shotIndex} />
      {shot.subject && !shot.hero ? <SubjectPlate shot={shot} B={B} st={stHero} P={P} profile={profile} /> : null}
      {shot.excerpt && stateOf("card") ? <Card shot={shot} B={B} st={stateOf("card")} P={P} profile={profile} /> : null}
      {stPlate && shot.plate ? <Label text={shot.plate} B={B} st={stPlate} P={P} profile={profile} plated={plated} /> : null}
      {stDisp && shot.display ? <Display shot={shot} B={B} st={stDisp} P={P} profile={profile} /> : null}
      {stDisp && shot.quote ? <Quote shot={shot} B={B} st={stDisp} P={P} profile={profile} /> : null}
      {stDisp && shot.figure ? <Figure shot={shot} B={B} st={stDisp} P={P} profile={profile} /> : null}
      {stateOf("tick") ? <div style={{ position: "absolute", left: B.text.x + B.text.w / 2 - 170, top: B.text.y + 40, width: 340, height: 20, backgroundColor: P.accent, opacity: stateOf("tick").o, transform: `scale(${stateOf("tick").s})`, zIndex: 4 }} /> : null}
    </AbsoluteFill>
  );
}

export function CloneVideo({ plan }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cfg = plan.clone;
  const P = cfg.palette;
  const shots = React.useMemo(() => planClone(plan.beats, { laws: cfg.laws, profile: cfg.profile, fps, quotes: cfg.quotes || [] }).shots, [plan.beats, cfg, fps]);
  let i = shots.findIndex((s) => frame >= s.f0 && frame < s.f1);
  if (i < 0) i = frame < shots[0].f0 ? 0 : shots.length - 1;
  const shot = shots[i], prev = i > 0 ? shots[i - 1] : null;
  const local = frame - shot.f0;
  const grid = cfg.profile.grid;
  return (
    <AbsoluteFill style={{ backgroundColor: P.ground }}>
      {grid ? (
        <svg width={FRAME.w} height={FRAME.h} style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
          {Array.from({ length: Math.ceil(FRAME.w / 60) + 1 }, (_, k) => <line key={`v${k}`} x1={k * 60} y1={0} x2={k * 60} y2={FRAME.h} stroke={P.grid} strokeWidth={1.5} />)}
          {Array.from({ length: Math.ceil(FRAME.h / 60) + 1 }, (_, k) => <line key={`h${k}`} x1={0} y1={k * 60} x2={FRAME.w} y2={k * 60} stroke={P.grid} strokeWidth={1.5} />)}
        </svg>
      ) : null}
      {prev && local < HOLD ? <ShotView shot={prev} shotIndex={i - 1} frame={prev.f1 - 1} hold={local} P={P} profile={cfg.profile} bw={cfg.bw} /> : null}
      <ShotView shot={shot} shotIndex={i} frame={frame} hold={null} P={P} profile={cfg.profile} bw={cfg.bw} />
      {shot.hero && shot.hero.credit ? <div style={{ position: "absolute", right: 40, bottom: 40, font: "500 20px DM Sans, Helvetica, sans-serif", color: P.ink, opacity: 0.55 }}>Source: {shot.hero.credit}</div> : null}
    </AbsoluteFill>
  );
}

export default CloneVideo;
