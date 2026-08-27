/**
 * Sound design — visual events, not section starts.
 *
 * PURE module. No model call (this pass adds zero).
 *
 *   VISUAL STATES  ->  [ sound-design.js ]  ->  timed events  ->  <Soundtrack>
 *
 * WHAT THIS REPLACES, AND WHY IT WAS WRONG
 *
 * The previous pass resolved ONE sound per section by keyword-matching the
 * script's free-text `sfx_cue` against file tags, then fired it at the first
 * frame of the section's first beat (mg-package.js attached it as
 * `scene.sfx`; motion-graphics.jsx played it with `at={0}`). Two things were
 * wrong with that, independently:
 *
 *   1. IT FIRED BECAUSE A SECTION BEGAN, not because anything happened on
 *      screen. A boundary could expand, lock, and select twelve devices in
 *      total silence, while a whoosh played over the establishing shot
 *      purely because that was frame zero of the section.
 *
 *   2. IT MATCHED THE NARRATION'S WORDS, NOT THE PICTURE. A cue reading
 *      "low sub-bass drone, distant drip echoes" scored against tags like
 *      "click, ui, button". The result was a plausible-looking lookup whose
 *      output had no relationship to what the viewer was watching.
 *
 * WHAT HAPPENS INSTEAD
 *
 * Visual states already describe real events — a radius expanding, a
 * boundary locking, devices populating, a total resolving. Each strategy
 * declares which of its states are AUDIBLE and what kind of event they are;
 * this module turns those into scheduled events with a role, a chosen asset,
 * a level, and a `reason` string that says why the sound exists at all.
 *
 * RESTRAINT IS A FEATURE
 *
 * Silence is part of sound design. Most states are deliberately silent: a
 * 5-second beat commonly gets one or two events, sometimes none. The caps
 * below (MAX_EVENTS_PER_BEAT, MIN_GAP_FRAMES, no-immediate-repeat) exist to
 * stop the "click click click whoosh click" texture that a per-state sound
 * would otherwise produce.
 */

/** Never more than this many sounds in one beat, however many states it has. */
export const MAX_EVENTS_PER_BEAT = 3;

/** Two sounds closer than this read as one smeared noise, not two events. */
export const MIN_GAP_FRAMES = 12;

/**
 * TARGET output level per role, in dBFS RMS.
 *
 * These are TARGETS, not raw gains. Each asset is attenuated relative to its
 * own MEASURED meanDb (see volumeFor) so two sounds sharing a role land at
 * the same perceived level: the library spans -11.4 dB (confirmation_001) to
 * -27.4 dB (switch_001), a 16 dB spread that a flat per-role gain would pass
 * straight into the mix. It is why bong and pluck can share `emphasis`
 * without one of them jumping out.
 *
 * WHERE THE NUMBERS COME FROM, AND WHAT IS ASSUMED
 *
 * The voiceover runs at unity through <Audio src={currentAudio} />, so these
 * are absolute and everything sits under it. The reference point is
 * YouTube's -14 LUFS playback normalisation, at which continuous speech
 * measures roughly -18 dBFS RMS; the broadcast convention is for
 * non-dialogue accents to sit 12-20 dB below dialogue. Hence a -30 dBFS
 * ceiling for the most prominent role and -38 for the quietest.
 *
 * That -18 dBFS speech figure is a REFERENCE, not a measurement of this
 * repo's own voiceover: EdgeTTS needs a WebSocket the sandbox proxy does not
 * carry, so no real narration audio could be produced here to measure
 * against (src/skills/remotion-render/vo.mp3 is silent placeholder).
 * qa-scripts/audio-qa.mjs measures the real headroom whenever the rendered
 * voiceover track is actually non-silent, and says so explicitly when it is
 * not, rather than reporting a headroom it did not observe.
 *
 * An earlier draft of this table topped out at -20 dB for `emphasis`. That
 * was wrong twice over: it is at speech level rather than under it, and it
 * asked volumeFor to BOOST pluck_001 (measured -20.9 dB), which clamped to
 * unity and put a full-scale accent over the narration. The numbers below
 * leave every asset attenuated, so nothing is ever boosted.
 */
