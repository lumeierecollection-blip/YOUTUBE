/**
 * Which animation each element of each beat gets (Fix 2) — pure JS, so the
 * rules are unit-tested (scripts/test-animation-plan.mjs) and both the planner
 * (gemini-visual-plan.js, on the planned beats) and the resolver
 * (render-and-qa.js, on the resolved canvases) call the same function.
 *
 * The rules (the brief's):
 *   1. ONE animation per element per beat: headline, kicker, number, label,
 *      chart, and at most one exit.
 *   2. The same element type never repeats an animation FAMILY (animations.js:
 *      MASK_SWEEP and SPLIT_REVEAL are both "mask") on consecutive beats, and
 *      the last three beats' animations are removed from the choices — the
 *      rolling `recent_animations` window.
 *   3. Elements within one beat use different families (the headline slides,
 *      the label fades...).
 *   4. Within a video the least-used animation is preferred, so a video draws on
 *      the whole vocabulary; ties are broken by a hash of (seed, beat, element),
 *      so a plan is reproducible and two channels differ.
 * When the constraints leave nothing (a narrow vocabulary for a role), they
 * relax in a fixed order — rule 3, then the 3-beat window, then rule 2's family
 * — never rule 2's identity (the same animation twice in a row); every
 * relaxation is reported (`relaxed`), not hidden.
 *
 * Nothing here changes what is on screen except HOW it arrives: no text, no
 * number, no colour, no position.
 */
import { TEXT_ENTRANCES, EXITS, BAR, PIE, LINE, NUMBER, familyOf } from "./animations.js";

const ids = (list) => list.map((a) => a.id);
const BLOCK_IN = ["FADE_LIFT", "BLUR_IN", "SLIDE_FROM_L", "SLIDE_FROM_R", "DROP_IN", "RISE_FROM_BASE", "SCALE_UP", "SCALE_PUNCH", "WHIP_IN", "CUT_IN"];
const VERTICAL_IN = ["FADE_LIFT", "BLUR_IN", "MASK_SWEEP", "CUT_IN", "SCALE_UP"];
const ROLE_LIST = ["headline", "kicker", "label"];   // text-like roles that share the family-per-beat rule

/** FNV-1a, for a reproducible tie-break. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** The animations an element of this beat may use. `item` is the beat description (see animationsFor). */
export function allowedFor(role, item) {
  const chars = Number(item.headlineChars) || 0, words = Number(item.headlineWords) || 0;
  const textOk = (id, c, w) => !(id === "TYPE_IN" && c > 42) && !(id === "LETTER_STAGGER" && c > 34) && !(id === "WORD_STAGGER" && w < 2);
  switch (role) {
    case "headline": {
      if (item.vertical) return VERTICAL_IN;
      const all = ids(TEXT_ENTRANCES).filter((id) => textOk(id, chars, words));
      // The major TYPE-FULL beat keeps its flying words (the renderer's existing major-tier motion).
      return item.majorWords ? ["WORD_FLY"] : all;
    }
    case "kicker": case "label": {
      const c = Number(item[`${role}Chars`]) || 0, w = Number(item[`${role}Words`]) || 0;
      return [...BLOCK_IN, "TYPE_IN", "WORD_STAGGER", "MASK_SWEEP"].filter((id) => textOk(id, c, w));
    }
    case "number": return item.quantity === false ? ["SNAP_IN", "FLIP_CARD", "SCALE_IMPACT", "ROLL_DIGIT"] : ids(NUMBER);
    case "chart":
      if (item.chart === "BAR") return ids(BAR);
      if (item.chart === "PIE") return ids(PIE);
      if (item.chart === "GAUGE") return ["PIE_SWEEP", "PIE_POP", "PIE_FROM_TOP"];
      if (item.chart === "LINE") return ids(LINE);
      return [];
    default: return [];
  }
}

/**
 * items: [{ composition, headlineChars, headlineWords, kickerChars, labelChars,
 *           number: bool, quantity: bool, chart: "BAR"|"PIE"|"GAUGE"|"LINE"|null,
 *           vertical, majorWords, last }]
 * Returns { beats: [{ headline?, kicker?, number?, label?, chart?, exit?: {element, id} }],
 *           recent: [[ids of the last three beats, as of beat i]], relaxed: [strings], used: {id: count} }.
 */
