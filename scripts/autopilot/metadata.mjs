/** Title, description and hashtags. The title has to promise only what the script says. */
import { StageError, askJson, readJson } from "./lib.mjs";

export async function buildMetadata({ channel, topic, script, attributions }) {
  const data = readJson(script.scriptPath);
  const narration = data.sections.map((s) => s.voiceover).join(" ");
  const seo = await askJson(`Write YouTube Shorts metadata for "${channel.name}".
Narration of the video, which is everything the video delivers:
${narration}

Rules: title max 70 characters, curiosity-driven but it must promise only what the narration delivers. No all-caps words, no "you won't believe". Description: 2 accurate sentences summarising the narration. 3-5 hashtags, no spaces inside a tag. Tags: up to 8 search terms.
Return JSON: {"title":"","description":"","hashtags":["#One"],"tags":[""]}`, "autopilot-metadata");
  if (!seo.title || seo.title.length > 100) throw new StageError("metadata", `unusable title: ${seo.title}`);
  const hashtags = (seo.hashtags || []).map((h) => `#${String(h).replace(/[^\p{L}\p{N}]/gu, "")}`).filter((h) => h.length > 1).slice(0, 5);
  if (hashtags.length < 2) throw new StageError("metadata", "fewer than 2 usable hashtags");
  const sources = (data.sources_used || []).slice(0, 5).map((s) => `- ${s}`).join("\n");
  const credits = (attributions || []).length ? `\n\nImage credits:\n${attributions.map((a) => `- ${a}`).join("\n")}` : "";
  // YouTube rejects angle brackets, and caps descriptions at 5000 bytes.
  const description = `${String(seo.description).trim()}\n\n${hashtags.join(" ")}\n\nSources:\n${sources}${credits}`.replace(/[<>]/g, "").slice(0, 4900);
  return { title: seo.title.replace(/[<>]/g, "").trim(), description, tags: (seo.tags || []).map(String).slice(0, 8), hashtags };
}
