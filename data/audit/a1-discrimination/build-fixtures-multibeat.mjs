/**
 * A1 multi-beat fixtures — the n=1 set could not support a final reading.
 *
 * At one beat, headline_test.percent can only be 0 or 100, so any monoculture verdict is
 * an artifact of sample size rather than a judgement. Several other checks degenerate too.
 * Each clip below is a 4-beat video so those tests have something to measure.
 *
 * Two clips, matched beat-for-beat, differing ONLY in whether the beats carry composed
 * content or are caption-only:
 *
 *   clip-fallback  4 beats, every beat = white ground + caption band + page counter.
 *                  This is the real fallback signature: not one empty frame but a whole
 *                  video of them, which is what the cross-beat axes in A2 must catch.
 *   clip-designed  the same 4 sentences, same ground, same caption layer, but each beat
 *                  also carries the element its sentence describes (numeral, headline,
 *                  bars, a photo region).
 *
 * Ground is held CONSTANT across both clips. That is the whole point: it removes the
 * :330 ground clause as a confound so A1b can ask whether the verifier has composition
 * signal underneath it. A separate dark-ground clip exists in the n=1 set for the
 * ground-attribution reading.
 *
 * Beats are ordered so composition types differ between consecutive beats — a variety
 * measure that scores a uniform run low must be able to see the difference.
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const W = 1080, H = 1920;
// ch-1, config/channels.json
const C = { primary: "#0F172A", secondary: "#1E293B", accent: "#22C55E", canvas_accent: "#1B7A4D", muted: "#94A3B8", mutedLight: "#475569", rule: "#E2E8F0" };
const GROUND = "#FFFFFF";

const BEATS = [
  { i: 0, vo: "Over forty percent of borrowers clear high-interest debt first.", comp: "NUMBER-FULL", head: "40%", label: "PAY DOWN DEBT FIRST", sub: "borrower survey, Q3 2026" },
  { i: 1, vo: "A single dollar often costs more than the face value suggests.", comp: "NUMBER-FULL", head: "1.6x", label: "THE REAL COST OF A DOLLAR", sub: "interest accrued per year" },
  { i: 2, vo: "Balanced portfolios hold cash, bonds and equity in fixed shares.", comp: "BAR", head: "50/30/20", label: "THE ALLOCATION RULE", sub: "cash, bonds, equity" },
  { i: 3, vo: "Builders who plan ahead keep a reserve of three months of costs.", comp: "TYPE-FULL", head: "Three months", label: "THE BUFFER", sub: "held in cash, untouched" },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The automatic layer: identical on every beat of both clips.
const auto = (page, total) => `
  <text x="990" y="96" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${C.mutedLight}" text-anchor="end">0${page} / 0${total}</text>
  <line x1="90" y1="1548" x2="990" y2="1548" stroke="${C.mutedLight}" stroke-opacity="0.30" stroke-width="2"/>
  <text x="540" y="1624" font-family="Inter, Helvetica, Arial, sans-serif" font-size="42" fill="${C.primary}" text-anchor="middle">${esc(page.vo.split(" ").slice(0, 8).join(" "))}</text>
  <text x="540" y="1690" font-family="Inter, Helvetica, Arial, sans-serif" font-size="42" fill="${C.primary}" text-anchor="middle">${esc(page.vo.split(" ").slice(8).join(" "))}</text>`;

// wrap on word boundaries only; a mid-word break reads as a rendering defect and would
// pollute the very signal being measured.
function wrap(text, wordsPerLine) {
  const w = text.split(" ");
  return [w.slice(0, wordsPerLine).join(" "), w.slice(wordsPerLine).join(" ")];
}

const captionOnly = (b, total) => {
  const [l1, l2] = wrap(b.vo, 8);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  <text x="990" y="96" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${C.mutedLight}" text-anchor="end">0${b.i + 1} / 0${total}</text>
  <line x1="90" y1="1548" x2="990" y2="1548" stroke="${C.mutedLight}" stroke-opacity="0.30" stroke-width="2"/>
  <text x="540" y="1624" font-family="Inter, Helvetica, Arial, sans-serif" font-size="42" fill="${C.primary}" text-anchor="middle">${esc(l1)}</text>
  <text x="540" y="1690" font-family="Inter, Helvetica, Arial, sans-serif" font-size="42" fill="${C.primary}" text-anchor="middle">${esc(l2)}</text>
</svg>`;
};

// Composed beats. Everything is kept inside its own band (headline y 210-430, numeral
// y 560-900, label 940, rule 1010, footnote 1060) so no ink crosses a zone edge — the
// n=1 set's zones-no-overlap failure was fixture construction, and A1 must not carry
// known noise into the multi-beat set.
const composedBeat = (b, total) => {
  const [l1, l2] = wrap(b.vo, 8);
  const numeral = b.comp === "NUMBER-FULL";
  const bars = b.comp === "BAR";
  const headline = b.comp === "TYPE-FULL";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  ${headline
    // TYPE-FULL: the big statement IS the headline. The first build also drew it as a
    // small top header, which duplicated it and collided with the footnote — the model
    // caught both ("excessive template repetition", "severe text collision in the final
    // frame") once the ground clause stopped shielding it. Correct evidence that the
    // verifier reads the frame; a defect that had no business being in a fixture.
    ? `<text x="90" y="1180" font-family="Georgia, 'Times New Roman', serif" font-size="96" fill="${C.primary}">${esc(b.head)}</text>
       <rect x="90" y="1230" width="520" height="14" fill="${C.canvas_accent}"/>`
    : `<text x="90" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="72" fill="${C.primary}">${esc(b.head)}</text>
       <rect x="90" y="336" width="360" height="12" fill="${C.canvas_accent}"/>`}
  ${numeral ? `<text x="90" y="820" font-family="Georgia, 'Times New Roman', serif" font-size="300" fill="${C.primary}">${esc(b.head)}</text>` : ""}
  ${bars ? `<g>
    <rect x="120" y="560" width="150" height="300" fill="${C.canvas_accent}"/>
    <rect x="330" y="640" width="150" height="220" fill="${C.secondary}"/>
    <rect x="540" y="700" width="150" height="160" fill="${C.muted}"/>
    <line x1="90" y1="880" x2="990" y2="880" stroke="${C.rule}" stroke-width="3"/>
    <text x="195" y="920" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" fill="${C.mutedLight}" text-anchor="middle">CASH</text>
    <text x="405" y="920" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" fill="${C.mutedLight}" text-anchor="middle">BONDS</text>
    <text x="615" y="920" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" fill="${C.mutedLight}" text-anchor="middle">EQUITY</text>
  </g>` : ""}
  ${headline ? "" : `<text x="90" y="1010" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" fill="${C.mutedLight}" letter-spacing="3">${esc(b.label)}</text>
    <text x="90" y="1075" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${C.mutedLight}" opacity="0.75">${esc(b.sub)}</text>`}
  ${headline ? `<text x="90" y="1010" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" fill="${C.mutedLight}" letter-spacing="3">${esc(b.label)}</text>` : ""}
  <text x="990" y="96" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${C.mutedLight}" text-anchor="end">0${b.i + 1} / 0${total}</text>
  <line x1="90" y1="1548" x2="990" y2="1548" stroke="${C.mutedLight}" stroke-opacity="0.30" stroke-width="2"/>
  <text x="540" y="1624" font-family="Inter, Helvetica, Arial, sans-serif" font-size="42" fill="${C.primary}" text-anchor="middle">${esc(l1)}</text>
  <text x="540" y="1690" font-family="Inter, Helvetica, Arial, sans-serif" font-size="42" fill="${C.primary}" text-anchor="middle">${esc(l2)}</text>
</svg>`;
};

const dir = "data/audit/a1-discrimination/fixtures-multibeat";
const work = "data/audit/a1-discrimination/work-multibeat";
mkdirSync(dir, { recursive: true });
mkdirSync(work, { recursive: true });

const CLIPS = {
  "clip-fallback": { label: "4 beats, every beat caption-only on a uniform white ground", render: captionOnly },
  "clip-designed": { label: "the same 4 sentences and the same ground, each beat composed", render: composedBeat },
};

const manifest = { frozen: new Date().toISOString(), size: `${W}x${H}`, beats: BEATS.length, ground: GROUND, colors: C, channel: "1 (config/channels.json)", clips: {} };

for (const [name, clip] of Object.entries(CLIPS)) {
  const frames = [];
  for (const b of BEATS) {
    const png = await sharp(Buffer.from(clip.render(b, BEATS.length))).png().toBuffer();
    const p = `${dir}/${name}-beat-${b.i}.png`;
    writeFileSync(p, png);
    frames.push({ beat: b.i, png: p, sha256: createHash("sha256").update(png).digest("hex") });
  }
  // 4 beats x 2s, concatenated into one clip with a constant frame rate.
  // Clip length must be EXACTLY BEATS.length * 2s, and it must be exact on every ffmpeg
  // build. The concat DEMUXER's `duration` directive is not: it applies to the preceding
  // file, and whether the final entry's duration is honoured is version-dependent. Local
  // ffmpeg 9.0 produced 8.00s; CI's apt ffmpeg produced 6.03s, so the reviewer sampled 3
  // frames instead of 4 and CI reported a 4-beat result from a 3-beat fixture. Repeating
  // the last file gave 10s locally. `-t` cannot fix it either — it truncates, it does not
  // extend, so it left CI at 6.03s.
  //
  // The concat FILTER is used instead: each still is its own `-loop 1 -t 2` input, so every
  // input's duration is explicit and no demuxer duration semantics are involved. The
  // assertion below is kept regardless — it is what caught the 6.03s clip instead of
  // letting CI report a degraded measurement as a real one.
  const expected = BEATS.length * 2;
  const video = `${work}/${name}.mp4`;
  const args = ["-y"];
  for (const f of frames) args.push("-loop", "1", "-t", "2", "-i", f.png);
  args.push("-filter_complex",
    `${frames.map((_, i) => `[${i}:v]scale=1080:1920,setsar=1,fps=30[v${i}]`).join(";")};` +
    `${frames.map((_, i) => `[v${i}]`).join("")}concat=n=${frames.length}:v=1:a=0[out]`,
    "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", video);
  execFileSync("ffmpeg", args, { stdio: "pipe" });

  const actual = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video], { encoding: "utf-8" }).trim());
  if (Math.abs(actual - expected) > 0.2) {
    throw new Error(`${name}: clip is ${actual.toFixed(2)}s, expected ${expected}s. The reviewer's frame sampling is derived from SRT cues inside the clip, so a short clip measures a DIFFERENT fixture rather than failing.`);
  }
  console.log(`  ${name}: ${actual.toFixed(2)}s (expected ${expected}s)`);

  // SRT: one cue per beat, so computeBeatTimes samples one frame per beat at 65%.
  writeFileSync(`${work}/${name}.srt`, BEATS.map((b, k) =>
    `${k + 1}\n${s2s(k * 2)} --> ${s2s((k + 1) * 2)}\n${b.vo}\n`).join("\n"));

  // canvas beats -> the verifier's full-canvas rubric (gemini-frame-review.js:712).
  writeFileSync(`${work}/${name}-manifest.json`, JSON.stringify({
    video: `${name}.mp4`, fps: 30, width: W, height: H, duration_sec: BEATS.length * 2,
    beats: BEATS.map((b) => ({
      index: b.i, start_sec: b.i * 2, duration_sec: 2,
      visual_type: b.comp === "BAR" ? "BAR" : b.comp === "TYPE-FULL" ? "TYPE" : "COUNTER",
      canvas: { composition: b.comp, dark: false, boxes: {}, name_card: null,
        headline: b.head, label: b.label },
    })),
  }, null, 2) + "\n");
  writeFileSync(`${work}/${name}-script.json`, JSON.stringify({
    channel: "1", title: `A1 multibeat ${name}`, beats: BEATS.map((b) => ({ index: b.i, narration: b.vo })),
  }, null, 2) + "\n");

  manifest.clips[name] = { label: clip.label, video, duration_sec: BEATS.length * 2, frames };
  console.log(`${name}: ${BEATS.length} beats -> ${video}`);
}
writeFileSync(`${dir}/fixtures.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nfrozen -> ${dir}/fixtures.json`);

function s2s(t) {
  const h = String(Math.floor(t / 3600)).padStart(2, "0"), m = String(Math.floor((t % 3600) / 60)).padStart(2, "0"), sec = String(t % 60).padStart(2, "0");
  return `${h}:${m}:${sec},000`;
}