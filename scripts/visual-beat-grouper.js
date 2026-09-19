#!/usr/bin/env node
/**
 * visual-beat-grouper.js - Deterministic SRT to visual beat grouping.
 *
 * Clusters SRT cues into coherent visual events using sentence boundaries,
 * pauses, semantic continuity, and timing constraints.
 * Saves Gemini tokens: 10-16 grouped beats instead of 45+ individual cues.
 *
 * Usage: node scripts/visual-beat-grouper.js --srt FILE [--channel ID] [--out FILE]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const STYLE_TIMING = {
  'cinematic-documentary': { minBeat: 4.0, maxBeat: 8.0, pauseThreshold: 0.4 },
  'motion-graphics':       { minBeat: 2.5, maxBeat: 6.0, pauseThreshold: 0.25 },
  minimal:                 { minBeat: 3.0, maxBeat: 7.0, pauseThreshold: 0.35 },
};

function parseSrt(srtText) {
  const blocks = srtText.replace(/\r\n/g, '\n').split(/\n\n+/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const match = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;
    const start = parseInt(match[1])*3600 + parseInt(match[2])*60 + parseInt(match[3]) + parseInt(match[4])/1000;
    const end = parseInt(match[5])*3600 + parseInt(match[6])*60 + parseInt(match[7]) + parseInt(match[8])/1000;
    const text = lines.slice(2).join(' ').trim();
    if (text.length > 0) cues.push({ start, end, text });
  }
  return cues;
}

function hasSentenceEnd(text) { return /[.!?]\s*$/.test(text.trim()); }
function hasClauseEnd(text) { return /[,;:\u2014\u2013]\s*$/.test(text.trim()); }
function wordCount(text) { return text.split(/\s+/).filter(Boolean).length; }

function sharedWords(a, b) {
  const wA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/));
  const wB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/));
  let n = 0;
  for (const w of wA) { if (wB.has(w) && w.length > 2) n++; }
  return n;
}

export function groupCuesIntoBeats(cues, opts = {}) {
  if (cues.length === 0) return [];
  const { minBeat = 3.0, maxBeat = 8.0, pauseThreshold = 0.35 } = opts;

  // Step 1: Find natural break points
  const breaks = [0];
  for (let i = 0; i < cues.length - 1; i++) {
    const gap = cues[i+1].start - cues[i].end;
    const dur = cues[i].end - cues[i].start;
    const sent = hasSentenceEnd(cues[i].text);
    const clause = hasClauseEnd(cues[i].text);
    if (gap >= pauseThreshold * 1.5) breaks.push(i+1);
    else if (sent && dur >= minBeat * 0.8) breaks.push(i+1);
    else if (clause && gap >= pauseThreshold * 0.5) breaks.push(i+1);
  }
  breaks.push(cues.length);

  // Step 2: Merge short beats
  const ranges = [];
  let rs = breaks[0];
  for (let b = 1; b < breaks.length; b++) {
    const re = breaks[b];
    const dur = cues[re-1].end - cues[rs].start;
    if (dur < minBeat && re < cues.length) continue;
    ranges.push({ start: rs, end: re });
    rs = re;
  }

  // Step 3: Split long beats at sentence boundaries
  const finalRanges = [];
  for (const r of ranges) {
    const dur = cues[r.end-1].end - cues[r.start].start;
    if (dur <= maxBeat) { finalRanges.push(r); continue; }
    let ss = r.start;
    for (let i = r.start; i < r.end; i++) {
      const d = cues[i].end - cues[ss].start;
      if (hasSentenceEnd(cues[i].text) && d >= minBeat && i+1 < r.end) {
        finalRanges.push({ start: ss, end: i+1 });
        ss = i+1;
      }
    }
    if (ss < r.end) finalRanges.push({ start: ss, end: r.end });
  }

  // Step 4: Build beat objects
  const beats = finalRanges.map((r, i) => {
    const bc = cues.slice(r.start, r.end);
    const transcript = bc.map(c => c.text).join(' ');
    const start = bc[0].start;
    const end = bc[bc.length-1].end;
    const purpose = i === 0 ? 'hook' : i === finalRanges.length-1 ? 'closing' : hasSentenceEnd(transcript) ? 'statement' : 'continuation';
    return {
      index: i,
      start: Math.round(start*1000)/1000,
      end: Math.round(end*1000)/1000,
      duration: Math.round((end-start)*1000)/1000,
      transcript,
      words: wordCount(transcript),
      cue_indices: Array.from({length: r.end-r.start}, (_,j) => r.start+j),
      purpose,
    };
  });

  // Step 5: Merge similar adjacent beats
  if (beats.length > 1) {
    const merged = [beats[0]];
    for (let i = 1; i < beats.length; i++) {
      const prev = merged[merged.length-1];
      const curr = beats[i];
      if (curr.end - prev.start <= maxBeat && sharedWords(prev.transcript, curr.transcript) >= 2) {
        prev.end = curr.end;
        prev.duration = prev.end - prev.start;
        prev.transcript += ' ' + curr.transcript;
        prev.words = wordCount(prev.transcript);
        prev.cue_indices = [...prev.cue_indices, ...curr.cue_indices];
      } else {
        merged.push(curr);
      }
    }
    merged.forEach((b, i) => b.index = i);
    return merged;
  }
  return beats;
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf('--' + name);
  if (i > -1 && process.argv[i+1]) return process.argv[i+1];
  const eq = process.argv.find(a => a.startsWith('--' + name + '='));
  return eq ? eq.split('=').slice(1).join('=') : fallback;
}

function main() {
  const srtPath = arg('srt');
  const channelId = arg('channel');
  const outPath = arg('out');
  if (!srtPath) {
    console.error('Usage: visual-beat-grouper.js --srt FILE [--channel ID] [--out FILE]');
    process.exit(2);
  }
  let timing = {};
  if (channelId) {
    try {
      const config = JSON.parse(readFileSync(join(ROOT, 'config', 'channels.json'), 'utf-8'));
      const ch = config.channels.find(c => String(c.id) === String(channelId));
      if (ch && ch.style && STYLE_TIMING[ch.style]) timing = STYLE_TIMING[ch.style];
    } catch {}
  }
  const srtText = readFileSync(srtPath, 'utf-8');
  const cues = parseSrt(srtText);
  if (cues.length === 0) { console.error('No cues found.'); process.exit(1); }
  const totalDuration = cues[cues.length-1].end - cues[0].start;
  const totalWords = cues.reduce((s,c) => s + wordCount(c.text), 0);
  console.error('SRT: ' + cues.length + ' cues, ' + totalDuration.toFixed(1) + 's, ' + totalWords + ' words');
  const beats = groupCuesIntoBeats(cues, {
    minBeat: parseFloat(arg('min-beat', String(timing.minBeat || 3.0))),
    maxBeat: parseFloat(arg('max-beat', String(timing.maxBeat || 8.0))),
    pauseThreshold: parseFloat(arg('pause', String(timing.pauseThreshold || 0.35))),
  });
  const result = {
    generatedAt: new Date().toISOString(),
    srtFile: srtPath, channelId: channelId || null,
    totalCues: cues.length,
    totalDuration: Math.round(totalDuration*1000)/1000,
    totalWords, beatCount: beats.length,
    tokenSavings: Math.round((1 - beats.length/cues.length)*100) + '%',
    beats,
  };
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log('Written: ' + outPath);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  console.error('Grouped ' + cues.length + ' cues -> ' + beats.length + ' beats');
  for (const b of beats) {
    console.error('  [' + b.index + '] ' + b.start.toFixed(1) + 's-' + b.end.toFixed(1) + 's: "' + b.transcript.slice(0, 60) + '"');
  }
}

const _entry = process.argv[1] || ""; if (_entry.includes("visual-beat-grouper")) { main(); }
