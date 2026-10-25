/**
 * What each NAMED entity of a rendered plan actually got to show, read off the resolved plan (the beat as it is drawn, after the asset guard).
 *
 *   logo | portrait | photo | flag | map   a real visual   (a fetched image with its source_url, or the sentence's own map)
 *   typed                                  the name in type / a name card / a plate — no image
 *
 * One row per (beat, entity). Numbers and dates are not entities that can be shown and are left out. Reports; changes nothing.
 */
const SHOWABLE = /person|place|organization|company|institution|building|outlet|agency/i;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const same = (a, b) => !!norm(a) && norm(a) === norm(b);

export function entityVisuals(plan) {
  const rows = [];
  for (const [i, b] of (plan?.beats || []).entries()) {
    const c = b.canvas || {};
    const ents = (b.named_entities || []).filter((e) => e && SHOWABLE.test(String(e.type || "")));
    const seen = new Set();
    for (const e of ents) {
      if (seen.has(norm(e.name))) continue;
      seen.add(norm(e.name));
      let visual = "typed", source_url = null;
      const items = (c.art?.items || []).filter(Boolean);
      const item = items.find((it) => same(it.name, e.name) && it.asset);
      if (item) { visual = "logo"; source_url = item.source_url || null; }
      else if (c.hero_cutout?.logo || b.hero_cutout?.logo) {
        const h = c.hero_cutout || b.hero_cutout;
        if (same(h.name, e.name) && h.asset) { visual = "logo"; source_url = h.source_url || null; }
      }
      if (visual === "typed" && c.art?.kind === "flag" && same(c.art.name, e.name) && c.art.asset) { visual = "flag"; source_url = c.art.source_url || null; }
      if (visual === "typed" && (c.visual_type === "MAP" || b.visual_type === "MAP") && same((c.data || b.data || {}).place, e.name)) visual = "map";
      if (visual === "typed" && c.photo?.asset && c.photo?.source_url && same(c.photo.entity, e.name)) { visual = /person/i.test(e.type) ? "portrait" : "photo"; source_url = c.photo.source_url; }
      rows.push({ beat: i, name: e.name, type: e.type, visual, source_url });
    }
  }
  return rows;
}

export function summarise(rows) {
  const by = {};
  for (const r of rows) by[r.visual] = (by[r.visual] || 0) + 1;
  const real = rows.filter((r) => r.visual !== "typed").length;
  return { named: rows.length, real, typed: rows.length - real, fraction: rows.length ? +(real / rows.length).toFixed(2) : null, by };
}
