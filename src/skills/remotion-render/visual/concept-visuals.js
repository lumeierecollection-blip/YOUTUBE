/**
 * Concepts -> visual tokens (animation / concept-visual rebuild, Fix 1).
 *
 * A sentence names things: money, a person, a place, a date, a document, a
 * warning. Until now a beat showed only the number and the label; the rest of
 * what the narrator said had no picture. This module reads the sentence for
 * those concepts and maps each to a visual token — an icon from the vendored
 * Lucide set (public/icons -> icon-set.js), drawn large in the composition
 * (full-canvas.jsx ConceptToken).
 *
 * Grounding (CLAUDE.md hard rule): a concept is a WORD OF THE SENTENCE. The
 * lexicon below decides what kind that word is; the planner's model may also
 * propose concepts, but a proposal is kept only when its word appears in the
 * sentence and its kind is one of KINDS (validateConcepts) — nothing is
 * added from general knowledge. A sentence that names nothing concrete gets
 * no token; that is reported, never filled in.
 *
 * Kinds (the brief's list) and the token each draws:
 *
 *   money      dollar sign, or a banknote when the number already shows "$"
 *   currency   the symbol the sentence names ($ EUR GBP INR JPY), else dollar
 *   bill       banknote            coin        coin stack
 *   receipt    receipt             statement   statement sheet
 *   person     silhouette          group       silhouettes
 *   organization  institution      company     briefcase
 *   place      pin                 building    building silhouette
 *   city       skyline blocks      country     globe        region  map
 *   time       clock               date/year   calendar
 *   deadline   alarm clock         duration    hourglass
 *   document   sheet               contract    signed sheet
 *   filing     stack of sheets     ruling      gavel        law  scales
 *   vehicle    car / plane / ship / truck (by the word)
 *   machine    cog / chip / robot (by the word)
 *   tool       wrench / hammer     weapon      crosshair / sword
 *   product    package
 *   trade / transfer  two arrows   flow  route
 *   growth     rising line         decline     falling line
 *   loss       minus disc          gain        plus disc
 *   warning    triangle "!"        risk        shield "!"
 *   danger     octagon "!"         alert       ringing bell
 *   agreement / deal  handshake    partnership  link
 *   conflict   crossed swords
 *
 * A NAMED person / place / organization that the resolver fetched a real photo
 * of is drawn as that photo (SCENE-FULL...), so it gets no token; the token is
 * the fallback for the same concept when no verified photo exists, never a
 * stand-in for one (skipFor).
 *
 * Where this stops: the lexicon is a word list, not language understanding.
 * It misses a concept phrased in words it does not list, and a listed word can
 * be used in a sense the list did not intend ("fine" the penalty vs "fine"
 * the adjective is handled; "charge" is not listed for that reason).
 */
import { ICON_SET } from "./icon-set.js";

export const KINDS = Object.freeze([
  "money", "currency", "bill", "coin", "receipt", "statement",
  "person", "group", "organization", "company",
  "place", "building", "city", "country", "region",
  "time", "date", "year", "deadline", "duration",
  "document", "contract", "filing", "ruling", "law",
  "vehicle", "machine", "tool", "weapon", "product",
  "trade", "flow", "transfer", "growth", "decline", "loss", "gain",
  "warning", "risk", "danger", "alert",
  "agreement", "deal", "partnership", "conflict",
]);
const KIND_SET = new Set(KINDS);

// Importance when a sentence names more than the frame can carry: the money
// and the change in it first, then who did it, then what it was about.
const WEIGHT = {
  money: 96, currency: 94, bill: 92, coin: 91, receipt: 84, statement: 80,
  loss: 90, gain: 88, growth: 86, decline: 86,
  person: 82, organization: 80, company: 79, group: 76,
  warning: 85, risk: 84, danger: 85, alert: 81,
  deal: 75, agreement: 74, partnership: 72, conflict: 75,
  contract: 70, ruling: 70, law: 69, filing: 68, document: 66,
  place: 64, building: 63, city: 62, country: 62, region: 60,
  deadline: 61, duration: 58, date: 57, time: 56, year: 54,
  vehicle: 58, machine: 57, tool: 56, weapon: 58, product: 55,
  trade: 60, transfer: 60, flow: 55,
};

