/** The parts of a stated date, for the ENTITY-ART calendar page (full-canvas.jsx). Pure, so it is unit-tested. */
const MONTHS3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** "August 24, 2026" -> { month: "AUG", day: "24", year: "2026" } (each part present only if the date states it). */
export function dateParts(text) {
  const t = String(text || "");
  const mo = MONTHS3.findIndex((m) => new RegExp(`\\b${m}[A-Z]*\\b`, "i").test(t));
  const year = (t.match(/\b(?:1[89]|20)\d{2}\b/) || [])[0] || null;
  const day = (t.replace(year || "", " ").match(/\b([12]?\d|3[01])(?:st|nd|rd|th)?\b/) || [])[1] || null;
  return { month: mo >= 0 ? MONTHS3[mo] : null, day: mo >= 0 ? day : null, year };
}
