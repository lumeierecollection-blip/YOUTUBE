/**
 * The scene vocabulary both channels draw from: what a scene is for decides how it is shown.
 *
 * Three jobs live here. Data honesty: every chart value must be found in the research fact it
 * cites, bars and rings are drawn to true proportion from zero, and a scene that fails this
 * becomes a non-data scene instead of showing an unverified number. Composition: reusable
 * builders that make layers from the channel's own palette and font. Variety: the inventory of
 * what each scene became, and the check that stops one layout carrying a whole video.
 *
 * Where the guarantee stops: factSupports proves a number appears in the cited fact, not that the
 * chart's framing of it is fair. The label and headline are still judged by the frame review.
 */
import { StageError } from "./lib.mjs";
import { W, fit, solid, stroke, text } from "./visual-common.mjs";

export const PURPOSES = ["hook", "concept", "process", "statistic", "comparison", "sequence", "relationship", "geography", "evidence", "object", "conclusion"];
export const DATA_TEMPLATES = new Set(["bars", "line", "counter", "proportion", "ranked"]);

const BOTTOM = 1470;
const WORD_NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

/** Facts in citation order: narrative facts first, then the research's structured numbers. */
export function factList(research) {
  const facts = (research.key_facts || []).map((f) => ({ text: String(f.fact || f.claim || f.text || f), url: f.source_url || "" }));
  for (const n of research.numbers || []) facts.push({ text: `${n.label}: ${n.value} ${n.unit || ""}`.trim(), url: n.source_url || "", unit: n.unit || "" });
  return facts;
}

/** True only if the value is written in that fact, as digits or as a small number word. */
export function factSupports(factText, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const t = String(factText).toLowerCase().replace(/(\d),(?=\d)/g, "$1");
  const digits = String(n).replace(".", "\\.");
  const hasDecimal = String(n).includes(".");
  const pattern = `(^|[^\\d.])${digits}${hasDecimal ? "0*" : "(\\.0+)?"}(?![\\d]|\\.\\d)`;
  if (new RegExp(pattern).test(t)) return true;
  return Number.isInteger(n) && n >= 0 && n < WORD_NUMBERS.length && new RegExp(`\\b${WORD_NUMBERS[n]}\\b`).test(t);
}

const NUM = /\d[\d,.]*/g;
export const groundedNumbers = (s, corpus) => (String(s).match(NUM) || []).every((n) => corpus.includes(n.replace(/[.,]$/, "")));

const unitKind = (u) => (/percent|%/i.test(u) ? "percent" : /dollar|usd|\$|euro|pound/i.test(u) ? "money" : "count");
const short = (s, n) => typeof s === "string" && s.trim().length > 0 && s.length <= n;

/** Resolves a cited value. Returns its fact, or null when the citation does not hold. */
function cited(value, index, facts) {
  const fact = facts[Number(index)];
  return fact && factSupports(fact.text, value) ? fact : null;
}

