#!/usr/bin/env node
// Visual-director critic loop (docs/VISUAL-DIRECTOR.md). CI only.
//
//   node scripts/visual-director/loop.mjs --script <s.json> --research <r.json> --tts <dir> --channel <id> --out <dir>
//
// round 0: direct -> gate -> resolve materials (beats with essential_missing go back to the director
//          with that as critique, once, before anything renders) -> render -> frames -> critic
// round k: the beats whose effective verdict is REBUILD or DELETE are re-directed with the critique
//          (direct.mjs --critique <critic.json> --beats i,j) -> gate -> resolve -> render -> frames -> critic.
//          Only those beats are taken from the new direction; every other beat is carried over
//          unchanged (spliced), so a KEEP scene cannot drift because the director re-ran.
// Bounded by VD_MAX_ROUNDS rebuild rounds (default 2) and VD_MAX_MS wall time. Every round keeps its
// direction, materials report, MP4, frames, contact sheet and critic.json under <out>/round-<k>/.
// <out>/loop-report.json has the per-scene verdict per round and the final status
// (kept / rebuilt / unresolved); <out>/comparison.md has old vs new contact sheets and strips.
//
// A scene the critic did not answer (not_run / invalid) is NOT kept: it ends `unresolved` with the reason.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { join, relative, resolve, basename } from "node:path";

const now = () => Date.now();
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, x) => writeFileSync(p, JSON.stringify(x, null, 2));

/**
 * gate.mjs prints `[vd-gate] beat <n> <rule>: <detail>` per failure and a
 * `[vd-gate] N failure(s)` summary. The loop keeps the structured list so the
 * production terminal state can say WHICH rule failed, not just "gate failed".
 * Pure; tested.
 */
export function parseGateFailures(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const m = /^\[vd-gate\]\s+beat\s+(\d+|\*)\s+([a-z0-9-]+):\s*(.*)$/i.exec(line.trim());
    if (!m) continue;
    out.push({ beat_index: m[1] === "*" ? null : Number(m[1]), rule: m[2], detail: m[3] });
  }
  return out;
}

/** Beats the materials report says cannot be shown as directed. Tolerates {beats:[...]} or [...]. */
export function essentialMissing(report) {
  const list = Array.isArray(report) ? report : report?.beats || [];
  return list.filter((b) => Array.isArray(b.essential_missing) && b.essential_missing.length)
    .map((b) => ({ beat_index: b.beat_index, missing: b.essential_missing }));
}

/** A critique document (critic.json shape) from material failures, so the director reads one format. */
export function materialsCritique(missing, round, verified = [], gateFailures = []) {
  const reusable = verified.filter((v) => v?.kind !== "data");
  const data = verified.filter((v) => v?.kind === "data");
  return { schema_version: 1, round, source: "materials", status: "complete", verified_materials: verified, gate_failures: gateFailures,
    scenes: missing.map((m) => ({ beat_index: m.beat_index, status: "answered", verdict: "REBUILD", effective_verdict: "REBUILD",
      answer: { beat_index: m.beat_index, verdict: "REBUILD", delete_reason: null,
        what_to_change: `These essential materials could not be found or verified: ${m.missing.map((x) => typeof x === "string" ? x : (x.must_show ? `"${x.must_show}"${x.why ? ` (${x.why})` : ""}` : (x.id || JSON.stringify(x)))).join("; ")}. Rebuild the scene around what CAN be shown with real, verified material; never a look-alike. ${reusable.length ? `Reuse one of the ${reusable.length} picture(s) already verified in this video (listed above) by copying its exact id, must_show and search; do not ask for a generic "collection of ...".` : "Name a specific person, object or place an archive can actually hold."} ${data.length ? "A kind:data card is not a picture and is not reusable on another sentence: keep it only on the beat whose numbers it states." : ""} Every shot still needs at least one real picture; a data card is support, never the whole shot.` } })) };
}

/** Beats to re-direct after a critic pass. Pure; tested. */
export function beatsToRebuild(critic) {
  return (critic?.scenes || []).filter((s) => s.effective_verdict === "REBUILD" || s.effective_verdict === "DELETE").map((s) => s.beat_index);
}

/** Every material already verified in a resolved direction, with where it sits. Pure; tested. */
export function verifiedMaterials(direction) {
  const out = [];
  for (const b of direction?.beats || []) for (const s of b.shots || []) for (const m of s.materials || []) {
    if (m?.resolved?.status !== "verified") continue;
    out.push({ beat_index: b.beat_index, shot_id: s.id, material_id: m.id, kind: m.kind, must_show: m.must_show,
      search: m.search || [], data: m.data ?? null, source_url: m.resolved.source_url || null,
      file: m.resolved.file || null, license: m.resolved.license || null, credit: m.resolved.credit || null });
  }
  return out;
}

