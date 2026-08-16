/**
 * License allowlist — PART 5. "filter to PD/CC0/CC-BY only."
 *
 * Deliberately excludes CC-BY-SA (share-alike "infects" the whole video
 * under most reasonable readings) and NC (non-commercial — this pipeline
 * monetizes). Only add a license string here after checking it actually
 * permits commercial reuse with no share-alike obligation.
 */
const ALLOWED = [
  "PD", // public domain (no rights reserved / expired copyright / US govt work)
  "CC0",
  "CC-BY",
  "CC-BY-2.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "PEXELS", // Pexels License — free for commercial use, no attribution required
  "UNSPLASH", // Unsplash License — free for commercial use, no attribution required
];

const NORMALIZE = new Map([
  ["public domain", "PD"],
  ["pd", "PD"],
  ["cc0", "CC0"],
  ["cc0 1.0", "CC0"],
  ["cc-by", "CC-BY"],
  ["cc by", "CC-BY"],
  ["cc by 2.0", "CC-BY-2.0"],
  ["cc by 3.0", "CC-BY-3.0"],
  ["cc by 4.0", "CC-BY-4.0"],
  ["cc-by-2.0", "CC-BY-2.0"],
  ["cc-by-3.0", "CC-BY-3.0"],
  ["cc-by-4.0", "CC-BY-4.0"],
  ["pexels license", "PEXELS"],
  ["unsplash license", "UNSPLASH"],
]);

export function normalizeLicense(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  if (NORMALIZE.has(key)) return NORMALIZE.get(key);
  const upper = String(raw).trim().toUpperCase();
  return ALLOWED.includes(upper) ? upper : null;
}

export function isAllowedLicense(raw) {
  return normalizeLicense(raw) !== null;
}

export function requiresAttribution(normalizedLicense) {
  return normalizedLicense === "CC-BY" || /^CC-BY-/.test(normalizedLicense || "");
}
