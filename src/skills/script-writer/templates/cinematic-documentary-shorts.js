/**
 * Cinematic Documentary — Shorts Template (30-60 seconds)
 *
 * Visual style: Slow pans, archival footage, dramatic reveals (condensed)
 * Voiceover pacing: 130–140 WPM
 * Target: 100-150 words, 45-60 seconds
 * Format: 9:16 vertical
 */

export default function cinematicDocumentaryShorts({ topic, keyFacts, strongestAngle, tone, niche, channelName, colors, font }) {

  const hookFact = keyFacts[0]?.fact || topic;
  const secondFact = keyFacts[1]?.fact || '';

  const sections = [
    // ── HOOK (0:00–0:08) ─────────────────────────────────
    {
      id: 'hook',
      timing: '0:00–0:08',
      word_count: 20,
      voiceover: `${strongestAngle}. Here's what nobody tells you.`,
      visual_cue: `Dramatic zoom on key archival image. Muted color grade (${colors.primary}). Vertical crop — center the most compelling element.`,
      sfx_cue: 'Low sub-bass hit on first frame. Tension drone fades in.',
      b_roll: ['Hero shot of subject, vertically cropped'],
      text_overlay: null,
      transition_out: 'Hard cut',
      pacing_notes: 'First word at 0:01. Fast, urgent delivery.',
    },

    // ── REVEAL (0:08–0:35) ───────────────────────────────
    {
      id: 'reveal',
      timing: '0:08–0:35',
      word_count: 80,
      voiceover: `${hookFact}\n\n${secondFact ? `But here's the part that changes everything: ${secondFact}` : 'And the implications are staggering.'}`,
      visual_cue: `Sequence of 3-4 archival shots, each 3-5 seconds. Slow pans on vertical frames. Color grade shifts darker at the reveal.`,
      sfx_cue: 'Tension builds. Subtle percussion enters. Peak at the reveal line.',
      b_roll: [
        'Archival photo 1 (establishing)',
        'Archival photo 2 (detail)',
        'Archival photo 3 (consequence)',
      ],
      text_overlay: null,
      transition_out: 'Dissolve to final shot',
      pacing_notes: 'Build momentum through facts. Pause 0.5s before "changes everything." Deliver reveal with weight.',
    },

    // ── CLOSE (0:35–0:45) ────────────────────────────────
    {
      id: 'close',
      timing: '0:35–0:45',
      word_count: 20,
      voiceover: `Follow for more stories history forgot.`,
      visual_cue: `Return to hero shot. Channel name overlay in ${font}. End.`,
      sfx_cue: 'Single sustained note, fade out.',
      b_roll: [],
      text_overlay: {
        text: 'FOLLOW FOR MORE',
        font,
        size: '48px',
        color: '#FFFFFF',
        bg: 'rgba(0,0,0,0.6)',
        animation: 'fade-in',
      },
      transition_out: 'Loop point — video repeats',
      pacing_notes: 'Quick, direct CTA. No filler.',
    },
  ];

  return {
    channel_id: '',
    topic,
    topic_slug: '',
    format: 'shorts',
    sections,
    total_words: sections.reduce((sum, s) => sum + s.word_count, 0),
    estimated_duration_seconds: 45,
    cta_primary: {
      placement: 'close',
      text: 'Follow for more.',
    },
    production_notes: `Shorts format: Cinematic documentary style. Colors: ${colors.primary} primary, ${colors.accent} accent. Vertical 9:16. Total B-roll: 4-5 clips. Voiceover tone: ${tone}. Keep it tight — every second counts.`,
  };
}
