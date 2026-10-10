/**
 * place-gate.js — the pre-ship PLACE gate. A depicted place that is not confirmed against the
 * script's location FAILS the beat, and a video with a failed beat cannot be queued approved/
 * or approved-review/ (render-and-qa.js queueVideo). Deterministic: no model call, so a model
 * that answers YES to a wrong map (CI run 37810883817 ch-9 beat 7, Washington STATE for
 * "Moscow and Washington") cannot pass it.
 *
 * Reads only the render manifest (render.js / canvas-layout.js canvasManifest): per beat
 * canvas.visual_type, canvas.data, canvas.photo (with verified_as / seen / place_check) and
 * canvas.sentence. Fails CLOSED: a map or place photo whose beat carries no sentence, or a place
 * photo with no SAME place_check, fails — "unconfirmed" is not "confirmed".
 *
 * Rules
 *   MAP beat (data.place):
 *     M1 the place is named in the beat's own sentence;
 *     M2 it resolves to a region (geo-regions.js);
 *     M3 it is not an ambiguous bare name (two different places share it);
 *     M4 it is not the tail of a longer place the sentence names ("Sudan" in "South Sudan").
 *   PHOTO of a place / building / organisation's building (not a person, logo, document, money):
 *     P1 the photo carries place_check.verdict === "SAME" (resolve-scene.cjs samePlace);
 *     P2 the photographed entity is named in the beat's sentence;
 *     P3 the places the photo's provenance names (verified_as, the verifier's "seen") do not
 *        contradict the places the script names — CI run 37766249863: "aerial view of
 *        alexandria coastline egypt" in a script set in the US (Florida, a federal court).
 *
 * Where its guarantee stops: P3 can only see places that geo-regions knows (countries, US
 * states); a namesake city in the SAME country with no state named anywhere is left to P1.
 * People are not covered here (resolve-scene.cjs samePerson).
 */
import { resolveRegion } from "../src/skills/remotion-render/visual/geo-regions.js";

// Bare names that are two different places. Kept here, independent of the alias table, so a
// later alias change cannot reopen the hole.
export const AMBIGUOUS_PLACE_NAMES = new Set([
  "washington", "georgia", "alexandria", "birmingham", "cambridge", "portland", "springfield",
  "victoria", "columbia", "kingston", "richmond", "perth", "paris", "london", "hollywood", "jersey",
]);

const PLACE_PHOTO_KINDS = new Set(["place", "building", "organization", "company", "institution", "scene"]);
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const namedIn = (name, sentence) => !!name && new RegExp(`(^|[^\\p{L}])${esc(name)}($|[^\\p{L}])`, "iu").test(String(sentence || ""));
const countryOf = (id) => (String(id).startsWith("us:") ? "country:USA" : id);

/** Region ids named in free text. `properOnly`: count only capitalised spans (a script). */
export function regionsIn(text, { properOnly = true } = {}) {
  const ws = String(text || "").split(/[^\p{L}.'-]+/u).filter(Boolean);
  const out = new Set();
  for (let i = 0; i < ws.length; i++) for (let k = 3; k >= 1; k--) {
    if (i + k > ws.length) continue;
    const span = ws.slice(i, i + k).join(" ").replace(/[.]$/, "");
    if (properOnly && !/^\p{Lu}/u.test(span)) continue;
    const id = resolveRegion(span);
    if (id) { out.add(id); i += k - 1; break; }
  }
  return out;
}

/** Do two region sets contradict? Compared at the finest level both name (state, else country). */
export function contradicts(a, b) {
  if (!a.size || !b.size) return false;
  const states = (s) => new Set([...s].filter((x) => x.startsWith("us:")));
  const sa = states(a), sb = states(b);
  if (sa.size && sb.size) return ![...sa].some((x) => sb.has(x));
  const ca = new Set([...a].map(countryOf)), cb = new Set([...b].map(countryOf));
  return ![...ca].some((x) => cb.has(x));
}

/** { pass, failures: [{ beat, rule, why }], checked } for a render manifest. */
export function placeGate(manifest) {
  const beats = Array.isArray(manifest?.beats) ? manifest.beats : [];
  const script = beats.map((b) => b.canvas?.sentence || "").join(" ");
  const scriptRegions = regionsIn(script);
  const failures = [];
  let checked = 0;
  const fail = (beat, rule, why) => failures.push({ beat, rule, why });
  beats.forEach((b, i) => {
    const c = b.canvas || {};
    const vt = String(c.visual_type || b.visual_type || "").toUpperCase();
    const sentence = c.sentence;
    if (vt === "MAP" || /^MAP/.test(String(c.composition || ""))) {
      checked++;
      const place = String(c.data?.place || "").trim();
      if (!sentence) return fail(i, "M0", `map of "${place}" but the beat records no sentence to confirm it against`);
      if (!place) return fail(i, "M2", "map beat with no place");
      if (!namedIn(place, sentence)) return fail(i, "M1", `map of "${place}" — the sentence does not name it`);
      // Ambiguity first: it must hold whatever the alias table says.
      if (AMBIGUOUS_PLACE_NAMES.has(place.toLowerCase())) return fail(i, "M3", `map of "${place}" — the bare name is two different places`);
      const id = resolveRegion(place);
      if (!id) return fail(i, "M2", `map of "${place}" — not a known region`);
      // "Sudan" inside "South Sudan", "Virginia" inside "West Virginia": a longer span ending in
      // the place that resolves to a DIFFERENT region means the sentence named that one.
      for (const m of String(sentence).matchAll(new RegExp(`(?:\\p{L}+[ -]){1,3}${esc(place)}(?![\\p{L}])`, "giu"))) {
        const ws = m[0].split(/[ -]+/);
        for (let k = 1; k < ws.length; k++) {
          const other = resolveRegion(ws.slice(k - 1).join(" "));
          if (other && other !== id) return fail(i, "M4", `map of "${place}" — the sentence names "${ws.slice(k - 1).join(" ")}" (${other})`);
        }
      }
      return;
    }
    const p = c.photo;
    if (!p || p.kind === "person" || !(PLACE_PHOTO_KINDS.has(String(p.kind || "")) || ["scene", "building"].includes(String(p.view || "")))) return;
    checked++;
    const ent = String(p.entity || "").trim();
    if (!sentence) return fail(i, "P0", `photo of "${ent}" but the beat records no sentence to confirm it against`);
    if (p.place_check?.verdict !== "SAME") return fail(i, "P1", `photo of "${ent}" not confirmed as the script's place (place_check ${p.place_check?.verdict || "absent"})`);
    if (ent && !namedIn(ent, sentence)) return fail(i, "P2", `photo of "${ent}" — the sentence does not name it`);
    const provenance = `${p.verified_as || ""} ${p.seen || ""} ${p.place_check?.about || ""}`;
    const photoRegions = regionsIn(provenance, { properOnly: false });
    if (contradicts(photoRegions, scriptRegions)) {
      return fail(i, "P3", `photo of "${ent}" is from ${[...photoRegions].join(", ")}; the script is set in ${[...scriptRegions].join(", ")}`);
    }
  });
  return { pass: failures.length === 0, failures, checked };
}
