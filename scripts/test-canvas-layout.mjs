// node scripts/test-canvas-layout.mjs — every full-canvas layout, with and
// without a header, against the rules local-audit.cjs applies on every
// render: content spans >= 60% of the frame height (CNV-02, by layout here),
// every box inside the frame less 48 px, nothing but a photo in the caption
// band (CNV-01). A layout that only passes when the planner writes a headline
// fails here, not in CI (runs 36498049819 / 36504143080).
// Since the typography rebuild it also checks the grid rules (canvas-layout.js):
// no centred text, every text box anchored to a column edge on the side it is
// aligned to, no two text boxes overlapping, both variants (left / right).
import { canvasLayout, contentBounds, GRID, cellsOf } from "../src/skills/remotion-render/visual/canvas-layout.js";

const heads = [
  { name: "no header", h: {} },
  { name: "headline", h: { headline: "rates are rising fast" } },
  { name: "kicker+headline", h: { lead_in: "since the ruling", headline: "rates are rising fast" } },
];
const bodies = [
  { visual_type: "TYPE", headline: "WHY THE RULE BREAKS" },
  { visual_type: "TYPE" },
  { visual_type: "COUNTER", data: { value: "$352 million", label: "stolen in two blocks" } },
  { visual_type: "COUNTER", data: { value: "23", label: "countries" } },
  { visual_type: "BAR", data: { bars: [{ label: "needs", value: "50%" }, { label: "wants", value: "30%" }, { label: "savings", value: "20%" }] } },
  { visual_type: "BAR", data: { bars: [{ label: "a very long label here", value: "5" }, { label: "b", value: "7" }, { label: "c", value: "9" }, { label: "d", value: "2" }] } },
  { visual_type: "PIE", data: { percent: 34, label: "of income" } },
  { visual_type: "GAUGE", data: { percent: 80, label: "promotion barrier" } },
  { visual_type: "LINE", data: { points: [{ label: "2022", value: "2%" }, { label: "2026", value: "4.5%" }] } },
  { visual_type: "MAP", data: { place: "Iran" } },
  { visual_type: "PROCESS", data: { nodes: ["higher rates", "rent", "savings"] } },
  { visual_type: "PROCESS", data: { nodes: ["sloppy communication", "sloppy thinking"] } },
  { visual_type: "PHOTO", photo: { asset: "x.jpg", entity: "Jerome Powell" }, headline: "the fed holds" },
  { visual_type: "CUTOUT", cutout: { asset: "c.png", isolated: true, transparent: 0.5 } },
];
let fail = 0;
const colStarts = GRID.cols.map((c) => c[0]), colEnds = GRID.cols.map((c) => c[1]);
const TEXT = ["kicker", "headline", "statement", "number", "label", "emphasis"];
for (const variant of [0, 1]) for (const b of bodies) for (const { name, h } of heads) {
  const c = { ...b, variant, ...(b.visual_type === "TYPE" && !h.headline ? {} : h) };
  const L = canvasLayout(c);
  const cb = contentBounds(L);
  const span = cb ? cb.h / 1920 : 0;
  const bad = [];
  if (span < 0.61) bad.push(`span ${(span * 100).toFixed(1)}%`);
  if (!cb) bad.push("no content");
  for (const [k, v] of Object.entries(L.boxes)) {
    if (k === "bottom" || k === "photo") continue;
    for (const x of Array.isArray(v) ? v : [v]) {
      if (!x || typeof x !== "object" || !("x" in x)) continue;
      if (x.x < 48 || x.y < 48 || x.x + x.w > 1032 || x.y + x.h > 1872) bad.push(`${k} (${x.x},${x.y},${x.x + x.w},${x.y + x.h}) outside the safe area`);
      if (x.y + x.h > 1450.5 && x.y < 1610) bad.push(`${k} enters the caption band (y ${x.y}-${x.y + x.h})`);
    }
  }
  // Grid rules: text is never centred, is anchored to a column edge on the
  // side it is aligned to, and text boxes do not overlap.
  const texts = Object.entries(L.boxes).filter(([k, v]) => TEXT.includes(k) && v && "x" in v);
  for (const [k, v] of texts) {
    if (v.align === "center") bad.push(`${k} is centred`);
    if (!v.align) bad.push(`${k} has no alignment`);
    if (k === "label") continue;                                   // attaches to its data
    if (v.rotate) continue;
    const onEdge = v.align === "right" ? colEnds.includes(v.x + v.w) || v.x + v.w === 1032 : colStarts.includes(v.x);
    if (!onEdge) bad.push(`${k} (${v.x}..${v.x + v.w}) is not anchored to a column edge (${v.align}-aligned)`);
    if (Math.abs(v.x + v.w / 2 - 540) < 20 && v.w < 700) bad.push(`${k} sits on the frame's centre line`);
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i][1], d = texts[j][1];
    if (a.x < d.x + d.w - 2 && d.x < a.x + a.w - 2 && a.y < d.y + d.h - 2 && d.y < a.y + a.h - 2) bad.push(`text boxes ${texts[i][0]} and ${texts[j][0]} overlap`);
  }
  const label = `${L.composition} ${b.visual_type}${b.data?.nodes ? `/${b.data.nodes.length}` : ""} v${variant} [${name}]`;
  if (bad.length) { fail++; console.log(`FAIL ${label}: ${bad.join("; ")}`); } else console.log(`ok   ${label}: span ${(span * 100).toFixed(1)}%`);
}
console.log(fail ? `${fail} FAILED` : "all pass");
process.exit(fail ? 1 : 0);
