/**
 * Publish capability check (audit 2026-10-22 #7). Publishing is a CAPABILITY of a channel, not a
 * stage that can fail the run: a channel whose upload is not possible (not on main, dry run,
 * render_only, no OAuth secrets, OAuth rejected by Google) keeps its research/script/render/QA
 * deliverables and its publish stage is SKIPPED with the exact reason, recorded in
 * data/publish-status/<channel_id>.json (read by the digest) and in the job record.
 *
 * What this never does:
 *   - borrow another channel's credentials: a channel is materialised only into its OWN file
 *     config/creds/<channel_id>.json, from its OWN secrets CHANNEL_<NN>_*; a row that declares
 *     another channel's file is refused (exit 1, as before).
 *   - print a secret: reasons name missing secret NAMES, never values.
 *   - decide approval: run.js still uploads only approved/approved-review markers, private first.
 *
 * CLI (always run from the repo root):
 *   node scripts/jobs/publish-gate.mjs gate --channel N         -> GITHUB_OUTPUT enabled=true|false, reason=...
 *        env: GATE_REF (github.ref), GATE_DRY_RUN, GATE_RENDER_ONLY, GATE_NO_PUSH
 *   node scripts/jobs/publish-gate.mjs materialize --channel N  -> GITHUB_OUTPUT creds=ok|missing
 *        env: CH<NN>_CLIENT_ID / CH<NN>_CLIENT_SECRET / CH<NN>_REFRESH_TOKEN
 *   node scripts/jobs/publish-gate.mjs reason --channel N       -> prints the recorded skip reason (or nothing)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { redact } from './job-state.mjs';

const require = createRequire(import.meta.url);

/** run.js exits with this when the upload was SKIPPED for a credential reason (not a failure). 78 = EX_CONFIG. */
export const SKIP_EXIT = 78;

const CRED_KEYS = ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'];
const truthy = (v) => v === true || v === 'true' || v === '1';

/** Whether this run may upload at all (independent of the channel's credentials). */
export function publishEnabled({ ref, dryRun, renderOnly, noPush } = {}) {
  if (ref !== 'refs/heads/main') return { enabled: false, reason: `not on main (ref ${ref || 'unknown'}): uploads run only from main` };
  if (truthy(dryRun)) return { enabled: false, reason: 'dry run: publishing disabled by the dry_run input' };
  if (truthy(noPush)) return { enabled: false, reason: 'no_push run: publishing disabled by the no_push input' };
  if (truthy(renderOnly)) return { enabled: false, reason: 'render_only debug run: never publishes' };
  return { enabled: true, reason: null };
}

/** Upload slot "NN" for a resolved channel row (ch-01 -> "01", ch-48 -> "48"). */
export const slotOf = (channel) => String(channel.channel_id).replace(/^ch-0*/i, '').padStart(2, '0');

/**
 * Does THIS channel have its own complete OAuth secrets? Pure: reads only `env`.
 * Returns { ok, refused, reason, own, creds }. `refused` = the row points at another channel's file.
 */
export function credentialCheck(channel, env) {
  const own = `config/creds/${channel.channel_id}.json`;
  const declared = channel.youtube_credentials_path ? String(channel.youtube_credentials_path).split('\\').join('/') : own;
  if (declared !== own) {
    return { ok: false, refused: true, own, reason: `channel ${channel.channel_id} declares ${declared}, not its own credentials file ${own}: refusing (never another channel's credentials)` };
  }
  const p = slotOf(channel);
  const missing = CRED_KEYS.filter((k) => !env[`CH${p}_${k}`]);
  if (missing.length) {
    return { ok: false, refused: false, own, reason: `no OAuth credentials configured: missing secrets ${missing.map((k) => `CHANNEL_${p}_${k}`).join(', ')}` };
  }
  return {
    ok: true, refused: false, own, reason: null,
    creds: { client_id: env[`CH${p}_CLIENT_ID`], client_secret: env[`CH${p}_CLIENT_SECRET`], refresh_token: env[`CH${p}_REFRESH_TOKEN`] },
  };
}