// kind -> [regex source of the words, ...]. Word-bounded, case-insensitive.
// Ordered: an earlier entry claims the words it matches, so "stock market"
// is a trade before "market" can be anything else.
const LEX = [
  ["receipt", "receipts?|invoices?"],
  ["statement", "(?:bank |account |financial )?statements?|balance sheets?|ledgers?"],
  ["bill", "bills?|banknotes?|cash"],
  ["coin", "coins?"],
  ["currency", "dollars?|euros?|pounds?|sterling|yen|rupees?|yuan|pesos?|bitcoin|crypto(?:currency|currencies)?|usd|eur|gbp|inr|jpy|currenc(?:y|ies)"],
  ["money", "money|funds?|payments?|paid|pays?|paying|profits?|revenues?|income|salar(?:y|ies)|wages?|budgets?|prices?|costs?|costing|fees?|fines?d?|debts?|loans?|savings?|bonus(?:es)?|wealth|earnings?|proceeds|refunds?|subsid(?:y|ies)|tax(?:es)?|premiums?|mortgages?|rent|assets?|capital|investments?|invest(?:ed|ing)?|deposits?|withdraw(?:n|al|als|s)?|billions?|millions?|trillions?|bank(?:s|ing)?|account"],
  ["loss", "loss(?:es)?|lost|lose[sd]?|losing|stole[n]?|stealing|theft|fraud(?:ulent)?|scams?|swindled?|defrauded|embezzl\\w*|wip(?:ed|es) out|wiped out|bankrupt(?:cy)?|collaps(?:e|ed|es)"],
  ["gain", "gain(?:s|ed|ing)?|earned|earn(?:s|ing)?|won|wins?|winning|saved?|saves|saving|profit(?:ed|able)?|benefit(?:s|ed)?|recovered|recover(?:s|y)"],
  ["growth", "grew|grow(?:s|n|th|ing)?|rose|ris(?:e|es|en|ing)|increas(?:e|es|ed|ing)|surg(?:e|es|ed|ing)|soar(?:s|ed|ing)?|jump(?:s|ed|ing)?|doubl(?:e|es|ed|ing)|tripl(?:e|es|ed|ing)|climb(?:s|ed|ing)?|boom(?:s|ed|ing)?|expan(?:d|ds|ded|ding|sion)|rall(?:y|ies|ied)|hik(?:e|es|ed|ing)|spik(?:e|es|ed|ing)"],
  ["decline", "fell|fall(?:s|en|ing)?|drop(?:s|ped|ping)?|declin(?:e|es|ed|ing)|decreas(?:e|es|ed|ing)|plung(?:e|es|ed|ing)|slump(?:s|ed|ing)?|shrank|shrink(?:s|ing)?|slid(?:e|es)?|sink(?:s|ing)?|sank|cut(?:s|ting)?|halv(?:e|es|ed|ing)|tumbl(?:e|es|ed|ing)|crash(?:es|ed|ing)?"],
  ["warning", "warn(?:s|ed|ing|ings)?|caution|beware|red flags?"],
  ["risk", "risks?|risky|exposure|vulnerab\\w+|threats?|liabilit(?:y|ies)|hazards?"],
  ["danger", "danger(?:s|ous)?|deadly|fatal|lethal|harm(?:s|ful|ed)?|injur(?:y|ies|ed)|crisis|emergenc(?:y|ies)|disaster"],
  ["alert", "alerts?|alarm(?:s|ed)?|notif(?:y|ies|ied|ication|ications)|flagged|urgent(?:ly)?"],
  ["conflict", "conflicts?|wars?|battles?|disputes?|clash(?:es|ed)?|fight(?:s|ing)?|fought|lawsuits?|sued|sue|sues|suing|litigation|attack(?:s|ed)?|feud"],
  ["partnership", "partner(?:s|ship|ships|ed)?|alliance|joint venture|collaborat\\w+|merg(?:er|ers|ed|es|ing)|acquisitions?|acquir(?:e|es|ed|ing)"],
  ["deal", "deals?|dealt|bargain|transactions?|takeover|buyout|settle(?:d|ment|ments|s)?|negotiat\\w+"],
  ["agreement", "agree(?:s|d|ment|ments)?|accord|treat(?:y|ies)|pact|signed|signing"],
  ["trade", "trad(?:e|es|ed|ing|er|ers)|market(?:s|place)?|stock(?:s)?|shares?|exports?|imports?|tariffs?|commerce|buy(?:s|ing)?|bought|sell(?:s|ing)?|sold|sales?|purchas\\w+|retail\\w*|exchange"],
  ["transfer", "transfer(?:s|red|ring)?|wire[sd]?|wiring|remittances?|routed|channel(?:l?ed|s)?"],
  ["flow", "flows?|flowed|flowing|pipeline|supply chain|funnel|stream(?:s|ed)?"],
  ["contract", "contracts?|contractors?|lease[sd]?|clauses?|nda|covenant"],
  ["ruling", "ruled|ruling|rulings|verdicts?|judg(?:e|es|ment|ments)|court(?:s)?|convict\\w+|sentenc\\w+|injunction|appeals?|trial|jury|magistrate"],
  ["law", "laws?|legislation|regulations?|statutes?|compliance|illegal|lawful|amendment|act of|the [A-Z]\\w+ Act"],
  ["filing", "filed|filing|filings|complaints?|petitions?|disclosures?|registration|10-?k|8-?k"],
  ["document", "documents?|paperwork|papers?|letters?|memos?|pdfs?|emails?|texts? message|manuals?|guidelines?|certificates?|licen[cs]es?|passports?|permits?|deeds?|tickets?"],
  ["vehicle", "cars?|trucks?|vans?|buses|bus|planes?|aircraft|airlines?|flights?|jets?|ships?|boats?|vessels?|trains?|railway|motorcycles?|bikes?|bicycles?|vehicles?|taxis?|drones?|tankers?|freight"],
  ["machine", "machines?|machinery|robots?|robotic|computers?|servers?|chips?|processors?|semiconductors?|engines?|turbines?|devices?|software|algorithms?|AI|automation|automated|factory|factories"],
  ["tool", "tools?|wrench|hammer|equipment|instruments?|kits?|gadgets?"],
  ["weapon", "weapons?|guns?|firearms?|rifles?|missiles?|bombs?|ammunition|arms|explosives?|swords?|knife|knives"],
  ["product", "products?|goods|packages?|parcels?|brands?|items?|merchandise|inventory|cargo|shipments?|supplies|drinks?|cans?|bottles?|foods?|medicines?|drugs?|pills?|vaccines?"],
  ["organization", "government|governments|agency|agencies|commission|committee|congress|senate|parliament|ministry|department|regulators?|authority|authorities|police|army|military|university|universities|school|schools|hospital|hospitals|court|charit(?:y|ies)|foundation|union|nonprofit|association|bureau|council|administration"],
  ["company", "compan(?:y|ies)|corporations?|corporate|firms?|startups?|businesses|business|employers?|enterprises?|retailers?|manufacturers?|lenders?|insurers?|brokers?|suppliers?|vendors?|shops?|stores?"],
  ["group", "people|customers|users|employees|workers|investors|victims|consumers|citizens|families|households|voters|residents|students|patients|members|children|kids|women|men|americans|clients|shareholders|borrowers|buyers|sellers|owners|tenants|renters|homeowners|teams?|crowds?|communit(?:y|ies)|population|public"],
  ["person", "man|woman|person|boy|girl|entrepreneur|businessman|businesswoman|founder|ceo|chairman|president|manager|director|officer|executive|employee|worker|customer|consumer|victim|defendant|plaintiff|investor|lawyer|attorney|judge|senator|governor|mayor|minister|doctor|nurse|teacher|driver|owner|landlord|tenant|borrower|buyer|seller|suspect|whistleblower|regulator|auditor|banker|trader|broker"],
  ["building", "buildings?|headquarters|hq|offices?|tower|skyscraper|warehouse|homes?|houses?|apartments?|property|properties|real estate|mansion|branch|branches|plants?|mills?|campus|bank branch|storefront|mall"],
  ["city", "cit(?:y|ies)|towns?|metropolitan|downtown|neighbou?rhoods?|suburbs?|urban|skyline"],
  ["country", "countr(?:y|ies)|nations?|abroad|overseas|borders?|worldwide|world"],
  ["region", "regions?|states?|provinces?|territor(?:y|ies)|counties|county|continent|coast|district"],
  ["place", "places?|locations?|sites?|address|scene|venue|island|beach|mountain|river|lake|park|street|road|airport|port|harbou?r|border crossing|market square"],
  ["deadline", "deadlines?|due|expires?|expired|expiry|expiration|by (?:january|february|march|april|may|june|july|august|september|october|november|december)|cutoff|cut-off|no later than|overdue"],
  ["duration", "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|several|few|many) (?:seconds?|minutes?|hours?|days?|weeks?|months?|years?|decades?)|overnight|within (?:days|weeks|months|years)|for years|for decades|long-term|short-term|hourly|timeline|period"],
  ["date", "january|february|march|april|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|tonight|weekend|holiday|christmas|anniversary|quarter|annual(?:ly)?|monthly|weekly|daily|calendar|schedule[sd]?|season"],
  ["year", "(?:19|20)\\d{2}s?|decade|century|centuries|era"],
  ["time", "time|times|clock|hours?|minutes?|moments?|delay(?:s|ed)?"],
];

