/**
 * scenes — cut detection (ffmpeg scene score) + cadence (scripts/lib/novelty.mjs, reused, not reimplemented).
 * Python has no scenedetect here, so cuts come from select='gt(scene,T)' + showinfo pts_time.
 */
import { spawnSync } from "node:child_process";
import { decodeGray, noveltySeries, eventsOf, cadenceOf } from "../lib/novelty.mjs";

/** Pure: pts_time values (seconds) of every showinfo line in ffmpeg stderr. */
export function parseShowinfo(stderr) {
  const out = [];
  for (const line of String(stderr).split(/\r?\n/)) {
    if (!/Parsed_showinfo|showinfo/.test(line)) continue;
    const m = /pts_time:\s*([0-9.]+)/.exec(line);
    if (m) out.push(+(+m[1]).toFixed(3));
  }
  return out;
}

/** Pure: collapse cuts closer than minGap seconds into the first one. */
export function mergeCuts(times, minGap = 0.25) {
  const out = [];
  for (const t of [...times].sort((a, b) => a - b)) if (!out.length || t - out[out.length - 1] >= minGap) out.push(t);
  return out;
}

export function detectCuts(path, threshold = 0.3) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", path, "-an", "-vf", `scale=320:-2,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg scene detect failed for ${path}: ${String(r.stderr).slice(-400)}`);
  return mergeCuts(parseShowinfo(r.stderr));
}

/** Longest stretch with no scene cut, from the cut list (a "hold"). */
export function longestHold(cuts, duration) {
  const pts = [0, ...cuts, duration];
  let best = { start: 0, end: 0, length_s: 0 };
  for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > best.length_s) best = { start: pts[i - 1], end: pts[i], length_s: +(pts[i] - pts[i - 1]).toFixed(2) };
  return best;
}

export function analyzeScenes(path, { threshold = 0.3, duration } = {}) {
  const cuts = detectCuts(path, threshold);
  const g = decodeGray(path);
  const dur = duration || g.duration;
  const events = eventsOf(noveltySeries(g.frames, g.w, g.h));
  const cad = cadenceOf(events, dur);
  return {
    threshold, duration_s: +dur.toFixed(3),
    cuts, scene_cuts: cuts.length,
    shots: [0, ...cuts].map((s, i, a) => ({ index: i, start: s, end: +(i + 1 < a.length ? a[i + 1] : dur).toFixed(3) })),
    cadence: {
      events_per_10s: cad.events_per_10s, cuts_per_10s: cad.cuts_per_10s,
      p90_gap_s: cad.gap_s.p90, median_gap_s: cad.gap_s.median,
      longest_hold: longestHold(cuts, dur),
      source: "scripts/lib/novelty.mjs (edge novelty at 5 fps); cuts from ffmpeg scene score",
      novelty_cuts_at: events.filter((e) => e.cut).map((e) => e.t),
    },
    novelty_events: events,
  };
}