export function animationsFor(items, { seed = "", log = () => {} } = {}) {
  const beats = [], recent = [], relaxed = [];
  const used = {};
  const usage = { headline: {}, kicker: {}, label: {}, number: {}, chart: {}, exit: {} };
  const prevFam = {};                                                    // role -> the family it used the last time it was drawn
  const windowOf = { headline: [], kicker: [], label: [], number: [], chart: [], exit: [] };   // last three beats' ids per kind
  const kindOf = (role) => role;
  const bump = (kind, id) => { usage[kind][id] = (usage[kind][id] || 0) + 1; used[id] = (used[id] || 0) + 1; };

  items.forEach((item, i) => {
    const present = (r) => (r === "headline" ? !!(item.headlineChars || item.majorWords) : r === "kicker" ? !!item.kickerChars : r === "number" ? !!item.number
      : r === "label" ? !!item.labelChars : !!item.chart);
    const roles = ["headline", "kicker", "number", "label", "chart"].filter(present);
    const out = {};
    // Candidates for a role, best first (least used in this video, then a reproducible hash). `window`: drop the last-three-beats ids.
    const cands = (role, useWindow) => {
      const kind = kindOf(role), wnd = new Set(windowOf[kind].flat());
      return allowedFor(role, item)
        .filter((id) => (!useWindow || !wnd.has(id)) && familyOf(id) !== prevFam[role] && !(windowOf[kind].length && windowOf[kind][windowOf[kind].length - 1].includes(id)))
        .sort((a, b) => (usage[kind][a] || 0) - (usage[kind][b] || 0) || hash(`${seed}|${i}|${role}|${a}`) - hash(`${seed}|${i}|${role}|${b}`));
    };
    const texty = roles.filter((r) => ROLE_LIST.includes(r));
    const solveTexty = (useWindow, distinct) => {
      // Depth-first over the text-like elements, the most constrained first, families distinct when `distinct`.
      const lists = Object.fromEntries(texty.map((r) => [r, cands(r, useWindow)]));
      const order = [...texty].sort((a, b) => lists[a].length - lists[b].length);
      if (order.some((r) => !lists[r].length)) return null;
      const taken = new Set(), pickd = {};
      const go = (k) => {
        if (k === order.length) return true;
        const r = order[k];
        for (const id of lists[r]) {
          const f = familyOf(id);
          if (distinct && taken.has(f)) continue;
          pickd[r] = id; taken.add(f);
          if (go(k + 1)) return true;
          taken.delete(f);
        }
        return false;
      };
      return go(0) ? pickd : null;
    };
    let sol = solveTexty(true, true), how = 0;
    if (!sol) { sol = solveTexty(false, true); how = 1; }
    if (!sol) { sol = solveTexty(true, false); how = 2; }
    if (!sol) { sol = solveTexty(false, false); how = 3; }
    if (!sol) { sol = Object.fromEntries(texty.map((r) => [r, allowedFor(r, item)[0]])); how = 4; }
    if (how) relaxed.push(`beat ${i}: ${how === 1 ? "the 3-beat window" : how === 2 ? "rule 3 (families distinct within the beat)" : how === 3 ? "the window and rule 3" : "everything (vocabulary too narrow)"} relaxed`);
    Object.assign(out, sol);
    for (const r of roles.filter((r) => !ROLE_LIST.includes(r))) {
      const c = cands(r, true).concat(cands(r, false));
      out[r] = c[0] || allowedFor(r, item)[0];
    }
    // One exit, on a supporting element (never the hero), except on the last beat (no outgoing transition);
    // its family differs from its own element's entrance and from the last exit's.
    if (!item.last) {
      const el = ["label", "kicker"].find((r) => out[r]);
      if (el) {
        const own = familyOf(out[el]), wnd = new Set(windowOf.exit.flat());
        const c = ids(EXITS).filter((id) => familyOf(id) !== own && familyOf(id) !== prevFam.exit && !wnd.has(id))
          .concat(ids(EXITS).filter((id) => familyOf(id) !== own && familyOf(id) !== prevFam.exit))
          .sort((a, b) => (usage.exit[a] || 0) - (usage.exit[b] || 0) || hash(`${seed}|${i}|exit|${a}`) - hash(`${seed}|${i}|exit|${b}`));
        if (c[0]) out.exit = { element: el, id: c[0] };
      }
    }
    // Commit to the windows.
    for (const kind of Object.keys(windowOf)) {
      const got = kind === "exit" ? (out.exit ? [out.exit.id] : []) : out[kind] ? [out[kind]] : [];
      if (!got.length) continue;        // an element that is absent is not a repeat
      windowOf[kind].push(got);
      if (windowOf[kind].length > 3) windowOf[kind].shift();
      got.forEach((id) => bump(kind, id));
    }
    for (const r of [...roles, "exit"]) { const id = r === "exit" ? out.exit?.id : out[r]; if (id) prevFam[r] = familyOf(id); }
    recent.push(Object.entries(out).flatMap(([k, v]) => (k === "exit" ? [v.id] : [v])));
    beats.push(out);
    log(`[anim] beat ${i}: ${Object.entries(out).map(([k, v]) => `${k}=${k === "exit" ? `${v.id}(${v.element})` : v}`).join(", ") || "(no animated element)"}`);
  });
  return { beats, recent: recent.map((_, i) => recent.slice(Math.max(0, i - 2), i + 1).flat()), relaxed, used };
}

/** The beat description animationsFor wants, from one resolved canvas (canvasLayout boxes decide what is present). */
export function itemOf(c, L, { last = false } = {}) {
  const B = L.boxes;
  const words = (t) => String(t || "").trim().split(/\s+/).filter(Boolean).length;
  const shown = (b) => (b?.lines ? b.lines.join(" ") : b?.text || "");
  const headline = B.headline || B.statement;
  const isNum = !!B.number;
  const vt = String(c.visual_type || "").toUpperCase();
  return {
    composition: L.composition,
    headlineChars: headline ? shown(headline).length : 0,
    headlineWords: headline ? words(shown(headline)) : 0,
    kickerChars: B.kicker ? shown(B.kicker).length : 0, kickerWords: B.kicker ? words(shown(B.kicker)) : 0,
    labelChars: B.label ? shown(B.label).length : 0, labelWords: B.label ? words(shown(B.label)) : 0,
    number: isNum,
    quantity: isNum ? !!B.number.parts?.isQuantity : null,
    chart: L.composition === "DATA-FULL" && ["BAR", "PIE", "GAUGE", "LINE"].includes(vt) ? vt : null,
    vertical: !!(B.statement && B.statement.rotate),
    majorWords: (c.motion_tier === "major") && L.composition === "TYPE-FULL" && !!B.statement && !B.statement.rotate && !B.number && !B.emphasis,
    last,
  };
}
