/**
 * beat-visual.js — the one visual a beat gets, chosen from what asset resolution actually found.
 *
 * Asset resolution used to take the FIRST entity photo a verifier passed. The verifier checks an
 * image against an entity's Wikipedia identity — so when the identity itself was the wrong one, a
 * correct-looking photo of the wrong thing went through: "Alexandria" in "pleaded guilty in
 * Alexandria federal court" resolved to "Alexandria (City in Egypt)", whose skyline then verified
 * MATCH (CI run 37766249863 beat 5). Nothing compared the candidate's own description with the line.
 *
 * Now every candidate the beat's entities produced is put in front of the model with the line, its
 * entities, the channel's style spec and the planner's slot, under the owner's prompt (BEAT_VISUAL_PROMPT,
 * verbatim). The answer is validated in code (validateChoice): only listed assets, a face is never a
 * "non-identifying" treatment, a treatment / placeholder must be one the renderer can draw, every
 * skipped asset carries a reason, and a missing / malformed answer counts as UNSURE — no found asset
 * is used, the beat falls to its honest placeholder. Never blank: the caller's placeholder path always
 * draws something.
 */
export const BEAT_VISUAL_PROMPT = `You are resolving the visual for one beat of a short-form video. Every beat
gets exactly one visual. There is no blank option and no empty frame — a beat
with no image is a failed render, not a safe fallback.

You receive:
- the beat's script line and the entities in it (people, places, things,
  organisations, dates, numbers)
- the assets available for this beat (found images, fetched photos, generated
  candidates) with their captions or sources
- the channel's style spec: palette, ground, typography, composition rules
- the layout slot the planner chose

Choose ONE visual for the beat. In order of preference:

1. A CORRECT ASSET. Use it only if it actually depicts what the line says —
   the right person, the right place, the right thing. If the caption, source
   or content disagrees with the line, it is not correct, however good it
   looks.

2. A CORRECT NON-IDENTIFYING TREATMENT of the same subject. When the right
   person cannot be shown or named, or no photo of them exists: use a
   silhouette, a back-of-head or over-shoulder frame, hands, their desk or
   workspace, an object associated with them, the building or city they are
   tied to, or a document they signed. The subject stays present; the face
   does not. Never substitute a different, identifiable person and present
   them as the subject.

3. A PLACEHOLDER that is honest and looks intentional. When no correct asset
   exists at all: a typographic card, an abstract or textured panel, a map,
   a diagram, an icon, a document surface — anything that reads as a design
   choice and matches the channel's palette, ground and type. A placeholder
   must look like it belongs. It must never look like a missing image, a grey
   box, a stock shrug or a stretched thumbnail.

HARD RULES.
- Never a blank frame. Every path ends in a visual.
- Never a wrong fact. A photo of the wrong place, the wrong person or the
  wrong event is worse than any placeholder. If you are unsure whether an
  asset is correct, it is not — fall to the next option.
- Never present a placeholder as if it depicts the real subject. No fake
  specificity: no "this is Alexandria" over an abstract panel, no stranger's
  face captioned as a name.
- When you skip a found asset, say why in one clause — wrong place, wrong
  person, unsure, restricted. That reason is recorded.
- Match the style spec. A placeholder is held to the same composition, colour
  and type standards as a photo. If it wouldn't look good on the channel, it
  isn't a placeholder, it's a gap.
- Keep the planner's intent: the subject of the visual should be the subject
  of the line.

OUTPUT, per beat:
- visual: the asset id, the treatment, or the placeholder kind
- source: found | non_identifying | placeholder
- reason: one sentence, and if a found asset was skipped, why
- If you fall to option 2 or 3, name what is missing that forced the fall.

Decide from the facts given. Do not invent an asset that is not listed.`;

// What the renderer can draw without a fetched image. A treatment or placeholder outside these is
// "an asset that is not listed" and is refused.
export const SYMBOLS = ["upward-arrow", "downward-arrow", "warning-triangle", "checkmark", "crosshair", "radar", "broken-chain", "dollar-sign"];
export const NON_IDENTIFYING_BUNDLED = ["silhouette", "document"];

export function drawableOptions({ mapAvailable = false } = {}) {
  return {
    non_identifying: [...NON_IDENTIFYING_BUNDLED, "<a listed asset that is not a face: the subject's building, city or object>"],
    placeholder: ["type_card", "document", ...(mapAvailable ? ["map"] : []), ...SYMBOLS.map((s) => `symbol:${s}`)],
  };
}

export const OUTPUT_FORMAT = `Answer with ONE JSON object, no prose:
{"visual": "<asset id | treatment | placeholder kind>", "source": "found|non_identifying|placeholder",
 "reason": "<one sentence>", "skipped": [{"asset": "<asset id>", "why": "<wrong place | wrong person | unsure | restricted — one clause>"}],
 "missing": "<what was missing that forced a fall to option 2 or 3, else null>"}
Treatments and placeholders this renderer can draw (anything else is not available):
`;

