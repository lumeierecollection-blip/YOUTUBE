// Pure checks for what a render DRAWS on top of the pictures (text overlays, the source-credit line), how it
// composites alpha, and whether two renders agree frame by frame. Plain data in, problem strings out; the
// stills and the video are read by scripts/check-multi-png-render.mjs and judged on GitHub, not here.

// Every number the checker judges a render by, with the reason it was chosen.
// status "untuned": derived from how the fixture is built (white ground, ~3 s beats, flat saturated colours), never
// yet measured on a GitHub render. The first smoke run reports each measured value beside its limit. A limit moves
// only on that evidence, and a failing run is read as a finding, not loosened until it passes.
// status "fixed": follows from the renderer's own code, not from a guess.
export const THRESHOLDS = {
  blackMean: { value: 12, status: "untuned", why: "mean 0-255 below this is a black frame; the ground is white and no fixture colour is that dark (render-sequence.mjs classifyFrame)" },
  blankMeanAbove: { value: 245, status: "untuned", why: "a flat near-white frame (std < 2) is blank; allowed in the first moment of a beat only (classifyFrame)" },
  maxBlankSeconds: { value: 1.0, status: "untuned", why: "a beat is about 3 s and elements land within the first second (frameRunProblems)" },
  flickerJump: { value: 25, status: "untuned", why: "a one-sample luminance spike larger than this between calm neighbours is a flash, not a cut (flickerProblems)" },
  signatureDistance: { value: 40, status: "untuned", why: "RGB distance from an image's own colour; resampling and the darker grid lines stay inside it" },
  signatureShareMin: { value: 0.002, status: "untuned", why: "0.2% of a 540x960 still is about 1,000 px; a missing image gives 0, even a small one gives more" },
  magentaDistance: { value: 60, status: "untuned", why: "RGB distance from the (255,0,255) hidden under alpha 0; correct compositing yields none" },
  magentaShareMax: { value: 0.001, status: "untuned", why: "about 500 px of a 540x960 still: a bleed halo along a disc edge is ~1 px wide, an ignored alpha channel is thousands" },
  alphaIgnoredShare: { value: 0.01, status: "untuned", why: "above this the transparent area itself is magenta: alpha was dropped, not just filtered badly" },
  ringBlendShareMin: { value: 0.0005, status: "untuned", why: "the alpha-128 ring over the ground leaves pixels midway between the image colour and the ground" },
  ringBlendTolerance: { value: 28, status: "untuned", why: "RGB distance from that midpoint" },
  creditColour: { value: [136, 136, 136], status: "fixed", why: "the credit line is #888888 (full-canvas.jsx)" },
  creditColourDistance: { value: 24, status: "untuned", why: "antialiased glyph edges blend away from #888888" },
  creditPixelsMin: { value: 12, status: "untuned", why: "20 px type at half scale leaves dozens of near-#888 pixels; a missing line leaves none" },
  creditPixelsMaxWhenHidden: { value: 3, status: "untuned", why: "before local frame 40 the line has opacity 0; stray matches from the picture are tolerated up to this" },
  creditVisibleFromFrame: { value: 56, status: "fixed", why: "the line fades in over local frames 40-48 (full-canvas.jsx); at or after frame 56 it is fully on" },
  creditHiddenUntilFrame: { value: 38, status: "fixed", why: "at or before local frame 38 its opacity is 0" },
  textEdgeStep: { value: 48, status: "untuned", why: "luminance step between horizontally adjacent pixels that counts as an edge" },
  textEdgeGain: { value: 0.02, status: "untuned", why: "text adds strokes: the share of edge pairs in the headline box rises by at least 2 points versus the same beat drawn without the headline" },
  videoFrameChangedLevel: { value: 16, status: "fixed", why: "a pixel counts as changed above this step" },
  videoFrameMeanDiffMax: { value: 0.5, status: "untuned", why: "mean absolute difference (0-255) of the same decoded frame in two renders; encoder noise is a fraction of a level, a timing difference is several" },
  videoFrameChangedShareMax: { value: 0.002, status: "untuned", why: "share of pixels differing by more than 16 levels between the same frame of two renders" },
};

