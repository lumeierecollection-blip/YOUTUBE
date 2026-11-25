// Shared helpers for the V5/V6 Shorts: narration-synced timing and plan validation.
import fs from "node:fs";
import path from "node:path";

export const SCENES = ["type_slam", "cutout_hero", "logo_wall", "stat_hero", "line_chart", "bar_chart", "timeline", "compare", "screenshot", "manifest", "document", "question"];
export const TRANSITIONS = ["cut", "wipe", "push", "slide", "zoom", "flash", "iris"];

const norm = (s) => String(s || "").toLowerCase().replace(/[‘’´`]/g, "'").replace(/[^a-z0-9$%.' ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => norm(s).replace(/[.']/g, "").split(" ").filter(Boolean);

export function parseVtt(text) {
  const cues = [];
  const blocks = String(text).replace(/\r/g, "").split(/\n\n+/);
  const ts = (x) => { const m = x.trim().match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+("0." + m[4])) : NaN; };
  for (const b of blocks) {
    const lines = b.split("\n").filter(Boolean);
    const i = lines.findIndex(l => l.includes("-->"));
    if (i < 0) continue;
    const [a, z] = lines[i].split("-->");
    const t0 = ts(a), t1 = ts(z.trim().split(/\s+/)[0]);
    const txt = lines.slice(i + 1).join(" ").trim();
    if (Number.isFinite(t0) && Number.isFinite(t1) && txt) cues.push({ start: t0, end: t1, text: txt });
  }
  return cues;
}

/** Time (s) at which word index `wi` of the spoken script begins, from cue-level or word-level timings. */
export function wordTimes(cues, totalWords) {
  const times = [];
  for (const c of cues) {
    const w = words(c.text);
    for (let k = 0; k < w.length; k++) times.push(c.start + ((k / Math.max(1, w.length)) * (c.end - c.start)));
  }
  if (times.length < totalWords * 0.8) return null;
  return times;
}

/** Sets beat.t / beat.dur from the narration text positions in the spoken audio. Returns {mode, notes}. */
export function syncBeats(plan, script, cues, audioDur) {
  const total = words(script).length;
  const times = cues && cues.length ? wordTimes(cues, total) : null;
  const notes = [];
  let mode = "vtt";
  const starts = [];
  if (times) {
    let cursor = 0;
    const scriptWords = words(script);
    for (const b of plan.beats) {
      const bw = words(b.narration);
      // find bw at/after cursor in script words
      let pos = -1;
      for (let i = cursor; i <= scriptWords.length - bw.length; i++) {
        let ok = true;
        for (let k = 0; k < Math.min(3, bw.length); k++) if (scriptWords[i + k] !== bw[k]) { ok = false; break; }
        if (ok) { pos = i; break; }
      }
      if (pos < 0) { notes.push(`beat narration not found in script: "${b.narration.slice(0, 40)}"`); mode = "proportional"; break; }
      starts.push(pos);
      cursor = pos + bw.length;
    }
  } else { mode = "proportional"; notes.push("no usable VTT"); }
  const lead = 0.1;
  if (mode === "vtt") {
    plan.beats.forEach((b, i) => { b.t = i === 0 ? 0 : +(Math.max(0, times[Math.min(times.length - 1, starts[i])] - lead)).toFixed(3); });
  } else {
    const planned = plan.beats.reduce((a, b) => a + (Number(b.dur_hint || b.dur) || 2), 0);
    let cur = 0;
    plan.beats.forEach((b) => { b.t = +cur.toFixed(3); cur += ((Number(b.dur_hint || b.dur) || 2) / planned) * audioDur; });
  }
  const end = audioDur + 0.5;
  plan.beats.forEach((b, i) => { const nx = i + 1 < plan.beats.length ? plan.beats[i + 1].t : end; b.dur = +(nx - b.t).toFixed(3); });
  // resolve sfx {beat, offset}
  const a = plan.audio || (plan.audio = {});
  a.sfx = (a.sfx || []).map((s) => {
    if (s.beat !== undefined) { const bb = plan.beats[s.beat]; return { ...s, t: +(((bb ? bb.t : 0) + (s.offset || 0))).toFixed(3) }; }
    return s;
  }).filter(s => s.t < end);
  return { mode, notes };
}

const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : NaN; };

export function validatePlan(plan, ctx) {
  const { publicDir, script, facts, sfxFiles } = ctx;
  const errors = [], warns = [];
  const E = (m) => errors.push(m), W = (m) => warns.push(m);
  const exists = (rel) => rel && (/^(https?:|data:)/.test(rel) || fs.existsSync(path.join(publicDir, String(rel).replace(/^\/+/, ""))));
  if (plan.schema !== 6) E("schema must be 6");
  const th = plan.theme || {};
  for (const k of ["mode", "bg", "ink", "muted", "accent", "panel", "line"]) if (!th[k]) E(`theme.${k} missing`);
  if (!plan.concept || String(plan.concept).length < 40) E("concept missing/short");
  if (!plan.creative_direction || !plan.creative_direction.why_this_look) E("creative_direction.why_this_look missing");
  const beats = plan.beats || [];
  if (beats.length < 5) E(`only ${beats.length} beats`);
  // narration coverage
  const joined = words(beats.map(b => b.narration).join(" ")).join(" ");
  const sc = words(script).join(" ");
  if (joined !== sc) E("beat narrations do not concatenate to the exact script");
  const factNums = new Set((facts?.numbers || []).map(n => num(n.value)).filter(Number.isFinite));
  const factIds = new Set((facts?.facts || []).map(f => f.id));
  (facts?.numbers || []).forEach(n => { if (n.id) factIds.add(n.id); });
  (facts?.timeline || []).forEach(n => { if (n.id) factIds.add(n.id); });
  const needEvidence = new Set(["stat_hero", "line_chart", "bar_chart", "timeline", "compare", "manifest", "document"]);
  const needAsset = (rel, where) => { if (!exists(rel)) E(`${where}: asset missing ${rel}`); };
  const manifest = plan.asset_manifest || [];
  const inManifest = (rel) => manifest.some(m => m.file === rel);
  beats.forEach((b, i) => {
    const w = `beat ${i} (${b.scene})`;
    if (!SCENES.includes(b.scene)) { E(`${w}: unknown scene`); return; }
    if (b.transition && !TRANSITIONS.includes(b.transition)) E(`${w}: unknown transition ${b.transition}`);
    if (b.headline && b.headline.length > 46) E(`${w}: headline too long (${b.headline.length})`);
    if (b.kicker && b.kicker.length > 30) E(`${w}: kicker too long`);
    if (!b.headline && !["stat_hero"].includes(b.scene)) W(`${w}: no headline`);
    if (needEvidence.has(b.scene) && !(b.evidence && b.evidence.length)) E(`${w}: data scene without evidence ids`);
    for (const id of b.evidence || []) if (facts && !factIds.has(id)) E(`${w}: evidence id ${id} not in facts file`);
    switch (b.scene) {
      case "logo_wall": if ((b.logos || []).length < 2) E(`${w}: needs >=2 logos`); (b.logos || []).forEach(l => needAsset(`logos/${l.id}.svg`, w)); break;
      case "type_slam": (b.logos || []).forEach(l => needAsset(`logos/${l.id}.svg`, w)); break;
      case "stat_hero": if (!b.stat) E(`${w}: stat missing`); else if (facts && !factNums.has(b.stat.value) && !b.stat.derived) E(`${w}: stat ${b.stat.value} not in facts.numbers`); break;
      case "line_chart": {
        const s = b.chart?.series || [];
        if (!s.length || s.some(x => (x.points || []).length < 2)) E(`${w}: line chart needs series with >=2 points`);
        if (facts && !b.chart?.derived) s.forEach(x => x.points.forEach(p => { if (!factNums.has(p.y)) E(`${w}: point ${p.y} not in facts.numbers`); }));
        break; }
      case "bar_chart": {
        const r = b.chart?.rows || [];
        if (!r.length) E(`${w}: bar chart needs rows`);
        if (facts && !b.chart?.derived) r.forEach(x => x.values.forEach(v => { if (!factNums.has(v.v)) E(`${w}: bar value ${v.v} not in facts.numbers`); }));
        break; }
      case "timeline": if ((b.items || []).length < 3) E(`${w}: timeline needs >=3 items`); break;
      case "compare": if (!b.compare?.left?.rows?.length || !b.compare?.right?.rows?.length) E(`${w}: compare needs both sides`); break;
      case "screenshot": if (!b.media?.[0]) E(`${w}: screenshot needs media`); else { needAsset(b.media[0].src, w); if (!inManifest(b.media[0].src)) E(`${w}: ${b.media[0].src} not in asset_manifest`); if (!(b.crops || []).length) W(`${w}: no crops`); } break;
      case "cutout_hero": { const c = b.media?.find(m => m.role === "cutout"); if (!c) E(`${w}: cutout missing`); else { needAsset(c.src, w); if (!inManifest(c.src)) E(`${w}: cutout not in asset_manifest`); } break; }
      case "document": if (!b.doc?.clauses?.length) E(`${w}: document clauses missing`); break;
      case "manifest": if ((b.items || []).length < 2) E(`${w}: manifest needs items`); break;
    }
    (b.media || []).forEach(m => { needAsset(m.src, w); if (!inManifest(m.src)) E(`${w}: media ${m.src} not in asset_manifest`); });
    // events per second (visual changes beyond the headline words)
    const ev = (b.items?.length || 0) + (b.logos?.length || 0) + (b.callouts?.length || 0) + (b.crops?.length || 0) + (b.chart?.series?.reduce((a, s) => a + s.points.length, 0) || 0) + (b.chart?.rows?.reduce((a, r) => a + r.values.length, 0) || 0) + (b.doc?.clauses?.length || 0) + (b.compare ? Math.max(b.compare.left.rows.length, b.compare.right.rows.length) * 2 : 0) + (b.stat?.dots ? 6 : 0) + (b.stat ? 3 : 0) + 3 /* kicker, headline, sub */ + 1 /* backdrop motion */;
    if (b.dur && ev / b.dur < 1.0) W(`${w}: only ${(ev / b.dur).toFixed(2)} events/s`);
  });
  for (let i = 1; i < beats.length; i++) if (beats[i].scene === beats[i - 1].scene && beats[i].scene !== "type_slam") W(`beats ${i - 1}/${i}: same scene back to back`);
  const trans = new Set(beats.map(b => b.transition || "cut"));
  if (trans.size < 3) W("fewer than 3 distinct transitions");
  // audio
  const au = plan.audio || {};
  if (!au.music?.src) E("audio.music missing"); else needAsset(au.music.src, "music");
  if (!au.ambience?.src) E("audio.ambience missing"); else needAsset(au.ambience.src, "ambience");
  const sfx = au.sfx || [];
  if (sfx.length < beats.length * 1.5) E(`sfx plan thin: ${sfx.length} events for ${beats.length} beats (need >= ${Math.ceil(beats.length * 1.5)})`);
  sfx.forEach((s, i) => { if (!exists(s.src)) E(`sfx ${i}: missing ${s.src}`); if (!s.purpose) W(`sfx ${i}: no purpose`); });
  beats.forEach((b, i) => { if (!sfx.some(s => s.beat === i || (s.t >= b.t - 0.01 && s.t < b.t + b.dur))) E(`beat ${i}: no sfx`); });
  // manifest completeness
  manifest.forEach((m, i) => {
    for (const k of ["file", "type", "source", "license", "scene", "transparent", "resolution", "status"]) if (m[k] === undefined || m[k] === "") E(`asset_manifest[${i}] missing ${k}`);
    if (m.file && !exists(m.file) && !/^https?:/.test(m.file)) E(`asset_manifest[${i}] file not found in public: ${m.file}`);
    if (/unknown|tbd|pending/i.test(String(m.license))) E(`asset_manifest[${i}] licence unresolved`);
  });
  return { ok: errors.length === 0, errors, warns };
}
