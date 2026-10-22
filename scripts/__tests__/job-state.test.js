import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startStage, finishStage, failStage, skipStage, load, list, redact, jobPath, cli } from '../jobs/job-state.mjs';
import { decide } from '../jobs/resume.mjs';
import { stalled } from '../jobs/stalled.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-'));
const w = (root, rel, body = '{}') => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); };

/** A repo root with a committed script, a job record and a reservation for ch 7 / slug "foo". */
function seed({ reserved = true, marker, terminal = false, ageDays = 0, renderAttempts = 0 } = {}) {
  const root = tmp();
  w(root, 'data/research/7/foo-shorts-script.json');
  startStage(root, 7, 'foo', 'script');
  finishStage(root, 7, 'foo', 'script');
  const file = jobPath(root, 7, 'foo');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  j.created_at = new Date(Date.now() - ageDays * 86400000).toISOString();
  j.terminal = terminal;
  j.stages.render.attempts = renderAttempts;
  fs.writeFileSync(file, JSON.stringify(j));
  w(root, 'data/topic-log.json', JSON.stringify({ channels: { 7: { used_topics: reserved ? [{ topic: 'Foo', slug: 'foo' }] : [] } } }));
  if (marker) w(root, `data/renders/${marker}/foo-shorts.json`);
  return root;
}

describe('job-state', () => {
  it('walks stage transitions and counts attempts', () => {
    const root = tmp();
    startStage(root, 7, 'foo', 'render', { runId: 11 });
    assert.equal(load(root, 7, 'foo').stages.render.status, 'running');
    failStage(root, 7, 'foo', 'render', 'boom');
    startStage(root, 7, 'foo', 'render', { runId: 12 });
    const j = finishStage(root, 7, 'foo', 'render', { artifacts: ['a.mp4'] });
    assert.equal(j.stages.render.attempts, 2);
    assert.equal(j.stages.render.status, 'done');
    assert.deepEqual(j.run_ids, ['11', '12']);
    skipStage(root, 7, 'foo', 'publish', 'dry-run', { terminal: true });
    assert.equal(load(root, 7, 'foo').stages.publish.status, 'skipped');
    assert.equal(load(root, 7, 'foo').terminal, true);
    assert.equal(list(root, 7).length, 1);
  });

  it('writes atomically (no tmp file left, valid JSON)', () => {
    const root = tmp();
    startStage(root, 7, 'foo', 'tts');
    const names = fs.readdirSync(path.dirname(jobPath(root, 7, 'foo')));
    assert.deepEqual(names, ['foo.json']);
    JSON.parse(fs.readFileSync(jobPath(root, 7, 'foo'), 'utf8'));
  });

  it('redacts token and secret shapes in errors', () => {
    const e = redact('bad ya29.A0abc-def_1 and refresh_token=1//0gXYZ client_secret: "GOCSPX-abc" key=AIzaSyA1234567890123456789012 Bearer abc.def');
    for (const s of ['ya29.A0', '1//0gXYZ', 'GOCSPX', 'AIzaSy', 'abc.def']) assert.ok(!e.includes(s), `${s} leaked: ${e}`);
    const root = tmp();
    failStage(root, 7, 'foo', 'tts', 'refresh_token=SECRETVALUE');
    assert.ok(!load(root, 7, 'foo').stages.tts.error.includes('SECRETVALUE'));
  });

  it('queue-sync closes the job from a queue marker', () => {
    const jobs = tmp(), repo = tmp();
    startStage(jobs, 7, 'foo', 'render');
    w(repo, 'data/renders/rejected/foo-shorts.json');
    cli(['queue-sync', '--channel', '7', '--renders-root', repo, '--publish', 'skipped', '--reason', 'dry-run'], jobs);
    const j = load(jobs, 7, 'foo');
    assert.equal(j.terminal, true);
    assert.equal(j.outcome, 'rejected');
    assert.equal(j.stages.publish.status, 'skipped');
  });

  it('cli uses the current open job when --slug is omitted', () => {
    const root = tmp();
    startStage(root, 7, 'foo', 'tts');
    cli(['finish', '--channel', '7', '--stage', 'tts'], root);
    assert.equal(load(root, 7, 'foo').stages.tts.status, 'done');
  });
});

describe('resume decision', () => {
  it('resumes a committed script with an open job and no marker', () => {
    const r = decide(seed(), 7);
    assert.equal(r.resume, true);
    assert.equal(r.slug, 'foo');
    assert.equal(r.from_stage, 'tts');
  });
  it('does not resume when a queue marker exists', () => {
    for (const m of ['approved', 'approved-review', 'rejected']) assert.equal(decide(seed({ marker: m }), 7).resume, false);
  });
  it('does not resume a released topic', () => assert.equal(decide(seed({ reserved: false }), 7).resume, false));
  it('does not resume a job older than max age', () => assert.equal(decide(seed({ ageDays: 5 }), 7, { maxAgeDays: 3 }).resume, false));
  it('does not resume after 3 render attempts, still does at 2', () => {
    assert.equal(decide(seed({ renderAttempts: 3 }), 7).resume, false);
    assert.equal(decide(seed({ renderAttempts: 2 }), 7).resume, true);
  });
  it('does not resume a terminal job or a script with no job record', () => {
    assert.equal(decide(seed({ terminal: true }), 7).resume, false);
    const root = tmp();
    w(root, 'data/research/7/bar-shorts-script.json');
    assert.equal(decide(root, 7).resume, false);
  });
});

describe('stalled detection', () => {
  const at = (root, hoursAgo, mut) => {
    const f = jobPath(root, 7, 'foo');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    j.updated_at = new Date(Date.now() - hoursAgo * 3600000).toISOString();
    mut?.(j);
    fs.writeFileSync(f, JSON.stringify(j));
  };
  it('flags a stage running too long', () => {
    const root = tmp(); startStage(root, 7, 'foo', 'render'); at(root, 5);
    assert.equal(stalled(root, { hours: 3 })[0].stage, 'render');
  });
  it('flags a non-terminal job idle for 24h, ignores fresh and terminal ones', () => {
    const root = tmp(); finishStage(root, 7, 'foo', 'script'); at(root, 30);
    assert.equal(stalled(root).length, 1);
    at(root, 1); assert.equal(stalled(root).length, 0);
    at(root, 30, (j) => { j.terminal = true; }); assert.equal(stalled(root).length, 0);
  });
});
