/**
 * novelty — WHEN DOES SOMETHING NEW APPEAR ON SCREEN? Measured from decoded pixels, never from a manifest.
 *
 * Why this and not a frame difference: the renderer's universal sway (visual/sway.js, +-30 px) and a camera pan move EVERY pixel, so a plain
 * pixel-diff reads a frame with nothing new on it as "moving 98% of the time" (measured on the board 38528287535 videos), while a new word on a
 * white ground changes almost no pixels and a cut between two white frames reads as no cut at all. So each frame's EDGES are compared with the
 * previous frame's edges DILATED by a tolerance: an edge with no counterpart within TOL px is something that APPEARED (or, the other way round,
 * LEFT). A slide of a few pixels scores ~0; a new word, a new picture, a cut or a pop scores > 0.
 *
 * Owner, 2026-10-15: "you're cloning the concepts behind it ... the laws that govern it ... how quickly every X seconds there is a change".
 * config/clone-grammar.json holds the numbers this measures on the reference videos; scripts/gate-clone-cadence.mjs holds a render to them.
 *
 * Where it stops: it sees edges, not meaning. A shimmer, grain or a video background of constant motion reads as novelty (the references' live-action
 * footage does), and a new element that is a flat colour change with no edge reads as nothing. It is a measure of CADENCE, not of quality.
 */
import { spawnSync } from "node:child_process";

export const NOVELTY = Object.freeze({
  RATE: 5,        // analysis frames per second: a pop is not shorter than 200 ms
  WIDTH: 120,     // analysis width in px: 1080 canvas px / 120 = 9 px per analysis px, so a +-30 px sway is ~3 px
  TOL: 4,         // dilation radius in analysis px: drift up to ~36 canvas px is NOT novelty
  EDGE: 28,       // gradient magnitude (0-255) that makes an edge pixel
  EVENT: 0.02,    // fraction of edge pixels with no counterpart nearby that counts as "something new"
  CUT: 0.18,      // ... and this fraction is a whole-frame change (a cut)
  MIN_GAP_FRAMES: 2, // events closer than 0.4 s are one event (a pop is one event, not three)
});

/** Edge mask of one gray frame (Uint8Array w*h, 0/1): |dx| + |dy| > EDGE. */
export function edgeMask(g, w, h, edge = NOVELTY.EDGE) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = x > 0 ? Math.abs(g[i] - g[i - 1]) : 0;
      const dy = y > 0 ? Math.abs(g[i] - g[i - w]) : 0;
      if (dx + dy > edge) m[i] = 1;
    }
  }
  return m;
}

/** Square dilation by r: separable max filter, same result as OR-ing every (dx, dy) shift in [-r, r]. */
export function dilate(m, w, h, r = NOVELTY.TOL) {
  const t = new Uint8Array(w * h), o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (m[y * w + k]) { v = 1; break; }
      t[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (t[k * w + x]) { v = 1; break; }
      o[y * w + x] = v;
    }
  }
  return o;
}

const count = (m) => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };

/** Novelty of each frame against the one before it: (edges that appeared + edges that left) / the larger edge count (floor 40). Length frames-1. */
export function noveltySeries(frames, w, h, opts = {}) {
  const o = { ...NOVELTY, ...opts };
  const E = frames.map((f) => edgeMask(f, w, h, o.EDGE));
  const D = E.map((e) => dilate(e, w, h, o.TOL));
  const out = [];
  for (let i = 1; i < E.length; i++) {
    let appeared = 0, left = 0;
    for (let k = 0; k < E[i].length; k++) {
      if (E[i][k] && !D[i - 1][k]) appeared++;
      if (E[i - 1][k] && !D[i][k]) left++;
    }
    out.push((appeared + left) / Math.max(40, count(E[i]), count(E[i - 1])));
  }
  return out;
}

/** Events from a novelty series: rising crossings of EVENT at least MIN_GAP_FRAMES apart. Times are seconds into the video. */
export function eventsOf(series, opts = {}) {
  const o = { ...NOVELTY, ...opts };
  const events = [];
  let last = -1e9;
  series.forEach((v, i) => {
    if (v >= o.EVENT && i - last >= o.MIN_GAP_FRAMES) {
      events.push({ t: +((i + 1) / o.RATE).toFixed(2), novelty: +v.toFixed(3), cut: v >= o.CUT });
      last = i;
    }
  });
  return events;
}

const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) * q / 100, f = Math.floor(k), c = Math.min(s.length - 1, f + 1); return s[f] + (s[c] - s[f]) * (k - f); };
const r2 = (x) => (x == null ? null : +x.toFixed(2));

/** The cadence laws of a timeline of events over `duration` seconds. */
export function cadenceOf(events, duration) {
  const times = events.map((e) => e.t);
  const gaps = [];
  let prev = 0;
  for (const t of times) { gaps.push(t - prev); prev = t; }
  gaps.push(Math.max(0, duration - prev));
  const cuts = events.filter((e) => e.cut).map((e) => e.t);
  const shots = [];
  prev = 0;
  for (const t of cuts) { shots.push(t - prev); prev = t; }
  shots.push(Math.max(0, duration - prev));
  return {
    duration_s: r2(duration),
    events: events.length, events_per_10s: r2(events.length / duration * 10),
    cuts: cuts.length, cuts_per_10s: r2(cuts.length / duration * 10),
    gap_s: { median: r2(pct(gaps, 50)), p90: r2(pct(gaps, 90)), max: r2(Math.max(...gaps)) },
    shot_s: { median: r2(pct(shots, 50)), p90: r2(pct(shots, 90)), max: r2(Math.max(...shots)) },
  };
}

/** Decode a video to gray frames at RATE fps, WIDTH px wide. */
export function decodeGray(path, opts = {}) {
  const o = { ...NOVELTY, ...opts };
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-show_entries", "format=duration", "-of", "json", path], { encoding: "utf8" });
  if (probe.status !== 0) throw new Error(`ffprobe failed for ${path}: ${probe.stderr}`);
  const j = JSON.parse(probe.stdout);
  const vw = +j.streams[0].width, vh = +j.streams[0].height, duration = +j.format.duration;
  const w = o.WIDTH, h = Math.round(w * vh / vw);
  const dec = spawnSync("ffmpeg", ["-v", "error", "-i", path, "-vf", `fps=${o.RATE},scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  if (dec.status !== 0) throw new Error(`ffmpeg failed for ${path}: ${dec.stderr}`);
  const buf = dec.stdout, n = Math.floor(buf.length / (w * h));
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(new Uint8Array(buf.buffer, buf.byteOffset + i * w * h, w * h));
  return { frames, w, h, duration, orientation: vh > vw ? "vertical" : "landscape" };
}

/** Measure a video file: { orientation, events: [...], ...cadence }. */
export function measureVideo(path, opts = {}) {
  const { frames, w, h, duration, orientation } = decodeGray(path, opts);
  const events = eventsOf(noveltySeries(frames, w, h, opts), opts);
  return { file: path.split(/[\\/]/).pop(), orientation, ...cadenceOf(events, duration), events_at: events.map((e) => e.t), cuts_at: events.filter((e) => e.cut).map((e) => e.t) };
}
