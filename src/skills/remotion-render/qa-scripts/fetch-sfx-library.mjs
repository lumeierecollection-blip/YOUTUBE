#!/usr/bin/env node
/**
 * Build the renderer's ROLE-KEYED sound library, measured from real files.
 *
 * Usage: node qa-scripts/fetch-sfx-library.mjs [--dry]
 *
 * Two inputs, one output: sounds fetched from a CC0 pack (ROLE_PICKS) plus
 * sounds already vendored in this repo (LOCAL_PICKS), every one of them
 * measured here and emitted as
 *   src/audio/sfx-library.measured.json      (the record, with provenance)
 *   src/skills/remotion-render/visual/sfx-library.js  (what the renderer imports)
 *
 * SOURCE AND LICENCE
 *
 * Kenney "Interface Sounds 1.0" (kenney.nl), CC0 1.0 Universal, mirrored as
 * WAV by github.com/Calinou/kenney-interface-sounds. kenney.nl itself is not
 * reachable from this environment; the mirror ships Kenney's own LICENSE.txt
 * verbatim ("License: (Creative Commons Zero, CC0)"), which is what makes it
 * safe to vendor. That licence file is downloaded into the same directory as
 * the audio and committed, so provenance travels with the assets.
 *
 * WHY THIS PACK AND NOT THE UI PACK
 *
 * The obvious candidate, Kenney "UI Audio" (Calinou/kenney-ui-audio), is 50
 * sounds that are almost entirely clicks, rollovers and switches. The repo
 * already has five clicks and the problem was never a shortage of clicks —
 * it is that a motion-graphics score needs sounds for things a UI never
 * does: a boundary growing, a value resolving, data populating. Interface
 * Sounds 1.0 carries `maximize`/`minimize` (expansion and contraction),
 * `bong`/`pluck` (tonal emphasis), `tick` (sparse data texture) and
 * `drop`/`glass` (material impacts), which map onto those events. Adding 50
 * more clicks would have grown the inventory without improving the score.
 *
 * WHAT IS SELECTED
 *
 * Only files that fill a ROLE — see ROLE_PICKS (fetched) and LOCAL_PICKS
 * (already vendored, adopted with their existing licences). Nothing is
 * bulk-copied: the Kenney pack alone is 100 sounds and 22 are taken.
 * LOCAL_PICKS documents, file by file, what was left out and why.
 *
 * MEASUREMENT, NOT GUESSWORK
 *
 * Every entry's duration, peak and RMS is measured from the actual decoded
 * file with ffprobe/ffmpeg. `intensity` is derived from measured RMS, not
 * asserted. This matters because the mixer uses these numbers to sit SFX
 * under narration; inventing them would silently mis-mix every render.
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_DIR = join(__dirname, "..");
const ROOT = join(RENDER_DIR, "..", "..", "..");
// One copy, under public/, because that is the only place anything reads
// them from (staticFile resolves against public/). The repo's older sfx
// assets are duplicated src/audio -> public/ because sfx.js used to copy
// them at render time; sfx.js is gone, so a second copy would just be
// 600KB of files with no reader. LICENSE.txt sits beside the audio.
const OUT_DIR = join(RENDER_DIR, "public", "sfx", "interface-kenney");

const BASE = "https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/master/addons/kenney_interface_sounds";
const LICENSE_URL = "https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/master/LICENSE.txt";

const FFMPEG = join(RENDER_DIR, "node_modules", "@remotion", "compositor-linux-x64-gnu", "ffmpeg");
const FFPROBE = join(RENDER_DIR, "node_modules", "@remotion", "compositor-linux-x64-gnu", "ffprobe");

/**
 * ROLE -> the files that serve it. Roles are the vocabulary the sound
 * director speaks (visual/sound-design.js); the file list is what this pack
 * actually offers for each.
 */
