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
 *   AND (owner, 2026-10-09 — the loophole): NO DEVICE MAY APPEAR ON MORE THAN TWO CONSECUTIVE
 *   BEATS. Each device independently: a corner label on three beats in a row FAILS whatever the
 *   other two devices do. The rule above alone let ONE device ride every beat of the video.
 *
 * The three devices, read from the manifest (canvas-layout.js canvasManifest):
 *   label   — text is DRAWN at the top of the frame (labelsDrawn: any text box whose top edge is in
 *             the top zone, y < 620 — a kicker, a headline, a statement, a chart label, whatever the
 *             layout calls it), or the planner's corner label is drawn wherever it sits. It used to
 *             be canvas.chrome.label only, which is the planner's kicker: a headline pinned top-left
 *             is the same device on screen and counted as none (board 37837731824 ch-26: 7/9 beats
 *             draw top-of-frame text, chrome.label null on all 9, "0 labels");
 *   phrase  — a pull phrase / caption line is drawn, wherever it sits;
 *   typeLed — the beat is a TYPE-FULL / TYPE-SPLIT statement with no photo, cutout or hero.
 *
 * enforceChrome() is the pre-render legality pass: walking left to right it REMOVES the planner's
 * label, then its pull phrase, from a beat whose chrome would make a window fail. It never adds
 * chrome and never changes a composition (Gemini decides those; code only enforces the rule).
 * WHERE THAT STOPS: removal can only fix what the planner's chrome causes. Three type-led beats
 * in a row, or a headline drawn at the top of three beats in a row, are compositions — removal
 * cannot fix them, so enforceChrome reports a type-led run as `unfixable` and the manifest check
 * (Layer 1 template-window) fails the render. That is the rule working, not a bug to route around.
 */
export const DEVICES = ["label", "phrase", "typeLed"];

/** Top zone (canvas-layout.js ZONES.top): a text box whose top edge is above this is top-of-frame. */
export const TOP_ZONE_END = 620;

/**
 * The text a manifest canvas DRAWS at the top of the frame: the keys of every text box (the
 * manifest's `words` — every box the layout gave lines, the kicker included — plus the pull
 * phrase, which is drawn outside the layout's boxes) whose box starts in the top zone. Measured
 * from the renderer's own boxes, not from what the planner asked for, and not filtered by role:
 * "chart data" or "subject" text up there is still a label to a viewer.
 */
export function labelsDrawn(canvas) {
  const boxes = canvas?.boxes || {};
  const keys = [...Object.keys(canvas?.words || {}), ...(boxes.pull ? ["pull"] : [])];
  return keys.filter((k) => typeof boxes[k]?.y === "number" && boxes[k].y < TOP_ZONE_END);
}

/** Beats of a render manifest that draw a label (labelsDrawn non-empty, or the planner's label). */
export function labelCount(manifest) {
  return (manifest?.beats || []).filter((b) => devicesOf(b)?.label).length;
}

/** The devices of one manifest beat. */
export function devicesOf(beat) {
  const ch = beat?.canvas?.chrome;
  if (!ch) return null;
  return { label: !!ch.label || labelsDrawn(beat.canvas).length > 0, phrase: !!ch.pull_phrase, typeLed: !!ch.type_led };
}

/** The devices that repeat (in >= 2 of the 3 beats) in a window of device records. */
export function repeatsIn(win) {
  return DEVICES.filter((d) => win.filter((x) => x && x[d]).length >= 2);
}

/** The devices on EVERY beat of a full three-beat window: three consecutive beats. */
export function runsIn(win) {
  return win.length === 3 ? DEVICES.filter((d) => win.every((x) => x && x[d])) : [];
}

/** { pass, windows: [{ start, repeating, run }], beats } for a render manifest (or a device list). */
export function templateCheck(manifestOrDevices) {
  const devs = Array.isArray(manifestOrDevices) ? manifestOrDevices : (manifestOrDevices?.beats || []).map(devicesOf);
  if (devs.some((d) => d === null)) return { pass: false, windows: [], beats: devs.length, error: "a beat records no chrome (manifest predates the check)" };
  const windows = [];
  for (let i = 0; i + 2 < devs.length; i++) {
    const win = devs.slice(i, i + 3);
    const repeating = repeatsIn(win), run = runsIn(win);
    if (repeating.length > 1 || run.length) windows.push({ start: i, repeating, run });
  }
  return { pass: windows.length === 0, windows, beats: devs.length };
}

/**
 * Legality pass over planned beats. `items[i]` = { label: bool, phrase: bool, typeLed: bool }
 * from the planner's choices; returns { keep: [{ label, phrase }], dropped: [{ beat, device }],
 * unfixable: [{ start, device }] } — `unfixable` = a type-led run of three, which no removal of
 * chrome can break (see the header: the manifest check fails it).
 */
export function enforceChrome(items) {
  const cur = items.map((x) => ({ ...x }));
  const dropped = [];
  // Only what removal can fix counts as bad here: a type-led run is a composition, and treating
  // it as bad would strip every label and phrase around it for nothing.
  const bad = (i) => {
    for (let s = Math.max(0, i - 2); s <= i && s + 2 < cur.length; s++) {
      const win = cur.slice(s, s + 3);
      if (repeatsIn(win).length > 1 || runsIn(win).some((d) => d !== "typeLed")) return true;
    }
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
  const unfixable = [];
  for (let s = 0; s + 2 < cur.length; s++) if (runsIn(cur.slice(s, s + 3)).includes("typeLed")) unfixable.push({ start: s, device: "typeLed" });
  return { keep: cur.map(({ label, phrase }) => ({ label, phrase })), dropped, unfixable };
}