export const ROLE_TARGET_DB = {
  // Loudest: the accent that punctuates a resolution.
  emphasis: -30,
  impact: -31,
  transition: -32,
  confirmation: -33,
  reveal: -33,
  expansion: -33,
  contraction: -33,
  interface: -34,
  // Quietest by a clear margin: several of these play in a row, and a data
  // texture that announces itself stops being texture.
  texture: -38,
};

/** True when the plan's own numbers say the value went down. */
function movesDown(plan) {
  const s = plan && plan.supporting;
  return !!s && Number.isFinite(s.from) && Number.isFinite(s.to) && s.to < s.from;
}

/**
 * Which visual states are audible, per strategy, and what event each is.
 *
 * A state absent from this table is SILENT. That is the normal case — the
 * table names roughly a third of all states on purpose.
 *
 * `reason` is stored on the event and surfaced in the render report so a
 * sound can always be traced back to the thing it is punctuating.
 *
 * Note what is NOT here: the sustaining states densify() appends to long
 * beats (`reframe_pre1`, `settle_post2`, ...). Those re-read a concept the
 * viewer has already seen rather than introducing an event, so they are
 * silent by construction — a long beat gets more picture, not more sound.
 */
export const STATE_SOUND_MAP = {
  GEOSPATIAL_RADIUS: {
    expand: { role: "expansion", reason: "the search boundary grows outward" },
    lock: { role: "emphasis", reason: "the boundary locks at the stated distance" },
    select: { role: "confirmation", reason: "the devices inside the boundary are picked out" },
  },
  ACCUMULATION: {
    // `accumulate` deliberately gets a repeating texture rather than one
    // sound: the event IS the repetition.
    accumulate: { role: "texture", reason: "items landing one after another", repeat: true },
    total: { role: "emphasis", reason: "the pile resolves into a total" },
  },
  TRANSFORMATION: {
    // A decline is not an expansion. TRANSFORMATION always carries real
    // from/to numbers (director.js buildSupporting), so which way the value
    // moved is already known — the sound follows the picture rather than
    // playing "something changed" in both directions.
    grow: {
      role: "expansion",
      reason: "the value climbs under pressure",
      alt: { role: "contraction", reason: "the value falls under pressure", when: movesDown },
    },
    settle: { role: "emphasis", reason: "the end value locks in" },
  },
  COMPARISON: {
    right: { role: "impact", reason: "the second quantity lands against the first" },
    verdict: { role: "emphasis", reason: "the decisive side is picked out" },
  },
  DATA_CHART: {
    bars: { role: "expansion", reason: "bars grow to their values" },
    highlight: { role: "emphasis", reason: "the bar that matters is isolated" },
  },
  TIMELINE: {
    events: { role: "texture", reason: "events landing on the axis", repeat: true },
    focus: { role: "emphasis", reason: "the decisive moment is isolated" },
  },
  PROCESS: {
    advance: { role: "texture", reason: "the token passing through stages", repeat: true },
    arrive: { role: "confirmation", reason: "it completes at the far end" },
  },
  CAUSE_EFFECT: {
    link: { role: "reveal", reason: "the connection draws between them" },
    effect: { role: "impact", reason: "the effect arrives" },
  },
  RELATIONSHIP: {
    links: { role: "texture", reason: "connections drawing between parties", repeat: true },
    weight: { role: "emphasis", reason: "the strongest relationship is emphasised" },
  },
  BEFORE_AFTER: {
    wipe: { role: "transition", reason: "the change sweeps across the frame" },
    after: { role: "impact", reason: "the new state lands" },
  },
  DOCUMENT_EVIDENCE: {
    page: { role: "impact", reason: "the document lands on screen" },
    find: { role: "confirmation", reason: "the operative clause is located" },
  },
  IMAGE_EVIDENCE: {
    reveal: { role: "reveal", reason: "the photograph resolves" },
  },
  INTERFACE_SIMULATION: {
    input: { role: "interface", reason: "the request is entered" },
    result: { role: "confirmation", reason: "results come back" },
  },
  SCALE_COMPARISON: {
    grow: { role: "expansion", reason: "the quantity grows against its reference" },
    read: { role: "emphasis", reason: "the magnitude resolves" },
  },
  VISUAL_METAPHOR: {
    act: { role: "expansion", reason: "the field acts on the subject" },
  },
  // CINEMATIC_STATEMENT is intentionally absent: the terminal fallback has
  // no event to punctuate, and scoring it would be scoring the absence of a
  // visual idea.
};

