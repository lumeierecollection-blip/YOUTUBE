/**
 * direct — vision interpretation of a reference into schemas/creative-direction.json.
 *
 * Numbers (metadata, cuts, cadence, audio cues) are MEASURED and written by this file, never by the model.
 * The model supplies observations only; each must cite frame ids it was sent. filterEvidence() removes the rest
 * into rejected_observations. With no model answer the doc is direction.status = "measured-only" and every
 * qualitative array stays empty — nothing is faked.
 * Client: src/lib/llm.js callLLMWithProvenance (Gemini key rotation + the repo's fallbacks); no new HTTP client.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const here = dirname(fileURLToPath(import.meta.url));
export const SCHEMA = JSON.parse(readFileSync(join(here, "../../schemas/creative-direction.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(SCHEMA);

const OBS_SECTIONS = ["typography", "composition", "transitions", "camera_movement", "effects", "color", "narration_visual"];
const MAX_SHEETS = 8, MAX_SINGLES = 12;

export function validateDirection(doc) {
  const ok = validate(doc);
  return { valid: !!ok, errors: ok ? [] : validate.errors.slice(0, 10).map((e) => `${e.instancePath} ${e.message}`) };
}

/** The measured-only skeleton: measured numbers in, every qualitative array empty. */
export function baseDirection({ file, size_bytes, metadata, scenes, audio, framesSent = [], status = "measured-only", why, model = null, provider = null }) {
  return {
    schema_version: 1,
    source: { file, size_bytes },
    direction: { status, why: why ?? null, model, provider },
    measured: { metadata, cuts: scenes.cuts, cadence: scenes.cadence, audio: audio ? { loudness: audio.loudness, silences: audio.silences, candidate_cues: audio.candidate_cues, transcript: audio.transcript, transcript_why: audio.why } : null },
    frames_sent: framesSent,
    typography: [], composition: [],
    pacing: { measured: { duration_s: metadata.duration_s, scene_cuts: scenes.scene_cuts, ...scenes.cadence }, observations: [] },
    transitions: [], camera_movement: [], effects: [], color: [], sound_cues: [], narration_visual: [], storyboard: [],
    rejected_observations: [],
  };
}

const near = (arr, t, tol) => arr.some((x) => Math.abs(x - t) <= tol);

/**
 * Pure. Merge the model's qualitative sections into `base`, dropping any observation that cites a frame id not in
 * `sentIds` (or cites none), a sound cue that is not at a measured candidate cue, or a transition at no measured cut.
 */
export function filterEvidence(base, modelOut, sentIds) {
  const sent = new Set(sentIds);
  const doc = structuredClone(base);
  const reject = (section, o, reason, cited) => doc.rejected_observations.push({ section, reason, observation: o, cited: (cited ?? []).map(String) });
  const check = (section, o, extraIds = []) => {
    const ev = Array.isArray(o?.evidence) ? o.evidence : [];
    if (!ev.length) { reject(section, o, "no evidence cited"); return false; }
    const bad = [...ev, ...extraIds].filter((id) => !sent.has(id));
    if (bad.length) { reject(section, o, "cites frames that were not sent to the model", bad); return false; }
    if (!["low", "medium", "high"].includes(o.confidence) || typeof (o.text ?? o.description) !== "string") { reject(section, o, "missing confidence or text"); return false; }
    return true;
  };
  const list = (v) => (Array.isArray(v) ? v : []);
  for (const s of OBS_SECTIONS) {
    for (const o of list(modelOut?.[s])) {
      if (!check(s, o)) continue;
      if (s === "transitions") {
        const at = [...new Set(list(o.at_cuts).filter((t) => near(doc.measured.cuts, t, 0.4)).map((t) => doc.measured.cuts.reduce((a, c) => (Math.abs(c - t) < Math.abs(a - t) ? c : a))))]; // snapped to the measured cut
        if (!at.length) { reject(s, o, "at_cuts matches no measured cut", list(o.at_cuts)); continue; }
        o.at_cuts = at;
      }
      doc[s].push(o);
    }
  }
  for (const o of list(modelOut?.pacing?.observations ?? modelOut?.pacing)) if (check("pacing", o)) doc.pacing.observations.push(o);
  const cues = (doc.measured.audio?.candidate_cues || []).map((c) => c.t);
  for (const o of list(modelOut?.sound_cues)) {
    if (!check("sound_cues", o)) continue;
    if (typeof o.t !== "number" || !near(cues, o.t, 0.2)) { reject("sound_cues", o, "t matches no measured audio cue", [String(o.t)]); continue; }
    doc.sound_cues.push(o);
  }
  for (const o of list(modelOut?.storyboard)) {
    if (!check("storyboard", { ...o, text: o.description }, list(o.frames))) continue;
    if (typeof o.start !== "number" || typeof o.end !== "number" || !list(o.frames).length || typeof o.technique !== "string") { reject("storyboard", o, "storyboard row incomplete"); continue; }
    doc.storyboard.push(o);
  }
  return doc;
}

