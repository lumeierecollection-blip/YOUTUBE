// Shared helpers for per-video scene plans. Word indexes refer to if/audio/<id>.vtt.
export function helpers(T) {
  const w = (i, text, o = {}) => ({ w: text, t: T[i], ...o });
  const run = (i0, texts, o = {}) => texts.map((tx, k) => w(i0 + k, tx, o));
  const bold = (i0, texts) => run(i0, texts, { sz: 56, wt: 700 });
  const t0 = (i) => Math.max(0, T[i] - 0.15);
  const sfxAt = (t, src, vol, dur) => ({ t, src, vol, dur });
  const whoosh = (i, kind = "swipe") => sfxAt(T[i] - 0.1, `sfx2/whoosh_${kind}.mp3`, 0.12, 0.6);
  const click = (i) => sfxAt(T[i] - 0.05, "sfx2/mouse_click.mp3", 0.12, 0.4);
  // card scenes: lead text above the card (y117), bold keyword below it (y595)
  const cardScene = (i, lead, kw, img, o = {}) => ({ i, els: [
    { k: "lines", lines: [{ y: 117, words: lead }, { y: 595, sz: 56, wt: 700, words: kw }] },
    { k: "card", img, y: 368, w: 462, h: o.h ?? 260, t: T[i], pos: o.pos },
  ] });
  const finish = (scenes, sfx) => ({
    scenes: scenes.map((s, k) => ({ t0: k === 0 ? 0 : t0(s.i), t1: k === scenes.length - 1 ? 999 : t0(scenes[k + 1].i), grid: !!s.grid, els: s.els })),
    sfx,
  });
  return { w, run, bold, t0, sfxAt, whoosh, click, cardScene, finish };
}
