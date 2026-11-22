/**
 * Visual Storytelling Engine - Visual Decision Engine
 * 
 * Decides which visual treatment to use for each narration segment based on
 * content analysis. Maps narration meaning to appropriate visual treatments.
 */

export const VISUAL_INTENTS = {
  PERSON: 'person',           // Person portrait/photo
  PEOPLE: 'people',           // Group of people
  PLACE: 'place',             // Geographic location/map
  HISTORICAL_EVENT: 'historical-event', // Historical event illustration
  DATE: 'date',               // Date/timeline marker
  SEQUENCE: 'sequence',       // Sequence of events
  STATISTIC: 'statistic',     // Statistical data point
  COMPARISON: 'comparison',   // Comparison between two things
  PROCESS: 'process',         // Process steps
  CAUSE_AND_EFFECT: 'cause-and-effect', // Cause and effect relationship
  DOCUMENT: 'document',       // Historical document
  EVIDENCE: 'evidence',       // Evidence/proof
  PRODUCT: 'product',         // Product/UI demonstration
  TECHNICAL: 'technical',     // Technical explanation
  ENVIRONMENT: 'environment', // Environmental/atmospheric
  TRANSITION: 'transition',   // Transition between scenes
};

/**
 * Map narration keywords/phrases to visual intents.
 * Returns the most likely intent for a sentence.
 */
export function classifyVisualIntent(text, context = {}) {
  const textLower = text.toLowerCase();
  
  // People patterns
  if (/\b(he|she|they|them|him|her)\b/.test(textLower) && 
      /\b(was|were|is|are|said|did|went|came)\b/.test(textLower)) {
    return VISUAL_INTENTS.PERSON;
  }
  if (/\b(margaret clitherow|guy fawkes|christopher wright|john wright)\b/i.test(textLower)) {
    return VISUAL_INTENTS.PERSON;
  }
  if (/\b(conspirators|plotters|authorities|historians)\b/i.test(textLower)) {
    return VISUAL_INTENTS.PEOPLE;
  }
  
  // Place/geography patterns
  if (/\b(york|london|paris|rome|city|minster|city walls|cobblestone)\b/i.test(textLower)) {
    return VISUAL_INTENTS.PLACE;
  }
  
  // Date/chronology patterns
  if (/\b(1586|1605|1570|1606|1580s|twenty years|lady day|march)\b/i.test(textLower)) {
    return VISUAL_INTENTS.DATE;
  }
  
  // Statistics/numbers
  if (/\b(4th|fourth|nineteen|twenty|1586|1605|1570|1606)\b/i.test(textLower)) {
    return VISUAL_INTENTS.STATISTIC;
  }
  
  // Comparison
  if (/\b(versus|vs|compared to|unlike|while|whereas|but|however)\b/i.test(textLower)) {
    return VISUAL_INTENTS.COMPARISON;
  }
  
  // Cause and effect
  if (/\b(because|therefore|because of|led to|resulted in|caused|because)\b/i.test(textLower)) {
    return VISUAL_INTENTS.CAUSE_AND_EFFECT;
  }
  
  // Process/sequence
  if (/\b(then|next|after|before|first|then|finally|eventually)\b/i.test(textLower)) {
    return VISUAL_INTENTS.SEQUENCE;
  }
  
  // Documents
  if (/\b(indictment|plea|document|record|testimony|accusation|warrant)\b/i.test(textLower)) {
    return VISUAL_INTENTS.DOCUMENT;
  }
  
  // Evidence
  if (/\b(evidence|proof|witness|saw|observed|theory|historians theorise)\b/i.test(textLower)) {
    return VISUAL_INTENTS.EVIDENCE;
  }
  
  // Default to place/context for historical narrative
  return VISUAL_INTENTS.PLACE;
}

/**
 * Map visual intent to a component type and configuration.
 */
export function getVisualConfig(intent, context = {}) {
  const configMap = {
    [VISUAL_INTENTS.PERSON]: {
      component: 'PersonPortrait',
      style: 'portrait',
      props: { subject: context.subject, fy: 0.28 },
    },
    [VISUAL_INTENTS.PEOPLE]: {
      component: 'GroupPortrait',
      style: 'group',
      props: { subjects: context.subjects, fy: 0.4 },
    },
    [VISUAL_INTENTS.PLACE]: {
      component: 'PlaceMap',
      style: 'map',
      props: { place: context.subject, fy: 0.5 },
    },
    [VISUAL_INTENTS.HISTORICAL_EVENT]: {
      component: 'HistoricalScene',
      style: 'cinematic',
      props: { event: context.subject, fy: 0.4 },
    },
    [VISUAL_INTENTS.DATE]: {
      component: 'TimelineMarker',
      style: 'timeline',
      props: { date: context.subject },
    },
    [VISUAL_INTENTS.SEQUENCE]: {
      component: 'EventTimeline',
      style: 'timeline',
      props: { events: context.events },
    },
    [VISUAL_INTENTS.STATISTIC]: {
      component: 'StatCard',
      style: 'data-viz',
      props: { value: context.value, label: context.label },
    },
    [VISUAL_INTENTS.COMPARISON]: {
      component: 'ComparisonCard',
      style: 'comparison',
      props: { left: context.left, right: context.right },
    },
    [VISUAL_INTENTS.PROCESS]: {
      component: 'ProcessDiagram',
      style: 'diagram',
      props: { steps: context.steps },
    },
    [VISUAL_INTENTS.CAUSE_AND_EFFECT]: {
      component: 'CauseEffectDiagram',
      style: 'diagram',
      props: { cause: context.cause, effect: context.effect },
    },
    [VISUAL_INTENTS.DOCUMENT]: {
      component: 'DocumentOverlay',
      style: 'editorial',
      props: { document: context.document, highlight: context.highlight },
    },
    [VISUAL_INTENTS.EVIDENCE]: {
      component: 'EvidenceCard',
      style: 'evidence',
      props: { evidence: context.evidence, source: context.source },
    },
    [VISUAL_INTENTS.PRODUCT]: {
      component: 'ProductDemo',
      style: 'demo',
      props: { product: context.product, features: context.features },
    },
    [VISUAL_INTENTS.TECHNICAL]: {
      component: 'TechnicalDiagram',
      style: 'technical',
      props: { concept: context.subject, diagram: context.diagram },
    },
    [VISUAL_INTENTS.ENVIRONMENT]: {
      component: 'AtmosphericScene',
      style: 'cinematic',
      props: { subject: context.subject, fy: 0.5 },
    },
    [VISUAL_INTENTS.TRANSITION]: {
      component: 'TransitionScene',
      style: 'transition',
      props: { from: context.from, to: context.to },
    },
  };
  
  return configMap[intent] || {
    component: 'HistoricalScene',
    style: 'cinematic',
    props: { subject: context.subject, fy: 0.5 },
  };
}

export default { VISUAL_INTENTS, classifyVisualIntent, getVisualConfig };