const normShow = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const sameData = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A materials redirect must not throw away pictures that were already verified. For every
 * material in the rebuilt beats that reuses a verified material's id (or its exact must_show),
 * copy the verified kind/search/data/resolved across so the resolver does not have to find it
 * again. This is what stops a repair from replacing a verified data material with a second
 * unfindable "collection of ..." photo (run 40395669599, ch-1 b4).
 *
 * kind:data is NOT reusable across beats: its values are the numbers of one narration sentence.
 * Run 40402564556 reused a $0.10 data card on five unrelated sentences, which rendered a
 * 100,000-token text card over every beat and turned the video into a slideshow. A data card may
 * only be carried within its own beat, and only when the rebuilt material keeps the same values.
 * Pure; tested.
 */
export function reuseVerifiedMaterials(direction, previous, targets = null) {
  const pool = verifiedMaterials(previous);
  const byId = new Map(pool.map((m) => [m.material_id, m]));
  const byShow = new Map(pool.map((m) => [normShow(m.must_show), m]));
  const reused = [];
  const beats = (direction.beats || []).map((b) => {
    if (targets && !targets.includes(b.beat_index)) return b;
    const shots = (b.shots || []).map((s) => ({ ...s, materials: (s.materials || []).map((m) => {
      if (m?.resolved?.status === "verified") return m;
      const v = byId.get(m.id) || byShow.get(normShow(m.must_show));
      if (!v) return m;
      if (v.kind === "data") {
        // Numbers belong to the sentence that states them. Only keep a data card on its
        // own beat, and only when the rebuilt material did not change the values.
        if (v.beat_index !== b.beat_index || (m.data && !sameData(v.data, m.data))) return m;
      }
      reused.push({ beat_index: b.beat_index, shot_id: s.id, material_id: m.id, reused_from: v.material_id, must_show: v.must_show });
      return { ...m, kind: v.kind, must_show: v.must_show, search: v.search, ...(v.data ? { data: v.data } : {}),
        resolved: { status: "verified", file: v.file, source_url: v.source_url, license: v.license, credit: v.credit,
          verdict: `reused verified material ${v.material_id}` } };
    }) }));
    return { ...b, shots };
  });
  return { direction: { ...direction, beats }, reused };
}

/**
 * Last-resort corrective edit: when a beat still has an unfindable shot but at least one shot
 * whose materials are all verified, drop the unfindable shots and re-time the real ones to the
 * beat's full duration. A beat with no verified shot is left untouched so the renderer refuses
 * it loudly instead of the loop inventing a picture. Pure; tested.
 */
export function pruneUnverifiedShots(direction) {
  const pruned = [];
  const beats = (direction.beats || []).map((b) => {
    const shots = b.shots || [];
    const keep = [], drop = [];
    for (const s of shots) {
      const ok = (s.materials || []).length > 0 && (s.materials || []).every((m) => m?.resolved?.status === "verified");
      (ok ? keep : drop).push(s);
    }
    if (!drop.length || !keep.length) return b;
    const span = Math.max(0.01, (Number(b.t_end) || 0) - (Number(b.t_start) || 0));
    const total = keep.reduce((a, s) => a + (Number(s.duration_s) || 0), 0);
    let acc = 0;
    const rescaled = keep.map((s, i) => {
      const d = i === keep.length - 1 ? +(span - acc).toFixed(3)
        : +(total > 0 ? (Number(s.duration_s) || 0) / total * span : span / keep.length).toFixed(3);
      acc += d;
      return { ...s, duration_s: d };
    });
    pruned.push({ beat_index: b.beat_index,
      dropped: drop.map((s) => ({ shot_id: s.id, materials: (s.materials || []).map((m) => ({ id: m.id, must_show: m.must_show, status: m.resolved?.status || "missing" })) })),
      kept: keep.map((s) => s.id), duration_s: span });
    return { ...b, shots: rescaled };
  });
  return { direction: { ...direction, beats }, pruned };
}

/** A materials report that matches a pruned direction, keeping the surviving materials' evidence. */
export function reportForPruned(direction, previous, pruned = []) {
  const old = new Map((previous?.materials || []).map((m) => [`${m.beat_index}/${m.shot_id}/${m.material_id}`, m]));
  const materials = [], beats = [];
  for (const b of direction.beats || []) {
    const missing = [];
    for (const s of b.shots || []) for (const m of s.materials || []) {
      const r = m.resolved || { status: "missing", verdict: "not resolved" };
      const key = `${b.beat_index}/${s.id}/${m.id}`;
      materials.push({ ...(old.get(key) || {}), beat_index: b.beat_index, shot_id: s.id, material_id: m.id, kind: m.kind,
        must_show: m.must_show, status: r.status, why_missing: r.status === "verified" ? null : (r.verdict || null),
        chosen: r.status === "verified" ? { file: r.file, url: old.get(key)?.chosen?.url || null, source_url: r.source_url,
          license: r.license, credit: r.credit, verdict: r.verdict } : null });
      if (r.status !== "verified") missing.push({ shot_id: s.id, material_id: m.id, must_show: m.must_show, status: r.status, why: r.verdict });
    }
    beats.push({ beat_index: b.beat_index, sentence: b.sentence, ok: !missing.length, essential_missing: missing });
  }
  const count = (s) => materials.filter((m) => m.status === s).length;
  return { ...previous, schema_version: 1, summary: { materials: materials.length, verified: count("verified"),
    missing: count("missing"), unverified: count("unverified"), beats_with_essential_missing: beats.filter((b) => !b.ok).map((b) => b.beat_index) },
    beats, materials, pruned_shots: pruned };
}

