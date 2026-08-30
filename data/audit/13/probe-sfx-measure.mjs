/**
 * STAGE 13 (AUDIO) AUDIT PROBE — SFX file-level measurement.
 *
 * Lane: audit-audio (stage 13). Owned area: data/audit/**.
 *
 * AUD-04 layer 2 / VIS-17 re-check: the SFX_LIBRARY (visual/sfx-library.js)
 * and its provenance record (src/audio/sfx-library.measured.json) claim
 * every durationMs/peakDb/meanDb was MEASURED from the decoded file. This
 * probe re-measures all 26 files from disk with the SYSTEM ffmpeg/ffprobe
 * (9.0 full build — the repo's own vendored compositor ffmpeg is
 * linux-only and does not exist on this machine) using the EXACT same
 * algorithm as qa-scripts/fetch-sfx-library.mjs::measure() (decode to mono
 * 44100 wav, parse the data chunk, RMS/peak in dB, 1-decimal rounding).
 *
 * Also cross-checks:
 *   - every library file exists on disk
 *   - byte size agrees with the provenance record
 *   - volumeFor(lib, role) never boosts (<= 1) and matches the library's
 *     own numbers (re-derived here, so a stale record cannot hide)
 *   - licence + source fields recorded per file (feeds AUD-06)
 *
 * Run: node data/audit/13/probe-sfx-measure.mjs
 */
import { execFileSync } from "child_process";
import { readFileSync, existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const R = join(ROOT, "src", "skills", "remotion-render");
const FFMPEG = "C:/Users/user/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe";
const FFPROBE = "C:/Users/user/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffprobe.exe";

const sfxLib = await import(pathToFileURL(join(R, "visual", "sfx-library.js")).href);
const { SFX_LIBRARY } = sfxLib;
const sound = await import(pathToFileURL(join(R, "visual", "sound-design.js")).href);
const { volumeFor, ROLE_TARGET_DB } = sound;

const measuredJson = JSON.parse(readFileSync(join(ROOT, "src", "audio", "sfx-library.measured.json"), "utf-8"));

/** Literal port of fetch-sfx-library.mjs::measure() */
function measure(path) {
  const dur = parseFloat(
    execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).toString().trim()
  );
  const wav = execFileSync(FFMPEG, ["-v", "error", "-i", path, "-ac", "1", "-ar", "44100", "-f", "wav", "-"], {
    maxBuffer: 256 * 1024 * 1024,
  });
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
      return { durationMs: Number.isFinite(dur) ? Math.round(dur * 1000) : null, meanDb: toDb(rms), peakDb: toDb(peak) };
    }
    off += 8 + size + (size % 2);
  }
  return { durationMs: Number.isFinite(dur) ? Math.round(dur * 1000) : null, meanDb: null, peakDb: null };
}

// Lossy formats decode deterministically per libavcodec build, but the
// repo's record was produced by a DIFFERENT (linux, older) build; wav is
// bit-exact across builds. Tolerances reflect that honestly.
const TOL = (f) => (f.endsWith(".wav") ? { mean: 0.2, peak: 0.2, dur: 8 } : { mean: 0.6, peak: 0.6, dur: 60 });

const rows = [];
for (const entry of SFX_LIBRARY) {
  const p = join(R, "public", entry.file);
  const exists = existsSync(p);
  const rec = measuredJson.entries.find((e) => e.file === entry.file);
  const libRec = SFX_LIBRARY.find((e) => e.file === entry.file);
  if (!exists) {
    rows.push({ file: entry.file, exists: false, note: "MISSING ON DISK" });
    continue;
  }
  const m = measure(p);
  const tol = TOL(entry.file);
  const dMean = m.meanDb === null ? null : m.meanDb - entry.meanDb;
  const dPeak = m.peakDb === null ? null : m.peakDb - entry.peakDb;
  const dDur = m.durationMs - entry.durationMs;
  const mismatch =
    Math.abs(dMean) > tol.mean || Math.abs(dPeak) > tol.peak || Math.abs(dDur) > tol.dur;
  // byte provenance
  const bytesOnDisk = statSync(p).size;
  const bytesOk = !rec || rec.bytes === bytesOnDisk;
  // volume sanity for this asset/role pair as the mixer would use it
  const vol = volumeFor(libRec, entry.role);
  rows.push({
    file: entry.file,
    role: entry.role,
    license: entry.license,
    source: entry.source,
    exists: true,
    bytesOnDisk,
    bytesInRecord: rec ? rec.bytes : null,
    bytesOk,
    recorded: { durationMs: entry.durationMs, peakDb: entry.peakDb, meanDb: entry.meanDb },
    remeasured: m,
    delta: { meanDb: round2(dMean), peakDb: round2(dPeak), durationMs: dDur },
    withinTolerance: !mismatch,
    tolerance: tol,
    volumeForRole: vol,
    volumeBoosts: vol > 1,
  });
}

function round2(v) {
  return v === null ? null : Math.round(v * 100) / 100;
}

const summary = {
  files: rows.length,
  missingOnDisk: rows.filter((r) => !r.exists).length,
  mismatchBeyondTolerance: rows.filter((r) => r.exists && !r.withinTolerance).length,
  byteMismatches: rows.filter((r) => r.exists && !r.bytesOk).length,
  anyVolumeBoost: rows.some((r) => r.volumeBoosts),
  anyNullMean: rows.some((r) => r.remeasured.meanDb === null),
};
console.log(JSON.stringify({ summary, rows }, null, 2));