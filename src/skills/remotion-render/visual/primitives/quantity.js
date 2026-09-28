/**
 * Parse a quantity as the narration says it — "$1.4 billion", "3 million",
 * "25%", "276" — into its magnitude (for chart scaling) and the parts needed
 * to roll it up on screen without changing its wording.
 * Pure .js: shared by the chart primitives and testable in node.
 */
const SCALE = { thousand: 1e3, k: 1e3, million: 1e6, m: 1e6, mn: 1e6, billion: 1e9, bn: 1e9, b: 1e9, trillion: 1e12, t: 1e12 };

export function parseQuantity(input) {
  const text = String(input ?? "").trim();
  const m = text.match(/^(.*?)(\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|million|billion|trillion|bn|mn|k|m|b|t)\b)?(%?)(.*)$/i);
  if (!m) return null;
  const raw = m[2].replace(/,/g, "");
  const num = Number(raw);
  const scaleWord = (m[3] || "").toLowerCase();
  const mult = SCALE[scaleWord] || 1;
  return {
    text,
    pre: m[1],
    num,
    dec: (raw.split(".")[1] || "").length,
    comma: m[2].includes(","),
    scaleWord: m[3] || "",
    percent: m[4] === "%",
    post: m[5] || "",
    magnitude: num * mult,
  };
}

// The quantity at fraction t (0..1) of its value, worded exactly as said.
export function rollQuantity(q, t) {
  if (!q) return "";
  const v = q.num * Math.max(0, Math.min(1, t));
  const s = q.comma
    ? v.toLocaleString("en-US", { minimumFractionDigits: q.dec, maximumFractionDigits: q.dec })
    : v.toFixed(q.dec);
  const scale = q.scaleWord ? ` ${q.scaleWord}` : "";
  return `${q.pre}${s}${scale}${q.percent ? "%" : ""}${q.post}`.replace(/\s{2,}/g, " ").trim();
}