/** An upload error that means "this channel's credentials do not work" (owner action), or null. */
export function classifyPublishError(message) {
  const m = String(message || '').match(/\b(invalid_grant|invalid_client|unauthorized_client|deleted_client)\b/);
  if (!m) return null;
  return { code: m[1], reason: `OAuth credentials rejected by Google (${m[1]}): owner must re-authorize this channel` };
}

export const statusPath = (root, channelId) => path.join(root, 'data', 'publish-status', `${channelId}.json`);

export function recordPublishStatus(root, channelId, { status, reason, runId = process.env.GITHUB_RUN_ID || null, now = new Date() } = {}) {
  const file = statusPath(root, channelId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = { channel_id: channelId, status, reason: reason ? redact(reason) : null, run_id: runId, at: now.toISOString() };
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
  return body;
}

export function readPublishStatus(root, channelId) {
  try { return JSON.parse(fs.readFileSync(statusPath(root, channelId), 'utf8')); } catch { return null; }
}

function output(kv) {
  const lines = Object.entries(kv).map(([k, v]) => `${k}=${String(v ?? '').replace(/[\r\n]+/g, ' ')}`).join('\n') + '\n';
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines);
  process.stdout.write(lines);
}

export function cli(argv, { root = process.cwd(), env = process.env, resolve } = {}) {
  const cmd = argv[0];
  const ci = argv.indexOf('--channel');
  const key = ci >= 0 ? String(Number(argv[ci + 1])) : '';
  if (!cmd || !key || key === 'NaN') throw new Error('usage: publish-gate.mjs <gate|materialize|reason> --channel N');
  const resolveChannel = resolve || require('../lib/channel-lookup.cjs').resolveChannel;
  const ch = resolveChannel(key);
  if (cmd === 'gate') {
    const g = publishEnabled({ ref: env.GATE_REF, dryRun: env.GATE_DRY_RUN, renderOnly: env.GATE_RENDER_ONLY, noPush: env.GATE_NO_PUSH });
    if (!g.enabled) {
      recordPublishStatus(root, ch.channel_id, { status: 'skipped', reason: g.reason });
      console.log(`::notice::${ch.channel_id} publish skipped - ${g.reason}`);
    }
    output({ enabled: g.enabled, reason: g.reason || '' });
    return { code: 0, ...g };
  }
  if (cmd === 'materialize') {
    const c = credentialCheck(ch, env);
    if (c.refused) {
      recordPublishStatus(root, ch.channel_id, { status: 'refused', reason: c.reason });
      console.log(`::error::${c.reason}`);
      return { code: 1, ...c };
    }
    if (!c.ok) {
      // A channel without OAuth is a configured state, not a failure: its render, QA and queue entry
      // are already saved. Skip the upload with the exact reason instead of turning the job red.
      recordPublishStatus(root, ch.channel_id, { status: 'skipped', reason: c.reason });
      console.log(`::warning::${ch.channel_id} publish skipped - ${c.reason}`);
      output({ creds: 'missing', reason: c.reason });
      return { code: 0, ...c };
    }
    fs.mkdirSync(path.join(root, 'config', 'creds'), { recursive: true });
    fs.writeFileSync(path.join(root, c.own), JSON.stringify(c.creds, null, 2), { mode: 0o600 });
    console.log(`Credentials materialized for ${ch.channel_id} (dispatch key ${key})`);
    output({ creds: 'ok', reason: '' });
    return { code: 0, ok: true };
  }
  if (cmd === 'reason') {
    const s = readPublishStatus(root, ch.channel_id);
    if (s && s.status !== 'published') console.log(s.reason || s.status);
    return { code: 0 };
  }
  throw new Error(`unknown command: ${cmd}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let code = 0;
  try { code = cli(process.argv.slice(2)).code; } catch (e) { console.log(`::error::publish-gate: ${redact(e.message)}`); code = 1; }
  process.exitCode = code;
}
