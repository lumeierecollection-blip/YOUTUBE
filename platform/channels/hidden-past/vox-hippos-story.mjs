/**
 * Hidden Past, Vox treatment: Pablo Escobar's hippos in Colombia. Hand-planned from one fetched Wikipedia article ("Hippopotamuses in
 * Colombia", retrieved on the run) and NOT reviewed by the script engine's critic. Every claim carries a text that the run must find in
 * the fetched article before it renders. Pictures are Wikimedia Commons files whose licences are read from the API on the run.
 * Everything on screen is either one of those pictures, a map drawn from Natural Earth, or text taken from a claim below.
 */
export const SLUG = "escobar-hippos-colombia";
export const TOPIC = "Pablo Escobar's hippos: four became about two hundred, and Colombia has approved a cull";
export const WIKI_ARTICLE = "https://en.wikipedia.org/wiki/Hippopotamuses_in_Colombia";
export const WIKI_TITLE = "Hippopotamuses_in_Colombia";
const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`;

export const FILES = {
  mug: { title: "File:Pablo Escobar Mug (cropped)(b).jpg", full: true },
  hippo: { title: "File:Hipopótamo Vanessa PTHN.jpg", width: 2400 },
  gate: { title: "File:Pórtico Hacienda Nápoles.JPG", width: 2000 },
};
for (const f of Object.values(FILES)) f.page_url = COMMONS(f.title);

const WIKI = WIKI_ARTICLE;
const claim = (claim_id, claimText, excerpt, must, context = "", editorial_status = "established_fact") => ({ claim_id, claim: claimText, source_id: "wiki-hippos", source_url: WIKI, published: "2026-11-11", excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status, must: { from: "wiki", text: must } });
export const CLAIMS = [
  claim("H1", "In 1981 four hippos, three females and one male, were imported by Pablo Escobar to his private menagerie at Hacienda Nápoles.", "In 1981, four hippos, three females and one male, were imported by Escobar to his private menagerie at his residence in Hacienda N", "In 1981, four hippos, three females and one male, were imported by Escobar to his private menagerie"),
  claim("H2", "Hacienda Nápoles is located between the cities of Medellín and Bogotá.", "located between the cities of Medell", "located between the cities of Medell"),
  claim("H3", "After Escobar's 1993 death the zoo was unofficially closed, but the hippos later escaped the residence and spread out to nearby areas.", "After Escobar's 1993 death, the zoo was unofficially closed, but the hippos would later escape the residence and spread out to nearby areas.", "After Escobar's 1993 death, the zoo was unofficially closed, but the hippos would later escape the residence and spread out to nearby areas."),
  claim("H4", "By 2007 the hippos had multiplied to 16.", "By 2007, the animals had multiplied to 16", "By 2007, the animals had multiplied to 16"),
  claim("H5", "In early 2014 there were reported to be 40 hippos in Puerto Triunfo, Antioquia.", "In early 2014, there were reported to be 40 hippopotamuses in Puerto Triunfo, Antioquia.", "there were reported to be 40 hippopotamuses in Puerto Triunfo", "A reported figure, not a census."),
  claim("H6", "As of April 2026 the population was around 200.", "As of April 2026, the population was around 200", "As of April 2026, the population was around 200", "An estimate: the article gives earlier counts as ranges."),
  claim("H7", "On 13 April 2026 Colombia's Ministry of Environment approved the euthanasia of more than 80 hippos.", "On April 13, 2026, the Colombian Ministry of Environment approved the euthanasia of the more than 80 hippos", "On April 13, 2026, the Colombian Ministry of Environment approved the euthanasia of the more than 80 hippos"),
  claim("H8", "The Indian billionaire Anant Ambani offered transportation and shelter in India for the animals.", "Indian billionaire Anant Ambani offered transportation and shelter in India for the animals", "Indian billionaire Anant Ambani offered transportation and shelter in India for the animals"),
  claim("H9", "Most conservationists considered the hippos problematic and invasive in Colombia.", "most conservationists considered them problematic and invasive in Colombia", "most conservationists considered them problematic and invasive in Colombia", "The article contrasts this with a minority view (H10).", "later_interpretation"),
  claim("H10", "Some ecologists have argued that the hippos should remain and might even have a positive effect on the local environment.", "some ecologists have argued that the hippos should remain and might even have a positive effect on the local environment", "some ecologists have argued that the hippos should remain and might even have a positive effect on the local environment", "A minority view, described in the article as contrasting with most conservationists.", "later_interpretation"),
];

/**
 * Slots in story order. `scene` is the picture a line sits on. Every scene has at least one required slot, so no picture is ever dropped;
 * the fitter keeps or drops the optional lines and picks the wording that lands at 35 to 40 seconds at the voice's own measured pace.
 */
const V = (text, claim_ids = []) => ({ text, claim_ids });
const NR = { allow_no_claim: true, editorial: "question or transition built from the cited claims" };
export const SLOTS = [
  { id: "hook", scene: 0, variants: [V("Pablo Escobar's hippos are still alive, and Colombia has approved killing some of them.", ["H6", "H7"]), V("Escobar's hippos are still alive, and Colombia approved killing some.", ["H6", "H7"])] },
  { id: "import", scene: 0, optional: true, variants: [V("In 1981, he imported four of them for his private zoo.", ["H1"]), V("In 1981, he imported four.", ["H1"])] },
  { id: "estate", scene: 1, variants: [V("His estate lay between Medellín and Bogotá.", ["H2"]), V("The estate lay between Medellín and Bogotá.", ["H2"])] },
  { id: "escape", scene: 2, variants: [V("After he died in 1993, they escaped and spread.", ["H3"]), V("After his death in 1993, they escaped.", ["H3"])] },
  { id: "count", scene: 2, variants: [V("By 2007 there were sixteen, by 2014 about forty, and now around two hundred.", ["H4", "H5", "H6"]), V("Sixteen by 2007, forty by 2014, around two hundred now.", ["H4", "H5", "H6"])] },
  { id: "cull", scene: 3, variants: [V("In April 2026, Colombia approved killing more than eighty of them.", ["H7"]), V("In April 2026, Colombia approved killing over eighty.", ["H7"])] },
  { id: "india", scene: 3, optional: true, variants: [V("An Indian billionaire offered to take them to India instead.", ["H8"]), V("An Indian billionaire offered them shelter in India.", ["H8"])] },
  { id: "views", scene: 4, optional: true, variants: [V("Most conservationists call them invasive, but some ecologists say they should stay.", ["H9", "H10"]), V("Most conservationists call them invasive; some ecologists disagree.", ["H9", "H10"])] },
  { id: "close", scene: 4, ...NR, variants: [V("So who decides what happens to Escobar's hippos?"), V("So who decides their fate?")] },
];

export const ROUTES = {
  chapterTitle: "The Decision",
  headlines: ["Pablo Escobar's hippos", "The estate", "From four to hundreds", "A cull is approved", "Invasive, or here to stay?"],
};

export const METADATA = {
  title: "Pablo Escobar's Hippos Are Still Alive. Colombia Approved Killing Over 80.",
  description: "In 1981 Pablo Escobar imported four hippos for his private zoo. After his death in 1993 they escaped and spread. By April 2026 there were around 200, and Colombia's Ministry of Environment approved the euthanasia of more than 80 of them, while an Indian billionaire offered to take the animals to India. Most conservationists call them invasive; some ecologists say they should stay. Facts from Wikipedia's article on hippopotamuses in Colombia; pictures from Wikimedia Commons, credited below.\n\n#Shorts #History #PabloEscobar #Colombia #HiddenPast\n\nSource: https://en.wikipedia.org/wiki/Hippopotamuses_in_Colombia\nImages: Colombian National Police (public domain), Alvaro Morales Ríos (CC BY-SA 4.0) and XalD (CC BY 3.0), via Wikimedia Commons. Map data: Natural Earth (public domain).",
  tags: ["Pablo Escobar", "Escobar hippos", "Colombia", "cocaine hippos", "invasive species", "Hacienda Nápoles", "history"],
};
