/**
 * Hand-planned sample for Hidden Past. PROVISIONAL: not from the script engine.
 * Every claim carries its source and a text the run must find in that source before it renders.
 */
export const SLUG = "arrest-photo-not-princip";
export const TOPIC = "The Sarajevo arrest photograph that is often misattributed";

export const WIKI_ARTICLE = "https://en.wikipedia.org/wiki/Assassination_of_Archduke_Franz_Ferdinand";
const COMMONS = (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%28/g, "(").replace(/%29/g, ")")}`;

/** Commons files. `page` selects a PDF page. `use` says how the image is treated. */
export const FILES = {
  couple: { title: "File:Archduke Franz Ferdinand in Sarajevo, June 1914 Q91848.jpg", use: "photo", full: true },
  map1914: { title: "File:Austria-Hungary (ethnic 1890, with red 1914 and blue 1920 borders).jpg", use: "document", width: 2200 },
  nyt: { title: "File:The New York Times 1914-06-29- Vol 63 Iss 20610 (IA per new-york-times-magazine the-new-york-times 1914-06-29 63 20610).pdf", use: "document", page: 1, width: 2400 },
  behr: { title: "File:Ferdinand Behr arrested in Sarajevo 1914.jpg", use: "photo", full: true },
};
for (const f of Object.values(FILES)) f.page_url = COMMONS(f.title);

/** Each sentence is one spoken line. `scene` groups sentences onto one picture. */
export const SENTENCES = [
  { id: "s1", scene: 0, claim_ids: ["c1"], text: "Sarajevo, 28 June 1914. The archduke and his wife leave city hall." },
  { id: "s2", scene: 1, claim_ids: ["c2"], text: "Today, Bosnia and Herzegovina." },
  { id: "s3", scene: 2, claim_ids: ["c3"], text: "In 1914, Austria-Hungary, annexed in 1908." },
  { id: "s4", scene: 3, claim_ids: ["c4"], text: "Next day, The New York Times reports the killings." },
  { id: "s5", scene: 4, claim_ids: ["c5"], text: "This photo is often captioned as Princip's arrest." },
  { id: "s6", scene: 4, claim_ids: ["c5"], text: "Scholars say it shows Ferdinand Behr, a bystander." },
  { id: "s7", scene: 4, claim_ids: ["c6"], text: "David James Smith: no photo of Princip's arrest exists." },
];

/** `must` strings have to appear in the fetched source text, or the run stops. */
export const CLAIMS = [
  { claim_id: "c1", claim: "Archduke Franz Ferdinand and Sophie are photographed getting into a car at Sarajevo City Hall on 28 June 1914, shortly before the assassination.", source_id: "src-couple", source_url: FILES.couple.page_url, excerpt: "get into a motor car to depart from the City Hall, Sarajevo, shortly before they were assassinated", must: { from: "commons-wikitext", file: "couple", text: "City Hall, Sarajevo" }, confidence: "high", editorial_status: "primary_source", context: "Photographer unknown; caption text is the Imperial War Museums description carried on Commons." },
  { claim_id: "c2", claim: "Sarajevo is the capital of Bosnia and Herzegovina.", source_id: "src-wiki-sarajevo", source_url: "https://en.wikipedia.org/wiki/Sarajevo", excerpt: "capital and largest city of Bosnia and Herzegovina", must: { from: "wiki-sarajevo", text: "capital and largest city of Bosnia and Herzegovina" }, confidence: "high", editorial_status: "established_fact", context: "Shown on a Natural Earth 1:50m map (public domain); place coordinates from Wikipedia." },
  { claim_id: "c3", claim: "Bosnia and Herzegovina was formally annexed by Austria-Hungary in 1908, and was part of it in June 1914.", source_id: "src-wiki", source_url: WIKI_ARTICLE, excerpt: "Bosnia and Herzegovina, formally annexed by Austria-Hungary in 1908", must: { from: "wiki", text: "formally annexed by Austria-Hungary in 1908" }, confidence: "high", editorial_status: "established_fact", context: "The dated map is an 1895 ethnographic map by Richard Andree with the 1914 border added later; it is used to show the 1914 border, not 1895 politics." },
  { claim_id: "c4", claim: "The New York Times front page of Monday 29 June 1914 reports the archduke and his wife were killed in Sarajevo by a Bosnian youth.", source_id: "src-nyt", source_url: FILES.nyt.page_url, excerpt: "HEIR TO AUSTRIA'S THRONE IS SLAIN WITH HIS WIFE BY A BOSNIAN YOUTH TO AVENGE SEIZURE OF HIS COUNTRY", must: { from: "commons-info", file: "nyt", text: "1914-06-29" }, confidence: "high", editorial_status: "primary_source", context: "Headline read from the scanned page image. The newspaper's own framing (avenging seizure of a country) is the paper's, 1914." },
  { claim_id: "c5", claim: "The photograph is often said to show the arrest of Gavrilo Princip, but several scholars say it shows Ferdinand Behr, a bystander initially suspected of involvement.", source_id: "src-behr", source_url: FILES.behr.page_url, excerpt: "often said to depict the arrest of Gavrilo Princip, although several scholars say that it depicts the arrest of Ferdinand Behr, a bystander", must: { from: "commons-wikitext", file: "behr", text: "several scholars say that it depicts the arrest of Ferdinand Behr, a bystander" }, confidence: "medium", editorial_status: "later_interpretation", context: "Cited on Commons to Finestone & Massie, The Last Courts of Europe (Dent, 1981, p. 247). Scholarly attribution, not a caption from 1914." },
  { claim_id: "c6", claim: "David James Smith writes that there is no photograph of Princip's arrest.", source_id: "src-behr", source_url: FILES.behr.page_url, excerpt: "there is no photograph of Gavro's arrest - this photograph shows the arrest of Behr", must: { from: "commons-wikitext", file: "behr", text: "there is no photograph of Gavro's arrest" }, confidence: "medium", editorial_status: "later_interpretation", context: "Quoted on Commons from David James Smith, One Morning in Sarajevo (Hachette UK, 2010). One author's judgement; the narration attributes it." },
];

export const ROUTES = {
  chapterTitle: "The Caption",
  headlines: ["28 June 1914", "Sarajevo today", "Same city, 1914", "Next-day front page", "A caption in doubt"],
};
