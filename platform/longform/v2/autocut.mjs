// Rhythm tools shared by the long-form episodes. The references change the picture every ~2.5 s and are in motion the whole time; a data scene held for 10+ s is the main
// thing that made ours look different. autoCut lays 1-3 short full-frame clip cutaways over every data beat (sizes estimated from the narration length); montage makes a beat
// out of several quick shots. Clips come from the episode's FOOTAGE pool (Pixabay Content License, fetched by fetch-footage.mjs); a missing clip is dropped by render-episode.
export const vid = (id) => `lf2/footage/${id}.mp4`;
export const montage = (ids, dur = 3, o = {}) => ({ type: "montage", shots: [...ids, ...(o.fallback ? [o.fallback] : [])].map((id, i) => ({ video: vid(id), dur, ss: ((i * 1.7) % 4) + (o.ss || 0), zoom: i % 2 ? [1.12, 1.0] : [1.0, 1.12], pos: o.pos || "50% 50%", ...(o.fallback && id === o.fallback ? { fallback: true } : {}) })), ...(o.extra || {}) });
const DATA = new Set(["number", "bars", "grid", "kicks", "goal", "order", "figures", "hero", "map", "scorecard", "timeline"]);

/** beats: the episode's beats; pool: clip ids in rotation; wps: narration words per second (estimate of the beat length). */
export function autoCut(beats, pool, { wps = 2.4, first = 0.24, len = 2.6, skip = new Set(), types = new Set() } = {}) {
  let k = 0;
  for (const b of beats) {
    const sc = b.scene;
    if (!sc || skip.has(b.id) || !(DATA.has(sc.type) || types.has(sc.type)) || sc.video) continue;
    const d = b.vo.split(/\s+/).length / wps, cuts = [];
    if (d >= 5) cuts.push(Math.max(2.0, d * first));
    if (d >= 9) cuts.push(d * 0.55);
    if (d >= 14) cuts.push(d * 0.82);
    sc.cutaways = cuts.map((at, i) => { const id = pool[(k++) % pool.length]; return { at: +at.toFixed(1), dur: len - (i === 2 ? 0.2 : 0), video: vid(id), ss: (k * 1.3) % 4, zoom: k % 2 ? [1.0, 1.12] : [1.12, 1.0], pos: "50% 50%" }; });
  }
  return beats;
}
