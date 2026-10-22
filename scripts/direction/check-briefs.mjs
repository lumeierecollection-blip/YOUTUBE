// Evaluates the OBJECTIVE acceptance criteria of scene briefs against a render manifest. Subjective ones are returned
// untouched for the vision judge. Defects use scripts/qa/defects.mjs (source "objective": the schema enum has no "brief").
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { makeDefect } from "../qa/defects.mjs";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9%$ ]+/g, " ").replace(/\s+/g, " ").trim();
const heroOf = (c) => c?.photo?.asset || (c?.concept_visuals || []).find((v) => v?.asset)?.asset || null;

export function checkBriefsAgainstRender(briefs, { manifest, defects = [], wordTimings = null, publicDir = null, exists = existsSync } = {}) {
  const out = [], for_vision_review = [];
  const mBeats = manifest?.beats || [];
  for (const b of briefs || []) {
    const mb = mBeats[b.beat_index];
    const base = { source: "objective", scene_id: b.scene_id, beat_index: b.beat_index, t_start: b.timing?.start ?? null, t_end: b.timing?.end ?? null };
    const fail = (c, severity, evidence, actual) => out.push(makeDefect({ ...base, id: `brief:${c.id}`, check: `brief:${c.check}`, severity, evidence, expected: c.expect, actual }));
    for (const c of b.acceptance_criteria || []) {
      if (!c.objective) { for_vision_review.push({ scene_id: b.scene_id, beat_index: b.beat_index, ...c }); continue; }
      if (!mb) { fail(c, "major", `no manifest beat ${b.beat_index}`, "missing"); continue; }
      const hero = heroOf(mb.canvas);
      switch (c.check) {
        case "hero_visible_by": {
          const at = mb.hero_at_s;   // not recorded by render.js today: presence is checked, timing only when a producer supplies it
          if (!hero) fail(c, "major", "the brief requires a hero asset; the manifest beat has none", "no hero asset");
          else if (Number.isFinite(at) && at > (c.params?.by_s ?? 0.47)) fail(c, "major", `hero asset first visible at +${at}s`, `${at}s`);
          break;
        }
        case "asset_file_exists": {
          if (!hero) break;   // reported by hero_visible_by
          const p = isAbsolute(hero) || !publicDir ? hero : join(publicDir, hero);
          if (!exists(p)) fail(c, "major", `asset file not found: ${p}`, "missing file");
          break;
        }
        case "entity_photo_verified": {
          const ph = mb.canvas?.photo;
          if (ph && !ph.verified_as && !ph.place_check) fail(c, "blocker", `photo ${ph.asset} has no verified_as/place_check provenance`, "unverified photo");
          break;
        }
        case "display_words_subset": {
          const nar = new Set(norm(b.narration).split(" "));
          const extra = (b.text?.display_words || []).filter((w) => !nar.has(w));
          if (extra.length) fail(c, "minor", `display words not in narration: ${extra.join(", ")}`, extra.join(" "));
          break;
        }
        case "max_hold": {
          const d = mb.duration_sec;
          if (Number.isFinite(d) && d > (c.params?.max_s ?? Infinity)) fail(c, "minor", `beat holds ${d}s`, `${d}s`);
          break;
        }
        default: break;
      }
    }
  }
  return { defects: [...defects, ...out], new_defects: out, for_vision_review };
}
