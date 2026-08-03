/**
 * SEO Metadata Generator — Produces optimized YouTube metadata.
 *
 * Usage: node src/utils/seo.js <channel-id> <topic-slug>
 * Output: data/research/<channel-id>/<topic>-seo.json
 *
 * Generates: title, description (5-block), tags, chapters, hashtags
 * following 2026 YouTube SEO best practices.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_FIRST_LINE = 157;
const MIN_DESCRIPTION_WORDS = 200;
const MAX_HASHTAGS = 5;
const MAX_TAGS = 20;

/**
 * Generate a SEO-optimized title.
 * Rules: primary keyword in first 5 words, under 60 chars, curiosity gap.
 */
function generateTitle(topic, channel) {
  const niche = channel.niche || "";
  const hookType = channel.script_template?.hook_type || "curiosity-gap";

  // Build title patterns based on hook type
  const patterns = {
    "curiosity-gap": [
      `The ${topic} Nobody Talks About`,
      `Why ${topic} Changes Everything`,
      `What Happens When ${topic}`,
      `${topic}: The Truth Revealed`,
    ],
    "contrarian": [
      `Everything You Know About ${topic} Is Wrong`,
      `${topic} — The Lie Nobody Questions`,
      `Stop Believing These ${topic} Myths`,
    ],
    "scale-wonder": [
      `The Insane Scale of ${topic}`,
      `${topic} By the Numbers Will Shock You`,
      `How ${topic} Actually Works`,
    ],
    "specific-result": [
      `${topic}: A Complete Deep Dive`,
      `Inside the World of ${topic}`,
      `${topic} Explained in Detail`,
    ],
  };

  const options = patterns[hookType] || patterns["curiosity-gap"];

  // Find the best title under the character limit
  let title = options.find((t) => t.length <= MAX_TITLE_LENGTH) || options[0];

  // Ensure primary keyword is in first 5 words
  const words = title.split(/\s+/);
  if (words.length > 5) {
    const topicWords = topic.split(/\s+/);
    const keywordInFirst5 = topicWords.some((tw) =>
      words.slice(0, 5).some((w) => w.toLowerCase().includes(tw.toLowerCase()))
    );
    if (!keywordInFirst5) {
      // Prepend topic keyword
      title = `${topic}: ${title.split(":").pop()?.trim() || title}`;
      if (title.length > MAX_TITLE_LENGTH) {
        title = title.substring(0, MAX_TITLE_LENGTH - 3) + "...";
      }
    }
  }

  return title;
}

/**
 * Generate 5-block description.
 * Block 1: Hook (first 157 chars, keyword-rich)
 * Block 2: Keyword paragraph (150-250 words)
 * Block 3: Chapters/timestamps
 * Block 4: Links and resources
 * Block 5: Hashtags
 */
function generateDescription(topic, channel, chapters = []) {
  const niche = channel.niche || "";
  const nicheSub = channel.niche_sub || "";

  // Block 1: Hook line (visible in search results)
  const hook = `Learn about ${topic} — a deep dive into ${niche.toLowerCase()}${nicheSub ? ` (${nicheSub.toLowerCase()})` : ""}. ${channel.description || ""}`.substring(0, MAX_DESCRIPTION_FIRST_LINE);

  // Block 2: Keyword paragraph
  const keywordPara = buildKeywordParagraph(topic, channel);

  // Block 3: Chapters
  const chapterBlock =
    chapters.length > 0
      ? "\n\n" +
        chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n")
      : "";

  // Block 4: Links
  const linksBlock = "\n\n🔗 Resources & Sources:\n• Research data and references in video\n• Subscribe for more " + niche.toLowerCase() + " content";

  // Block 5: Hashtags
  const hashtags = generateHashtags(topic, channel);

  const fullDescription = `${hook}\n\n${keywordPara}${chapterBlock}${linksBlock}\n\n${hashtags}`;

  return {
    full: fullDescription,
    hook_line: hook,
    keyword_paragraph: keywordPara,
    word_count: fullDescription.split(/\s+/).length,
  };
}

/**
 * Build a keyword-rich paragraph (150-250 words) with natural language.
 */
function buildKeywordParagraph(topic, channel) {
  const niche = channel.niche || "";
  const tags = channel.tags || [];
  const audience = channel.target_audience || "curious viewers";

  // Build natural paragraph incorporating keywords
  const sentences = [
    `This video explores ${topic} in depth, covering the key aspects that ${audience} want to understand.`,
    `We'll examine the facts, history, and significance of ${topic} within the broader context of ${niche.toLowerCase()}.`,
    `From the foundational concepts to the latest developments, this comprehensive guide breaks down ${topic} step by step.`,
  ];

  // Add niche-specific context
  if (tags.length > 0) {
    sentences.push(
      `Whether you're interested in ${tags.slice(0, 3).join(", ")}, or simply want to learn more about ${niche.toLowerCase()}, this video has you covered.`
    );
  }

  sentences.push(
    `Watch until the end for the most important insight about ${topic} that most people miss.`,
    `If you found this helpful, subscribe and hit the bell for more ${niche.toLowerCase()} content every week.`
  );

  return sentences.join(" ");
}

/**
 * Generate chapter timestamps (estimated from script sections).
 */
