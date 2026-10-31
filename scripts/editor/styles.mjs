/**
 * Five looks for the automatic editor, one per design skill the owner picked to compare (2026-10-30):
 *   1 anti-slop      (design-anti-slop): flat colour only, no gradients/glow/grids, one hard-edged accent, type sized by importance
 *   2 hallmark       (hallmark): editorial paper tag with serif figure, locked tokens, restrained duotone-ish photo grade
 *   3 vox            (vox-style-treatment): desaturated editorial photo grade + vignette, ONE accent used for a hand-drawn circle/underline
 *   4 scene-director (scene-director): the layout follows the scene's FUNCTION (hook = hero figure, evidence = small chip, payoff = flat poster)
 *   5 mograph-critic (mograph-critic): everything on one grid, lower-third strip, staggered entrance, one baseline
 *
 * A style never adds words. A figure overlay is the number the sentence states (and a bar of its exact share) plus the source host.
 * The caption carries the sentence, so nothing repeats it. All overlays are transparent SVGs drawn over the scene's photo.
 */
import { xmlEscape } from "./cards.mjs";

export const STYLE_NAMES = { 1: "anti-slop", 2: "hallmark", 3: "vox", 4: "scene-director", 5: "mograph-critic" };
const F = "Arial, Helvetica, sans-serif";
/** Largest font size (<= base) at which `raw` fits `width` px; bold sans digits are about 0.62 em wide. */
export const fitSize = (raw, base, width = 880) => Math.max(56, Math.min(base, Math.floor(width / (Math.max(1, String(raw).length) * 0.64))));
const SERIF = "Georgia, 'Times New Roman', serif";
/** A light scrim only along the bottom of a photo (behind the kicker and the caption plate): the photo itself is not darkened. */
const SCRIM = "linear-gradient(to top, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.14) 34%, rgba(0,0,0,0) 62%)";
const svg = (inner, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">\n${bg ? `  <rect width="1080" height="1920" fill="${xmlEscape(bg)}"/>\n` : ""}${inner}\n</svg>\n`;
const text = (x, y, size, fill, body, extra = "") => `  <text x="${x}" y="${y}" fill="${xmlEscape(fill)}" font-family="${extra.includes("serif") ? SERIF : F}" font-size="${size}" ${extra.replace("serif", "")}>${xmlEscape(body)}</text>`;
const firstPercent = (figs) => figs.find((f) => f.kind === "percent" && f.value >= 0 && f.value <= 100);
const src = (source) => (source ? `Source: ${source}` : "");

/** fn: the scene's function in the video, from its position. */
export function functionOf(i, n) {
  if (i === 0) return "hook";
  if (i === n - 1) return "payoff";
  return i === 1 ? "setup" : "evidence";
}

export function styleFor(n, pal) {
  const accent = pal.accent;
  const ink = "#101114";
  switch (Number(n)) {
    case 1: return {
      name: "anti-slop", scrim: SCRIM, filter: { saturate: 0.95, brightness: 1 }, stagger: 0,
      figure: ({ figs, source }) => {
        const f = figs[0]; const bar = firstPercent(figs);
        return svg([text(90, 1010, fitSize(f.raw, 250), "#FFFFFF", f.raw, 'font-weight="800"'),
          bar ? `  <rect x="90" y="1050" width="${(9 * bar.value).toFixed(1)}" height="22" fill="${xmlEscape(accent)}"/>` : `  <rect x="90" y="1050" width="160" height="22" fill="${xmlEscape(accent)}"/>`,
          text(90, 1120, 24, "#D6D8DE", src(source))].join("\n"));
      },
      poster: ({ phrase }) => svg(phrase.map((w, k) => text(90, 760 + k * 150, fitSize(w, 128, 700), k === phrase.length - 1 ? accent : pal.text, w, 'font-weight="800"')).join("\n"), pal.bg),
    };
    case 2: return {
      name: "hallmark", scrim: SCRIM, filter: { sepia: 0.16, saturate: 0.62, brightness: 1 }, stagger: 0,
      figure: ({ figs, source }) => {
        const f = figs[0]; const size = fitSize(f.raw, 200, 720); const w = Math.min(900, 150 + Math.ceil(f.raw.length * size * 0.56));
        return svg([`  <rect x="90" y="930" width="${w}" height="330" fill="#EFE8D8"/>`, `  <rect x="90" y="930" width="${w}" height="8" fill="${xmlEscape(accent)}"/>`,
          text(130, 1130, size, ink, f.raw, 'serif font-weight="400"'),
          text(130, 1215, 22, "#4A463C", src(source).toUpperCase(), 'letter-spacing="3"')].join("\n"));
      },
      poster: ({ phrase }) => svg([`  <rect x="90" y="560" width="900" height="6" fill="${xmlEscape(accent)}"/>`, ...phrase.map((w, k) => text(90, 740 + k * 140, fitSize(w, 118, 700), pal.text, w, 'serif'))].join("\n"), pal.bg),
    };
    case 3: return {
      name: "vox", scrim: `${SCRIM}, radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.26) 100%)`, filter: { sepia: 0.1, saturate: 0.55, brightness: 1 }, stagger: 0,
      figure: ({ figs, source }) => {
        const f = figs[0]; const cx = 540; const w = Math.min(860, 120 + f.raw.length * 120);
        return svg([text(cx, 930, fitSize(f.raw, 250), "#FFFFFF", f.raw, 'text-anchor="middle" font-weight="900"'),
          `  <path d="M${cx - w / 2} 860 C ${cx - w / 2} 700, ${cx + w / 2 - 20} 690, ${cx + w / 2} 830 C ${cx + w / 2 + 6} 990, ${cx - w / 2 + 40} 1010, ${cx - w / 2 + 6} 880" fill="none" stroke="${xmlEscape(accent)}" stroke-width="9" stroke-linecap="round"/>`,
          text(cx, 1090, 22, "#C9C9C9", src(source), 'text-anchor="middle"')].join("\n"));
      },
      poster: ({ phrase }) => svg([...phrase.map((w, k) => text(90, 800 + k * 150, fitSize(w, 120, 700), pal.text, w, 'font-weight="900"')), `  <path d="M90 ${830 + (phrase.length - 1) * 150} q 120 -22 240 0 t 240 0" fill="none" stroke="${xmlEscape(accent)}" stroke-width="9" stroke-linecap="round"/>`].join("\n"), pal.bg),
    };
    case 4: return {
      name: "scene-director", scrim: SCRIM, filter: { saturate: 0.9, brightness: 1 }, stagger: 0,
      figure: ({ figs, source, fn }) => {
        const f = figs[0];
        const chipSize = fitSize(f.raw, 100, 640);
        if (fn === "hook") return svg([text(540, 980, fitSize(f.raw, 340), "#FFFFFF", f.raw, 'text-anchor="middle" font-weight="900"'), `  <rect x="340" y="1020" width="400" height="12" fill="${xmlEscape(accent)}"/>`].join("\n"));
        if (fn === "payoff") return svg([text(90, 900, fitSize(f.raw, 330), ink, f.raw, 'font-weight="900"'), text(90, 990, 26, ink, src(source), 'font-weight="700"')].join("\n"), accent);
        return svg([`  <rect x="90" y="300" width="${Math.min(760, 60 + Math.ceil(f.raw.length * chipSize * 0.66))}" height="150" fill="${xmlEscape(accent)}"/>`, text(120, 410, chipSize, ink, f.raw, 'font-weight="900"')].join("\n"));
      },
      payoffIsPoster: true,
      poster: ({ phrase }) => svg(phrase.map((w, k) => text(90, 800 + k * 150, fitSize(w, 120, 700), k === 0 ? accent : pal.text, w, 'font-weight="900"')).join("\n"), pal.bg),
    };
    case 5: return {
      name: "mograph-critic", scrim: SCRIM, filter: { saturate: 0.95, brightness: 1 }, stagger: 9,
      figure: ({ figs, source }) => {
        const f = figs[0]; const bar = firstPercent(figs);
        return svg([`  <rect x="0" y="1130" width="1080" height="300" fill="rgba(5,5,8,0.78)"/>`, `  <rect x="96" y="1166" width="120" height="6" fill="${xmlEscape(accent)}"/>`,
          text(96, 1352, fitSize(f.raw, 170, 880), "#FFFFFF", f.raw, 'font-weight="800"'),
          text(984, 1352, 22, "#C7CAD1", src(source), 'text-anchor="end"'),
          bar ? `  <rect x="96" y="1394" width="888" height="8" fill="rgba(255,255,255,0.18)"/><rect x="96" y="1394" width="${(8.88 * bar.value).toFixed(1)}" height="8" fill="${xmlEscape(accent)}"/>` : ""].join("\n"));
      },
      poster: ({ phrase }) => svg([`  <rect x="96" y="640" width="120" height="6" fill="${xmlEscape(accent)}"/>`, ...phrase.map((w, k) => text(96, 780 + k * 140, fitSize(w, 112, 700), pal.text, w, 'font-weight="800"'))].join("\n"), pal.bg),
    };
    default: throw new Error(`unknown style ${n}`);
  }
}

/**
 * A short, readable phrase from a sentence for a poster when nothing else can show it: the best run of consecutive content words
 * (up to four), preferring a run that holds a name, a year or a number; split over lines of at most two words. Never the three longest words
 * pulled from different places ("VINTAGE ALLEYWAY DESPERATE"), which read as noise.
 */
export function keyPhrase(sentence) {
  const stop = new Set("the a an of to in on at for and or but is are was were be been it its this that these those with by from as than then when while which who whom what where how why not no yes will would can could may might has have had do does did into over under about after before more most less least very just only also across around through during between against within without".split(" "));
  const tokens = String(sentence).replace(/[^\p{L}\p{N}%$'\s-]/gu, " ").split(/\s+/).filter(Boolean);
  const runs = [];
  let cur = [];
  for (const w of tokens) {
    if (!stop.has(w.toLowerCase()) && w.length > 2) cur.push(w);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  if (!runs.length) return [];
  const score = (r) => Math.min(r.length, 4) + (r.some((w, i) => /\d/.test(w) || (i > 0 && /^[A-Z]/.test(w))) ? 2 : 0);
  const best = runs.reduce((x, y) => (score(y) > score(x) ? y : x)).slice(0, 4).map((w) => w.toUpperCase());
  const lines = [];
  for (let i = 0; i < best.length; i += 2) lines.push(best.slice(i, i + 2).join(" "));
  return lines;
}
