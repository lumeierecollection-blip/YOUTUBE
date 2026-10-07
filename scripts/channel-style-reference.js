/**
 * The channel's style spec, handed to the planner as REFERENCE. (Phase 1.5: the planner prompt used
 * to take channelId and discard it — `void channelId` — so channels/<ch>/style-spec.json, which
 * no code read, shaped nothing.)
 *
 *   loadStyleReference   the spec (+ name, niche, accent) for a dispatch key, or why there is none
 *   styleReferenceBlock  the prompt text for it, framed as reference, not instruction
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChannel } from "./lib/channel-lookup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The style reference for one dispatched channel, or null.
 *   -> { ref, path, fields }   when channels/<channel_id>/style-spec.json (or the row's
 *                              style_spec_path) exists and parses
 *   -> { ref: null, why }      otherwise; the caller logs `style_spec_missing` and continues
 *
 * `ref` is what goes into the planner prompt: the channel's name and niche, its accent colour, and
 * the spec's own fields. It is reference material — the prompt says so — and nothing reads it back.
 */
export function loadStyleReference(channelId, { root = ROOT, channels } = {}) {
  let row;
  try { row = resolveChannel(channelId, channels); }
  catch (e) { return { ref: null, why: `channel not resolved (${e.message})` }; }
  const rel = row.style_spec_path || `channels/${row.channel_id}/style-spec.json`;
  const path = join(root, ...String(rel).split("/"));
  if (!existsSync(path)) return { ref: null, why: `no style spec at ${rel}`, channel: row.channel_id };
  let spec;
  try { spec = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { return { ref: null, why: `${rel} does not parse (${e.message})`, channel: row.channel_id }; }
  const ref = {
    channel: row.channel_name,
    niche: row.niche,
    ...(row.colors?.canvas_accent ? { accent_colour: row.colors.canvas_accent } : {}),
    ...Object.fromEntries(Object.entries(spec).filter(([k]) => k !== "reference_video" && k !== "style_reference_document")),
  };
  return { ref, path: rel, fields: Object.keys(ref).length, channel: row.channel_id };
}

/** The prompt block for a style reference. Framed as reference, not constraint, on purpose. */
export function styleReferenceBlock(ref) {
  if (!ref) return "";
  return `CHANNEL STYLE REFERENCE — what this channel looks like. This is reference, not instruction: use it where it helps a beat, and depart from it wherever the narration calls for something else; you decide each beat.\n${JSON.stringify(ref, null, 2)}\n\n`;
}
