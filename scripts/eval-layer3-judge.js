#!/usr/bin/env node
/**
 * eval-layer3-judge.js — Layer 3: Gemini as the judge, watching a whole video.
 *
 * Layer 3 answers "is this good motion graphics". Layer 1 answers "did the
 * renderer execute the plan" deterministically; Layer 2 is a non-blocking style
 * advisory. The judgement is this layer's job alone.
 *
 * The whole MP4 is uploaded and passed as one fileData part — no sampled
 * frames, no storyboard, no contact sheet — so Gemini sees the timeline with
 * its audio, which is the whole reason this layer is not a frame strip.
 *
 * ── Numbers, never a verdict ────────────────────────────────────────────
 *
 * judge() returns axes, aggregate_local, weak_beats. It returns no pass/fail.
 * Accept/retry wiring is the retry-loop push; a judge that also decided would
 * make the threshold untestable in isolation and would put a second opinion
 * inside the thing being measured.
 *
 * ── aggregate_local is the source of truth ───────────────────────────────
 *
 * Weights (spec 2.6): engagement 0.2, prompt_intent 0.2, composition 0.3,
 * style_coherence 0.3. Gemini is also asked for an aggregate, and when it
 * sends one it is recorded as aggregate_gemini for comparison — but the local
 * value is always what is returned. A model reporting its own summary of its
 * own numbers is exactly the self-scoring this layer exists to replace.
 *
 * ── Fail loud on anything untrusted ─────────────────────────────────────
 *
 * Every path that is not a schema-valid score throws: {"error":"no_video"},
 * unparseable JSON, a missing axis, an out-of-range number. None of them
 * becomes a zero, a default, or an approval. And the upload is deleted in a
 * finally that propagates its own failure, because a leaked Files-API upload is
 * a real cost and a silent one.
 *
 * Dependencies are injectable (upload/poll/delete/http/sleep) so the tests can
 * drive every failure path without a network call or a real upload.
 */
import { createRequire } from "node:module";
import { resolveChannel } from "./lib/channel-lookup.mjs";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { uploadVideo as realUpload, pollUntilActive as realPoll, deleteFile as realDelete, apiKey } from "../src/lib/gemini-files.js";
import { ADDRESSABLE_ELEMENTS } from "./beat-element-remediation.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "generativelanguage.googleapis.com";
/**
 * Model choice, corrected against the live API.
 *
 * The brief specified gemini-3-flash. That model does not exist: the account
 * returns 404 "models/gemini-3-flash is not found for API version v1beta" from
 * ModelService.ListModels. There is a gemini-3-flash-preview, but
 * gemini-3.5-flash is the stable GA flash in the same family this repo already
 * uses for visual judgement (daily-pipeline-v2.yml pins
 * SCRIPT_GEMINI_MODEL: gemini-3.5-flash-lite), so it is the conservative pick.
 * The fallback name from the brief, gemini-3.1-flash-lite-preview, does exist
 * and is kept verbatim.
 */
export const MODEL = "gemini-3.5-flash";
export const MODEL_FALLBACK = "gemini-3.1-flash-lite-preview";

/** Spec 2.6. Documented here because these decide what "good" means. */
export const AXIS_WEIGHTS = Object.freeze({
  engagement: 0.2,
  prompt_intent: 0.2,
  composition: 0.3,
  style_coherence: 0.3,
});

