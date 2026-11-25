// Helpers shared by the five storyboards. They only shorten authoring; every phrase is checked against the VTT by plan7-lib.
export const S = {
  whoosh: "sfx/whoosh.mp3", deep: "sfx2/whoosh_deep.mp3", hit: "sfx/hit.ogg", impact: "sfx/impact.ogg", low: "sfx2/impact_low.mp3",
  click: "sfx/click.ogg", soft: "sfx/click-soft.ogg", tick: "sfx/tick-tight.ogg", reveal: "sfx/reveal.ogg", sweep: "sfx/sweep.ogg",
  glitch: "sfx/glitch.ogg", thud: "sfx/thud.ogg", drop: "sfx/drop.ogg", confirm: "sfx/confirm.ogg", error: "sfx/error.ogg", bell: "sfx/bell.ogg",
  riser: "sfx2/riser.mp3", paper: "sfx2/paper.mp3", key: "sfx2/keyboard.mp3", mouse: "sfx2/mouse_click.mp3", shutter: "sfx2/shutter.mp3",
  scratch: "sfx2/record_scratch.mp3", clock: "sfx2/clock.mp3", switch: "sfx/switch.ogg",
};
export const sfx = (beat, src, purpose, o = {}) => ({ beat, src, purpose, volume: o.v ?? 0.55, dur: o.dur ?? 2.2, ...(o.cue ? { cue: o.cue } : {}), ...(o.at !== undefined ? { offset: o.at } : {}), ...(o.offset !== undefined ? { offset: o.offset } : {}) });
export const serif = (say, o = {}) => ({ say, role: "serif", x: 0.5, y: 0.72, size: 112, ...o });
export const kw = (say, bar, o = {}) => ({ say, role: "kw", bar, x: 0.5, y: 0.5, size: 150, ...o });
export const tile = (src, o = {}) => ({ src, x: 0.5, y: 0.4, w: 0.5, frame: "card", radius: 0.2, enter: "pop", ...o });
export const photo = (src, o = {}) => ({ src, x: 0.5, y: 0.42, w: 0.9, frame: "thin", enter: "cut", ...o });