const VALIDATORS = {
  flow: (p) => Array.isArray(p.steps) && p.steps.length >= 3 && p.steps.length <= 4 && p.steps.every((s) => short(s, 40)) && {},
  hub: (p) => short(p.center, 24) && Array.isArray(p.spokes) && p.spokes.length >= 3 && p.spokes.length <= 5 && p.spokes.every((s) => short(s, 24)) && {},
  stack: (p) => Array.isArray(p.layers) && p.layers.length >= 3 && p.layers.length <= 4 && p.layers.every((s) => short(s, 30)) && {},
  cause: (p) => Array.isArray(p.chain) && p.chain.length >= 2 && p.chain.length <= 3 && p.chain.every((s) => short(s, 48)) && {},
  before_after: (p) => short(p.before?.title, 18) && short(p.after?.title, 18) && [...(p.before?.points || []), ...(p.after?.points || [])].length >= 2 && {},
  conclusion: (p) => short(p.headline, 70) && {},
  timeline(p, facts) {
    if (!Array.isArray(p.events) || p.events.length < 3 || p.events.length > 4) return null;
    const sources = [];
    for (const e of p.events) {
      const fact = facts[Number(e.fact)];
      const years = String(e.date).match(/\d+/g);
      if (!fact || !years || !years.every((y) => factSupports(fact.text, y)) || !short(e.label, 44)) return null;
      sources.push(fact.url);
    }
    return { sources };
  },
  bars(p, facts) {
    if (!Array.isArray(p.bars) || p.bars.length < 2 || p.bars.length > 4 || !short(p.unit, 40)) return null;
    const found = p.bars.map((b) => (Number(b.value) >= 0 && short(b.label, 30) ? cited(b.value, b.fact, facts) : null));
    if (found.some((f) => !f)) return null;
    const kinds = new Set(found.filter((f) => f.unit).map((f) => unitKind(f.unit)));
    return kinds.size <= 1 ? { sources: found.map((f) => f.url) } : null;
  },
  line(p, facts) {
    if (!Array.isArray(p.points) || p.points.length < 3 || p.points.length > 5 || !short(p.unit, 40)) return null;
    const found = p.points.map((q) => (Number(q.value) >= 0 && short(String(q.x), 12) ? cited(q.value, q.fact, facts) : null));
    if (found.some((f) => !f)) return null;
    if (!p.points.every((q, i) => (String(q.x).match(/\d+/g) || []).every((d) => factSupports(found[i].text, d)))) return null;
    return { sources: found.map((f) => f.url) };
  },
  counter(p, facts) {
    const fact = short(p.label, 60) && Number(p.value) >= 0 ? cited(p.value, p.fact, facts) : null;
    if (!fact || /\d/.test(`${p.prefix || ""}${p.suffix || ""}`)) return null;
    return { sources: [fact.url] };
  },
  proportion(p, facts) {
    const part = Number(p.part), total = Number(p.total);
    if (!short(p.label, 60) || !(part > 0) || !(total > 0) || part > total) return null;
    const fact = cited(part, p.fact, facts);
    if (!fact) return null;
    const percent = total === 100 && /%|percent/i.test(fact.text);
    return percent || factSupports(fact.text, total) ? { sources: [fact.url], percent } : null;
  },
  ranked(p, facts) {
    const fact = facts[Number(p.fact)];
    if (!fact || !Array.isArray(p.items) || p.items.length < 3 || p.items.length > 5) return null;
    const hay = fact.text.toLowerCase();
    return p.items.every((x) => short(x, 34) && hay.includes(String(x).split(/\s+/)[0].toLowerCase())) ? { sources: [fact.url] } : null;
  },
};

const shownText = (p) => [p.headline, p.center, p.label, ...(p.steps || []), ...(p.spokes || []), ...(p.layers || []), ...(p.chain || []), ...(p.items || []), ...(p.nodes || []), ...(p.events || []).map((e) => e.label), ...["before", "after", "left", "right"].flatMap((k) => [p[k]?.title, ...(p[k]?.points || [])])].filter(Boolean).map(String);

/**
 * Applies the citation and shape rules to one planned scene. A scene that fails them becomes the
 * fallback and records why, so a bad citation can never reach the screen.
 */
export function validateScene(raw, { facts, corpus, allowed, fallback }) {
  const purpose = PURPOSES.includes(raw.purpose) ? raw.purpose : "concept";
  const wanted = raw.template || fallback;
  const base = { ...raw, purpose, sources: [] };
  if (!allowed.has(wanted)) return { ...base, template: fallback, downgraded_from: wanted, downgrade_reason: "not in this channel's vocabulary" };
  // Words on screen follow the same rule as charts: a figure must exist in the research.
  if (!shownText(raw).every((t) => groundedNumbers(t, corpus))) return { ...base, template: fallback, downgraded_from: wanted, downgrade_reason: "on-screen text contains a number not in the research" };
  const check = VALIDATORS[wanted];
  if (!check) return { ...base, template: wanted };
  const ok = check(raw, facts, corpus);
  if (!ok) return { ...base, template: fallback, downgraded_from: wanted, downgrade_reason: "shape invalid or a value is not in its cited fact" };
  return { ...base, template: wanted, ...ok, sources: ok.sources || [] };
}

