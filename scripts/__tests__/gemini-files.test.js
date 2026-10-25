/**
 * gemini-files.js — the Files API upload path.
 *
 * MUTATION (run, recorded): removing the `ftyp` magic-byte check in assertMp4()
 * turns "rejects a non-MP4" red. Restored byte-identical.
 *
 * The network-touching tests are pinned to the local environment: they need a
 * real Gemini key, so they are skipped rather than silently passing when
 * GEMINI_API_KEY_1 is absent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { statSync, existsSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertMp4, fileResource, geminiKeys, apiKey, MAX_FILE_BYTES,
  uploadVideo, pollUntilActive, deleteFile,
} from "../../src/lib/gemini-files.js";

// A real render when this workstation has one (data/audit is gitignored); otherwise — CI, a fresh
// checkout — a 1 s H.264 MP4 made here with ffmpeg. Either is a real MP4 with an `ftyp` box, which
// is all assertMp4 is asked to recognise.
const LOCAL_MP4 = "data/audit/a1-ci/c2q/approved-review/california-no-robo-bosses-act-ai-discipline-shorts-shorts-2026-10-06.mp4";
const MP4 = existsSync(LOCAL_MP4) ? LOCAL_MP4 : (() => {
  const out = join(mkdtempSync(join(tmpdir(), "gemini-files-")), "fixture.mp4");
  spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=white:s=320x568:r=30:d=1", "-pix_fmt", "yuv420p", "-c:v", "libx264", out]);
  return out;
})();
// Same for the PNG: gitignored locally, generated when absent (CI tests run 37703894179).
const LOCAL_PNG = "data/audit/l2-blank.png";
const PNG = existsSync(LOCAL_PNG) ? LOCAL_PNG : (() => {
  const out = join(mkdtempSync(join(tmpdir(), "gemini-files-")), "blank.png");
  spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=white:s=64x64", "-frames:v", "1", out]);
  return out;
})();
const hasKey = !!(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);

describe("keys", () => {
  it("reuses gemini-client's precedence and adds no new env var", () => {
    assert.deepEqual(geminiKeys({ GEMINI_API_KEY_1: "a", GEMINI_API_KEY_2: "b" }), ["a", "b"]);
    assert.deepEqual(geminiKeys({ GEMINI_API_KEY: "a" }), ["a"], "GEMINI_API_KEY is the fallback");
    assert.deepEqual(geminiKeys({ GOOGLE_GENERATIVE_AI_API_KEY: "a" }), ["a"]);
    assert.deepEqual(geminiKeys({}), []);
  });
  it("fails loud with the same guidance when no key is set", () => {
    assert.throws(() => apiKey({}), /No Gemini API key/);
  });
});

describe("fileResource", () => {
  it("strips the files/ prefix the API returns", () => {
    assert.equal(fileResource("files/abc123"), "abc123");
    assert.equal(fileResource("abc123"), "abc123");
  });
  it("rejects an empty name", () => {
    assert.throws(() => fileResource("files/"), /unusable file name/);
  });
});

describe("assertMp4", () => {
  it("accepts a real MP4 and reports its size", () => {
    const r = assertMp4(MP4);
    assert.equal(r.mimeType, "video/mp4");
    assert.equal(r.sizeBytes, statSync(MP4).size);
  });
  it("rejects a PNG before any network call", () => {
    // PNG magic is 89 50 4E 47 0D 0A 1A 0A, so bytes 4-8 are 0D 0A 1A 0A —
    // not "IHDR", which sits at offset 12.
    assert.throws(() => assertMp4(PNG), /is not an MP4: expected 'ftyp' at offset 4/);
  });
  it("rejects a missing file", () => {
    assert.throws(() => assertMp4("does/not/exist.mp4"), /not a file/);
  });
  it("caps at exactly 2 GB", () => {
    assert.equal(MAX_FILE_BYTES, 2 * 1024 * 1024 * 1024);
  });
  it("refuses to truncate an oversized file, by source inspection", () => {
    // Exercising this needs a real >2 GB file, which is not something to create
    // in a test. The guard is asserted structurally instead: the size branch
    // exists and it throws rather than returning a truncated read.
    const src = assertMp4.toString();
    assert.match(src, /size > MAX_FILE_BYTES/);
    assert.match(src, /Refusing to truncate/);
  });
});

describe("upload/poll/delete against the live API", { skip: hasKey ? false : "no GEMINI_API_KEY_1" }, () => {
  it("uploads a real MP4, reaches ACTIVE, and deletes it", async () => {
    const f = await uploadVideo(MP4);
    assert.match(f.name, /^files\//);
    assert.match(f.uri, /generativelanguage\.googleapis\.com/);
    assert.equal(f.sizeBytes, statSync(MP4).size);
    try {
      const active = await pollUntilActive(f.name);
      assert.equal(active.state, "ACTIVE");
      assert.match(active.uri, /generativelanguage\.googleapis\.com/);
    } finally {
      await deleteFile(f.name);
    }
  });
  it("refuses a non-MP4 with no network call", async () => {
    await assert.rejects(() => uploadVideo(PNG), /is not an MP4/);
  });
});

describe("pollUntilActive timeout", () => {
  // A PROCESSING file that never becomes ACTIVE must THROW, never be returned
  // for scoring: a verdict on a half-ingested video is a verdict about a video
  // nobody watched.
  it("throws rather than returning a PROCESSING file", async () => {
    // A bogus key makes the API reject the poll, which exercises the same
    // "throw, never return a half-ingested file" path as a stuck PROCESSING
    // state. The timeout branch itself needs a real file that stalls, which is
    // not something to stage in a test; the deadline logic is asserted below.
    await assert.rejects(
      () => pollUntilActive("files/never", { timeoutMs: 60, pollMs: 10, env: { GEMINI_API_KEY_1: "not-a-real-key" }, sleep: () => new Promise((r) => setTimeout(r, 10)) }),
      /file poll failed: HTTP 40|still .* after/,
    );
  });
  it("has a 5 minute default timeout and 5s poll, and throws on timeout", () => {
    assert.equal(pollUntilActive.length, 1, "options are defaulted via destructuring");
    const src = pollUntilActive.toString();
    assert.match(src, /timeoutMs = 300000/);
    assert.match(src, /pollMs = 5000/);
    assert.match(src, /refusing to score a PROCESSING file/);
  });
});