/** Take only `targets` from `next`; everything else stays byte-identical to `prev`. Pure; tested. */
export function spliceBeats(prev, next, targets, { round, critique } = {}) {
  const byIdx = new Map((next.beats || []).map((b) => [b.beat_index, b]));
  const missing = [];
  const beats = prev.beats.map((b) => {
    if (!targets.includes(b.beat_index)) return b;
    const n = byIdx.get(b.beat_index);
    if (!n) { missing.push(b.beat_index); return b; }
    const sc = critique?.scenes?.find((s) => s.beat_index === b.beat_index);
    // direct.mjs writes its own critic_history entry; append ours only when it did not.
    const own = (n.critic_history || []).length > (b.critic_history || []).length;
    const hist = own ? n.critic_history : [...(b.critic_history || []), ...(sc ? [{ round, source: critique.source || "critic", verdict: sc.effective_verdict,
      what_to_change: sc.answer?.what_to_change ?? null, delete_reason: sc.answer?.delete_reason ?? null }] : [])];
    return { ...n, status: "rebuilt", critic_history: hist };
  });
  return { direction: { ...prev, beats }, missing };
}

/** Final status per scene from the critic rounds. Pure; tested. */
export function finalStatus(rounds, beatIndexes) {
  return beatIndexes.map((i) => {
    const hist = rounds.map((r) => r.critic?.scenes?.find((s) => s.beat_index === i)).filter(Boolean);
    const rebuiltIn = rounds.filter((r) => (r.rebuilt || []).includes(i)).map((r) => r.round);
    const last = hist[hist.length - 1];
    const v = last?.effective_verdict ?? null;
    let status, reason = null;
    if (v === "KEEP") status = rebuiltIn.length ? "rebuilt" : "kept";
    else { status = "unresolved"; reason = v ? `last verdict ${v}` : `critic ${last?.status || "absent"}${last?.reason ? `: ${last.reason}` : ""}`; }
    return { beat_index: i, status, reason, rebuilt_in_rounds: rebuiltIn, verdicts: rounds.map((r) => r.critic?.scenes?.find((s) => s.beat_index === i)?.effective_verdict ?? null) };
  });
}

/**
 * Beats a deterministic-QA failure implicates, so the next corrective round rebuilds them.
 * Black and freeze segments map by time to the beats they overlap; any other failed check
 * (missing materials, one template, no motion, no audio) is whole-video and implicates every
 * beat. Pure; tested.
 */
export function qaImplicatedBeats(qa, direction) {
  if (!qa || qa.pass) return [];
  const beats = Array.isArray(direction?.beats) ? direction.beats : [];
  const all = beats.map((b) => b.beat_index);
  const hit = new Set();
  const addSpan = (start, end) => {
    for (const b of beats) if (Number(b.t_end) > start && Number(b.t_start) < end) hit.add(b.beat_index);
  };
  for (const c of qa.checks || []) {
    if (c.pass) continue;
    if (c.id === "video.no_empty_black") {
      for (const s of (qa.black || []).filter((x) => Number(x.duration) >= 1.0)) addSpan(Number(s.start), Number(s.end));
    } else if (c.id === "video.not_a_slideshow") {
      for (const s of (qa.freeze || []).filter((x) => Number(x.duration ?? (x.end - x.start)) >= 3.0)) addSpan(Number(s.start), Number(s.end));
    } else {
      all.forEach((i) => hit.add(i));
    }
  }
  return (hit.size ? [...hit] : all).sort((a, b) => a - b);
}

/**
 * A critic document the director can act on when deterministic QA, not the critic, rejected
 * the render. KEEP scenes that QA implicates become REBUILD with the failed check as the
 * reason, so the next round changes the scene instead of re-rendering it unchanged.
 * Pure; tested.
 */
