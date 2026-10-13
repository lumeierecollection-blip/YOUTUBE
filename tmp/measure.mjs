import { measure, fitHeadline, HEADLINE_FLOOR, ROLE_HEADLINE } from "../src/skills/remotion-render/visual/typography.js";
import { L_EDGE, R_EDGE } from "../src/skills/remotion-render/visual/canvas-layout.js";

const full = R_EDGE - L_EDGE;
const o = { family: ROLE_HEADLINE.family, weight: ROLE_HEADLINE.weight, tracking: ROLE_HEADLINE.tracking };
console.log(`safe width = ${full}px   family = ${ROLE_HEADLINE.family}   floor = ${HEADLINE_FLOOR}px\n`);

const cases = [
  ["ch-26", "Australia"],
  ["ch-49", "27.5 million dollar opening of Other Mommy"],
  ["ch-5", "$672 million"],
  ["ch-5", "$672 million in assets"],
  ["ch-49", "OTHER MOMMY"],
];
for (const [ch, text] of cases) {
  const f = fitHeadline(text, full, { maxLines: 4 });
  const widths = f.lines.map((l) => Math.round(measure(l, f.size, o)));
  const worst = Math.max(...widths);
  console.log(`${ch} "${text}"`);
  console.log(`   size ${f.size}px  lines ${JSON.stringify(f.lines)}`);
  console.log(`   line widths ${JSON.stringify(widths)}  worst ${worst} / ${full} -> ${worst > full ? "OVERFLOW -> CLIPPED" : "fits"}`);
  console.log("");
}