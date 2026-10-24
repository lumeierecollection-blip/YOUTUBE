// Pure checks on a rendered test plan and its stills. Every function takes plain data, so the tests feed it
// synthetic faults; scripts/check-multi-png-render.mjs feeds it the real render's plan.json and pixels.
import { normalize } from "node:path";

// Beat ids t0..t(n-1), contiguous and unique; each beat starts where the previous one ends.
export function sequenceProblems(beats) {
  const out = [];
  const seen = new Set();
  let expectStart = 0;
  (beats || []).forEach((b, i) => {
    if (b.beat_id !== `t${i}`) out.push(`beat ${i}: id "${b.beat_id}" where "t${i}" was expected (gap, reorder or duplicate)`);
    if (seen.has(b.beat_id)) out.push(`beat ${i}: duplicate id "${b.beat_id}"`);
    seen.add(b.beat_id);
    if (!(b.duration_frames > 0)) out.push(`beat ${i}: duration ${b.duration_frames} is not positive`);
    if (b.start_frame !== expectStart) out.push(`beat ${i}: starts at frame ${b.start_frame}, previous beat ended at ${expectStart}`);
    expectStart = b.start_frame + b.duration_frames;
  });
  return out;
}

export function stillName(beat, pct) { return `beat-${beat}-${Math.round(pct * 100)}.png`; }

// Exactly one still per (beat, moment): none missing, none unexpected, none twice.
export function stillProblems(files, nBeats, moments) {
  const want = new Set();
  for (let i = 0; i < nBeats; i++) for (const m of moments) want.add(stillName(i, m));
  const counts = new Map();
  for (const f of files) if (/^beat-\d+-\d+\.png$/.test(f)) counts.set(f, (counts.get(f) || 0) + 1);
  const out = [];
  for (const w of want) if (!counts.has(w)) out.push(`missing still ${w}`);
  for (const [f, n] of counts) {
    if (!want.has(f)) out.push(`unexpected still ${f}`);
    if (n > 1) out.push(`still ${f} listed ${n} times`);
  }
  return out;
}

const keyOf = (p) => normalize(String(p)).normalize("NFC").toLowerCase();
const assetsOf = (c) => [c?.photo?.asset, ...(c?.concept_visuals || []).map((v) => v?.asset)].filter(Boolean);

// collisions: two DIFFERENT paths that name one file once case and Unicode form are folded (a collision on a
// case-insensitive or normalising filesystem). consecutive: the same picture on adjacent beats (reported, not an error).
export function assetCollisions(beats) {
  const byKey = new Map();
  const consecutive = [];
  let prev = new Set();
  (beats || []).forEach((b, i) => {
    const now = new Set();
    for (const a of assetsOf(b.scene?.canvas || b.c)) {
      now.add(a);
      const k = keyOf(a);
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k).add(a);
      if (prev.has(a)) consecutive.push({ beat: i, asset: a });
    }
    prev = now;
  });
  const collisions = [...byKey.values()].filter((s) => s.size > 1).map((s) => [...s]);
  return { collisions, consecutive };
}

// A frame is "black" when it is nearly all dark, "blank" when it is one flat bright colour. The test ground is white,
// so a flat white frame is legitimate for a moment before the first element lands; only a LONG run of them is a fault.
export function classifyFrame({ mean, std }) {
  if (mean < 12) return "black";
  if (mean > 245 && std < 2) return "blank";
  return "ok";
}

// stats: [{mean, std}] per sampled frame, `fps` samples per second.
export function frameRunProblems(stats, fps, { maxBlankSeconds = 1.0 } = {}) {
  const out = [];
  let run = 0;
  const limit = Math.ceil(maxBlankSeconds * fps);
  stats.forEach((s, i) => {
    const k = classifyFrame(s);
    if (k === "black") out.push(`sample ${i} (${(i / fps).toFixed(2)}s): black frame (mean ${s.mean.toFixed(1)})`);
    run = k === "blank" ? run + 1 : 0;
    if (run === limit + 1) out.push(`sample ${i} (${(i / fps).toFixed(2)}s): flat blank frame for more than ${maxBlankSeconds}s`);
  });
  return out;
}

// Flicker = a one-sample spike: a frame differs from BOTH neighbours by more than `jump` while the neighbours agree.
// A hard cut changes the level once and stays there, so it is not a spike.
export function flickerProblems(means, { jump = 25, agree = 8 } = {}) {
  const out = [];
  for (let i = 1; i < means.length - 1; i++) {
    const a = means[i - 1], b = means[i], c = means[i + 1];
    if (Math.abs(a - c) <= agree && Math.abs(b - a) > jump && Math.abs(b - c) > jump) out.push(`sample ${i}: luminance ${b.toFixed(1)} between ${a.toFixed(1)} and ${c.toFixed(1)}`);
  }
  return out;
}

// Share of pixels within `dist` (Euclidean RGB) of `sig`. raw: Buffer of w*h*channels.
export function signatureShare(raw, channels, sig, dist = 40) {
  let hit = 0;
  const n = Math.floor(raw.length / channels);
  for (let p = 0; p < n; p++) {
    const o = p * channels;
    if (Math.hypot(raw[o] - sig[0], raw[o + 1] - sig[1], raw[o + 2] - sig[2]) <= dist) hit++;
  }
  return n ? hit / n : 0;
}