export const ANIMATION = {
  kinetic: "headline slides up, underline draws", article: "real screenshot with a slow push-in", diagram: "nodes draw in sequence along connectors", compare: "two columns reveal around a drawn divider", terminal: "lines type in one by one",
  flow: "steps enter from alternating sides, arrows draw between them", hub: "spokes draw outward, nodes appear around the centre", stack: "plates separate into an exploded stack, leader lines draw", cause: "causes step down a zig-zag along curved arrows",
  timeline: "spine draws downward, events appear as it reaches them", bars: "bars grow from a zero baseline", line: "line draws through its points from a zero baseline", counter: "number counts up, rule draws", proportion: "ring sweeps to the exact share", ranked: "rows slide in from the right in rank order", before_after: "panels enter from opposite sides", conclusion: "closing panel rises over the frame",
  photo: "still photograph; annotation and notes draw over it", map: "map holds, route and labels draw",
};

/** One line of the composition inventory kept in the production manifest. */
export const inventoryRow = ({ scene, purpose, template, composition, background, sources, start_s, end_s, repeat_reason, downgraded_from }) => ({
  scene, start_s, end_s, purpose, visual_type: template, composition: composition || template, animation: ANIMATION[template] || template, background,
  data_or_evidence_source: [...new Set(sources || [])], repeat_reason: repeat_reason || "", downgraded_from: downgraded_from || "", duplicates_nearby: false,
});

/**
 * Targets scale with the video: at least 3 compositions (4 from 6 scenes up), no layout twice in a
 * row without a stated editorial reason, none on more than 40% of scenes, and a scene planned as a
 * statistic must actually show data. No chart is required of a story with no numbers.
 */
export function varietyReport(rows) {
  const n = rows.length, keys = rows.map((r) => r.composition);
  rows.forEach((r, i) => { r.duplicates_nearby = keys[i - 1] === r.composition || keys[i + 1] === r.composition; });
  const distinct = new Set(keys).size;
  const target = n <= 2 ? n : n < 6 ? 3 : 4;
  const maxUse = Math.max(2, Math.ceil(n * 0.4));
  const violations = [];
  if (distinct < target) violations.push(`only ${distinct} different compositions across ${n} scenes; need ${target}`);
  rows.forEach((r, i) => { if (i && keys[i - 1] === r.composition && !r.repeat_reason) violations.push(`scenes ${i - 1} and ${i} both use ${r.composition}; change one or state an editorial repeat_reason`); });
  for (const k of new Set(keys)) { const c = keys.filter((x) => x === k).length; if (c > maxUse) violations.push(`${k} is used ${c} times; the limit for ${n} scenes is ${maxUse}`); }
  rows.forEach((r) => { if (r.purpose === "statistic" && !DATA_TEMPLATES.has(r.visual_type)) violations.push(`scene ${r.scene} is a statistic but shows ${r.visual_type}; show the number, or change its purpose if no sourced figure exists`); });
  return { pass: violations.length === 0, violations, scenes: n, distinct_compositions: distinct, target_distinct: target, max_uses_allowed: maxUse, distinct_animations: new Set(rows.map((r) => r.animation)).size };
}

/* ───── Builders. Each draws inside c.top..BOTTOM, using only the palette and font in c. ───── */

export function makeContext({ id, inF, outF, top, P, font, nextZ, layers, vox = false }) {
  const span = Math.max(1, outF - inF);
  // Reveals are spread across the scene so each new element lands while it is being talked about.
  const at = (i, n) => inF + Math.round(span * (0.06 + (0.6 * i) / Math.max(1, n)));
  return { id, inF, outF, span, top, P, font, layers, vox, z: nextZ, at };
}

function label(c, key, s, o) {
  const f = fit(String(s), { maxW: o.maxW, maxLines: o.maxLines ?? 2, max: o.max, min: o.min ?? 24 });
  if (!f) throw new StageError("visual-plan", `"${s}" does not fit ${c.id}-${key}`);
  const h = f.lines.length * f.size * 1.12;
  const y = Math.round(o.middle !== undefined ? o.middle - h / 2 : o.y);
  c.layers.push(text(`${c.id}-${key}`, f.text, { x: o.x, w: o.w, y, size: f.size, weight: o.weight ?? 700, color: o.color ?? c.P.text, align: o.align ?? "center", inF: o.at ?? c.inF, outF: c.outF, z: c.z(), font: c.font, slide: o.slide ?? 0, slideX: o.slideX ?? 0 }));
  return { y, h, size: f.size };
}

