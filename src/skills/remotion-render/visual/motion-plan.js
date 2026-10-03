/**
 * What moves on each beat (owner's spec 2026-10-03, part D: "every beat has a primary, a
 * secondary and a micro motion"). PURE — render.js logs it per beat:
 *   [motion] ch-1 beat 3: primary=…, secondary=…, micro=…
 *
 * This table describes what full-canvas.jsx DRAWS (the compositor renders each group at the
 * beat's live frame): change one, change the other. A composition missing from it is
 * reported as MISSING — a static frame.
 */
import { canvasLayout, normalizeCanvas, backgroundOf } from "./canvas-layout.js";

const MICRO = "1px drift + 0.3% breath";

export function motionsFor(raw, idx = 0) {
  const c = normalizeCanvas(raw, idx);
  const L = canvasLayout(c);
  const B = L.boxes, vt = String(c.visual_type || "TYPE").toUpperCase();
  const micro = backgroundOf(idx, L.composition).paper ? `${MICRO} + 0.5px grain drift` : MICRO;
  const hero = (c.concept_visuals || [])[0];
  let primary = null, secondary = null;
  switch (L.composition) {
    case "TYPE-FULL":
    case "TYPE-SPLIT":
      if (B.emphasis) { primary = "emphasis word pops (POP_EMPHASIS)"; secondary = "headline words pop one at a time"; break; }
      if (B.cutout0) {
        if (hero?.logo) { primary = "logo pops in at 1.15x and settles"; secondary = "shadow turns 2deg; headline words pop"; }
        else if (B.cutout0.class === "symbol") { primary = "symbol pops in on its floor"; secondary = "headline words pop one at a time"; }
        else { primary = B.cutout0.tilt ? "cutout pops in on its diagonal" : "cutout pushes in 2%"; secondary = "headline words pop one at a time"; }
        break;
      }
      if (B.lead_phrase) { primary = "name types on word by word"; secondary = "key phrase pops after it"; break; }
      if (B.number) { primary = B.number.parts?.isQuantity ? "number counts up" : "year snaps in"; secondary = "label pops after"; break; }
      if (B.portrait) { primary = "portrait pushes in 2%"; secondary = "name types on; shadow shifts 4px"; break; }
      primary = "words pop in one at a time";
      secondary = B.underline ? "0.5% breath; rule draws under it at 60%" : "0.5% breath";
      break;
    case "NUMBER-FULL":
      primary = B.number?.parts?.isQuantity ? "number counts up" : "year snaps in";
      secondary = B.label ? "label pops after" : "headline words pop";
      break;
    case "DATA-FULL":
      primary = { BAR: "bars grow from the baseline", LINE: "line draws left to right", PIE: "arc sweeps to its share", GAUGE: "needle sweeps to its value", TREND: "trend line draws" }[vt] || null;
      secondary = { BAR: "labels and figures pop as each bar lands", LINE: "points and figures pop as the line reaches them", PIE: "percentage counts up", GAUGE: "percentage counts up", TREND: "end dot and label pop" }[vt] || null;
      break;
    case "SCENE-FULL":
    case "ARCHITECTURE":
      primary = L.composition === "ARCHITECTURE" ? "photo pushes in 2% (tilt up the facade)" : "photo pushes in 2%";
      secondary = "overlay eases 0.45 -> 0.35; corner label pops at 20%";
      break;
    case "DOCUMENT":
      primary = "scan scrolls down the page";
      secondary = "highlighter band draws behind the headline";
      break;
    case "MONEY":
      primary = "photo pushes in 2%";
      secondary = "headline words pop";
      break;
    case "PORTRAIT":
      primary = "portrait pushes in 2%";
      secondary = "name types on; shadow shifts 4px";
      break;
    case "PROCESS-FULL":
      primary = "nodes pop in sequence";
      secondary = "arrows draw; a dot travels each arrow";
      break;
    case "MAP-CENTERED":
      primary = "region outlines itself";
      secondary = "pin drops with a bounce at 25%";
      break;
    case "LIST-BUILD":
      primary = "items appear as they are spoken";
      secondary = "index numerals pop";
      break;
    case "TIMELINE":
      primary = "dated markers appear as they are spoken";
      secondary = "dots pop on the line";
      break;
    case "COMPARISON-SPLIT":
      primary = "the two figures count up";
      secondary = "labels pop";
      break;
    default:
      break;
  }
  return { composition: L.composition, primary, secondary, micro, missing: [!primary && "primary", !secondary && "secondary"].filter(Boolean) };
}

/** The log line for one beat. */
export function motionLine(ch, i, m) {
  if (m.missing.length) return `[motion] ch-${ch} beat ${i}: MISSING ${m.missing.join(" + ")} motion (${m.composition}) — static frame`;
  return `[motion] ch-${ch} beat ${i}: primary=${m.primary}, secondary=${m.secondary}, micro=${m.micro}`;
}

/** Part E facts for one beat: its composition and its headline's size and alignment. */
export function layoutFacts(raw, idx = 0) {
  const c = normalizeCanvas(raw, idx);
  const L = canvasLayout(c);
  const h = L.boxes.headline || L.boxes.statement || null;
  const hero = (c.concept_visuals || [])[0];
  return { composition: L.composition + (hero ? `+HERO:${hero.name || ""}` : ""), size: h?.size || null, align: h?.align || null };
}
