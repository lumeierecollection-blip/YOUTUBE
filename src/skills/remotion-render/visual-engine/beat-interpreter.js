/**
 * beat-interpreter.js - Minimal beat interpreter for Gemini visual plans.
 */
import { createHash } from 'node:crypto';

export const MECHANISMS = [
  "STATE_CHANGE",
  "PHYSICAL_GROWTH",
  "VISIBLE_CONSUMPTION",
  "SURFACE_AND_BENEATH",
  "PROPORTIONAL_OBJECTS",
  "ACTION_CONSEQUENCE",
  "EVIDENCE_FIGURE",
];

const META_SUBJECTS = /^(text|overlay|infographic|graphic|chart|data|visual|image|animation|recommendation)$/i;

function variantFromSubject(subject) {
  const hash = createHash('md5').update(subject || '').digest('hex');
  return parseInt(hash.slice(0, 8), 16) % 6;
}

function extractNumber(numberField) {
  if (!numberField) return null;
  const match = String(numberField).match(/[\d.,]+/);
  return match ? match[0] : String(numberField);
}

function mechanismFromBeat(subject, action, number) {
  const s = (subject || '').toLowerCase();
  const a = (action || '').toLowerCase();
  if (/text\s*overlay/i.test(s)) return 'TYPE';
  if (/person|host|seeker|professional|worker|freelancer|individual|someone|people/i.test(s)) return 'EVIDENCE_FIGURE';
  if (/chart|graph|data|statistic|infographic|survey|report|figure|number/i.test(s)) return 'PROPORTIONAL_OBJECTS';
  if (number && /month|week|percent|balance|dollar|year|rate|duration/i.test(s)) return 'PHYSICAL_GROWTH';
  if (/grow|ris|accumulat|increas|build/i.test(a)) return 'PHYSICAL_GROWTH';
  if (/shrink|deplet|drain|fall|declin|loss|zero/i.test(a)) return 'VISIBLE_CONSUMPTION';
  if (/shatter|break|fail|crack|collaps|destruct/i.test(a)) return 'SURFACE_AND_BENEATH';
  if (/compar|versus|differ|ratio|highlight|split/i.test(a)) return 'PROPORTIONAL_OBJECTS';
  if (/connect|caus|lead|result|effect|impact/i.test(a)) return 'ACTION_CONSEQUENCE';
  return 'PROPORTIONAL_OBJECTS';
}

export function interpretBeat(beat, originalText, index, totalBeats) {
  const kind = (beat.kind || 'VISUAL').toUpperCase();
  const subject = beat.subject || originalText.slice(0, 40);
  const environment = beat.environment || 'neutral void';
  const action = beat.action || 'displayed';
  const number = extractNumber(beat.number);
  const variant = variantFromSubject(subject);

  if (index === 0 || kind === 'TYPE') {
    const headline = number ? number + ' ' + subject : subject;
    return {
      mechanism: 'STATE_CHANGE',
      visual_headline: headline,
      reason: 'Typography emphasis: ' + subject,
      objects: {
        label_a: originalText.slice(0, 30).toUpperCase(),
        label_b: headline.toUpperCase(),
      },
      carries_forward: null,
      emotional_weight: index === 0 ? 'urgent' : 'calm',
      variant,
      _interpreted: true,
      _kind: kind,
    };
  }

  const mechanism = mechanismFromBeat(subject, action, number);
  const headline = number ? number + ' ' + subject : subject;
  const objects = {};
  switch (mechanism) {
    case 'PHYSICAL_GROWTH':
    case 'VISIBLE_CONSUMPTION':
    case 'EVIDENCE_FIGURE':
      objects.figure = headline;
      break;
    case 'SURFACE_AND_BENEATH':
    case 'PROPORTIONAL_OBJECTS':
      objects.label_a = subject.toUpperCase().slice(0, 20);
      objects.label_b = action.toUpperCase().slice(0, 20);
      break;
    case 'ACTION_CONSEQUENCE':
      objects.cause = subject.toUpperCase().slice(0, 20);
      objects.effect = action.toUpperCase().slice(0, 20);
      break;
    default:
      objects.label_a = subject.toUpperCase().slice(0, 20);
      break;
  }

  return {
    mechanism,
    visual_headline: headline,
    reason: action + ' — ' + environment,
    objects,
    carries_forward: null,
    emotional_weight: index === totalBeats - 1 ? 'building' : 'calm',
    variant,
    _interpreted: true,
    _kind: kind,
    _subject: subject,
  };
}

function deduplicateConsecutive(directives) {
  if (directives.length <= 2) return directives;
  const result = [...directives];
  let runStart = 0;
  for (let i = 1; i <= result.length; i++) {
    const currentMech = i < result.length ? result[i].mechanism : null;
    const prevMech = result[i - 1].mechanism;
    if (currentMech !== prevMech || i === result.length) {
      const runLength = i - runStart;
      if (runLength > 2) {
        for (let j = runStart + 1; j < i - 1; j++) {
          const current = result[j].mechanism;
          const idx = MECHANISMS.indexOf(current);
          const nextMech = MECHANISMS[(idx + 1) % MECHANISMS.length];
          result[j] = { ...result[j], mechanism: nextMech };
        }
      }
      runStart = i;
    }
  }
  return result;
}

function capPercentages(directives) {
  if (!directives || directives.length === 0) return directives;
  const maxAllowed = Math.floor(directives.length * 0.4);
  const counts = {};
  for (const d of directives) {
    counts[d.mechanism] = (counts[d.mechanism] || 0) + 1;
  }
  const result = [...directives];
  for (const [mech, count] of Object.entries(counts)) {
    if (count > maxAllowed) {
      let excess = count - maxAllowed;
      const leastUsed = MECHANISMS.reduce((min, m) => ((counts[m] || 0) < (counts[min] || 0) ? m : min), MECHANISMS[0]);
      for (let i = result.length - 1; i > 0 && excess > 0; i--) {
        if (result[i].mechanism === mech) {
          result[i] = { ...result[i], mechanism: leastUsed };
          excess--;
        }
      }
    }
  }
  return result;
}

function processMetaSubjects(directives, sentences) {
  return directives.map((d, i) => {
    const subj = d._subject || '';
    if (META_SUBJECTS.test(subj) || subj.split(/\s+/).every(w => META_SUBJECTS.test(w))) {
      const typeText = sentences[i]?.text || d.visual_headline || 'SUMMARY';
      return {
        ...d,
        mechanism: 'TYPE',
        visual_headline: typeText,
        reason: 'Meta subject downgraded to TYPE',
        typography: { role: 'primary', style: 'kinetic', emphasis_words: [] }
      };
    }
    return d;
  });
}

export function interpretPlan(beats, sentences) {
  const directives = [];
  for (const beat of beats) {
    const originalText = sentences[beat.index]?.text || '';
    const directive = interpretBeat(beat, originalText, beat.index, beats.length);
    directives.push(directive);
  }
  const deduped = deduplicateConsecutive(directives);
  const capped = capPercentages(deduped);
  const processed = processMetaSubjects(capped, sentences);

  const distribution = {};
  for (const d of processed) {
    distribution[d.mechanism] = (distribution[d.mechanism] || 0) + 1;
  }
  return { directives: processed, distribution };
}