/**
 * Pure. Coerce purely DESCRIPTIVE fields to the schema's types (a list of sizes
 * becomes "48px, 96px"; a lone family becomes ["Serif"]). Never touches
 * evidence, confidence, times or text, so it cannot make an unsupported
 * observation pass.
 */
const STRING_FIELDS = { typography: ["case", "sizes", "role", "entrance"], composition: ["grid", "safe_zones", "density"], transitions: ["type"] };
const ARRAY_FIELDS = { typography: ["families", "weights"] };
export function normalizeShapes(modelOut) {
  if (!modelOut || typeof modelOut !== "object") return modelOut;
  const out = structuredClone(modelOut);
  const str = (v) => (Array.isArray(v) ? v.map(String).join(", ") : typeof v === "number" || typeof v === "boolean" ? String(v) : v && typeof v === "object" ? JSON.stringify(v) : v);
  for (const [sec, fields] of Object.entries(STRING_FIELDS)) for (const o of Array.isArray(out[sec]) ? out[sec] : []) for (const f of fields) if (o && o[f] != null) o[f] = str(o[f]);
  for (const [sec, fields] of Object.entries(ARRAY_FIELDS)) for (const o of Array.isArray(out[sec]) ? out[sec] : []) for (const f of fields) if (o && o[f] != null && !Array.isArray(o[f])) o[f] = [String(o[f])];
  for (const o of Array.isArray(out.transitions) ? out.transitions : []) if (o && typeof o.duration_s === "string") { const n = parseFloat(o.duration_s); o.duration_s = Number.isFinite(n) ? n : null; }
  return out;
}

/** Pure, mutates doc. Move every observation the schema refuses into rejected_observations; returns how many. */
export function dropInvalidObservations(doc, maxPasses = 50) {
  let dropped = 0;
  for (let pass = 0; pass < maxPasses; pass++) {
    const v = validateDirection(doc);
    if (v.valid) break;
    const e = validate.errors.find((x) => /^\/(\w+)\/(\d+)|^\/pacing\/observations\/(\d+)/.test(x.instancePath));
    if (!e) break;
    const m = /^\/pacing\/observations\/(\d+)/.exec(e.instancePath) || null;
    const [sec, idx] = m ? ["pacing", Number(m[1])] : (() => { const k = /^\/(\w+)\/(\d+)/.exec(e.instancePath); return [k[1], Number(k[2])]; })();
    const arr = sec === "pacing" ? doc.pacing.observations : doc[sec];
    if (!Array.isArray(arr) || !arr[idx]) break;
    const [o] = arr.splice(idx, 1);
    doc.rejected_observations.push({ section: sec, reason: `schema: ${e.instancePath} ${e.message}`, observation: o, cited: (o?.evidence || []).map(String) });
    dropped++;
  }
  return dropped;
}

