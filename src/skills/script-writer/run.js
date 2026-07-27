#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');

const templates = {
  'cinematic-documentary': () => import('./templates/cinematic-documentary.js'),
  'minimal': () => import('./templates/minimal.js'),
  'motion-graphics': () => import('./templates/motion-graphics.js'),
};

function usage() {
  console.error('Usage: node run.js <channel-id> [topic-slug]');
  console.error('  channel-id  e.g. ch-01, ch-02');
  console.error('  topic-slug  optional — generate script for a specific research file');
  process.exit(1);
}

function loadChannelsConfig() {
  const configPath = join(ROOT, 'config', 'channels.json');
  if (!existsSync(configPath)) {
    console.error(`Channel config not found: ${configPath}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function findChannel(channels, channelId) {
  const numId = parseInt(channelId, 10);
  const ch = channels.find(c => c.id === numId || c.channel_id === channelId);
  if (!ch) {
    console.error(`Channel "${channelId}" not found in channels.json`);
    process.exit(1);
  }
  return ch;
}

function findResearchFiles(channelId) {
  const dir = join(ROOT, 'data', 'research', channelId);
  if (!existsSync(dir)) {
    console.error(`Research directory not found: ${dir}`);
    process.exit(1);
  }
  return readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('-script.json'));
}

function loadResearch(channelId, slug) {
  const filePath = join(ROOT, 'data', 'research', channelId, `${slug}.json`);
  if (!existsSync(filePath)) {
    console.error(`Research file not found: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function validateResearch(research) {
  const missing = [];
  if (!research.topic) missing.push('topic');
  if (!research.topic_slug) missing.push('topic_slug');
  if (!research.key_facts || research.key_facts.length === 0) missing.push('key_facts (at least 1)');
  if (!research.strongest_angle) missing.push('strongest_angle');

  if (missing.length > 0) {
    console.error(`Research file is missing required fields: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function calculateDuration(wordCount, style) {
  const wpm = {
    'cinematic-documentary': 135,
    'minimal': 155,
    'motion-graphics': 145,
  };
  const rate = wpm[style] || 140;
  return Math.round((wordCount / rate) * 60);
}

function applyTemplate(templateFn, research, channel) {
  const script = templateFn({
    topic: research.topic,
    keyFacts: research.key_facts,
    strongestAngle: research.strongest_angle,
    tone: channel.tone,
    niche: channel.niche,
    channelName: channel.channel_name,
    colors: channel.colors,
    font: channel.font,
  });

  return script;
}

function addProductionMetadata(script, channel) {
  const totalWords = script.sections.reduce((sum, s) => sum + (s.word_count || 0), 0);
  script.total_words = totalWords;
  script.estimated_duration_seconds = calculateDuration(totalWords, channel.style);
  script.style = channel.style;
  script.tone = channel.tone;
  script.channel_id = String(channel.id);
  return script;
}

function qualityCheck(script) {
  const issues = [];

  const hook = script.sections.find(s => s.id === 'hook');
  if (hook) {
    const hookWords = hook.word_count || wordCount(hook.voiceover);
    if (hookWords > 65) issues.push(`Hook too long: ${hookWords} words (max ~65)`);
    if (/^(So|Now|And|Welcome|Hello)/i.test(hook.voiceover)) {
      issues.push('Hook starts with weak word (So/Now/And/Welcome/Hello)');
    }
  }

  const ctaCount = [script.cta_primary, script.cta_secondary].filter(Boolean).length;
  if (ctaCount > 2) issues.push(`Too many CTAs: ${ctaCount} (max 2)`);

  const first60 = script.sections.slice(0, 2);
  const hookEnd = first60.reduce((sum, s) => sum + (s.word_count || 0), 0);
  const wpm = { 'cinematic-documentary': 135, 'minimal': 155, 'motion-graphics': 145 };
  const rate = wpm[script.style] || 140;
  const secondsToFirstCta = script.cta_primary
    ? (script.sections.findIndex(s => s.id === script.cta_primary.placement?.split('_')[0]) + 1) * 150
    : Infinity;

  for (const section of script.sections) {
    if (/^(So,|Now,|And,)/i.test(section.voiceover || '')) {
      issues.push(`Section "${section.id}" starts with weak connector`);
    }
  }

  if (script.total_words < 900) issues.push(`Script too short: ${script.total_words} words (min 1000)`);
  if (script.total_words > 1300) issues.push(`Script too long: ${script.total_words} words (max 1200)`);

  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  const channelId = args[0];
  const specificSlug = args[1] || null;

  const config = loadChannelsConfig();
  const channel = findChannel(config.channels, channelId);

  console.log(`Channel: ${channel.channel_name} (${channel.channel_id})`);
  console.log(`Style: ${channel.style}`);
  console.log(`Tone: ${channel.tone}`);

  if (!templates[channel.style]) {
    console.error(`No template for style "${channel.style}"`);
    process.exit(1);
  }

  const templateModule = await templates[channel.style]();
  const templateFn = templateModule.default || templateModule;

  const files = specificSlug
    ? [`${specificSlug}.json`]
    : findResearchFiles(channelId);

  if (files.length === 0) {
    console.error('No research files found.');
    process.exit(1);
  }

  const outputDir = join(ROOT, 'data', 'research', channelId);

  for (const file of files) {
    const slug = file.replace('.json', '');
    console.log(`\nProcessing: ${slug}`);

    const research = loadResearch(channelId, slug);
    validateResearch(research);

    let script = applyTemplate(templateFn, research, channel);
    script = addProductionMetadata(script, channel);

    const issues = qualityCheck(script);
    if (issues.length > 0) {
      console.warn('  Quality warnings:');
      issues.forEach(i => console.warn(`    - ${i}`));
    }

    const outputPath = join(outputDir, `${slug}-script.json`);
    writeFileSync(outputPath, JSON.stringify(script, null, 2), 'utf-8');
    console.log(`  Written: ${outputPath}`);
    console.log(`  Words: ${script.total_words}`);
    console.log(`  Est. duration: ${Math.floor(script.estimated_duration_seconds / 60)}:${String(script.estimated_duration_seconds % 60).padStart(2, '0')}`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
