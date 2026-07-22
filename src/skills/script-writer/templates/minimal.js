/**
 * Minimal / Kinetic Typography Script Template
 *
 * Visual style: Bold text on dark backgrounds, word-by-word animations, hard cuts
 * Voiceover pacing: 150–160 WPM
 * Mood: Provocative, punchy, information-dense
 */

export default function minimal({ topic, keyFacts, strongestAngle, tone, niche, channelName, colors, font }) {

  const hookFact = keyFacts[0]?.fact || topic;
  const secondFact = keyFacts[1]?.fact || '';
  const thirdFact = keyFacts[2]?.fact || '';

  const sections = [
    // ── HOOK ──────────────────────────────────────────────
    {
      id: 'hook',
      timing: '0:00–0:30',
      word_count: 45,
      voiceover: `${hookFact}. That number should bother you.`,
      visual_cue: `Black screen (${colors.bg}). Single number or keyword from hook fact appears in large ${font} type, centered. Text animates on word-by-word with slight scale-up. No background imagery.`,
      sfx_cue: 'Sharp click or tick on each word appear. Low hum underneath. Hard cut to silence at end of hook.',
      b_roll: [],
      text_overlay: {
        text: hookFact.split(' ').slice(0, 4).join(' '),
        font,
        size: '96px',
        color: colors.accent,
        bg: colors.bg,
        animation: 'word-by-word fade-in, 0.2s per word',
      },
      transition_out: 'Hard cut to black. 0.5 sec. No fade.',
      pacing_notes: 'Start at 0:01. Each word syncs to text animation. Final sentence delivered deadpan. No inflection upward.',
    },

    // ── SECTION 1: THE CLAIM ──────────────────────────────
    {
      id: 'section_1',
      timing: '0:30–3:00',
      word_count: 380,
      voiceover: `Here's what you're not being told.\n\n${hookFact}\n\n${secondFact}\n\nThis isn't opinion. This is documented. And most people have never seen it.`,
      visual_cue: `Background color shifts to ${colors.secondary}. Text appears in clean blocks — 3 to 6 words per line, centered. Key terms highlight in ${colors.accent}. No imagery. Text IS the visual.`,
      sfx_cue: 'Subtle keyboard typing sound as text blocks appear. Low ambient pad. Hard percussive hit on key stat reveal.',
      b_roll: [],
      text_overlay: [
        {
          text: secondFact.split('.').slice(0, 1)[0] || 'The data is clear',
          font,
          size: '64px',
          color: colors.accent,
          bg: colors.secondary,
          animation: 'slide-up from bottom, 0.3s',
        },
        {
          text: 'THIS IS DOCUMENTED',
          font,
          size: '48px',
          color: '#FFFFFF',
          bg: colors.secondary,
          animation: 'scale-up from center, 0.2s',
        },
      ],
      transition_out: 'Text holds for 1 sec, then wipes left. 0.3 sec black.',
      pacing_notes: 'Fast and direct. No pauses longer than 0.5 sec. Every sentence is a punch. Energy stays high.',
    },

    // ── SECTION 2: THE PROOF ─────────────────────────────
    {
      id: 'section_2',
      timing: '3:00–5:30',
      word_count: 380,
      voiceover: `${thirdFact || secondFact || 'The evidence keeps stacking up.'}\n\n${keyFacts[3]?.fact || 'And this pattern repeats across every case.'}\n\nThree sources. All independent. All saying the same thing.`,
      visual_cue: `Background shifts to ${colors.primary}. Evidence appears as numbered list items, each fading in sequentially. Final item highlights with accent color. Minimal but structured.`,
      sfx_cue: 'Rising tone as evidence builds. Subtle bass drop on final item. Brief silence before transition.',
      b_roll: [],
      text_overlay: [
        {
          text: '1',
          font,
          size: '120px',
          color: colors.accent,
          bg: colors.primary,
          animation: 'count-up from 0, 0.5s',
        },
        {
          text: '2',
          font,
          size: '120px',
          color: colors.accent,
          bg: colors.primary,
          animation: 'count-up from 0, 0.5s',
        },
        {
          text: '3',
          font,
          size: '120px',
          color: colors.accent,
          bg: colors.primary,
          animation: 'count-up from 0, 0.5s',
        },
      ],
      transition_out: 'Number holds 1 sec, then hard cut to black.',
      pacing_notes: 'Build momentum through the evidence list. Each point slightly faster than the last. Pause 1 sec after "all saying the same thing" for impact.',
    },

    // ── SECTION 3: THE IMPLICATION ────────────────────────
    {
      id: 'section_3',
      timing: '5:30–7:30',
      word_count: 280,
      voiceover: `So what does this actually mean?\n\nIt means the story you've been told is incomplete. The real version is more complicated, more interesting, and more uncomfortable.\n\nAnd nobody's talking about it.`,
      visual_cue: `Background returns to ${colors.bg}. Single keyword in oversized type fills screen: "COMPLICATED" or "UNCOMFORTABLE". Hold for 3 seconds. Then fade to new text.`,
      sfx_cue: 'Silence for 2 seconds at section open. Ambient pad returns softly. Final sentence lands on silence.',
      b_roll: [],
      text_overlay: {
        text: 'UNCOMFORTABLE',
        font,
        size: '144px',
        color: colors.accent,
        bg: colors.bg,
        animation: 'slow fade-in over 1s, hold 3s',
      },
      transition_out: 'Text fades out. 1 second black.',
      pacing_notes: 'Slowest section. Deliver the question first, then let it breathe. The answer builds. Final sentence is quiet and direct.',
    },
  ];

  // ── CLOSE ──────────────────────────────────────────────
  const close = {
    id: 'close',
    timing: '7:30–8:30',
    word_count: 50,
    voiceover: `The full story. Linked below. Start from the beginning.`,
    visual_cue: `Channel logo or name in ${font}, centered on ${colors.bg}. Below it: end screen video links. Hold for 8 seconds.`,
    sfx_cue: 'Single sustained tone fading to silence.',
    b_roll: [],
    text_overlay: {
      text: channelName.toUpperCase(),
      font,
      size: '72px',
      color: '#FFFFFF',
      bg: colors.bg,
      animation: 'fade-in, hold',
    },
    transition_out: 'Hard cut to black at 8:30.',
    pacing_notes: 'Three short sentences. No filler. No "thanks for watching." Deliver and end.',
  };

  sections.push(close);

  return {
    channel_id: '',
    topic,
    topic_slug: '',
    sections,
    cta_primary: {
      placement: 'section_2_start',
      text: 'Subscribe if you want the rest of the story.',
    },
    cta_secondary: {
      placement: 'close',
      text: 'Full playlist on screen now.',
    },
    production_notes: `Visual style: Minimal / kinetic typography. Colors: ${colors.primary} primary, ${colors.secondary} secondary, ${colors.accent} accent. Font: ${font} throughout. No B-roll footage needed — all visuals are text animations on solid backgrounds. Total text animation keyframes: ~15. Voiceover tone: ${tone}. Text animations must sync precisely to voiceover — timing is critical.`,
  };
}
