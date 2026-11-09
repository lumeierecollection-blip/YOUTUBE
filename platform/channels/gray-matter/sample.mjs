/**
 * The first-wave sample: hand-planned from sources that were actually fetched, and marked provisional.
 * The script engine regenerates this in the next wave. Every excerpt below is copied from the source text.
 */
export const PROVISIONAL = "hand-planned sample, not from the script engine";

const SRC = {
  newbury: { source_id: "newbury2021", url: "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PMCID:PMC8893218&format=json&resultType=core", published: "2021-11-01", doi: "10.1037/bul0000348", title: "Sleep deprivation and memory: Meta-analytic reviews of studies on sleep deprivation before and after learning", journal: "Psychological Bulletin", licence: "CC BY" },
  anand: { source_id: "anand2012", url: "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=PMCID:PMC3548359&format=json&resultType=core", published: "2012-10-01", doi: "10.4103/0972-2327.104323", title: "Hippocampus in health and disease: An overview", journal: "Annals of Indian Academy of Neurology", licence: "CC BY-NC-SA, facts only, no text or figure reused" },
  yoo: { source_id: "yoo2007", url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=17293859&retmode=text&rettype=abstract", published: "2007-02-11", doi: "10.1038/nn1851", title: "A deficit in the ability to form new human memories without sleep", journal: "Nature Neuroscience", licence: "abstract only, facts only" },
  havekes: { source_id: "havekes2016", url: "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4996653/fullTextXML", published: "2016-08-23", doi: "10.7554/eLife.13424", title: "Sleep deprivation causes memory deficits by negatively impacting neuronal connectivity in hippocampal area CA1", journal: "eLife", licence: "CC BY 4.0" },
  spines: { source_id: "star2024", url: "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=ABSTRACT:%22dendritic%20spines%20are%22%20AND%20ABSTRACT:%22protrusions%22%20AND%20ABSTRACT:%22excitatory%22%20AND%20SRC:MED%20AND%20OPEN_ACCESS:y&format=json&resultType=core&pageSize=8", published: "2024", doi: "10.1016/j.xpro.2023.102829", title: "Assessing protein distribution and dendritic spine morphology relationships using structured illumination microscopy in cultured neurons", journal: "STAR Protocols", licence: "CC BY-NC-ND, one definition sentence quoted as a claim record only" },
};

const claim = (claim_id, source, claimText, excerpt, confidence, editorial_status, context, contradictory_evidence = []) => ({
  claim_id, claim: claimText, source_id: source.source_id, source_url: source.url, published: source.published, excerpt, confidence, context, contradictory_evidence, editorial_status,
});

export const claims = [
  claim("C1", SRC.newbury, "At least one full night without sleep before learning is associated with worse memory for the new material.", "The impact of sleep deprivation before learning was associated with Hedges' g = 0.621, 95% CI [0.473, 0.769].", "medium", "established_fact", "Meta-analysis of human studies published 1970 to 2020. Direction is established; the exact size is not.", ["Egger's tests for funnel plot asymmetry suggested significant publication bias in both meta-analyses.", "Statistical power was very low in most of the analyzed studies."]),
  claim("C2", SRC.anand, "The hippocampus lies deep in the temporal lobe and has a major role in learning and memory.", "Hippocampus is a complex brain structure embedded deep into temporal lobe. It has a major role in learning and memory.", "high", "established_fact", "Review article. Placement on screen comes from the Gray's Anatomy plate, not from this sentence."),
  claim("C3", SRC.yoo, "After one night without sleep, hippocampal activity during learning was lower and later retention was worse.", "We report that a single night of sleep deprivation produces a significant deficit in hippocampal activity during episodic memory encoding, resulting in worse subsequent retention.", "medium", "correlation", "One human imaging study, read from its abstract only. Sleep loss was the condition compared; the link from lower activity to worse memory is labelled an association here because this channel does not treat one imaging result as proof of mechanism, although the abstract says 'resulting in'."),
  claim("C4", SRC.havekes, "In mice, five hours of sleep deprivation reduced dendritic spine numbers in hippocampal area CA1.", "In mice, we find that five hours of sleep deprivation decreases dendritic spine numbers selectively in hippocampal area CA1", "high", "causation", "Male C57BL/6J mice. Sleep deprivation was the experimental manipulation. Single study."),
  claim("C5", SRC.spines, "Dendritic spines are protrusions on dendrites that form the receiving side of excitatory connections.", "Dendritic spines are protrusions on dendrites forming the postsynaptic aspect of excitatory connections within the brain.", "high", "established_fact", "Definition from the abstract of a methods paper."),
  claim("C6", SRC.havekes, "In mice, suppressing cofilin prevented the spine loss and the long-term memory impairment caused by sleep deprivation.", "Suppression of cofilin function prevents spine loss, deficits in hippocampal synaptic plasticity, and impairments in long-term memory caused by sleep deprivation.", "high", "causation", "Mice, single study. Cofilin was suppressed by viral expression of an inactive form in hippocampal neurons."),
  claim("C7", SRC.havekes, "In mice, recovery sleep returned the spine changes to normal.", "Recovery sleep normalizes these structural alterations.", "high", "causation", "Mice, single study."),
  claim("C8", SRC.havekes, "The spine and cofilin results were obtained in mice, so they do not establish that the same thing happens in people.", "In mice, we find that five hours of sleep deprivation decreases dendritic spine numbers selectively in hippocampal area CA1", "high", "hypothesis", "A limit on what this evidence shows. It is not a claim that no human work exists."),
  claim("C9", SRC.havekes, "Cofilin is a protein that breaks down actin filaments, which shape the connections between neurons.", "This reduction is caused by the increased activity of cofilin, a protein that breaks down the actin filaments that shape the connections between neurons.", "high", "established_fact", "From the eLife digest of the study."),
];

export const sentences = [
  { sentence_id: "s1", beat_id: "b1", text: "A sleepless night worsens memory for new things.", role: "Opens on the everyday experience and states what is measured.", claim_ids: ["C1"], link_from_previous: "none", on_screen_text: "Awake all night" },
  { sentence_id: "s2", beat_id: "b2", text: "The hippocampus, deep in the temporal lobe, helps form memories.", role: "Names the region, where it is, and what it does.", claim_ids: ["C2"], link_from_previous: "explanation", on_screen_text: "Hippocampus" },
  { sentence_id: "s3", beat_id: "b3", text: "One imaging study found it less active when learning.", role: "Human evidence, marked as one association.", claim_ids: ["C3"], link_from_previous: "evidence", on_screen_text: "Less active while learning" },
  { sentence_id: "s4", beat_id: "b4", text: "In mice, five hours awake cut dendritic spines.", role: "Moves to the cellular level and defines the term.", claim_ids: ["C4", "C5"], link_from_previous: "explanation", on_screen_text: "Dendritic spine" },
  { sentence_id: "s5", beat_id: "b5", text: "Blocking cofilin, which breaks down actin, prevented the loss.", role: "The causal test, in mice.", claim_ids: ["C6", "C9"], link_from_previous: "cause", on_screen_text: "Cofilin suppressed" },
  { sentence_id: "s6", beat_id: "b6", text: "Recovery sleep reversed it, only in mice.", role: "Payoff and the limit of the evidence.", claim_ids: ["C7", "C8"], link_from_previous: "contradiction", on_screen_text: "Mice only" },
];

export const blueprint = {
  central_question: "What is physically happening in the brain after a night without sleep?",
  thesis: "Sleep loss makes new learning harder, and in mice the mechanism runs through the loss of connection points on hippocampal neurons. Whether the same happens in people is not shown by this evidence.",
  why_it_matters: "Most people have lost a night of sleep and felt worse at learning the next day.",
  viewer_start: "Knows that being tired makes it harder to concentrate.",
  viewer_end: "Can name the hippocampus, knows what a dendritic spine is, and can say which parts of the evidence are human, which are mouse, and which are unknown.",
  key_evidence: ["C1", "C3", "C4", "C6", "C8"],
  beats: [
    { beat_id: "b1", role: "opening", purpose: "Ties the everyday experience to a measured memory effect.", claim_ids: ["C1"], link_from_previous: "none" },
    { beat_id: "b2", role: "context", purpose: "Shows where in the brain the question leads.", claim_ids: ["C2"], link_from_previous: "explanation" },
    { beat_id: "b3", role: "development", purpose: "Human imaging evidence for a change in that region.", claim_ids: ["C3"], link_from_previous: "evidence" },
    { beat_id: "b4", role: "development", purpose: "Cellular change in mice.", claim_ids: ["C4", "C5"], link_from_previous: "explanation" },
    { beat_id: "b5", role: "payoff", purpose: "The test that makes the mechanism causal in mice.", claim_ids: ["C6", "C9"], link_from_previous: "cause" },
    { beat_id: "b6", role: "ending", purpose: "Recovery, then what is and is not known.", claim_ids: ["C7", "C8"], link_from_previous: "contradiction" },
  ],
  questions_raised: [{ question: "Why would one night change memory?", raised_in: "b1", answered_in: "b4" }, { question: "Does this happen in people?", raised_in: "b5", answered_in: "b6" }],
  conclusion: "Sleep loss impairs new learning in people. The spine mechanism is shown in mice and remains unconfirmed by this evidence in humans.",
};

const assetPlate = { id: "gray739-emphasizing-hippocampus", origin: "Gray's Anatomy (1918), Henry Vandyke Carter, hippocampus emphasis by a Wikimedia Commons editor", licence: "Public domain", source_url: "https://commons.wikimedia.org/wiki/File:Gray739-emphasizing-hippocampus.png" };
const assetLateral = { id: "gray726", origin: "Gray's Anatomy (1918), Henry Vandyke Carter", licence: "Public domain", source_url: "https://commons.wikimedia.org/wiki/File:Gray726.png" };
const assetAnima = (id) => ({ id, origin: "Generated at run time with the Anima kit at the pinned commit (kit/branch.mjs, kit/blob.mjs)", licence: "MIT", source_url: "https://github.com/Garinmckayl/anima" });
const assetAnimaChem = { id: "actin-helix", origin: "Generated at run time with the Anima kit at the pinned commit (kit/chem.mjs)", licence: "MIT", source_url: "https://github.com/Garinmckayl/anima" };

export const scenePlan = [
  { sentence: "s1", treatment: "everyday-to-biology", main_point: "A night without sleep is an everyday event with a measurable effect on memory.", visual_objective: "See a person awake through the night, then see the brain inside that head and the temporal lobe picked out.", on_screen_text: ["Awake all night", "New information", "Temporal lobe"], transition: "Push in on the temporal lobe, then dissolve to the dissection.", assets: [assetLateral], data: { kicker: "EVERYDAY", title: "One night without sleep", status: "established_fact", statusDetail: "Human meta-analysis: worse memory", caption_note: "Head and brain placement is schematic" } },
  { sentence: "s2", treatment: "region-highlight", main_point: "The hippocampus sits deep in the temporal lobe and helps form memories.", visual_objective: "Locate the hippocampus on a real dissection and learn its name and job.", on_screen_text: ["Hippocampus", "Deep in the temporal lobe", "Helps form new memories", "Left hemisphere, opened from the side"], transition: "Cut to the region enlarged.", assets: [assetPlate], data: { kicker: "BRAIN REGION", title: "Where new memories form", status: "established_fact", statusDetail: "Anatomy and function", region: { name: "Hippocampus", where: "Deep in the temporal lobe", does: "Helps form new memories", view: "Left hemisphere, opened from the side", credit: "Gray's Anatomy, 1918. Public domain." } } },
  { sentence: "s3", treatment: "activity-compare", main_point: "One imaging study found lower hippocampal activity during learning after sleep loss.", visual_objective: "Compare the same region after sleep and after sleep loss, with the direction of the change named.", on_screen_text: ["After normal sleep", "After a sleepless night", "Less active while learning", "Glow is illustrative, not scan data"], transition: "Cut into the cell.", assets: [assetPlate], data: { kicker: "PROCESS: LEARNING", title: "Activity while learning", status: "correlation", statusDetail: "One human imaging study", rows: [{ label: "After normal sleep", value: "More active while learning", level: 1 }, { label: "After a sleepless night", value: "Less active while learning", level: 0.2, memory: "Memory later: worse" }], note: "Glow is illustrative, not scan data" } },
  { sentence: "s4", treatment: "neuron-to-spines", main_point: "In mice, sleep loss reduces dendritic spines on hippocampal neurons.", visual_objective: "See a CA1 neuron, a magnified dendrite, what a spine and synapse are, and spines disappearing.", on_screen_text: ["Pyramidal neuron", "Hippocampal area CA1", "Dendritic spine", "Synapse", "Fewer spines after 5 h awake"], transition: "Dendrite carries over to the next scene.", assets: [assetAnima("ca1-neuron"), assetAnima("dendrite-synapse")], data: { kicker: "PROCESS: SYNAPSE", title: "Inside the hippocampus", status: "causation", statusDetail: "Measured in mice, one study", neuronTitle: "Pyramidal neuron", neuronRegion: "Hippocampal area CA1", result: "Fewer spines after 5 h awake", scaleNote: "Schematic. Not to scale. Loss not drawn to the measured amount." } },
  { sentence: "s5", treatment: "mechanism-rescue", main_point: "Suppressing cofilin prevented the spine loss and the memory deficit in mice.", visual_objective: "Compare the dendrite with and without cofilin suppressed, and see what cofilin does to actin.", on_screen_text: ["Cofilin breaks down actin filaments", "Sleep loss", "Sleep loss + cofilin suppressed", "Memory deficit", "Memory deficit prevented"], transition: "Cut to the evidence ledger.", assets: [assetAnima("dendrite-bare"), assetAnimaChem], data: { kicker: "PROCESS: CAUSAL TEST", title: "Remove cofilin's effect", status: "causation", statusDetail: "Mice only, one study", actinLabel: "Cofilin breaks down actin filaments", panels: [{ label: "Sleep loss", outcome: "Memory deficit", loses: true }, { label: "Sleep loss + cofilin suppressed", outcome: "Memory deficit prevented", loses: false }] } },
  { sentence: "s6", treatment: "evidence-ledger", main_point: "Spines recovered with sleep in mice, and the human mechanism is not shown.", visual_objective: "See the spines return, then read what is established, associated, causal in mice, and uncertain.", on_screen_text: ["Recovery sleep: spines back to normal (mice)", "Established", "Association", "Causal test", "Uncertain"], transition: "End.", assets: [assetAnima("dendrite-bare")], data: { kicker: "WHAT IS KNOWN", title: "Evidence so far", recoveryLabel: "Recovery sleep: spines back to normal (mice)", ledger: [
    { status: "established_fact", head: "Sleep loss before learning impairs memory", sub: "Human meta-analysis. Most studies were small." },
    { status: "correlation", head: "Hippocampus less active while learning", sub: "One human imaging study." },
    { status: "causation", head: "Cofilin drives the spine loss", sub: "Mice only. Memory deficit prevented too." },
    { status: "hypothesis", head: "Do spines change the same way in people?", sub: "Not shown by this evidence." },
  ] } },
];

export const scriptPackage = {
  provisional: PROVISIONAL,
  channel: "gray-matter",
  topic: "What one night without sleep does to the hippocampus",
  format: "short",
  target_seconds: 28,
  blueprint,
  hook_options: [
    { text: "A night without sleep makes new information harder to remember.", family: "plain consequence", honest: true },
    { text: "One sleepless night changes how your hippocampus learns.", family: "direct claim", honest: false, note: "Rejected: stated as fact about the viewer, while the human evidence is one imaging study." },
  ],
  selected_hook: "A night without sleep makes new information harder to remember.",
  sentences,
  payoff: "In mice, suppressing cofilin prevented both the spine loss and the memory deficit.",
  ending: "Recovery sleep reversed it, only in mice.",
  cta: null,
  sources: Object.values(SRC),
  claims,
  quality_report: { provisional: PROVISIONAL, checks: "Every sentence carries claim_ids. Every claim excerpt is copied from a fetched source." },
};
