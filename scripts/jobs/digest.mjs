/**
 * The morning upload digest (data/uploaded/<date>.json), written by review-publish.
 *
 * Moved out of an inline `node -e '...'` in daily-pipeline-v2.yml: the inline note text
 * "each channel's reason" carried an apostrophe that closed the single-quoted shell string, so
 * bash failed with "unexpected EOF while looking for matching `"'" and review-publish exited 2
 * (main run 39790127811) without writing or committing any digest.
 *
 *   node scripts/jobs/digest.mjs   env: TODAY, REVIEW_RUN, REQUESTED (comma list), PUBLISH_LOG_DIR (default /tmp)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bare = (c) => String(c).replace(/^ch-?/i, '').replace(/^0+/, '');

export function readQueueRows(root) {
  const dir = path.join(root, 'data', 'publish-queue');
  const files = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) { for (const g of fs.readdirSync(full)) if (g.endsWith('.json')) files.push(path.join(full, g)); }
      else if (f.endsWith('.json')) files.push(full);
    }
  }
  const rows = [];
  for (const f of files) {
    try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); if (Array.isArray(r)) rows.push(...r); } catch { /* unreadable queue file: skipped */ }
  }
  return rows;
}

export function readStatuses(root) {
  const dir = path.join(root, 'data', 'publish-status');
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try { const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); out[bare(s.channel_id || f.slice(0, -5))] = s; } catch { /* ignore */ }
  }
  return out;
}

/** Why a requested channel did not upload, from its publish log (null = never tried) and its recorded publish-status. */
export function outcomeFor(log, status, runId) {
  const fresh = status && (!runId || !status.run_id || String(status.run_id) === String(runId));
  if (log && /\[YOUTUBE-PUBLISH\] SKIPPED: ([^\n]+)/.test(log)) return 'skipped: ' + log.match(/\[YOUTUBE-PUBLISH\] SKIPPED: ([^\n]+)/)[1].trim();
  if (!log) return fresh && status.reason ? 'skipped: ' + status.reason : 'no OAuth credentials configured';
  const err = (log.match(/ERROR: ([^\n]+)/) || [])[1];
  if (err) return 'upload FAILED: ' + err.slice(0, 160);
  if (/No approved-review\/ or approved\/ renders found|No approved-review/.test(log)) return 'no video passed QA this run';
  if (/already uploaded as/.test(log)) return 'already uploaded (' + ((log.match(/already uploaded as (\S+)/) || [])[1] || '') + ')';
  if (/BLOCKED: YouTube OAuth credentials not configured/.test(log)) return 'no OAuth credentials configured';
  return 'not uploaded (see the review-publish log)';
}

export function buildDigest({ rows, requested, logs = {}, statuses = {}, runId, today, now = new Date() }) {
  const uploads = [];
  for (const e of rows) {
    if (runId && e.source_run && String(e.source_run) !== String(runId)) continue;
    if (!e.uploaded_at || String(e.uploaded_at).slice(0, 10) !== today) continue;
    uploads.push({
      channel: e.channel_id, title: e.title, video_id: e.video_id,
      privacy_status: e.privacy_status || 'private',
      source_queue: e.source_queue || 'approved',
      studio_link: 'https://studio.youtube.com/video/' + e.video_id + '/edit',
    });
  }
  uploads.sort((a, b) => String(a.channel).localeCompare(String(b.channel)));
  const outcome = {};
  for (const c of requested) {
    const n = bare(c);
    if (uploads.some((u) => bare(u.channel) === n)) continue;
    outcome[n] = outcomeFor(logs[n] ?? null, statuses[n], runId);
  }
  const noCreds = Object.keys(outcome).filter((c) => /no OAuth credentials configured|OAuth credentials rejected/.test(outcome[c]));
  return {
    date: today,
    review_run_id: runId || null,
    generated_at: now.toISOString(),
    uploads,
    not_uploaded: outcome,
    no_credentials: noCreds,
    note: uploads.length
      ? 'Everything above is PRIVATE. Open each Studio link and click Publish to make it public.'
      : 'Nothing was uploaded today. See not_uploaded for the reason per channel.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const today = String(process.env.TODAY || new Date().toISOString()).slice(0, 10);
  const requested = String(process.env.REQUESTED || '').split(',').map((s) => s.trim()).filter(Boolean);
  const logDir = process.env.PUBLISH_LOG_DIR || '/tmp';
  const logs = {};
  for (const c of requested) {
    try { logs[bare(c)] = fs.readFileSync(path.join(logDir, `publish-out-${bare(c)}.log`), 'utf8'); } catch { /* never tried */ }
  }
  const d = buildDigest({ rows: readQueueRows(root), requested, logs, statuses: readStatuses(root), runId: process.env.REVIEW_RUN, today });
  fs.mkdirSync(path.join(root, 'data', 'uploaded'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'uploaded', `${today}.json`), JSON.stringify(d, null, 2) + '\n');
  console.log(`digest: data/uploaded/${today}.json - ${d.uploads.length} uploaded`);
  for (const [c, why] of Object.entries(d.not_uploaded)) console.log(`  ch-${c}: ${why}`);
}
