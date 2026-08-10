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
import { narrationSections } from "./script-narration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");

const MAX_TITLE_LENGTH = 60;
const MAX_DESCRIPTION_FIRST_LINE = 157;
const MIN_DESCRIPTION_WORDS = 200;
const MAX_HASHTAGS = 5;
const MAX_TAGS = 20;

// discover-topics (schemas/topics.json) produces full natural-language
// titles ("What Your Landlord Can Legally Keep From Your Security
// Deposit"), not short keywords — these are filtered out of tags/hashtags
// so real topics don't degrade into tags like "what"/"your"/"from" or a
// hashtag like "#whatyour".
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "of", "to", "in", "on", "with",
  "your", "you", "how", "why", "what", "who", "when", "where", "do", "does",
  "is", "are", "was", "were", "it", "its", "this", "that", "these", "those",
  "vs", "versus", "really", "actually", "so", "their", "they", "we", "our",
  "can", "will", "from", "about", "into", "than", "then",
]);

function significantWords(topic) {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Generate a SEO-optimized title.
 * Rules: primary keyword in first 5 words, under 60 chars, curiosity gap.
 */
function generateTitle(topic, channel) {
  const niche = channel.niche || "";
  const hookType = channel.script_template?.hook_type || "curiosity-gap";
  // Avoid "The The X ..." when the topic itself already starts with "The".
  const topicNoLeadingThe = topic.replace(/^the\s+/i, "");

  // discover-topics already hands us a full, click-worthy title (see
  // schemas/topics.json / prompts/discover-topics.md) — wrapping it in a
  // curiosity-gap template on top only inflates it past the 60-char limit.
  // Use it directly once it's long enough to already read as a title.
  if (topic.trim().length > 40) {
    const t = topic.trim();
    if (t.length <= MAX_TITLE_LENGTH) return t;
    const truncated = t.slice(0, MAX_TITLE_LENGTH - 1).replace(/\s+\S*$/, "");
    return `${truncated}…`;
  }

  // Build title patterns based on hook type
  const patterns = {
    "curiosity-gap": [
      `The ${topicNoLeadingThe} Nobody Talks About`,
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
 * Generate chapter timestamps from a script's real sections.
 *
 * LONGFORM-SPEC.md Rule 1.5: "chapter titles come from the script's section
 * headings — never auto-summarised." There is deliberately no fallback that
 * fabricates generic chapters ("Introduction", "Deep Dive", ...) when
 * sections aren't available — that was a silent fake (a real video's
 * uploaded chapter list, invented rather than derived from what the video
 * actually contains). Callers without real script sections should not call
 * this yet — generate chapters after Stage C, not before.
 *
 * @param sections Real script sections (schema.mg.json / schema.section.json
 *   shape) — each needs `id` (used as the chapter title, kebab-case ->
 *   Title Case) and `voiceover` (used to weight each chapter's share of
 *   totalDurationSeconds proportionally to its actual word count, since
 *   sections are rarely equal length).
 * @param totalDurationSeconds Real video duration (from the rendered
 *   voiceover's measured length) — not a guess.
 */
function generateChapters(sections, totalDurationSeconds) {
  if (!sections || sections.length === 0) {
    throw new Error(
      "generateChapters requires real script sections — no fallback chapters are generated. " +
        "Call this after Stage C has produced a script, passing its sections."
    );
  }
  if (!totalDurationSeconds || totalDurationSeconds <= 0) {
    throw new Error("generateChapters requires a real totalDurationSeconds (from the measured voiceover length).");
  }

  const MIN_CHAPTER_SECONDS = 10; // LONGFORM-SPEC.md LF-10

  const wordCounts = sections.map((s) => String(s.voiceover || "").split(/\s+/).filter(Boolean).length || 1);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);

  const chapters = [];
  let currentTime = 0;
  for (let i = 0; i < sections.length; i++) {
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const timestamp = `${mins}:${secs.toString().padStart(2, "0")}`;

    const title = (sections[i].id || `section-${i + 1}`)
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    chapters.push({ timestamp, title });
    const share = wordCounts[i] / totalWords;
    currentTime += share * totalDurationSeconds;
  }

  // LF-10: merge any chapter shorter than the minimum into the previous one
  // rather than uploading a chapter list YouTube would reject/ignore.
  const merged = [chapters[0]];
  for (let i = 1; i < chapters.length; i++) {
    const [prevM, prevS] = merged[merged.length - 1].timestamp.split(":").map(Number);
    const [curM, curS] = chapters[i].timestamp.split(":").map(Number);
    const gap = (curM * 60 + curS) - (prevM * 60 + prevS);
    if (gap >= MIN_CHAPTER_SECONDS) {
      merged.push(chapters[i]);
    }
  }

  return merged;
}

/**
 * Generate hashtags (3-5 max, never more than 15).
 */
function generateHashtags(topic, channel) {
  const niche = channel.niche || "";
  const topicSlug = significantWords(topic).slice(0, 2).join("");

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

  // Add topic-derived tags (stopwords stripped so a full-sentence topic
  // doesn't turn into tags like "what"/"your"/"from").
  const topicWords = significantWords(topic);
  topicWords.forEach((w) => tags.add(w));

  // Add compound tags
  if (topicWords.length >= 2) {
    tags.add(topicWords.slice(0, 4).join(" "));
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
 *
 * `sections` and `totalDuration` are required, not optional — see
 * generateChapters()'s header note on why there's no fallback.
 */
function generateSEO(topic, channel, sections, totalDuration) {
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

// render.js's WPM targets by style — reused here to estimate duration from
// word count when the real voiceover audio hasn't been measured yet.
const WPM_TARGET = { "cinematic-documentary": 135, "motion-graphics": 155, minimal: 165 };

/**
 * CLI entry point.
 */
function main() {
  const channelId = process.argv[2];
  const topic = process.argv[3];
  const scriptPath = process.argv[4];

  if (!channelId || !topic || !scriptPath) {
    console.error("Usage: node seo.js <channel-id> <topic> <script-path>");
    console.error('Example: node seo.js ch-01 "Bioluminescent Cave Creatures" data/research/1/movile-cave-longform-script.json');
    console.error("A script path is required — chapters are derived from the script's real sections, never fabricated.");
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

  const script = JSON.parse(readFileSync(join(ROOT, ...scriptPath.split(/[\/\\]/)), "utf-8"));
  // Fold the hook in, same as TTS/render do — chapters must line up with the
  // real video, which opens with the hook. See src/utils/script-narration.js.
  const sections = narrationSections(script);
  const totalWords = sections.reduce((sum, s) => sum + String(s.voiceover || "").split(/\s+/).filter(Boolean).length, 0);
  const wpm = WPM_TARGET[channel.style] || 150;
  const totalDuration = (totalWords / wpm) * 60;

  // Generate SEO
  const seo = generateSEO(topic, channel, sections, totalDuration);

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
