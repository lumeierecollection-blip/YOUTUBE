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

/** Beats the materials report says cannot be shown as directed. Tolerates {beats:[...]} or [...]. */
export function essentialMissing(report) {
  const list = Array.isArray(report) ? report : report?.beats || [];
  return list.filter((b) => Array.isArray(b.essential_missing) && b.essential_missing.length)
    .map((b) => ({ beat_index: b.beat_index, missing: b.essential_missing }));
}

/** A critique document (critic.json shape) from material failures, so the director reads one format. */
export function materialsCritique(missing, round) {
  return { schema_version: 1, round, source: "materials", status: "complete",
    scenes: missing.map((m) => ({ beat_index: m.beat_index, status: "answered", verdict: "REBUILD", effective_verdict: "REBUILD",
      answer: { beat_index: m.beat_index, verdict: "REBUILD", delete_reason: null,
        what_to_change: `These essential materials could not be found or verified: ${m.missing.map((x) => typeof x === "string" ? x : (x.must_show ? `"${x.must_show}"${x.why ? ` (${x.why})` : ""}` : (x.id || JSON.stringify(x)))).join("; ")}. Rebuild the scene around what CAN be shown with real, verified material; never a look-alike.` } })) };
}

/** Beats to re-direct after a critic pass. Pure; tested. */
export function beatsToRebuild(critic) {
  return (critic?.scenes || []).filter((s) => s.effective_verdict === "REBUILD" || s.effective_verdict === "DELETE").map((s) => s.beat_index);
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

export function comparisonMarkdown(report, outDir) {
  const rel = (p) => (p ? relative(outDir, p).replace(/\\/g, "/") : "-");
  const L = [`# Visual director: round comparison`, ``, `Script: \`${report.script}\`  `, `Rounds: ${report.rounds.length}; stopped: ${report.stop_reason}`, ``, `## Contact sheets`, ``];
  for (const r of report.rounds) L.push(`- round ${r.round}: \`${rel(r.contact_sheet)}\` (video \`${rel(r.video)}\`; critic ${r.critic?.status || "absent"}${r.critic?.whole_video?.answer ? `; template alternation: ${r.critic.whole_video.answer.template_alternation}, whole mute test: ${r.critic.whole_video.answer.whole_mute_test}` : ""})`);
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
function run(cmd, args, log) {
  const t0 = now();
  const r = spawnSync(cmd, args, { encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const out = `$ ${cmd} ${args.join(" ")}\nexit ${r.status} in ${((now() - t0) / 1000).toFixed(1)}s\n--- stdout\n${r.stdout || ""}\n--- stderr\n${r.stderr || ""}\n`;
  if (log) writeFileSync(log, out, { flag: "a" });
  process.stderr.write(`[vd-loop] ${cmd} ${args.slice(0, 2).join(" ")} -> exit ${r.status}\n`);
  return { ok: r.status === 0, status: r.status, stdout: r.stdout || "", stderr: (r.stderr || "").slice(-2000) };
}
const node = (script, args, log) => run(process.execPath, [script, ...args], log);
const VD = "scripts/visual-director";

export const realSteps = {
  direct: ({ script, research, tts, channel, out, critique, beats, log }) =>
    node(`${VD}/direct.mjs`, ["--script", script, "--research", research, "--tts", tts, "--channel", channel, "--out", out,
      ...(critique ? ["--critique", critique, "--beats", beats.join(",")] : [])], log),
  // gate.mjs (feat/vd-director) prints its failures and exits 1; the loop keeps that output as the gate report.
  gate: ({ direction, script, research, tts, log, report }) => {
    const r = node(`${VD}/gate.mjs`, ["--direction", direction, "--script", script, ...(research ? ["--research", research] : []), "--tts", tts], log);
    writeFileSync(report, JSON.stringify({ ok: r.ok, exit: r.status, output: (r.stdout + r.stderr).slice(-8000) }, null, 2));
    return r;
  },
  resolve: ({ direction, out, assetsDir, report, research, log }) => node(`${VD}/materials/resolve.mjs`, ["--direction", direction, "--out", out, "--assets-dir", assetsDir, "--report", report, ...(research ? ["--research", research] : [])], log),
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
    return node(`${VD}/render-direction.mjs`, args, log);
  },
  // the renderer's <out>.shots.json has the real shot frame windows; frames.mjs labels from it when present.
  frames: async ({ video, direction, outDir }) => {
    const sp = video.replace(/\.mp4$/i, ".shots.json");
    let manifest = null;
    if (existsSync(sp)) { const s = readJson(sp); manifest = { shots: (s.shots || []).map((x) => ({ id: x.id, t_start: x.from / s.fps, t_end: x.to / s.fps })) }; }
    return (await import("./frames.mjs")).extractFrames({ video, direction, outDir, manifest });
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
    const prevCritic = round > 0 ? report.rounds[round - 1].critic : null;
    const targets = round > 0 ? beatsToRebuild(prevCritic) : null;
    if (round > 0) {
      if (!targets.length) { report.rounds.pop(); report.stop_reason = "no scene needs rebuilding"; break; }
      if (clock() - t0 > maxMs) { report.rounds.pop(); report.stop_reason = `VD_MAX_MS ${maxMs} reached before round ${round}`; break; }
    }

    // 1) direct (whole script in round 0, only the targets after)
    const raw = join(rd, "direction.raw.json");
    let critiquePath = null;
    // direct.mjs re-directs IN PLACE: with --critique it reads the previous direction from --out.
    if (round > 0) { critiquePath = join(outDir, `round-${round - 1}`, "critic.json"); writeJson(raw, current); }
    const d = await steps.direct({ script, research, tts, channel, out: raw, critique: critiquePath, beats: targets, log });
    if (!d.ok || !existsSync(raw)) { rec.error = `direct failed (exit ${d.status}): ${String(d.stderr).slice(-400)}`; report.stop_reason = rec.error; break; }
    let direction = readJson(raw);
    if (round > 0) {
      const s = spliceBeats(current, direction, targets, { round: round - 1, critique: prevCritic });
      direction = s.direction;
      rec.rebuilt = targets.filter((i) => !s.missing.includes(i));
      if (s.missing.length) rec.director_missing_beats = s.missing;
    }
    const dirPath = join(rd, "direction.json");
    writeJson(dirPath, direction);

    // 2) gate
    const g = await steps.gate({ direction: dirPath, script, research, tts, log, report: join(rd, "gate.json") });
    rec.gate = g.ok ? "pass" : `fail: ${String(g.stdout + g.stderr).slice(-600)}`;
    // VD_GATE=record (proof runs): a gate failure is recorded and the round still renders, so the
    // critic sees what the failing direction looks like. Default (enforce): a failing direction never renders.
    if (!g.ok && gateMode === "record") rec.gate_recorded_only = true;
    else if (!g.ok) {
      if (round === 0) { report.stop_reason = "round-0 direction failed the gate"; break; }
      // A failed rebuild keeps the previous round's scenes; they stay unresolved.
      rec.rebuilt = []; rec.error = `rebuild direction failed the gate`; report.stop_reason = `round ${round} rebuild failed the gate`; break;
    }

    // 3) materials; beats with essential material missing go back to the director once, before render
    let resolved = join(rd, "direction.resolved.json"), matReport = join(rd, "materials-report.json");
    const m = await steps.resolve({ direction: dirPath, out: resolved, assetsDir, report: matReport, research, log });
    if (!m.ok || !existsSync(resolved)) { rec.error = `materials resolve failed (exit ${m.status})`; report.stop_reason = rec.error; break; }
    const missing = existsSync(matReport) ? essentialMissing(readJson(matReport)) : [];
    rec.materials_missing = missing;
    if (missing.length) {
      const mc = materialsCritique(missing, round);
      const mcPath = join(rd, "materials-critique.json");
      writeJson(mcPath, mc);
      const raw2 = join(rd, "direction.materials-redirect.raw.json");
      const ids = missing.map((x) => x.beat_index);
      copyFileSync(resolved, raw2);
      const d2 = await steps.direct({ script, research, tts, channel, out: raw2, critique: mcPath, beats: ids, log });
      if (d2.ok && existsSync(raw2)) {
        const s2 = spliceBeats(readJson(resolved), readJson(raw2), ids, { round, critique: mc });
        const dir2 = join(rd, "direction.materials-redirect.json");
        writeJson(dir2, s2.direction);
        const g2 = await steps.gate({ direction: dir2, script, research, tts, log, report: join(rd, "gate.materials-redirect.json") });
        if (g2.ok) {
          const res2 = join(rd, "direction.resolved.2.json"), rep2 = join(rd, "materials-report.2.json");
          const m2 = await steps.resolve({ direction: dir2, out: res2, assetsDir, report: rep2, research, log });
          if (m2.ok && existsSync(res2)) {
            resolved = res2; matReport = rep2;
            rec.materials_redirected = ids;
            rec.materials_missing_after_redirect = existsSync(rep2) ? essentialMissing(readJson(rep2)) : [];
          }
        } else rec.materials_redirect_gate = "fail";
      } else rec.materials_redirect_error = `direct exit ${d2.status}`;
    }
    rec.direction = resolved; rec.materials_report = matReport;
    current = readJson(resolved);

    // 4) render
    const video = join(rd, "video.mp4");
    const r = await steps.render({ direction: resolved, out: video, tts, script, channel, assetsDir, log });
    if (!r.ok || !existsSync(video)) { rec.error = `render failed (exit ${r.status}): ${String(r.stderr).slice(-400)}`; report.stop_reason = rec.error; break; }
    rec.video = video;

    // 5) frames + 6) critic
    const index = await steps.frames({ video, direction: current, outDir: join(rd, "frames") });
    rec.contact_sheet = index.sheet; rec.strips = index.strips;
    const critic = await steps.critic({ direction: current, index, round });
    writeJson(join(rd, "critic.json"), critic);
    rec.critic = critic;
    rec.elapsed_ms = clock() - t0;
    save();
    if (round === maxRounds) { report.stop_reason = beatsToRebuild(critic).length ? `VD_MAX_ROUNDS ${maxRounds} reached with scenes still failing` : "no scene needs rebuilding"; }
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
