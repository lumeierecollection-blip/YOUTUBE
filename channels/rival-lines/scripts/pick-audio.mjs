// Picks the music beds and sound effects for a Rival Lines episode. Plans only: no audio is read or written here.
// usage: node pick-audio.mjs <episode_dir> [--record]   (needs out/props.json from build-plan.mjs)
//   -> <episode_dir>/out/soundtrack.json
// Narrative fit comes first: each chapter gets a role (hook, evidence, model, caveat, resolve) from its title, chapters group
// into at most three acts, and each act gets the licensed track whose measured profile is closest to that role's target.
// Nothing is random: the same episode, library and usage log give the same answer. Variety comes from the usage log.
// --record appends this episode's picks to audio/usage-log.json (do it only for an episode that is going to publish).
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const audioDir = path.resolve(here, "..", "audio");
const ep = path.resolve(process.argv[2] || "");
const record = process.argv.includes("--record");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

const rules = readJson(path.join(audioDir, "selection-rules.json"));
const lib = readJson(path.join(audioDir, "tracks_manual.json"));
const props = readJson(path.join(ep, "out", "props.json"));
const logPath = path.join(audioDir, "usage-log.json");
const usage = fs.existsSync(logPath) ? readJson(logPath) : { episodes: [] };

const meas = Object.fromEntries(lib.licensed_measurements.map((m) => [m.id, m]));
const lic = (c) => String(c.license).toLowerCase();

function profile(c, m) {
  const tags = new Set([...(c.tags || []), ...(c.genres || [])].map((t) => String(t).toLowerCase()));
  let energy = 0.35 + Math.min(0.3, (m.onsets_per_s || 0) * 0.25) + Math.min(0.15, Math.max(0, ((m.tempo_bpm_est || 90) - 90) / 300));
  let tension = 0.3 + Math.min(0.15, Math.max(0, (m.dynamic_range_db || 0) - 10) * 0.02);
  for (const t of tags) { energy += rules.tag_energy[t] || 0; tension += rules.tag_tension[t] || 0; }
  return { energy: clamp(energy), tension: clamp(tension) };
}

const candidates = lib.licensed_candidates
  .filter((c) => rules.allowed_licences.includes(lic(c)))
  .filter((c) => meas[c.id] && c.download_url)
  .filter((c) => !rules.require_verified_licence || c.licence_verified_at_source)
  .filter((c) => !(c.tags || []).some((t) => /^(vocal|vocals|lyrics|singing|male|female|voice)$/i.test(t)))
  .map((c) => ({ c, m: meas[c.id], p: profile(c, meas[c.id]) }));

const roleOf = (title) => {
  for (const r of rules.role_by_chapter_title) if (new RegExp(r.match, "i").test(title)) return r.role;
  return rules.default_role;
};

// Chapters: a scene with a chapter object starts one; the rest inherit.
const chapters = [];
for (const s of props.scenes) {
  if (s.chapter) chapters.push({ n: s.chapter.n, title: s.chapter.title, role: roleOf(s.chapter.title), t0: s.t0, t1: s.t1, scenes: [s] });
  else if (chapters.length) { const k = chapters[chapters.length - 1]; k.t1 = s.t1; k.scenes.push(s); }
}
if (!chapters.length) throw new Error("no chapters in props: cannot assign narrative roles");

const actOf = (role) => rules.acts.find((a) => a.roles.includes(role))?.id;
const acts = [];
for (const k of chapters) {
  const id = actOf(k.role);
  let a = acts.find((x) => x.id === id);
  if (!a) { a = { id, chapters: [], t0: k.t0, t1: k.t1 }; acts.push(a); }
  a.chapters.push(k); a.t0 = Math.min(a.t0, k.t0); a.t1 = Math.max(a.t1, k.t1);
}
acts.sort((a, b) => a.t0 - b.t0);
if (acts.length > rules.max_beds) throw new Error(`more acts (${acts.length}) than max_beds (${rules.max_beds})`);

function target(a) {
  let w = 0; const t = { energy: 0, tension: 0, lo: 0, hi: 0, arc: null };
  for (const k of a.chapters) {
    const r = rules.roles[k.role], d = k.t1 - k.t0; w += d;
    t.energy += r.energy * d; t.tension += r.tension * d; t.lo += r.tempo[0] * d; t.hi += r.tempo[1] * d;
    if (r.prefer_arc) t.arc = r.prefer_arc;
  }
  return { energy: t.energy / w, tension: t.tension / w, tempo: [t.lo / w, t.hi / w], arc: t.arc };
}