/**
 * Linear volume for <Audio volume={...}>, from the asset's MEASURED loudness.
 *
 * Loudness-normalises to the role's target: an asset already quieter than
 * its target is left alone (clamped at 1) rather than boosted, because
 * boosting a quiet file raises its noise floor with it.
 */
export function volumeFor(asset, role) {
  const target = ROLE_TARGET_DB[role] ?? -26;
  const mean = asset && typeof asset.meanDb === "number" ? asset.meanDb : -18;
  const v = Math.pow(10, (target - mean) / 20);
  return Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000;
}

/**
 * Guard against the map drifting off the strategies it describes.
 *
 * A key here that no strategy declares is a sound that can never fire, and —
 * worse — reads as covered when it isn't. This is the same anti-dead-enum
 * check the strategy registry runs on itself; it is called from
 * run-visual-tests.js so drift fails a test rather than going silent.
 *
 * Pass the STRATEGIES registry. Returns { pass, failures }.
 */
export function assertSoundMapIsSound(strategies, library) {
  const failures = [];
  for (const [strategy, states] of Object.entries(STATE_SOUND_MAP)) {
    const def = strategies[strategy];
    if (!def) {
      failures.push(`STATE_SOUND_MAP names strategy "${strategy}" that the registry does not define`);
      continue;
    }
    const known = new Set((def.states || []).map((s) => s.key));
    for (const [key, spec] of Object.entries(states)) {
      if (!known.has(key)) failures.push(`${strategy}.${key} is not a state of ${strategy}`);
      // An `alt` is a real branch that can fire, so it is checked like one.
      for (const variant of spec.alt ? [spec, spec.alt] : [spec]) {
        const label = variant === spec ? `${strategy}.${key}` : `${strategy}.${key}.alt`;
        if (!variant.reason) failures.push(`${label} has no reason`);
        if (!(variant.role in ROLE_TARGET_DB)) failures.push(`${label} uses unknown role "${variant.role}"`);
        if (library && !library.some((e) => e.role === variant.role)) {
          failures.push(`${label} wants role "${variant.role}" but the library has no asset for it`);
        }
      }
      if (spec.alt && typeof spec.alt.when !== "function") failures.push(`${strategy}.${key}.alt has no when()`);
    }
  }

  // The other direction: a role nothing can ever reach is a dead entry in
  // the gain table and dead files in the library. Either something plays it
  // or it should not be declared.
  if (library) {
    const reachable = new Set();
    for (const states of Object.values(STATE_SOUND_MAP)) {
      for (const spec of Object.values(states)) {
        reachable.add(spec.role);
        if (spec.alt) reachable.add(spec.alt.role);
      }
    }
    for (const role of Object.keys(ROLE_TARGET_DB)) {
      if (!reachable.has(role)) failures.push(`role "${role}" has a gain but no state ever asks for it`);
    }
    for (const entry of library) {
      if (!reachable.has(entry.role)) failures.push(`library asset ${entry.file} has role "${entry.role}" that nothing plays`);
    }

    // MATERIAL_CHARACTER is a preference expressed over real files. A
    // preferred character no asset actually has would silently do nothing —
    // art direction that exists only in a comment, which is the failure
    // mode this whole file is written against.
    for (const [material, roles] of Object.entries(MATERIAL_CHARACTER)) {
      for (const [role, chars] of Object.entries(roles)) {
        const inRole = library.filter((e) => e.role === role);
        if (inRole.length === 0) {
          failures.push(`MATERIAL_CHARACTER.${material} names role "${role}" the library has no asset for`);
          continue;
        }
        // One character in a role means the role cannot discriminate; the
        // entry is decoration and should be deleted rather than believed.
        const distinct = new Set(inRole.map((e) => e.character));
        if (distinct.size < 2) {
          failures.push(`MATERIAL_CHARACTER.${material}.${role} cannot discriminate — every ${role} asset is "${[...distinct][0]}"`);
        }
        for (const ch of chars) {
          if (!inRole.some((e) => e.character === ch)) {
            failures.push(`MATERIAL_CHARACTER.${material}.${role} prefers character "${ch}" that no ${role} asset has`);
          }
        }
      }
    }
  }
  return { pass: failures.length === 0, failures };
}

