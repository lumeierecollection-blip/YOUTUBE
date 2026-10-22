/**
 * List stalled jobs: a stage `running` with updated_at older than --hours (default 3), or a
 * non-terminal job with no update for 24h.   node scripts/jobs/stalled.mjs [--hours N] [--json]
 * Always exits 0.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { list, STAGES } from './job-state.mjs';

export function stalled(root, { hours = 3, now = Date.now() } = {}) {
  const out = [];
  for (const j of list(root)) {
    if (j.terminal) continue;
    const age = (now - Date.parse(j.updated_at)) / 3600000;
    const running = STAGES.find((s) => j.stages[s].status === 'running');
    if (running && age > hours) out.push({ channel: j.channel, slug: j.slug, stage: running, age_h: Math.round(age), why: `${running} running ${Math.round(age)}h` });
    else if (age > 24) out.push({ channel: j.channel, slug: j.slug, stage: STAGES.filter((s) => j.stages[s].status !== 'pending').pop() || 'none', age_h: Math.round(age), why: `no update ${Math.round(age)}h` });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const hi = a.indexOf('--hours');
  const rows = stalled(process.cwd(), { hours: hi >= 0 ? Number(a[hi + 1]) : 3 });
  if (a.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else if (!rows.length) console.log('No stalled jobs.');
  else {
    console.log('| channel | slug | stage | why |\n|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.channel} | ${r.slug} | ${r.stage} | ${r.why} |`);
  }
}
