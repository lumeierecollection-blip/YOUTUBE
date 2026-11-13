#!/usr/bin/env node
/**
 * Long-form production QA (visual + audio plan). Measurable, explainable checks against per-channel reference bands
 * (config/longform-qa-standards.json, derived from the 33-video reference study) and hard rules from CLAUDE.md.
 *
 * What it checks (each flag states what was measured, the standard, the evidence source and whether the standard is provisional):
 *   V1 AI-generated imagery            V2 authentic-media share (upper bound: a beat counts as real if it shows at least one authentic asset)
 *   V3 all-constructed stretch         V4 text/caption overlay share      V5 asset reuse (repetitive media)
 *   V6 attribution on every third-party asset    V7 licence recorded and commercial use allowed    V8 long unchanging visual (single beat length)
 *   V9 scene-change rate vs reference shots/min  V11 permissions actually cleared  V10 visual-narration match (lexical, flags only for a person to check)
 *   A1 cue purpose written   A2 cue density   A3 music/bed level vs speech   A4 unapproved or flagged assets in the mix
 *   A5 missing audio assets  A6 repetitive music (one bed on several channels)  A7 final loudness / true peak (if a measurement file exists)
 * Duration of a beat is estimated from its narration at 2.5 words/second (150 wpm): an assumption, stated in every report.
 * Usage: node platform/longform/qa/visual-audio-qa.mjs [channel|all] [--out docs/longform/qa]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hasCredit } from "../v2/credits.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CH = { "hidden-past": "hidden-past-yellow-fleet", "ai-tested": "ai-tested-multiplication", "court-and-spotlight": "court-and-spotlight-becker", "celebrity-news": "celebrity-news-swift-masters", "rival-lines": "rival-lines-euro-2024-final", "red-space-facts": "red-space-facts-uranus", psychology: "psychology-pygmalion" };
const WPS = 2.5, STD = JSON.parse(readFileSync(join(ROOT, "config/longform-qa-standards.json"), "utf8"));
const LIB = existsSync(join(ROOT, "config/longform-audio-library.json")) ? JSON.parse(readFileSync(join(ROOT, "config/longform-audio-library.json"), "utf8")).assets : [];
const AQA = existsSync(join(ROOT, "config/longform-audio-qa.json")) ? JSON.parse(readFileSync(join(ROOT, "config/longform-audio-qa.json"), "utf8")).assets : {};
const REAL_KINDS = /authentic|web page capture|court document|screen recording/i, GENERATED = /generat|ai[- ]?image|diffusion/i;
const walk = (o, f) => { if (typeof o === "string") f(o); else if (Array.isArray(o)) o.forEach((x) => walk(x, f)); else if (o && typeof o === "object") Object.values(o).forEach((x) => walk(x, f)); };
const words = (t) => (t.match(/[A-Za-z0-9']+/g) || []).length;
const STOP = new Set("their there which would about these those other after before where while being between because during through under over again against into from with that this have been were will also than then them they what when your more most some such only very just like said says"
  .split(" "));
const content = (t) => new Set((t.toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !STOP.has(w)));

function levelOf(flag) { return flag; }
export async function qaChannel(channel, opts = {}) {
  const { EPISODE: ep } = await import(pathToFileURL(join(ROOT, `platform/longform/v2/episodes/${channel}.mjs`)).href);
  const man = JSON.parse(readFileSync(join(ROOT, `docs/longform/episodes/${CH[channel]}/MEDIA-MANIFEST.json`), "utf8"));
  const assets = Object.fromEntries(man.assets.map((a) => [a.asset, a]));
  const std = STD.channels[channel], findings = [], metrics = {};
  const add = (id, level, name, measured, standard, why, evidence, provisional = true) => findings.push({ id, level, name, measured, standard, why, evidence, provisional });
  // ---- per-beat model
  const beats = ep.beats.map((b) => {
    const used = []; walk(b.scene, (s) => { if (/^lf2\//.test(s) && assets[s]) used.push(s); });
    const real = used.filter((a) => REAL_KINDS.test(assets[a].kind || "")), gen = used.filter((a) => GENERATED.test(assets[a].kind || ""));
    let overlay = false; for (const k of Object.keys(b.scene)) if (/^(captions?|kicker)$/i.test(k)) overlay = true; // editorial caption keys only: map/diagram labels, badges and credits are not editorial captions
    return { id: b.id, type: b.scene.type, sec: words(b.vo) / WPS, used, real: real.length > 0, gen: gen.length > 0, overlay, vo: b.vo, scene: b.scene };
  });
  const total = beats.reduce((s, b) => s + b.sec, 0), min = total / 60;
  metrics.estimated_minutes = Number(min.toFixed(1)); metrics.target_minutes = ep.target_minutes; metrics.beats = beats.length;
  // V1
  const gen = beats.filter((b) => b.gen).reduce((s, b) => s + b.sec, 0) / total; metrics.ai_generated_share = Number(gen.toFixed(3));
  add("V1", gen > 0 && channel !== "ai-tested" ? "FAIL" : gen > (std.ai_generated_share?.max ?? 0) + STD.tolerances.share_points ? "WARN" : "PASS", "AI-generated imagery", `${(100 * gen).toFixed(0)}% of estimated time`, channel === "ai-tested" ? `<= ${(100 * (std.ai_generated_share?.max ?? 0)).toFixed(0)}% (+12 points tolerance), only as the subject being tested` : "0% (hard rule; none of the 28 non-AI-Tested reference videos shows any)", "Generated pictures read as artificial when used as decoration.", "VISUAL-EDITING-RESEARCH.md section 3-4", false);
  // V2
  const real = beats.filter((b) => b.real).reduce((s, b) => s + b.sec, 0) / total; metrics.authentic_beat_share_upper_bound = Number(real.toFixed(3));
  const lo = std.real_captured_share.min, hi = std.real_captured_share.max, tol = STD.tolerances.share_points, wide = hi - lo > 0.6;
  add("V2", wide ? "INFO" : real < lo - tol ? "FAIL" : real < lo ? "WARN" : "PASS", "Authentic media share", `${(100 * real).toFixed(0)}% of estimated time shows at least one authentic asset (upper bound)`, `reference band ${(100 * lo).toFixed(0)}-${(100 * hi).toFixed(0)}% real captured (sampled; -12 points tolerance)${wide ? "; band wider than 60 points, advisory only" : ""}`, "The references that look least artificial are built on real captured material; constructed graphics should explain what real media cannot.", `VISUAL-EDITING-RESEARCH.md section 3 (${std.reference_videos.length} videos, ${std.reference_channels.join(", ")})`);
  // V3 longest constructed stretch
  let run = 0, best = 0, bestAt = "";
  for (const b of beats) { if (!b.real) { run += b.sec; if (run > best) { best = run; bestAt = b.id; } } else run = 0; }
  metrics.longest_constructed_stretch_s = Math.round(best);
  const cmax = std.longest_constructed_run_s.max;
  add("V3", wide ? "INFO" : best > cmax * 1.5 ? "FAIL" : best > cmax ? "WARN" : "PASS", "All-constructed stretch", `${Math.round(best)} s (ending at beat ${bestAt})`, `longest in the references ${cmax} s (sampled runs of 15 s); FAIL above 1.5x`, "Long runs of graphics without any real picture are the 'AI slideshow' pattern the references avoid.", "VISUAL-EDITING-RESEARCH.md section 4");
  // V4 overlay share
  const ov = beats.filter((b) => b.overlay).reduce((s, b) => s + b.sec, 0) / total; metrics.overlay_beat_share = Number(ov.toFixed(3));
  add("V4", ov > std.overlay_text_share.max + tol ? "WARN" : "PASS", "Caption / text overlay share", `${(100 * ov).toFixed(0)}% of time on beats that carry an editorial caption or kicker (labels, badges and credits are not counted)`, `reference band ${(100 * std.overlay_text_share.min).toFixed(0)}-${(100 * std.overlay_text_share.max).toFixed(0)}% (+12 points)`, "Text on every scene is not what the references do; labels belong to key terms, footage and credits.", "CAPTION-RESEARCH.md");
  // V5 reuse
  const count = {}; for (const b of beats) for (const a of new Set(b.used)) count[a] = (count[a] || 0) + 1;
  const reused = Object.entries(count).filter(([, n]) => n > 2); metrics.assets_used = Object.keys(count).length; metrics.distinct_real_assets = Object.keys(count).filter((a) => REAL_KINDS.test(assets[a].kind)).length;
  add("V5", reused.length ? "WARN" : "PASS", "Repeated media", reused.length ? reused.map(([a, n]) => `${a} x${n}`).join(", ") : `${metrics.distinct_real_assets} distinct authentic assets across ${beats.length} beats`, "no asset on more than 2 beats (author's rule; no reference measurement)", "Repeating one picture reads as generic filler.", "none (judgement)");
  // V6 attribution
  const noCredit = []; for (const b of beats) for (const a of b.used) { const m = assets[a]; if (!REAL_KINDS.test(m.kind) || /capture|screen recording|court document/i.test(m.kind)) continue; if (!hasCredit(channel, b.scene)) noCredit.push(`${b.id}:${a.split("/").pop()}`); }
  add("V6", noCredit.length ? "FAIL" : "PASS", "Credit on every third-party picture", noCredit.length ? `${noCredit.length} shown without a credit line (no scene credit and none recorded in ATTRIBUTIONS.json): ${noCredit.join(", ")}` : "every authentic picture has a credit field in its scene", "100% (hard rule; the references show credit or source lines on borrowed material)", "CLAUDE.md: no media without a recorded source; references credit borrowed clips on screen.", "CAPTION-RESEARCH.md; CLAUDE.md", false);
  // V7 licence
  const badLic = man.assets.filter((a) => !a.licence || !a.source_url || a.commercial_use === false || /NC|ND/.test(a.licence || ""));
  add("V7", badLic.length ? "FAIL" : "PASS", "Licence and source recorded", badLic.length ? badLic.map((a) => a.asset).join(", ") : `${man.assets.length} assets with licence and source`, "every asset has licence, source URL and commercial use allowed (hard rule)", "CLAUDE.md hard rule.", "MEDIA-MANIFEST.json", false);
  // V11 permissions actually verified (a recorded licence is not the same as cleared use)
  const unclear = man.assets.filter((a) => !/^yes/i.test(a.usable || "")), usedUnclear = unclear.filter((a) => count[a.asset]);
  add("V11", usedUnclear.length ? "WARN" : "PASS", "Media permissions verified", usedUnclear.length ? `${usedUnclear.length} used asset(s) not cleared by licence (owner decision needed): ${usedUnclear.map((a) => a.asset.split("/").pop()).join(", ")}` : "every used asset is cleared by its recorded licence", "usable = yes for every used asset (page screenshots of third-party sites are 'owner decision': quotation/commentary, not a licence)", "A recorded source is not permission to use.", "MEDIA-MANIFEST.json (usable field); docs/longform/MEDIA-ACQUISITION.md", false);
  // V8 long unchanging visual
  const lsMax = std.longest_static_s.max, longBeats = beats.filter((b) => b.sec > Math.max(60, lsMax)); metrics.longest_beat_s = Math.round(Math.max(...beats.map((b) => b.sec)));
  add("V8", longBeats.length ? "WARN" : "PASS", "Long unchanging visual", `longest single beat ${metrics.longest_beat_s} s (beat length, not measured change)`, `longest static stretch in the references ${lsMax} s (frame-difference score); flag above max(60 s, that)`, "A beat that long needs internal change (camera move, reveal, new panel) or a cut to real media.", "VISUAL-EDITING-RESEARCH.md section 6");
  // V9 change rate
  const rate = beats.length / min; metrics.scene_changes_per_min = Number(rate.toFixed(1));
  add("V9", rate < std.shots_per_min.min * 0.5 ? "WARN" : "INFO", "Scene-change rate", `${rate.toFixed(1)} beats/min (a beat can contain several internal changes)`, `reference ${std.shots_per_min.min}-${std.shots_per_min.max} shots/min (dissolve-aware detector, +-15%)`, "Compare only as an indication: beats are not shots.", "VISUAL-EDITING-RESEARCH.md section 5");
  // V10 narration match (lexical, flags only for a person)
  const check = []; for (const b of beats) for (const a of b.used) { const m = assets[a]; if (!REAL_KINDS.test(m.kind)) continue; const d = content(`${m.description || ""}`), v = content(b.vo); if (d.size && ![...d].some((w) => v.has(w) || [...v].some((x) => x.slice(0, 5) === w.slice(0, 5)))) check.push(`${b.id}:${a.split("/").pop()}`); }
  add("V10", check.length ? "CHECK-BY-PERSON" : "PASS", "Visual matches narration (lexical screen only)", check.length ? `${check.length} real pictures share no content word with their narration: ${check.join(", ")}` : "every real picture shares at least one content word with its narration", "a person confirms each flagged picture shows what is said (a word match is not proof of relevance)", "A picture unrelated to the narration is the strongest 'filler' signal.", "none (a person must judge)");
  // ---- audio
  const cueFile = join(ROOT, "docs/longform/cue-sheets", `${channel}.json`);
  if (existsSync(cueFile)) {
    const cs = JSON.parse(readFileSync(cueFile, "utf8")), cues = cs.cues;
    const noPurpose = cues.filter((c) => !c.purpose || c.purpose.length < 12); add("A1", noPurpose.length ? "FAIL" : "PASS", "Every cue has an editorial purpose", `${noPurpose.length} of ${cues.length} cues without a written purpose`, "every cue states its purpose (hard rule from the directive)", "Random effects are the failure to avoid.", "SOUND-DESIGN-RESEARCH.md section 6", false);
    const eff = cues.filter((c) => /action|transition|accent|riser/.test(c.cue_type)), dens = eff.length / min; metrics.effects_per_min = Number(dens.toFixed(1));
    add("A2", dens > 4 ? "WARN" : "PASS", "Effect density", `${eff.length} effects in ${min.toFixed(1)} min = ${dens.toFixed(1)} per minute`, "provisional cap 4 per minute: author's judgement, the reference set gives no effect count", "Frequent effects distract from narration.", "none (no reference measurement)");
    const beds = cues.filter((c) => /bed|ambience/.test(c.cue_type)), loud = beds.filter((c) => c.level_db_rel_speech > -(STD.global_hard_rules.music_bed_min_db_below_speech.value));
    add("A3", loud.length ? "FAIL" : "PASS", "Music/ambience competes with narration", loud.length ? loud.map((c) => `${c.scene}:${c.asset} at ${c.level_db_rel_speech} dB`).join(", ") : `${beds.length} beds, all at least ${STD.global_hard_rules.music_bed_min_db_below_speech.value} dB below speech`, `bed at least ${STD.global_hard_rules.music_bed_min_db_below_speech.value} dB below speech (lowest reference value 19.7 dB)`, "A bed louder than that competes with the voice.", "SOUND-DESIGN-RESEARCH.md section 2");
    const unapproved = [...new Set(cues.map((c) => c.asset))].filter((a) => !a.startsWith("(")).map((a) => ({ a, st: AQA[a]?.approval || "unknown" })).filter((x) => x.st !== "approved");
    add("A4", unapproved.length ? "WARN" : "PASS", "Assets approved for use", `${unapproved.length} asset(s) not yet approved by listening: ${unapproved.map((x) => `${x.a} (${x.st})`).join(", ")}`, "every asset in a render has a recorded listening approval", "No asset has been auditioned; this stays a WARN until a person approves them.", "SOUND-LIBRARY-REGISTER.md", false);
    const missing = [...new Set(cues.map((c) => c.asset))].filter((a) => !a.startsWith("(") && !LIB.find((l) => l.slot === a)); add("A5", missing.length ? "FAIL" : "PASS", "Audio assets exist", missing.length ? missing.join(", ") : "all cue assets are in the library", "no missing assets", "A missing file produces silence or an error at render.", "config/longform-audio-library.json", false);
    metrics.cues = cues.length;
    // A6: one music bed on several channels reads as repetitive music (checked across the cue sheets of all channels)
    const musicHere = [...new Set(cues.filter((c) => /^MUSIC_/.test(c.asset)).map((c) => c.asset))], shared = [];
    for (const other of Object.keys(CH)) { if (other === channel) continue; const f = join(ROOT, "docs/longform/cue-sheets", `${other}.json`); if (!existsSync(f)) continue; for (const c of JSON.parse(readFileSync(f, "utf8")).cues) if (musicHere.includes(c.asset)) shared.push(`${c.asset} also on ${other}`); }
    add("A6", shared.length ? "WARN" : "PASS", "Music repeated across channels", shared.length ? [...new Set(shared)].join(", ") : musicHere.length ? `${musicHere.join(", ")} used on this channel only` : "no music bed in this cue sheet", "one bed per channel (hard rule from the directive: do not reuse one track across every channel)", "Identical music across channels makes the network sound templated.", "directive; SOUND-LIBRARY-REGISTER.md", false);
    // A7: final loudness / true peak, only if a mix measurement exists for this channel
    const mf = join(ROOT, "docs/longform/cue-sheets", `${channel}.mix.json`);
    if (existsSync(mf)) { const mm = JSON.parse(readFileSync(mf, "utf8")); const tgt = STD.global_hard_rules.final_loudness_lufs, tp = STD.global_hard_rules.true_peak_dbtp_max; add("A7", Math.abs(mm.integrated_lufs - tgt.target) > tgt.tolerance || mm.true_peak_dbtp > tp ? "FAIL" : "PASS", "Final loudness and true peak", `${mm.integrated_lufs} LUFS, ${mm.true_peak_dbtp} dBTP (${mm.note || "measured export"})`, `${tgt.target} LUFS +-${tgt.tolerance}, true peak <= ${tp} dBTP`, "Wrong levels or clipping are audible defects.", "SOUND-DESIGN-RESEARCH.md section 5", false); }
    else add("A7", "SKIPPED", "Final loudness and true peak", "no mix has been rendered for this channel (stills phase; only the AI Tested demo chain was exported and measured)", `${STD.global_hard_rules.final_loudness_lufs.target} LUFS +-${STD.global_hard_rules.final_loudness_lufs.tolerance}, true peak <= ${STD.global_hard_rules.true_peak_dbtp_max} dBTP`, "", "", false);
  } else add("A0", "SKIPPED", "Audio checks", "no cue sheet for this channel", "docs/longform/cue-sheets/<channel>.json", "", "");
  return { channel, episode: ep.title, generated: new Date().toISOString().slice(0, 10), assumptions: [`beat duration = narration words / ${WPS} words per second`, "authentic share is an upper bound: a beat counts as real when it shows at least one authentic asset, even if graphics also appear", "reference bands are provisional (see config/longform-qa-standards.json)"], standards_provisional: std.provisional_reasons, metrics, findings };
}
export function toMd(r) {
  const icon = { PASS: "PASS", WARN: "WARN", FAIL: "FAIL", INFO: "INFO", SKIPPED: "SKIPPED", "CHECK-BY-PERSON": "CHECK" };
  return [`# QA: ${r.episode} (${r.channel})`, "", `Generated ${r.generated}. Assumptions: ${r.assumptions.join("; ")}.`, "", `Reference standard status: provisional (${r.standards_provisional.join("; ")}).`, "", "Metrics: " + Object.entries(r.metrics).map(([k, v]) => `${k}=${v}`).join(", "), "", "| Check | Result | Measured | Standard | Why | Evidence |", "|---|---|---|---|---|---|", ...r.findings.map((f) => `| ${f.id} ${f.name} | **${icon[f.level] || f.level}** | ${f.measured} | ${f.standard}${f.provisional ? " (provisional)" : ""} | ${f.why} | ${f.evidence} |`), ""].join("\n");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const arg = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "all", outDir = resolve(ROOT, process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "docs/longform/qa");
  mkdirSync(outDir, { recursive: true }); const list = arg === "all" ? Object.keys(CH) : [arg], summary = [];
  for (const c of list) { const r = await qaChannel(c); writeFileSync(join(outDir, `${c}.json`), JSON.stringify(r, null, 1)); writeFileSync(join(outDir, `${c}.md`), toMd(r)); summary.push(`| ${c} | ${r.findings.map((f) => `${f.id}:${f.level}`).join(" ")} |`); console.log(c.padEnd(22), r.findings.map((f) => `${f.id}:${f.level}`).join(" ")); }
  writeFileSync(join(outDir, "SUMMARY.md"), ["# QA summary", "", "| Channel | Results |", "|---|---|", ...summary, ""].join("\n"));
}