/** Flat on purpose: no $ref, $defs, anyOf or const, so this stays portable. */
export const RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["axes", "weak_beats"],
  properties: {
    axes: {
      type: "object",
      required: ["engagement", "prompt_intent", "composition", "style_coherence"],
      properties: {
        engagement: { type: "number", minimum: 0, maximum: 10 },
        prompt_intent: { type: "number", minimum: 0, maximum: 10 },
        composition: { type: "number", minimum: 0, maximum: 10 },
        style_coherence: { type: "number", minimum: 0, maximum: 10 },
      },
    },
    weak_beats: {
      type: "array",
      items: {
        type: "object",
        required: ["timestamp", "axis", "element", "finding"],
        properties: {
          timestamp: { type: "string" },
          axis: { type: "string" },
          element: { type: "string" },
          finding: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    error: { type: "string" },
  },
});

export function buildPrompt({ channelId, styleSpec, layer2Advisory, styleMatch }) {
  const advisory = layer2Advisory === null || layer2Advisory === undefined
    ? "not computed"
    : `${Number(layer2Advisory).toFixed(3)} (mean similarity to the motion-graphics reference family; advisory only, not a gate)`;
  const spec = typeof styleSpec === "string" ? styleSpec : JSON.stringify(styleSpec ?? {});
  return `[ROLE]
You are a motion-graphics quality judge for a short-form vertical video channel.
You evaluate whether a rendered video is good motion graphics and whether it matches its channel's style.

[OBJECTIVE]
Watch the entire video with audio. Score it on four axes, each 0-10:

1. Engagement - does it hold attention beat to beat?
2. Prompt-Intent - does it execute the plan it was directed to execute?
3. Composition - spatial balance, contrast, typography hierarchy, visual harmony.
4. Style Coherence - does it match the channel's motion-graphics reference style?

For any beat scoring below 5 on any axis, name it with its MM:SS timestamp and the specific element that failed.
If the video is not motion graphics at all, say so and score Style Coherence 0.

[CONSTRAINTS]
- Return JSON only. No prose outside the JSON object.
- Do not hallucinate timestamps. Only cite timestamps you can see in the video.
- Do not repeat the prompt back.
- If you cannot see or hear the video, return {"error": "no_video"}.

[INPUT]
Channel: ${channelId}
Channel style spec: ${spec}
Style advisory: ${advisory}${styleMatch ? `
Style match against the reference family: ${styleMatch} (matched = inside the family's own range; clone_suspected = closer to one reference than the references are to each other; off_style = under the family floor; advisory only)` : ""}
Available element fields for weak_beats[].element: ${ADDRESSABLE_ELEMENTS.join(", ")}
If a finding does not correspond to one of these fields, use "other" for element and describe the observation in "finding".
Video: (attached above)`;
}

/**
 * Validate a parsed response. Throws rather than defaulting: a missing axis is
 * not a zero, and a zero is indistinguishable from "this video is bad".
 */
export function validateResponse(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error(`judge response is not an object: ${JSON.stringify(parsed).slice(0, 200)}`);
  if (parsed.error) throw new Error(`judge reported an error: ${parsed.error}`);
  const axes = parsed.axes;
  if (!axes || typeof axes !== "object") throw new Error(`judge response has no axes: ${JSON.stringify(parsed).slice(0, 200)}`);
  const out = {};
  for (const name of Object.keys(AXIS_WEIGHTS)) {
    const v = axes[name];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`axis "${name}" is missing or not a number: ${JSON.stringify(v)}`);
    if (v < 0 || v > 10) throw new Error(`axis "${name}" out of range 0-10: ${v}`);
    out[name] = v;
  }
  if (!Array.isArray(parsed.weak_beats)) throw new Error(`judge response has no weak_beats array: ${JSON.stringify(parsed).slice(0, 200)}`);
  for (const b of parsed.weak_beats) {
    for (const k of ["timestamp", "axis", "element", "finding"]) {
      if (typeof b?.[k] !== "string" || !b[k].trim()) throw new Error(`weak_beats entry missing "${k}": ${JSON.stringify(b).slice(0, 200)}`);
    }
  }
  return { axes: out, weak_beats: parsed.weak_beats };
}

/** Local weighted mean. The only aggregate this module reports as its own. */
export function aggregate(axes, weights = AXIS_WEIGHTS) {
  let s = 0;
  for (const [k, w] of Object.entries(weights)) s += w * axes[k];
  return s;
}

const require = createRequire(import.meta.url);
function httpsJson(url, { method = "POST", headers = {}, body, timeoutMs = 600000 }) {
  const { request } = require("node:https");
  return new Promise((resolve, reject) => {
    const r = request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        clearTimeout(t);
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch { /* leave null */ }
        resolve({ status: res.statusCode, text, json });
      });
    });
    const t = setTimeout(() => { const e = new Error(`${method} ${url} -> no response in ${Math.round(timeoutMs / 1000)}s`); e.name = "AbortError"; r.destroy(e); }, timeoutMs);
    r.on("error", reject);
    r.write(body);
    r.end();
  });
}

function loadStyleSpec(channelId) {
  const p = join(ROOT, "config", "channels.json");
  if (!existsSync(p)) return null;
  try {
    const cfg = JSON.parse(readFileSync(p, "utf8"));
    const ch = resolveChannel(channelId, cfg.channels || cfg);
    if (!ch) return null;
    return { channel_id: ch.channel_id, channel_name: ch.channel_name, niche: ch.niche, style: ch.style, bg_mode: ch.bg_mode, font: ch.font, colors: ch.colors, visual_spec: ch.visual_spec, content_pillars: ch.content_pillars };
  } catch { return null; }
}

/**
 * Judge one rendered video. Numbers only.
 * Dependencies are injectable so every failure path is testable offline.
 */
export async function judge(renderPath, {
  channelId, styleSpec, layer2Advisory, styleMatch,
  upload = realUpload, poll = realPoll, del = realDelete,
  http = httpsJson, env = process.env, model = MODEL, modelFallback = MODEL_FALLBACK,
  runId = String(Date.now()), provenance = true,
} = {}) {
  const started = Date.now();
  const style = styleSpec === undefined ? loadStyleSpec(channelId) : styleSpec;
  const prompt = buildPrompt({ channelId, styleSpec: style, layer2Advisory, styleMatch });

  const file = await upload(renderPath);
  let usedModel = model, aggregateGemini = null, axes = null, weakBeats = null, raw = null, provenancePath = null;

  try {
    const ready = await poll(file.name);
    if (ready.state !== "ACTIVE") throw new Error(`file ${file.name} is ${ready.state}, not ACTIVE`);

    const body = {
      contents: [{ parts: [
        { fileData: { fileUri: ready.uri || file.uri, mimeType: file.mimeType || "video/mp4" } },
        { text: prompt },
      ] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    };

    const call = (m) => http(`https://${HOST}/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey(env), "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    let res = await call(usedModel);
    // 503 high-demand: one retry after 5 s, the same shape gemini-client.js
    // already uses, before spending the fallback model's quota.
    if (res.status === 503) {
      console.error(`[layer3] ${usedModel} 503 high demand — retrying once in 5s`);
      await new Promise((r) => setTimeout(r, 5000));
      res = await call(usedModel);
    }
    // Quota or persistent unavailability: Layer 3 rotates to its own fallback
    // model. Independent of the director's chain so judging cannot starve
    // planning or vice versa.
    if (res.status === 429 || res.status === 503 || /quota|rate limit|high demand/i.test(res.text || "")) {
      console.error(`[layer3] ${usedModel} unavailable (HTTP ${res.status}) -> ${modelFallback}`);
      usedModel = modelFallback;
      res = await call(usedModel);
    }
    if (res.status >= 400) throw new Error(`generateContent failed: HTTP ${res.status} ${String(res.text || "").slice(0, 300)}`);

    const parts = res.json?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("");
    if (!text.trim()) throw new Error(`judge returned no text: ${JSON.stringify(res.json).slice(0, 300)}`);
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error(`judge response is not JSON: ${text.slice(0, 200)}`); }

    const validated = validateResponse(parsed);
    axes = validated.axes;
    weakBeats = validated.weak_beats;
    raw = parsed;
    if (typeof parsed.aggregate === "number") aggregateGemini = parsed.aggregate;
    const local = aggregate(axes);
    if (aggregateGemini !== null && Math.abs(local - aggregateGemini) > 0.5) {
      console.error(`[layer3] aggregate mismatch: local ${local.toFixed(3)} vs gemini ${aggregateGemini.toFixed(3)} — using local`);
    }

    if (provenance) {
      const dir = join(ROOT, "data", "audit", "layer3", String(channelId));
      mkdirSync(dir, { recursive: true });
      provenancePath = join(dir, `${runId}.jsonl`);
      appendFileSync(provenancePath, JSON.stringify({
        ts: new Date().toISOString(),
        channel: String(channelId),
        video_path: renderPath,
        provider: "gemini",
        model: usedModel,
        file_uri: ready.uri || file.uri,
        axes,
        aggregate_local: local,
        aggregate_gemini: aggregateGemini,
        weak_beats: weakBeats,
        layer2_advisory: layer2Advisory ?? null,
        style_match: styleMatch ?? null,
        raw_response: text,
        duration_ms: Date.now() - started,
      }) + "\n");
    }

    return { axes, aggregate_local: local, aggregate_gemini: aggregateGemini, weak_beats: weakBeats, raw, provenance_path: provenancePath, model: usedModel, duration_ms: Date.now() - started };
  } finally {
    // A delete failure propagates: a leaked upload is a real cost, and hiding it
    // here would make the leak invisible exactly when something already went wrong.
    await del(file.name);
  }
}

function arg(name, argv = process.argv) {
  const i = argv.indexOf("--" + name);
  return i > -1 && argv[i + 1] ? argv[i + 1] : null;
}

if (process.argv[1] && process.argv[1].endsWith("eval-layer3-judge.js")) {
  const video = arg("video");
  if (!video) { console.error("Usage: eval-layer3-judge.js --video <mp4> --channel <id> [--advisory <n>]"); process.exit(2); }
  const adv = arg("advisory");
  const r = await judge(video, { channelId: arg("channel"), layer2Advisory: adv === undefined ? null : Number(adv) });
  console.log(`[layer3] model ${r.model} in ${(r.duration_ms / 1000).toFixed(1)}s`);
  console.log(`  axes: ${JSON.stringify(r.axes)}`);
  console.log(`  aggregate_local: ${r.aggregate_local.toFixed(3)}  (gemini: ${r.aggregate_gemini === null ? "absent" : r.aggregate_gemini.toFixed(3)})`);
  console.log(`  weak_beats: ${r.weak_beats.length}`);
  for (const b of r.weak_beats) console.log(`    ${b.timestamp} [${b.axis}] ${b.element} — ${b.reason}`);
  console.log(`  provenance: ${r.provenance_path}`);
}