export function buildPrompt({ metadata, scenes, audio, sheets, singles }) {
  const sheetLines = sheets.map((s, i) => `Image ${i + 1}: contact sheet ${s.name}, ${s.cols}x${s.rows} grid, row-major, tiles labelled "<frame id> mm:ss.ss": ${s.frames.join(", ")}`);
  const singleLines = singles.map((f, i) => `Image ${sheets.length + i + 1}: single frame ${f.id} at ${f.t.toFixed(2)}s (${f.reason})`);
  return `You are analysing ONE reference video so a motion-graphics director can reproduce its craft.
Video: ${metadata.width}x${metadata.height} ${metadata.orientation}, ${metadata.duration_s}s, ${metadata.fps} fps.
MEASURED (do not restate or contradict; these are facts): scene cuts at ${JSON.stringify(scenes.cuts)} s; ${scenes.cadence.events_per_10s} on-screen changes per 10 s; ${scenes.cadence.cuts_per_10s} cuts per 10 s; longest hold ${scenes.cadence.longest_hold.length_s} s.
${audio?.candidate_cues?.length ? `Measured audio level-jump cues at (s): ${JSON.stringify(audio.candidate_cues.map((c) => c.t))}.` : "No measured audio cues."}

${sheetLines.join("\n")}
${singleLines.join("\n")}

RULES (hard):
- Describe only what is visible in the images above. No general knowledge, no guessing about frames you were not shown.
- Every observation MUST have "evidence": the frame ids (like "f012") it is based on, only ids listed above, and "confidence": low|medium|high.
- Colour: describe as observation only; do not give brand rules.
- Transition "at_cuts" values must be taken from the measured cuts. Sound-cue "t" must be one of the measured audio cue times; you cannot hear audio, so describe only what the frames at that time show happening.
- If a section has nothing you can support, return an empty array.

Return ONE JSON object with exactly these keys:
{"typography":[{"text","evidence","confidence","families":[],"weights":[],"case","sizes","role","entrance"}],
"composition":[{"text","evidence","confidence","grid","safe_zones","density"}],
"pacing":{"observations":[{"text","evidence","confidence"}]},
"transitions":[{"text","evidence","confidence","type","duration_s","at_cuts":[seconds]}],
"camera_movement":[{"text","evidence","confidence"}],"effects":[{"text","evidence","confidence"}],"color":[{"text","evidence","confidence"}],
"sound_cues":[{"t","text","evidence","confidence"}],"narration_visual":[{"text","evidence","confidence"}],
"storyboard":[{"scene_id":"s1","start","end","frames":["f001"],"description","technique","evidence":["f001"],"confidence"}]}
The storyboard should follow the measured shots in order.`;
}

const b64 = (p) => readFileSync(p).toString("base64");
const img = (p) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64(p)}` } });

/** Pick up to MAX_SINGLES frames to send at full 512 px: the cut-after frames, spread evenly. */
export function pickSingles(frames, max = MAX_SINGLES) {
  const c = frames.filter((f) => f.reason === "cut-after");
  if (c.length <= max) return c;
  const step = c.length / max;
  return Array.from({ length: max }, (_, i) => c[Math.floor(i * step)]);
}

export async function direct({ file, size_bytes, metadata, scenes, audio, frames, sheets, noVision = false, mock }) {
  const mk = (extra) => baseDirection({ file, size_bytes, metadata, scenes, audio, ...extra });
  if (noVision) return { doc: mk({ why: "--no-vision" }), log: { vision: false } };
  const sentSheets = sheets.slice(0, MAX_SHEETS).map((s, i) => ({ ...s, name: s.file.split(/[\\/]/).pop() }));
  const singles = pickSingles(frames);
  const framesSent = [...new Set([...sentSheets.flatMap((s) => s.frames), ...singles.map((f) => f.id)])];
  let call = mock;
  if (!call) {
    const llm = await import("../../src/lib/llm.js");
    if (!llm.llmConfigured()) return { doc: mk({ why: "no vision model configured (no Gemini/OpenRouter/Groq/Ollama key in this environment)" }), log: { vision: false } };
    call = (messages) => llm.callLLMWithProvenance(messages, { maxTokens: 8000, temperature: 0 }, "reference-direct");
  }
  const prompt = buildPrompt({ metadata, scenes, audio, sheets: sentSheets, singles });
  const content = [{ type: "text", text: prompt }, ...sentSheets.map((s) => img(s.file)), ...singles.map((f) => img(f.file))];
  const r = await call([{ role: "user", content }]);
  const value = r.value ?? r;
  const log = { vision: true, frames_sent: framesSent, images: content.length - 1, provider: r.provider ?? null, chain: r.chain ?? null };
  if (r.error || !value || value.error) return { doc: mk({ framesSent, why: `vision call failed: ${r.error || value?.error} ${String(value?.detail || "").slice(0, 160)}`.trim() }), log };
  const base = mk({ framesSent, status: "complete", model: value.model || r.model || null, provider: r.provider ?? null });
  const doc = filterEvidence(base, normalizeShapes(value), framesSent);
  // One mistyped field used to void the whole document (qa-proof run
  // 39708765811: "/typography/0/sizes must be string" discarded 45 frames of
  // evidenced observations). Drop only the observations the schema refuses,
  // into rejected_observations with the reason; fail whole only if the
  // document itself is malformed.
  const schema_dropped = dropInvalidObservations(doc);
  const v = validateDirection(doc);
  if (!v.valid) return { doc: mk({ framesSent, why: `model output failed schema: ${v.errors.join("; ")}` }), log: { ...log, schema_errors: v.errors } };
  return { doc, log: { ...log, schema_dropped } };
}

const row = (cells) => `| ${cells.map((c) => String(c ?? "").replace(/\|/g, "/").replace(/\n/g, " ")).join(" | ")} |`;
const obs = (title, arr, extra = () => "") => arr.length ? `## ${title}\n\n${arr.map((o) => `- ${o.text}${extra(o)} _[${o.confidence}; ${o.evidence.join(", ")}]_`).join("\n")}\n` : `## ${title}\n\n_none_\n`;

