/**
 * Minimal / Kinetic Typography — Shorts Template (30-60 seconds)
 *
 * Visual style: Bold text on dark backgrounds, word-by-word animations
 * Voiceover pacing: 150–160 WPM
 * Target: 100-150 words, 45-60 seconds
 * Format: 9:16 vertical
 */

export default function minimalShorts({ topic, keyFacts, strongestAngle, tone, niche, channelName, colors, font }) {

  const hookFact = keyFacts[0]?.fact || topic;
  const secondFact = keyFacts[1]?.fact || '';

  const sections = [
    // ── HOOK (0:00–0:06) ─────────────────────────────────
    {
      id: 'hook',
      timing: '0:00–0:06',
      word_count: 15,
      voiceover: `You think you know ${topic.toLowerCase()}. You don't.`,
      visual_cue: `Black screen. "${topic.toUpperCase()}" in large ${font} type, centered. Text shakes slightly on last word.`,
      sfx_cue: 'Sharp tick on each word. Silence after "don\'t."',
      b_roll: [],
      text_overlay: {
        text: topic.toUpperCase(),
        font,
        size: '80px',
        color: colors.accent,
        bg: colors.bg,
        animation: 'word-by-word, 0.15s per word',
      },
      transition_out: 'Hard cut to black',
      pacing_notes: 'Start at 0:01. Deadpan delivery. No inflection.',
    },

    // ── PROOF (0:06–0:30) ────────────────────────────────
    {
      id: 'proof',
      timing: '0:06–0:30',
      word_count: 80,
      voiceover: `${hookFact}\n\n${secondFact || 'The numbers are right there. Nobody talks about this.'}\n\nThis is documented.`,
      visual_cue: `Text blocks appear on ${colors.secondary} background. 3-6 words per line, centered. Key terms in ${colors.accent}. Each fact gets its own screen.`,
      sfx_cue: 'Typing sounds as text appears. Bass hit on final fact.',
      b_roll: [],
      text_overlay: [
        {
          text: hookFact.split('.').slice(0, 1)[0] || 'The facts',
          font,
          size: '56px',
          color: colors.accent,
          bg: colors.secondary,
          animation: 'slide-up, 0.3s',
        },
      ],
      transition_out: 'Wipe left to black',
      pacing_notes: 'Fast and punchy. Each sentence is a hammer. No pauses longer than 0.3s.',
    },

    // ── CLOSE (0:30–0:38) ────────────────────────────────
    {
      id: 'close',
      timing: '0:30–0:38',
      word_count: 15,
      voiceover: `Follow if you want the rest.`,
      visual_cue: `Channel name in ${font}, centered on ${colors.bg}. Follow button animation.`,
      sfx_cue: 'Single tone, fade.',
      b_roll: [],
      text_overlay: {
        text: 'FOLLOW',
        font,
        size: '72px',
        color: '#FFFFFF',
        bg: colors.bg,
        animation: 'scale-up from center',
      },
      transition_out: 'Loop point',
      pacing_notes: 'Deadpan. One sentence. End.',
    },
  ];

  return {
    channel_id: '',
    topic,
    topic_slug: '',
    format: 'shorts',
    sections,
    total_words: sections.reduce((sum, s) => sum + s.word_count, 0),
    estimated_duration_seconds: 38,
    cta_primary: {
      placement: 'close',
      text: 'Follow for more.',
    },
    production_notes: `Shorts format: Minimal / kinetic typography. Colors: ${colors.primary} primary, ${colors.secondary} secondary, ${colors.accent} accent. Font: ${font}. Vertical 9:16. No B-roll — all text animations. Voiceover tone: ${tone}. Text sync to voiceover is critical.`,
  };
}
