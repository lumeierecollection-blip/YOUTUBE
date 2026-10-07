// Shared channel resolution.
//
// config/channels.json carries TWO id namespaces and they disagree:
//   - `id`        (numeric, e.g. 5)   -- NOT unique
//   - `channel_id` (e.g. "ch-05")     -- also duplicated for 9 legacy rows
//
// The workflow dispatches by the bare number it derives from channel_id by
// stripping "ch-" and leading zeros (daily-pipeline-v2.yml:116). So the
// canonical way to resolve a dispatched key is to normalise channel_id and
// compare, NEVER to compare `id`. Comparing `id` silently resolved ch-05
// Broadsheet to ch-26 Harmony (both id=5) and handed the discovery stage a
// music-theory context for a true-crime channel -- runs 37548436088 and
// 37549155059 both produced a MUSIC topic for Broadsheet.
//
// This module is the single implementation used by fetch-trending.cjs,
// build-discovery-context.js and anything else that needs to turn a dispatch key
// into exactly one channel. It fails loud rather than guessing.
"use strict";
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = join(__dirname, "..", "..");

// "ch-05" -> "5", "ch-1" -> "1", "5" -> "5". Mirrors the workflow exactly.
const normalizeChannelId = (s) => String(s == null ? "" : s).trim().replace(/^ch-0*/i, "");

function loadChannels(cfgPath = join(ROOT, "config", "channels.json")) {
  try {
    const data = JSON.parse(readFileSync(cfgPath, "utf-8"));
    return data.channels || data || [];
  } catch {
    return [];
  }
}

// Which rows does this dispatch key name?
//
// channel_id normalisation ALONE is not enough. Nine legacy rows duplicate a
// channel_id, and for the three that the pipeline ships daily the two
// namespaces disagree in opposite directions:
//
//   ch-26 "Fraud Files"  id=26  channel_id=ch-26   <- consistent
//   ch-26 "Harmony"      id=5   channel_id=ch-26   <- id says 5
//
// Dispatch key "26" must reach Fraud Files. channel_id normalisation returns
// both, and first-match would hand back Harmony -- regressing a built channel
// that the old id-based lookup got RIGHT. So a candidate must agree with BOTH
// namespaces to win:
//
//   id === K AND normalize(channel_id) === K   -> consistent, wins
//   only one of the two                          -> inconsistent, loses
//
// That resolves all twelve dispatch keys correctly and is the only rule that
// keeps ch-26, ch-44 and ch-49 pointing where they already point.
function candidatesFor(key, channels) {
  const want = normalizeChannelId(key);
  return channels.filter((c) => normalizeChannelId(c.channel_id) === want || String(c.id) === String(key));
}

// "consistent" means the row's two namespaces both agree with the dispatch key.
// The key is normalised on both sides so "5" and "ch-05" are equivalent inputs.
const isConsistent = (c, key) => normalizeChannelId(c.channel_id) === normalizeChannelId(key) && normalizeChannelId(c.id) === normalizeChannelId(key);

// Resolve a dispatch key to exactly one channel row. Throws rather than
// returning a wrong one:
//   channel_not_found   - nothing names the key at all
//   channel_ambiguous   - two or more rows agree with BOTH namespaces
function resolveChannel(key, channels = loadChannels()) {
  const hits = candidatesFor(key, channels);
  if (hits.length === 0) {
    const e = new Error(`channel_not_found: ${key} (no channel_id or id normalises to "${normalizeChannelId(key)}")`);
    e.code = "channel_not_found";
    throw e;
  }
  const consistent = hits.filter((c) => isConsistent(c, key));
  if (consistent.length > 1) {
    const names = consistent.map((c) => `${c.channel_id} "${c.channel_name}" (id=${c.id})`).join(", ");
    const e = new Error(`channel_ambiguous: ${key} matches ${names}`);
    e.code = "channel_ambiguous";
    throw e;
  }
  if (consistent.length === 1) return consistent[0];
  // No row agrees with both namespaces. Every remaining candidate is a genuine
  // data defect, and picking one silently is exactly the bug this module
  // exists to remove -- so it stops instead.
  const names = hits.map((c) => `${c.channel_id} "${c.channel_name}" (id=${c.id})`).join(", ");
  const e = new Error(`channel_ambiguous: ${key} has no row where id and channel_id agree. Candidates: ${names}`);
  e.code = "channel_ambiguous";
  throw e;
}

module.exports = { normalizeChannelId, loadChannels, candidatesFor, resolveChannel, isConsistent };