export function directionToMarkdown(d) {
  const m = d.measured.metadata, c = d.measured.cadence;
  const out = [`# Creative direction: ${d.source.file}\n`,
    `Status: **${d.direction.status}**${d.direction.why ? ` (${d.direction.why})` : ""}${d.direction.model ? `; model ${d.direction.model}` : ""}${d.direction.provider ? ` via ${d.direction.provider}` : ""}\n`,
    `## Measured\n\n- ${m.width}x${m.height} ${m.orientation}, ${m.duration_s}s, ${m.fps} fps, ${m.codec}, audio: ${m.has_audio ? `${m.audio_channels}ch ${m.audio_sample_rate} Hz` : "none"}`,
    `- Scene cuts (${d.measured.cuts.length}): ${d.measured.cuts.join(", ") || "none"}`,
    `- Changes per 10 s: ${c.events_per_10s}; cuts per 10 s: ${c.cuts_per_10s}; p90 gap: ${c.p90_gap_s}s; longest hold: ${c.longest_hold.length_s}s (${c.longest_hold.start}-${c.longest_hold.end})`,
    d.measured.audio?.loudness ? `- Loudness: ${d.measured.audio.loudness.integrated_lufs} LUFS; candidate sound cues at: ${d.measured.audio.candidate_cues.map((x) => x.t).join(", ") || "none"}` : "- Audio: none",
    `- Frames sent to the model: ${d.frames_sent.length}\n`];
  out.push(obs("Typography", d.typography, (o) => [o.role && ` role: ${o.role}`, o.entrance && ` entrance: ${o.entrance}`].filter(Boolean).join(";")));
  out.push(obs("Composition", d.composition));
  out.push(obs("Pacing (observations; numbers above are measured)", d.pacing.observations));
  out.push(obs("Transitions", d.transitions, (o) => ` (${o.type || "?"}, at ${o.at_cuts.join(", ")}s)`));
  out.push(obs("Camera movement", d.camera_movement));
  out.push(obs("Effects", d.effects));
  out.push(obs("Colour (observation only; colour lives in channels.json)", d.color));
  out.push(obs("Sound cues", d.sound_cues, (o) => ` @${o.t}s`));
  out.push(obs("Narration / visual relationship", d.narration_visual));
  out.push("## Storyboard\n");
  if (d.storyboard.length) {
    out.push(row(["scene", "start", "end", "frames", "description", "technique", "conf"]), row(["---", "---", "---", "---", "---", "---", "---"]));
    for (const s of d.storyboard) out.push(row([s.scene_id, s.start, s.end, s.frames.join(" "), s.description, s.technique, s.confidence]));
  } else out.push("_none_");
  if (d.rejected_observations.length) out.push(`\n## Rejected observations (${d.rejected_observations.length})\n`, ...d.rejected_observations.map((r) => `- ${r.section}: ${r.reason}${r.cited?.length ? ` (${r.cited.join(", ")})` : ""}`));
  return out.join("\n") + "\n";
}
