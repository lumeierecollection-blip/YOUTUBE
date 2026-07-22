/**
 * Motion Graphics Script Template
 *
 * Visual style: Animated diagrams, illustrated explainers, data visualization
 * Voiceover pacing: 140–150 WPM
 * Mood: Educational, visually dynamic, information-forward
 */

export default function motionGraphics({ topic, keyFacts, strongestAngle, tone, niche, channelName, colors, font }) {

  const hookFact = keyFacts[0]?.fact || topic;
  const secondFact = keyFacts[1]?.fact || '';
  const thirdFact = keyFacts[2]?.fact || '';

  const sections = [
    // ── HOOK ──────────────────────────────────────────────
    {
      id: 'hook',
      timing: '0:00–0:30',
      word_count: 50,
      voiceover: `Here's what ${topic.toLowerCase()} actually looks like. And it's not what you'd expect.`,
      visual_cue: `Animated illustration zooms in from a wide view to a specific detail. Camera motion is smooth — no hard cuts in the first 15 seconds. Background: ${colors.bg}. Accent elements in ${colors.accent}.`,
      sfx_cue: 'Soft whoosh on zoom-in. Subtle electronic hum. Clean, modern sound palette.',
      b_roll: [],
      text_overlay: null,
      animation_cue: {
        element: 'hero illustration',
        action: 'scale from 200% to 100% over 5 seconds, slight rotation correction',
        timing: '0:00–0:05: blank, 0:05–0:15: zoom, 0:15–0:30: hold with subtle breathing motion',
      },
      transition_out: 'Hero illustration scales to 80% and shifts left. New element enters from right.',
      pacing_notes: 'Voiceover begins at 0:05 after blank screen builds anticipation. Delivery is measured, inviting. Not urgent — curious.',
    },

    // ── SECTION 1: THE OVERVIEW ───────────────────────────
    {
      id: 'section_1',
      timing: '0:30–3:00',
      word_count: 350,
      voiceover: `${strongestAngle}. To understand why, you need to see how this actually works.\n\n${hookFact}\n\n${secondFact}\n\nEach of these elements connects. And the connections are what make this story worth telling.`,
      visual_cue: `Animated flow diagram builds step by step. Each node appears as voiceover mentions it. Connecting lines draw in with ${colors.accent} color. Background stays ${colors.bg}.`,
      sfx_cue: 'Soft click on each node appear. Gentle whoosh on connecting line draws. Ambient electronic pad underneath.',
      b_roll: [],
      text_overlay: null,
      animation_cue: {
        element: 'flow diagram',
        action: 'nodes appear sequentially with connecting lines drawing between them',
        timing: 'node 1 at 0:45, node 2 at 1:30, node 3 at 2:15, connections fill by 2:45',
        style: `nodes: ${colors.secondary} fill, ${colors.accent} border; lines: ${colors.accent}, 2px, animated dash`,
      },
      transition_out: 'Full diagram holds 2 seconds, then all elements scale down and fade. Clean slate for Section 2.',
      pacing_notes: 'Voiceover waits for each node to fully appear before naming it. The diagram IS the explanation — voiceover supports, not leads. Pause 1 second after "worth telling."',
    },

    // ── SECTION 2: THE DEEP DIVE ──────────────────────────
    {
      id: 'section_2',
      timing: '3:00–5:30',
      word_count: 350,
      voiceover: `Now here's where it gets interesting.\n\n${thirdFact || keyFacts[3]?.fact || 'The data tells a different story.'}\n\nLook at this. ${keyFacts[4]?.fact || 'The numbers don\'t lie.'}\n\nWhen you see it laid out like this, the pattern is obvious.`,
      visual_cue: `Animated bar chart or timeline builds across screen. Data points animate on with counter effects. Color coding uses ${colors.accent} for key data, ${colors.secondary} for baseline. Final data point highlights and pulses.`,
      sfx_cue: 'Counter tick sounds as numbers animate. Rising pitch as chart builds. Bass hit on final data point reveal.',
      b_roll: [],
      text_overlay: null,
      animation_cue: {
        element: 'data visualization (bar chart or timeline)',
        action: 'bars grow from baseline, or timeline fills left to right',
        timing: 'chart appears 3:10, data point 1 at 3:30, data point 2 at 4:15, data point 3 at 5:00, highlight pulse at 5:15',
        style: `bars: ${colors.accent} gradient; labels: white on ${colors.bg}; highlight: ${colors.accent} glow`,
      },
      transition_out: 'Chart scales to 60% and shifts to background. New element enters foreground.',
      pacing_notes: 'Voiceover says "Look at this" BEFORE the data appears — let viewer look first, then explain. Speed up slightly through middle data points. Slow down for the pattern observation.',
    },

    // ── SECTION 3: THE IMPLICATION ────────────────────────
    {
      id: 'section_3',
      timing: '5:30–7:30',
      word_count: 280,
      voiceover: `So what does this all mean?\n\nIt means the way we think about ${topic.toLowerCase()} is fundamentally incomplete.\n\nThe real picture is more complex. And more interesting.\n\nHere's the full map.`,
      visual_cue: `All previous diagram elements return and connect into a single comprehensive illustration. The "aha moment" visual — everything clicks into place. Final frame is the complete picture.`,
      sfx_cue: 'Soft harmonic convergence sound as elements unite. Brief silence. Then ambient pad returns warmly.',
      b_roll: [],
      text_overlay: null,
      animation_cue: {
        element: 'composite illustration',
        action: 'all previous elements scale in from edges and connect at center',
        timing: 'elements fly in 5:35–6:00, connection completes at 6:15, hold full illustration until 7:15, begin fade at 7:20',
        style: `${colors.accent} connecting lines, ${colors.secondary} element fills, center hub in white`,
      },
      transition_out: 'Full illustration fades to 30% opacity. Channel branding fades in over it.',
      pacing_notes: 'This is the payoff. Let the visual do the work. Voiceover steps back — fewer words, more silence. Final sentence is the thesis statement. Deliver it with weight.',
    },
  ];

  // ── CLOSE ──────────────────────────────────────────────
  const close = {
    id: 'close',
    timing: '7:30–8:30',
    word_count: 60,
    voiceover: `That's ${topic.toLowerCase()}. The full picture.\n\nSubscribe for the next deep dive.`,
    visual_cue: `Complete illustration holds as background. Channel logo fades in centered. End screen cards appear below. Hold for 8 seconds.`,
    sfx_cue: 'Warm ambient pad continues. Fades to silence over final 3 seconds.',
    b_roll: [],
    text_overlay: {
      text: channelName.toUpperCase(),
      font,
      size: '64px',
      color: '#FFFFFF',
      bg: 'transparent',
      animation: 'fade-in, hold',
    },
    animation_cue: {
      element: 'end screen layout',
      action: 'logo center, video cards below, subscribe button animation',
      timing: 'logo at 7:35, cards at 7:45, hold to 8:30',
    },
    transition_out: 'Fade to black.',
    pacing_notes: 'Two sentences. First sentence names the topic — clean summary. Second sentence is the CTA. No extra words.',
  };

  sections.push(close);

  return {
    channel_id: '',
    topic,
    topic_slug: '',
    sections,
    cta_primary: {
      placement: 'section_2_start',
      text: 'If you want more breakdowns like this, subscribe.',
    },
    cta_secondary: {
      placement: 'close',
      text: 'Subscribe for the next deep dive.',
    },
    production_notes: `Visual style: Motion graphics. Colors: ${colors.primary} primary, ${colors.secondary} secondary, ${colors.accent} accent. Font: ${font} for all text overlays. All visuals are animated illustrations — no stock footage. Key animations: flow diagram (Section 1), data chart (Section 2), composite illustration (Section 3). Total animated elements: ~20. Voiceover tone: ${tone}. Animations must be pre-built as Remotion components before script recording. Voiceover pacing must match animation timing exactly — script is animation-locked.`,
  };
}
