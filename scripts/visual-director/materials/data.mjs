/**
 * data.mjs — a `kind: data` material is never downloaded. It is legal only when every number it
 * would draw is in the frozen research artifact (schemas/research.json) WITH a source_url.
 *
 *   validateData(material, research) -> { status: "verified"|"missing", source_url, verdict, checked: [...] }
 *
 * The schema leaves material.data free-form ({type: object}), so every numeric leaf is checked,
 * wherever it sits. A number counts as researched when:
 *   - research.numbers[] has the same value (relative tolerance 1e-9) and a non-empty source_url, or
 *   - a research.key_facts[].fact (with a source_url) contains that number written out
 *     ("13,200", "13200", "1066", "2.5").
 * When the data entry carrying the number names its own source_url, the research item must carry
 * that same URL — a real number attributed to the wrong source is still refused.
 * A data object with no numbers at all is missing: a chart with nothing sourced to plot is not data.
 *
 * Where this stops: it proves the number EXISTS in research with a source; it does not prove the
 * label next to it means what the research meant (a "13,200 houses" figure relabelled "deaths" passes).
 * gate.mjs / the critic own that.
 */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Every numeric leaf of `data`, with the nearest enclosing source_url. Pure. */
export function numericLeaves(data, inherited = null, path = "data", out = []) {
  if (data == null) return out;
  if (isNum(data)) { out.push({ path, value: data, source_url: inherited }); return out; }
  if (typeof data === "string") {
    // "13,200" written as a string is still a number the chart would draw
    const s = data.replace(/,/g, "").trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) out.push({ path, value: Number(s), source_url: inherited });
    return out;
  }
  if (Array.isArray(data)) { data.forEach((d, i) => numericLeaves(d, inherited, `${path}[${i}]`, out)); return out; }
  if (typeof data === "object") {
    const own = typeof data.source_url === "string" && data.source_url ? data.source_url : inherited;
    for (const [k, v] of Object.entries(data)) {
      if (k === "source_url" || k === "source" || k === "sources") continue;
      numericLeaves(v, own, `${path}.${k}`, out);
    }
  }
  return out;
}

function spellings(n) {
  const out = new Set([String(n)]);
  if (Number.isInteger(n)) out.add(n.toLocaleString("en-US"));
  return [...out];
}
const sameNum = (a, b) => a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Where in research this value is grounded, or null. Pure. */
export function findInResearch(value, research, wantUrl = null) {
  const ok = (url) => typeof url === "string" && url.trim() && (!wantUrl || url === wantUrl);
  for (const [i, n] of (research?.numbers || []).entries()) {
    if (isNum(n?.value) && sameNum(n.value, value) && ok(n.source_url)) return { where: `numbers[${i}]`, source_url: n.source_url, label: n.label };
  }
  for (const [i, f] of (research?.key_facts || []).entries()) {
    if (!ok(f?.source_url)) continue;
    const text = String(f.fact || "");
    if (spellings(value).some((s) => new RegExp(`(^|[^\\d.,])${s.replace(/[.,]/g, "\\$&")}($|[^\\d])`).test(text))) return { where: `key_facts[${i}]`, source_url: f.source_url, label: text.slice(0, 80) };
  }
  return null;
}

export function validateData(material, research) {
  if (!research) return { status: "missing", source_url: null, verdict: "no research artifact to check the data against", checked: [] };
  const leaves = numericLeaves(material?.data);
  if (!leaves.length) return { status: "missing", source_url: null, verdict: "data has no values to check", checked: [] };
  const checked = leaves.map((l) => ({ ...l, found: findInResearch(l.value, research, l.source_url) }));
  const bad = checked.filter((c) => !c.found);
  if (bad.length) {
    return { status: "missing", source_url: null, checked,
      verdict: `not in research with a source_url: ${bad.map((b) => `${b.path}=${b.value}${b.source_url ? ` (claimed ${b.source_url})` : ""}`).join("; ")}`.slice(0, 400) };
  }
  const urls = [...new Set(checked.map((c) => c.found.source_url))];
  return { status: "verified", source_url: urls[0], checked,
    verdict: `${checked.length} value(s) found in research: ${checked.map((c) => `${c.value} <- ${c.found.where}`).join(", ")}${urls.length > 1 ? `; sources: ${urls.join(" ")}` : ""}`.slice(0, 400) };
}
