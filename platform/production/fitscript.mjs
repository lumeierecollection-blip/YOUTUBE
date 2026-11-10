/**
 * Fits a script to the 35 to 40 second rule at the voice's own measured pace. Never changes the voice's speed: it chooses which lines,
 * and which longer or shorter wording of a line, to keep. Slots are in story order; each has one or more variants (longest first) and may be
 * optional. The configuration whose estimated length is closest to the target and inside the window wins.
 */
const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
const textOf = (v) => (typeof v === "string" ? v : v.text);

export function fitScript({ slots, wpm, targetSeconds = 37, minSeconds = 35, maxSeconds = 39.2, tail = 0.45 }) {
  // One sentence-ending mark per line: the voice timing and the scene map count sentences by their ending marks.
  for (const sl of slots) for (const v of sl.variants) if (/[.!?](?=\s+\S)/.test(textOf(v).replace(/(Mr|Dr|St)\.\s/g, "")) || /[.!?]["')]?[.!?]/.test(textOf(v))) throw new Error(`slot "${sl.id}" has more than one sentence ending in: ${textOf(v)}`);
  if (!(wpm > 40 && wpm < 260)) throw new Error(`implausible measured pace: ${wpm} wpm`);
  const optional = slots.map((s, i) => (s.optional ? i : -1)).filter((i) => i >= 0);
  let best = null;
  const total = 2 ** optional.length;
  const choose = (idx, on, pick) => {
    if (idx === slots.length) {
      const lines = slots.map((s, i) => (on.has(i) || !s.optional ? textOf(s.variants[pick[i]]) : null)).filter(Boolean);
      const w = words(lines.join(" "));
      const seconds = (w / wpm) * 60 + tail;
      const dist = Math.abs(seconds - targetSeconds), inside = seconds >= minSeconds && seconds <= maxSeconds;
      const score = (inside ? 0 : 1000) + dist + (optional.length - on.size) * 0.01;
      if (!best || score < best.score) best = { score, on: new Set(on), pick: [...pick], words: w, seconds };
      return;
    }
    for (let v = 0; v < slots[idx].variants.length; v++) { pick[idx] = v; choose(idx + 1, on, pick); }
  };
  for (let mask = 0; mask < total; mask++) {
    const on = new Set(optional.filter((_, k) => mask & (1 << k)));
    choose(0, on, new Array(slots.length).fill(0));
  }
  const sentences = slots.map((s, i) => ({ s, i })).filter(({ s, i }) => best.on.has(i) || !s.optional).map(({ s, i }) => { const v = s.variants[best.pick[i]]; return { text: textOf(v), scene: s.scene, claim_ids: (typeof v === "string" ? s.claim_ids : v.claim_ids) || [], ...(s.allow_no_claim ? { allow_no_claim: true, editorial: s.editorial || "question or conclusion, not a new claim" } : {}) }; });
  return { sentences, words: best.words, estimated_seconds: Math.round(best.seconds * 10) / 10, inside_window: best.seconds >= minSeconds && best.seconds <= maxSeconds, kept: [...best.on].map((i) => slots[i].id).concat(slots.filter((s) => !s.optional).map((s) => s.id)) };
}

/** Keeps only the scenes the chosen sentences use and renumbers `scene` to match. */
export function compactScenes({ scenes, sentences }) {
  const used = [...new Set(sentences.map((s) => s.scene))].sort((a, b) => a - b);
  const map = new Map(used.map((old, i) => [old, i]));
  return { scenes: used.map((old) => scenes[old]), sentences: sentences.map((s) => ({ ...s, scene: map.get(s.scene) })) };
}
