// FRAME REVIEW IS THE GATE (owner, 2026-10-09). A TEMPLATE_MONOCULTURE verdict holds the video:
// backupAudit's forceReject (rejected/, never approved-review/), so neither the local audit nor its
// manifest template-window check can overrule it. And the review is never skipped: a LOW-risk local
// auditor verdict used to skip it and ship the video "approved without Gemini".
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { frameReviewVerdict, frameReviewHold, frameReviewRuns } from "../render-and-qa.js";
import { templateCheck } from "../template-check.js";

const dir = mkdtempSync(join(tmpdir(), "frame-review-gate-"));
let n = 0;
const reportFile = (r) => { const p = join(dir, `r${n++}.json`); writeFileSync(p, JSON.stringify(r)); return p; };
const mono = { status: "FAIL", overall_score: 5, headline_test: { headline_beat_count: 6, total_beats: 9, percent: 66, pass: false, monoculture: true } };

test("TEMPLATE_MONOCULTURE from the review is a HOLD (forceReject), not a backup-audit question", () => {
  const fr = frameReviewVerdict(reportFile({ pipelineVerdict: "REJECTED", pipelineReason: "TEMPLATE_MONOCULTURE — 66% headline-dominated beats", wholeVideoResult: mono }));
  assert.equal(fr.pass, false);
  assert.equal(fr.monoculture, true);
  assert.deepEqual(frameReviewHold(fr), { forceReject: true, check: "TEMPLATE_MONOCULTURE" });
});

test("a report written before pipelineVerdict existed is held the same way", () => {
  const fr = frameReviewVerdict(reportFile({ summary: { critical: 0, high: 0 }, totalFrames: 9, wholeVideoResult: mono }));
  assert.equal(fr.pass, false);
  assert.deepEqual(frameReviewHold(fr), { forceReject: true, check: "TEMPLATE_MONOCULTURE" });
});

test("a passing manifest template check does not overrule it: the hold is decided by the review alone", () => {
  // A manifest that passes template-window (no device on three beats in a row, no two repeating)...
  const devices = [{ label: true, phrase: false, typeLed: false }, { label: false, phrase: false, typeLed: true }, { label: true, phrase: false, typeLed: false }];
  assert.equal(templateCheck(devices).pass, true);
  // ...and the review's monoculture still holds the video.
  const fr = frameReviewVerdict(reportFile({ pipelineVerdict: "REJECTED", pipelineReason: "TEMPLATE_MONOCULTURE", wholeVideoResult: mono }));
  assert.equal(frameReviewHold(fr).forceReject, true);
});

test("only the review's own REJECTED counts: an untrusted provider's monoculture reading is not a hold", () => {
  const fr = frameReviewVerdict(reportFile({ pipelineVerdict: "PROVIDER_UNAVAILABLE", pipelineReason: "ollama answered", wholeVideoResult: { ...mono, provider: "ollama" } }));
  assert.equal(fr.pass, false);
  assert.deepEqual(frameReviewHold(fr), {});
});

test("other failures keep their existing route (no hold); APPROVED passes", () => {
  assert.deepEqual(frameReviewHold(frameReviewVerdict(reportFile({ pipelineVerdict: "NEEDS IMPROVEMENT", pipelineReason: "4 HIGH issues" }))), {});
  assert.deepEqual(frameReviewHold(frameReviewVerdict(null)), {});
  assert.equal(frameReviewVerdict(reportFile({ pipelineVerdict: "APPROVED", pipelineReason: "ok" })).pass, true);
});

test("the review is never skipped: a LOW-risk local auditor verdict no longer stands in for it", () => {
  // The old condition was `audit.code === 0 && geminiNeeded && provider`, with geminiNeeded false
  // for a LOW-risk local verdict — so the review did not run and the loop shipped the video.
  assert.equal(frameReviewRuns({ auditOk: true, provider: true, localAudit: { gemini_required: false, risk: { level: "LOW" } } }), true);
  assert.equal(frameReviewRuns({ auditOk: false, provider: true }), false);   // the pixel gate failed first
  assert.equal(frameReviewRuns({ auditOk: true, provider: false }), false);   // no provider: REVIEW_FAILED path, never a pass
});