export function qaCorrectiveCritique(critic, qa, direction, targets = null) {
  const want = targets || qaImplicatedBeats(qa, direction);
  if (!qa || qa.pass || !want.length) return critic;
  const failed = (qa.checks || []).filter((c) => !c.pass).map((c) => `${c.id}: ${c.detail}`).join("; ");
  const by = new Map((critic?.scenes || []).map((s) => [s.beat_index, s]));
  for (const i of want) {
    const s = by.get(i) || { beat_index: i, status: "answered", verdict: "REBUILD", effective_verdict: "REBUILD" };
    by.set(i, { ...s, status: s.status || "answered", verdict: "REBUILD", effective_verdict: "REBUILD",
      escalated: s.escalated || "deterministic-qa",
      answer: { ...(s.answer || {}), verdict: "REBUILD", delete_reason: `deterministic QA failed: ${failed}`,
        what_to_change: `Deterministic QA on the rendered MP4 failed: ${failed}. Rebuild this scene so a real picture is visible for the whole shot and the camera actually moves; a text card on the ground is not a scene.` } });
  }
  return { ...(critic || { status: "complete", whole_video: null }), scenes: [...by.values()].sort((a, b) => a.beat_index - b.beat_index) };
}

export function comparisonMarkdown(report, outDir) {
  const rel = (p) => (p ? relative(outDir, p).replace(/\\/g, "/") : "-");
  const L = [`# Visual director: round comparison`, ``, `Script: \`${report.script}\`  `, `Rounds: ${report.rounds.length}; stopped: ${report.stop_reason}`, ``, `## Contact sheets`, ``];
  for (const r of report.rounds) L.push(`- round ${r.round}: \`${rel(r.contact_sheet)}\` (video \`${rel(r.video)}\`; critic ${r.critic?.status || "absent"}${r.critic?.whole_video?.answer ? `; template alternation: ${r.critic.whole_video.answer.template_alternation}, whole mute test: ${r.critic.whole_video.answer.whole_mute_test}` : ""}${r.qa ? `; deterministic QA ${r.qa.pass ? "pass" : `FAIL: ${(r.qa.checks || []).filter((c) => !c.pass).map((c) => c.id).join(", ")}`}` : ""})`);
  L.push(``, `## Verdict per scene per round`, ``, `| beat | ${report.rounds.map((r) => `r${r.round}`).join(" | ")} | final |`, `|---|${report.rounds.map(() => "---").join("|")}|---|`);
  for (const f of report.final) L.push(`| b${f.beat_index} | ${f.verdicts.map((v, k) => `${v || "n/a"}${(report.rounds[k].rebuilt || []).includes(f.beat_index) ? " (rebuilt)" : ""}`).join(" | ")} | ${f.status}${f.reason ? ` (${f.reason})` : ""} |`);
  L.push(``, `## Rebuilt scenes: old vs new`, ``);
  let any = false;
  for (const r of report.rounds) for (const i of r.rebuilt || []) {
    any = true;
    const prev = report.rounds[r.round - 1];
    const old = prev?.critic?.scenes?.find((s) => s.beat_index === i), neu = r.critic?.scenes?.find((s) => s.beat_index === i);
    L.push(`### b${i}: round ${r.round - 1} -> round ${r.round}`, ``,
      `- old strip: \`${rel(prev?.strips?.[i])}\` - verdict ${old?.effective_verdict || "n/a"}${old?.escalated ? ` (${old.escalated})` : ""}`,
      `  - critic: ${old?.answer?.verdict === "DELETE" ? `DELETE - ${old.answer.delete_reason}` : old?.answer?.what_to_change || old?.reason || "-"}`,
      `- new strip: \`${rel(r.strips?.[i])}\` - verdict ${neu?.effective_verdict || "n/a"}`,
      `  - critic: ${neu?.answer?.visibly_happening || neu?.reason || "-"}`, ``);
  }
  if (!any) L.push(`_none_`);
  const last = report.rounds.filter((r) => r.critic).slice(-1)[0];
  if (last) {
    L.push(``, `## Critic detail, round ${last.round}`, ``, `| beat | verdict | muted | template | material | camera | seen | change / delete reason |`, `|---|---|---|---|---|---|---|---|`);
    const c = (x) => String(x ?? "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 220);
    for (const s of last.critic.scenes || []) {
      const a = s.answer || {};
      L.push(`| b${s.beat_index} | ${s.effective_verdict || s.status}${s.escalated ? " (escalated)" : ""} | ${a.understood_muted || "-"} | ${a.template_or_decorative?.answer || "-"} | ${a.material_believable_and_correct?.answer || "-"}: ${c(a.material_believable_and_correct?.why)} | ${a.camera_contributes?.answer || "-"} | ${c(a.visibly_happening || s.reason)} | ${c(a.delete_reason || a.what_to_change)} |`);
    }
    const w = last.critic.whole_video;
    L.push(``, w?.answer ? `Whole video: template alternation **${w.answer.template_alternation}** (${c(w.answer.template_alternation_why)}); mute test **${w.answer.whole_mute_test}** (${c(w.answer.whole_mute_test_why)}); worst beats ${JSON.stringify(w.answer.worst_beats)}` : `Whole video: ${w?.status || "absent"} ${w?.reason || ""}`);
    if (last.critic.usage_total) L.push(``, `Critic tokens (round ${last.round}): ${last.critic.usage_total.total_tokens} in ${last.critic.usage_total.calls} calls, model ${last.critic.model}`);
  }
  return L.join("\n") + "\n";
}

// ---------------------------------------------------------------- real steps (CLIs)
function run(cmd, args, log, timeoutMs = 0) {
  const t0 = now();
  const r = spawnSync(cmd, args, {
    encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024,
    // A step that never returns must fail its round, not wedge the job until the
    // runner kills it with no evidence (run 40364703475 sat in apt for 12 min).
    ...(timeoutMs ? { timeout: timeoutMs, killSignal: "SIGTERM" } : {}),
  });
  const secs = ((now() - t0) / 1000).toFixed(1);
  const why = r.error?.code === "ETIMEDOUT" || r.signal ? ` (killed after ${secs}s: ${r.signal || r.error?.code})` : "";
  const out = `$ ${cmd} ${args.join(" ")}\nexit ${r.status} in ${secs}s${why}\n--- stdout\n${r.stdout || ""}\n--- stderr\n${r.stderr || ""}\n`;
  if (log) writeFileSync(log, out, { flag: "a" });
  process.stderr.write(`[vd-loop] ${cmd} ${args.slice(0, 2).join(" ")} -> exit ${r.status} in ${secs}s${why}\n`);
  return { ok: r.status === 0, status: r.status, stdout: r.stdout || "", stderr: (r.stderr || "").slice(-2000), error: why || null };
}
const node = (script, args, log, timeoutMs) => run(process.execPath, [script, ...args], log, timeoutMs);
const VD = "scripts/visual-director";
const MIN = 60 * 1000;

export const realSteps = {
  direct: ({ script, research, tts, channel, out, critique, beats, log }) =>
    node(`${VD}/direct.mjs`, ["--script", script, "--research", research, "--tts", tts, "--channel", channel, "--out", out,
      ...(critique ? ["--critique", critique, "--beats", beats.join(",")] : [])], log, 12 * MIN),
  // gate.mjs (feat/vd-director) prints its failures and exits 1; the loop keeps that output as the gate report.
  gate: ({ direction, script, research, tts, log, report }) => {
    const r = node(`${VD}/gate.mjs`, ["--direction", direction, "--script", script, ...(research ? ["--research", research] : []), "--tts", tts], log, 3 * MIN);
    writeFileSync(report, JSON.stringify({ ok: r.ok, exit: r.status, output: (r.stdout + r.stderr).slice(-8000) }, null, 2));
    return r;
  },
  resolve: ({ direction, out, assetsDir, report, research, log }) => node(`${VD}/materials/resolve.mjs`, ["--direction", direction, "--out", out, "--assets-dir", assetsDir, "--report", report, ...(research ? ["--research", research] : [])], log, 20 * MIN),
  // render-direction.mjs (feat/vd-shots) takes --audio + --words [{word,start,end}]; edge-tts writes
  // {words:[{text,start,end}]} in <tts>/<script stem>-vo-words.json, so the loop converts it here.
  // --proof: an unverified material renders as a MARKED placeholder (production refuses such a direction);
  // the critic sees the placeholder and judges it as what it is.
  render: ({ direction, out, tts, script, log }) => {
    const stem = basename(script).replace(/\.json$/, "");
    const mp3 = join(tts, `${stem}-vo.mp3`), wj = join(tts, `${stem}-vo-words.json`);
    // Proof runs render an unverified material as a MARKED placeholder; production (VD_PROOF=0)
    // refuses it, so a placeholder can never reach an approved export.
    const args = ["--direction", direction, "--out", out, ...(process.env.VD_PROOF === "0" ? [] : ["--proof"])];
    if (existsSync(mp3)) args.push("--audio", mp3);
    if (existsSync(wj)) {
      const w = readJson(wj); const arr = (Array.isArray(w) ? w : w.words || []).map((x) => ({ word: x.word ?? x.text, start: x.start, end: x.end }));
      const wp = out.replace(/\.mp4$/i, ".words.json"); writeJson(wp, arr); args.push("--words", wp);
    }
    return node(`${VD}/render-direction.mjs`, args, log, 20 * MIN);
  },
  // the renderer's <out>.shots.json has the real shot frame windows; frames.mjs labels from it when present.
  frames: async ({ video, direction, outDir }) => {
    const sp = video.replace(/\.mp4$/i, ".shots.json");
    let manifest = null;
    if (existsSync(sp)) { const s = readJson(sp); manifest = { shots: (s.shots || []).map((x) => ({ id: x.id, t_start: x.from / s.fps, t_end: x.to / s.fps })) }; }
    return (await import("./frames.mjs")).extractFrames({ video, direction, outDir, manifest });
  },
  // Deterministic QA runs on every round, not only on the final MP4: a black or frozen
  // beat must trigger a corrective rebuild while there is still time, and its report is
  // the evidence that drove that round.
  qa: async ({ video, direction, index, materialsReport }) => {
    const read = (p) => (existsSync(p) ? readJson(p) : null);
    const { qaVideo } = await import("./qa-video.mjs");
    return qaVideo({ video, direction, framesIndex: index, shotsDoc: read(video.replace(/\.mp4$/i, ".shots.json")),
      sfxDoc: read(video.replace(/\.mp4$/i, ".sfx.json")), materialsReport });
  },
  critic: async ({ direction, index, round }) => (await import("./critic.mjs")).runCritic({ direction, index, round }),
};

// ---------------------------------------------------------------- the loop
export async function runLoop({ script, research, tts, channel, outDir, maxRounds = 2, maxMs = 40 * 60 * 1000, steps = realSteps, clock = now, gateMode = "enforce" }) {
  const t0 = clock();
  mkdirSync(outDir, { recursive: true });
  const assetsDir = join(outDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  const report = { schema_version: 1, script, research, channel, max_rounds: maxRounds, max_ms: maxMs, rounds: [], stop_reason: null, final: [] };
  const save = () => { writeJson(join(outDir, "loop-report.json"), report); writeFileSync(join(outDir, "comparison.md"), comparisonMarkdown(report, outDir)); };
  let current = null; // the direction (with resolved materials) of the last rendered round

  for (let round = 0; round <= maxRounds; round++) {
    const rd = join(outDir, `round-${round}`);
    mkdirSync(rd, { recursive: true });
    const log = join(rd, "steps.log");
    const rec = { round, rebuilt: [], started_ms: clock() - t0 };
    report.rounds.push(rec);
    const prevRec = round > 0 ? report.rounds[round - 1] : null;
    const prevCritic = prevRec?.critic || null;
    const prevCritique = prevRec?.critic_for_next && existsSync(prevRec.critic_for_next) ? readJson(prevRec.critic_for_next) : prevCritic;
    // A round is rebuilt when the critic rejects a scene OR deterministic QA failed on the
    // rendered MP4. QA targets are stored on the previous round, so black/freeze failures
    // survive into the next corrective round even when the critic said KEEP.
    const targets = round > 0 ? (prevRec.next_targets || beatsToRebuild(prevCritic)) : null;
    if (round > 0) {
      if (!targets.length) { report.rounds.pop(); report.stop_reason = "no scene needs rebuilding"; break; }
      if (clock() - t0 > maxMs) { report.rounds.pop(); report.stop_reason = `VD_MAX_MS ${maxMs} reached before round ${round}`; break; }
    }

    // 1) direct (whole script in round 0, only the targets after)
    const raw = join(rd, "direction.raw.json");
    let critiquePath = null;
    // direct.mjs re-directs IN PLACE: with --critique it reads the previous direction from --out.
    if (round > 0) { critiquePath = prevRec?.critic_for_next || join(outDir, `round-${round - 1}`, "critic.json"); writeJson(raw, current); }
    const d = await steps.direct({ script, research, tts, channel, out: raw, critique: critiquePath, beats: targets, log });
    if (!d.ok || !existsSync(raw)) { rec.error = `direct failed (exit ${d.status}): ${String(d.stderr).slice(-400)}`; report.stop_reason = rec.error; break; }
    let direction = readJson(raw);
    if (round > 0) {
      const s = spliceBeats(current, direction, targets, { round: round - 1, critique: prevCritique });
      direction = s.direction;
      rec.rebuilt = targets.filter((i) => !s.missing.includes(i));
      if (s.missing.length) rec.director_missing_beats = s.missing;
    }
    const dirPath = join(rd, "direction.json");
    writeJson(dirPath, direction);

    // 2) gate
    const g = await steps.gate({ direction: dirPath, script, research, tts, log, report: join(rd, "gate.json") });
    rec.gate = g.ok ? "pass" : `fail: ${String(g.stdout + g.stderr).slice(-600)}`;
    rec.gate_ok = g.ok;
    rec.gate_failures = g.ok ? [] : parseGateFailures(g.stdout + "\n" + g.stderr);
    // VD_GATE=record (proof runs): a gate failure is recorded and the round still renders, so the
    // critic sees what the failing direction looks like. Default (enforce): a failing direction never renders.
    if (!g.ok && gateMode === "record") rec.gate_recorded_only = true;
    else if (!g.ok) {
      // Keep the round in loop-report.json: a gate that stopped the pipeline is evidence,
      // and production.mjs reads its structured failures for the terminal state.
      rec.error = round === 0 ? "round-0 direction failed the gate" : "rebuild direction failed the gate";
      if (round === 0) { report.stop_reason = "round-0 direction failed the gate"; break; }
      // A failed rebuild keeps the previous round's scenes; they stay unresolved.
      rec.rebuilt = []; report.stop_reason = `round ${round} rebuild failed the gate`; break;
    }

    // 3) materials; beats with essential material missing go back to the director before render.
    // A redirect replaces only the beats that still miss material, and a rebuilt beat keeps every
    // material that was already verified (reuseVerifiedMaterials). Up to VD_MATERIAL_REDIRECTS
    // repairs (default 2) are tried. If a beat still has an unfindable shot but also a real verified
    // shot, the unfindable shot is pruned and the real one is held for the beat's full duration. A
    // beat with no real shot is left for the renderer to refuse loudly; the loop never invents one.
    let resolved = join(rd, "direction.resolved.json"), matReport = join(rd, "materials-report.json");
    const m = await steps.resolve({ direction: dirPath, out: resolved, assetsDir, report: matReport, research, log });
    if (!m.ok || !existsSync(resolved)) { rec.error = `materials resolve failed (exit ${m.status})`; report.stop_reason = rec.error; break; }
    let missing = existsSync(matReport) ? essentialMissing(readJson(matReport)) : [];
    rec.materials_missing = missing;
    rec.materials_redirects = [];
    const maxRedirects = +(process.env.VD_MATERIAL_REDIRECTS || 2);
    for (let attempt = 1; missing.length && attempt <= maxRedirects; attempt++) {
      if (clock() - t0 > maxMs) { rec.materials_redirect_stop = `VD_MAX_MS ${maxMs} reached before redirect ${attempt}`; break; }
      const sfx = attempt === 1 ? "" : `.${attempt}`;
      const ids = [...new Set(missing.map((x) => x.beat_index))];
      const verified = verifiedMaterials(readJson(resolved));
      const mc = materialsCritique(missing, round, verified, rec.gate_failures || []);
      const mcPath = join(rd, `materials-critique${sfx}.json`);
      writeJson(mcPath, mc);
      const raw2 = join(rd, `direction.materials-redirect${sfx}.raw.json`);
      copyFileSync(resolved, raw2);
      const a = { attempt, beats: ids, missing_before: missing.length, verified: verified.length };
      const d2 = await steps.direct({ script, research, tts, channel, out: raw2, critique: mcPath, beats: ids, log });
      if (!d2.ok || !existsSync(raw2)) { a.error = `direct exit ${d2.status}`; rec.materials_redirects.push(a); rec.materials_redirect_error = a.error; break; }
      const s2 = spliceBeats(readJson(resolved), readJson(raw2), ids, { round, critique: mc });
      const reuse = reuseVerifiedMaterials(s2.direction, readJson(resolved), ids);
      const dir2 = join(rd, `direction.materials-redirect${sfx}.json`);
      writeJson(dir2, reuse.direction);
      a.reused = reuse.reused;
      const g2 = await steps.gate({ direction: dir2, script, research, tts, log, report: join(rd, `gate.materials-redirect${sfx}.json`) });
      a.gate = g2.ok ? "pass" : "fail";
      rec.materials_redirect_gate = a.gate;
      // Record mode renders a gate-failing round on purpose (the critic and the MP4 are the
      // evidence). A material redirect must follow the same rule: its whole point is to replace
      // pictures that do not exist, and a gate failure elsewhere must not throw that away. The
      // redirect's own failures become the round's, so APPROVED still requires a clean gate.
      if (!g2.ok && gateMode !== "record") { a.error = "redirect failed the gate"; rec.materials_redirects.push(a); rec.materials_redirect_error = a.error; break; }
      const res2 = join(rd, `direction.resolved.${attempt + 1}.json`), rep2 = join(rd, `materials-report.${attempt + 1}.json`);
      const m2 = await steps.resolve({ direction: dir2, out: res2, assetsDir, report: rep2, research, log });
      if (!m2.ok || !existsSync(res2)) { a.error = `materials resolve failed (exit ${m2.status})`; rec.materials_redirects.push(a); rec.materials_redirect_error = a.error; break; }
      resolved = res2; matReport = rep2;
      missing = existsSync(rep2) ? essentialMissing(readJson(rep2)) : [];
      a.missing_after = missing.length;
      rec.materials_redirects.push(a);
      rec.materials_redirected = [...new Set([...(rec.materials_redirected || []), ...ids])];
      rec.materials_missing_after_redirect = missing;
      if (!g2.ok) {
        rec.gate_ok = false;
        rec.gate_recorded_only = true;
        rec.gate_failures = parseGateFailures(g2.stdout + "\n" + g2.stderr);
      }
    }
    // Last-resort corrective edit: drop a shot whose material does not exist when the beat still
    // has a verified shot; hold the real shot for the beat's full duration. The pruned timeline
    // and its own materials report are the evidence, and QA inspects the resulting frames.
    if (missing.length) {
      const pr = pruneUnverifiedShots(readJson(resolved));
      rec.materials_prune_candidates = pr.pruned;
      if (pr.pruned.length) {
        const prunedDir = join(rd, "direction.pruned.json"), prunedReport = join(rd, "materials-report.final.json");
        writeJson(prunedDir, pr.direction);
        writeJson(prunedReport, reportForPruned(pr.direction, existsSync(matReport) ? readJson(matReport) : {}, pr.pruned));
        const gp = await steps.gate({ direction: prunedDir, script, research, tts, log, report: join(rd, "gate.pruned.json") });
        rec.materials_pruned = pr.pruned;
        rec.materials_prune_gate = gp.ok ? "pass" : "fail";
        if (!gp.ok) {
          rec.gate_ok = false;
          rec.gate_recorded_only = true;
          rec.gate_failures = parseGateFailures(gp.stdout + "\n" + gp.stderr);
        }
        resolved = prunedDir; matReport = prunedReport;
        missing = essentialMissing(readJson(prunedReport));
        rec.materials_missing_after_prune = missing;
      }
    }
    rec.direction = resolved; rec.materials_report = matReport;
    current = readJson(resolved);

    // 4) render
    const video = join(rd, "video.mp4");
    const r = await steps.render({ direction: resolved, out: video, tts, script, channel, assetsDir, log });
    if (!r.ok || !existsSync(video)) { rec.error = `render failed (exit ${r.status}): ${String(r.stderr).slice(-400)}`; report.stop_reason = rec.error; break; }
    rec.video = video;

    // 5) frames, deterministic QA, 6) critic. QA runs before the critic so a black or
    // frozen render is a fact the next round must answer, not an opinion the critic may miss.
    const index = await steps.frames({ video, direction: current, outDir: join(rd, "frames") });
    rec.contact_sheet = index.sheet; rec.strips = index.strips;
    let qa = null;
    if (steps.qa) {
      try {
        qa = await steps.qa({ video, direction: current, index, materialsReport: existsSync(matReport) ? readJson(matReport) : null });
      } catch (e) {
        qa = { pass: false, checks: [{ id: "qa.error", pass: false, detail: String(e?.message || e).slice(0, 500) }], black: [], freeze: [] };
      }
      rec.qa = { pass: !!qa.pass, checks: qa.checks || [], black: qa.black || [], freeze: qa.freeze || [], probe: qa.probe || null };
      writeJson(join(rd, "qa-deterministic.json"), qa);
      if ((qa.checks || []).some((check) => check.id === "qa.error")) {
        rec.error = `deterministic QA could not run: ${qa.checks.find((check) => check.id === "qa.error").detail}`;
        report.stop_reason = rec.error;
        rec.elapsed_ms = clock() - t0;
        save();
        break;
      }
    }
    const critic = await steps.critic({ direction: current, index, round });
    writeJson(join(rd, "critic.json"), critic);
    rec.critic = critic;
    const qaTargets = qa && !qa.pass ? qaImplicatedBeats(qa, current) : [];
    const nextTargets = [...new Set([...beatsToRebuild(critic), ...qaTargets])].sort((a, b) => a - b);
    rec.next_targets = nextTargets;
    if (qa && !qa.pass) {
      const cp = join(rd, "critic.qa.json");
      writeJson(cp, qaCorrectiveCritique(critic, qa, current, qaTargets));
      rec.critic_for_next = cp;
    }
    rec.elapsed_ms = clock() - t0;
    save();
    if (round === maxRounds) { report.stop_reason = nextTargets.length ? `VD_MAX_ROUNDS ${maxRounds} reached with scenes still failing` : "no scene needs rebuilding"; }
  }
  const idx = (current?.beats || []).map((b) => b.beat_index);
  report.final = finalStatus(report.rounds.filter((r) => r.critic), idx);
  // the summary table indexes rounds by position; keep only rounds that produced a critique
  report.rounds = report.rounds.filter((r) => r.critic || r.error);
  report.elapsed_ms = clock() - t0;
  save();
  return report;
}

function arg(name, def = null) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; }

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("visual-director/loop.mjs")) {
  const req = ["script", "research", "tts", "channel", "out"];
  if (req.some((k) => !arg(k))) { console.error(`usage: loop.mjs ${req.map((k) => `--${k} <..>`).join(" ")}`); process.exit(2); }
  const rep = await runLoop({ script: arg("script"), research: arg("research"), tts: arg("tts"), channel: arg("channel"), outDir: resolve(arg("out")),
    maxRounds: Number(process.env.VD_MAX_ROUNDS || 2), maxMs: Number(process.env.VD_MAX_MS || 40 * 60 * 1000), gateMode: process.env.VD_GATE || "enforce" });
  console.log(`stop: ${rep.stop_reason}`);
  for (const f of rep.final) console.log(`b${f.beat_index}: ${f.status} [${f.verdicts.join(" -> ")}]${f.reason ? ` ${f.reason}` : ""}`);
  process.exit(rep.rounds.some((r) => r.critic) ? 0 : 1);
}
