// Orchestration: publish capability gate, per-channel isolation of job state, resume, bounded retry,
// the morning digest, and the workflow wiring that carries them (daily-pipeline-v2.yml -> channel-pipeline.yml).
// Synthetic fixtures in temp dirs only; no network, no secrets.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { publishEnabled, credentialCheck, classifyPublishError, cli as gateCli, readPublishStatus, SKIP_EXIT } from '../jobs/publish-gate.mjs';
import { withRetry, isTransient, backoffMs, MAX_ATTEMPTS } from '../jobs/retry.mjs';
import { buildDigest, outcomeFor } from '../jobs/digest.mjs';
import { startStage, finishStage, failStage, load, jobPath } from '../jobs/job-state.mjs';
import { decide } from '../jobs/resume.mjs';
import { stalled } from '../jobs/stalled.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pipejobs-'));
const w = (root, rel, body = '{}') => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body); };
const row = (n, extra = {}) => ({ id: n, channel_id: `ch-${String(n).padStart(2, '0')}`, channel_name: `Ch ${n}`, ...extra });
const quiet = (fn) => { const log = console.log; const out = process.stdout.write; console.log = () => {}; process.stdout.write = () => true; try { return fn(); } finally { console.log = log; process.stdout.write = out; } };

describe('publish gate: whether this run may upload at all', () => {
  it('is enabled only on main, without dry_run / no_push / render_only', () => {
    assert.deepEqual(publishEnabled({ ref: 'refs/heads/main' }), { enabled: true, reason: null });
    for (const [args, re] of [
      [{ ref: 'refs/heads/feat/x' }, /not on main \(ref refs\/heads\/feat\/x\)/],
      [{ ref: 'refs/heads/main', dryRun: 'true' }, /dry run/],
      [{ ref: 'refs/heads/main', noPush: 'true' }, /no_push/],
      [{ ref: 'refs/heads/main', renderOnly: 'true' }, /render_only/],
      [{}, /not on main/],
    ]) {
      const g = publishEnabled(args);
      assert.equal(g.enabled, false);
      assert.match(g.reason, re);
    }
  });
  it('empty dispatch inputs (the cron has none) keep production behaviour', () => {
    assert.equal(publishEnabled({ ref: 'refs/heads/main', dryRun: '', noPush: '', renderOnly: '' }).enabled, true);
  });
});

describe('publish gate: credentials (own channel only, never a value in a reason)', () => {
  const full = { CH01_CLIENT_ID: 'id1', CH01_CLIENT_SECRET: 'sec1', CH01_REFRESH_TOKEN: 'tok1' };
  it('missing creds -> skip with the exact missing secret NAMES and no values', () => {
    const c = credentialCheck(row(1), { CH01_CLIENT_ID: 'id1' });
    assert.equal(c.ok, false);
    assert.equal(c.refused, false);
    assert.equal(c.reason, 'no OAuth credentials configured: missing secrets CHANNEL_01_CLIENT_SECRET, CHANNEL_01_REFRESH_TOKEN');
    assert.doesNotMatch(c.reason, /id1/);
  });
  it("never borrows another channel's secrets", () => {
    const c = credentialCheck(row(2), full); // only ch-01's secrets exist
    assert.equal(c.ok, false);
    assert.match(c.reason, /CHANNEL_02_CLIENT_ID, CHANNEL_02_CLIENT_SECRET, CHANNEL_02_REFRESH_TOKEN/);
  });
  it("refuses a row that declares another channel's credentials file", () => {
    const c = credentialCheck(row(5, { youtube_credentials_path: 'config/creds/ch-44.json' }), { CH05_CLIENT_ID: 'a', CH05_CLIENT_SECRET: 'b', CH05_REFRESH_TOKEN: 'c' });
    assert.equal(c.ok, false);
    assert.equal(c.refused, true);
    assert.match(c.reason, /declares config\/creds\/ch-44\.json, not its own credentials file config\/creds\/ch-05\.json/);
  });
  it('complete own creds -> ok, into its own file', () => {
    const c = credentialCheck(row(1), full);
    assert.equal(c.ok, true);
    assert.equal(c.own, 'config/creds/ch-01.json');
    assert.deepEqual(c.creds, { client_id: 'id1', client_secret: 'sec1', refresh_token: 'tok1' });
  });
  it('CLI materialize: missing creds records the skip, exits 0, writes no creds file', () => {
    const root = tmp();
    const r = quiet(() => gateCli(['materialize', '--channel', '48'], { root, env: {}, resolve: () => row(48) }));
    assert.equal(r.code, 0);
    assert.equal(fs.existsSync(path.join(root, 'config/creds/ch-48.json')), false);
    const st = readPublishStatus(root, 'ch-48');
    assert.equal(st.status, 'skipped');
    assert.match(st.reason, /missing secrets CHANNEL_48_CLIENT_ID/);
  });
  it('CLI materialize: refused row exits 1 and records refused', () => {
    const root = tmp();
    const r = quiet(() => gateCli(['materialize', '--channel', '5'], { root, env: {}, resolve: () => row(5, { youtube_credentials_path: 'config/creds/ch-44.json' }) }));
    assert.equal(r.code, 1);
    assert.equal(readPublishStatus(root, 'ch-05').status, 'refused');
  });
  it('CLI gate off main records a skip reason; materialize with creds writes only the own file', () => {
    const root = tmp();
    const g = quiet(() => gateCli(['gate', '--channel', '1'], { root, env: { GATE_REF: 'refs/heads/feat/y' }, resolve: () => row(1) }));
    assert.equal(g.enabled, false);
    assert.match(readPublishStatus(root, 'ch-01').reason, /not on main/);
    quiet(() => gateCli(['materialize', '--channel', '1'], { root, env: full, resolve: () => row(1) }));
    assert.deepEqual(fs.readdirSync(path.join(root, 'config/creds')), ['ch-01.json']);
  });
  it('OAuth rejections are classified as skips (exit 78), other errors are not', () => {
    assert.equal(SKIP_EXIT, 78);
    assert.match(classifyPublishError('OAuth token exchange failed: invalid_grant — Token has been expired or revoked.').reason, /rejected by Google \(invalid_grant\)/);
    assert.equal(classifyPublishError('OAuth token exchange failed: invalid_client — The OAuth client was not found.').code, 'invalid_client');
    assert.equal(classifyPublishError('videos.insert failed: quotaExceeded'), null);
    assert.equal(classifyPublishError(undefined), null);
  });
});

