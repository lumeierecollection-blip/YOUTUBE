#!/usr/bin/env node
/**
 * Builds a cue sheet per channel from its sample episode and config/longform-cue-rules.json: timecode, scene, cue type, asset, purpose, duration, level, source and licence, approval status.
 * Timing is estimated from the narration word count at 2.5 words/second (the episodes have no recorded voice-over yet). Every cue is 'audition pending': no asset has been listened to.
 * Rules that match no beat are listed in the sheet, so a missing trigger is visible rather than silent. Output: docs/longform/cue-sheets/<channel>.json and .md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const RULES = JSON.parse(readFileSync(join(ROOT, "config/longform-cue-rules.json"), "utf8")), LV = RULES.levels_db_rel_speech;
const LIB = Object.fromEntries(JSON.parse(readFileSync(join(ROOT, "config/longform-audio-library.json"), "utf8")).assets.map((a) => [a.slot, a]));
const QA = JSON.parse(readFileSync(join(ROOT, "config/longform-audio-qa.json"), "utf8")).assets;
const words = (t) => (t.match(/[A-Za-z0-9']+/g) || []).length, WPS = 2.5;
const tc = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;
const OUT = join(ROOT, "docs/longform/cue-sheets"); mkdirSync(OUT, { recursive: true });
const all = {};
for (const channel of Object.keys(RULES.rules)) {
  const { EPISODE: ep } = await import(pathToFileURL(join(ROOT, `platform/longform/v2/episodes/${channel}.mjs`)).href);
  let t = 0; const beats = ep.beats.map((b) => { const d = words(b.vo) / WPS, o = { ...b, start: t, dur: d }; t += d; return o; });
  const cues = [], unmatched = [];
  for (const r of RULES.rules[channel]) {
    const re = r.vo ? new RegExp(r.vo, "i") : null, scene = r.scene;
    if (r.transitions) { // cues on transitions
      let n = 0; for (const tx of ep.transitions) if (r.transitions.includes(tx.kind)) { const b = beats.find((x) => x.id === tx.a); if (!b) continue; cues.push({ at: b.start + b.dur - 0.3, scene: `${tx.a} to ${tx.b}`, cue_type: r.type, asset: r.asset, purpose: r.purpose, duration_s: 1.2, rule: r }); n++; }
      if (!n) unmatched.push(r); continue;
    }
    if (r.group) { // one cue across each run of consecutive beats of the listed scene types
      let run = []; const flush = () => { if (run.length) { cues.push({ at: run[0].start, scene: `${run[0].id}..${run[run.length - 1].id}`, cue_type: r.type, asset: r.asset, purpose: r.purpose, duration_s: run.reduce((s, x) => s + x.dur, 0), rule: r }); run = []; } };
      for (const b of beats) { if (r.group.includes(b.scene.type)) run.push(b); else flush(); } flush(); if (!cues.some((c) => c.rule === r)) unmatched.push(r); continue;
    }
    let hits = beats.filter((b) => (!scene || scene.includes(b.scene.type)) && (!re || re.test(b.vo)) && (!r.last_beat || b === beats[beats.length - 1]));
    if (r.first) hits = hits.slice(0, 1);
    if (!hits.length) { unmatched.push(r); continue; }
    for (const b of hits) cues.push({ at: b.start + (r.offset_s ?? 0), scene: b.id, cue_type: r.type, asset: r.asset, purpose: r.purpose, duration_s: r.type === "ambience" || r.type === "bed" ? b.dur : r.duration_s ?? (r.type === "riser" ? 4 : LIB[r.asset] ? Math.min(LIB[r.asset].measured.duration_s, 3) : 1.5), rule: r });
  }
  cues.sort((a, b) => a.at - b.at);
  const rows = cues.map((c) => { const lib = LIB[c.asset], isNone = c.asset.startsWith("("); return { timecode: tc(c.at), seconds: Number(c.at.toFixed(1)), scene: c.scene, cue_type: c.cue_type, asset: c.asset, purpose: c.purpose, duration_s: Number(c.duration_s.toFixed(1)), level_db_rel_speech: isNone ? null : LV[c.cue_type] ?? -20, source_licence: isNone ? "n/a" : `${lib.source_provider} ${lib.source_page} | ${lib.license}${/^by/.test(lib.license) ? " | attribution: " + lib.attribution : ""}`, approval_status: isNone ? "n/a" : (QA[c.asset]?.approval === "pending human audition" ? "audition pending" : "needs correction, then audition pending") }; });
  const sheet = { channel, episode: ep.title, estimated_minutes: Number((t / 60).toFixed(1)), basis: "timing from narration word count at 2.5 words/s; not a recorded voice-over", cues: rows, unmatched_rules: unmatched.map((r) => r.asset + " (" + r.purpose.slice(0, 50) + ")"), listening_review: "NOT DONE" };
  writeFileSync(join(OUT, `${channel}.json`), JSON.stringify(sheet, null, 1));
  writeFileSync(join(OUT, `${channel}.md`), [`# Cue sheet: ${ep.title} (${channel})`, "", `Timing estimated from the narration word count (2.5 words/s), ${sheet.estimated_minutes} min of narration in the sample beats. **Nothing here has been listened to**; every cue is a proposal awaiting audition. Level = dB relative to the narration.`, "", "| Timecode | Scene | Cue type | Asset | Purpose | Duration s | Level dB | Source and licence | Approval status |", "|---|---|---|---|---|---|---|---|---|", ...rows.map((r) => `| ${r.timecode} | ${r.scene} | ${r.cue_type} | ${r.asset} | ${r.purpose} | ${r.duration_s} | ${r.level_db_rel_speech ?? "n/a"} | ${r.source_licence.replace(/\|/g, "/")} | ${r.approval_status} |`), "", sheet.unmatched_rules.length ? `Rules that matched no beat (nothing was invented to fill them): ${sheet.unmatched_rules.join("; ")}` : "All rules matched at least one beat.", ""].join("\n"));
  all[channel] = rows.length; console.log(channel.padEnd(22), rows.length, "cues in", sheet.estimated_minutes, "min", sheet.unmatched_rules.length ? "| unmatched: " + sheet.unmatched_rules.length : "");
}
