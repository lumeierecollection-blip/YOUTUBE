/**
 * Cards the automatic editor draws when a sentence has no verified photo: a figure card (the number the
 * sentence states, drawn big; a percentage also as a bar of that exact proportion) or a statement card (the
 * sentence itself, typeset, with its source). Nothing here states anything the sentence does not: the words
 * on a card are the script's own words, the numbers are the ones found in that sentence.
 */

export const xmlEscape = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap on a character budget. A word longer than the budget gets its own line. */
export function wrapText(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const FONT = "Arial, sans-serif";

function frame({ palette, label, body, source }) {
  const { bg, accent, secondary } = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${xmlEscape(secondary)}"/><stop offset="1" stop-color="${xmlEscape(bg)}"/></linearGradient>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="${xmlEscape(accent)}" stroke-opacity="0.07" stroke-width="1"/></pattern>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/><rect width="1080" height="1920" fill="url(#grid)"/>
  <text x="90" y="190" fill="${xmlEscape(accent)}" font-family="${FONT}" font-size="26" font-weight="700" letter-spacing="7">${xmlEscape(String(label || "").toUpperCase().slice(0, 48))}</text>
  <line x1="90" y1="230" x2="990" y2="230" stroke="${xmlEscape(accent)}" stroke-opacity="0.6" stroke-width="2"/>
${body}
${source ? `  <text x="90" y="1440" fill="#9AA3B2" font-family="${FONT}" font-size="24">${xmlEscape(`Source: ${source}`.slice(0, 90))}</text>\n` : ""}</svg>
`;
}

function sentenceLines(sentence, { x = 90, y, size = 46, maxChars = 34, max = 7, fill = "#E8EAF0" }) {
  const lines = wrapText(sentence, maxChars).slice(0, max);
  return lines.map((l, i) => `  <text x="${x}" y="${y + i * (size + 14)}" fill="${fill}" font-family="${FONT}" font-size="${size}" font-weight="600">${xmlEscape(l)}</text>`).join("\n");
}

/**
 * figures: [{ raw: "45%", kind: "percent"|"number", value: 45 }] (1-2 used). A percentage is also drawn as a bar whose
 * length is exactly that share of the track.
 */
export function figureCard({ palette, label, sentence, figures, source }) {
  const fig = figures.slice(0, 2);
  const parts = [];
  let y = 400;
  for (const f of fig) {
    const size = fig.length === 1 ? 260 : 170;
    parts.push(`  <text x="90" y="${y + size * 0.78}" fill="#FFFFFF" font-family="${FONT}" font-size="${size}" font-weight="700">${xmlEscape(f.raw)}</text>`);
    y += size * 0.78 + 30;
    if (f.kind === "percent" && f.value >= 0 && f.value <= 100) {
      parts.push(`  <rect x="90" y="${y}" width="900" height="56" fill="${xmlEscape(palette.secondary)}" stroke="${xmlEscape(palette.accent)}" stroke-opacity="0.5" stroke-width="2"/>`);
      parts.push(`  <rect x="90" y="${y}" width="${(9 * f.value).toFixed(1)}" height="56" fill="${xmlEscape(palette.accent)}"/>`);
      y += 56 + 40;
    } else {
      y += 20;
    }
  }
  parts.push(sentenceLines(sentence, { y: y + 40, size: fig.length === 1 ? 44 : 38, max: fig.length === 1 ? 6 : 4 }));
  return frame({ palette, label, body: parts.join("\n"), source });
}

export function statementCard({ palette, label, sentence, source }) {
  return frame({ palette, label, body: sentenceLines(sentence, { y: 560, size: 62, maxChars: 24, max: 8, fill: "#FFFFFF" }), source });
}
