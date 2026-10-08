/**
 * template-check.js — the owner's definition of "no template" (2026-10-08), run on the render
 * manifest, not by eye:
 *
 *   ACROSS ANY THREE CONSECUTIVE BEATS, no more than ONE of
 *   { corner label, bottom phrase, type-led layout } may repeat.
 *
 * A device "repeats" in a window when two or more of the window's three beats carry it. Two or
 * more devices repeating in any window = the template is still there = FAIL. The check is not
 * loosened to pass a render; the render is changed.
 *
 * The three devices, read from manifest canvas.chrome (canvas-layout.js canvasManifest):
 *   label   — a corner label (kicker) is drawn, wherever it sits;
 *   phrase  — a pull phrase / caption line is drawn, wherever it sits;
 *   typeLed — the beat is a TYPE-FULL / TYPE-SPLIT statement with no photo, cutout or hero.
 *
 * enforceChrome() is the pre-render legality pass: walking left to right it REMOVES the planner's
 * label, then its pull phrase, from a beat whose chrome would make a window fail. It never adds
 * chrome and never changes a composition (Gemini decides those; code only enforces the rule).
 * Because only typeLed is left once both are removed, the rule can always be met by removal.
 */
export const DEVICES = ["label", "phrase", "typeLed"];

/** The devices of one manifest beat. */
export function devicesOf(beat) {
  const ch = beat?.canvas?.chrome;
  if (!ch) return null;
  return { label: !!ch.label, phrase: !!ch.pull_phrase, typeLed: !!ch.type_led };
}

/** The devices that repeat (in >= 2 of the 3 beats) in a window of device records. */
export function repeatsIn(win) {
  return DEVICES.filter((d) => win.filter((x) => x && x[d]).length >= 2);
}

/** { pass, windows: [{ start, repeating }], beats } for a render manifest (or a device list). */
export function templateCheck(manifestOrDevices) {
  const devs = Array.isArray(manifestOrDevices) ? manifestOrDevices : (manifestOrDevices?.beats || []).map(devicesOf);
  if (devs.some((d) => d === null)) return { pass: false, windows: [], beats: devs.length, error: "a beat records no chrome (manifest predates the check)" };
  const windows = [];
  for (let i = 0; i + 2 < devs.length; i++) {
    const repeating = repeatsIn(devs.slice(i, i + 3));
    if (repeating.length > 1) windows.push({ start: i, repeating });
  }
  return { pass: windows.length === 0, windows, beats: devs.length };
}

/**
 * Legality pass over planned beats. `items[i]` = { label: bool, phrase: bool, typeLed: bool }
 * from the planner's choices; returns { keep: [{ label, phrase }], dropped: [{ beat, device }] }.
 */
export function enforceChrome(items) {
  const cur = items.map((x) => ({ ...x }));
  const dropped = [];
  const bad = (i) => {
    for (let s = Math.max(0, i - 2); s <= i && s + 2 < cur.length; s++) if (repeatsIn(cur.slice(s, s + 3)).length > 1) return true;
    // A window that is not yet complete at the tail is judged on the beats it has.
    return cur.length < 3 && repeatsIn(cur).length > 1;
  };
  for (let i = 0; i < cur.length; i++) {
    for (const d of ["label", "phrase"]) {
      if (!bad(i)) break;
      if (cur[i][d]) { cur[i][d] = false; dropped.push({ beat: i, device: d }); }
    }
    // Still bad: an earlier beat's chrome in the same window is the other repeat — drop it there.
    for (let j = i - 1; j >= Math.max(0, i - 2) && bad(i); j--) {
      for (const d of ["label", "phrase"]) if (bad(i) && cur[j][d]) { cur[j][d] = false; dropped.push({ beat: j, device: d }); }
    }
  }
  return { keep: cur.map(({ label, phrase }) => ({ label, phrase })), dropped };
}
