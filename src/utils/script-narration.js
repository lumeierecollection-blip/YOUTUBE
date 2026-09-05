/**
 * Single source of truth for "what actually gets spoken, in what order".
 *
 * Why this exists: `hook` is a top-level field in both script schemas
 * (script.mg.json / script.section.json), separate from `sections[]`, and
 * the style contract defines it as "the first thing spoken". But TTS only
 * ever read `sections[].voiceover`, so **the hook was silently never
 * narrated** — verified against a real rendered video (channel 2,
 * landlord-security-deposit-rights): its 304s voiceover begins with section
 * one's text and contains no trace of the hook that was written for it.
 *
 * Fixing this in TTS alone would desync motion-graphics renders. MG timing
 * comes from proportionalWindows() in compositions/mg-package.js, which
 * splits the measured audio duration across sections by their *word count*.
 * Narrating ~25 extra hook words that no section accounts for would stretch
 * every window, drifting visuals behind audio by roughly the hook's share of
 * the script for the entire video.
 *
 * So both the narration text and the timing model have to agree, and they
 * agree by folding the hook into the first section here — one function, used
 * by src/utils/tts.js (what to speak) and src/skills/remotion-render/render.js
 * (how long each section's visuals last).
 *
 * Folding is additive to section[0].voiceover, so motion-graphics
 * `anchor_token` verification (SCR-03: the token must appear verbatim in its
 * section's voiceover) keeps passing — tokens matched before the fold still
 * match after it.
 */

/**
 * Returns the script's sections with `hook` prepended to the first section's
 * voiceover. Never mutates the input. Returns a plain copy when there is no
 * hook or no sections, so callers can use it unconditionally.
 */
export function narrationSections(script) {
  const sections = Array.isArray(script?.sections) ? script.sections : [];
  const hook = typeof script?.hook === "string" ? script.hook.trim() : "";
  if (!hook || sections.length === 0) return sections.map((s) => ({ ...s }));

  const first = sections[0];
  const firstVo = String(first?.voiceover || "").trim();

  // Idempotent: if the hook is already the opening of section one (a script
  // that repeats it, or a double-application), don't say it twice.
  if (firstVo.startsWith(hook)) return sections.map((s) => ({ ...s }));

  return sections.map((s, i) =>
    i === 0
      ? { ...s, voiceover: firstVo ? `${hook}\n\n${firstVo}` : hook }
      : { ...s }
  );
}