const COMPILED = LEX.map(([kind, src]) => [kind, new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, "giu")]);

const CURRENCY_ICON = [
  [/[€]|\beuros?\b|\beur\b/i, "euro"],
  [/[£]|\bpounds?\b|\bsterling\b|\bgbp\b/i, "pound-sterling"],
  [/[₹]|\brupees?\b|\binr\b/i, "indian-rupee"],
  [/[¥]|\byen\b|\byuan\b|\bjpy\b/i, "japanese-yen"],
  [/[$]|\bdollars?\b|\busd\b|\bcents?\b|\bbucks?\b/i, "dollar-sign"],
];

/** The currency icon a sentence's own symbol or currency word names, or null. */
export function currencyIconOf(text) {
  const s = String(text || "");
  for (const [re, icon] of CURRENCY_ICON) if (re.test(s)) return icon;
  return null;
}

// Capitalised concept words that are common nouns, not names (months, days, bodies).
const CAP_OK = /^(?:January|February|March|April|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Congress|Senate|Parliament|Christmas|Americans|Court|Courts|Act|Commission|Committee|Department|Agency|Authority|Union|Council|Foundation|Association)$/;
const isCapitalised = (w) => /^\p{Lu}/u.test(w);
/** A capitalised word that is not at a sentence start is (nearly always) part of a name, not the noun. */
function isProperUse(sentence, index, word) {
  if (!isCapitalised(word) || /^\p{Lu}{2,}$/u.test(word)) return false;      // an acronym (AI, CEO) is not "a name"
  const before = sentence.slice(0, index).replace(/\s+$/, "");
  return before.length > 0 && !/[.!?:"“]$/.test(before);
}

/**
 * Every concept the sentence's own words name, in the order they appear:
 * [{ word, kind, at }]. `namedEntities` ([{type, name}], the planner's) add
 * the person / organization / place kinds for the names the sentence carries.
 * A word is claimed once (the first lexicon entry that lists it wins).
 */
export function conceptsOf(sentence, { namedEntities = [] } = {}) {
  const text = String(sentence || "");
  const out = [];
  const claimed = [];
  const overlaps = (a, b) => claimed.some(([x, y]) => a < y && b > x);
  const add = (word, kind, at) => { claimed.push([at, at + word.length]); out.push({ word, kind, at }); };
  // A named entity first: its whole name is one concept.
  for (const e of Array.isArray(namedEntities) ? namedEntities : []) {
    const name = String(e?.name || "").trim();
    if (!name) continue;
    const at = text.toLowerCase().indexOf(name.toLowerCase());
    if (at < 0 || overlaps(at, at + name.length)) continue;
    const t = String(e.type || "").toLowerCase();
    const kind = t === "person" ? "person" : t === "organization" ? (/\b(?:inc|corp|corporation|ltd|llc|co|company|group|holdings|plc|bank)\b\.?/i.test(name) ? "company" : "organization") : t === "place" ? "place" : null;
    if (kind) add(text.slice(at, at + name.length), kind, at);
  }
  for (const [kind, re] of COMPILED) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const word = m[0], at = m.index;
      if (overlaps(at, at + word.length)) continue;
      // A capitalised word inside a sentence, or before another capitalised word ("Bill Gates"),
      // is part of a name, not the noun — unless it is a month / day / institution.
      const nameLike = isCapitalised(word) && !/^\p{Lu}{2,}$/u.test(word) && !CAP_OK.test(word);
      if (nameLike && (isProperUse(text, at, word) || /^\s+\p{Lu}\p{L}/u.test(text.slice(at + word.length)))) continue;
      add(word, kind, at);
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Keep the planner's proposed concepts that are grounded: a real kind, its word in the sentence. */
export function validateConcepts(proposed, sentence) {
  const s = String(sentence || "").toLowerCase();
  const out = [];
  for (const p of Array.isArray(proposed) ? proposed : []) {
    const word = String(p?.word || "").trim(), kind = String(p?.kind || "").trim().toLowerCase();
    if (!word || !KIND_SET.has(kind)) continue;
    const at = s.indexOf(word.toLowerCase());
    if (at < 0) continue;
    out.push({ word: String(sentence).slice(at, at + word.length), kind, at });
  }
  return out;
}

/** The sentence's concepts: the lexicon's, plus any grounded proposal of the model's (same word, same kind, once). */
export function mergeConcepts(sentence, { proposed = [], namedEntities = [] } = {}) {
  const all = [...conceptsOf(sentence, { namedEntities }), ...validateConcepts(proposed, sentence)];
  const seen = new Set(), out = [];
  for (const c of all.sort((a, b) => a.at - b.at)) {
    const key = `${c.kind}:${c.word.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
  }
  return out;
}

/**
 * An icon's drawable elements with line / polyline / polygon rewritten as
 * <path>: Chromium honours pathLength (the stroke draw-on) on a path, a rect
 * and a circle but not on a <line> — measured 2026-09-29, the dollar sign's
 * vertical bar rendered as a dot until it became a path.
 */
export function iconElements(name) {
  const els = ICON_SET[name];
  if (!els) return null;
  const pts = (p) => String(p).trim().split(/[\s,]+/).map(Number);
  return els.map(([tag, a]) => {
    if (tag === "line") return ["path", { d: `M${a.x1} ${a.y1}L${a.x2} ${a.y2}` }];
    if (tag === "polyline" || tag === "polygon") {
      const v = pts(a.points), d = [];
      for (let i = 0; i + 1 < v.length; i += 2) d.push(`${i ? "L" : "M"}${v[i]} ${v[i + 1]}`);
      return ["path", { d: d.join("") + (tag === "polygon" ? "Z" : "") }];
    }
    return [tag, a];
  });
}

const HAS = (name) => Object.prototype.hasOwnProperty.call(ICON_SET, name);

const VEHICLE = [[/plane|aircraft|airline|flight|jet|drone/i, "plane"], [/ship|boat|vessel|tanker|freight/i, "ship"], [/truck|van|bus/i, "truck"]];
const MACHINE = [[/robot|automat/i, "bot"], [/chip|processor|semiconductor|computer|server|software|algorithm|\bAI\b|device/i, "cpu"]];
const TOOL = [[/hammer/i, "hammer"]];
const WEAPON = [[/sword|knife|knives/i, "sword"]];
const pickBy = (table, word, fallback) => { for (const [re, icon] of table) if (re.test(word)) return icon; return fallback; };

/** Kinds that draw in the channel accent (a change, a loss, an alarm); the rest are ink. */
const ACCENT_KINDS = new Set(["loss", "gain", "growth", "decline", "warning", "risk", "danger", "alert", "conflict"]);

/**
 * The visual token for one concept: { kind, word, icon, tint }.
 * `ctx.sentence` picks the currency; `ctx.numberShowsCurrency` (the beat's
 * hero number already carries the "$") turns a plain money concept into a
 * banknote instead of a second dollar sign.
 */
export function tokenFor(concept, ctx = {}) {
  const { kind, word } = concept;
  let icon;
  switch (kind) {
    case "money": icon = ctx.numberShowsCurrency ? "banknote" : currencyIconOf(ctx.sentence) || "banknote"; break;
    case "currency": icon = currencyIconOf(word) || currencyIconOf(ctx.sentence) || "dollar-sign"; break;
    case "bill": icon = "banknote"; break;
    case "coin": icon = "coins"; break;
    case "receipt": icon = "receipt"; break;
    case "statement": icon = "file-text"; break;
    case "person": icon = "user"; break;
    case "group": icon = "users"; break;
    case "organization": icon = "landmark"; break;
    case "company": icon = "briefcase"; break;
    case "place": icon = "map-pin"; break;
    case "building": icon = "building"; break;
    case "city": icon = "building-2"; break;
    case "country": icon = "globe"; break;
    case "region": icon = "map"; break;
    case "time": icon = "clock"; break;
    case "date": case "year": icon = "calendar"; break;
    case "deadline": icon = "alarm-clock"; break;
    case "duration": icon = "hourglass"; break;
    case "document": icon = "file-text"; break;
    case "contract": icon = "file-signature"; break;
    case "filing": icon = "file-stack"; break;
    case "ruling": icon = "gavel"; break;
    case "law": icon = "scale"; break;
    case "vehicle": icon = pickBy(VEHICLE, word, "car"); break;
    case "machine": icon = pickBy(MACHINE, word, "cog"); break;
    case "tool": icon = pickBy(TOOL, word, "wrench"); break;
    case "weapon": icon = pickBy(WEAPON, word, "crosshair"); break;
    case "product": icon = "package"; break;
    case "trade": case "transfer": icon = "arrow-left-right"; break;
    case "flow": icon = "route"; break;
    case "growth": icon = "trending-up"; break;
    case "decline": icon = "trending-down"; break;
    case "loss": icon = "circle-minus"; break;
    case "gain": icon = "circle-plus"; break;
    case "warning": icon = "triangle-alert"; break;
    case "risk": icon = "shield-alert"; break;
    case "danger": icon = "octagon-alert"; break;
    case "alert": icon = "bell-ring"; break;
    case "agreement": case "deal": icon = "handshake"; break;
    case "partnership": icon = "link"; break;
    case "conflict": icon = "swords"; break;
    default: icon = null;
  }
  if (!icon || !HAS(icon)) return null;
  return { kind, word, icon, tint: ACCENT_KINDS.has(kind) ? "accent" : "ink" };
}

const MONEY_KINDS = new Set(["money", "currency", "bill", "coin", "receipt", "statement"]);
const PLACE_KINDS = new Set(["place", "building", "city", "country", "region"]);
const WHO_KINDS = new Set(["person", "group", "organization", "company"]);
const TIME_KINDS = new Set(["time", "date", "year", "deadline", "duration"]);
const DOC_KINDS = new Set(["document", "contract", "filing", "ruling", "law"]);
const CHANGE_KINDS = new Set(["growth", "decline", "loss", "gain"]);

/**
 * True when the beat's own composition already shows this kind of concept, so
 * a token would repeat it: a real photo (a named person / place /
 * organization / building), the money photo, the map, the document scan,
 * the timeline's dates, a chart's change. `beat`: { composition, visual_type, photo }.
 */
export function skipFor(kind, beat = {}) {
  const comp = beat.composition, vt = String(beat.visual_type || "").toUpperCase();
  if (beat.photo) {
    if (comp === "MONEY") return MONEY_KINDS.has(kind);
    if (comp === "DOCUMENT") return DOC_KINDS.has(kind);
    if (comp === "ARCHITECTURE") return PLACE_KINDS.has(kind) || kind === "organization" || kind === "company";
    return PLACE_KINDS.has(kind) || WHO_KINDS.has(kind);
  }
  if (comp === "MAP-CENTERED") return PLACE_KINDS.has(kind);
  if (comp === "TIMELINE") return TIME_KINDS.has(kind);
  if (comp === "COMPARISON-SPLIT" && vt === "COMPARE") return false;
  return false;
}

/** The 2 most important concepts (the brief: more than the frame can carry -> the 2 most important), one per icon. */
export function pickConcepts(concepts, { max = 2, beat = {}, sentence = "", numberShowsCurrency = false } = {}) {
  const ranked = (concepts || [])
    .filter((c) => !skipFor(c.kind, beat))
    .map((c, order) => ({ c, order, t: tokenFor(c, { sentence, numberShowsCurrency }) }))
    .filter((x) => x.t)
    .sort((a, b) => (WEIGHT[b.c.kind] || 0) - (WEIGHT[a.c.kind] || 0) || a.order - b.order);
  const out = [], icons = new Set();
  for (const x of ranked) {
    if (icons.has(x.t.icon)) continue;
    icons.add(x.t.icon);
    out.push({ ...x.t, role: out.length === 0 ? "primary" : "secondary" });
    if (out.length >= max) break;
  }
  return out;
}

/** The whole step the resolver / planner runs: a sentence and its beat -> the tokens to draw (0-2). */
export function conceptTokens(sentence, { proposed = [], namedEntities = [], beat = {}, numberShowsCurrency = false, max = 2 } = {}) {
  const concepts = mergeConcepts(sentence, { proposed, namedEntities });
  return { concepts, tokens: pickConcepts(concepts, { max, beat, sentence, numberShowsCurrency }) };
}
