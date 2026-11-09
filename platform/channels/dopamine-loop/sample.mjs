/**
 * Dopamine Loop sample. The script was written directly from one fetched abstract and did NOT pass through the
 * script engine's independent critic. Every sentence cites a claim record whose excerpt is copied from that abstract.
 */
const SRC = { source_id: "salimpoor2011", url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=21217764&retmode=text&rettype=abstract", published: "2011-02", doi: "10.1038/nn.2726", title: "Anatomically distinct dopamine release during anticipation and experience of peak emotion to music", journal: "Nature Neuroscience", licence: "abstract only, facts only, no text or figure reused" };
const claim = (claim_id, claimText, excerpt, editorial_status, context) => ({ claim_id, claim: claimText, source_id: SRC.source_id, source_url: SRC.url, published: SRC.published, excerpt, confidence: "medium", context, contradictory_evidence: [], editorial_status });

export const sources = [SRC];
export const claims = [
  claim("D1", "Music can arouse feelings of euphoria and craving, similar to tangible rewards that involve the striatal dopaminergic system.", "Music, an abstract stimulus, can arouse feelings of euphoria and craving, similar to tangible rewards that involve the striatal dopaminergic system.", "established_fact", "Framing sentence of the abstract."),
  claim("D2", "In listeners, endogenous dopamine release was found in the striatum at peak emotional arousal during music listening.", "we found endogenous dopamine release in the striatum at peak emotional arousal during music listening.", "correlation", "PET scanning with [11C]raclopride in human listeners. Release at peak arousal is a measured association."),
  claim("D3", "In fMRI of the same listeners, the caudate was more involved during anticipation and the nucleus accumbens during the experience of peak emotional responses.", "the caudate was more involved during the anticipation and the nucleus accumbens was more involved during the experience of peak emotional responses to music.", "correlation", "fMRI with the same stimuli and listeners. 'More involved' is the abstract's wording; it is activity, not a dopamine measurement."),
  claim("D4", "Anticipation of an abstract reward can result in dopamine release in an anatomical pathway distinct from the one associated with peak pleasure.", "the anticipation of an abstract reward can result in dopamine release in an anatomical pathway distinct from that associated with the peak pleasure itself.", "correlation", "One study. The abstract says 'can result in'; it does not say it always does."),
];

export const sentences = [
  { text: "Your brain can start rewarding you before a song's best part.", scene: 0, claim_ids: ["D4"] },
  { text: "In scans of listeners, dopamine was released at peak emotional arousal.", scene: 1, claim_ids: ["D2"] },
  { text: "The caudate was more involved during anticipation.", scene: 2, claim_ids: ["D3"] },
  { text: "The nucleus accumbens was more involved at the peak.", scene: 3, claim_ids: ["D3"] },
  { text: "Anticipation can use a pathway distinct from peak pleasure.", scene: 4, claim_ids: ["D4"] },
];

export const scenes = [
  { kind: "hook", treatment: "waveform-anticipation", objective: "Show a song building toward its best part, with a reward signal starting before the peak" },
  { kind: "scan", treatment: "scanner-and-arousal-curve", objective: "Show listeners scanned while hearing music, and dopamine marked at peak arousal" },
  { kind: "phase-caudate", treatment: "phase-timeline-highlight", objective: "Name the anticipation phase and the caudate, which was more involved in it" },
  { kind: "phase-accumbens", treatment: "phase-timeline-highlight", objective: "Name the peak phase and the nucleus accumbens, which was more involved in it" },
  { kind: "distinct", treatment: "two-pathways-summary", objective: "Set both phases and both regions side by side, marked as one human study" },
];

export const metadata = {
  title: "Why Your Brain Rewards You Before the Best Part of a Song",
  description: "In a Nature Neuroscience study, researchers scanned listeners during music. Dopamine release was found at peak emotional arousal, and the caudate was more involved during anticipation than the nucleus accumbens, which was more involved at the peak. One human imaging study; it does not diagnose or advise anyone.\n\n#Shorts #Psychology #Neuroscience #Music #DopamineLoop\n\nSource: Salimpoor et al., Nature Neuroscience, 2011, doi:10.1038/nn.2726 (abstract on PubMed, PMID 21217764).",
  tags: ["dopamine", "anticipation", "music and the brain", "neuroscience", "caudate", "nucleus accumbens", "psychology"],
};