function panel(c, key, rect, { background, at = c.inF, fromX = 0, fromY = 0, shadow = true, radius = c.vox ? 2 : 22 }) {
  const span = Math.max(1, c.outF - at), arrive = Math.min(12, span);
  c.layers.push(solid(`${c.id}-${key}`, { ...rect, background, boxShadow: shadow ? c.P.shadow : undefined, radius, inF: at, outF: c.outF, z: c.z(),
    keyframes: { opacity: [{ f: 0, v: 0, e: "outCubic" }, { f: arrive, v: 1 }, { f: span, v: 1 }], tx: [{ f: 0, v: fromX, e: "outCubic" }, { f: arrive + 4, v: 0 }, { f: span, v: 0 }], ty: [{ f: 0, v: fromY, e: "outCubic" }, { f: arrive + 4, v: 0 }, { f: span, v: 0 }] } }));
}

const line = (c, key, d, { color, width = 5, at = c.inF, drawFrames = 14, fill, ty }) => c.layers.push(stroke(`${c.id}-${key}`, d, { color: color ?? c.P.stroke, width, inF: at, outF: c.outF, z: c.z(), drawFrames, fill, ty }));
const circlePath = (x, y, r) => `M${x} ${y - r} A${r} ${r} 0 1 1 ${x} ${y + r} A${r} ${r} 0 1 1 ${x} ${y - r} Z`;
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

function sourceLine(c, sources) {
  const hosts = [...new Set((sources || []).map(hostOf).filter(Boolean))].slice(0, 2);
  if (hosts.length) label(c, "source", `Source: ${hosts.join(", ")}`, { y: 1484, maxW: 880, maxLines: 1, max: 28, min: 22, weight: 500, color: c.P.muted });
}

function flow(c, p) {
  const n = p.steps.length, bw = 780, bh = 124, x = (W - bw) / 2;
  const gap = Math.min(112, (BOTTOM - c.top - n * bh) / Math.max(1, n - 1));
  const y0 = Math.round(c.top + (BOTTOM - c.top - (n * bh + (n - 1) * gap)) / 2);
  p.steps.forEach((s, i) => {
    const at = c.at(i, n), y = Math.round(y0 + i * (bh + gap)), from = i % 2 ? 110 : -110, last = i === n - 1;
    panel(c, `step${i}`, { x, y, w: bw, h: bh }, { background: last ? c.P.accent : c.P.surface, at, fromX: from });
    label(c, `step${i}-t`, s, { x: x + 30, w: bw - 60, maxW: bw - 60, middle: y + bh / 2, max: 46, min: 28, color: last ? c.P.on_accent : c.P.text, at, slideX: from });
    if (!last) { const a = y + bh + 12, b = Math.round(y + bh + gap - 12); line(c, `arrow${i}`, `M540 ${a} L540 ${b} M524 ${b - 18} L540 ${b} L556 ${b - 18}`, { color: c.P.accent, width: 6, at: at + 10, drawFrames: 16 }); }
  });
}

function hub(c, p) {
  const cy = Math.round((c.top + BOTTOM) / 2), orbit = Math.min(350, (BOTTOM - c.top) / 2 - 110), cr = 124, nr = 102, n = p.spokes.length;
  p.spokes.forEach((s, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, x = Math.round(540 + Math.cos(a) * orbit), y = Math.round(cy + Math.sin(a) * orbit), at = c.at(i, n);
    line(c, `spoke${i}`, `M${Math.round(540 + Math.cos(a) * cr)} ${Math.round(cy + Math.sin(a) * cr)} L${Math.round(540 + Math.cos(a) * (orbit - nr))} ${Math.round(cy + Math.sin(a) * (orbit - nr))}`, { color: c.P.accent, width: 5, at, drawFrames: 14 });
    line(c, `node${i}`, circlePath(x, y, nr), { color: c.P.stroke, width: 4, fill: c.P.surface, at: at + 8, drawFrames: 12 });
    label(c, `node${i}-t`, s, { x: x - 92, w: 184, maxW: 172, maxLines: 3, middle: y, max: 34, min: 22, at: at + 12 });
  });
  line(c, "centre", circlePath(540, cy, cr), { color: c.P.accent, width: 6, fill: c.P.accent, at: c.inF, drawFrames: 10 });
  label(c, "centre-t", p.center, { x: 540 - 112, w: 224, maxW: 212, maxLines: 3, middle: cy, max: 42, min: 24, color: c.P.on_accent });
}

