#!/usr/bin/env node

/**
 * Script Pipeline — Runner
 * 
 * Orchestrates the script generation pipeline:
 * 1. Reads channel config
 * 2. Checks topic deduplication
 * 3. Prepares context for agent research
 * 4. Updates topic log after generation
 * 
 * Usage: node src/pipeline/run.js [channel_id] [--batch N]
 * 
 * This script prepares context for the agent. The actual research and
 * script writing is done by the agent following the script-pipeline skill.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT, 'config', 'channels.json');
const TOPIC_LOG_PATH = path.join(ROOT, 'data', 'topic-log.json');
const HOOK_TEMPLATES_PATH = path.join(ROOT, 'data', 'hook-templates.json');
const SCRIPTS_DIR = path.join(ROOT, 'data', 'scripts');

// --- Helpers ---

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function generateSlug(text, maxLen = 60) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLen)
    .replace(/-$/, '');
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);
  const batchMode = args.includes('--batch');
  const batchCount = batchMode ? parseInt(args[args.indexOf('--batch') + 1] || '5') : 1;

  // Check for flags first
  if (args.includes('--list') || args.includes('--status')) {
    const config = loadJSON(CONFIG_PATH);
    const topicLog = loadJSON(TOPIC_LOG_PATH);

    if (args.includes('--list')) {
      console.log('\n=== ALL CHANNELS ===\n');
      for (const ch of config.channels) {
        const used = topicLog.channels[ch.id]?.used_topics?.length || 0;
        const status = used === 0 ? 'FRESH' : `${used} topics`;
        console.log(`  ${String(ch.id).padStart(2, '0')}. ${ch.channel_name.padEnd(25)} | ${ch.style.padEnd(20)} | RPM $${ch.estimated_rpm.padEnd(5)} | ${status}`);
      }
      console.log(`\nTotal: ${config.channels.length} channels`);
      process.exit(0);
    }

    if (args.includes('--status')) {
      console.log('\n=== TOPIC LOG STATUS ===\n');
      let totalTopics = 0;
      let channelsWithTopics = 0;
      for (const [id, data] of Object.entries(topicLog.channels)) {
        const count = data.used_topics?.length || 0;
        totalTopics += count;
        if (count > 0) channelsWithTopics++;
      }
      console.log(`  Channels with topics: ${channelsWithTopics} / ${Object.keys(topicLog.channels).length}`);
      console.log(`  Total topics used: ${totalTopics}`);
      console.log(`  Topics available: ${Object.keys(topicLog.channels).length * 20 - totalTopics}+ (estimated)`);
      process.exit(0);
    }
  }

  const channelId = args.find(a => !a.startsWith('--'));

  if (!channelId && !batchMode) {
    console.log('Usage:');
    console.log('  node src/pipeline/run.cjs <channel_id>          # Generate for one channel');
    console.log('  node src/pipeline/run.cjs --batch <N>            # Generate for N random channels');
    console.log('  node src/pipeline/run.cjs --list                 # List all channels');
    console.log('  node src/pipeline/run.cjs --status               # Show topic log stats');
    process.exit(0);
  }

  const config = loadJSON(CONFIG_PATH);
  const topicLog = loadJSON(TOPIC_LOG_PATH);
  const hookTemplates = loadJSON(HOOK_TEMPLATES_PATH);

  // List mode
  if (channelId === '--list') {
    console.log('\n=== ALL CHANNELS ===\n');
    for (const ch of config.channels) {
      const used = topicLog.channels[ch.id]?.used_topics?.length || 0;
      const status = used === 0 ? 'FRESH' : `${used} topics`;
      console.log(`  ${String(ch.id).padStart(2, '0')}. ${ch.channel_name.padEnd(25)} | ${ch.style.padEnd(20)} | RPM $${ch.estimated_rpm.padEnd(5)} | ${status}`);
    }
    console.log(`\nTotal: ${config.channels.length} channels`);
    process.exit(0);
  }

  // Status mode
  if (channelId === '--status') {
    console.log('\n=== TOPIC LOG STATUS ===\n');
    let totalTopics = 0;
    let channelsWithTopics = 0;
    for (const [id, data] of Object.entries(topicLog.channels)) {
      const count = data.used_topics?.length || 0;
      totalTopics += count;
      if (count > 0) channelsWithTopics++;
    }
    console.log(`  Channels with topics: ${channelsWithTopics} / ${Object.keys(topicLog.channels).length}`);
    console.log(`  Total topics used: ${totalTopics}`);
    console.log(`  Topics available: ${Object.keys(topicLog.channels).length * 20 - totalTopics}+ (estimated)`);
    process.exit(0);
  }

  // Batch mode
  if (batchMode) {
    const available = config.channels.filter(ch => {
      const used = topicLog.channels[ch.id]?.used_topics?.length || 0;
      return used < 20; // Skip channels with too many topics already
    });
    
    const shuffled = available.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, batchCount);

    console.log(`\n=== BATCH MODE: ${selected.length} channels ===\n`);
    for (const ch of selected) {
      generateForChannel(ch, topicLog, hookTemplates, config);
    }
    process.exit(0);
  }

  // Single channel mode
  const ch = config.channels.find(c => String(c.id) === String(channelId));
  if (!ch) {
    console.error(`Channel ${channelId} not found in config`);
    process.exit(1);
  }

  generateForChannel(ch, topicLog, hookTemplates, config);
}

function generateForChannel(channel, topicLog, hookTemplates, config) {
  const chId = String(channel.id);
  const logEntry = topicLog.channels[chId] || { used_topics: [], last_generated: null };
  const hookMapping = hookTemplates.niche_hook_mapping[chId] || { primary: ['specific-result'], secondary: ['question'] };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`CHANNEL: ${channel.channel_name} (${chId})`);
  console.log(`NICHE: ${channel.niche}`);
  console.log(`STYLE: ${channel.style}`);
  console.log(`TONE: ${channel.tone}`);
  console.log(`RPM: $${channel.estimated_rpm}`);
  console.log(`${'='.repeat(60)}`);

  // Topic deduplication
  console.log(`\n--- TOPIC HISTORY ---`);
  if (logEntry.used_topics.length === 0) {
    console.log('  No previous topics. All topics available.');
  } else {
    console.log(`  Used topics (${logEntry.used_topics.length}):`);
    logEntry.used_topics.forEach(t => console.log(`    - ${t}`));
  }

  // Hook templates
  console.log(`\n--- HOOK STRATEGY ---`);
  console.log(`  Primary hooks: ${hookMapping.primary.join(', ')}`);
  console.log(`  Secondary hooks: ${hookMapping.secondary.join(', ')}`);

  // Get hook formulas
  const primaryHookType = hookMapping.primary[0];
  const hookFormula = hookTemplates.hook_rankings.find(h => h.type === primaryHookType);
  if (hookFormula) {
    console.log(`  Primary formula (${hookFormula.type}, ${hookFormula.avg_retention_30sec}% retention):`);
    console.log(`    "${hookFormula.formula}"`);
    console.log(`  Examples:`);
    hookFormula.examples.forEach(e => console.log(`    - "${e}"`));
  }

  // Content pillars
  console.log(`\n--- CONTENT PILLARS ---`);
  channel.content_pillars.forEach(p => console.log(`  - ${p}`));

  // Retention techniques
  console.log(`\n--- RETENTION TECHNIQUES ---`);
  console.log('  Micro-loops: Place at end of each section to prevent drop-off');
  console.log('  Pattern interrupts: Every 60-90 seconds');
  console.log('  Strategic silence: 750-1500ms after major reveals');
  console.log('  Callback close: Repeat hook phrase in final line');
  console.log('  Stats with context: Number → pause → contextualize');

  // Instructions for agent
  console.log(`\n--- AGENT INSTRUCTIONS ---`);
  console.log(`To generate a script for this channel:`);
  console.log(`1. Run 3-4 research passes on the niche (deep-research skill)`);
  console.log(`2. Filter out used topics: [${logEntry.used_topics.join(', ')}]`);
  console.log(`3. Select topic with highest hook potential`);
  console.log(`4. Generate 3 hook variations using "${primaryHookType}" formula`);
  console.log(`5. Write full script following script-pipeline WORKFLOW.md`);
  console.log(`6. Save to: data/scripts/${chId}/<topic-slug>.json`);
  console.log(`7. Update topic-log.json with new topic`);
  console.log(`\n  Script structure: hook (0:00-0:30) → section_1 → section_2 → section_3 → close`);
  console.log(`  Target: 1,000-1,700 words, 8-12 minutes`);
}

main();
