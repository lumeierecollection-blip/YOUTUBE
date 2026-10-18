// A Pixabay DOWNLOAD that answers 429 is the rate limit, not a refused picture (run 39128017438: nearly every candidate 429'd, ch-44 got 0 props on 8
// beats). The download is retried, the candidate is not counted as rejected, and the concept is not remembered as "rejected this run" — a later beat
// fetches it again. Run against a fake Pixabay (global fetch), no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.PIXABAY_API_KEY = "test";
process.env.CUTOUT_PACE_MS = "0";
process.env.CUTOUT_429_WAIT_MS = "1";
const require = createRequire(import.meta.url);
const { fetchCutoutForBeat, _resetRunCache } = require("../fetch-cutout-once.cjs");

function fakePixabay() {
  const calls = { search: 0, download: 0 };
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://pixabay.com/api/")) {
      calls.search++;
      return { ok: true, status: 200, json: async () => ({ hits: [{ largeImageURL: "https://pixabay.com/get/abc_1280.jpg", tags: "paycheck, salary", imageWidth: 2000, imageHeight: 1400, pageURL: "https://pixabay.com/photos/x" }] }) };
    }
    calls.download++;
    return { ok: false, status: 429, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  return calls;
}

test("a rate-limited download is retried, then reported as never checked — not as a rejected picture", async () => {
  const real = globalThis.fetch;
  const lines = [], log = console.log;
  console.log = (m) => lines.push(String(m));
  try {
    _resetRunCache();
    const calls = fakePixabay();
    const r = await fetchCutoutForBeat({ concept: "paycheck", channel: 1, beat_index: 3, spec: { max_candidates: 3 } });
    assert.equal(r, null);
    assert.equal(calls.download, 3, "the download was not retried (1 try + 2 retries)");
    assert.ok(lines.some((l) => /NOT CHECKED \(download rate-limited/.test(l)), lines.join("\n"));
    assert.ok(!lines.some((l) => /REJECTED \(download failed, HTTP 429\)/.test(l)), "a 429 was logged as a rejected candidate");
  } finally { globalThis.fetch = real; console.log = log; }
});

test("a concept that only hit the rate limit is fetched again by the next beat, not 'already rejected this run'", async () => {
  const real = globalThis.fetch;
  const lines = [], log = console.log;
  console.log = (m) => lines.push(String(m));
  try {
    _resetRunCache();
    const calls = fakePixabay();
    await fetchCutoutForBeat({ concept: "paycheck", channel: 1, beat_index: 3, spec: { max_candidates: 3 } });
    const before = calls.download;
    await fetchCutoutForBeat({ concept: "paycheck", channel: 1, beat_index: 5, spec: { max_candidates: 3 } });
    assert.ok(calls.download > before, "the second beat did not try the download again");
    assert.ok(!lines.some((l) => /already rejected this run/.test(l)), "the rate limit was remembered as a rejection");
  } finally { globalThis.fetch = real; console.log = log; }
});