function stack(c, p) {
  const n = p.layers.length, cx = 320, hw = 240, hh = 82, pitch = Math.min(226, (BOTTOM - c.top - 2 * hh) / Math.max(1, n - 1));
  const y0 = Math.round(c.top + hh + (BOTTOM - c.top - 2 * hh - pitch * (n - 1)) / 2);
  p.layers.forEach((s, i) => {
    const y = Math.round(y0 + i * pitch), at = c.at(i, n), travel = Math.round((n / 2 - i) * 60), span = Math.max(1, c.outF - at);
    const ty = [{ f: 0, v: travel, e: "outCubic" }, { f: Math.min(20, span), v: 0 }, { f: span, v: 0 }];
    line(c, `plate${i}`, `M${cx - hw} ${y} L${cx} ${y - hh} L${cx + hw} ${y} L${cx} ${y + hh} Z`, { color: i === 0 ? c.P.accent : c.P.stroke, width: 5, fill: i === 0 ? c.P.accent : c.P.surface, at, drawFrames: 14, ty });
    line(c, `leader${i}`, `M${cx + hw} ${y} L${cx + hw + 56} ${y}`, { color: c.P.accent, width: 4, at: at + 16, drawFrames: 8 });
    label(c, `plate${i}-t`, s, { x: cx + hw + 72, w: 1032 - (cx + hw + 72), maxW: 1020 - (cx + hw + 72), maxLines: 3, middle: y, max: 44, min: 26, align: "left", at: at + 20, slideX: 40 });
  });
}

function cause(c, p) {
  const n = p.chain.length, bw = 500, bh = 200;
  const gap = Math.min(150, (BOTTOM - c.top - n * bh) / Math.max(1, n - 1));
  const y0 = Math.round(c.top + (BOTTOM - c.top - (n * bh + (n - 1) * gap)) / 2);
  p.chain.forEach((s, i) => {
    const left = i % 2 === 0, x = left ? 70 : W - 70 - bw, y = Math.round(y0 + i * (bh + gap)), at = c.at(i, n), last = i === n - 1;
    panel(c, `link${i}`, { x, y, w: bw, h: bh }, { background: last ? c.P.accent : c.P.surface, at, fromX: left ? -130 : 130 });
    label(c, `link${i}-t`, s, { x: x + 24, w: bw - 48, maxW: bw - 48, maxLines: 4, middle: y + bh / 2, max: 40, min: 26, color: last ? c.P.on_accent : c.P.text, at, slideX: left ? -50 : 50 });
    if (!last) {
      const x0 = left ? x + bw : x, y0a = y + bh, x1 = left ? W - 70 - bw / 2 : 70 + bw / 2, y1 = Math.round(y + bh + gap - 8);
      line(c, `curve${i}`, `M${x0} ${y0a - 30} C${x1} ${y0a - 30} ${x1} ${y0a} ${x1} ${y1} M${x1 - 18} ${y1 - 20} L${x1} ${y1} L${x1 + 18} ${y1 - 20}`, { color: c.P.accent, width: 6, at: at + 12, drawFrames: 20 });
    }
  });
}

function timeline(c, p) {
  const n = p.events.length, x = 270, top = c.top + 20, bottom = BOTTOM - 40, pitch = (bottom - top - 130) / Math.max(1, n - 1), drawFrames = Math.round(c.span * 0.72);
  line(c, "spine", `M${x} ${top} L${x} ${bottom}`, { color: c.P.accent, width: 7, drawFrames });
  p.events.forEach((e, i) => {
    const y = Math.round(top + 50 + i * pitch), at = c.inF + Math.round((drawFrames * (y - top)) / (bottom - top));
    line(c, `dot${i}`, circlePath(x, y, 18), { color: c.P.accent, width: 5, fill: c.P.accent, at, drawFrames: 8 });
    label(c, `date${i}`, e.date, { x: 60, w: 180, maxW: 180, maxLines: 2, middle: y, max: 42, min: 24, align: "left", color: c.P.accent, at, slideX: -30 });
    label(c, `event${i}`, e.label, { x: 320, w: 690, maxW: 680, maxLines: 3, middle: y, max: 46, min: 28, align: "left", at: at + 4, slideX: 50 });
  });
  sourceLine(c, p.sources);
}

