// node scripts/test-entity-sync.mjs — word-level sync for entity visuals (src/skills/remotion-render/visual/entity-sync.js).
import { entityAnchor, scheduleEntityPop, normWord, digitsOf, POP_IN } from "../src/skills/remotion-render/visual/entity-sync.js";
import { popGroups } from "../src/skills/remotion-render/visual/pop-groups.js";
import { canvasLayout } from "../src/skills/remotion-render/visual/canvas-layout.js";

let bad = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`); };
// Words with timings in frames from the beat start (30 fps), as render.js builds beat.spoken.
const words = (s, at = 0, per = 9) => s.split(" ").map((t, i) => ({ text: t, from: at + i * per, to: at + (i + 1) * per - 1 }));

eq("normWord drops the possessive and punctuation", [normWord("Azerbaijan's"), normWord("Aliyev,"), normWord("courthouse.")], ["azerbaijan", "aliyev", "courthouse"]);
eq("digitsOf reads a figure", [digitsOf("$387.5 million"), digitsOf("$347"), digitsOf("1,400"), digitsOf("none")], ["3875", "347", "1400", null]);

// The measured case (CI run 37082751699 ch-9 beat 1): "Azerbaijan's President Ilham Aliyev has unveiled ..."
const aliyev = { composition: "PORTRAIT", photo: { asset: "x.jpg", entity: "Ilham Aliyev" }, anchor_word: "Aliyev" };
const sp = words("Azerbaijan's President Ilham Aliyev has unveiled a blueprint for the country's next phase", 0, 12);
const s1 = scheduleEntityPop(aliyev, sp, 265);
eq("portrait: anchor 'Aliyev' found, pop starts 6 frames before the word", [s1.kind, s1.word, s1.from, s1.frame], ["portrait", "Aliyev", 36, 36 - POP_IN]);
eq("the pop completes before the word ends", s1.frame + POP_IN <= s1.to, true);
eq("no planner anchor: the entity's last name word first", entityAnchor({ composition: "PORTRAIT", photo: { entity: "Ilham Aliyev" } }).words, ["aliyev", "ilham"]);
eq("a planner anchor that is not part of what is SHOWN is not used", entityAnchor({ ...aliyev, anchor_word: "blueprint" }).words, ["aliyev", "ilham"]);

// Place photo, first occurrence wins.
const miami = { composition: "SCENE-FULL", photo: { entity: "Miami" }, anchor_word: "Miami" };
eq("first occurrence of the anchor", scheduleEntityPop(miami, words("Miami voted and Miami won", 0, 10), 120).from, 0);
eq("an anchor at frame 0 pops at frame 0 (never negative)", scheduleEntityPop(miami, words("Miami voted", 0, 10), 120).frame, 0);

// A word at the very end of the beat pops 8 frames earlier, and never past dur - 15.
const late = scheduleEntityPop(miami, [{ text: "Then", from: 0, to: 80 }, { text: "Miami.", from: 110, to: 119 }], 120);
eq("a word in the last 0.5 s pops 8 frames earlier, within the beat", [late.frame, late.frame <= 120 - 15], [Math.min(110 - POP_IN - 8, 105), true]);

// Not found: reported, never a failure.
eq("anchor not spoken -> missing (the renderer pops at the beat start)", scheduleEntityPop(aliyev, words("The president spoke today"), 120).missing, "aliyev");

// Number and cutout.
eq("a hero number matches its spoken digits", scheduleEntityPop({ composition: "NUMBER-FULL", data: { value: "$387.5 million" } }, words("Bitget lost $387.5 million in hours", 0, 10), 150).word, "$387.5");
eq("a small number matches its spoken word", scheduleEntityPop({ composition: "NUMBER-FULL", data: { value: "7" } }, words("The trial lasted seven weeks", 0, 10), 150).word, "seven");
eq("a hero cutout pops on its noun", scheduleEntityPop({ composition: "TYPE-FULL", concept_visuals: [{ name: "door key", class: "cutout" }] }, words("Keep a spare key safe", 0, 10), 150).word, "key");
eq("a plain statement has no entity", scheduleEntityPop({ composition: "TYPE-FULL", headline: "x" }, words("Anything at all"), 90), null);

// The compositor: only the entity's group moves; the headline keeps frame 0.
{
  const c = { visual_type: "PHOTO", composition: "PORTRAIT", headline: "Ilham Aliyev", photo: { asset: "x.jpg", entity: "Ilham Aliyev", view: "person", w: 1000, h: 1333 }, entity_pop: { frame: 30, kind: "portrait" } };
  const g = popGroups(c, canvasLayout(c));
  eq("portrait beat: headline group at 0, portrait group at its word", g.map((x) => `${x.key}@${x.at}`), ["top@0", "middle@29"]);
  const s = { visual_type: "PHOTO", composition: "SCENE-FULL", headline: "The city held its vote", photo: { asset: "x.jpg", entity: "Miami", view: "scene" }, entity_pop: { frame: 45, kind: "photo" } };
  eq("full-bleed beat: header at 0, the photo on its word", popGroups(s, canvasLayout(s)).map((x) => `${x.key}@${x.at}`), ["top@0", "photo@44"]);
  const n = { ...c, entity_pop: undefined };
  eq("no entity_pop: the old order (beat-level)", popGroups(n, canvasLayout(n)).map((x) => `${x.key}@${x.at}`), ["top@0", "middle@8"]);
}

console.log(bad ? `${bad} FAILED` : "all pass");
process.exit(bad ? 1 : 0);
