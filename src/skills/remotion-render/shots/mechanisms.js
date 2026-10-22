/**
 * shots/mechanisms.js — what PHYSICALLY happens to a shot's materials, as a function of the beat's mechanism family
 * and the shot's progress p (0..1). Pure: returns, per material, a list of "pieces" to draw — each piece is the
 * material (or a copy / a part of it) with a world offset, a rotation, a clip and a filter. The camera is separate
 * (geometry.js): a mechanism moves the THINGS, the camera moves the VIEW.
 *
 * One parameterised action per family, not a template per sentence:
 *   reveal, context-reveal      the picture is masked down to a window on its focus point and the mask opens
 *   separation                  one picture splits in two halves that pull apart (2+ pictures: they move apart)
 *   disassembly / assembly      the picture breaks into strips that drift apart / arrive and lock together
 *   erosion, leak, depletion(1) a ragged edge eats the picture from one side, leaving the ground
 *   accumulation                prints of the material drop in one after another and stack
 *   depletion                   a stack of prints is removed one at a time
 *   substitution, temporal-     B replaces A in the SAME position behind a hard moving edge (no crossfade);
 *   transformation              with one picture: the hard edge wipes it from monochrome to full colour (then -> now)
 *   transformation              B opens from A's focus point in a growing circle, matched position
 *   transfer, flow              a cut-out copy of A travels on an arc into B (A and B side by side)
 *   cause-effect                B drops in beside A with an impact once A is established
 *   blockage, constraint        A slides toward B and stops dead against it, a small recoil
 *   comparative-transformation  A and B side by side; the camera (A -> B -> both) carries it
 *   scale-reveal, feedback,     camera-led: the material is static and the move is the camera's (KNOWN LIMIT:
 *   statement                   feedback has no physical loop of its own yet)
 */
import { clamp01, EASE, lerp } from "./geometry.js";

const win = (p, a, b) => clamp01((p - a) / (b - a));
// deterministic noise so a ragged edge is identical on every render and every frame
const noise = (i, seed = 1) => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A ragged vertical edge at position e (0..1 of the width, eaten from the RIGHT), as a CSS polygon. */
function raggedClip(e, seed) {
  const pts = ["0% 0%"];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * 100;
    const jag = (noise(i, seed) - 0.5) * 9 * Math.min(1, e * 6);
    pts.push(`${Math.max(0, (1 - e) * 100 + jag).toFixed(2)}% ${y.toFixed(2)}%`);
  }
  pts.push("0% 100%");
  return `polygon(${pts.join(", ")})`;
}

const piece = (o) => ({ dx: 0, dy: 0, rot: 0, scale: 1, clip: null, filter: null, shadow: false, z: 0, ...o });

/**
 * family: beat.mechanism.family; ids: the shot's drawable picture material ids in order; rects: world rects;
 * focus(id) -> {x,y}. Returns { [id]: piece[] } and `events`: [{at: p, kind}] (the moments an sfx cue hangs on).
 */