function bars(c, p) {
  const n = p.bars.length, max = Math.max(...p.bars.map((b) => Number(b.value))), full = 860, y0 = c.top + 50, rowH = Math.min(240, (BOTTOM - 40 - y0) / n);
  p.bars.forEach((b, i) => {
    const y = Math.round(y0 + i * rowH), at = c.at(i, n), value = Number(b.value);
    // Length is the value's true share of the largest bar, from zero. Nothing is floored to look bigger.
    const length = max > 0 ? Math.round((value / max) * full) : 0;
    label(c, `bar${i}-l`, b.label, { x: 90, w: 620, maxW: 610, maxLines: 1, y, max: 42, min: 26, align: "left", color: c.P.muted, weight: 600, at });
    label(c, `bar${i}-v`, `${p.prefix || ""}${b.value}${p.suffix || ""}`, { x: 730, w: 262, maxW: 260, maxLines: 1, y: y - 4, max: 50, min: 30, align: "left", weight: 800, at: at + 12 });
    line(c, `bar${i}`, `M90 ${y + 92} L${90 + Math.max(1, length)} ${y + 92}`, { color: i === 0 ? c.P.accent : c.P.text, width: 44, at, drawFrames: 22 });
  });
  label(c, "unit", `${p.unit}. Bars start at zero.`, { y: y0 + n * rowH - 8, maxW: 880, maxLines: 1, max: 30, min: 22, weight: 500, color: c.P.muted, at: c.at(n, n + 1) });
  sourceLine(c, p.sources);
}

function lineChart(c, p) {
  const n = p.points.length, x0 = 150, x1 = 950, yTop = c.top + 120, yBase = 1290;
  const max = Math.max(...p.points.map((q) => Number(q.value))) || 1;
  const xy = p.points.map((q, i) => [Math.round(x0 + (i * (x1 - x0)) / (n - 1)), Math.round(yBase - (Number(q.value) / max) * (yBase - yTop))]);
  const drawFrames = Math.round(c.span * 0.6);
  line(c, "axis", `M${x0 - 40} ${yTop - 40} L${x0 - 40} ${yBase} L${x1 + 60} ${yBase}`, { color: c.P.stroke, width: 5, drawFrames: 12 });
  line(c, "plot", "M" + xy.map((q) => q.join(" ")).join(" L"), { color: c.P.accent, width: 9, at: c.inF + 8, drawFrames });
  xy.forEach(([x, y], i) => {
    const at = c.inF + 8 + Math.round((drawFrames * i) / (n - 1));
    line(c, `pt${i}`, circlePath(x, y, 15), { color: c.P.accent, width: 5, fill: c.P.accent, at, drawFrames: 6 });
    label(c, `pt${i}-v`, `${p.prefix || ""}${p.points[i].value}${p.suffix || ""}`, { x: x - 95, w: 190, maxW: 186, maxLines: 1, y: y - 74, max: 40, min: 24, weight: 800, at });
    label(c, `pt${i}-x`, p.points[i].x, { x: x - 95, w: 190, maxW: 186, maxLines: 1, y: yBase + 24, max: 34, min: 22, color: c.P.muted, weight: 600, at });
  });
  label(c, "unit", `${p.unit}. Axis starts at zero.`, { y: yBase + 96, maxW: 880, maxLines: 1, max: 30, min: 22, weight: 500, color: c.P.muted, at: c.at(2, 3) });
  sourceLine(c, p.sources);
}

function counter(c, p) {
  const value = Number(p.value), decimals = (String(p.value).split(".")[1] || "").length, group = Math.abs(value) >= 1000;
  const finalText = `${p.prefix || ""}${group ? value.toLocaleString("en-US", { minimumFractionDigits: decimals }) : value.toFixed(decimals)}${p.suffix || ""}`;
  const f = fit(finalText, { maxW: 900, maxLines: 1, max: 230, min: 80 });
  if (!f) throw new StageError("visual-plan", `counter ${finalText} does not fit`);
  const y = Math.round((c.top + BOTTOM) / 2 - f.size / 2 - 100);
  const big = text(`${c.id}-count`, finalText, { y, size: f.size, weight: 800, color: c.P.accent, inF: c.inF, outF: c.outF, z: c.z(), font: c.font, slide: 0 });
  big.count = { from: 0, to: value, decimals, prefix: p.prefix || "", suffix: p.suffix || "", group };
  big.props.count = 0;
  big.keyframes.count = [{ f: 0, v: 0, e: "linear" }, { f: Math.max(2, Math.round(c.span * 0.55)), v: 1, e: "outCubic" }, { f: c.span, v: 1 }];
  c.layers.push(big);
  const ruleY = Math.round(y + f.size * 1.12 + 30);
  line(c, "rule", `M190 ${ruleY} L890 ${ruleY}`, { color: c.P.stroke, width: 6, drawFrames: Math.round(c.span * 0.8) });
  label(c, "what", p.label, { y: ruleY + 44, maxW: 880, maxLines: 3, max: 56, min: 34, at: c.at(1, 2), slide: 26 });
  sourceLine(c, p.sources);
}

