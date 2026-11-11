/**
 * Hidden Past, layered Vox cut: the bombing of Avianca Flight 203, 27 November 1989, ordered by Pablo Escobar's Medellín Cartel.
 * Written directly from one fetched Wikipedia article ("Avianca Flight 203", retrieved on the run). Every claim carries a text that the run must
 * find in that article before it renders. Pictures are Wikimedia Commons files with licences read from the API; the aircraft photograph is the
 * very aircraft (HK-1803, MSN 19035, which matches the article), taken at Bogotá in 1982. Same script and pacing rules as vox-beats-story.mjs.
 * Not reviewed by the script engine's critic. What is disputed is said on screen: the cause, per a 2016 newspaper report, and who carried the bomb.
 */
export const SLUG = "avianca-203-bombing";
export const TOPIC = "Avianca Flight 203: the bomb Pablo Escobar ordered for a presidential candidate who was not on board";
export const WIKI_ARTICLE = "https://en.wikipedia.org/wiki/Avianca_Flight_203";
export const WIKI_TITLE = "Avianca_Flight_203";
const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`;

export const ASSETS = [
  { key: "plane", id: "hk1803", title: "File:Avianca Boeing 727-21 HK-1803.jpg", claim: "C1", role: "the aircraft, Avianca Boeing 727-21 HK-1803, at Bogotá, November 1982", cutout: true },
  { key: "escobar", id: "escobar", title: "File:Pablo Escobar Mug (cropped)(b).jpg", claim: "C7", role: "Pablo Escobar, police photograph" },
  { key: "gaviria", id: "gaviria", title: "File:César Gaviria, World Economic Forum on Latin America 2009 (cropped 2).jpg", claim: "C8", role: "César Gaviria, photographed in 2009" },
];
for (const a of ASSETS) a.page_url = COMMONS(a.title);

const claim = (claim_id, claimText, excerpt, must, context = "", editorial_status = "established_fact") => ({ claim_id, claim: claimText, source_id: "wiki-avianca203", source_url: WIKI_ARTICLE, published: "2026-11-11", excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status, must: { from: "wiki", text: must } });
export const CLAIMS = [
  claim("C1", "Avianca Flight 203, a Boeing 727, was destroyed by a bomb over the municipality of Soacha on 27 November 1989.", "It was destroyed by a bomb over the municipality of Soacha on November 27, 1989.", "It was destroyed by a bomb over the municipality of Soacha on November 27, 1989."),
  claim("C2", "The domestic flight from Bogotá to Cali took off as scheduled at 07:13.", "Flight 203 took off as scheduled at 07:13.", "Flight 203 took off as scheduled at 07:13."),
  claim("C3", "Five minutes into the flight an explosive charge detonated.", "Five minutes into the flight, at a speed of 794 kilometres per hour (429 knots) and an altitude of 13,000 feet (4,000 metres), an explosive charge detonated", "Five minutes into the flight"),
  claim("C4", "A second blast ripped the airliner apart and the wreckage was scattered in a five-kilometre radius around the town of Soacha.", "A second blast ripped the airliner apart", "A second blast ripped the airliner apart"),
  claim("C5", "All 107 people on board were killed, as well as three people on the ground.", "All 107 people on board were killed, as well as three people on the ground.", "All 107 people on board were killed, as well as three people on the ground"),
  claim("C6", "An investigation determined that plastic explosives were used to destroy the plane.", "An investigation determined that plastic explosives were used to destroy the plane.", "An investigation determined that plastic explosives were used to destroy the plane."),
  claim("C7", "The bombing had been ordered by the Medellín drug cartel; Pablo Escobar planned it in the lead-up to the 1990 elections.", "Drug king Pablo Escobar, of the Medellín drug cartel, planned the bombing in the lead-up to the 1990 elections", "planned the bombing in the lead-up to the 1990 elections"),
  claim("C8", "Escobar hoped the bomb plot would kill presidential candidate César Gaviria.", "hoping the bomb plot would kill presidential candidate C", "hoping the bomb plot would kill presidential candidate C"),
  claim("C9", "Gaviria was not on the aircraft, despite Escobar's expectations, and went on to be elected president.", "Gaviria was not on the aircraft, despite Escobar's expectations, and went on to be elected president.", "Gaviria was not on the aircraft, despite Escobar's expectations, and went on to be elected president."),
  claim("C10", "Nine days after the plane bombing, the DAS Building bombing, presumably also ordered by the Medellín Cartel, killed 63 people in Bogotá.", "Nine days after the bombing of the plane, the DAS Building bombing, presumably also ordered by the Medell", "killed 63 people in Bogot", "The article says 'presumably' about who ordered it.", "later_interpretation"),
  claim("C11", "Two Americans were among the dead, prompting the Bush administration to begin Intelligence Support Activity operations to find Escobar.", "Two Americans were among the dead, prompting the Bush administration to begin Intelligence Support Activity operations to find Escobar.", "Two Americans were among the dead, prompting the Bush administration to begin Intelligence Support Activity operations to find Escobar."),
  claim("C12", "The Medellín Cartel's chief assassin, alias 'La Quica', was convicted in a US court in 1994 and sentenced to 10 consecutive life sentences.", "was sentenced to 10 consecutive life sentences", "was sentenced to 10 consecutive life sentences"),
  claim("C13", "A 2016 El Espectador report argues the explosion was caused by a malfunctioning fuel pump; it was heavily criticized by Avianca and the victims' family members.", "heavily criticized by Avianca and family members of the victims", "heavily criticized by Avianca and family members of the victims", "A disputed minority account; the bombing finding is the investigation's.", "later_interpretation"),
];

const V = (text, claim_ids = []) => ({ text, claim_ids });
const NR = { allow_no_claim: true, editorial: "turn to context, not a factual claim" };
/** One slot per picture, in story order. Required slots tell the whole crime; optional ones add context where the pace allows. */
export const SLOTS = [
  { id: "hook", scene: 0, variants: [V("On November 27, 1989, a bomb destroys a passenger plane over Colombia.", ["C1"]), V("In 1989, a bomb destroys a plane over Colombia.", ["C1"])] },
  { id: "depart", scene: 1, variants: [V("Flight 203 leaves Bogotá for Cali at 7:13.", ["C2"]), V("Flight 203 leaves Bogotá.", ["C2"])] },
  { id: "boom", scene: 2, variants: [V("Five minutes later, a bomb explodes.", ["C3"])] },
  { id: "apart", scene: 3, variants: [V("The plane breaks apart over Soacha.", ["C4"])] },
  { id: "toll", scene: 4, variants: [V("All 107 on board die, and three people on the ground.", ["C5"]), V("All 107 on board die, plus three on the ground.", ["C5"])] },
  { id: "who", scene: 5, optional: true, ...NR, variants: [V("So who wants this?"), V("Who wanted this?")] },
  { id: "explosives", scene: 6, optional: true, variants: [V("Investigators find plastic explosives.", ["C6"])] },
  { id: "cartel", scene: 7, variants: [V("Pablo Escobar's Medellín Cartel ordered it.", ["C7"]), V("Pablo Escobar ordered it.", ["C7"])] },
  { id: "target", scene: 8, variants: [V("His target is a presidential candidate, César Gaviria.", ["C8"]), V("His target is César Gaviria.", ["C8"])] },
  { id: "absent", scene: 9, variants: [V("But Gaviria is not on the plane.", ["C9"])] },
  { id: "elected", scene: 10, optional: true, variants: [V("He goes on to win the presidency.", ["C9"])] },
  { id: "das", scene: 11, variants: [V("Nine days later, another bomb kills sixty-three in Bogotá.", ["C10"]), V("Nine days later, a bomb kills sixty-three in Bogotá.", ["C10"])] },
  { id: "americans", scene: 12, optional: true, variants: [V("Two Americans died, so Washington starts hunting Escobar.", ["C11"]), V("Two Americans died, so the hunt for Escobar begins.", ["C11"])] },
  { id: "assassin", scene: 13, optional: true, variants: [V("His chief assassin gets ten life sentences.", ["C12"])] },
  { id: "disputed", scene: 14, optional: true, variants: [V("A 2016 report blames a fuel pump, but families and Avianca reject it.", ["C13"]), V("A 2016 report disputes the cause, but families reject it.", ["C13"])] },
  { id: "close", scene: 15, variants: [V("A bomb meant for one man killed one hundred and ten.", ["C5", "C8", "C9"]), V("A bomb meant for one man killed 110.", ["C5", "C8", "C9"])] },
];

export const SCENES = [
  { kind: "plane", treatment: "sticker-photo-with-date-title", objective: "Open on the very aircraft, HK-1803, with the date of the bombing", background: "paper panel in saturated frame" },
  { kind: "route", treatment: "drawn-map-with-flying-cutout", objective: "Draw the route from Bogotá to Cali with the aircraft cut-out flying along it", background: "paper panel in saturated frame" },
  { kind: "boom", treatment: "map-burst-with-number", objective: "Mark the explosion over Soacha on the same map with the number five and 'minutes after takeoff'", background: "paper panel in saturated frame" },
  { kind: "apart", treatment: "cutout-splitting", objective: "Split the aircraft cut-out in two and let the halves fall apart over Soacha", background: "paper panel in saturated frame" },
  { kind: "toll", treatment: "counted-dots", objective: "Draw 110 dots, 107 on board and three on the ground", background: "paper panel in saturated frame" },
  { kind: "who", treatment: "giant-question-mark", objective: "Pose the question of who ordered it", background: "paper panel in saturated frame" },
  { kind: "explosives", treatment: "stamp-finding", objective: "Stamp the investigation's finding: plastic explosives", background: "paper panel in saturated frame" },
  { kind: "cartel", treatment: "portrait-sticker-with-stamp", objective: "Show Pablo Escobar's police photograph with the Medellín Cartel stamp", background: "paper panel in saturated frame" },
  { kind: "target", treatment: "portrait-sticker-with-target-ring", objective: "Show César Gaviria, labelled as a 2009 photograph, with a hand-drawn ring around him", background: "paper panel in saturated frame" },
  { kind: "absent", treatment: "portrait-with-not-on-board-stamp", objective: "Stamp 'not on board' over the same portrait", background: "paper panel in saturated frame" },
  { kind: "elected", treatment: "portrait-with-elected-stamp", objective: "Show Gaviria elected president", background: "paper panel in saturated frame" },
  { kind: "das", treatment: "number-with-dots", objective: "Show 63 and nine days later in Bogotá, with the 'presumably' attribution", background: "paper panel in saturated frame" },
  { kind: "americans", treatment: "number-with-stamp", objective: "Show two Americans among the dead and the start of the hunt for Escobar", background: "paper panel in saturated frame" },
  { kind: "assassin", treatment: "number-with-strip", objective: "Show ten life sentences for the cartel's chief assassin", background: "paper panel in saturated frame" },
  { kind: "disputed", treatment: "stamp-disputed", objective: "Stamp the 2016 fuel-pump report as disputed by Avianca and the families", background: "paper panel in saturated frame" },
  { kind: "close", treatment: "dots-with-portrait", objective: "Return to the 110 dots with Gaviria's portrait faded: one target, 110 dead", background: "paper panel in saturated frame" },
];

export const METADATA = {
  title: "The Bomb Pablo Escobar Planted for a Candidate Who Wasn't on Board",
  description: "On 27 November 1989 a bomb destroyed Avianca Flight 203 over Soacha, Colombia, five minutes after it left Bogotá for Cali. All 107 people on board died, and three on the ground. The Medellín Cartel ordered it; Pablo Escobar planned it hoping to kill presidential candidate César Gaviria, who was not on the plane and went on to be elected president. A 2016 newspaper report disputes the cause; Avianca and victims' families rejected it. Facts from Wikipedia's article on Avianca Flight 203; pictures from Wikimedia Commons, credited on screen and below.\n\n#Shorts #History #PabloEscobar #Colombia #HiddenPast\n\nSource: https://en.wikipedia.org/wiki/Avianca_Flight_203\nImages: Richard Vandervord (CC BY-SA 4.0), Colombian National Police (public domain) and World Economic Forum (CC BY-SA 2.0), via Wikimedia Commons. Map data: Natural Earth (public domain).",
  tags: ["Pablo Escobar", "Avianca Flight 203", "Medellín Cartel", "César Gaviria", "Colombia", "1989", "history"],
};