function generateChapters(sections, totalDurationSeconds = 600) {
  if (!sections || sections.length === 0) {
    // Default chapters for a 10-minute video
    return [
      { timestamp: "0:00", title: "Introduction" },
      { timestamp: "0:30", title: "Context & Background" },
      { timestamp: "2:30", title: "Deep Dive" },
      { timestamp: "5:00", title: "Key Findings" },
      { timestamp: "7:30", title: "Conclusion & Takeaways" },
    ];
  }

  const chapters = [];
  let currentTime = 0;
  const timePerSection = totalDurationSeconds / sections.length;

  for (let i = 0; i < sections.length; i++) {
    const mins = Math.floor(currentTime / 60);
    const secs = currentTime % 60;
    const timestamp = `${mins}:${secs.toString().padStart(2, "0")}`;

    let title = sections[i];
    // Clean up section title
    if (title.startsWith("##")) title = title.replace(/^#+\s*/, "");
    if (title.length > 60) title = title.substring(0, 57) + "...";

    chapters.push({ timestamp, title });
    currentTime += Math.round(timePerSection);
  }

  return chapters;
}

/**
 * Generate hashtags (3-5 max, never more than 15).
 */
function generateHashtags(topic, channel) {
  const niche = channel.niche || "";
  const topicSlug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .join("");

  const nicheSlug = niche
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 1)
    .join("");

  const hashtags = [
    `#${topicSlug.replace(/\s+/g, "")}`,
    `#${nicheSlug.replace(/\s+/g, "")}`,
    "#documentary",
    "#deepdive",
  ].filter((h) => h.length > 1);

  return hashtags.slice(0, MAX_HASHTAGS).join(" ");
}

/**
 * Generate tags (10-20 relevant tags).
 */
function generateTags(topic, channel) {
  const tags = new Set();

  // Add channel's base tags
  (channel.tags || []).forEach((t) => tags.add(t.toLowerCase()));

  // Add topic-derived tags
  const topicWords = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  topicWords.forEach((w) => tags.add(w));

  // Add compound tags
  if (topicWords.length >= 2) {
    tags.add(topicWords.join(" "));
    tags.add(`${topicWords[0]} ${topicWords[1]} explained`);
  }

  // Add niche tags
  const nicheWords = (channel.niche || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  nicheWords.forEach((w) => tags.add(w));

  // Add common variations
  tags.add(`${topic.toLowerCase()} documentary`);
  tags.add(`${topic.toLowerCase()} explained`);
  tags.add(`${topic.toLowerCase()} deep dive`);

  // Convert to array, limit to MAX_TAGS
  return Array.from(tags)
    .filter((t) => t.length > 1 && t.length < 60)
    .slice(0, MAX_TAGS);
}

/**
 * Full SEO metadata generation.
 */
function generateSEO(topic, channel, sections = [], totalDuration = 600) {
  const title = generateTitle(topic, channel);
  const chapters = generateChapters(sections, totalDuration);
  const description = generateDescription(topic, channel, chapters);
  const tags = generateTags(topic, channel);
  const hashtags = generateHashtags(topic, channel);

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    topic,
    channel_id: channel.channel_id,
    title,
    title_length: title.length,
    description: description.full,
    description_hook: description.hook_line,
    description_word_count: description.word_count,
    chapters,
    tags,
    tag_count: tags.length,
    hashtags,
    checklist: {
      title_under_60_chars: title.length <= MAX_TITLE_LENGTH,
      title_has_keyword: title.toLowerCase().includes(topic.split(/\s+/)[0].toLowerCase()),
      description_over_200_words: description.word_count >= MIN_DESCRIPTION_WORDS,
      first_line_under_157_chars: description.hook_line.length <= MAX_DESCRIPTION_FIRST_LINE,
      tags_between_10_20: tags.length >= 10 && tags.length <= 20,
      hashtags_under_5: hashtags.split(/\s+/).length <= MAX_HASHTAGS,
      chapters_start_at_000: chapters[0]?.timestamp === "0:00",
    },
  };
}

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];
  const topic = process.argv[3];

  if (!channelId || !topic) {
    console.error("Usage: node seo.js <channel-id> <topic>");
    console.error('Example: node seo.js ch-01 "Bioluminescent Cave Creatures"');
    process.exit(1);
  }

  // Load channel config
  const channelsPath = join(ROOT, "config", "channels.json");
  const data = JSON.parse(readFileSync(channelsPath, "utf-8"));
  const channels = data.channels || data;
  const numId = parseInt(channelId, 10);
  const channel = channels.find((c) => c.id === numId || c.channel_id === channelId);
  if (!channel) {
    console.error(`Channel "${channelId}" not found`);
    process.exit(1);
  }

  // Generate SEO
  const seo = generateSEO(topic, channel);

  // Save
  const outDir = join(ROOT, "data", "research", channelId);
  mkdirSync(outDir, { recursive: true });

  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const outPath = join(outDir, `${slug}-seo.json`);
  writeFileSync(outPath, JSON.stringify(seo, null, 2));

  console.log(`SEO metadata saved: ${outPath}`);
  console.log(`\nTitle: ${seo.title} (${seo.title_length} chars)`);
  console.log(`Description: ${seo.description_word_count} words`);
  console.log(`Tags: ${seo.tag_count}`);
  console.log(`Hashtags: ${seo.hashtags}`);
  console.log(`Chapters: ${seo.chapters.length}`);

  // Show checklist
  console.log(`\nSEO Checklist:`);
  for (const [key, val] of Object.entries(seo.checklist)) {
    console.log(`  ${val ? "✓" : "✗"} ${key}`);
  }
}

// Export for pipeline use
export { generateSEO, generateTitle, generateDescription, generateChapters, generateTags, generateHashtags };

if (process.argv[1] && process.argv[1].endsWith("seo.js")) main();