function proportion(c, p) {
  const r = 260, cy = Math.round((c.top + BOTTOM) / 2 - 90), frac = Math.min(0.9995, Number(p.part) / Number(p.total));
  const angle = -Math.PI / 2 + frac * 2 * Math.PI, ex = Math.round(540 + Math.cos(angle) * r), ey = Math.round(cy + Math.sin(angle) * r);
  line(c, "track", circlePath(540, cy, r), { color: c.P.surface, width: 54, drawFrames: 8 });
  line(c, "share", `M540 ${cy - r} A${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${ex} ${ey}`, { color: c.P.accent, width: 54, at: c.inF + 6, drawFrames: Math.max(12, Math.round(c.span * 0.55)) });
  // A percentage is shown only when the source states one; otherwise the two cited counts are shown.
  label(c, "centre", p.percent ? `${p.part}%` : `${p.part} of ${p.total}`, { x: 540 - 200, w: 400, maxW: 390, maxLines: 1, middle: cy, max: 110, min: 44, weight: 800, at: c.at(1, 2) });
  label(c, "what", p.label, { y: cy + r + 66, maxW: 880, maxLines: 3, max: 50, min: 32, at: c.at(1, 2), slide: 24 });
  sourceLine(c, p.sources);
}

function ranked(c, p) {
  const n = p.items.length, rowH = Math.min(190, (BOTTOM - 40 - c.top) / n), y0 = c.top + 20;
  p.items.forEach((s, i) => {
    const y = Math.round(y0 + i * rowH), at = c.at(i, n);
    line(c, `badge${i}`, circlePath(150, y + 62, 56), { color: c.P.accent, width: 4, fill: i === 0 ? c.P.accent : c.P.surface, at, drawFrames: 8 });
    label(c, `rank${i}`, String(i + 1), { x: 110, w: 80, maxW: 76, maxLines: 1, middle: y + 62, max: 52, min: 30, weight: 800, color: i === 0 ? c.P.on_accent : c.P.text, at });
    label(c, `item${i}`, s, { x: 240, w: 770, maxW: 760, maxLines: 2, middle: y + 62, max: 48, min: 28, align: "left", at, slideX: 130 });
    if (i < n - 1) line(c, `sep${i}`, `M240 ${y + rowH - 16} L990 ${y + rowH - 16}`, { color: c.P.stroke, width: 3, at: at + 8, drawFrames: 14 });
  });
  sourceLine(c, p.sources);
}

function beforeAfter(c, p) {
  const h = Math.min(450, (BOTTOM - c.top - 70) / 2), x = 90, w = 900, sides = [["before", c.top, -140, c.P.surface, c.P.text], ["after", c.top + h + 70, 140, c.P.panel, c.P.accent]];
  sides.forEach(([side, y0, from, background, titleColor], i) => {
    const y = Math.round(y0), at = c.at(i, 2), data = p[side] || {};
    panel(c, side, { x, y, w, h: Math.round(h) }, { background, at, fromX: from });
    label(c, `${side}-t`, String(data.title).toUpperCase(), { x: x + 40, w: w - 80, maxW: w - 80, maxLines: 1, y: y + 34, max: 54, min: 32, align: "left", color: titleColor, weight: 800, at, slideX: from / 2 });
    (data.points || []).slice(0, 2).forEach((pt, k) => label(c, `${side}-p${k}`, pt, { x: x + 40, w: w - 80, maxW: w - 80, maxLines: 2, y: y + 118 + k * 130, max: 44, min: 28, weight: 500, at: at + 8 + k * 10, slideX: from / 2 }));
  });
  const ay = Math.round(c.top + h + 12);
  line(c, "turn", `M540 ${ay} L540 ${ay + 44} M522 ${ay + 26} L540 ${ay + 44} L558 ${ay + 26}`, { color: c.P.accent, width: 7, at: c.at(1, 2), drawFrames: 10 });
}

