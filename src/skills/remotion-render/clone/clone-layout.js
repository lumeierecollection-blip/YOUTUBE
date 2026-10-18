/**
 * clone-layout — where everything goes in a clone shot. PURE geometry on the 1080x1920 frame, so legality is unit-tested without a browser.
 *
 * The clone family has ITS OWN legality rules (owner, 2026-10-15: the references' defining move is type and objects sharing the frame, which
 * the canvas engine's zone gates forbid; those gates are not loosened — they simply do not judge this family):
 *   CLONE-1  every box is inside the frame with a 40 px margin (a full-bleed picture is the one exception: it IS the frame)
 *   CLONE-2  display type never sits on a picture except on a SOLID plate (`bleed`), so its contrast is guaranteed by construction
 *   CLONE-3  the text region and the picture region do not overlap, except a bleed picture (under its plate)
 *   CLONE-4  the display region is tall enough for its type: at least 150 px
 *   CLONE-6  a supporting cut-out (supportBoxes) stays off the words: at most 5% of the text or label box
 */
export const FRAME = Object.freeze({ w: 1080, h: 1920 });
export const MARGIN = 40;

const rect = (x, y, w, h, extra = {}) => ({ x, y, w, h, ...extra });

/** Boxes for a treatment. `idx` alternates tilt and side so successive shots differ. */
export function treatmentBoxes(treatment, idx = 0) {
  const tilt = idx % 2 ? -1.6 : 1.6;
  switch (treatment) {
    case "bleed":
      return { hero: rect(0, 0, 1080, 1920, { bleed: true }), label: rect(60, 1196, 700, 44), text: rect(60, 1260, 960, 360, { align: "left", plated: true }), shape: { block: rect(60, 1676, 300, 16), bar: rect(60, 1676, 300, 16), stripe: rect(640, 0, 440, 96), rule: rect(60, 1176, 200, 6) } };
    case "framed":
      return { hero: rect(150, 320, 780, 975, { rot: tilt, mat: 22 }), label: rect(90, 1352, 900, 48), text: rect(90, 1420, 900, 300, { align: "center" }), shape: { block: rect(120, 360, 780, 975), bar: rect(390, 1780, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1330, 900, 6) } };
    case "disc":
      return { hero: rect(160, 300, 760, 760, { circle: true }), label: rect(90, 1100, 900, 48), text: rect(90, 1180, 900, 380, { align: "center" }), shape: { block: rect(120, 340, 760, 760), bar: rect(390, 1640, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1085, 900, 6) } };
    case "strip":
      return { hero: rect(0, 380, 1080, 700), label: rect(90, 1130, 700, 48), text: rect(90, 1210, 900, 420, { align: "left" }), shape: { block: rect(0, 1080, 1080, 24), bar: rect(90, 1700, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1112, 900, 6) } };
    case "inset-left":
      return { hero: rect(0, 260, 540, 1000), label: rect(580, 470, 440, 48), text: rect(580, 520, 440, 600, { align: "left" }), shape: { block: rect(40, 300, 500, 1000), bar: rect(580, 1160, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(580, 450, 440, 6) } };
    case "inset-right":
      return { hero: rect(540, 260, 540, 1000), label: rect(60, 470, 440, 48), text: rect(60, 520, 440, 600, { align: "right" }), shape: { block: rect(540, 300, 500, 1000), bar: rect(200, 1160, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(60, 450, 440, 6) } };
    // FRAMELESS treatments (owner, 2026-10-16: "the frames are not needed"; the references never box a picture). A CUT-OUT may run off the frame's edge and may sit
    // in front of part of the type (ref-03's figure falling through "SLIPS AWAY"); a soft-edged VIGNETTE photo has no border.
    case "stand": {
      // a person cut-out standing on the frame's floor, large (the Zalando video's three brothers); the words above them
      const left = idx % 2 === 0;
      return { hero: rect(left ? 60 : 140, 600, 880, 1320, { cutout: true, anchor: "bottom" }), label: rect(80, 190, 920, 48), text: rect(80, 250, 920, 330, { align: left ? "left" : "right" }), quote: rect(80, 250, 920, 330, { align: left ? "left" : "right" }), shape: { rule: rect(80, 170, 920, 6), bar: rect(80, 580, 260, 14) } };
    }
    // TYPE THE REFERENCES' SIZE (owner, 2026-10-19: "there is no typography ... they feel like a slideshow"). Run 39169019904 set the key phrase of a
    // picture shot at <= 118 px, in a 380 px column beside an edge cut-out, and the float layout ran its words down to y 1730 — under the Shorts title and
    // buttons (bottom 20%). ref-03 sets its key word ("MONEY", "ENDLESSLY") about a third of the frame wide. Every picture layout now has a FULL-WIDTH
    // text band inside the safe area (y 200-1536), and the picture takes the rest.
    case "float":
      // a cut-out object or figure floating at an angle with its shadow on the paper (ref-03's money bag, falling man, cash); the words under it
      return { hero: rect(150, 200, 780, 860, { cutout: true, rot: idx % 2 ? -5 : 5 }), label: rect(90, 1100, 900, 48), text: rect(90, 1160, 900, 370, { align: "center" }), quote: rect(90, 1160, 900, 370, { align: "center" }), shape: { rule: rect(90, 1082, 900, 6), bar: rect(390, 1560, 300, 14) } };
    case "edge": {
      // a big cut-out running off one side of the frame (the alarm clock); the words across the top, above it
      const right = idx % 2 === 0;
      return { hero: rect(right ? 380 : -220, 580, 920, 1100, { cutout: true }), label: rect(60, 196, 960, 44), text: rect(60, 250, 960, 320, { align: right ? "left" : "right" }), quote: rect(60, 250, 960, 320, { align: right ? "left" : "right" }), shape: { rule: rect(right ? 60 : 640, 186, 380, 6), bar: rect(right ? 60 : 760, 1600, 260, 14) } };
    }
    case "vignette":
      // a photo that cannot be cut out, soft-edged, no border (ref-03's portrait); the words above it
      return { hero: rect(90, 640, 900, 1000, { vignette: true }), label: rect(90, 196, 900, 44), text: rect(90, 250, 900, 360, { align: "center" }), quote: rect(90, 250, 900, 360, { align: "center" }), shape: { rule: rect(90, 186, 900, 6), bar: rect(390, 1680, 300, 14) } };
    // A QUOTED STATEMENT gets the frame (board 38870271640 ch-5: the prosecutor's verified quote was set 380 px wide beside a cut-out and read as fine print).
    // The picture, if the shot has one, sits small above it: cut out (quote-cut) or soft-edged (quote-soft); the quote takes the full width below.
    case "quote-cut":
      return { hero: rect(240, 180, 600, 640, { cutout: true }), label: rect(90, 860, 900, 48), text: rect(90, 930, 900, 760, { align: "center" }), quote: rect(90, 930, 900, 760, { align: "center" }), shape: { rule: rect(390, 900, 300, 6), bar: rect(390, 1760, 300, 14) } };
    case "quote-soft":
      return { hero: rect(240, 180, 600, 640, { vignette: true }), label: rect(90, 860, 900, 48), text: rect(90, 930, 900, 760, { align: "center" }), quote: rect(90, 930, 900, 760, { align: "center" }), shape: { rule: rect(390, 900, 300, 6), bar: rect(390, 1760, 300, 14) } };
    case "quote":
      return { hero: rect(90, 200, 900, 380, { subject: true }), label: rect(90, 600, 900, 48), text: rect(90, 660, 900, 900, { align: "center" }), quote: rect(90, 660, 900, 900, { align: "center" }), shape: { rule: rect(390, 600, 300, 6), bar: rect(390, 1700, 300, 14) } };
    case "subject":
      // a picture-less shot's SUBJECTS (entity glyphs, figures, dates) drawn straight on the paper, no plate, no border
      return { hero: rect(90, 340, 900, 860, { subject: true }), label: rect(90, 1250, 900, 48), text: rect(90, 1310, 900, 400, { align: "center" }), quote: rect(90, 1310, 900, 400, { align: "center" }), shape: { rule: rect(90, 1230, 900, 6), bar: rect(390, 1760, 300, 14) } };
    case "type":
      // NO PICTURE: the visual is the narration itself, set as a tilted paper EXCERPT CARD (the references' page scans) with the key words big below it.
      // The accent block is the card's own offset (32 px right and down), the same size, so it reads as a second sheet under it, never as a slab.
      return { hero: rect(120, 470, 840, 520, { rot: tilt * 0.75, card: true }), label: rect(90, 1070, 900, 48), text: rect(90, 1140, 900, 460, { align: "center" }), shape: { block: rect(152, 502, 840, 520), bar: rect(390, 1700, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1050, 900, 6), pull: rect(90, 1050, 900, 6) } };
    case "panel": {
      // SEVERAL SUBJECTS AT ONCE (entities, figures, dates as cells of one grid): the entity check samples one frame per beat, so every frame shows every subject.
      // Three layouts that alternate by shot (centred, left with a caption column, right with one): a beat with no picture at all was called TEMPLATE_MONOCULTURE
      // (100%, board 38799260354 ch-2) when every frame was the same panel in the same place.
      const v = idx % 3;
      if (v === 1) return { hero: rect(40, 400, 640, 860, { panel: true }), label: rect(720, 520, 320, 48), text: rect(720, 590, 320, 520, { align: "left" }), shape: { block: rect(70, 440, 640, 860), bar: rect(720, 1130, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(720, 500, 320, 6), pull: rect(720, 500, 320, 6) } };
      if (v === 2) return { hero: rect(400, 400, 640, 860, { panel: true }), label: rect(40, 520, 320, 48), text: rect(40, 590, 320, 520, { align: "right" }), shape: { block: rect(430, 440, 640, 860), bar: rect(60, 1130, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(40, 500, 320, 6), pull: rect(40, 500, 320, 6) } };
      return { hero: rect(90, 380, 900, 740, { panel: true }), label: rect(90, 1160, 900, 48), text: rect(90, 1230, 900, 420, { align: "center" }), shape: { block: rect(130, 420, 900, 740), bar: rect(390, 1700, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1140, 900, 6), pull: rect(90, 1140, 900, 6) } };
    }
    case "plate":
    default:
      return { hero: rect(180, 380, 720, 720, { plate: true }), label: rect(90, 1160, 900, 48), text: rect(90, 1240, 900, 380, { align: "center" }), shape: { block: rect(140, 420, 720, 720), bar: rect(390, 1700, 300, 20), stripe: rect(640, 0, 440, 96), rule: rect(90, 1142, 900, 6) } };
  }
}

/**
 * SUPPORTING CUT-OUTS (owner, 2026-10-18: "every frame has a PNG and how it's used to explain"). The references build ONE shot as a collage of 2-5 cut-outs
 * for one sentence, not one picture: ref-03 1.0-2.3 s hangs a money bag on a rope, slides a cash stack in from the right, raises reaching hands from the
 * bottom and drops coins into the corners, each from its own frame edge 0.1-0.3 s apart, the outer ones running off the frame. Our shots drew ONE picture
 * and the beat's other pictures waited for later shots. These are the slots for the beat's other cut-outs around the main one: in the frame's corners and
 * edges, partly off it, never on the type (CLONE-6), each with the edge it slides in from. A treatment with no free corner (a full bleed, a quote that
 * needs the width, the picture-less shots) has none.
 */
export function supportBoxes(treatment, idx = 0) {
  switch (treatment) {
    // sizes: ref-03's cash stack is about half the frame wide; a first render at 400-460 px boxes drew the supports at a quarter (2026-10-18)
    case "float":
      return [rect(620, -70, 540, 500, { from: "top", rot: 8 }), rect(-160, 600, 480, 460, { from: "left", rot: -6 })];
    case "edge": {
      // the main cut-out runs off one side; the supports take the other side, under the words
      const right = idx % 2 === 0;
      return right ? [rect(-120, 640, 500, 480, { from: "left", rot: -6 }), rect(-90, 1300, 520, 520, { from: "bottom", rot: 5 })]
        : [rect(700, 640, 500, 480, { from: "right", rot: 6 }), rect(650, 1300, 520, 520, { from: "bottom", rot: -5 })];
    }
    case "stand":
      // behind the standing figure, in the floor's corners
      return [rect(-180, 1340, 540, 540, { from: "left", rot: -5 }), rect(720, 1380, 540, 540, { from: "right", rot: 5 })];
    case "vignette":
      return [rect(-140, 1300, 540, 540, { from: "bottom", rot: -6 }), rect(700, 1320, 520, 520, { from: "right", rot: 6 })];
    default:
      return [];
  }
}

const inside = (b) => b.x >= MARGIN - 1e-6 && b.y >= MARGIN - 1e-6 && b.x + b.w <= FRAME.w - MARGIN + 1e-6 && b.y + b.h <= FRAME.h - MARGIN + 1e-6;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Legality of one treatment's layout: [] when every CLONE rule holds. */
export function layoutProblems(treatment, idx = 0) {
  const B = treatmentBoxes(treatment, idx), out = [];
  // CLONE-6: a supporting cut-out never covers the words (at most 5% of the text or label box: a shadow's edge, not a letter)
  for (const s of supportBoxes(treatment, idx)) for (const k of ["label", "text"]) {
    const ix = Math.max(0, Math.min(s.x + s.w, B[k].x + B[k].w) - Math.max(s.x, B[k].x));
    const iy = Math.max(0, Math.min(s.y + s.h, B[k].y + B[k].h) - Math.max(s.y, B[k].y));
    if ((ix * iy) / (B[k].w * B[k].h) > 0.05) out.push(`${treatment}: a supporting cut-out covers ${Math.round((ix * iy) / (B[k].w * B[k].h) * 100)}% of the ${k} (at most 5%)`);
  }
  for (const k of ["label", "text"]) if (!inside(B[k])) out.push(`${treatment}: ${k} box leaves the frame margin`);
  if (B.hero.none) { if (B.text.h < 150) out.push(`${treatment}: display region ${B.text.h}px is too short for its type`); return out; }
  if (B.hero.cutout) {
    // CLONE-5: a cut-out may run off the frame and stand in front of PART of the type: at most a quarter of the text box
    const ix = Math.max(0, Math.min(B.hero.x + B.hero.w, B.text.x + B.text.w) - Math.max(B.hero.x, B.text.x));
    const iy = Math.max(0, Math.min(B.hero.y + B.hero.h, B.text.y + B.text.h) - Math.max(B.hero.y, B.text.y));
    if ((ix * iy) / (B.text.w * B.text.h) > 0.25) out.push(`${treatment}: the cut-out covers ${Math.round((ix * iy) / (B.text.w * B.text.h) * 100)}% of the type (at most 25%)`);
    for (const k of ["label", "text"]) if (!inside(B[k])) out.push(`${treatment}: ${k} box leaves the frame margin`);
    if (B.text.h < 150) out.push(`${treatment}: display region ${B.text.h}px is too short for its type`);
    return out;
  }
  if (!B.hero.bleed && !inside({ ...B.hero, x: B.hero.x < MARGIN ? MARGIN : B.hero.x, w: Math.min(B.hero.w, FRAME.w - MARGIN - Math.max(B.hero.x, MARGIN)) }) && !(B.hero.x === 0 || B.hero.x + B.hero.w === FRAME.w)) out.push(`${treatment}: picture leaves the frame margin without running to an edge`);
  if (!B.hero.bleed && overlap(B.hero, B.text)) out.push(`${treatment}: display text overlaps the picture (only a plated bleed may)`);
  if (B.hero.bleed && !B.text.plated) out.push(`${treatment}: type over a full-bleed picture must sit on a solid plate`);
  if (B.text.h < 150) out.push(`${treatment}: display region ${B.text.h}px is too short for its type`);
  return out;
}

export const TREATMENTS = ["bleed", "framed", "disc", "strip", "inset-left", "inset-right", "plate", "panel", "type", "stand", "float", "edge", "vignette", "subject", "quote-cut", "quote-soft", "quote"];
/** Treatments a profile may rotate through: `type` is the planner's own choice for a shot with no picture, never a rotation entry. */
export const PICTURE_TREATMENTS = TREATMENTS.filter((t) => t !== "type" && t !== "panel");

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "October 1, 2026" / "October 2026" / "2026" -> { month, day, year }: whatever the text states, nothing it does not. Pure, so the calendar plate is testable. */
export function parseDate(text) {
  const t = String(text || "");
  const m = MONTHS.find((x) => new RegExp("(^|[^a-z])(" + x + "|" + x.slice(0, 3) + ")([^a-z]|$)", "i").test(t));   // a boundary without a backslash: "mar" in "marketplace" is not March
  const year = (t.match(/\b(?:1[89]|20)\d{2}\b/) || [])[0] || null;
  // an ordinal day counts ("September 25th": board 38976972038 ch-8 read no day and drew the whole phrase under the month)
  const day = (t.replace(year || "", "").match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i) || [])[1] || null;
  return { month: m ? m.toUpperCase() : null, day, year };
}
