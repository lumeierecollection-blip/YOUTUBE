// Helpers shared by the five storyboards. They only shorten authoring; every phrase is checked against the VTT by plan7-lib.
// Every entry is a real recording (Freesound via Openverse, CC0; sources in assets/sfx2/SOURCES.json and the library config).
// The old Kenney UI beeps (assets/sfx/*.ogg) are no longer referenced.
export const S = {
  whoosh: "sfx2/whoosh_quick.mp3", deep: "sfx2/whoosh_deep.mp3", hit: "sfx2/boom_hit.mp3", impact: "sfx2/slam.mp3", low: "sfx2/impact_low.mp3",
  click: "sfx2/mouse_click.mp3", soft: "sfx2/mouse_click.mp3", tick: "sfx2/clock.mp3", reveal: "sfx2/rev_cymbal.mp3", sweep: "sfx2/whoosh_swipe.mp3",
  glitch: "sfx2/glitch_vhs.mp3", corrupt: "sfx2/glitch_corrupt.mp3", thud: "sfx2/thud_medium.mp3", drop: "sfx2/bass_drop.mp3", confirm: "sfx2/chime.mp3", error: "sfx2/error_beep.mp3", bell: "sfx2/chime.mp3",
  riser: "sfx2/riser.mp3", paper: "sfx2/paper.mp3", key: "sfx2/keyboard.mp3", mouse: "sfx2/mouse_click.mp3", shutter: "sfx2/shutter.mp3",
  scratch: "sfx2/record_scratch.mp3", clock: "sfx2/clock.mp3", switch: "sfx2/switch_click.mp3",
};
export const sfx = (beat, src, purpose, o = {}) => ({ beat, src, purpose, volume: o.v ?? 0.55, dur: o.dur ?? 2.2, ...(o.cue ? { cue: o.cue } : {}), ...(o.at !== undefined ? { offset: o.at } : {}), ...(o.offset !== undefined ? { offset: o.offset } : {}) });
export const serif = (say, o = {}) => ({ say, role: "serif", x: 0.5, y: 0.72, size: 112, ...o });
export const kw = (say, bar, o = {}) => ({ say, role: "kw", bar, x: 0.5, y: 0.5, size: 150, ...o });
export const tile = (src, o = {}) => ({ src, x: 0.5, y: 0.4, w: 0.5, frame: "card", radius: 0.2, enter: "pop", ...o });
export const photo = (src, o = {}) => ({ src, x: 0.5, y: 0.42, w: 0.9, frame: "thin", enter: "cut", ...o });