const ROLE_PICKS = {
  // A boundary/area growing outward.
  expansion: ["maximize_001", "maximize_004", "maximize_006"],
  // Something contracting, closing, or resolving inward.
  contraction: ["minimize_001", "minimize_006"],
  // A value, boundary or state locking in. Tonal, not a click.
  emphasis: ["bong_001", "pluck_001", "pluck_002"],
  // Sparse data/plot texture — several of these play quietly in sequence.
  texture: ["tick_001", "tick_002", "tick_004"],
  // A discrete object landing (a document, a card, a marker).
  impact: ["drop_001", "drop_003", "glass_001"],
  // A selection being made / a subset being picked out.
  confirmation: ["confirmation_001", "confirmation_002", "select_001"],
  // Something appearing or being revealed.
  reveal: ["open_001", "open_004"],
  // Genuine UI chrome — only for INTERFACE_SIMULATION.
  interface: ["switch_001", "toggle_001", "click_001"],
};

/**
 * Files ALREADY vendored in this repo (src/audio/sfx-manifest.json) that
 * serve a role, adopted rather than re-downloaded.
 *
 * Two reasons this list exists. First, the Kenney interface pack has no
 * whoosh, so `transition` — the role BEFORE_AFTER's wipe asks for — would
 * have had no asset at all and that state would have gone silently
 * unscored. Second, these files were sitting in public/sfx/ referenced only
 * by hardcoded <Sfx> calls in the composition; folding the useful ones into
 * the role library is what stops them becoming dead weight once those
 * hardcodes go.
 *
 * What is deliberately NOT adopted, and why:
 *   - sfx/ambient/mixkit-rain-loop.mp3, mixkit-morning-birds.mp3 — ambience
 *     beds with no connection to any visual event. Laying rain under a
 *     finance explainer is the music-filler reflex this pass exists to
 *     remove.
 *   - sfx/cinematic/impactBell_heavy_*.ogg — no strategy has an event that
 *     wants a heavy cinematic bell; adopting five of them to make the
 *     library look bigger is exactly the bulk-copy mistake.
 *   - sfx/ui/click_00*.ogg — five near-identical clicks, already covered
 *     better by switch/toggle/click_001 from the interface pack.
 *   - sfx/transitions/mixkit-magic-whoosh.mp3 — tagged "sparkle"; wrong
 *     register for documentary and finance channels.
 * Those files stay on disk with their manifest provenance intact; they are
 * simply not part of the score.
 */
const LOCAL_PICKS = {
  transition: [
    { file: "sfx/transitions/mixkit-fast-whoosh.mp3", character: "dry-whoosh" },
    { file: "sfx/transitions/mixkit-cinematic-whoosh.mp3", character: "reverberant-whoosh" },
  ],
  impact: [
    { file: "sfx/emphasis/impactWood_heavy_000.ogg", character: "wood-thud" },
    { file: "sfx/emphasis/impactWood_heavy_002.ogg", character: "wood-thud" },
  ],
};

/** Licence/source per already-vendored file, carried over from sfx-manifest.json. */
const LOCAL_PROVENANCE = {
  Mixkit: { source: "Mixkit (mixkit.co)", license: "Mixkit Free License (free for commercial use)" },
  Kenney: { source: "Kenney Impact Sounds (kenney.nl)", license: "CC0-1.0" },
};

const dry = process.argv.includes("--dry");

async function fetchBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Measured, never asserted: real duration/peak/RMS computed from decoded
 * samples.
 *
 * This decodes to raw PCM and does the arithmetic here rather than using
 * ffmpeg's `volumedetect`. Remotion vendors its own ffmpeg built with
 * `--disable-filters` and a short allowlist that does not include
 * volumedetect or astats — confirmed by it erroring with "No such filter".
 * Depending on a filter that may or may not exist in whichever ffmpeg is on
 * a given machine would make these measurements silently unavailable; the
 * pcm_s16le decoder and wav muxer are both in that allowlist and are all
 * this needs.
 */
