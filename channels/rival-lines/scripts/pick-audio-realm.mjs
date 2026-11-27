// Picks the bed and the sound effects for a Realm-style episode and writes out/soundtrack.json in the format mix-audio.mjs reads.
// usage: node pick-audio-realm.mjs <episode_dir>   (needs out/props.json from build-realm-plan.mjs)
// The bed per episode and the visual-to-effect map live in audio/realm-audio.json. Only licence-verified tracks and the CC0 palette are used.
import fs from "node:fs";
import path from "node:path";

const audioDir = path.resolve(import.meta.dirname, "..", "audio");
const ep = path.resolve(process.argv[2] || "");
const rj = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const cfg = rj(path.join(audioDir, "realm-audio.json"));
const rules = rj(path.join(audioDir, "selection-rules.json"));
const lib = rj(path.join(audioDir, "tracks_manual.json"));
const props = rj(path.join(ep, "out", "props.json"));
const name = path.basename(ep);
const pick = cfg.episodes[name];
if (!pick) throw new Error(`no entry for ${name} in audio/realm-audio.json`);

const c = lib.licensed_candidates.find((x) => x.title === pick.bed);
if (!c) throw new Error(`track "${pick.bed}" not in tracks_manual.json`);
if (!c.licence_verified_at_source) throw new Error(`track "${pick.bed}" is not licence-verified at source`);
if (!rules.allowed_licences.includes(String(c.license).toLowerCase())) throw new Error(`licence ${c.license} not allowed`);
const m = lib.licensed_measurements.find((x) => x.id === c.id);
if (!m) throw new Error(`no measurement for "${pick.bed}"`);

const dur = props.durationSec;
const bed = {
  act: "realm", t0: 0, t1: dur, roles: ["whole episode"], track_id: c.id, title: c.title, creator: c.creator,
  licence: `CC ${c.license.toUpperCase()} ${c.license_version}`, licence_url: c.license_url, landing_url: c.landing_url, download_url: c.download_url,
  attribution: c.attribution, licence_verified_at_source: true,
  measured: { tempo_bpm: m.tempo_bpm_est, arc: m.arc, duration_s: m.duration_s, mean_db: m.mean_db },
  start_in_track_s: 0, loops: m.duration_s < dur, why: pick.why,
};

const sfx = [];
for (const s of props.scenes) {
  if (s.t0 < 1) continue;
  const r = cfg.sfx_by_visual[s.visual.type];
  if (!r) continue;
  const slot = rules.sfx.slots[r.slot];
  sfx.push({ t: Math.max(0, +(s.t0 + r.offset_s).toFixed(2)), scene: s.id, slot: r.slot, file: slot.file, peak_db: slot.peak_db, purpose: `${s.visual.type} scene starts` });
}
const kept = [], dropped = [];
for (const e of sfx) {
  const prev = kept[kept.length - 1];
  if (prev && e.t - prev.t < cfg.sfx_min_gap_s) dropped.push({ ...e, reason: `within ${cfg.sfx_min_gap_s}s of ${prev.slot}@${prev.t}` });
  else kept.push(e);
}
const minutes = dur / 60;
while (kept.length / minutes > cfg.sfx_max_per_minute) { const [d] = kept.splice(kept.length - 1, 1); dropped.push({ ...d, reason: "over max per minute" }); }

const out = {
  episode: name, duration_s: dur, rules_version: "realm-audio.json", beds: [bed], sfx: kept, sfx_dropped: dropped, credits: [bed.attribution],
  sfx_note: "SFX are CC0 recordings from Remotion's SFX library (per-file source in scripts/sfx-cc0.mjs); no credit required.",
  limits: ["The bed is a judgement call, not auditioned by ear.", "No impact recording is held, so none is played; the Football Realm reference has impacts about 3.5 times a minute.", "Licence version comes from the Openverse index; Jamendo's page shows the cc-by badge only."],
};
fs.mkdirSync(path.join(ep, "out"), { recursive: true });
fs.writeFileSync(path.join(ep, "out", "soundtrack.json"), JSON.stringify(out, null, 1));
console.log(`${name}: bed "${bed.title}" (${bed.creator}, ${bed.licence})${bed.loops ? " loops" : ""}; sfx ${kept.length} kept, ${dropped.length} dropped (${(kept.length / minutes).toFixed(1)}/min)`);