describe('digest reasons', () => {
  it('uses the recorded skip reason, the SKIPPED line, and "no video passed QA"', () => {
    const d = buildDigest({
      rows: [{ channel_id: '1', title: 'T', video_id: 'v1', uploaded_at: '2026-10-22T09:00:00Z', source_run: '9' }],
      requested: ['1', '2', '48', '9'],
      logs: {
        2: '\n[YOUTUBE-PUBLISH] SKIPPED: OAuth credentials rejected by Google (invalid_grant): owner must re-authorize this channel\n',
        48: 'No approved-review/ renders for this channel in run 9',
      },
      statuses: { 9: { channel_id: 'ch-09', status: 'skipped', reason: 'no OAuth credentials configured: missing secrets CHANNEL_09_CLIENT_ID', run_id: '9' } },
      runId: '9', today: '2026-10-22',
    });
    assert.equal(d.uploads.length, 1);
    assert.match(d.not_uploaded[2], /^skipped: OAuth credentials rejected by Google \(invalid_grant\)/);
    assert.equal(d.not_uploaded[48], 'no video passed QA this run');
    assert.match(d.not_uploaded[9], /missing secrets CHANNEL_09_CLIENT_ID/);
    assert.deepEqual(d.no_credentials.sort(), ['2', '9']);
    assert.doesNotMatch(d.note, /'/); // the apostrophe that broke the inline shell version
  });
  it('a stale status from another run is not reported as this run\'s reason', () => {
    assert.equal(outcomeFor(null, { reason: 'old', run_id: '1' }, '2'), 'no OAuth credentials configured');
  });
});

describe('job state: per-channel failure isolation', () => {
  it("one channel's failed render leaves another channel's job, resume and stall status untouched", () => {
    const root = tmp();
    for (const ch of [1, 2]) {
      w(root, `data/research/${ch}/s${ch}-shorts-script.json`);
      for (const s of ['discover', 'research', 'script', 'tts']) { startStage(root, ch, `s${ch}`, s); finishStage(root, ch, `s${ch}`, s); }
    }
    w(root, 'data/topic-log.json', JSON.stringify({ channels: { 1: { used_topics: [{ topic: 'S1', slug: 's1' }] }, 2: { used_topics: [{ topic: 'S2', slug: 's2' }] } } }));
    const before = fs.readFileSync(jobPath(root, 1, 's1'), 'utf8');
    startStage(root, 2, 's2', 'render');
    failStage(root, 2, 's2', 'render', 'beat check FAILED');
    assert.equal(fs.readFileSync(jobPath(root, 1, 's1'), 'utf8'), before, 'ch-1 record byte-identical');
    assert.equal(load(root, 2, 's2').stages.render.status, 'failed');
    assert.equal(load(root, 1, 's1').stages.render.status, 'pending');
    // both resume independently (ch-2 has 1 of 3 render attempts used)
    assert.equal(decide(root, 1).resume, true);
    assert.equal(decide(root, 2).resume, true);
    // ch-2 stuck "running" for 5h is reported; ch-1 is not
    startStage(root, 2, 's2', 'render');
    const j = load(root, 2, 's2'); j.updated_at = new Date(Date.now() - 5 * 3600000).toISOString(); fs.writeFileSync(jobPath(root, 2, 's2'), JSON.stringify(j));
    const rows = stalled(root);
    assert.deepEqual(rows.map((r) => r.channel), ['2']);
  });
});

describe('resume: completed stages are reused, not re-run', () => {
  it('a gate-passed committed script resumes at tts (discover/research/script skipped)', () => {
    const root = tmp();
    w(root, 'data/research/1/foo-shorts-script.json');
    for (const s of ['discover', 'research', 'script']) { startStage(root, 1, 'foo', s); finishStage(root, 1, 'foo', s); }
    w(root, 'data/topic-log.json', JSON.stringify({ channels: { 1: { used_topics: [{ topic: 'Foo', slug: 'foo' }] } } }));
    const d = decide(root, 1);
    assert.equal(d.resume, true);
    assert.equal(d.slug, 'foo');
    assert.equal(d.from_stage, 'tts');
    // attempts never grow unbounded: at the render cap the job is no longer resumed
    for (let i = 0; i < 3; i++) { startStage(root, 1, 'foo', 'render'); failStage(root, 1, 'foo', 'render', 'x'); }
    assert.equal(decide(root, 1).resume, false);
  });
});

describe('bounded retry', () => {
  const sleeps = [];
  const sleep = async (ms) => { sleeps.push(ms); };
  it('retries a transient failure up to the cap, then throws the last error', async () => {
    sleeps.length = 0;
    let calls = 0;
    await assert.rejects(withRetry(async () => { calls++; throw new Error('fetch failed: ECONNRESET'); }, { attempts: 3, baseMs: 10, sleep }), /ECONNRESET/);
    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [10, 20]);
  });
  it('succeeds on a later attempt', async () => {
    let calls = 0;
    const v = await withRetry(async () => { if (++calls < 2) throw Object.assign(new Error('HTTP 503'), { status: 503 }); return 'ok'; }, { sleep: async () => {} });
    assert.equal(v, 'ok');
    assert.equal(calls, 2);
  });
  it('does not retry a non-transient error (invalid_grant is not transient)', async () => {
    let calls = 0;
    await assert.rejects(withRetry(async () => { calls++; throw new Error('OAuth token exchange failed: invalid_grant — revoked'); }, { attempts: 5, sleep: async () => {} }));
    assert.equal(calls, 1);
    assert.equal(isTransient(new Error('500 invalid_client')), false);
  });
  it('caps attempts at MAX_ATTEMPTS and each wait at maxMs', async () => {
    let calls = 0;
    await assert.rejects(withRetry(async () => { calls++; throw new Error('timeout'); }, { attempts: 1000, sleep: async () => {} }));
    assert.equal(calls, MAX_ATTEMPTS);
    assert.equal(backoffMs(20, { baseMs: 1000, maxMs: 15000 }), 15000);
  });
});

