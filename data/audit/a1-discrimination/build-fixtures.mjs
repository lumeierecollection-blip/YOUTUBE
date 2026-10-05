/**
 * A1 discrimination fixtures — FROZEN.
 *
 * Purpose (plan-vs-render audit, append A1): find out, per component, whether it can
 * tell a designed frame from a fallback frame. Two components disagree about this in
 * production: the QA gate fails a run on "visual variety" while the verifier praises
 * "uniform white ground". One of them is inverted.
 *
 * Frame A — the FALLBACK SIGNATURE. Uniform white ground, caption-layer text only
 *   (word-by-word narration band + NN/NN page counter). Nothing else: no headline,
 *   no numeral, no graphic. This is the frame the fresh audit flagged 22/27 times.
 *
 * Frame B — varied ground, composed scene, as A1 specifies.
 *
 * Frame B' — ADDED, not in the A1 spec: white ground WITH the same composed elements
 *   as B. Without it the verdict is unreadable. If the verifier scores B > A but
 *   B' ~ A, its "variety" signal is about the ground alone and not about composition.
 *   With B', correct / ground-only / inverted are distinguishable instead of a single
 *   bit. Flagged as an extension wherever it is used.
 *
 * Colours are NOT invented: all six come from ch-1 in config/channels.json —
 *   primary #0F172A, secondary #1E293B, accent #22C55E, bg #0A1020,
 *   canvas_accent #1B7A4D. Note ch-1 declares bg #0A1020 (dark) AND bg_mode "white":
 *   the canvas pipeline overrides its own dark background to white. Frame B is
 *   therefore the channel's configured background, not a fabricated one.
 *
 * Frame B is synthetic BY NECESSITY: local-audit.cjs canvas-ground (luma >= 245 on
 * every non-full-bleed beat) makes a varied ground unproducible by this pipeline. All
 * 27 real beats in run-37323030454 measured uniform white. A B drawn from real output
 * could not test what A1 is testing.
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const W = 1080, H = 1920;
const C = { primary: "#0F172A", secondary: "#1E293B", accent: "#22C55E", bg: "#0A1020", canvas_accent: "#1B7A4D", muted: "#94A3B8", mutedLight: "#475569", ruleDark: "#1E293B", ruleLight: "#E2E8F0" };
const NARRATION = "Over forty percent of borrowers immediately throw extra cash at high-interest debt first.";
// Break on a WORD boundary. The first pass sliced at char 52 and rendered
// "ex / tra" mid-word, which risks the model reporting broken text as a separate
// finding and confusing the axis under test.
const CUT = NARRATION.indexOf(" extra ");
const LINE1 = NARRATION.slice(0, CUT), LINE2 = NARRATION.slice(CUT + 1);

// The automatic layer, identical on all three frames so the pair differs ONLY in
// ground + composed content.
const autoLayer = (type, page) => `
  <text x="990" y="96" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${type}" text-anchor="end">01 / 01</text>
  <line x1="90" y1="1548" x2="990" y2="1548" stroke="${type}" stroke-opacity="0.18" stroke-width="2"/>
  <text x="540" y="1622" font-family="Inter, Helvetica, Arial, sans-serif" font-size="44" fill="${type}" text-anchor="middle">${LINE1}</text>
  <text x="540" y="1688" font-family="Inter, Helvetica, Arial, sans-serif" font-size="44" fill="${type}" text-anchor="middle">${LINE2}</text>`;

const fallbackOnly = (type) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  ${autoLayer(type)}
</svg>`;

const composed = ({ ground, type, accent, rule, panel }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${panel || ground}"/>
      <stop offset="100%" stop-color="${ground}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="88" y="742" font-family="Georgia, 'Times New Roman', serif" font-size="330" fill="${type}">40%</text>
  <rect x="90" y="806" width="430" height="14" fill="${accent}"/>
  <text x="90" y="884" font-family="Inter, Helvetica, Arial, sans-serif" font-size="33" fill="${type}" opacity="0.62" letter-spacing="3">OVER 40% OF BORROWERS</text>
  <text x="990" y="286" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${type}" text-anchor="end">Smart planners</text>
  <text x="990" y="366" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${type}" text-anchor="end">divide the excess first</text>
  <line x1="90" y1="1128" x2="990" y2="1128" stroke="${rule}" stroke-width="3"/>
  <circle cx="700" cy="1128" r="13" fill="${accent}"/>
  <text x="90" y="1196" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${type}" opacity="0.5">Q3 2026 borrower survey, n = 1,204</text>
  ${autoLayer(type)}
</svg>`;

const FRAMES = {
  // uniform white ground, caption-layer text ONLY — the fallback signature
  "frame-A-fallback-white-caption-only.png": fallbackOnly("#0F172A"),
  // varied ground + composed scene (A1's B): the channel's own dark bg
  "frame-B-varied-ground-composed.png": composed({ ground: C.bg, type: "#FFFFFF", accent: C.accent, rule: C.ruleDark, panel: C.primary }),
  // EXTENSION: white ground + the SAME composed elements — isolates ground from composition
  "frame-Bprime-white-ground-composed.png": composed({ ground: "#FFFFFF", type: C.primary, accent: C.canvas_accent, rule: C.ruleLight, panel: null }),
};

const dir = "data/audit/a1-discrimination/fixtures";
mkdirSync(dir, { recursive: true });
const manifest = { frozen: new Date().toISOString(), size: `${W}x${H}`, source: "synthetic — see header for why B cannot come from this pipeline", colors: C, channel: "1 (config/channels.json)", frames: {} };
for (const [name, svg] of Object.entries(FRAMES)) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(`${dir}/${name}`, png);
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (const v of data) if (v < 200) ink++;
  manifest.frames[name] = { sha256: createHash("sha256").update(png).digest("hex"), bytes: png.length, size: `${info.width}x${info.height}`, ink_fraction: Number((ink / data.length).toFixed(4)) };
  console.log(`${name}: ${info.width}x${info.height}, ink ${(ink / data.length * 100).toFixed(2)}%, sha ${manifest.frames[name].sha256.slice(0, 12)}`);
}
writeFileSync(`${dir}/fixtures.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nfrozen -> ${dir}/fixtures.json (sha256 per frame; a changed hash means a fixture was edited, which voids A1)`);