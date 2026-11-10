/** Every Short's description must carry hashtags (YouTube shows the first three above the title). Refuses rather than inventing them. */
export function hashtagsOf(description) { return [...String(description || "").matchAll(/(^|\s)(#[A-Za-z0-9_]{2,})/g)].map((m) => m[2]); }
export function assertHashtags(description, { min = 3 } = {}) {
  const tags = hashtagsOf(description);
  if (tags.length < min) throw new Error(`description has ${tags.length} hashtag(s); at least ${min} are required (found: ${tags.join(" ") || "none"})`);
  if (!tags.some((t) => t.toLowerCase() === "#shorts")) throw new Error("description must include #Shorts");
  return tags;
}
