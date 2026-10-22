// One defect shape for every QA check (schemas/defect-report.json) + adapters for the existing sidecars.
// Adapter shapes are copied from the real producers:
//   -local-audit.json   scripts/local-audit.cjs:1319   { video, pass, checks:[{id, pass, detail, advisory?}] }
//   -beat-check.json    scripts/gemini-frame-review.js:693  { beats:[{beat_index, matches:"YES"|"NO", what_is_shown, reason, sentence}], failing:[idx], wrong_person:[idx] }
//   frame review record scripts/gemini-frame-review.js:1304  { sceneResults:[{frame_index, scene?, status, quality_score, problem, categories, severity?, correction:{level,action}}], corrections:[...] }
//     UNCLEAR: the per-scene CRITICAL/HIGH tier is computed live (categorizeResult) and is NOT persisted;
//     only `severity` / `correction.level` / `status` survive, so the mapping below is a best effort.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SEV_ORDER = { blocker: 0, major: 1, minor: 2 };
let seq = 0;

export function makeDefect(p) {
  return {
    id: p.id || `d${++seq}`,
    check: p.check,
    source: p.source,
    severity: p.severity,
    scene_id: p.scene_id ?? null,
    beat_index: Number.isInteger(p.beat_index) ? p.beat_index : null,
    t_start: p.t_start ?? null,
    t_end: p.t_end ?? p.t_start ?? null,
    frame_paths: p.frame_paths || [],
    evidence: String(p.evidence ?? ""),
    expected: String(p.expected ?? ""),
    actual: String(p.actual ?? ""),
    repair: p.repair ?? null,
    status: p.status || "open",
  };
}

export function fromLocalAudit(json) {
  const out = [];
  for (const c of json?.checks || []) {
    if (c.pass) continue;
    // `advisory` checks are always pass:true in the producer; a failing one is a real failure.
    const beat = /beat (\d+)/.exec(c.detail || "");
    out.push(makeDefect({
      id: `audit:${c.id}`, check: c.id, source: "audit", severity: "major",
      beat_index: beat ? Number(beat[1]) : null,
      evidence: c.detail, expected: "check passes", actual: String(c.detail || "").slice(0, 300),
    }));
  }
  return out;
}

export function fromBeatCheck(json, { kind = "beat-check", beatTimes = null } = {}) {
  const out = [];
  const wrong = new Set(json?.wrong_person || []);
  for (const b of json?.beats || []) {
    if (String(b.matches).toUpperCase() === "YES") continue;
    const i = b.beat_index;
    const t = beatTimes?.[i] ?? null;
    out.push(makeDefect({
      id: `${kind}:${i}`, check: kind, source: "vision", severity: wrong.has(i) ? "blocker" : "major",
      beat_index: i, t_start: t, t_end: t,
      evidence: `${b.reason || ""} (shows: ${b.what_is_shown || "?"})`.trim(),
      expected: b.sentence ? `frame matches: ${b.sentence}` : "frame matches its sentence",
      actual: String(b.what_is_shown || b.reason || ""),
    }));
  }
  return out;
}

const sevOf = (r) => {
  const s = String(r.severity || r.correction?.level || "").toUpperCase();
  if (/CRITICAL|BLOCK/.test(s)) return "blocker";
  if (/HIGH|MAJOR/.test(s)) return "major";
  if (s) return "minor";
  return /FAIL|REJECT|NOT/.test(String(r.status || "").toUpperCase()) ? "major" : "minor";
};

export function fromFrameReview(json, { beatTimes = null } = {}) {
  const out = [];
  for (const r of json?.sceneResults || []) {
    if (r.error) continue;
    const passed = /^(PASS|OK|APPROVED)/i.test(String(r.status || "")) && !r.problem;
    if (passed) continue;
    const i = Number.isInteger(r.frame_index) ? r.frame_index : null;
    const t = i != null ? beatTimes?.[i] ?? null : null;
    out.push(makeDefect({
      id: `frame-review:${i ?? out.length}`, check: "frame-review", source: "vision", severity: sevOf(r),
      scene_id: r.scene || null, beat_index: i, t_start: t, t_end: t,
      evidence: r.problem || String(r.status || ""), expected: "frame passes the visual bible",
      actual: `${r.status || "?"} score ${r.quality_score ?? "?"}${(r.categories || []).length ? ` [${r.categories.join(", ")}]` : ""}`,
      repair: r.correction?.action ? { kind: "gemini-correction", params: { level: r.correction.level, action: r.correction.action } } : null,
    }));
  }
  return out;
}

export function sortDefects(defects) {
  return [...defects].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || (a.t_start ?? 1e9) - (b.t_start ?? 1e9));
}

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 160);

export function writeDefectReport(dir, stem, defects, meta = {}) {
  mkdirSync(dir, { recursive: true });
  const sorted = sortDefects(defects);
  const generated_at = new Date().toISOString();
  const jsonPath = join(dir, `${stem}-defects.json`);
  const mdPath = join(dir, `${stem}-defects.md`);
  writeFileSync(jsonPath, JSON.stringify({ video: stem, generated_at, meta, defects: sorted }, null, 2) + "\n");
  const counts = ["blocker", "major", "minor"].map((s) => `${sorted.filter((d) => d.severity === s).length} ${s}`).join(", ");
  const lines = [`# QA defects: ${stem}`, "", `Generated ${generated_at}. ${sorted.length} defect(s): ${counts}.`, ""];
  for (const sev of ["blocker", "major", "minor"]) {
    const rows = sorted.filter((d) => d.severity === sev);
    if (!rows.length) continue;
    lines.push(`## ${sev}`, "", "| time | beat | check | source | status | evidence |", "|---|---|---|---|---|---|");
    for (const d of rows) {
      const t = d.t_start == null ? "-" : `${d.t_start.toFixed(2)}-${(d.t_end ?? d.t_start).toFixed(2)}s`;
      lines.push(`| ${t} | ${d.beat_index ?? "-"} | ${cell(d.check)} | ${d.source} | ${d.status} | ${cell(d.evidence)} |`);
    }
    lines.push("");
  }
  writeFileSync(mdPath, lines.join("\n") + "\n");
  return { jsonPath, mdPath };
}

// -camera-check.json: { beats:[{beat_index, moved, change, pixels, real}], failing:[idx] } (gemini-frame-review.js:786)
export function fromCameraCheck(json, { beatTimes = null } = {}) {
  return (json?.beats || []).filter((v) => v.real === false).map((v) => makeDefect({
    id: `camera-check:${v.beat_index}`, check: "camera-check", source: "vision", severity: "major",
    beat_index: v.beat_index, t_start: beatTimes?.[v.beat_index] ?? null,
    evidence: `${v.change || ""} ${v.pixels?.what || ""}`.trim(), expected: "a real camera move of 8% or more", actual: "no real move (fake pan)",
  }));
}