export function mechanismPieces(family, p, ids, rects, focus, view = null) {
  const out = {};
  const events = [];
  ids.forEach((id) => { out[id] = [piece({})]; });
  if (!ids.length) return { pieces: out, events };
  const A = ids[0], B = ids[1];
  const rA = rects[A];
  switch (family) {
    case "reveal":
    case "context-reveal": {
      // The window starts as 78% of the OPENING framing (the first frame is the picture with its edges just inside
      // the frame, never a strip on black: run 39862567098 b0s1/b1s2) and opens to the whole material.
      // Without a view (tests): a window on the focus point.
      const f = focus(A), e = EASE.inOut(win(p, 0.12, 0.72));
      const v = view || { x: f.x - 0.15, y: f.y - 0.15, w: 0.3, h: 0.3 };
      const k0 = 0.78;
      const l = Math.max(0, lerp(v.x + (v.w * (1 - k0)) / 2, 0, e)), r = Math.max(0, lerp(1 - v.x - (v.w * (1 + k0)) / 2, 0, e));
      const t = Math.max(0, lerp(v.y + (v.h * (1 - k0)) / 2, 0, e)), b = Math.max(0, lerp(1 - v.y - (v.h * (1 + k0)) / 2, 0, e));
      out[A] = [piece({ clip: `inset(${(t * 100).toFixed(2)}% ${(r * 100).toFixed(2)}% ${(b * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%)`, shadow: true })];
      events.push({ at: 0.12, kind: "reveal" });
      break;
    }
    case "separation": {
      const e = EASE.inOut(win(p, 0.2, 0.75));
      if (B) {
        ids.forEach((id, i) => { out[id] = [piece({ dx: (i - (ids.length - 1) / 2) * rects[id].w * 0.35 * e, rot: (i ? 1 : -1) * 3 * e, shadow: true })]; });
      } else {
        const gap = rA.w * 0.16 * e;
        out[A] = [
          piece({ clip: "inset(0 50% 0 0)", dx: -gap, rot: -2.5 * e, dy: rA.h * 0.02 * e, shadow: true }),
          piece({ clip: "inset(0 0 0 50%)", dx: gap, rot: 2.5 * e, dy: -rA.h * 0.02 * e, shadow: true }),
        ];
      }
      events.push({ at: 0.2, kind: "split" });
      break;
    }
    case "disassembly":
    case "assembly": {
      const e = family === "assembly" ? 1 - EASE.out(win(p, 0.08, 0.6)) : EASE.inOut(win(p, 0.25, 0.85));
      const n = 4;
      out[A] = Array.from({ length: n }, (_, i) => piece({
        clip: `inset(${(i * 100 / n).toFixed(2)}% 0 ${(100 - (i + 1) * 100 / n).toFixed(2)}% 0)`,
        dx: (noise(i, 3) - 0.5) * rA.w * 0.5 * e,
        dy: (i - (n - 1) / 2) * rA.h * 0.09 * e,
        rot: (noise(i, 5) - 0.5) * 14 * e,
        shadow: true,
      }));
      events.push({ at: family === "assembly" ? 0.6 : 0.25, kind: family === "assembly" ? "lock" : "break" });
      break;
    }
    case "erosion":
    case "leak": {
      const e = EASE.inOut(win(p, 0.1, 0.9)) * 0.82;
      out[A] = [piece({ clip: raggedClip(e, 7), shadow: true })];
      events.push({ at: 0.1, kind: "erode" });
      break;
    }
    case "accumulation":
    case "depletion": {
      const n = 6;
      const copies = [];
      for (let i = 0; i < n; i++) {
        // the first print is already down on the first frame (run 39863863642 b5s1 opened on empty ground)
        const land = family === "accumulation" ? (i === 0 ? -1 : 0.06 + (i / n) * 0.62) : null;
        const leave = family === "depletion" ? 0.15 + ((n - 1 - i) / n) * 0.6 : null;
        let dy = 0, dx = 0, show = true;
        if (land != null) { const k = EASE.out(win(p, land, land + 0.12)); dy = -(1 - k) * 2200; show = p >= land; }
        if (leave != null) { const k = EASE.inOut(win(p, leave, leave + 0.12)); dx = k * 2400 * (i % 2 ? 1 : -1); dy = -k * 300; }
        if (land != null) events.push({ at: land + 0.1, kind: "land" });
        if (leave != null) events.push({ at: leave, kind: "remove" });
        if (!show) continue;
        copies.push(piece({
          scale: 0.62, dx: dx + (noise(i, 11) - 0.5) * rA.w * 0.22, dy: dy + (i - n / 2) * -rA.h * 0.035,
          rot: (noise(i, 13) - 0.5) * 16, shadow: true, z: i, border: true,
        }));
      }
      events.sort((a, b) => a.at - b.at);
      out[A] = copies;
      ids.slice(1).forEach((id) => { out[id] = []; });
      break;
    }
    case "substitution":
    case "temporal-transformation": {
      const e = EASE.inOut(win(p, 0.38, 0.68));
      if (B) {
        out[A] = [piece({})];
        out[B] = [piece({ clip: `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`, z: 2, edge: e > 0 && e < 1 })];
        ids.slice(2).forEach((id) => { out[id] = []; });
      } else {
        out[A] = [piece({ filter: "grayscale(1) contrast(1.1) sepia(0.35)" }), piece({ clip: `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`, z: 2, edge: e > 0 && e < 1 })];
      }
      events.push({ at: 0.38, kind: "wipe" });
      break;
    }
    case "transformation": {
      const e = EASE.inOut(win(p, 0.3, 0.75));
      if (B) {
        const f = focus(A);
        out[B] = [piece({ clip: `circle(${(e * 120).toFixed(2)}% at ${(f.x * 100).toFixed(1)}% ${(f.y * 100).toFixed(1)}%)`, z: 2 })];
        ids.slice(2).forEach((id) => { out[id] = []; });
      } else {
        out[A] = [piece({ filter: "grayscale(1) contrast(1.1)" }), piece({ clip: `circle(${(e * 120).toFixed(2)}% at 50% 50%)`, z: 2 })];
      }
      events.push({ at: 0.3, kind: "transform" });
      break;
    }
    case "transfer":
    case "flow": {
      if (B) {
        const e = EASE.inOut(win(p, 0.22, 0.8));
        const rB = rects[B];
        const dx = (rB.x + rB.w / 2) - (rA.x + rA.w / 2), dy = (rB.y + rB.h / 2) - (rA.y + rA.h / 2);
        const arc = Math.sin(Math.PI * e) * rA.w * 0.35;
        out[A] = [piece({ shadow: true }), piece({ scale: 0.38, dx: dx * e + (dy ? arc : 0), dy: dy * e - (dy ? 0 : arc), rot: 8 * Math.sin(Math.PI * e), shadow: true, z: 5, border: true })];
        events.push({ at: 0.22, kind: "move" }, { at: 0.8, kind: "land" });
      }
      break;
    }
    case "cause-effect": {
      if (B) {
        const k = EASE.out(win(p, 0.42, 0.56));
        out[B] = [piece({ dy: -(1 - k) * 2400, rot: (1 - k) * -6, shadow: true, show: p >= 0.42 })];
        if (p < 0.42) out[B] = [];
        events.push({ at: 0.55, kind: "impact" });
      }
      break;
    }
    case "blockage":
    case "constraint": {
      if (B) {
        const rB = rects[B];
        const gapTo = rB.x - (rA.x + rA.w) - 20;
        const k = EASE.camera(win(p, 0.15, 0.55));
        const recoil = Math.sin(Math.PI * win(p, 0.55, 0.68)) * -40;
        out[A] = [piece({ dx: gapTo * k + recoil, shadow: true, z: 3 })];
        events.push({ at: 0.55, kind: "impact" });
      }
      break;
    }
    default:
      // scale-reveal, comparative-transformation, feedback, statement: camera-led, the materials stay put
      break;
  }
  return { pieces: out, events };
}

/** The p at which a family's main physical event happens (where its sfx cue lands). */
export function eventAt(family) {
  const { events } = mechanismPieces(family, 0, ["a", "b"], { a: { x: 0, y: 0, w: 1, h: 1 }, b: { x: 2, y: 0, w: 1, h: 1 } }, () => ({ x: 0.5, y: 0.5 }));
  return events.length ? events[0].at : 0.15;
}
