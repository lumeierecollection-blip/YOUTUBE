/** Small text helpers shared by the deterministic checks. No dependencies. */

export const STOP = new Set(`a an the and or but if then than so of to in on at by for with from as is are was were be been being it its this that these those there here
i you he she we they them his her their our your my me us not no do does did done has have had will would can could should may might must just also very more most
about into over under after before while during up down out off again once only own same such too s t who whom whose what which when where why how all any both each few other some
one two three per via vs versus said says say new now because therefore thus hence however although though yet instead rather whether until since`.split(/\s+/));

export const norm = (s) => String(s ?? "").normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
export const words = (s) => norm(s).split(/\s+/).filter(Boolean);
export const wordCount = (s) => words(s).length;

/** Crude stemmer: enough to match launch/launched/launches and nation/nations. */
export function stem(w) {
  let x = String(w).toLowerCase().replace(/[^a-z0-9%$]/g, "");
  if (x.length > 5) x = x.replace(/(ing|edly|ed|es|ly)$/, "");
  if (x.length > 3) x = x.replace(/s$/, "");
  return x;
}
export const content = (s) => words(s).map(stem).filter((w) => w && !STOP.has(w) && !STOP.has(w + "s"));
export const contentSet = (s) => new Set(content(s));
export function overlap(a, b) {
  const A = contentSet(a), B = contentSet(b);
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return { shared: n, a: A.size, b: B.size, jaccard: A.size + B.size - n ? n / (A.size + B.size - n) : 0 };
}

export function sentences(text) {
  return norm(text).split(/(?<=[.!?])(?<!\b[A-Z]\.)(?<!\bU\.S\.)(?<!\bU\.K\.)(?<!\bDr\.)(?<!\bMr\.)(?<!\bMrs\.)(?<!\bMs\.)(?<!\bSt\.)(?<!\bSub\.)(?<!\bNo\.)(?<!\bInc\.)(?<!\bCorp\.)(?<!\bCo\.)(?<!\bLtd\.)(?<!\bvs\.)(?<!\bSen\.)(?<!\bRep\.)(?<!\bGov\.)\s+(?=[A-Z"'0-9])/).map((s) => s.trim()).filter(Boolean);
}

/** Folds the spellings of the same place so "U.S." in a claim matches "United States" in narration. */
export const fold = (s) => norm(s).toLowerCase().replace(/\bu\.s\.a?\.?|\busa\b/g, "united states").replace(/\bu\.k\.?|\buk\b/g, "united kingdom").replace(/\bbritain\b/g, "united kingdom").replace(/\bthe united/g, "united");

export const GEOGRAPHY = new Set(`united states,united kingdom,america,china,russia,india,japan,germany,france,italy,spain,canada,mexico,brazil,egypt,israel,iran,iraq,syria,turkey,ukraine,poland,greece,europe,asia,africa,australia,england,scotland,wales,ireland,london,paris,new york,washington,los angeles,moscow,beijing,cairo,istanbul,milan,liverpool,alabama,alaska,arizona,arkansas,california,colorado,connecticut,delaware,florida,georgia,hawaii,idaho,illinois,indiana,iowa,kansas,kentucky,louisiana,maine,maryland,massachusetts,michigan,minnesota,mississippi,missouri,montana,nebraska,nevada,new hampshire,new jersey,new mexico,north carolina,north dakota,ohio,oklahoma,oregon,pennsylvania,rhode island,south carolina,south dakota,tennessee,texas,utah,vermont,virginia,washington,west virginia,wisconsin,wyoming,district of columbia,mars,earth,moon,jupiter,saturn,venus,mercury,neptune,uranus,sun`.split(","));

const NUMWORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
/** Numbers as written: "19 percent", "$399", "5.5 million", "1,000". Returns normalised numeric strings. */
export function numbers(text) {
  const out = [];
  for (const m of norm(text).matchAll(/\$?\d[\d,]*(?:\.\d+)?/g)) out.push(m[0].replace(/[$,]/g, "").replace(/\.$/, ""));
  return out;
}
export function numberWords(text) {
  const out = numbers(text);
  for (const m of norm(text).toLowerCase().matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g)) out.push(String(NUMWORDS[m[1]]));
  return out;
}

/** Number plus the unit that follows (or the currency symbol that precedes). */
export function quantities(text) {
  const out = [];
  const t = norm(text);
  for (const m of t.matchAll(/(\$|€|£)?(\d[\d,]*(?:\.\d+)?)\s*(%|percent|per cent|million|billion|thousand|hours?|minutes?|seconds?|days?|weeks?|months?|years?|km|miles?|metres?|meters?|kg|degrees?|goals?|shots?|passes?|usd|dollars?)?/gi)) {
    let unit = (m[3] || "").toLowerCase();
    if (unit === "percent" || unit === "per cent") unit = "%";
    if (unit === "dollar" || unit === "dollars") unit = "usd";
    if (m[1] === "$" && !unit) unit = "usd";
    else if (m[1] === "$" && unit && unit !== "usd") unit = `usd ${unit}`;
    out.push({ value: m[2].replace(/,/g, "").replace(/\.$/, ""), unit: unit.replace(/s$/, ""), text: m[0].trim() });
  }
  return out;
}

export const capitalised = (text) => {
  const out = new Set();
  const t = norm(text);
  for (const m of t.matchAll(/(?<=[a-z0-9,;:]\s)([A-Z][\w'&.-]*(?:\s+(?:of\s+|the\s+|de\s+)?[A-Z][\w'&.-]*){0,4})/g)) out.add(m[1].trim());
  for (const m of t.matchAll(/\b[A-Z]{2,}\b/g)) out.add(m[0]);
  // "Muse." at the end of a sentence is "Muse"; "U.K." keeps its dots.
  return [...new Set([...out].map((n) => (/\.$/.test(n) && !/\..*\./.test(n) ? n.slice(0, -1) : n)))];
};

/** Whole-phrase containment on normalised text (quotes, dashes, spacing ignored, case ignored, U.S. = United States). */
export const contains = (haystack, needle) => fold(haystack).includes(fold(needle));

export function parseJson(raw) {
  if (raw && typeof raw === "object" && !(Object.keys(raw).length === 1 && "content" in raw)) return raw;
  const text = typeof raw === "string" ? raw : raw?.content;
  if (typeof text !== "string") return null;
  const stripped = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  try { return JSON.parse(stripped); } catch { /* fall through to a bracket scan */ }
  const m = stripped.match(/[\[{][\s\S]*[\]}]/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
}
