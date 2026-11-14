#!/usr/bin/env node
/**
 * Production eligibility: only channels whose YouTube credentials are configured in GitHub AND validated may produce videos (Shorts or long-form).
 *
 * Discovery is automatic: it reads the secret NAMES from ALL_SECRETS (a step's `env: ALL_SECRETS: ${{ toJSON(secrets) }}`), finds every complete
 * CHANNEL_NN_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN trio, refreshes a token and asks YouTube which channel it reaches. A slot is eligible only
 * when that channel id equals the expected id on record (config/channel-registry.json upload.youtube_channel_id, else config/autopilot.json).
 * A slot whose expected id is not on record is NOT eligible: the credential cannot be tied to a channel. No secret value is ever printed or written.
 *
 * Usage:
 *   node platform/production/eligibility.mjs                      -> writes eligibility.json and prints the table
 *   node platform/production/eligibility.mjs --require ai-tested  -> same, then exits 1 unless that channel (registry key or slot) is eligible
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../../scripts/autopilot/lib.mjs";
import { accessToken, ytGet } from "../../scripts/autopilot/deliver.mjs";

let all = {};
try { all = JSON.parse(process.env.ALL_SECRETS || "{}"); } catch { throw new Error("ALL_SECRETS is not valid JSON"); }
const PARTS = ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"];
const slots = [...new Set(Object.keys(all).map((k) => (k.match(/^CHANNEL_(\d{2})_(CLIENT_ID|CLIENT_SECRET|REFRESH_TOKEN)$/) || [])[1]).filter(Boolean))].sort();
for (const s of slots) for (const p of PARTS) if (all[`CHANNEL_${s}_${p}`]) process.env[`CHANNEL_${s}_${p}`] = all[`CHANNEL_${s}_${p}`]; // accessToken() reads these

const J = (f) => { try { return JSON.parse(readFileSync(join(ROOT, f), "utf8")); } catch { return {}; } };
const reg = J("config/channel-registry.json"), auto = J("config/autopilot.json");
const regList = Array.isArray(reg) ? reg : reg.channels || Object.values(reg);
const expected = (s) => {
  const r = regList.find((x) => x.upload?.secret_prefix === `CHANNEL_${s}`);
  return { key: r?.key || null, name: r?.name || auto.channels?.[String(Number(s))]?.name || null, id: r?.upload?.youtube_channel_id || auto.channels?.[String(Number(s))]?.youtube_channel_id || null };
};

const rows = [];
for (const s of slots) {
  const exp = expected(s), missing = PARTS.filter((p) => !all[`CHANNEL_${s}_${p}`]);
  const row = { slot: s, channel_key: exp.key, channel_name: exp.name, configured: missing.length === 0, validated: false, expected_channel_id: exp.id, reached_channel_id: null, reached_title: null, reason: "" };
  if (missing.length) row.reason = `missing secret(s): ${missing.map((p) => `CHANNEL_${s}_${p}`).join(", ")}`;
  else {
    try {
      const ch = (await ytGet("channels?part=id,snippet&mine=true", await accessToken(s))).items?.[0];
      row.reached_channel_id = ch?.id || null; row.reached_title = ch?.snippet?.title || null;
      if (!ch) row.reason = "the login reaches no YouTube channel";
      else if (!exp.id) row.reason = "no expected channel id on record, so the credential cannot be tied to a channel";
      else if (ch.id !== exp.id) row.reason = `login reaches ${ch.id}, expected ${exp.id}`;
      else { row.validated = true; row.reason = "ok"; }
    } catch (e) { row.reason = `validation failed: ${String(e.message).replace(/[A-Za-z0-9_\-.]{30,}/g, "[redacted]")}`; }
  }
  row.shorts_eligible = row.longform_eligible = row.configured && row.validated;
  rows.push(row);
}

const report = { checked_at: new Date().toISOString(), discovered_slots: slots.length, eligible: rows.filter((r) => r.shorts_eligible).map((r) => r.channel_key || `slot-${r.slot}`), channels: rows };
writeFileSync(join(ROOT, "eligibility.json"), JSON.stringify(report, null, 2));
console.log("slot | channel | configured | validated | shorts | long-form | reason");
for (const r of rows) console.log([r.slot, r.channel_key || r.channel_name || "?", r.configured, r.validated, r.shorts_eligible, r.longform_eligible, r.reason].join(" | "));

const i = process.argv.indexOf("--require");
if (i > -1) {
  const want = process.argv[i + 1], r = rows.find((x) => x.channel_key === want || x.slot === String(want).padStart(2, "0"));
  if (!r?.shorts_eligible) { console.error(`NOT ELIGIBLE: ${want}: ${r ? r.reason : "no credentials configured in GitHub"}. Production stopped.`); process.exit(1); }
  console.log(`eligible: ${want}`);
}
