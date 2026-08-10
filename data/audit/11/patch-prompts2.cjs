// One-shot prompt patch, insert-after semantics (next = ADDITIONAL text only).
// Anchors are exact substrings; \n in anchors matches either LF or CRLF.
const fs = require("fs");

let fail = false;
function patch(file, edits) {
  let t = fs.readFileSync(file, "utf8");
  const nl = t.includes("\r\n") ? "\r\n" : "\n";
  for (const { old, next } of edits) {
    const variants = [old, old.replace(/\n/g, "\r\n")];
    let hit = null;
    for (const v of variants) {
      const i = t.indexOf(v);
      if (i !== -1) { hit = { i, v }; break; }
    }
    if (!hit) {
      console.error(`MISSING anchor in ${file}: ${JSON.stringify(old.slice(0, 70))}`);
      fail = true;
      return;
    }
    const { i, v } = hit;
    t = t.slice(0, i + v.length) + next.replace(/\n/g, nl) + t.slice(i + v.length);
    console.log(`patched ${file} @ ${JSON.stringify(v.slice(0, 40))}...`);
  }
  fs.writeFileSync(file, t);
}

patch("prompts/research.md", [
  {
    old: "states, or convert units** — copy the number as reported.",
    next:
      "\n- A figure that appears in any `key_fact` must ALSO appear in `numbers[]` — including compound figures: a \"6-3 ruling\" is two entries (`value: 6` and `value: 3`, both `unit: \"votes\"`, same `source_url`), a \"150-meter radius\" is one entry (`value: 150`, `unit: \"meters\"`). The script gate can only chart values that appear in `numbers[]`, so a figure you omit silently caps what the video can show.",
  },
]);

patch("prompts/style-contract.md", [
  {
    old: "  Don't pad the list with unused sources, and don't cite a source that isn't\n  in the research.",
    next:
      "\n- Only `numbers[]` entries are chartable. A figure that appears in a\n  key_fact's prose but is missing from the research's `numbers[]` can be\n  spoken in voiceover, but must never become a beat's `data.series` value —\n  the script gate rejects chart values that don't appear in `numbers[].value`.",
  },
  {
    old: "reveal lands, closing type) in the context JSON — follow those, not a\ngeneric structure.",
    next:
      "\n\nTarget voiceover word counts (spoken text only):\n- `shorts`: 150–280 words (about 60–108s at the style's WPM).\n- `longform`: match the `script_template`'s section count — a 5-section\n  longform lands about 700–950 words at the style's WPM.\nCount the voiceover words before finishing; if you're outside the range,\nadjust the section voiceovers.",
  },
  {
    old: "- Check your channel's `concepts` allocation (if given in context): primary\n  archetypes should be ≥50% of the video's beats, secondary ≤35%, excluded\n  archetypes 0%.",
    next:
      "\n- Check your channel's `concepts` allocation (if given in context): primary\n  archetypes must be 50% or more of the video's beats, secondary 35% or\n  less, excluded 0%. Before finishing, COUNT the beats by archetype and\n  adjust the beat mix until the split meets these bounds — it's\n  gate-checked.",
  },
]);

patch("prompts/write-script.md", [
  {
    old: "provided JSON Schema exactly — nothing outside it.",
    next:
      "\n\n## Before you finish\n\n- Every value in any beat's `data.series` exists exactly in the research's\n  `numbers[].value` — if it isn't there, it must not be charted.\n- Voiceover word count is inside the format range in the style contract.\n- For motion-graphics: primary archetypes 50% or more of beats, secondary\n  35% or less, excluded 0%.\n- `sources_used` has 3 or more URLs that actually appear in the research's\n  `key_facts`/`numbers`, and every one is used by something you wrote.",
  },
]);

if (fail) {
  console.error("ABORTED — nothing written for the failed file.");
  process.exit(1);
}
console.log("ALL PATCHED");
