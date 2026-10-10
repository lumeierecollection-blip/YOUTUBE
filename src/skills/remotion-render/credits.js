/**
 * The credits of a canvas render, read off the plan as it is DRAWN (the resolved plan the renderer received).
 *
 *   lines     what the video's description carries (youtube-publish buildMetadata appends the image-credits file):
 *             every attribution-bearing image (CC BY and the like), and every fair-use mark with its basis.
 *   fair_use  the structured record, one per USE (a logo shown on a beat), written beside the video as <slug>-<format>-fair-use-credits.json:
 *             who, which beat, the basis, the rationale as the source file page states it, the rights holder, the file page.
 *
 * Fair use is for identification only (scripts/lib/fair-use-logo.cjs): the record exists so every use can be audited, and so a mark that
 * is not on screen is never credited. Pure: reads the plan, writes nothing.
 */
const ATTRIBUTION = /\bcc[- ]by\b|attribution/i;

/** Every image the beat draws that carries a source: photo, concept visuals / hero cutout, the art's marks, a flag. */
function drawn(b) {
  const c = b.canvas || {};
  const out = [];
  if (c.photo?.asset) out.push({ kind: "photo", name: c.photo.entity, ...c.photo });
  for (const v of c.concept_visuals || []) if (v?.asset) out.push({ kind: v.logo ? "logo" : "cutout", ...v });
  if (c.art?.asset) out.push({ kind: c.art.kind === "flag" ? "flag" : "art", name: c.art.name, ...c.art });
  for (const it of c.art?.items || []) if (it?.asset) out.push({ kind: "logo", ...it });
  return out;
}

export function creditEntries(plan) {
  const lines = [], fair_use = [], seen = new Set();
  for (const [i, b] of (plan?.beats || []).entries()) {
    const beat = b.index ?? i;
    for (const v of drawn(b)) {
      if (v.fair_use) {
        const key = `${v.fair_use.entity || v.name}|${beat}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const f = v.fair_use;
        fair_use.push({ beat, entity: f.entity || v.name, kind: "logo", basis: f.basis, purpose: f.purpose, rationale: f.rationale, article: f.article, holder: f.holder, file_page: f.file_page, retrieved: f.retrieved, license: v.license || null });
        lines.push(`${f.entity || v.name} logo — shown only to identify it (fair use). © ${f.holder}. ${f.file_page}`);
      } else if (ATTRIBUTION.test(String(v.license || "")) || ATTRIBUTION.test(String(v.credit || ""))) {
        const line = v.credit ? `${v.credit}${v.source_url ? ` — ${v.source_url}` : ""}` : `${v.name || "Image"} — ${v.license}${v.source_url ? ` — ${v.source_url}` : ""}`;
        if (!lines.includes(line)) lines.push(line);
      }
    }
  }
  return { lines, fair_use };
}
