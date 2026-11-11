/**
 * Hidden Past, layered Vox cut at about 30 seconds: Al Capone, brought down by income tax. Written directly from one fetched Wikipedia article
 * ("Al Capone", retrieved on the run). Every claim carries a text the run must find in that article before it renders. The pictures are Wikimedia
 * Commons files (all public domain, licences read from the API on the run). The 1929 date of the massacre comes from the New York Times front page
 * scan itself (its Commons file name and masthead read Friday, February 15, 1929), not from the Wikipedia sentence.
 * Not reviewed by the script engine's critic. The story answers, in order: who, what made him famous, why newspapers named him, how the case was
 * built, how many charges, how it was proved, the sentence, where he served, and how it ended. Nothing is left as an open question.
 */
export const SLUG = "al-capone-income-tax";
export const TOPIC = "Al Capone: the Chicago crime boss brought down by income tax";
export const WIKI_ARTICLE = "https://en.wikipedia.org/wiki/Al_Capone";
export const WIKI_TITLE = "Al_Capone";
const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`;

export const ASSETS = [
  { key: "portrait", id: "capone-1930", title: "File:Al Capone in 1930 (cropped).jpg", claim: "K1", role: "Al Capone, 1930", halftone: true },
  { key: "press", id: "nyt-1929", title: "File:19290215 Valentine's Day Massacre - Seven Chicago Gangsters Slain - NY Times.jpg", claim: "K2", role: "The New York Times front page, 15 February 1929", doc: true },
  { key: "m1929", id: "capone-1929", title: "File:Al Capone in 1929.jpg", claim: "K3", role: "Al Capone, photographed in 1929", halftone: true },
  { key: "bop", id: "capone-bop", title: "File:AlCaponemugshotCPD.jpg", claim: "K7", role: "Al Capone, US Bureau of Prisons photograph", halftone: true },
  { key: "atlanta", id: "atlanta", title: "File:Entrance to the federal penitentiary, Atlanta LCCN2002698072.jpg", claim: "K9", role: "Entrance to the federal penitentiary, Atlanta (an early photograph)", halftone: true },
  { key: "alcatraz", id: "alcatraz", title: "File:USS Oklahoma (BB-37) passing Alcatraz in the 1930s.jpg", claim: "K10", role: "Alcatraz in the 1930s", halftone: true },
  { key: "later", id: "capone-1935", title: "File:Al Capone-around 1935 (cropped).jpg", claim: "K11", role: "Al Capone, around 1935", halftone: true },
  { key: "death", id: "death-cert", title: "File:Death certificate of Al Capone.jpg", claim: "K12", role: "Death certificate, 1947", doc: true },
];
for (const a of ASSETS) a.page_url = COMMONS(a.title);

const claim = (claim_id, text, excerpt, must, context = "", status = "established_fact") => ({ claim_id, claim: text, source_id: "wiki-capone", source_url: WIKI_ARTICLE, published: "2026-11-11", excerpt, confidence: "high", context, contradictory_evidence: [], editorial_status: status, must: { from: "wiki", text: must } });
export const CLAIMS = [
  claim("K1", "Al Capone was the co-founder and boss of the Chicago Outfit from 1925 to 1931, notorious during Prohibition.", "co-founder and boss of the Chicago Outfit from 1925 to 1931", "co-founder and boss of the Chicago Outfit from 1925 to 1931"),
  { claim_id: "K2", claim: "Seven gangsters were shot dead in Chicago on 14 February 1929 (the St Valentine's Day Massacre); the New York Times of 15 February 1929 reported '7 Chicago gangsters slain'.", source_id: "src-nyt", source_url: "https://commons.wikimedia.org/wiki/File:19290215_Valentine%27s_Day_Massacre_-_Seven_Chicago_Gangsters_Slain_-_NY_Times.jpg", published: "1929-02-15", excerpt: "7 CHICAGO GANGSTERS SLAIN BY FIRING SQUAD OF RIVALS", confidence: "high", context: "The scan's masthead reads Friday, February 15, 1929. Wikipedia says seven people from rival gangs were murdered in broad daylight.", contradictory_evidence: [], editorial_status: "established_fact", must: { from: "wiki", text: "seven people from rival gangs were murdered in broad daylight" } },
  claim("K3", "Newspapers dubbed Capone 'Public Enemy No. 1'.", "newspapers to dub Capone \"Public Enemy No. 1\"", "newspapers to dub Capone \"Public Enemy No. 1\""),
  claim("K4", "The Treasury and Justice Departments developed plans for income tax prosecutions against Chicago gangsters.", "Treasury and Justice Departments developed plans for income tax prosecutions against Chicago gangsters", "Treasury and Justice Departments developed plans for income tax prosecutions against Chicago gangsters"),
  claim("K5", "Federal authorities charged Capone with twenty-two counts of tax evasion.", "charged him with twenty-two counts of tax evasion", "charged him with twenty-two counts of tax evasion"),
  claim("K6", "The judge admitted as evidence Capone's own admissions of his income and unpaid taxes.", "the judge admitted as evidence Capone's admissions of his income and unpaid taxes", "the judge admitted as evidence Capone's admissions of his income and unpaid taxes"),
  claim("K7", "He was convicted of five counts in 1931 and sentenced to 11 years in federal prison, fined $50,000.", "He was convicted of five counts in 1931.", "He was convicted of five counts in 1931"),
  claim("K8", "Capone was sentenced to 11 years in federal prison and fined $50,000.", "was sentenced a week later to 11 years in federal prison, fined $50,000", "was sentenced a week later to 11 years in federal prison, fined $50,000"),
  claim("K9", "Capone was sent to Atlanta U.S. Penitentiary in May 1932.", "Capone was sent to Atlanta U.S. Penitentiary in May 1932", "Capone was sent to Atlanta U.S. Penitentiary in May 1932"),
  claim("K10", "Capone was moved to Alcatraz in August 1934.", "recently opened Alcatraz Federal Penitentiary off the coast of San Francisco, in August 1934", "recently opened Alcatraz Federal Penitentiary off the coast of San Francisco, in August 1934"),
  claim("K11", "Capone was released after almost eight years of incarceration, having shown signs of neurosyphilis early in his sentence.", "released after almost eight years of incarceration", "released after almost eight years of incarceration"),
  claim("K12", "In 1947 Capone died of cardiac arrest after a stroke.", "In 1947, he died of cardiac arrest after a stroke.", "In 1947, he died of cardiac arrest after a stroke."),
];

const V = (text, claim_ids = []) => ({ text, claim_ids });
/** One slot per picture, in story order. Required slots carry the whole story; optional ones add detail where the 30 seconds allow. */
export const SLOTS = [
  { id: "name", scene: 0, variants: [V("Al Capone ran Chicago's Outfit through Prohibition.", ["K1"]), V("Al Capone ruled Chicago's Prohibition underworld.", ["K1"])] },
  { id: "massacre", scene: 1, variants: [V("In 1929, seven rival gangsters were murdered in broad daylight.", ["K2"]), V("In 1929, seven gangsters were murdered.", ["K2"])] },
  { id: "enemy", scene: 2, optional: true, variants: [V("Newspapers called him Public Enemy Number One.", ["K3"])] },
  { id: "tax", scene: 3, variants: [V("Federal agents chose another weapon: income tax.", ["K4"]), V("Agents turned to income tax.", ["K4"])] },
  { id: "counts", scene: 4, variants: [V("Twenty-two counts of tax evasion.", ["K5"])] },
  { id: "evidence", scene: 5, optional: true, variants: [V("His own admissions of income became evidence.", ["K6"])] },
  { id: "sentence", scene: 6, variants: [V("Convicted on five counts, he got eleven years.", ["K7", "K8"]), V("Five convictions, eleven years.", ["K7", "K8"])] },
  { id: "prisons", scene: 7, optional: true, variants: [V("He served in Atlanta, then Alcatraz.", ["K9", "K10"])] },
  { id: "end", scene: 8, variants: [V("Released after almost eight years, he died in 1947.", ["K11", "K12"]), V("He died in 1947.", ["K12"])] },
  { id: "close", scene: 9, variants: [V("His own tax records ended the crime boss's reign.", ["K1", "K6", "K7"]), V("Taxes ended his reign.", ["K1", "K7"])] },
];

export const SCENES = [
  { kind: "name", treatment: "name-title-with-portrait", objective: "Open on the name Al Capone over his 1930 portrait, with the years he led the Chicago Outfit", background: "paper panel in saturated frame" },
  { kind: "massacre", treatment: "newspaper-scan-with-number", objective: "Show the New York Times front page of 15 February 1929 and the number seven", background: "paper panel in saturated frame" },
  { kind: "enemy", treatment: "portrait-with-stamp", objective: "Stamp 'Public Enemy No. 1' over a 1929 photograph", background: "paper panel in saturated frame" },
  { kind: "tax", treatment: "giant-word-with-strips", objective: "Turn to income tax as the weapon, named as a plan of the Treasury and Justice Departments", background: "paper panel in saturated frame" },
  { kind: "counts", treatment: "counted-dots", objective: "Draw twenty-two counts as dots; the five he was convicted on in the accent colour", background: "paper panel in saturated frame" },
  { kind: "evidence", treatment: "quote-slip", objective: "Quote the source sentence on his own admissions of income being admitted as evidence", background: "paper panel in saturated frame" },
  { kind: "sentence", treatment: "photo-with-giant-number", objective: "Show eleven years with the prison photograph and the fine", background: "paper panel in saturated frame" },
  { kind: "prisons", treatment: "drawn-route-with-two-photos", objective: "Draw Chicago to Atlanta (1932) to Alcatraz (1934) with a photograph of each prison", background: "paper panel in saturated frame" },
  { kind: "end", treatment: "portrait-and-death-certificate", objective: "Show him around 1935 and the 1947 death certificate", background: "paper panel in saturated frame" },
  { kind: "close", treatment: "title-with-stamp", objective: "Close on the reframe: his own tax records ended it", background: "paper panel in saturated frame" },
];

export const METADATA = {
  title: "Al Capone Was Brought Down by Income Tax",
  description: "Al Capone ran the Chicago Outfit from 1925 to 1931. After seven rival gangsters were murdered in 1929 and newspapers named him Public Enemy No. 1, the Treasury and Justice Departments planned income tax prosecutions. He was charged with 22 counts of tax evasion, his own admissions of his income were admitted as evidence, and in 1931 he was convicted of five counts and sentenced to 11 years. He served in Atlanta, then Alcatraz, was released after almost eight years and died in 1947. Facts from Wikipedia's article on Al Capone; pictures from Wikimedia Commons (all public domain), credited on screen and below.\n\n#Shorts #History #AlCapone #Chicago #HiddenPast\n\nSource: https://en.wikipedia.org/wiki/Al_Capone\nImages: Wide World Photos / Chicago Bureau (FBI), The New York Times, Pennsylvania Department of Corrections / FBI, US Bureau of Prisons, George Grantham Bain Collection, US Navy and C.W. Tomlinson, via Wikimedia Commons. Map data: Natural Earth (public domain).",
  tags: ["Al Capone", "Chicago Outfit", "Prohibition", "tax evasion", "Alcatraz", "Public Enemy No. 1", "history"],
};