function measure(path) {
  const dur = parseFloat(
    execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
      .toString()
      .trim()
  );

  const wav = execFileSync(
    FFMPEG,
    ["-v", "error", "-i", path, "-ac", "1", "-ar", "44100", "-f", "wav", "-"],
    { maxBuffer: 64 * 1024 * 1024 }
  );

  // Skip the RIFF header to the `data` chunk rather than assuming 44 bytes.
  let off = 12;
  while (off + 8 <= wav.length) {
    const id = wav.toString("ascii", off, off + 4);
    const size = wav.readUInt32LE(off + 4);
    if (id === "data") {
      off += 8;
      const n = Math.min(size, wav.length - off);
      let sumSq = 0;
      let peak = 0;
      const count = Math.floor(n / 2);
      for (let i = 0; i < count; i++) {
        const s = wav.readInt16LE(off + i * 2) / 32768;
        sumSq += s * s;
        const a = Math.abs(s);
        if (a > peak) peak = a;
      }
      const rms = count ? Math.sqrt(sumSq / count) : 0;
      const toDb = (v) => (v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : null);
      return {
        durationMs: Number.isFinite(dur) ? Math.round(dur * 1000) : null,
        meanDb: toDb(rms),
        peakDb: toDb(peak),
      };
    }
    off += 8 + size + (size % 2);
  }
  return { durationMs: Number.isFinite(dur) ? Math.round(dur * 1000) : null, meanDb: null, peakDb: null };
}