// ── geometry ───────────────────────────────────────────────────────────────────────────────────────────────
// A manifest box is in 1080x1920 canvas px; a still is the same frame at any scale. Integer rect, clamped to the image.
export function boxToRect(box, imgW, imgH, pad = 4, canvasW = 1080, canvasH = 1920) {
  const sx = imgW / canvasW, sy = imgH / canvasH;
  const x0 = Math.max(0, Math.floor(box.x * sx) - pad), y0 = Math.max(0, Math.floor(box.y * sy) - pad);
  const x1 = Math.min(imgW, Math.ceil((box.x + box.w) * sx) + pad), y1 = Math.min(imgH, Math.ceil((box.y + box.h) * sy) + pad);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// The bottom-right "Source: ..." line sits 40 px in from the right and bottom, in 20 px type. Fractions of the frame, with margin.
export function creditRect(imgW, imgH) {
  const x0 = Math.floor(imgW * 0.6), y0 = Math.floor(imgH * 0.95);
  return { x: x0, y: y0, w: Math.ceil(imgW * 0.975) - x0, h: Math.ceil(imgH * 0.99) - y0 };
}

export function boxProblems(box, canvasW = 1080, canvasH = 1920, tol = 2) {
  if (!box) return ["no box"];
  const out = [];
  if (!(box.w > 0 && box.h > 0)) out.push(`box ${box.w}x${box.h} has no area`);
  if (box.x < -tol || box.y < -tol || box.x + box.w > canvasW + tol || box.y + box.h > canvasH + tol) out.push(`box (${box.x},${box.y} ${box.w}x${box.h}) leaves the ${canvasW}x${canvasH} frame`);
  return out;
}

const fold = (s) => String(s || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "");

// What a beat is meant to draw must be in the boxes the layout produced (that is what gets painted).
export function drawnTextProblems(manifestCanvas, want) {
  const out = [];
  const boxes = manifestCanvas?.boxes || {};
  const all = Object.values(boxes).map((b) => (b?.lines || []).join(" ")).join(" ");
  if (want.headline) {
    if (!fold(all).includes(fold(want.headline))) out.push(`headline "${want.headline}" is in no drawn box (boxes hold: "${all.slice(0, 120)}")`);
    const hb = boxes.headline || boxes.statement;
    if (!hb) out.push("no headline or statement box in the manifest");
    else for (const p of boxProblems(hb)) out.push(`headline ${p}`);
  }
  const got = manifestCanvas?.source_credit ?? null;
  if (want.source_credit && got !== want.source_credit) out.push(`source_credit is ${JSON.stringify(got)} in the manifest, expected ${JSON.stringify(want.source_credit)}`);
  if (!want.source_credit && got) out.push(`source_credit ${JSON.stringify(got)} appears on a beat that has none`);
  return out;
}

// ── pixels ─────────────────────────────────────────────────────────────────────────────────────────────────
// raw: Buffer of w*h*channels (8-bit); rect: {x,y,w,h} or null for the whole frame.
const eachInRect = (w, h, rect, fn) => {
  const r = rect || { x: 0, y: 0, w, h };
  for (let y = r.y; y < Math.min(h, r.y + r.h); y++) for (let x = r.x; x < Math.min(w, r.x + r.w); x++) fn(x, y);
};
const lum = (raw, o) => 0.299 * raw[o] + 0.587 * raw[o + 1] + 0.114 * raw[o + 2];

// Share of horizontally adjacent pixel pairs whose luminance differs by more than `step`. Text strokes raise it.
export function edgeDensity(raw, channels, w, h, rect, step = THRESHOLDS.textEdgeStep.value) {
  let edges = 0, pairs = 0;
  eachInRect(w, h, rect, (x, y) => {
    if (x + 1 >= w) return;
    pairs++;
    if (Math.abs(lum(raw, (y * w + x) * channels) - lum(raw, (y * w + x + 1) * channels)) > step) edges++;
  });
  return pairs ? edges / pairs : 0;
}

export function colourCount(raw, channels, w, h, rect, colour, dist) {
  let n = 0;
  eachInRect(w, h, rect, (x, y) => {
    const o = (y * w + x) * channels;
    if (Math.hypot(raw[o] - colour[0], raw[o + 1] - colour[1], raw[o + 2] - colour[2]) <= dist) n++;
  });
  return n;
}

export function colourShare(raw, channels, w, h, colour, dist, rect = null) {
  const area = rect ? rect.w * rect.h : w * h;
  return area ? colourCount(raw, channels, w, h, rect, colour, dist) / area : 0;
}

// The colour an alpha-128 pixel of `sig` leaves over an opaque `ground`.
export const blend = (sig, ground, a = 128 / 255) => sig.map((v, i) => Math.round(v * a + ground[i] * (1 - a)));

export function parseHex(s) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s || "").trim());
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
}

