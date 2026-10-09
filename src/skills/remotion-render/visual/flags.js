/**
 * National and US-state flags for the ENTITY-ART "flag" visual (owner, 2026-10-09: "if the sentence names France
 * and Germany, show their flags or their maps").
 *
 * A region key from geo-regions.js ("country:FRA", "us:CA") -> the flag's code on flagcdn.com ("fr", "us-ca").
 * The flag file is fetched once per run by scripts/fetch-flag.mjs into public/flags/<code>.png (a national flag is a
 * public-domain emblem; flagcdn.com serves them; source and licence are recorded in the beat's credit).
 * A region with no code here (Antarctica, N. Cyprus, Somaliland...) simply has no flag option — it keeps its map.
 */
const ISO3_TO_ISO2 = {
  AFG: "af", ALB: "al", DZA: "dz", AGO: "ao", ARG: "ar", ARM: "am", AUS: "au", AUT: "at", AZE: "az", BHS: "bs", BGD: "bd", BLR: "by", BEL: "be", BLZ: "bz", BEN: "bj",
  BTN: "bt", BOL: "bo", BIH: "ba", BWA: "bw", BRA: "br", BRN: "bn", BGR: "bg", BFA: "bf", BDI: "bi", KHM: "kh", CMR: "cm", CAN: "ca", CAF: "cf", TCD: "td", CHL: "cl",
  CHN: "cn", COL: "co", COD: "cd", COG: "cg", CRI: "cr", CIV: "ci", HRV: "hr", CUB: "cu", CYP: "cy", CZE: "cz", DNK: "dk", DJI: "dj", DOM: "do", ECU: "ec", EGY: "eg",
  SLV: "sv", GNQ: "gq", ERI: "er", EST: "ee", ETH: "et", FJI: "fj", FIN: "fi", FRA: "fr", GAB: "ga", GMB: "gm", GEO: "ge", DEU: "de", GHA: "gh", GRC: "gr", GRL: "gl",
  GTM: "gt", GIN: "gn", GNB: "gw", GUY: "gy", HTI: "ht", HND: "hn", HUN: "hu", ISL: "is", IND: "in", IDN: "id", IRN: "ir", IRQ: "iq", IRL: "ie", ISR: "il", ITA: "it",
  JAM: "jm", JPN: "jp", JOR: "jo", KAZ: "kz", KEN: "ke", PRK: "kp", KOR: "kr", KOS: "xk", KWT: "kw", KGZ: "kg", LAO: "la", LVA: "lv", LBN: "lb", LSO: "ls", LBR: "lr",
  LBY: "ly", LTU: "lt", LUX: "lu", MKD: "mk", MDG: "mg", MWI: "mw", MYS: "my", MLI: "ml", MRT: "mr", MEX: "mx", MDA: "md", MNG: "mn", MNE: "me", MAR: "ma", MOZ: "mz",
  MMR: "mm", NAM: "na", NPL: "np", NLD: "nl", NZL: "nz", NIC: "ni", NER: "ne", NGA: "ng", NOR: "no", OMN: "om", PAK: "pk", PSX: "ps", PAN: "pa", PNG: "pg", PRY: "py",
  PER: "pe", PHL: "ph", POL: "pl", PRT: "pt", PRI: "pr", QAT: "qa", ROU: "ro", RUS: "ru", RWA: "rw", SAU: "sa", SEN: "sn", SRB: "rs", SLE: "sl", SVK: "sk", SVN: "si",
  SLB: "sb", SOM: "so", ZAF: "za", SDS: "ss", ESP: "es", LKA: "lk", SDN: "sd", SUR: "sr", SWZ: "sz", SWE: "se", CHE: "ch", SYR: "sy", TWN: "tw", TJK: "tj", TZA: "tz",
  THA: "th", TLS: "tl", TGO: "tg", TTO: "tt", TUN: "tn", TUR: "tr", TKM: "tm", UGA: "ug", UKR: "ua", ARE: "ae", GBR: "gb", USA: "us", URY: "uy", UZB: "uz", VUT: "vu",
  VEN: "ve", VNM: "vn", YEM: "ye", ZMB: "zm", ZWE: "zw", SAH: "eh", NCL: "nc", FLK: "fk",
};

/** "country:FRA" -> "fr"; "us:CA" -> "us-ca"; null when the region has no flag. */
export function flagCodeOf(regionKey) {
  const [kind, id] = String(regionKey || "").split(":");
  if (kind === "country") return ISO3_TO_ISO2[id] || null;
  if (kind === "us" && /^[A-Z]{2}$/.test(id || "")) return `us-${id.toLowerCase()}`;
  return null;
}
/** The file under the Remotion public dir. */
export const flagFile = (code) => `flags/${code}.png`;
export const flagUrl = (code) => `https://flagcdn.com/w1280/${code}.png`;
