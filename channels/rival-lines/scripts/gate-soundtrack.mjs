// Gate for the Rival Lines soundtrack plan (out/soundtrack.json) and, when present, the mix report (out/mix-report.json). Check IDs AUD-10..AUD-16 in CHECK-REGISTER.md.
// usage: node gate-soundtrack.mjs <episode_dir>      exit 1 on any failure. STRICT_LICENCE=1 turns the unverified-licence warning into a failure.
import fs from "node:fs";
import path from "node:path";
import { SFX_SOURCES } from "../../../scripts/sfx-cc0.mjs";

const ep = path.resolve(process.argv[2] || "");
const audioDir = path.resolve(import.meta.dirname, "..", "audio");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const rules = readJson(path.join(audioDir, "selection-rules.json"));
const plan = readJson(path.join(ep, "out", "soundtrack.json"));
const props = readJson(path.join(ep, "out", "props.json"));
const reportPath = path.join(ep, "out", "mix-report.json");
const report = fs.existsSync(reportPath) ? readJson(reportPath) : null;

const fails = [], warns = [], passes = [];
const check = (id, ok, msg, warnOnly = false) => (ok ? passes.push(`${id} ${msg}`) : (warnOnly ? warns : fails).push(`${id} ${msg}`));

check("AUD-10", plan.beds.length >= 1 && plan.beds.length <= rules.max_beds, `${plan.beds.length} bed(s), at most ${rules.max_beds}`);
const ids = plan.beds.map((b) => b.track_id);
check("AUD-10", new Set(ids).size === ids.length, "no bed repeats inside the episode");
const licOk = plan.beds.every((b) => rules.allowed_licences.some((l) => b.licence.toLowerCase().includes(`cc ${l}`) || b.licence.toLowerCase().includes(l)));
check("AUD-11", licOk && plan.beds.every((b) => b.attribution && b.landing_url && b.licence_url), "every bed has an allowed licence, an attribution line, a licence URL and a source page");
check("AUD-11", plan.beds.every((b) => b.licence_verified_at_source), `licence checked at the source page for every bed (${plan.beds.filter((b) => !b.licence_verified_at_source).length} not yet; index data is from 2022)`, process.env.STRICT_LICENCE !== "1");
const sorted = [...plan.beds].sort((a, b) => a.t0 - b.t0);
const covers = Math.abs(sorted[0].t0 - 0) < 0.5 && Math.abs(sorted[sorted.length - 1].t1 - props.durationSec) < 1.5 && sorted.every((b, i) => i === 0 || Math.abs(b.t0 - sorted[i - 1].t1) < 0.5);
check("AUD-12", covers, "the beds cover the whole episode with no gap");
const chapterStarts = props.scenes.filter((s) => s.chapter).map((s) => s.t0);
check("AUD-12", sorted.slice(1).every((b) => chapterStarts.some((c) => Math.abs(c - b.t0) < 0.5)), "every bed change falls on a chapter start");
const minutes = props.durationSec / 60;
check("AUD-13", plan.sfx.length / minutes <= rules.sfx.max_per_minute, `${(plan.sfx.length / minutes).toFixed(1)} effects per minute, at most ${rules.sfx.max_per_minute}`);
check("AUD-13", plan.sfx.every((e, i) => i === 0 || e.t - plan.sfx[i - 1].t >= rules.sfx.min_gap_s - 0.01), `effects at least ${rules.sfx.min_gap_s}s apart`);
const sceneAt = Object.fromEntries(props.scenes.map((s) => [s.id, s]));
check("AUD-14", plan.sfx.every((e) => sceneAt[e.scene] && e.t >= sceneAt[e.scene].t0 - 0.2 && e.t <= sceneAt[e.scene].t0 + 0.5 && e.purpose), "every effect sits on a scene start (a visual event) and states its purpose");
check("AUD-15", plan.sfx.every((e) => SFX_SOURCES.some((s) => s.file === e.file && /CC0/.test(s.license))), "every effect is a file from the CC0 palette in scripts/sfx-cc0.mjs");
if (report) {
  const L = report.loudness;
  check("AUD-16", Math.abs(L.final_lufs + 14) <= 0.5, `mix integrated ${L.final_lufs} LUFS (target -14 +-0.5)`);
  check("AUD-16", L.final_tp <= -1.0, `mix true peak ${L.final_tp} dBTP (at most -1.0)`);
  check("AUD-16", Math.abs(L.premaster_lufs - L.voice_stem_lufs) <= 3, `music and effects add ${(L.premaster_lufs - L.voice_stem_lufs).toFixed(2)} LU over the voice stem (within 3 LU: the voice stays the loudest thing)`);
} else warns.push("AUD-16 no out/mix-report.json yet: loudness not checked");

for (const p of passes) console.log("PASS", p);
for (const w of warns) console.log("WARN", w);
for (const f of fails) console.log("FAIL", f);
console.log(`soundtrack gate: ${passes.length} pass, ${warns.length} warn, ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
