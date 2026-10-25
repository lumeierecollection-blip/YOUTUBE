// quote-verify: a quote is kept only when its words are in the raw search text, near its speaker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyQuotes } from "../lib/quote-verify.mjs";

const CORPUS = `Title: Fed holds rates
URL: https://example.com/a
Chair Jerome Powell told reporters on Wednesday: “We are not going to be in a hurry to cut rates until we see more good data.” The committee voted 10-2.`;
const q = (text, speaker = "Jerome Powell") => ({ text, speaker, source_name: "Example News", source_url: "https://example.com/a" });

test("a verbatim quote near its speaker is kept (curly vs straight quotes do not matter)", () => {
  const r = verifyQuotes([q("We are not going to be in a hurry to cut rates until we see more good data.")], CORPUS);
  assert.equal(r.length, 1);
  assert.equal(r[0].speaker, "Jerome Powell");
});
test("a paraphrase is dropped", () => {
  assert.equal(verifyQuotes([q("We will not hurry to cut interest rates until the data improves a lot.")], CORPUS).length, 0);
});
test("a quote attributed to someone the text does not place near it is dropped", () => {
  assert.equal(verifyQuotes([{ ...q("We are not going to be in a hurry to cut rates until we see more good data."), speaker: "Janet Yellen", source_name: "Nowhere Daily" }], CORPUS).length, 0);
});
test("too short, ellipsis and missing speaker are dropped", () => {
  assert.equal(verifyQuotes([q("not going to be in")], CORPUS).length, 0);
  assert.equal(verifyQuotes([q("We are not going to be ... until we see more good data.")], CORPUS).length, 0);
  assert.equal(verifyQuotes([{ ...q("We are not going to be in a hurry to cut rates until we see more good data."), speaker: "" }], CORPUS).length, 0);
});
