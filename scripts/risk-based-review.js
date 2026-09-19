#!/usr/bin/env node
/**
 * risk-based-review.js - Orchestrates risk-based post-render Gemini review.
 *
 * Flow:
 *   1. Run local deterministic auditor FIRST
 *   2. If NORMAL risk -> 0 Gemini calls
 *   3. If MEDIUM risk -> one batched Gemini review
 *   4. If HIGH risk -> targeted Gemini reviews
 *   5. Corrections are DELTAS, not full plan regenerations
 *
 * Usage:
 *   node scripts/risk-based-review.js --video PATH --channel ID [--plan PATH]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOCAL_AUDIT_JS = join(__dirname, 'local-audit.js');
const GEMINI_REVIEW_JS = join(__dirname, 'gemini-frame-review.js');

function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function runScript(script, args, label) {
  console.log('[' + label + '] Running...');
  const result = spawnSync('node', [script, ...args], {
    encoding: 'utf-8',
    timeout: 5 * 60 * 1000,
    cwd: ROOT,
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function main() {
  const videoPath = arg('video');
  const channelId = arg('channel', 'unknown');
  const planPath = arg('plan');

  if (!videoPath) {
    console.error('Usage: risk-based-review.js --video PATH --channel ID [--plan PATH]');
    process.exit(2);
  }

  const video = existsSync(videoPath) ? videoPath : join(ROOT, videoPath);
  if (!existsSync(video)) {
    console.error('Video not found: ' + videoPath);
    process.exit(1);
  }

  // Phase 1: Local deterministic audit
  console.log('\n=== PHASE 1: LOCAL DETERMINISTIC AUDIT ===\n');
  const auditArgs = ['--video', video, '--channel', channelId];
  if (planPath) auditArgs.push('--plan', planPath);
  const auditResult = runScript(LOCAL_AUDIT_JS, auditArgs, 'local-audit');

  // Parse audit report
  let auditReport = null;
  const reportDir = join(ROOT, 'data', 'audit', 'local-audit');
  const reportFile = join(reportDir, channelId + '-' + basename(video, '.mp4') + '-audit.json');
  if (existsSync(reportFile)) {
    try {
      auditReport = JSON.parse(readFileSync(reportFile, 'utf-8'));
    } catch {}
  }

  const risk = auditReport?.risk || 'UNKNOWN';
  console.log('\nAudit risk level: ' + risk);

  // Phase 2: Risk-based Gemini review
  if (risk === 'NORMAL') {
    console.log('\n=== PHASE 2: SKIPPED (NORMAL risk) ===');
    console.log('Local audit passed. No Gemini review needed.');
    console.log('\n=== FINAL RESULT: APPROVED ===');
    writeFileSync(join(reportDir, channelId + '-' + basename(video, '.mp4') + '-review.json'),
      JSON.stringify({
        video,
        channel: channelId,
        risk,
        localAudit: auditReport?.summary || {},
        geminiReview: 'SKIPPED',
        verdict: 'APPROVED',
        reason: 'Local deterministic audit passed - no Gemini tokens spent',
      }, null, 2) + '\n');
    process.exit(0);
  }

  // MEDIUM or HIGH risk: run Gemini review
  console.log('\n=== PHASE 2: GEMINI REVIEW (' + risk + ' risk) ===\n');

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!geminiKey) {
    console.log('No Gemini API key - skipping Gemini review.');
    console.log('Verdict: CONDITIONAL (local audit ' + risk + ', no Gemini available)');
    process.exit(risk === 'HIGH' ? 1 : 0);
  }

  const reviewArgs = ['--video', video, '--script', join(ROOT, 'data', 'research', channelId)];
  // Find the script file
  const researchDir = join(ROOT, 'data', 'research', channelId);
  if (existsSync(researchDir)) {
    const scripts = require('node:fs').readdirSync(researchDir)
      .filter(f => f.endsWith('-script.json'));
    if (scripts.length > 0) {
      reviewArgs[3] = join(researchDir, scripts[0]);
    }
  }
  reviewArgs.push('--channel', channelId, '--fix');

  const reviewResult = runScript(GEMINI_REVIEW_JS, reviewArgs, 'gemini-review');

  // Parse Gemini review result
  let geminiVerdict = 'UNKNOWN';
  const reviewDir = join(ROOT, 'data', 'audit', 'gemini-review');
  if (existsSync(reviewDir)) {
    const reports = require('node:fs').readdirSync(reviewDir)
      .filter(f => f.includes(channelId) && f.endsWith('.json'))
      .sort().reverse();
    if (reports.length > 0) {
      try {
        const report = JSON.parse(readFileSync(join(reviewDir, reports[0]), 'utf-8'));
        geminiVerdict = report.wholeVideoResult?.verdict || report.verdict || 'UNKNOWN';
      } catch {}
    }
  }

  console.log('\n=== FINAL RESULT ===');
  console.log('  Local audit risk: ' + risk);
  console.log('  Gemini verdict: ' + geminiVerdict);

  const finalVerdict = geminiVerdict === 'APPROVED' ? 'APPROVED' :
    geminiVerdict === 'NEEDS_IMPROVEMENT' ? 'NEEDS_CORRECTION' : 'REJECTED';

  console.log('  Final: ' + finalVerdict);

  // Write combined report
  writeFileSync(join(reportDir, channelId + '-' + basename(video, '.mp4') + '-review.json'),
    JSON.stringify({
      video,
      channel: channelId,
      risk,
      localAudit: auditReport?.summary || {},
      geminiReview: geminiVerdict,
      verdict: finalVerdict,
    }, null, 2) + '\n');

  process.exit(finalVerdict === 'REJECTED' ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal: ' + e.message);
  process.exit(1);
});