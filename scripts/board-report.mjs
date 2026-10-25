#!/usr/bin/env node
/**
 * board-report — read a board from what it produced, not from a log line.
 *
 *   node scripts/board-report.mjs --board board --out out/board
 *
 * `board/` holds the downloaded artifacts of one run: rendered-<ch>-<run>/ (data/renders/<ch>/, data/visual-plans/<ch>/) and qa-queues-<ch>-<run>/
 * (data/renders/rejected|approved*, where a video that failed a gate is kept). For each channel it
 *   1. reads the RESOLVED plan (the beats as they were drawn) and counts every named entity by what it got to show — before and after the tightened
 *      entity extractor (scripts/lib/entity-shape.mjs), by distinct entity and by beat occurrence;
 *   2. cuts one frame from the middle of every beat of the video and tiles them into a contact sheet (out/frames/ch<N>.jpg), so the board can be
 *      READ AS FRAMES (the frames are the truth; a manifest line is not).
 * Reports only; changes nothing.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { entityVisuals, summarise } from "./lib/entity-visuals.mjs";
import { entityShape } from "./lib/entity-shape.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const board = arg("board", "board"), out = arg("out", "out/board");
mkdirSync(join(out, "frames"), { recursive: true });

const walk = (d, f, acc = []) => { if (!existsSync(d)) return acc; for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, f, acc); else if (f(p)) acc.push(p); } return acc; };
const newest = (ps) => ps.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null;
const channels = [...new Set(readdirSync(board).map((n) => (n.match(/^(?:rendered|qa-queues)-(\d+)-/) || [])[1]).filter(Boolean))].sort((a, b) => a - b);

const rows = [], sheets = [];
for (const ch of channels) {
  const dirs = readdirSync(board).filter((n) => new RegExp(`^(?:rendered|qa-queues)-${ch}-`).test(n)).map((n) => join(board, n));
  const plan = newest(dirs.flatMap((d) => walk(d, (p) => /-resolved\.json$/.test(p) && p.includes(`visual-plans`))));
  const video = newest(dirs.flatMap((d) => walk(d, (p) => /\.mp4$/.test(p))));
  const rec = { channel: ch, plan: plan && plan.replace(board + "/", ""), video: video && video.replace(board + "/", "") };
  if (plan) {
    const p = JSON.parse(readFileSync(plan, "utf8"));
    const all = entityVisuals(p);
    const sentenceOf = new Map((p.beats || []).map((b, i) => [b.index ?? i, b.narration || b.canvas?.sentence || ""]));
    const kept = all.filter((r) => entityShape(r.name, r.type, sentenceOf.get(r.beat) || "").ok);
    const dropped = all.filter((r) => !kept.includes(r));
    const distinct = (rs) => { const m = new Map(); for (const r of rs) { const k = `${r.type}|${r.name.toLowerCase()}`; const had = m.get(k); m.set(k, !had && r.visual === "typed" ? false : (had || r.visual !== "typed")); } return m; };
    const dist = (rs) => { const m = distinct(rs); return { named: m.size, real: [...m.values()].filter(Boolean).length }; };
    Object.assign(rec, { before: { ...summarise(all), distinct: dist(all) }, after: { ...summarise(kept), distinct: dist(kept) }, dropped: dropped.map((r) => `${r.type} "${r.name}" (beat ${r.beat}, ${r.visual}) — ${entityShape(r.name, r.type, sentenceOf.get(r.beat) || "").why}`), rows: kept });
  }
  if (video) {
    const dur = Number((spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], { encoding: "utf8" }).stdout || "0").trim()) || 0;
    let beats = []; try { beats = JSON.parse(readFileSync(plan, "utf8")).beats || []; } catch {}
    const d = beats.map((b) => Number(b.duration_sec ?? b.canvas?.duration_sec ?? 0));
    let times;
    if (d.length && d.every((x) => x > 0) && Math.abs(d.reduce((a, b) => a + b, 0) - dur) / Math.max(dur, 1) < 0.15) { let t = 0; times = d.map((x) => { const m = t + x / 2; t += x; return m; }); }
    else times = Array.from({ length: 9 }, (_, i) => ((i + 0.5) / 9) * dur);
    const dir = join(out, "frames", `ch${ch}`); mkdirSync(dir, { recursive: true });
    times.forEach((t, i) => spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=270:-2", join(dir, `f${String(i).padStart(2, "0")}.png`)]));
    const sheet = join(out, "frames", `ch${ch}.jpg`);
    const cols = 5, rowsN = Math.ceil(times.length / cols);
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", join(dir, "f%02d.png"), "-vf", `tile=${cols}x${rowsN}:padding=6:color=white`, "-frames:v", "1", "-q:v", "4", sheet], { encoding: "utf8" });
    if (r.status === 0) { sheets.push(sheet); rec.sheet = `frames/ch${ch}.jpg`; rec.beats_framed = times.length; }
  }
  rows.push(rec);
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) + "%" : "n/a");
const line = (r) => `| ${r.channel} | ${r.before ? `${r.before.distinct.real}/${r.before.distinct.named} (${pct(r.before.distinct.real, r.before.distinct.named)}) · ${r.before.real}/${r.before.named} occ` : "—"} | ${r.after ? `${r.after.distinct.real}/${r.after.distinct.named} (${pct(r.after.distinct.real, r.after.distinct.named)}) · ${r.after.real}/${r.after.named} occ` : "—"} | ${(r.dropped || []).join("; ") || "—"} |`;
const sum = (k, f) => rows.reduce((a, r) => a + (r[k] ? f(r[k]) : 0), 0);
const tot = (k) => `${sum(k, (x) => x.distinct.real)}/${sum(k, (x) => x.distinct.named)} (${pct(sum(k, (x) => x.distinct.real), sum(k, (x) => x.distinct.named))}) · ${sum(k, (x) => x.real)}/${sum(k, (x) => x.named)} occ (${pct(sum(k, (x) => x.real), sum(k, (x) => x.named))})`;
const md = ["| ch | before the extractor fix: distinct with a real visual · occurrences | after | entities the extractor now rejects |", "|---|---|---|---|", ...rows.map(line), `| **all** | **${tot("before")}** | **${tot("after")}** | |`].join("\n");
console.log(md);
writeFileSync(join(out, "board-report.json"), JSON.stringify({ rows }, null, 2) + "\n");
writeFileSync(join(out, "board-report.md"), md + "\n");
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## board report\n\n${md}\n`, { flag: "a" });
