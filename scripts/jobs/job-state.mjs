/**
 * Per-video job record: data/jobs/<channel>/<slug>.json (see docs/JOBS.md).
 * Every function takes `root` (repo root, or JOBS_ROOT in CI render jobs) so tests use a temp dir.
 * Writes are atomic (tmp + rename). Error strings are redacted of token/secret shapes before storing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STAGES = ['discover', 'research', 'script', 'tts', 'render', 'qa', 'publish'];

const REDACTIONS = [
  /ya29\.[A-Za-z0-9._-]+/g,
  /(refresh_token|client_secret|access_token|id_token|api[_-]?key|secret|token|password|key)(["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /\b(sk|gsk|ghp|gho|ghs)[-_][A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
];

export function redact(text, max = 300) {
  let s = String(text ?? '');
  s = s.replace(REDACTIONS[0], '[redacted]');
  s = s.replace(REDACTIONS[1], (_m, k, sep) => `${k}${sep}[redacted]`);
  for (const re of REDACTIONS.slice(2)) s = s.replace(re, '[redacted]');
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

export const jobPath = (root, channel, slug) => path.join(root, 'data', 'jobs', String(channel), `${slug}.json`);

function writeAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export function load(root, channel, slug) {
  try {
    return JSON.parse(fs.readFileSync(jobPath(root, channel, slug), 'utf8'));
  } catch {
    return null;
  }
}

export function list(root, channel) {
  const dir = path.join(root, 'data', 'jobs');
  if (!fs.existsSync(dir)) return [];
  const chans = channel != null ? [String(channel)] : fs.readdirSync(dir);
  const out = [];
  for (const ch of chans) {
    const d = path.join(dir, ch);
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.json')) continue;
      const j = load(root, ch, f.slice(0, -5));
      if (j) out.push(j);
    }
  }
  return out;
}

function blank(channel, slug, format, now) {
  const stages = {};
  for (const s of STAGES) {
    stages[s] = { status: 'pending', attempts: 0, started_at: null, finished_at: null, error: null, artifacts: [] };
  }
  return { channel: String(channel), slug, format, created_at: now, updated_at: now, run_ids: [], stages, terminal: false, outcome: null };
}

function mutate(root, channel, slug, fn, { format = 'shorts', runId } = {}) {
  const now = new Date().toISOString();
  const job = load(root, channel, slug) || blank(channel, slug, format, now);
  if (runId && !job.run_ids.includes(String(runId))) job.run_ids.push(String(runId));
  fn(job, now);
  job.updated_at = now;
  writeAtomic(jobPath(root, channel, slug), job);
  return job;
}

function stageOf(job, stage) {
  if (!STAGES.includes(stage)) throw new Error(`unknown stage: ${stage}`);
  return job.stages[stage];
}

export function startStage(root, channel, slug, stage, opts = {}) {
  return mutate(root, channel, slug, (job, now) => {
    const st = stageOf(job, stage);
    st.status = 'running';
    st.attempts += 1;
    st.started_at = now;
    st.finished_at = null;
    st.error = null;
  }, opts);
}

export function finishStage(root, channel, slug, stage, { artifacts, outcome, terminal, ...opts } = {}) {
  return mutate(root, channel, slug, (job, now) => {
    const st = stageOf(job, stage);
    st.status = 'done';
    st.finished_at = now;
    st.error = null;
    if (artifacts) st.artifacts = artifacts;
    if (outcome) job.outcome = outcome;
    if (terminal) job.terminal = true;
  }, opts);
}

export function failStage(root, channel, slug, stage, error, opts = {}) {
  return mutate(root, channel, slug, (job, now) => {
    const st = stageOf(job, stage);
    st.status = 'failed';
    st.finished_at = now;
    st.error = redact(error);
  }, opts);
}

export function skipStage(root, channel, slug, stage, reason, { terminal, outcome, ...opts } = {}) {
  return mutate(root, channel, slug, (job, now) => {
    const st = stageOf(job, stage);
    st.status = 'skipped';
    st.finished_at = now;
    st.error = redact(reason);
    if (outcome) job.outcome = outcome;
    if (terminal) job.terminal = true;
  }, opts);
}

/** The channel's newest non-terminal job (what a render-side step means by "the current video"). */
export function current(root, channel) {
  return list(root, channel).filter((j) => !j.terminal).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] || null;
}

// ---- CLI: node scripts/jobs/job-state.mjs <cmd> --channel N [--slug S] [--stage X] ... ----
// Never fails the caller: any problem prints a warning and exits 0.
function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    else a._.push(argv[i]);
  }
  return a;
}

export function cli(argv, root = process.env.JOBS_ROOT || process.cwd()) {
  const a = parseArgs(argv);
  const cmd = a._[0];
  const ch = a.channel;
  const opts = { runId: a['run-id'] || process.env.GITHUB_RUN_ID, format: a.format || 'shorts' };
  if (!cmd || !ch) throw new Error('usage: job-state.mjs <start|finish|fail|skip|fail-running|queue-sync> --channel N [--slug S] [--stage X]');
  let slug = a.slug;
  if (!slug) {
    const cur = current(root, ch);
    if (!cur) { console.log(`no open job for ch-${ch}; nothing recorded`); return null; }
    slug = cur.slug;
  }
  const stages = a.stage ? String(a.stage).split(',') : [];
  switch (cmd) {
    case 'start': stages.forEach((s) => startStage(root, ch, slug, s, opts)); break;
    case 'finish': stages.forEach((s) => finishStage(root, ch, slug, s, opts)); break;
    case 'fail': stages.forEach((s) => failStage(root, ch, slug, s, a.error || 'failed', opts)); break;
    case 'skip': stages.forEach((s) => skipStage(root, ch, slug, s, a.reason || 'skipped', opts)); break;
    case 'fail-running': {
      const job = load(root, ch, slug);
      for (const s of STAGES) if (job?.stages[s].status === 'running') failStage(root, ch, slug, s, a.error || 'failed', opts);
      break;
    }
    case 'queue-sync': {
      // After render: a queue marker for this slug means the video was made and judged. Record qa and close the job;
      // --publish done|skipped (+ --reason) records what happened to the upload.
      const marker = findMarker(a['renders-root'] || process.cwd(), slug); // markers live in the workspace, not JOBS_ROOT
      if (marker) {
        finishStage(root, ch, slug, 'qa', { outcome: marker.verdict, terminal: true, ...opts });
        if (a.publish === 'done') finishStage(root, ch, slug, 'publish', opts);
        else skipStage(root, ch, slug, 'publish', a.reason || (marker.verdict === 'rejected' ? 'rejected by QA' : 'not published'), opts);
      } else console.log(`no queue marker for ${slug}; job stays open`);
      break;
    }
    default: throw new Error(`unknown command: ${cmd}`);
  }
  console.log(`job ch-${ch}/${slug}: ${cmd} ${a.stage || ''}`.trim());
  return slug;
}

export const QUEUE_DIRS = ['approved', 'approved-review', 'rejected'];

/** First queue marker (data/renders/<verdict>/<slug>*.json) for the slug, or null. */
export function findMarker(root, slug) {
  for (const verdict of QUEUE_DIRS) {
    const dir = path.join(root, 'data', 'renders', verdict);
    if (!fs.existsSync(dir)) continue;
    const f = fs.readdirSync(dir).find((n) => n.endsWith('.json') && n.startsWith(slug));
    if (f) return { verdict, file: path.join(dir, f) };
  }
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    console.log(`::warning::job-state: ${redact(e.message)}`);
  }
}