/**
 * Which asset CHARACTERS suit which shot MATERIAL — and where that stops.
 *
 * The shot carries a material (visual/composition.js: paper, mechanism,
 * terrain, substance, field, interface, footage, atmosphere), and a thud on
 * paper should not be the same sound as a thud on a machine bed.
 *
 * WHAT THIS CAN AND CANNOT DO, AGAINST THE ACTUAL LIBRARY. The library is
 * 26 CC0 files and most of its roles have exactly ONE character, so for
 * those roles material selection is not possible and claiming otherwise
 * would be a lie dressed as art direction. Three roles genuinely vary:
 *
 *   impact      wood-thud (2) | soft-thud (2) | bright-material (1)
 *   emphasis    tonal-bell (1) | tonal-pluck (2)
 *   transition  dry-whoosh (1) | reverberant-whoosh (1)
 *
 * Only those three are discriminated. Everything else falls through to the
 * whole role pool, unchanged. This is a preference, not a filter: if a
 * material's preferred characters are all unavailable (or all excluded by
 * `avoid`), the pick falls back rather than going silent.
 *
 * The mapping is by the files' `character` labels, which come from what the
 * source packs are — Kenney's interface set and a wood-impact set — not
 * from any claim about their spectra. Nothing here asserts a measured
 * acoustic property that was not measured.
 */
const MATERIAL_CHARACTER = {
  // Near, small, dry. A page does not ring or reverberate.
  paper: { impact: ["soft-thud"], emphasis: ["tonal-pluck"], transition: ["dry-whoosh"] },
  // Something physical and heavy meeting something physical and heavy.
  mechanism: { impact: ["wood-thud"], emphasis: ["tonal-pluck"], transition: ["dry-whoosh"] },
  substance: { impact: ["wood-thud", "soft-thud"], emphasis: ["tonal-pluck"] },
  terrain: { impact: ["wood-thud"], transition: ["reverberant-whoosh"] },
  // Distance: the two roles where the library can actually express it.
  atmosphere: { impact: ["soft-thud"], emphasis: ["tonal-bell"], transition: ["reverberant-whoosh"] },
  field: { impact: ["bright-material"], emphasis: ["tonal-bell"] },
  // A screen. Digital, bright, immediate.
  interface: { impact: ["bright-material", "soft-thud"], emphasis: ["tonal-pluck"], transition: ["dry-whoosh"] },
  footage: { impact: ["soft-thud"], transition: ["reverberant-whoosh"] },
};

/** The materials this map can actually discriminate, for the guard below. */
export function materialsWithCharacter() {
  return Object.keys(MATERIAL_CHARACTER);
}

/**
 * Pick an asset for a role, deterministically.
 *
 * `seed` varies the choice across a video so the same role does not always
 * play the identical file (mechanical repetition is its own defect), while
 * staying reproducible for a given script — no Math.random anywhere.
 * `avoid` is the previously used file for this role, so consecutive uses
 * differ. `material` comes from the beat's shot and narrows the pool to the
 * characters that suit it, where the library has more than one.
 */