function conclusion(c, p) {
  const text_ = String(p.headline).toUpperCase() === p.headline ? p.headline : c.vox ? p.headline : p.headline.toUpperCase();
  const x = 60, y = c.top - 30, w = 960, h = BOTTOM - y;
  if (c.vox) {
    line(c, "rule-a", `M120 ${y + 60} L960 ${y + 60}`, { color: c.P.accent, width: 4, drawFrames: 18 });
    line(c, "rule-b", `M120 ${y + h - 60} L960 ${y + h - 60}`, { color: c.P.accent, width: 4, at: c.at(1, 2), drawFrames: 18 });
    label(c, "close", text_, { x: 120, w: 840, maxW: 830, maxLines: 6, middle: y + h / 2, max: 96, min: 54, slideX: -60 });
    return;
  }
  panel(c, "close-panel", { x, y, w, h }, { background: c.P.accent, fromY: 170 });
  label(c, "close", text_, { x: x + 60, w: w - 120, maxW: w - 120, maxLines: 6, middle: y + h / 2, max: 112, min: 54, weight: 800, color: c.P.on_accent, slide: 40 });
  line(c, "close-rule", `M260 ${y + h - 130} L820 ${y + h - 130}`, { color: c.P.on_accent, width: 8, at: c.at(1, 2), drawFrames: 18 });
}

export const BUILDERS = { flow, hub, stack, cause, timeline, bars, line: lineChart, counter, proportion, ranked, before_after: beforeAfter, conclusion };

/** The planner's guide. Examples, not rules: the subject decides. */
export function vocabularyGuide(templates) {
  const spec = {
    flow: '{"steps":["2-5 words"]} 3-4 steps of a process',
    hub: '{"center":"1-3 words","spokes":["1-3 words"]} 3-5 things connected to one thing',
    stack: '{"layers":["1-4 words"]} 3-4 parts of one thing, top to bottom: an exploded view',
    cause: '{"chain":["short clause"]} 2-3 links where each causes the next',
    timeline: '{"events":[{"date":"1400 BC","label":"up to 6 words","fact":FACT}]} 3-4 dated events in order',
    bars: '{"bars":[{"label":"1-3 words","value":NUMBER,"fact":FACT}],"unit":"what is counted","prefix":"$ or empty","suffix":"% or empty"} 2-4 values in one unit',
    line: '{"points":[{"x":"period","value":NUMBER,"fact":FACT}],"unit":"","prefix":"","suffix":""} 3-5 points over time, one unit',
    counter: '{"value":NUMBER,"fact":FACT,"prefix":"","suffix":"","label":"what the number is"} one number',
    proportion: '{"part":NUMBER,"total":NUMBER,"fact":FACT,"label":"what the share is"} part of a whole; total 100 only if the fact states a percentage',
    ranked: '{"items":["name"],"fact":FACT} 3-5 named items in the order a fact ranks them',
    before_after: '{"before":{"title":"1-2 words","points":["up to 6 words"]},"after":{"title":"1-2 words","points":["up to 6 words"]}}',
    conclusion: '{"headline":"up to 9 words"} a distinct closing statement',
  };
  return templates.filter((t) => spec[t]).map((t) => `- ${t}: ${spec[t]}`).join("\n");
}

export const PURPOSE_GUIDE = `Decide what each scene is for, then choose what explains it best. Typical pairings, not rules:
concept: large type and a diagram. process: flow. statistic: bars, line, counter or proportion. comparison: compare or before_after. sequence: timeline. relationship: hub. geography: map. historical evidence: annotated photograph. object: stack. conclusion: conclusion.
Rules for honest data: FACT is the number of the fact below that literally contains that value. Use only values written there. Never estimate, round, or combine. Never chart unlike units together. If a sentence has no sourced figure, do not use a chart.
Rules for variety: never use the same template in two consecutive scenes unless you add "repeat_reason" explaining why repetition helps. Use one layout for at most 40% of scenes.`;

export const numberedFacts = (facts) => facts.map((f, i) => `${i}. ${f.text}`).join("\n").slice(0, 6000);
