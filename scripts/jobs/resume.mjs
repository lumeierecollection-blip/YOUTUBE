/**
 * Decide whether a channel should resume a committed, gate-passed script instead of rediscovering.
 *   node scripts/jobs/resume.mjs --channel <id> [--max-age-days 3]
 * Prints {resume, slug, from_stage, why}. Always exits 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { list, findMarker } from './job-state.mjs';

const MAX_RENDER_ATTEMPTS = 3;

function reservedSlugs(root, channel) {
  const p = path.join(root, 'data', 'topic-log.json');
  if (!fs.existsSync(p)) return null;
  const log = JSON.parse(fs.readFileSync(p, 'utf8'));
  const { slugify } = createRequire(import.meta.url)('../../src/utils/topic-log.cjs');
  const entry = log.channels?.[String(parseInt(channel, 10) || channel)];
  return (entry?.used_topics || []).map((u) => (typeof u === 'string' ? slugify(u) : u.slug || slugify(u.topic)));
}

export function decide(root, channel, { maxAgeDays = 3, now = Date.now() } = {}) {
  const no = (why) => ({ resume: false, slug: null, from_stage: null, why });
  const dir = path.join(root, 'data', 'research', String(channel));
  if (!fs.existsSync(dir)) return no('no research dir');
  const scripts = fs.readdirSync(dir).filter((f) => f.endsWith('-shorts-script.json'))
    .map((f) => ({ slug: f.slice(0, -'-shorts-script.json'.length), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!scripts.length) return no('no committed script');
  const jobs = new Map(list(root, channel).map((j) => [j.slug, j]));
  const reserved = reservedSlugs(root, channel);
  const reasons = [];
  for (const { slug } of scripts) {
    const job = jobs.get(slug);
    if (!job) { reasons.push(`${slug}: no job record`); continue; }
    if (job.terminal) { reasons.push(`${slug}: terminal (${job.outcome})`); continue; }
    if (findMarker(root, slug)) { reasons.push(`${slug}: already has a queue marker`); continue; }
    if (now - Date.parse(job.created_at) > maxAgeDays * 86400000) { reasons.push(`${slug}: older than ${maxAgeDays}d`); continue; }
    if (job.stages.render.attempts >= MAX_RENDER_ATTEMPTS) { reasons.push(`${slug}: render attempts ${job.stages.render.attempts}>=${MAX_RENDER_ATTEMPTS}`); continue; }
    if (!reserved || !reserved.includes(slug)) { reasons.push(`${slug}: topic no longer reserved`); continue; }
    return { resume: true, slug, from_stage: 'tts', why: `gate-passed script, render attempts ${job.stages.render.attempts}/${MAX_RENDER_ATTEMPTS}` };
  }
  return no(reasons.slice(0, 3).join('; '));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const get = (k) => (a.indexOf(k) >= 0 ? a[a.indexOf(k) + 1] : undefined);
  let out;
  try {
    out = decide(process.cwd(), get('--channel'), { maxAgeDays: Number(get('--max-age-days') ?? 3) });
  } catch (e) {
    out = { resume: false, slug: null, from_stage: null, why: `error: ${e.message}`.slice(0, 200) };
  }
  console.log(JSON.stringify(out));
}
