#!/usr/bin/env node
/**
 * Preview bundle builder — runs on the GitHub runner in the `preview` job of
 * .github/workflows/daily-pipeline-v2.yml. Never meant to run locally.
 *
 * Input:  data/preview/raw/ — this run's artifacts, one directory per
 *         artifact (actions/download-artifact@v4 without merge-multiple):
 *           rendered-<ch>-<run>/   approved renders (data/renders/<ch>/*.mp4)
 *                                  plus data/renders/qa-counts.json
 *           qa-queues-<ch>-<run>/  videos a QA stage failed, each MP4 with a
 *                                  sibling <stem>.json marker whose verdict is
 *                                  local-pass (approved-review) or local-fail
 *                                  (rejected)
 * Output: data/preview/bundle/ — per channel a 6s clip from 25% in, 8 frames
 *         at 540x960, a 4x2 contact sheet; ALL-CHANNELS.png; README.md.
 *
 * Where the approval status comes from — and where it stops: the render
 * job's log is not an artifact, so status is read from what IS uploaded:
 * the queue marker JSON for queued videos, and qa-counts.json (written by
 * render-and-qa.js's summary) for approved ones. An MP4 in rendered-* with
 * no qa-counts.json is reported as "unverified", not as approved —
 * render-and-qa.js may have died before its summary.
 *
 * Exit 0 if at least one MP4 was found; exit 1 only if none were.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "preview", "raw");
const OUT = join(ROOT, "data", "preview", "bundle");
const FRAME_COUNT = 8;
const CLIP_SECONDS = 6;

const log = (msg) => console.log(`[preview] ${msg}`);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString();
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; } };

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Channels expected this run: the dispatch input, else the priority list.
function expectedChannels() {
  const fromEnv = (process.env.PREVIEW_CHANNELS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const pri = readJson(join(ROOT, "config", "priority-channels.json"));
  return (pri?.channels || []).map(String);
}

// Collect every candidate MP4 per channel, tagged with its approval status.
function collect() {
  const byChannel = new Map();
  const add = (ch, entry) => {
    if (!byChannel.has(ch)) byChannel.set(ch, { candidates: [], qaCounts: null });
    if (entry) byChannel.get(ch).candidates.push(entry);
    return byChannel.get(ch);
  };
  if (!existsSync(RAW)) return byChannel;
  for (const art of readdirSync(RAW, { withFileTypes: true })) {
    if (!art.isDirectory()) continue;
    const m = art.name.match(/^(rendered|qa-queues)-(\d+)-/);
    if (!m) continue;
    const [, kind, ch] = m;
    const files = walk(join(RAW, art.name));
    if (kind === "rendered") {
      const countsPath = files.find((f) => basename(f) === "qa-counts.json");
      const slot = add(ch);
      slot.qaCounts = countsPath ? readJson(countsPath) : null;
      for (const f of files.filter((f) => f.endsWith(".mp4"))) {
        const approved = slot.qaCounts?.approved;
        const status = approved == null ? "unverified (no qa-counts.json)"
          : approved > 0 ? "approved" : `not approved (qa-counts approved=0)`;
        add(ch, { path: f, status, rank: approved > 0 ? 0 : 3 });
      }
    } else {
      for (const f of files.filter((f) => f.endsWith(".mp4"))) {
        const marker = readJson(f.replace(/\.mp4$/, ".json"));
        const verdict = marker?.verdict;
        const why = marker?.failed_stage ? `, failed ${marker.failed_stage}` : "";
        const status = verdict === "local-pass" ? `approved-review (queued for human${why})`
          : verdict === "local-fail" ? `rejected${why}` : "queued (no marker)";
        add(ch, { path: f, status, rank: verdict === "local-pass" ? 1 : 2 });
      }
    }
  }
  return byChannel;
}

function probeDuration(mp4) {
  return parseFloat(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", mp4]).trim());
}
function hasAudio(mp4) {
  return run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", mp4]).trim().length > 0;
}
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

function buildChannel(ch, src) {
  const duration = probeDuration(src.path);
  const audio = hasAudio(src.path);

  const clip = join(OUT, `ch-${ch}.mp4`);
  const start = (duration * 0.25).toFixed(2);
  run("ffmpeg", ["-y", "-v", "error", "-ss", start, "-i", src.path, "-t", String(CLIP_SECONDS),
    "-c:v", "libx264", "-crf", "20", "-preset", "fast", "-c:a", "aac", "-b:a", "128k", clip]);
  const clipSeconds = probeDuration(clip);

  // Seek per frame at the centre of each eighth: exactly 8 frames, evenly
  // spaced, never the black first/last frame. Pad keeps a 16:9 render's
  // aspect instead of stretching it to 9:16.
  const framesDir = join(OUT, `ch-${ch}-frames`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = ((i + 0.5) * duration / FRAME_COUNT).toFixed(3);
    run("ffmpeg", ["-y", "-v", "error", "-ss", t, "-i", src.path, "-frames:v", "1",
      "-vf", "scale=540:960:force_original_aspect_ratio=decrease,pad=540:960:(ow-iw)/2:(oh-ih)/2:color=black",
      join(framesDir, `frame-${String(i + 1).padStart(2, "0")}.png`)]);
  }
  const frames = readdirSync(framesDir).filter((f) => f.endsWith(".png")).sort().map((f) => join(framesDir, f));

  const contact = join(OUT, `ch-${ch}-contact.png`);
  run("montage", [...frames, "-tile", "4x2", "-geometry", "+6+6", "-background", "#1a1a1a",
    "-title", `ch-${ch}  ${src.status}`, "-fill", "#dddddd", "-pointsize", "28", contact]);

  log(`ch-${ch}: clip built (${clipSeconds.toFixed(1)}s), frames extracted (${frames.length}), contact sheet built`);
  return { duration, audio, size: statSync(src.path).size, clipSeconds, frames: frames.length };
}

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const byChannel = collect();
  const ids = [...new Set([...expectedChannels(), ...byChannel.keys()])].sort((a, b) => Number(a) - Number(b));
  const rows = [];
  const contacts = [];

  for (const ch of ids) {
    const slot = byChannel.get(ch);
    const cands = (slot?.candidates || []).sort((a, b) => a.rank - b.rank || statSync(b.path).size - statSync(a.path).size);
    if (!cands.length) {
      log(`ch-${ch}: no MP4 found, skipped`);
      const counts = slot?.qaCounts ? ` (qa-counts: ${JSON.stringify(slot.qaCounts)})` : slot ? "" : " (no artifacts for this channel)";
      rows.push(`| ${ch} | — | — | — | — | no MP4${counts} |`);
      continue;
    }
    const src = cands[0];
    try {
      const r = buildChannel(ch, src);
      contacts.push(join(OUT, `ch-${ch}-contact.png`));
      const others = cands.length > 1 ? ` (+${cands.length - 1} other MP4: ${cands.slice(1).map((c) => `${basename(c.path)} → ${c.status}`).join("; ")})` : "";
      rows.push(`| ${ch} | ${basename(src.path)} | ${r.duration.toFixed(1)}s | ${mb(r.size)} | ${r.audio ? "yes" : "no"} | ${src.status}${others} |`);
    } catch (e) {
      const msg = String(e.stderr || e.message).split("\n").filter(Boolean).slice(-1)[0] || "unknown error";
      log(`ch-${ch}: preview failed — ${msg}`);
      rows.push(`| ${ch} | ${basename(src.path)} | — | — | — | ${src.status}; preview build failed: ${msg.replace(/\|/g, "/")} |`);
    }
  }

  let master = "not built (no contact sheets)";
  if (contacts.length) {
    try {
      run("montage", [...contacts, "-tile", "3x2", "-geometry", "+10+10", "-background", "#1a1a1a", join(OUT, "ALL-CHANNELS.png")]);
      master = "built";
      log("master sheet built (ALL-CHANNELS.png)");
    } catch (e) {
      master = `FAILED: ${String(e.stderr || e.message).trim().split("\n").slice(-1)[0]}`;
      log(`master sheet ${master}`);
    }
  }

  const runId = process.env.GITHUB_RUN_ID || "local";
  writeFileSync(join(OUT, "README.md"), [
    `# Preview bundle — run ${runId}`,
    "",
    `Clips: ${CLIP_SECONDS}s from 25% into each video. Frames: ${FRAME_COUNT} evenly spaced at 540x960. Master sheet: ${master}.`,
    "",
    "Approval status is read from the uploaded artifacts (qa-counts.json for approved renders, the queue marker JSON for approved-review/rejected), not from the render log, which is not an artifact.",
    "",
    "| Channel | MP4 | Duration | Size | Audio | Approval status |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n"));

  console.log(readFileSync(join(OUT, "README.md"), "utf-8"));
  const found = [...byChannel.values()].reduce((n, s) => n + s.candidates.length, 0);
  if (!found) {
    console.error("::error::[preview] zero MP4s found across all channels");
    process.exit(1);
  }
  log(`done — ${contacts.length}/${ids.length} channels previewed, bundle at ${relative(ROOT, OUT)}`);
}

main();
