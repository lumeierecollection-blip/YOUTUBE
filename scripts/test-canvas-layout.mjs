// node scripts/test-canvas-layout.mjs — every full-canvas layout, with and
// without a header, against the rules local-audit.cjs applies on every
// render: content spans >= 60% of the frame height (CNV-02, by layout here),
// every box inside the frame less 48 px, nothing but a photo in the caption
// band (CNV-01). A layout that only passes when the planner writes a headline
// fails here, not in CI (runs 36498049819 / 36504143080).
// Since the typography rebuild it also checks the grid rules (canvas-layout.js):
// no centred text, every text box anchored to a column edge on the side it is
// aligned to, no two text boxes overlapping, both variants (left / right).
import { canvasLayout, contentBounds, flattenBoxes, GRID, cellsOf } from "../src/skills/remotion-render/visual/canvas-layout.js";

const heads = [
  { name: "no header", h: {} },
  { name: "headline", h: { headline: "rates are rising fast" } },
  { name: "kicker+headline", h: { lead_in: "since the ruling", headline: "rates are rising fast" } },
];
const bodies = [
  { visual_type: "TYPE", headline: "Why the rule breaks" },
  { visual_type: "TYPE" },
  { visual_type: "TYPE", composition: "TYPE-SPLIT", headline: "Trucking entrepreneur indicted for fraud" },
  { visual_type: "TYPE", composition: "TYPE-SPLIT", headline: "Two words" },
  { visual_type: "COUNTER", data: { value: "$352 million", label: "stolen in two blocks" } },
  { visual_type: "COUNTER", data: { value: "23", label: "countries" } },
  { visual_type: "COUNTER", data: { value: "1,400,000,000", label: "a very long number" } },
  { visual_type: "BAR", data: { bars: [{ label: "needs", value: "50%" }, { label: "wants", value: "30%" }, { label: "savings", value: "20%" }] } },
  { visual_type: "BAR", data: { bars: [{ label: "a very long label here", value: "5" }, { label: "b", value: "7" }, { label: "c", value: "9" }, { label: "d", value: "2" }] } },
  { visual_type: "PIE", data: { percent: 34, label: "of income" } },
  { visual_type: "GAUGE", data: { percent: 80, label: "promotion barrier" } },
  { visual_type: "LINE", data: { points: [{ label: "2022", value: "2%" }, { label: "2026", value: "4.5%" }] } },
  { visual_type: "MAP", data: { place: "Iran" } },
  { visual_type: "PROCESS", data: { nodes: ["higher rates", "rent", "savings"] } },
  { visual_type: "PROCESS", data: { nodes: ["sloppy communication", "sloppy thinking"] } },
  { visual_type: "PHOTO", photo: { asset: "x.jpg", entity: "Jerome Powell" }, headline: "The fed holds" },
  { visual_type: "PHOTO", composition: "ARCHITECTURE", photo: { asset: "x.jpg", entity: "Federal Reserve", view: "building" }, headline: "The fed holds" },
  { visual_type: "DOCUMENT", composition: "DOCUMENT", photo: { asset: "x.jpg", entity: "Dodd-Frank Act", view: "document" }, headline: "The act reshaped banking" },
  { visual_type: "MONEY", composition: "MONEY", photo: { asset: "x.jpg", entity: null, view: "money" }, headline: "The fraud cost investors", data: { value: "$105M" } },
  { visual_type: "MONEY", composition: "MONEY", photo: { asset: "x.jpg", entity: null, view: "money" }, headline: "They paid in cash" },
  { visual_type: "CUTOUT", cutout: { asset: "c.png", isolated: true, transparent: 0.5 } },
  { visual_type: "LIST", data: { items: ["basic", "standard", "premium"], lead: "The three tiers are" } },
  { visual_type: "LIST", data: { items: ["needs", "wants", "savings", "debt", "taxes"] } },
  { visual_type: "TIMELINE", data: { markers: [{ date: "2019", label: "the law passed" }, { date: "2024", label: "it was repealed" }] } },
  { visual_type: "TIMELINE", data: { markers: [{ date: "March 2021", label: "opened" }, { date: "2022", label: "expanded" }, { date: "June 2023", label: "closed" }, { date: "2024", label: "sold" }] } },
  { visual_type: "COMPARE", data: { a: { value: "42%", label: "income" }, b: { value: "31%", label: "owners" }, relation: "vs" } },
  { visual_type: "COMPARE", data: { a: { value: "3%", label: null }, b: { value: "5%", label: null }, relation: "from-to", subject: "Unemployment" } },
];
let fail = 0;
const colStarts = GRID.cols.map((c) => c[0]), colEnds = GRID.cols.map((c) => c[1]);
const TEXT = ["kicker", "headline", "statement", "number", "label", "emphasis"];
for (const variant of [0, 1]) for (const b of bodies) for (const { name, h } of heads) {
  const c = { beat_index: variant, beat_total: 6, ...b, variant, ...(b.visual_type === "TYPE" && !h.headline ? {} : (b.headline ? { ...h, headline: b.headline } : h)) };
  const L = canvasLayout(c);
  const cb = contentBounds(L);
  const span = cb ? cb.h / 1920 : 0;
  const bad = [];
  if (span < 0.61) bad.push(`span ${(span * 100).toFixed(1)}%`);
  if (!cb) bad.push("no content");
  // Every box (nested ones too) inside the frame less 48 px and clear of the
  // caption row; a photo / map / diagonal shape bleeds by design.
  for (const [k, x] of flattenBoxes(L.boxes)) {
    if (k === "photo" || k === "map" || k === "split" || x.role === "shape") continue;
    if (x.x < 48 || x.y < 48 || x.x + x.w > 1032 || x.y + x.h > 1872) bad.push(`${k} (${x.x},${x.y},${x.x + x.w},${x.y + x.h}) outside the safe area`);
    if (x.y + x.h > 1450.5 && x.y < 1610) bad.push(`${k} enters the caption band (y ${x.y}-${x.y + x.h})`);
  }
  // Grid rules: text is never centred, is anchored to a column edge on the
  // side it is aligned to, and text boxes do not overlap.
  const TEXT_ROLES = ["headline", "number", "data", "emphasis"];
  const texts = flattenBoxes(L.boxes).filter(([k, v]) => TEXT_ROLES.includes(v.role) || TEXT.includes(k));
  for (const [k, v] of texts) {
    if (v.align === "center") bad.push(`${k} is centred`);
    if (!v.align) bad.push(`${k} has no alignment`);
    if (v.rotate || /^(label|items\d+$|markers\d+_label|labelA|labelB)/.test(k)) continue;   // labels attach to their data
    if (/_/.test(k)) continue;                                                              // nested (index / date)
    if (k.startsWith("number") && (k === "numberA" || k === "numberB")) continue;            // diagonal split: anchored to its half
    const onEdge = v.align === "right" ? colEnds.includes(v.x + v.w) || v.x + v.w === 1032 : colStarts.includes(v.x);
    if (!onEdge) bad.push(`${k} (${v.x}..${v.x + v.w}) is not anchored to a column edge (${v.align}-aligned)`);
    if (Math.abs(v.x + v.w / 2 - 540) < 20 && v.w < 700) bad.push(`${k} sits on the frame's centre line`);
  }
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i][1], d = texts[j][1];
    if (a.x < d.x + d.w - 2 && d.x < a.x + a.w - 2 && a.y < d.y + d.h - 2 && d.y < a.y + a.h - 2) bad.push(`text boxes ${texts[i][0]} and ${texts[j][0]} overlap`);
  }
  const label = `${L.composition} ${b.visual_type}${b.data?.nodes ? `/${b.data.nodes.length}` : ""}${b.data?.items ? `/${b.data.items.length}` : ""}${b.data?.markers ? `/${b.data.markers.length}` : ""} v${variant} [${name}]`;
  if (bad.length) { fail++; console.log(`FAIL ${label}: ${bad.join("; ")}`); } else console.log(`ok   ${label}: span ${(span * 100).toFixed(1)}%`);
}
console.log(fail ? `${fail} FAILED` : "all pass");
process.exit(fail ? 1 : 0);