// Stills of a cutout beat: magenta must not show (alpha dropped, or a bleed halo), and the alpha-128 ring must leave blended pixels.
export function alphaProblems({ magentaShare, ringShare, groundKnown }, T = THRESHOLDS) {
  const out = [];
  if (magentaShare > T.alphaIgnoredShare.value) out.push(`${(magentaShare * 100).toFixed(2)}% of the frame is the colour hidden under alpha 0: the alpha channel was ignored`);
  else if (magentaShare > T.magentaShareMax.value) out.push(`${(magentaShare * 100).toFixed(3)}% of the frame is near the colour hidden under alpha 0: a bleed halo at the cutout edge`);
  if (groundKnown && ringShare < T.ringBlendShareMin.value) out.push(`only ${(ringShare * 100).toFixed(3)}% of the frame is the half-transparent ring blended with the ground (need >= ${(T.ringBlendShareMin.value * 100).toFixed(3)}%): the alpha edge was not composited`);
  return out;
}

// visible: count of near-#888 pixels in the credit corner at a moment after the fade-in (null if no sampled moment is late enough);
// hidden: the same count at a moment before it (null if none is early enough).
export function creditProblems(visible, hidden, T = THRESHOLDS) {
  const out = [];
  if (visible == null) out.push("no sampled moment is late enough in the beat to see the credit line");
  else if (visible < T.creditPixelsMin.value) out.push(`credit line not visible late in the beat: ${visible} #888 pixels in its corner (need >= ${T.creditPixelsMin.value})`);
  if (hidden != null && hidden > T.creditPixelsMaxWhenHidden.value) out.push(`${hidden} credit-coloured pixels in its corner before it should fade in (limit ${T.creditPixelsMaxWhenHidden.value})`);
  return out;
}

export function textGainProblems(withText, without, T = THRESHOLDS) {
  const gain = withText - without;
  return gain >= T.textEdgeGain.value ? [] : [`headline box adds ${(gain * 100).toFixed(2)} points of edge density over the same beat without the text (need >= ${(T.textEdgeGain.value * 100).toFixed(1)})`];
}

// Which sampled moments are late/early enough for the credit line, from the beat's length in frames.
export function creditMoments(durationFrames, moments, T = THRESHOLDS) {
  const local = (m) => Math.round(durationFrames * m);
  return {
    visible: moments.find((m) => local(m) >= T.creditVisibleFromFrame.value) ?? null,
    hidden: moments.find((m) => local(m) <= T.creditHiddenUntilFrame.value) ?? null,
  };
}

// ── video, frame level ─────────────────────────────────────────────────────────────────────────────────────
// a, b: Buffers of same-size gray frames back to back. Per frame: mean absolute difference and share of pixels over `level`.
export function frameDiffs(a, b, frameSize, level = THRESHOLDS.videoFrameChangedLevel.value) {
  const n = Math.min(Math.floor(a.length / frameSize), Math.floor(b.length / frameSize));
  const out = [];
  for (let f = 0; f < n; f++) {
    let sum = 0, changed = 0;
    for (let p = 0; p < frameSize; p++) {
      const d = Math.abs(a[f * frameSize + p] - b[f * frameSize + p]);
      sum += d;
      if (d > level) changed++;
    }
    out.push({ mean: sum / frameSize, changed: changed / frameSize });
  }
  return out;
}

export function videoDeterminismProblems(diffs, framesA, framesB, T = THRESHOLDS) {
  const out = [];
  if (framesA !== framesB) out.push(`the two renders decode to ${framesA} and ${framesB} frames`);
  if (!diffs.length) out.push("no frames were compared");
  diffs.forEach((d, i) => {
    if (d.mean > T.videoFrameMeanDiffMax.value) out.push(`sample ${i}: mean difference ${d.mean.toFixed(2)} between the two renders (limit ${T.videoFrameMeanDiffMax.value})`);
    if (d.changed > T.videoFrameChangedShareMax.value) out.push(`sample ${i}: ${(d.changed * 100).toFixed(3)}% of pixels differ by more than ${T.videoFrameChangedLevel.value} levels (limit ${(T.videoFrameChangedShareMax.value * 100).toFixed(2)}%)`);
  });
  return out;
}
