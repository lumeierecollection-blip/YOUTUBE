// scripts/ci/strict-prescreen-pick.sh: for a strict-visual channel, a topic whose research has nothing to draw is swapped for a candidate that has,
// BEFORE the writer is called. The real script runs with a fake `node` (no network, no model) and the real jq/bash (CI has both).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, chmodSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../ci/strict-prescreen-pick.sh", import.meta.url));
const have = (cmd) => { try { return spawnSync(cmd, ["--version"], { encoding: "utf8" }).status === 0; } catch { return false; } };
const skip = have("bash") && have("jq") ? false : "bash and jq are needed (present on the CI runner)";

const FAKE_NODE = `#!/usr/bin/env bash
echo "$*" >> "$CALLS"
case "$1" in
  scripts/strict-prescreen.mjs)
    case "$2" in
      --is-strict) echo "\${STRICT:-true}"; exit 0 ;;
      --score) echo "\$(cat "$FAKE/score-$4" 2>/dev/null || echo "0 0")"; exit 0 ;;
      *) [ -f "$FAKE/ok-$3" ] && exit 0 || exit 3 ;;
    esac ;;
  scripts/reserve-topic-single.js) [ -f "$FAKE/dup-$4" ] && exit 1 || exit 0 ;;
  scripts/ollama-agent.js)
    cat > /dev/null
    SLUG=""; while [ $# -gt 0 ]; do [ "$1" = "--video-id" ] && SLUG="$2"; shift; done
    [ -f "$FAKE/noresearch-$SLUG" ] && exit 1
    echo '{"structured_output":{"key_facts":[{"fact":"a"},{"fact":"b"},{"fact":"c"}]}}'; exit 0 ;;
  scripts/gate-research.js) exit 0 ;;
esac
exit 0
`;

function run({ current = "mit", ok = [], scores = {}, dups = [], noresearch = [], strict = "true", max } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pick-"));
  const fake = join(dir, "fake");
  const bin = join(dir, "bin");
  mkdirSync(fake); mkdirSync(bin); mkdirSync(join(dir, "data", "research", "48"), { recursive: true });
  writeFileSync(join(bin, "node"), FAKE_NODE);
  chmodSync(join(bin, "node"), 0o755);
  for (const s of ok) writeFileSync(join(fake, `ok-${s}`), "");
  for (const s of dups) writeFileSync(join(fake, `dup-${s}`), "");
  for (const s of noresearch) writeFileSync(join(fake, `noresearch-${s}`), "");
  for (const [s, v] of Object.entries(scores)) writeFileSync(join(fake, `score-${s}`), v);
  const topicFile = join(dir, "channel-topic.json");
  writeFileSync(topicFile, JSON.stringify({ slug: current, topic: `Topic ${current}`, angle: `angle ${current}` }));
  const topicsFile = join(dir, "topics.json");
  writeFileSync(topicsFile, JSON.stringify({ topics: ["mit", "jll", "nurses", "pilots", "chairs"].map((s) => ({ slug: s, topic: `Topic ${s}`, angle: `angle ${s}` })) }));
  const calls = join(dir, "calls.log");
  writeFileSync(calls, "");
  const r = spawnSync("bash", [SCRIPT], { cwd: dir, encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CHANNEL_ID: "48", CALLS: calls, FAKE: fake, STRICT: strict, TOPIC_FILE: topicFile, TOPICS_FILE: topicsFile, ...(max ? { PRESCREEN_MAX_ALTERNATES: String(max) } : {}) } });
  const result = { status: r.status, out: r.stdout + r.stderr, topic: JSON.parse(readFileSync(topicFile, "utf8")), calls: readFileSync(calls, "utf8").split("\n").filter(Boolean), dir };
  return result;
}
const clean = (r) => rmSync(r.dir, { recursive: true, force: true });

test("a topic that already has something to draw is kept, with no research spent", { skip }, () => {
  const r = run({ current: "jll", ok: ["jll"] });
  assert.equal(r.status, 0);
  assert.equal(r.topic.slug, "jll");
  assert.ok(!r.calls.some((c) => c.startsWith("scripts/ollama-agent.js")), "no extra research");
  clean(r);
});

test("a starved topic is swapped for the first candidate whose research has something to draw", { skip }, () => {
  const r = run({ current: "mit", ok: ["nurses"] });
  assert.equal(r.status, 0);
  assert.equal(r.topic.slug, "nurses");
  assert.equal(r.topic.topic, "Topic nurses");
  assert.ok(existsSync(join(r.dir, "data", "research", "48", "nurses.json")), "the new research is written where the writer reads it");
  assert.ok(!r.calls.some((c) => /--video-id pilots/.test(c)), "it stops at the first good candidate");
  clean(r);
});

test("when none is good the best-scoring candidate wins, and only if it beats the current topic", { skip }, () => {
  let r = run({ current: "mit", scores: { mit: "0 2", jll: "1 3", nurses: "2 2", pilots: "0 5" } });
  assert.equal(r.topic.slug, "nurses");
  clean(r);
  r = run({ current: "mit", scores: { mit: "2 4", jll: "1 3", nurses: "0 2", pilots: "0 1" } });
  assert.equal(r.topic.slug, "mit", "nothing beat the current topic, so it stays");
  clean(r);
});

test("duplicates and failed research are skipped, and at most three alternates are researched", { skip }, () => {
  let r = run({ current: "mit", dups: ["jll"], noresearch: ["nurses"], ok: ["pilots"] });
  assert.equal(r.topic.slug, "pilots");
  clean(r);
  r = run({ current: "mit", ok: ["chairs"], max: 3 });
  assert.equal(r.topic.slug, "mit", "the fourth candidate is beyond the limit of three");
  assert.equal(r.calls.filter((c) => c.startsWith("scripts/ollama-agent.js")).length, 3);
  clean(r);
});

test("a channel that is not strict is never touched", { skip }, () => {
  const r = run({ current: "mit", strict: "false" });
  assert.equal(r.status, 0);
  assert.equal(r.topic.slug, "mit");
  assert.equal(r.calls.length, 1, "only the is-strict question was asked");
  clean(r);
});

test("the workflow runs it after the research gate and before the writer", () => {
  const wf = readFileSync(new URL("../../.github/workflows/daily-pipeline-v2.yml", import.meta.url), "utf8").split("\r").join("");
  const a = wf.indexOf("name: Gate research"), b = wf.indexOf("name: Pre-screen the research for something to draw"), c = wf.indexOf("      - name: Write script");
  assert.ok(a > 0 && b > a && c > b, "order: gate research, pre-screen, write script");
  assert.match(wf.slice(b, c), /run: bash scripts\/ci\/strict-prescreen-pick\.sh/);
});