describe('workflow wiring', () => {
  const load = (f) => yaml.load(fs.readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8'));
  const caller = load('daily-pipeline-v2.yml');
  const chan = load('channel-pipeline.yml');
  it("each channel's render needs only its own prep (no matrix-wide wait)", () => {
    assert.deepEqual(chan.jobs.render.needs, ['prep']);
    assert.equal(chan.jobs.prep.needs, undefined);
    assert.deepEqual(chan.jobs.prep.strategy.matrix, { channel_id: ['${{ inputs.channel_id }}'] });
    const c = caller.jobs.channel;
    assert.equal(c.uses, './.github/workflows/channel-pipeline.yml');
    assert.equal(c.secrets, 'inherit');
    assert.equal(c.strategy['fail-fast'], false);
    assert.equal(c.strategy['max-parallel'], 6);
    assert.equal(caller.jobs.prep, undefined);
    assert.equal(caller.jobs.render, undefined);
    for (const j of ['review-publish', 'log-results']) assert.ok(caller.jobs[j].needs.includes('channel'), j);
  });
  it('every upload/push step in the channel workflow is gated on main and on no_push', () => {
    const steps = chan.jobs.render.steps;
    for (const name of ['Materialize OAuth credentials', 'Publish to YouTube (private)', 'Process publish queue', 'Commit publish queue']) {
      const s = steps.find((x) => x.name === name);
      assert.ok(s, name);
      assert.match(s.if, /github\.ref == 'refs\/heads\/main'/, name);
      assert.match(s.if, /github\.event\.inputs\.no_push != 'true'/, name);
      assert.match(s.if, /github\.event\.inputs\.dry_run != 'true'/, name);
    }
    const commit = chan.jobs.prep.steps.find((x) => x.name === "Commit this run's script and research");
    assert.match(commit.if, /no_push != 'true'/);
  });
  it('review-publish runs only on main; the cron leaves no_push off', () => {
    assert.match(caller.jobs['review-publish'].if, /github\.ref == 'refs\/heads\/main'/);
    assert.equal(caller.on.workflow_dispatch.inputs.no_push.default, false);
    assert.match(caller.jobs.setup.steps.find((s) => s.name === 'Commit SFX verdicts to the branch').if, /no_push != 'true'/);
  });
});
