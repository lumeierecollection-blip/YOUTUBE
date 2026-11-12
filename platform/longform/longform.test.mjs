// node --test platform/longform/longform.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { checkLongScript, loadFormats } from "./script-gate.mjs";
import { flattenScenes, mergeNarrations, youtubeChapters } from "./assemble.mjs";

const claim = (id, src, excerpt) => ({ claim_id: id, source_id: src, source_url: `https://example.org/${src}`, excerpt });
const S = (text, ids = ["c1"], extra = {}) => ({ text, scene: 0, claim_ids: ids, ...extra });
const filler = (n, tag) => Array.from({ length: n }, (_, i) => S(`The archive records entry ${tag}-${i} and the dates that go with it in detail for the year 1453 and after.`));
function pkg(over = {}) {
  const quotes = ["We sail at dawn", "The city is lost", "No ship returned", "The doge has fallen"].map((q, i) => S(`One witness wrote this line about the day number ${i}.`, ["q" + i], { quote: { source_id: "s2", text: q, speaker: "A chronicler" } }));
  const chapters = Array.from({ length: 10 }, (_, i) => ({ id: `ch${i}`, title: `Chapter ${i}`, scenes: [{ kind: "map" }], sentences: [...filler(6, i), ...(i === 0 ? quotes : [])] }));
  chapters[9].sentences.push(S("Would you have stayed in the city?", [], { allow_no_claim: true, editorial: "question for the comments" }));
  chapters[0].sentences.splice(1, 0, S("What really happened that morning?", [], { allow_no_claim: true, editorial: "central question" }));
  return { channel: "hidden-past", title: "The Entire History of Somewhere", central_question: "What really happened?", claims: [claim("c1", "s1", "x"), ...[0, 1, 2, 3].map((i) => claim("q" + i, "s2", "chronicle: We sail at dawn. The city is lost. No ship returned. The doge has fallen."))], chapters, ...over };
}

test("formats file has the four channels and sane ranges", () => {
  const f = loadFormats();
  for (const k of ["hidden-past", "ai-tested", "rival-lines", "court-and-spotlight"]) { const c = f.channels[k]; assert.ok(c, k); assert.ok(c.minutes[1] <= 10 && c.minutes[0] < c.minutes[1] && c.wpm[0] < c.wpm[1] && c.chapters[0] <= c.chapters[1], k); }
  assert.equal(f.frame.width, 1920); assert.equal(f.shared.quotes_required, 4);
});

test("a well-formed long script passes", () => {
  const r = checkLongScript(pkg());
  assert.deepEqual(r.errors, []); assert.ok(r.stats.words > 6 * 150, `words ${r.stats.words}`);
});

test("too short, too few quotations and an unknown claim are refused", () => {
  const p = pkg(); p.chapters = p.chapters.slice(0, 9).map((c) => ({ ...c, sentences: c.sentences.slice(0, 3) })); p.chapters.push({ id: "end", title: "End", scenes: [{ kind: "x" }], sentences: [S("Unknown thing happened here today.", ["nope"]), S("Another line here about it.", ["c1"]), S("And one more about that.", ["c1"])] });
  const e = checkLongScript(p).errors.join("\n");
  assert.match(e, /at least 6 min/); assert.match(e, /quotations/); assert.match(e, /claim "nope"/); assert.match(e, /no question for the comments/);
});

test("a quotation must be inside a fetched excerpt from its own source", () => {
  const p = pkg(); p.chapters[0].sentences.find((s) => s.quote).quote.text = "Words nobody wrote";
  assert.match(checkLongScript(p).errors.join("\n"), /quotation not found/);
});

test("two sentence endings in one line are refused (voice timing counts them)", () => {
  const p = pkg(); p.chapters[3].sentences[2].text = "It fell. Then it rose again in 1460.";
  assert.match(checkLongScript(p).errors.join("\n"), /one sentence-ending mark/);
});

test("Shorts-only channels are refused rather than guessed", () => {
  assert.match(checkLongScript({ ...pkg(), channel: "dopamine-loop" }).errors[0], /no long-form format/);
});

test("chapter narrations merge onto one clock with the pause between them", () => {
  const m = mergeNarrations([{ seconds: 10, words: [{ text: "a", start: 1, end: 1.5 }], sentences: [{ text: "a.", start: 1, end: 1.5 }] }, { seconds: 5, words: [{ text: "b", start: 0.5, end: 1 }], sentences: [{ text: "b.", start: 0.5, end: 1 }] }], 0.6);
  assert.equal(m.seconds, 15.6); assert.deepEqual(m.chapterStarts, [0, 10.6]); assert.equal(m.words[1].start, 11.1); assert.equal(m.sentences[1].end, 11.6);
});

test("scenes flatten with global indexes and an unused scene is refused", () => {
  const ch = [{ title: "A", scenes: [{ kind: "x" }, { kind: "y" }], sentences: [{ text: "a.", scene: 0 }, { text: "b.", scene: 1 }] }, { title: "B", scenes: [{ kind: "z" }], sentences: [{ text: "c.", scene: 0 }] }];
  const f = flattenScenes(ch); assert.deepEqual(f.sceneOfSentence, [0, 1, 2]); assert.deepEqual(f.chapterFirstScene, [0, 2]); assert.equal(f.scenes[2].id, "c2s1");
  ch[1].scenes.push({ kind: "never" }); assert.throws(() => flattenScenes(ch), /scenes with no sentence: c2s2/);
});

test("YouTube chapter list starts at 0:00 and refuses chapters under 10 seconds", () => {
  const ch = [{ title: "Intro" }, { title: "Middle" }, { title: "End" }];
  assert.equal(youtubeChapters(ch, [0, 75.4, 3700], 3900), "0:00 Intro\n1:15 Middle\n1:01:40 End");
  assert.throws(() => youtubeChapters(ch, [0, 75, 80], 300), /at least 10 s/);
  assert.throws(() => youtubeChapters(ch.slice(0, 2), [0, 75], 300), /at least 3/);
});
