/**
 * Motion Graphics — Shorts Template (30-60 seconds)
 *
 * Visual style: Animated diagrams, illustrated explainers, data visualization
 * Voiceover pacing: 140–150 WPM
 * Target: 90-115 words, exactly 35-45 seconds max (high retention, zero fluff)
 * Format: 9:16 vertical
 */

export default function motionGraphicsShorts({ topic, keyFacts, strongestAngle, tone, niche, channelName, colors, font }) {

  const hookFact = keyFacts[0]?.fact || topic;
  const secondFact = keyFacts[1]?.fact || '';

  const sections = [
    // ── HOOK (0:00–0:08) ─────────────────────────────────
    {
      id: 'hook',
      timing: '0:00–0:08',
      word_count: 18,
      voiceover: `Here's what ${topic.toLowerCase()} actually looks like.`,
      visual_cue: `Animated illustration zooms in from wide to detail. Smooth camera motion. Background: ${colors.bg}. Accent: ${colors.accent}.`,
      sfx_cue: 'Soft whoosh on zoom. Electronic hum.',
      b_roll: [],
      text_overlay: null,
      animation_cue: {
        element: 'hero illustration',
        action: 'scale from 200% to 100% over 3 seconds',
        timing: '0:00–0:03: zoom, 0:03–0:08: hold',
      },
      transition_out: 'Scale down, shift left',
      pacing_notes: 'Voiceover at 0:02. Curious, inviting tone.',
    },

    // ── DATA (0:08–0:32) ─────────────────────────────────
    {
      id: 'data',
      timing: '0:08–0:32',
      word_count: 80,
      voiceover: `${hookFact}\n\n${secondFact || 'The data is clear.'}\n\nWhen you see it like this, the pattern is obvious.`,
      visual_cue: `Animated bar chart or diagram builds vertically. Data points animate on with counter effects. ${colors.accent} for key data. Final element pulses.`,
      sfx_cue: 'Counter ticks as numbers animate. Rising pitch. Bass hit on final reveal.',
      b_roll: [],
      text_overlay: null,
      animation_cue: {
        element: 'data visualization',
        action: 'bars grow upward, labels appear beside each',
        timing: 'chart at 0:10, data 1 at 0:14, data 2 at 0:22, highlight at 0:28',
        style: `bars: ${colors.accent}; labels: white on ${colors.bg}`,
      },
      transition_out: 'Chart scales down',
      pacing_notes: 'Voiceover leads the data. "Look at this" BEFORE visual appears.',
    },

    // ── CLOSE (0:32–0:40) ────────────────────────────────
    {
      id: 'close',
      timing: '0:32–0:40',
      word_count: 15,
      voiceover: `Subscribe for the next breakdown.`,
      visual_cue: `Complete illustration holds. Channel logo fades in. End.`,
      sfx_cue: 'Warm pad, fade out.',
      b_roll: [],
      text_overlay: {
        text: 'SUBSCRIBE',
        font,
        size: '64px',
        color: '#FFFFFF',
        bg: 'transparent',
        animation: 'fade-in',
      },
      animation_cue: {
        element: 'logo',
        action: 'fade-in centered',
        timing: '0:33–0:40',
      },
      transition_out: 'Loop point',
      pacing_notes: 'Two words of CTA. Clean.',
    },
  ];

  return {
    channel_id: '',
    topic,
    topic_slug: '',
    format: 'shorts',
    sections,
    total_words: sections.reduce((sum, s) => sum + s.word_count, 0),
    estimated_duration_seconds: 42,
    cta_primary: {
      placement: 'close',
      text: 'Subscribe for more.',
    },
    production_notes: `Shorts format: Motion graphics. Colors: ${colors.primary} primary, ${colors.secondary} secondary, ${colors.accent} accent. Font: ${font}. Vertical 9:16. All animated illustrations — no stock footage. Voiceover tone: ${tone}. Animation-locked timing.`,
  };
}
