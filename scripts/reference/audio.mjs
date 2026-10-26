/**
 * audio — facts about a reference's soundtrack, ffmpeg only: integrated loudness (ebur128), silence segments,
 * candidate sound cues (RMS jumps in 0.1 s windows). Transcript only if faster_whisper is importable.
 * Candidate cues are MEASURED level jumps, not classified sounds: nothing here says what the sound is.
 */
import { spawnSync } from "node:child_process";

const num = (s) => { const v = parseFloat(s); return Number.isFinite(v) ? v : null; };

export function parseEbur128(stderr) {
  const tail = String(stderr).split(/Summary:/).pop();
  const g = (re) => { const m = re.exec(tail); return m ? num(m[1]) : null; };
  return { integrated_lufs: g(/\bI:\s+(-?[\d.]+|-inf)\s+LUFS/), loudness_range_lu: g(/\bLRA:\s+(-?[\d.]+)\s+LU/), true_peak_dbfs: g(/Peak:\s+(-?[\d.]+|-inf)\s+dBFS/) };
}

export function parseSilence(stderr, duration) {
  const out = [];
  let start = null;
  for (const line of String(stderr).split(/\r?\n/)) {
    let m = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (m) { start = Math.max(0, +m[1]); continue; }
    m = /silence_end:\s*([\d.]+)/.exec(line);
    if (m && start != null) { out.push({ start: +start.toFixed(2), end: +(+m[1]).toFixed(2) }); start = null; }
  }
  if (start != null && duration) out.push({ start: +start.toFixed(2), end: +duration.toFixed(2) });
  return out;
}

/** Parse ametadata=print output into [{t, rms_db}] */
export function parseRms(text) {
  const out = [];
  let t = null;
  for (const line of String(text).split(/\r?\n/)) {
    let m = /pts_time:\s*([\d.]+)/.exec(line);
    if (m) { t = +m[1]; continue; }
    m = /RMS_level=(-?[\d.]+|-inf)/.exec(line);
    if (m && t != null) { out.push({ t, rms_db: m[1] === "-inf" ? -120 : +m[1] }); t = null; }
  }
  return out;
}

/** Pure. A cue is a window >= jumpDb above the mean of the 3 windows before it, and louder than floorDb; cues <minGap s apart are one. */
export function findOnsets(series, { jumpDb = 9, floorDb = -40, minGap = 0.3 } = {}) {
  const cues = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series.slice(Math.max(0, i - 3), i).map((s) => s.rms_db);
    const base = prev.reduce((a, b) => a + b, 0) / prev.length;
    const s = series[i];
    if (base < -100) continue; // digital silence before: the "jump" is the file starting, not a cue
    if (s.rms_db >= floorDb && s.rms_db - base >= jumpDb && (!cues.length || s.t - cues[cues.length - 1].t >= minGap)) {
      cues.push({ t: +s.t.toFixed(2), rms_db: +s.rms_db.toFixed(1), jump_db: +(s.rms_db - base).toFixed(1) });
    }
  }
  return cues;
}

const ff = (args) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8", maxBuffer: 1 << 28 });

function transcribe(path) {
  const probe = spawnSync("python", ["-I", "-c", "import faster_whisper"], { encoding: "utf8" });
  if (probe.status !== 0) return { transcript: null, why: "faster_whisper is not importable in this python" };
  const code = "import sys,json\nfrom faster_whisper import WhisperModel\nm=WhisperModel('base',compute_type='int8')\nseg,_=m.transcribe(sys.argv[1],word_timestamps=True)\nprint(json.dumps([{'start':w.start,'end':w.end,'word':w.word} for s in seg for w in (s.words or [])]))";
  const r = spawnSync("python", ["-I", "-c", code, path], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) return { transcript: null, why: `faster_whisper failed: ${String(r.stderr).slice(-200)}` };
  try { return { transcript: JSON.parse(r.stdout.trim().split(/\r?\n/).pop()), why: null }; } catch { return { transcript: null, why: "faster_whisper output unparseable" }; }
}

export function analyzeAudio(path, meta, { transcript = true } = {}) {
  if (!meta.has_audio) return { has_audio: false, loudness: null, silences: [], candidate_cues: [], transcript: null, why: "no audio stream" };
  const loud = parseEbur128(ff(["-i", path, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr);
  const sil = parseSilence(ff(["-i", path, "-vn", "-af", "silencedetect=n=-40dB:d=0.3", "-f", "null", "-"]).stderr, meta.duration_s);
  const n = Math.round((meta.audio_sample_rate || 44100) * 0.1);
  const rms = ff(["-i", path, "-vn", "-af", `asetnsamples=n=${n}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-`, "-f", "null", "-"]);
  const series = parseRms(rms.stdout);
  const tr = transcript ? transcribe(path) : { transcript: null, why: "transcript disabled" };
  return {
    has_audio: true, loudness: loud, silences: sil,
    candidate_cues: findOnsets(series),
    cue_method: "RMS per 0.1 s window; a cue is a window >= 9 dB above the previous 3 and above -40 dB. Level jumps only, sound type unknown.",
    transcript: tr.transcript, why: tr.why,
  };
}