// Facts about how a beat with SEVERAL entities is decided (board 38054686824: Kubrick, Matt Damon and Jennifer Garner each had a portrait found, verified
// and offered, and the choice fell to a type card for all of them with "multiple specific people ... a single asset is insufficient"). A beat shows ONE
// visual, so naming several people is a reason to pick the one the line is about, not a reason to show none. It is a fact given beside the line, not an
// edit to the owner's prompt above; the model still decides, and a wrong portrait is still refused by "Never a wrong fact".
export const SEVERAL_ENTITIES_NOTE = "The beat shows ONE visual. When the line names several people and a listed asset shows one of them correctly, show that person: the one the line is about (the first named, unless its verb is about another); the others are named in the headline. A type card is for when NO listed asset is correct, not for when more than one person is named. A portrait of someone who only made the subject (paintings BY Renoir) shows the wrong subject: skip it.";

export function buildBeatVisualPrompt({ line, entities, assets, styleSpec, slot, mapAvailable }) {
  const note = (entities || []).length > 1 && (assets || []).length ? SEVERAL_ENTITIES_NOTE : null;
  return `${BEAT_VISUAL_PROMPT}\n\n${OUTPUT_FORMAT}${JSON.stringify(drawableOptions({ mapAvailable }))}\n\nFACTS:\n${JSON.stringify({ line, entities, assets, style_spec: styleSpec || null, planner_slot: slot || null, ...(note ? { note } : {}) }, null, 1)}`;
}

/**
 * Validate the model's answer against what is actually available. Returns
 *   { visual, source, reason, skipped, missing, asset (the listed asset when one is used), valid, why }
 * Invalid / missing answer -> { valid: false, source: "placeholder", visual: "type_card", why } — the
 * caller's placeholder path; no found asset is used (unsure = not correct).
 */
export function validateChoice(raw, { assets = [], mapAvailable = false } = {}) {
  const ids = new Map(assets.map((a) => [String(a.id), a]));
  const skippedIn = Array.isArray(raw?.skipped) ? raw.skipped.filter((s) => s && s.asset) : [];
  const skipped = skippedIn.map((s) => ({ asset: String(s.asset), why: String(s.why || "").trim() || "unsure (no reason given)" }));
  const fail = (why) => ({ valid: false, visual: "type_card", source: "placeholder", reason: why, skipped: [...skipped, ...assets.filter((a) => !skipped.some((s) => s.asset === String(a.id))).map((a) => ({ asset: String(a.id), why: "unsure — the choice could not be validated" }))], missing: "a validated choice", asset: null, why });
  if (!raw || typeof raw !== "object" || raw.error) return fail(`no usable answer${raw?.error ? ` (${String(raw.error).slice(0, 120)})` : ""}`);
  const visual = String(raw.visual ?? "").trim(), source = String(raw.source ?? "").trim().toLowerCase(), reason = String(raw.reason ?? "").trim();
  if (!visual || !["found", "non_identifying", "placeholder"].includes(source)) return fail(`malformed answer (visual "${visual}", source "${source}")`);
  if (!reason) return fail("no reason given");
  let asset = null;
  if (source === "found") {
    asset = ids.get(visual) || null;
    if (!asset) return fail(`"${visual}" is not a listed asset`);
    if (skipped.some((s) => s.asset === visual)) return fail(`"${visual}" is both chosen and skipped`);
  } else if (source === "non_identifying") {
    if (ids.has(visual)) {
      asset = ids.get(visual);
      // The subject stays present; the face does not: a portrait is never a non-identifying treatment.
      if (asset.kind === "person") return fail(`"${visual}" is a face, not a non-identifying treatment`);
    } else if (!NON_IDENTIFYING_BUNDLED.includes(visual)) return fail(`"${visual}" is not a treatment this renderer can draw`);
  } else {
    const ok = visual === "type_card" || visual === "document" || (visual === "map" && mapAvailable) || (visual.startsWith("symbol:") && SYMBOLS.includes(visual.slice(7)));
    if (!ok) return fail(`"${visual}" is not a placeholder this renderer can draw`);
  }
  // Every found asset not used is skipped, with a reason (recorded).
  const all = [...skipped];
  for (const a of assets) if (String(a.id) !== (asset && String(asset.id)) && !all.some((s) => s.asset === String(a.id))) all.push({ asset: String(a.id), why: "not chosen (no reason given)" });
  const missing = source === "found" ? null : (String(raw.missing ?? "").trim() || "not stated");
  return { valid: true, visual, source, reason, skipped: all, missing, asset, why: null };
}

/**
 * Choose a beat's one visual. `ask(prompt)` returns the model's parsed JSON (or { error }).
 * Returns the validated choice plus the record line the pipeline logs.
 */
export async function chooseBeatVisual({ line, entities, assets, styleSpec, slot, mapAvailable = false, ask }) {
  let raw;
  try { raw = await ask(buildBeatVisualPrompt({ line, entities, assets, styleSpec, slot, mapAvailable })); } catch (e) { raw = { error: e.message }; }
  return validateChoice(raw, { assets, mapAvailable });
}
