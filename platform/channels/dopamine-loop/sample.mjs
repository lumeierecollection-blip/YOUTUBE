/**
 * Dopamine Loop sample: "Why being left out hurts". Written directly from one fetched PubMed abstract and NOT reviewed by the
 * script engine's independent critic. Every sentence cites a claim whose excerpt is copied from that abstract. Where the
 * abstract is about a virtual game, the script says so; it never says the study was about messages or relationships.
 */
const SRC = { source_id: "eisenberger2003", url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=14551436&retmode=text&rettype=abstract", published: "2003-10-10", doi: "10.1126/science.1089134", title: "Does rejection hurt? An fMRI study of social exclusion", journal: "Science", licence: "abstract only, facts only, no text or figure reused" };
const claim = (claim_id, claimText, excerpt, editorial_status, context) => ({ claim_id, claim: claimText, source_id: SRC.source_id, source_url: SRC.url, published: SRC.published, excerpt, confidence: "medium", context, contradictory_evidence: [], editorial_status });

export const sources = [SRC];
export const claims = [
  claim("E1", "Participants were scanned while playing a virtual ball-tossing game in which they were ultimately excluded.", "Participants were scanned while playing a virtual ball-tossing game in which they were ultimately excluded.", "established_fact", "Study design. The exclusion was inside a virtual game, not a real relationship or a message."),
  claim("E2", "The study tested whether the brain bases of social pain are similar to those of physical pain, and its results paralleled results from physical pain studies.", "tested the hypothesis that the brain bases of social pain are similar to those of physical pain. ... Paralleling results from physical pain studies", "correlation", "One 2003 study. 'Paralleling' is the abstract's word; it does not say social and physical pain are the same."),
  claim("E3", "The anterior cingulate cortex was more active during exclusion than inclusion and correlated positively with self-reported distress.", "the anterior cingulate cortex (ACC) was more active during exclusion than during inclusion and correlated positively with self-reported distress.", "correlation", "A correlation between activity and reported distress, not proof that activity causes distress."),
  claim("E4", "Right ventral prefrontal cortex was active during exclusion and correlated negatively with self-reported distress.", "Right ventral prefrontal cortex (RVPFC) was active during exclusion and correlated negatively with self-reported distress.", "correlation", "The authors suggest this region may regulate distress; that is their interpretation and is not stated as fact here."),
  claim("E5", "The study measured brain activity that accompanied the reported distress of being excluded.", "A neuroimaging study examined the neural correlates of social exclusion", "correlation", "Frames the finding as accompanying activity ('neural correlates'), not a cause."),
];

export const sentences = [
  { text: "Being left out can look, in the brain, a lot like physical pain.", scene: 0, claim_ids: ["E2", "E3"] },
  { text: "In one study, people played a virtual ball game and were left out.", scene: 1, claim_ids: ["E1"] },
  { text: "The more distress they reported, the more active the anterior cingulate was.", scene: 2, claim_ids: ["E3"] },
  { text: "Another region was active, and linked to less distress.", scene: 3, claim_ids: ["E4"] },
  { text: "That sting comes with measurable brain activity.", scene: 4, claim_ids: ["E5"] },
];

export const scenes = [
  { kind: "left-out", treatment: "character-excluded-from-play", objective: "Show a character standing apart while two others toss a ball over their head, so the feeling of being left out is seen", background: "dark soft-lit room" },
  { kind: "screen", treatment: "virtual-game-screen", objective: "Show the virtual ball game: two avatars pass to each other and never to the third, with the character watching", background: "dark soft-lit room" },
  { kind: "distress", treatment: "scribble-builds-with-restrained-bars", objective: "Show distress building as a tangle inside the head, with two restrained bars rising together", background: "dark soft-lit room" },
  { kind: "regulate", treatment: "scribble-loosens", objective: "Show the tangle loosening while a soft ring forms, for the region linked to less distress", background: "dark soft-lit room" },
  { kind: "comfort", treatment: "second-character-sits-beside", objective: "Show another character sitting beside, the light warming and the heart mending, as the feeling is named", background: "dark soft-lit room, warming" },
];

export const metadata = {
  title: "Why Being Left Out Hurts (What One Brain Study Found)",
  description: "In a 2003 Science study, people were scanned while playing a virtual ball game in which they were ultimately left out. Activity in one brain region, the anterior cingulate, rose and fell with how distressed they said they felt. One small study of a virtual game: it does not diagnose or advise anyone.\n\n#Shorts #Psychology #Feelings #Relationships #DopamineLoop\n\nSource: Eisenberger, Lieberman & Williams, Science, 2003, doi:10.1126/science.1089134 (abstract on PubMed, PMID 14551436).\n\nIf you are struggling, please talk to someone you trust or a qualified professional.",
  tags: ["being left out", "social pain", "feelings", "psychology", "anterior cingulate", "emotions", "relationships"],
};
