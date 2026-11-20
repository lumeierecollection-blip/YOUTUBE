// AI Tested Short, 20 Nov 2026: "Air Canada's chatbot lied". Rebuilt after the 48% swipe-away of the hallucination Short, whose measured pace was one
// picture every 4.8 s with a grey-page opening. Reference v3 (owner upload, channel-reverse/reports/shorts-study-2026-11-19.md): real photos from frame
// one, a new picture on every mention (~0.5-1 s), centred name keywords, giant years, the lesson word by word, 172 wpm. Owner rule (20 Nov): every person,
// thing, date or number said is on screen as it is said. Plan: data/shorts/ai-tested/air-canada/PLAN.md.
// Facts ONLY from Moffatt v. Air Canada, 2024 BCCRT 149 (Wikipedia snapshot, data/shorts/ai-tested/air-canada/Moffatt_v._Air_Canada.wiki, 20 Nov 2026).
// No photo of Jake Moffatt (a private person): a name card over a faceless travel photo.
export const STYLE = "v3";
export const CALM = true, FILL = false;   // calm = no glitch/strobe effects; the pace comes from one picture per mention
export const VOICE_STYLE = "Say it like a sharp, confident YouTube Shorts narrator telling a surprising true story: brisk and energetic, about 172 words a minute, every word clear, tiny pauses only at full stops, punch on names, years and numbers:";
export const ENTITIES = [];
export const CUTOUTS = [];
export const SCRIPT = "In 2022, Jake Moffatt's grandmother died. He asked Air Canada's chatbot about bereavement fares. It said: fly now, claim the discount within 90 days. He paid 1,630 dollars. Air Canada said no. Its defence? The chatbot is a separate legal entity, responsible for its own actions. The tribunal called that remarkable, and made Air Canada pay. If your AI says it, you said it. Would you trust an airline's chatbot?";
export const KEYS = {};
export const SOURCES = { M: { title: "Wikipedia: Moffatt v. Air Canada (2024 BCCRT 149)", url: "https://en.wikipedia.org/wiki/Moffatt_v._Air_Canada", retrieved: "2026-11-20" } };
export const FOOTAGE_REQUIRE = /plane|airport|airplane|aircraft|phone|typing|candle|flight|takeoff|runway/i;
export const FOOTAGE = [
  { id: "sx-ac-takeoff", q: "airplane takeoff runway" }, { id: "sx-ac-typing", q: "typing on phone close up" }, { id: "sx-ac-airport", q: "airport terminal people walking", optional: true },
];
export const PHOTOS = [
  ["ac-board", "File:48_Aviation_industry_in_Australia_-_Melbourne_Airport_departures_board.jpg", "an airport departures board (illustrative)"],
  ["ac-candle", "File:Flickr_-_Government_Press_Office_(GPO)_-_TEENAGERS_LIGHTING_MEMORIAL_CANDLES_AFTER_HEARING_THE_SIREN.jpg", "memorial candles (illustrative)"],
  ["ac-phone", "File:Smartphone_in_Hand_(Unsplash).jpg", "a phone in a hand (illustrative)"],
  ["ac-tail", "File:2016-08_Air_Canada_aircraft_logo.jpg", "the Air Canada logo on an aircraft tail (identifies the company named)"],
  ["ac-787", "File:Air_Canada_Boeing_787-9_Dreamliner_C-FVND_approaching_EWR_Airport.jpg", "an Air Canada Boeing 787-9"],
  ["ac-787b", "File:Air_Canada_Boeing_787-8_(C-GHPQ)_at_London_Heathrow_Airport.jpg", "an Air Canada Boeing 787-8 at Heathrow"],
  ["ac-yvr", "File:Vancouver_Airport_Skytrain_Station_2008-04-22.JPG", "Vancouver airport (the trip began in Vancouver)"],
  ["ac-gavel", "File:3D_Judges_Gavel.jpg", "a judge's gavel (illustrative)"],
  ["ac-phone2", "File:Black_smartphone_in_hand_(Unsplash).jpg", "a smartphone in a hand (illustrative)"],
];
export const CAPTURES = [];
export const TAG = null;
export const CTA = null;
export const SHOTS = [   // v3 (20 Nov): owner - pictures must literally show what is said (a grandma for 'grandmother', not candles; no costume man for a legal line). Checked by check-visuals.mjs before render.
  { at: "2022,", kind: "year", photo: "ac-board", year: "2022" },
  { at: "Jake", kind: "full", photo: "ac-solo", cap: "Jake Moffatt" },
  { at: "grandmother", kind: "full", photo: "ac-grandma", cap: "his grandmother died" },
  { at: "asked", kind: "full", photo: "ac-chat-ask", cap: "he asked" },
  { at: "Air", kind: "full", photo: "ac-tail", cap: "Air Canada" },
  { at: "chatbot", kind: "full", photo: "ac-chat-intro", cap: "its chatbot" },
  { at: "bereavement", kind: "full", photo: "ac-tag", cap: "“Bereavement fares?”" },
  { at: "fly", kind: "full", photo: "ac-takeoff", cap: "“Fly now”" },
  { at: "claim", kind: "full", photo: "ac-sign", cap: "“...claim the discount later”" },
  { at: "90", kind: "stat", value: "90", label: "days to claim" },
  { at: "paid", kind: "money", value: "$1,630", unit: "Canadian dollars", asset: "png-money-bundle", stacks: 2 },
  { at: "said", kind: "full", photo: "ac-stamp", cap: "REFUSED" },
  { at: "defence?", kind: "full", photo: "ac-787b", cap: "Air Canada's defence" },
  { at: "separate", kind: "full", photo: "ac-lawbooks", cap: "“a separate legal entity”" },
  { at: "responsible", kind: "page", page: "“responsible for its own actions”" },
  { at: "tribunal", kind: "full", photo: "ac-gavel", cap: "Civil Resolution Tribunal, BC" },
  { at: "remarkable,", kind: "full", photo: "ac-gavel2", cap: "“remarkable”" },
  { at: "pay.", kind: "money", value: "CA$812", unit: "awarded, 14 Feb 2024", asset: "png-money-stack", stacks: 1 },
  { at: "If", kind: "full", photo: "ac-chat-bot", cap: "If your AI says it," },
  { at: "you", kind: "full", photo: "ac-court2", cap: "you said it." },
  { at: "Would", kind: "full", photo: "ac-terminal", cap: "Would you trust an airline's chatbot?" },
];
