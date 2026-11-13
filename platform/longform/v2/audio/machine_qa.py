"""Machine QA of every library asset (NOT a listening review: nothing here can judge tone, taste or whether an effect sounds right).
For each asset in config/longform-audio-library.json it decodes the file (ffmpeg -> mono 22.05 kHz float) and records measurable defects:
  clipped_samples (|x| >= 0.999), true peak (from the library measurement), head/tail silence (< -50 dBFS RMS in 20 ms windows), tail cut (level in the last
  100 ms within 12 dB of the loudest window, i.e. the file ends without a decay/fade), loop seam (level and spectral-centroid jump between the first and
  last 1 s, for ambiences and music), noise floor (10th percentile of 50 ms RMS), DC offset, crest factor.
Writes config/longform-audio-qa.json. Verdicts are FLAGS only: every asset stays 'pending human audition' until a person listens and records the decision."""
import json, os, subprocess, sys
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
lib = json.load(open(os.path.join(ROOT, "config/longform-audio-library.json"), encoding="utf8"))
SR = 22050
def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
def win_db(x, n): m = len(x) // n; return 20 * np.log10(np.sqrt((x[: m * n].reshape(m, n) ** 2).mean(axis=1)) + 1e-9)
def centroid(x):
    s = np.abs(np.fft.rfft(x * np.hanning(len(x)))); f = np.fft.rfftfreq(len(x), 1 / SR); return float((s * f).sum() / (s.sum() + 1e-9))
res = {}
for a in lib["assets"]:
    f = os.path.join(ROOT, a["file"])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    if len(x) < SR * 0.2: res[a["slot"]] = {"error": "decoded <0.2 s"}; continue
    w20, w50 = win_db(x, int(SR * 0.02)), win_db(x, int(SR * 0.05))
    loud = float(w20.max()); sil = w20 < -50
    head = int(np.argmin(sil)) * 0.02 if sil.any() and not sil.all() else 0.0
    tail = int(np.argmin(sil[::-1])) * 0.02 if sil.any() and not sil.all() else 0.0
    last = rms_db(x[-int(SR * 0.1):]); first_s, last_s = x[: min(SR, len(x) // 2)], x[-min(SR, len(x) // 2):]
    seam_db = abs(rms_db(first_s) - rms_db(last_s)); seam_c = abs(centroid(first_s) - centroid(last_s))
    tp = a["measured"]["true_peak_dbtp"]; flags = []
    clipped = int((np.abs(x) >= 0.999).sum())
    if tp is not None and tp >= -0.1: flags.append(f"true peak {tp} dBTP at/above ceiling: attenuate before any mix")
    if clipped > 5: flags.append(f"{clipped} samples at full scale (possible hard clipping in the source: audition for distortion)")
    if last > loud - 12 and a["kind"] != "effect": flags.append("ends without decay or fade (cut): needs a fade-out before use")
    if a["kind"] == "effect" and last > loud - 30: flags.append("effect still loud in its last 100 ms: tail cut, trim/fade")
    if head > 0.5: flags.append(f"{head:.1f} s of silence at the head: trim")
    if tail > 0.5: flags.append(f"{tail:.1f} s of silence at the tail: trim")
    if a["kind"] in ("ambience", "music") and (seam_db > 3 or seam_c > 600): flags.append(f"loop seam: level jump {seam_db:.1f} dB, centroid jump {seam_c:.0f} Hz: needs crossfade if looped")
    if a["measured"].get("integrated_lufs") is not None and a["kind"] == "music" and a["measured"]["integrated_lufs"] > -9: flags.append("mastered very hot for a bed (above -9 LUFS): attenuate heavily under narration")
    res[a["slot"]] = {
        "kind": a["kind"], "clipped_samples": clipped, "true_peak_dbtp": tp, "head_silence_s": round(head, 2), "tail_silence_s": round(tail, 2),
        "noise_floor_db": round(float(np.percentile(w50, 10)), 1), "dc_offset": round(float(x.mean()), 5), "crest_factor_db": round(float(20 * np.log10(np.abs(x).max() / (np.sqrt(np.mean(x ** 2)) + 1e-9))), 1),
        "last_100ms_vs_peak_db": round(last - loud, 1), "loop_seam_level_db": round(seam_db, 1), "loop_seam_centroid_hz": round(seam_c),
        "machine_flags": flags, "listening_review": "NOT DONE (no person has listened)", "approval": "pending human audition" if not any("true peak" in q or "clipping" in q for q in flags) else "needs correction before audition",
    }
    print(a["slot"].ljust(20), "flags:", len(flags), "|", "; ".join(flags)[:150])
json.dump({"generated": "2026-11-13", "note": "Machine flags only. Not a listening review.", "assets": res}, open(os.path.join(ROOT, "config/longform-audio-qa.json"), "w"), indent=1, default=float)
