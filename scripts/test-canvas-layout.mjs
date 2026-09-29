// node scripts/test-canvas-layout.mjs — every full-canvas layout, with and
// without a header, against the rules local-audit.cjs applies on every
// render: content spans >= 60% of the frame height (CNV-02, by layout here),
// every box inside the frame less 48 px, nothing but a photo in the caption
// band (CNV-01). A layout that only passes when the planner writes a headline
// fails here, not in CI (runs 36498049819 / 36504143080).
import { canvasLayout, contentBounds } from "../src/skills/remotion-render/visual/canvas-layout.js";

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
for (const b of bodies) for (const { name, h } of heads) {
  const c = { ...b, ...(b.visual_type === "TYPE" && !h.headline ? {} : h) };
  const L = canvasLayout(c);
  const cb = contentBounds(L);
  const span = cb ? cb.h / 1920 : 0;
  const bad = [];
  if (span < 0.61) bad.push(`span ${(span * 100).toFixed(1)}%`);
  for (const [k, v] of Object.entries(L.boxes)) {
    if (k === "bottom" || k === "photo") continue;
    for (const x of Array.isArray(v) ? v : [v]) {
      if (!x || typeof x !== "object" || !("x" in x)) continue;
      if (x.x < 48 || x.y < 48 || x.x + x.w > 1032 || x.y + x.h > 1872) bad.push(`${k} (${x.x},${x.y},${x.x + x.w},${x.y + x.h}) outside the safe area`);
      if (x.y + x.h > 1450.5 && x.y < 1610) bad.push(`${k} enters the caption band (y ${x.y}-${x.y + x.h})`);
    }
  }
  const label = `${L.composition} ${b.visual_type}${b.data?.nodes ? `/${b.data.nodes.length}` : ""} [${name}]`;
  if (bad.length) { fail++; console.log(`FAIL ${label}: ${bad.join("; ")}`); } else console.log(`ok   ${label}: span ${(span * 100).toFixed(1)}%`);
}
console.log(fail ? `${fail} FAILED` : "all pass");
process.exit(fail ? 1 : 0);