export function pickAsset(library, role, seed, avoid, material) {
  const candidates = (library || []).filter((e) => e.role === role);
  if (candidates.length === 0) return null;

  // Material first, because a sound that matches the picture matters more
  // than a sound that differs from the last one.
  const wanted = material && MATERIAL_CHARACTER[material] && MATERIAL_CHARACTER[material][role];
  const matched = wanted ? candidates.filter((e) => wanted.includes(e.character)) : [];
  const base = matched.length ? matched : candidates;

  const usable = base.length > 1 && avoid ? base.filter((e) => e.file !== avoid) : base;
  const pool = usable.length ? usable : base;
  let h = 0;
  const key = `${role}:${seed}`;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/**
 * Build the sound events for one beat from its visual states.
 *
 * beat: { startFrame, durationInFrames, visualPlan, visualStates }
 * library: measured entries (role/file/durationMs/intensity/...)
 * carry: { lastByRole } mutated across beats so repeats can be avoided.
 *
 * Returns events in ABSOLUTE frames, each carrying why it exists.
 */
export function soundEventsForBeat(beat, library, carry = {}) {
  const plan = beat.visualPlan;
  if (!plan) return [];
  const map = STATE_SOUND_MAP[plan.strategy];
  if (!map) return [];

  const lastByRole = carry.lastByRole || (carry.lastByRole = {});
  const events = [];

  for (const state of beat.visualStates || []) {
    const declared = map[state.key];
    if (!declared) continue; // silent by default — the common case
    // A state may declare a directional alternative (a fall, not a climb).
    const spec = declared.alt && declared.alt.when(plan) ? declared.alt : declared;

    if (spec.repeat) {
      // A texture: a few sparse ticks across the state, not one per item.
      // Three is enough to read as "a series"; more becomes a machine gun.
      const n = Math.min(3, Math.max(2, Math.round(state.durationInFrames / 24)));
      for (let i = 0; i < n; i++) {
        const at = state.startFrame + Math.round((state.durationInFrames * (i + 0.5)) / n);
        events.push(makeEvent(beat, state, spec, at, library, lastByRole, i));
      }
    } else {
      events.push(makeEvent(beat, state, spec, state.startFrame, library, lastByRole, 0));
    }
  }

  // Order, then thin: caps and spacing are what keep this restrained.
  events.sort((a, b) => a.atFrame - b.atFrame);
  const kept = [];
  for (const ev of events) {
    if (!ev.file) continue; // no asset for that role — silence, not a placeholder
    const prev = kept[kept.length - 1];
    if (prev && ev.atFrame - prev.atFrame < MIN_GAP_FRAMES) {
      // Too close to the previous event. Keep whichever carries more
      // meaning: an emphasis/impact beats a texture tick.
      if (weight(ev.role) > weight(prev.role)) kept[kept.length - 1] = ev;
      continue;
    }
    kept.push(ev);
  }
  return kept.slice(0, MAX_EVENTS_PER_BEAT);
}

const ROLE_WEIGHT = { emphasis: 5, confirmation: 4, impact: 4, transition: 3, reveal: 3, expansion: 3, contraction: 3, interface: 2, texture: 1 };
function weight(role) {
  return ROLE_WEIGHT[role] || 1;
}

function makeEvent(beat, state, spec, localFrame, library, lastByRole, variant) {
  const seed = `${beat.startFrame}:${state.key}:${variant}`;
  // The shot's material, so the sound matches what the picture is made of.
  // Until this was passed in, `shot.material` was on every plan and read by
  // nothing in the audio path — wired but not heard.
  const material = (beat.visualPlan.shot && beat.visualPlan.shot.material) || null;
  const asset = pickAsset(library, spec.role, seed, lastByRole[spec.role], material);
  if (asset) lastByRole[spec.role] = asset.file;
  return {
    atFrame: beat.startFrame + localFrame,
    localFrame,
    role: spec.role,
    reason: spec.reason,
    strategy: beat.visualPlan.strategy,
    state: state.key,
    material,
    file: asset ? asset.file : null,
    character: asset ? asset.character : null,
    durationMs: asset ? asset.durationMs : null,
    targetDb: ROLE_TARGET_DB[spec.role] ?? -26,
    volume: asset ? volumeFor(asset, spec.role) : 0,
  };
}

/**
 * Schedule sound for a whole video. Returns absolute-frame events plus the
 * numbers the render report needs.
 */
export function buildSoundtrack(beats, library) {
  const carry = { lastByRole: {} };
  const events = [];
  for (const beat of beats) {
    if (beat.archetype === "LIST_ITEM") continue;
    events.push(...soundEventsForBeat(beat, library, carry));
  }
  events.sort((a, b) => a.atFrame - b.atFrame);

  // A final global thinning pass: two beats can each be individually
  // restrained and still collide at their shared boundary.
  const kept = [];
  for (const ev of events) {
    const prev = kept[kept.length - 1];
    if (prev && ev.atFrame - prev.atFrame < MIN_GAP_FRAMES && weight(ev.role) <= weight(prev.role)) continue;
    kept.push(ev);
  }
  return kept;
}
