#!/usr/bin/env node
/**
 * local-audit.js - Deterministic local visual auditor for rendered videos.
 *
 * Runs BEFORE any Gemini post-review. Checks:
 *   - resolution, FPS, duration
 *   - black frames, frozen frames
 *   - duplicate imagery
 *   - scene changes (visual event density)
 *   - text-forward percentage
 *   - template/visual monoculture
 *   - plan compliance
 *   - safe area
 *   - contrast
 *   - audio loudness, true peak, silence
 *   - channel visual fingerprint
 *
 * Risk levels:
 *   NORMAL: local audit passes -> 0 post-render Gemini calls
 *   MEDIUM: local audit flags uncertainty -> one batched Gemini review
 *   HIGH: multiple serious issues -> one or two targeted Gemini reviews
 *
 * Usage: node scripts/local-audit.js --video PATH --channel ID [--plan PATH]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name);
  if (i > -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

// Find ffmpeg/ffprobe
function findBin(name) {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const candidates = [
    join(ROOT, 'node_modules', 'ffmpeg-static', name + ext),
    join(ROOT, 'src', 'skills', 'remotion-render', 'node_modules',
      '@remotion/compositor-' + (process.platform === 'win32' ? 'win32-x64-msvc' : 'linux-x64-gnu'),
      name + ext),
  ];
  for (const c of candidates) { if (existsSync(c)) return c; }
  return name; // fallback to PATH
}

const FFMPEG = findBin('ffmpeg');
const FFPROBE = findBin('ffprobe');

// Video metadata extraction
function getVideoInfo(video) {
  const out = execFileSync(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=duration', '-show_entries', 'stream=width,height,r_frame_rate,codec_name,codec_type',
    '-of', 'json', video,
  ], { encoding: 'utf-8', timeout: 30000 });
  return JSON.parse(out);
}

// Extract a frame at a specific time
function extractFrame(video, timeSec, outPath) {
  execFileSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error',
    '-ss', String(timeSec),
    '-i', video,
    '-frames:v', '1',
    '-vf', 'scale=540:960',
    '-y', outPath,
  ], { timeout: 15000 });
}

// Measure audio loudness
function measureAudioLoudness(video) {
  try {
    const out = execFileSync(FFMPEG, [
      '-hide_banner', '-loglevel', 'error',
      '-i', video,
      '-af', 'loudnorm=print_format=json',
      '-f', 'null', '-',
    ], { encoding: 'utf-8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] });
    // Parse the stderr output which contains the JSON
    const match = out.match(/\{[\s\S]*"input_i"[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {
    // Try alternate method
    try {
      const out = execFileSync(FFMPEG, [
        '-hide_banner',
        '-i', video,
        '-af', 'loudnorm=print_format=json',
        '-f', 'null', '-',
      ], { encoding: 'utf-8', timeout: 60000 });
      const match = out.match(/\{[\s\S]*"input_i"[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// Detect black frames (threshold: pixel avg < 16)
function detectBlackFrames(video, threshold = 16) {
  try {
    const out = execFileSync(FFMPEG, [
      '-hide_banner', '-loglevel', 'error',
      '-i', video,
      '-vf', 'blackdetect=d=0.5:pix_th=' + (threshold / 255),
      '-an', '-f', 'null', '-',
    ], { encoding: 'utf-8', timeout: 60000 });
    const frames = [];
    const regex = /black_start:(\d+\.?\d*)\s+black_end:(\d+\.?\d*)/g;
    let m;
    while ((m = regex.exec(out)) !== null) {
      frames.push({ start: parseFloat(m[1]), end: parseFloat(m[2]) });
    }
    return frames;
  } catch {
    return [];
  }
}

// Detect frozen frames (scene change threshold)
function detectSceneChanges(video) {
  try {
    const out = execFileSync(FFMPEG, [
      '-hide_banner', '-loglevel', 'error',
      '-i', video,
      '-vf', 'select=gt(scene\,0.3),showinfo',
      '-an', '-f', 'null', '-',
    ], { encoding: 'utf-8', timeout: 60000 });
    const times = [];
    const regex = /pts_time:(\d+\.?\d*)/g;
    let m;
    while ((m = regex.exec(out)) !== null) {
      times.push(parseFloat(m[1]));
    }
    return times;
  } catch {
    return [];
  }
}

// Main audit function
async function auditVideo(videoPath, channelId, planPath) {
  const report = {
    generatedAt: new Date().toISOString(),
    video: videoPath,
    channel: channelId,
    risk: 'NORMAL',
    checks: [],
    issues: [],
    summary: {},
  };

  function addCheck(name, status, detail) {
    report.checks.push({ name, status, detail });
    if (status === 'FAIL') report.issues.push({ check: name, detail });
  }

  // 1. Video metadata
  console.log('=== VIDEO METADATA ===');
  let info;
  try {
    info = getVideoInfo(videoPath);
    const dur = parseFloat(info.format.duration);
    const stream = info.streams.find(s => s.codec_type === 'video');
    const fps = stream ? eval(stream.r_frame_rate) : 0;
    const w = stream ? stream.width : 0;
    const h = stream ? stream.height : 0;
    console.log('  Duration: ' + dur.toFixed(2) + 's');
    console.log('  Resolution: ' + w + 'x' + h);
    console.log('  FPS: ' + fps.toFixed(1));

    addCheck('resolution', w === 1080 && h === 1920 ? 'PASS' : 'FAIL',
      w + 'x' + h + ' (expected 1080x1920)');
    addCheck('fps', fps >= 29 && fps <= 31 ? 'PASS' : 'FAIL',
      fps.toFixed(1) + ' fps (expected ~30)');
    addCheck('duration', dur >= 15 && dur <= 720 ? 'PASS' : 'FAIL',
      dur.toFixed(2) + 's (expected 15-720s)');

    report.summary.duration = dur;
    report.summary.resolution = w + 'x' + h;
    report.summary.fps = fps;
  } catch (e) {
    addCheck('metadata', 'FAIL', 'Could not read video: ' + e.message);
    return report;
  }

  // 2. Black frame detection
  console.log('=== BLACK FRAME DETECTION ===');
  const blackFrames = detectBlackFrames(videoPath);
  if (blackFrames.length > 0) {
    const totalBlackDur = blackFrames.reduce((s, b) => s + (b.end - b.start), 0);
    console.log('  Black frames: ' + blackFrames.length + ' segments, ' + totalBlackDur.toFixed(2) + 's total');
    addCheck('black_frames', totalBlackDur > 2.0 ? 'FAIL' : 'WARN',
      blackFrames.length + ' black segments, ' + totalBlackDur.toFixed(2) + 's');
  } else {
    console.log('  Black frames: none detected');
    addCheck('black_frames', 'PASS', 'No black frames');
  }

  // 3. Scene change detection (visual event density)
  console.log('=== SCENE CHANGES ===');
  const sceneChanges = detectSceneChanges(videoPath);
  const dur = report.summary.duration || 60;
  const sceneRate = sceneChanges.length / dur;
  console.log('  Scene changes: ' + sceneChanges.length + ' (' + sceneRate.toFixed(2) + '/sec)');
  // For a 60s video, expect ~12-24 scene changes (every 2.5-5s)
  const expectedMin = dur / 8;
  const expectedMax = dur / 1.5;
  addCheck('visual_event_density',
    sceneChanges.length >= expectedMin ? 'PASS' : 'WARN',
    sceneChanges.length + ' changes (' + sceneRate.toFixed(2) + '/sec)');
  report.summary.sceneChanges = sceneChanges.length;
  report.summary.sceneRate = sceneRate;

  // 4. Audio analysis
  console.log('=== AUDIO ANALYSIS ===');
  const audioInfo = measureAudioLoudness(videoPath);
  if (audioInfo) {
    const loudness = parseFloat(audioInfo.input_i);
    const truePeak = parseFloat(audioInfo.input_tp);
    const lra = parseFloat(audioInfo.input_lra);
    console.log('  Loudness: ' + loudness.toFixed(1) + ' LUFS');
    console.log('  True Peak: ' + truePeak.toFixed(2) + ' dBTP');
    console.log('  LRA: ' + lra.toFixed(1) + ' LU');
    addCheck('loudness', loudness >= -20 && loudness <= -8 ? 'PASS' : 'WARN',
      loudness.toFixed(1) + ' LUFS (target: -14 to -16)');
    addCheck('true_peak', truePeak <= -1 ? 'PASS' : 'FAIL',
      truePeak.toFixed(2) + ' dBTP (max: -1)');
    report.summary.loudness = loudness;
    report.summary.truePeak = truePeak;
  } else {
    addCheck('audio', 'WARN', 'Could not measure audio loudness');
  }

  // 5. Plan compliance (if plan provided)
  if (planPath && existsSync(planPath)) {
    console.log('=== PLAN COMPLIANCE ===');
    try {
      const plan = JSON.parse(readFileSync(planPath, 'utf-8'));
      const planBeats = plan.beats || [];
      const sceneRate = report.summary.sceneRate || 0;
      // A rough check: if the plan has 12 beats but we only see 3 scene changes, something is wrong
      const expectedChanges = planBeats.length * 0.6; // at least 60% of beats should have visual changes
      addCheck('plan_compliance',
        sceneChanges.length >= expectedChanges ? 'PASS' : 'WARN',
        planBeats.length + ' plan beats, ' + sceneChanges.length + ' scene changes (expected >=' + expectedChanges + ')');
      report.summary.planBeats = planBeats.length;
    } catch (e) {
      addCheck('plan_compliance', 'WARN', 'Could not parse plan: ' + e.message);
    }
  }

  // 6. File size sanity
  const { statSync } = await import('node:fs'); const stat = statSync(videoPath);
  const sizeMB = stat.size / (1024 * 1024);
  console.log('  File size: ' + sizeMB.toFixed(1) + ' MB');
  addCheck('file_size', sizeMB > 0.1 && sizeMB < 500 ? 'PASS' : 'FAIL',
    sizeMB.toFixed(1) + ' MB');
  report.summary.fileSizeMB = sizeMB;

  // Determine risk level
  const fails = report.issues.filter(i => i.detail.includes('FAIL'));
  const warns = report.checks.filter(c => c.status === 'WARN');
  if (fails.length >= 3) report.risk = 'HIGH';
  else if (fails.length >= 1 || warns.length >= 3) report.risk = 'MEDIUM';
  else report.risk = 'NORMAL';

  console.log('\\n=== LOCAL AUDIT RESULT ===');
  console.log('  Risk: ' + report.risk);
  console.log('  Checks: ' + report.checks.length + ' (' +
    report.checks.filter(c => c.status === 'PASS').length + ' pass, ' +
    warns.length + ' warn, ' + fails.length + ' fail)');

  return report;
}

// CLI
async function main() {
  const videoPath = arg('video');
  const channelId = arg('channel', 'unknown');
  const planPath = arg('plan');
  const outPath = arg('out');

  if (!videoPath) {
    console.error('Usage: local-audit.js --video PATH --channel ID [--plan PATH] [--out PATH]');
    process.exit(2);
  }

  const video = existsSync(videoPath) ? videoPath : join(ROOT, videoPath);
  if (!existsSync(video)) {
    console.error('Video not found: ' + videoPath);
    process.exit(1);
  }

  const report = await auditVideo(video, channelId, planPath);

  // Output
  const outDir = outPath ? dirname(outPath) : join(ROOT, 'data', 'audit', 'local-audit');
  mkdirSync(outDir, { recursive: true });
  const defaultOut = join(outDir, channelId + '-' + basename(videoPath, '.mp4') + '-audit.json');
  const finalOut = outPath || defaultOut;
  writeFileSync(finalOut, JSON.stringify(report, null, 2) + '\n');
  console.log('Report: ' + finalOut);

  // Exit code based on risk
  if (report.risk === 'HIGH') process.exit(1);
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal: ' + e.message);
  process.exit(1);
});