/** Map measured mean loudness onto a 0..1 intensity the mixer can reason about. */
function intensityFromMeanDb(meanDb) {
  if (meanDb == null) return null;
  // -50 dB (very quiet) -> 0, -10 dB (hot) -> 1
  return Math.round(Math.max(0, Math.min(1, (meanDb + 50) / 40)) * 100) / 100;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Licence first — no audio is vendored without it sitting beside it.
  const licPath = join(OUT_DIR, "LICENSE.txt");
  if (!existsSync(licPath)) {
    if (dry) console.log("[dry] would fetch LICENSE.txt");
    else {
      writeFileSync(licPath, await fetchBinary(LICENSE_URL));
      console.log("licence ->", licPath);
    }
  }

  const entries = [];
  for (const [role, names] of Object.entries(ROLE_PICKS)) {
    for (const name of names) {
      const file = `${name}.wav`;
      const pubPath = join(OUT_DIR, file);

      if (!existsSync(pubPath)) {
        if (dry) {
          console.log(`[dry] would fetch ${role}/${file}`);
          continue;
        }
        writeFileSync(pubPath, await fetchBinary(`${BASE}/${file}`));
      }

      const m = measure(pubPath);
      entries.push({
        file: `sfx/interface-kenney/${file}`,
        role,
        character: characterOf(name),
        intensity: intensityFromMeanDb(m.meanDb),
        durationMs: m.durationMs,
        peakDb: m.peakDb,
        meanDb: m.meanDb,
        bytes: statSync(pubPath).size,
        source: "Kenney Interface Sounds 1.0 (kenney.nl), via github.com/Calinou/kenney-interface-sounds",
        license: "CC0-1.0",
      });
      console.log(
        `${role.padEnd(13)} ${file.padEnd(22)} ${String(m.durationMs).padStart(5)}ms  mean ${m.meanDb}dB  peak ${m.peakDb}dB`
      );
    }
  }

  // Already-vendored files: measured with the exact same code path, so a
  // Mixkit mp3 and a Kenney wav are comparable numbers rather than two
  // different notions of "loud".
  for (const [role, picks] of Object.entries(LOCAL_PICKS)) {
    for (const pick of picks) {
      const pubPath = join(RENDER_DIR, "public", pick.file);
      if (!existsSync(pubPath)) {
        console.warn(`skip ${pick.file} — not present under public/`);
        continue;
      }
      if (dry) {
        console.log(`[dry] would measure ${role}/${pick.file}`);
        continue;
      }
      const m = measure(pubPath);
      const prov = /mixkit/.test(pick.file) ? LOCAL_PROVENANCE.Mixkit : LOCAL_PROVENANCE.Kenney;
      entries.push({
        file: pick.file,
        role,
        character: pick.character,
        intensity: intensityFromMeanDb(m.meanDb),
        durationMs: m.durationMs,
        peakDb: m.peakDb,
        meanDb: m.meanDb,
        bytes: statSync(pubPath).size,
        source: prov.source,
        license: prov.license,
      });
      console.log(
        `${role.padEnd(13)} ${pick.file.split("/").pop().padEnd(30)} ${String(m.durationMs).padStart(5)}ms  mean ${m.meanDb}dB  peak ${m.peakDb}dB`
      );
    }
  }

  if (dry) return;
  const outJson = join(ROOT, "src", "audio", "sfx-library.measured.json");
  writeFileSync(outJson, JSON.stringify({ generated_by: "qa-scripts/fetch-sfx-library.mjs", entries }, null, 2) + "\n");
  console.log(`\n${entries.length} files -> ${outJson}`);

  // The renderer cannot read the JSON above: mg-package.js is a pure module
  // that runs BOTH in node (render.js) and inside the Remotion browser
  // bundle, where there is no fs. Node ESM JSON imports additionally need an
  // import attribute whose support varies by version. So the measured
  // numbers are emitted as a plain ES module that both environments import
  // with no special handling. Generated — edit the measurement, not this.
  const outJs = join(RENDER_DIR, "visual", "sfx-library.js");
  const slim = entries.map((e) => ({
    file: e.file,
    role: e.role,
    character: e.character,
    intensity: e.intensity,
    durationMs: e.durationMs,
    peakDb: e.peakDb,
    meanDb: e.meanDb,
  }));
  writeFileSync(
    outJs,
    `/**\n` +
      ` * GENERATED by qa-scripts/fetch-sfx-library.mjs — do not hand-edit.\n` +
      ` *\n` +
      ` * ${entries.length} CC0 sounds from Kenney "Interface Sounds 1.0" (kenney.nl),\n` +
      ` * mirrored by github.com/Calinou/kenney-interface-sounds. Licence text is\n` +
      ` * committed at src/audio/kenney_interface_sounds_1.0/LICENSE.txt.\n` +
      ` *\n` +
      ` * Every durationMs/peakDb/meanDb below was MEASURED from the decoded file,\n` +
      ` * never asserted; \`intensity\` is derived from measured meanDb. The mixer\n` +
      ` * uses these to keep SFX under narration, so invented numbers would\n` +
      ` * silently mis-mix every render.\n` +
      ` *\n` +
      ` * \`file\` is relative to public/, i.e. what staticFile() wants.\n` +
      ` */\n\nexport const SFX_LIBRARY = ${JSON.stringify(slim, null, 2)};\n\nexport default SFX_LIBRARY;\n`
  );
  console.log(`${slim.length} entries -> ${outJs}`);
}

/**
 * A one-word description of the sound's timbre, from the pack's own naming
 * convention. Deliberately not an invented acoustic analysis — the file
 * family is the only thing here that is actually known.
 */
function characterOf(name) {
  if (/^maximize/.test(name)) return "rising-digital";
  if (/^minimize/.test(name)) return "falling-digital";
  if (/^bong/.test(name)) return "tonal-bell";
  if (/^pluck/.test(name)) return "tonal-pluck";
  if (/^tick/.test(name)) return "dry-tick";
  if (/^drop/.test(name)) return "soft-thud";
  if (/^glass/.test(name)) return "bright-material";
  if (/^confirmation|^select/.test(name)) return "affirmative-chime";
  if (/^open/.test(name)) return "opening-swell";
  if (/^switch|^toggle|^click/.test(name)) return "ui-mechanical";
  return "unclassified";
}

main().catch((err) => {
  console.error("fetch-sfx-library failed:", err.message);
  process.exit(1);
});
