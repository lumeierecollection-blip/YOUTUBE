/**
 * Applying the sentence repair's answer (scripts/repair-sentences.mjs). Pure, so it is tested without a model.
 *
 * A replacement is {n, text}. text "CUT" removes the sentence instead: the answer the repair gives when the research states nothing that
 * fits the sentence's job (board 38044082797 ch 6 and ch 44: asked for a specific detail every time, the model invented one — "hold physical
 * evidence", "Northwestern University ... October 2026" — and the claims gate skipped the channel; a shorter true script beats a skipped one).
 * A CUT that would empty its beat is ignored: the original sentence stays and the gates judge it as before.
 *
 *   rows     [{ n, si, beat, text }]    allowed  Set of sentence numbers the checks flagged
 * Returns { rows, replaced: [{n, beat, from, to}], cut: [{n, beat, text}], refused: [{n, why}] }.
 */
export function applyRepairs(rows, replacements, allowed) {
  const out = rows.map((r) => ({ ...r }));
  const replaced = [], cut = [], refused = [];
  const wanted = (replacements || []).filter((r) => allowed.has(Number(r?.n)) && typeof r?.text === "string" && r.text.trim().length > 0);
  for (const r of wanted) {
    const row = out.find((x) => x.n === Number(r.n));
    if (!row || row.cut) continue;
    const text = r.text.trim().replace(/\s+/g, " ");
    if (/^cut\b[.!]?$/i.test(text)) {
      const left = out.filter((x) => x.si === row.si && !x.cut && x !== row).length;
      if (left < 1) { refused.push({ n: row.n, why: `it is the only sentence of ${row.beat}` }); continue; }
      row.cut = true; cut.push({ n: row.n, beat: row.beat, text: row.text });
      continue;
    }
    if (text.length <= 3) continue;
    replaced.push({ n: row.n, beat: row.beat, from: row.text, to: text });
    row.text = text;
  }
  return { rows: out.filter((x) => !x.cut), replaced, cut, refused };
}
