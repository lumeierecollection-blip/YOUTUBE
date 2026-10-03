/**
 * SFX for the full-canvas renderer (owner's spec 2026-10-03, part D). PURE — no React — so it
 * is unit-tested (scripts/test-canvas-sfx.mjs) and render.js logs exactly what plays.
 *
 * The palette (public/sfx/, CREDITS.md): six roles, no other sound.
 *   pop          pop.mp3           -18 dB  an element pops in (headline, cutout, logo, photo, portrait, map)
 *   number-roll  number-roll.mp3   -16 dB  a counter (NUMBER-FULL, a quantity) pops in
 *   whoosh-soft  whoosh.mp3        -22 dB  a beat's pop-out exit (the 6-frame exit, at the next beat's start)
 *   tick         number-count.mp3  -20 dB  each word of a portrait beat's quote
 *   chime        reveal.mp3        -14 dB  the hook's first element settles
 *   impact-low   impact.mp3        -12 dB  the CTA (last beat) lands
 *
 * Rules: at most MAX_SFX (6) per video; every SFX is a visible event; charts (DATA-FULL)
 * animate silently — only a counter gets number-roll (D.5); no ambient loops, drums or drops.
 * When there are more candidates than 6, they are kept by priority (chime, impact-low,
 * number-roll, pop on a hero visual, pop on a headline, whoosh-soft) and never closer than
 * MIN_GAP frames to one another.
 *
 * Where it stops: the pop compositor shows every element SETTLED (full-canvas.jsx PopGroups:
 * "no internal draw, sweep, mask, roll ... is ever on screen"), so a counter does not visibly
 * count up — number-roll accompanies the counter's pop, which is what the viewer sees. No plan
 * carries a quote yet, so tick never fires (the trigger is wired for when one does).
 */
import { canvasLayout, normalizeCanvas } from "./canvas-layout.js";
import { popGroups, POP } from "./pop-groups.js";

export const SFX_PALETTE = Object.freeze({
  pop:           { file: "pop.mp3",          db: -18 },
  "number-roll": { file: "number-roll.mp3",  db: -16 },
  "whoosh-soft": { file: "whoosh.mp3",       db: -22 },
  tick:          { file: "number-count.mp3", db: -20 },
  chime:         { file: "reveal.mp3",       db: -14 },
  "impact-low":  { file: "impact.mp3",       db: -12 },
});
export const MAX_SFX = 6;
export const MIN_GAP = 12;
const PRIORITY = ["chime", "impact-low", "number-roll", "pop-hero", "pop-headline", "whoosh-soft", "tick"];
const HERO_BOXES = ["cutout0", "portrait", "map", "photo"];
const bandOf = (y) => (y < 620 ? "top" : "middle");

/**
 * @param beats DirectedShorts canvas beats ({ start_frame, duration_frames, scene: { canvas } })
 * @returns {{ events: Array<{trigger, role, file, db, atFrame, beat, reason}>, dropped: string[] }}
 */
export function canvasSfxEvents(beats = []) {
  const cands = [];
  const n = beats.length;
  beats.forEach((beat, i) => {
    const raw = beat?.scene?.canvas;
    if (!raw) return;
    const c = normalizeCanvas(raw, i);
    const L = canvasLayout(c);
    const groups = popGroups(c, L);
    if (!groups.length) return;
    const t0 = (beat.start_frame || 0) + (i > 0 ? POP.START : 0);
    const first = Math.min(...groups.map((g) => g.at));
    const groupAt = (key) => groups.find((g) => g.key === key)?.at;
    const add = (kind, role, atFrame, reason) => cands.push({ kind, role, atFrame: Math.round(atFrame), beat: i, reason });
    if (i === 0) add("chime", "chime", t0 + first + POP.IN, "the hook's first element settles");
    if (i === n - 1 && n > 1) add("impact-low", "impact-low", t0 + first, "the CTA lands");
    const chart = L.composition === "DATA-FULL";
    // A counter: NUMBER-FULL with a quantity (a year only pops — kinetic rules — and is silent here too).
    const num = L.boxes.number;
    if (L.composition === "NUMBER-FULL" && num?.parts?.isQuantity) {
      const at = groupAt(bandOf(num.y + num.h / 2));
      if (at !== undefined) add("number-roll", "number-roll", t0 + at, `counter "${c.data?.value ?? ""}" pops in`);
    }
    if (!chart && i !== 0 && i !== n - 1) {
      const hk = HERO_BOXES.find((k) => L.boxes[k]);
      if (hk) {
        const key = hk === "photo" ? "photo" : bandOf(L.boxes[hk].y + L.boxes[hk].h / 2);
        const at = groupAt(key) ?? groupAt("photo");
        if (at !== undefined) add("pop-hero", "pop", t0 + at, `${c.concept_visuals?.[0]?.logo ? "logo" : hk === "cutout0" ? (c.concept_visuals?.[0]?.class === "symbol" ? "symbol" : "cutout") : hk} pops in`);
      }
      const hb = L.boxes.headline || L.boxes.statement;
      if (hb && !(L.composition === "NUMBER-FULL")) {
        const at = groupAt(bandOf(hb.y + hb.h / 2));
        if (at !== undefined) add("pop-headline", "pop", t0 + at, "headline pops in");
      }
    }
    if (i > 0) add("whoosh-soft", "whoosh-soft", beat.start_frame || 0, `beat ${i - 1}'s pop-out exit`);
    // A portrait beat's quote, one tick per word (no plan carries a quote yet).
    if (L.composition === "PORTRAIT" && Array.isArray(c.quote_words)) for (const w of c.quote_words) add("tick", "tick", (beat.start_frame || 0) + (w.from || 0), `quote word "${w.text}"`);
  });
  const ordered = [...cands].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || a.atFrame - b.atFrame);
  const kept = [], dropped = [];
  for (const e of ordered) {
    if (kept.length >= MAX_SFX) { dropped.push(`${e.role} @${e.atFrame} (beat ${e.beat}: ${e.reason}) — over the ${MAX_SFX}-per-video cap`); continue; }
    const near = kept.find((k) => Math.abs(k.atFrame - e.atFrame) < MIN_GAP);
    if (near) { dropped.push(`${e.role} @${e.atFrame} (beat ${e.beat}: ${e.reason}) — within ${MIN_GAP} frames of ${near.role} @${near.atFrame}`); continue; }
    kept.push(e);
  }
  const events = kept.sort((a, b) => a.atFrame - b.atFrame).map((e) => ({ trigger: e.role, role: e.role, ...SFX_PALETTE[e.role], atFrame: e.atFrame, beat: e.beat, reason: e.reason }));
  return { events, dropped };
}
