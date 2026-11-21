// AI Tested Short (21 Nov 2026), hand-built after the autopilot's generic topics were rejected. Facts ONLY from Wikipedia "Mata v. Avianca, Inc." (fetched 21 Nov 2026):
// Feb 2022 suit, metal cart struck his knee, lawyers used ChatGPT for fake precedents, ChatGPT assured the cases "indeed exist", May 2023 Judge P. Kevin Castel dismissed it, $5,000 fine, one analysis "gibberish".
// Roberto Mata is a private person: a name card, no photo. Opens on the outcome (the 56.8% swipe-away lesson).
export const STYLE = "v3", CALM = true, FILL = false, TAG = null, CTA = null, ENTITIES = [], CUTOUTS = [], KEYS = {}, CAPTURES = [], PHOTOS = [], FOOTAGE = [], FOOTAGE_REQUIRE = /x^/;
export const VOICE_STYLE = "Say it like a sharp, confident YouTube Shorts narrator telling a surprising true story: brisk and energetic, about 172 words a minute, every word clear, tiny pauses only at full stops, punch on names, years and numbers:";
export const SCRIPT = "Fake cases. Lawyers trusted ChatGPT with a lawsuit, and it invented them. A judge fined them 5,000 dollars. In 2022, Roberto Mata sued Avianca after a metal cart hit his knee. His lawyers cited cases that did not exist. Asked if the cases were real, ChatGPT said they exist. Judge Castel called one analysis gibberish. Would you trust ChatGPT with a lawsuit?";
export const SOURCES = { M: { title: "Wikipedia: Mata v. Avianca, Inc.", url: "https://en.wikipedia.org/wiki/Mata_v._Avianca,_Inc.", retrieved: "2026-11-21" } };
export const SHOTS = [
 {
  "at": "Fake",
  "kind": "stat",
  "value": "FAKE",
  "label": "court cases"
 },
 {
  "at": "Lawyers",
  "kind": "full",
  "photo": "mt-lawyers",
  "cap": "lawyers"
 },
 {
  "at": "ChatGPT",
  "kind": "full",
  "photo": "mt-chatgpt",
  "cap": "ChatGPT"
 },
 {
  "at": "lawsuit,",
  "kind": "full",
  "photo": "ac-lawbooks",
  "cap": "a lawsuit"
 },
 {
  "at": "judge",
  "kind": "full",
  "photo": "ac-gavel",
  "cap": "a judge"
 },
 {
  "at": "5,000",
  "kind": "money",
  "value": "$5,000",
  "unit": "fine, May 2023",
  "asset": "png-money-stack",
  "stacks": 1
 },
 {
  "at": "2022,",
  "kind": "stat",
  "value": "2022",
  "label": ""
 },
 {
  "at": "Roberto",
  "kind": "page",
  "page": "Roberto Mata"
 },
 {
  "at": "Avianca",
  "kind": "full",
  "photo": "mt-avianca",
  "cap": "Avianca"
 },
 {
  "at": "metal",
  "kind": "full",
  "photo": "mt-cart",
  "cap": "a metal cart"
 },
 {
  "at": "knee.",
  "kind": "full",
  "photo": "mt-knee",
  "cap": "his knee"
 },
 {
  "at": "did",
  "kind": "page",
  "page": "cases that did not exist"
 },
 {
  "at": "Asked",
  "kind": "full",
  "photo": "mt-said",
  "cap": ""
 },
 {
  "at": "said",
  "kind": "page",
  "page": "“They exist.”"
 },
 {
  "at": "Castel",
  "kind": "page",
  "page": "Judge P. Kevin Castel"
 },
 {
  "at": "gibberish.",
  "kind": "page",
  "page": "“gibberish”"
 },
 {
  "at": "Would",
  "kind": "full",
  "photo": "ac-gavel2",
  "cap": "Would you trust ChatGPT with a lawsuit?"
 }
];