const last = usage.episodes[usage.episodes.length - 1];
const usedBefore = (id) => usage.episodes.reduce((n, e) => n + e.beds.filter((b) => b.track_id === id).length, 0);
const taken = new Set(); const takenCreators = new Set();
const beds = [];
for (const a of acts) {
  const tg = target(a), dur = a.t1 - a.t0;
  const scored = candidates.filter((x) => !taken.has(x.c.id)).map((x) => {
    const [lo, hi] = tg.tempo, bpm = x.m.tempo_bpm_est || 0;
    const tempoFit = bpm >= lo && bpm <= hi ? 1 : clamp(1 - Math.min(Math.abs(bpm - lo), Math.abs(bpm - hi)) / 40);
    const arcFit = tg.arc ? (x.m.arc === tg.arc ? 1 : 0.5) : 0.75;
    const fit = rules.weights.energy * (1 - Math.abs(x.p.energy - tg.energy)) + rules.weights.tension * (1 - Math.abs(x.p.tension - tg.tension))
      + rules.weights.tempo * tempoFit + rules.weights.arc * arcFit;
    let pen = 0; const why = [];
    if (last?.beds.some((b) => b.track_id === x.c.id)) { pen += rules.variety.used_in_last_episode; why.push("used in the last episode"); }
    const n = usedBefore(x.c.id); if (n) { pen += rules.variety.per_prior_use * n; why.push(`used ${n}x before`); }
    if (takenCreators.has(x.c.creator)) { pen += rules.variety.same_creator_in_episode; why.push("same creator as another bed"); }
    const short = x.m.duration_s < dur * 0.6 ? 0.1 : 0;
    if (short) why.push("track shorter than 60% of the act: would loop");
    return { x, fit, score: fit - pen - short, tempoFit, why };
  }).sort((p, q) => q.score - p.score || (p.x.c.id < q.x.c.id ? -1 : 1));
  if (!scored.length) throw new Error(`no licensed candidate for ${a.id}`);
  const best = scored[0], c = best.x.c;
  taken.add(c.id); takenCreators.add(c.creator);
  beds.push({
    act: a.id, t0: a.t0, t1: a.t1, roles: a.chapters.map((k) => `${k.n}:${k.role}`),
    target: { energy: +tg.energy.toFixed(2), tension: +tg.tension.toFixed(2), tempo_bpm: tg.tempo.map((v) => Math.round(v)), arc: tg.arc },
    track_id: c.id, title: c.title, creator: c.creator, licence: `CC ${c.license.toUpperCase()} ${c.license_version}`, licence_url: c.license_url,
    landing_url: c.landing_url, download_url: c.download_url, attribution: c.attribution, licence_verified_at_source: !!c.licence_verified_at_source,
    measured: { tempo_bpm: best.x.m.tempo_bpm_est, arc: best.x.m.arc, duration_s: best.x.m.duration_s, mean_db: best.x.m.mean_db, ...best.x.p },
    start_in_track_s: 0, loops: best.x.m.duration_s < dur,
    fit: +best.fit.toFixed(3), score: +best.score.toFixed(3), penalties: best.why,
    runner_up: scored[1] ? { title: scored[1].x.c.title, score: +scored[1].score.toFixed(3) } : null,
  });
}

// Sound effects: only where a rule names a visual event, never closer than min_gap_s, never over max_per_minute.
const sfx = []; const perSlot = {};
const types = (s) => [`visual:${s.visual.type}`];
const firstCurve = new Set(chapters.map((k) => k.scenes.find((s) => s.visual.type === "curve")?.id).filter(Boolean));
for (const s of props.scenes) {
  const hits = [];
  if (s.chapter) hits.push(rules.sfx.rules.find((r) => r.when === "chapter_start"));
  if (firstCurve.has(s.id)) hits.push(rules.sfx.rules.find((r) => r.when === "visual:curve:first_in_chapter"));
  else for (const w of types(s)) { const r = rules.sfx.rules.find((q) => q.when === w); if (r) hits.push(r); }
  for (const r of hits) {
    if (!r) continue;
    if (r.max_per_episode && (perSlot[r.slot] || 0) >= r.max_per_episode) continue;
    const slot = rules.sfx.slots[r.slot];
    sfx.push({ t: Math.max(0, +(s.t0 + r.offset_s).toFixed(2)), scene: s.id, slot: r.slot, file: slot.file, peak_db: slot.peak_db, purpose: r.purpose });
    perSlot[r.slot] = (perSlot[r.slot] || 0) + 1;
  }
}
sfx.sort((a, b) => a.t - b.t);
const kept = []; const dropped = [];
for (const e of sfx) {
  const prev = kept[kept.length - 1];
  if (prev && e.t - prev.t < rules.sfx.min_gap_s) { dropped.push({ ...e, reason: `within ${rules.sfx.min_gap_s}s of ${prev.slot}@${prev.t}` }); continue; }
  kept.push(e);
}
const minutes = props.durationSec / 60;
while (kept.length / minutes > rules.sfx.max_per_minute) { const i = kept.findIndex((e) => e.slot !== "whoosh"); const [d] = kept.splice(i < 0 ? kept.length - 1 : i, 1); dropped.push({ ...d, reason: "over max_per_minute" }); }

const credits = beds.map((b) => b.attribution);
const out = {
  episode: path.basename(ep), duration_s: props.durationSec, rules_version: "selection-rules.json", beds, sfx: kept, sfx_dropped: dropped,
  credits, sfx_note: "SFX are CC0 (Remotion SFX library, per-file source in scripts/sfx-cc0.mjs); no credit required.",
  limits: ["Track profiles come from measured tempo/onsets/dynamics plus the provider's tags, not from listening.", "Licence terms come from Openverse index data (2022) and are not verified at source unless licence_verified_at_source is true."],
};
fs.mkdirSync(path.join(ep, "out"), { recursive: true });
fs.writeFileSync(path.join(ep, "out", "soundtrack.json"), JSON.stringify(out, null, 1));
for (const b of beds) console.log(`${b.act} ${b.t0.toFixed(0)}-${b.t1.toFixed(0)}s [${b.roles.join(" ")}] -> "${b.title}" (${b.creator}, ${b.licence}) fit ${b.fit} score ${b.score}${b.penalties.length ? " | " + b.penalties.join("; ") : ""}`);
console.log(`sfx: ${kept.length} kept, ${dropped.length} dropped (${(kept.length / minutes).toFixed(1)}/min)`);
if (record) {
  usage.episodes.push({ episode: out.episode, picked_on: new Date().toISOString().slice(0, 10), beds: beds.map((b) => ({ act: b.act, track_id: b.track_id, title: b.title, creator: b.creator })) });
  fs.writeFileSync(logPath, JSON.stringify(usage, null, 1));
  console.log("recorded in audio/usage-log.json");
}
