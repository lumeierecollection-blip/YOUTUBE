"""Spectrogram of a window, for visual verification of detected events. usage: python spectro.py <work_dir> <id> <t0> <t1> <out.png>
Shows log-frequency spectrogram, speech words (from speech.json) as a bar underneath, and the RMS curve."""
import json, os, sys
import numpy as np, librosa, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

work, vid, t0, t1, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
y, sr = librosa.load(os.path.join(work, vid, "audio.wav"), sr=22050, offset=t0, duration=t1 - t0)
sp = json.load(open(os.path.join(work, vid, "speech.json"), encoding="utf8"))
S = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=2048, hop_length=512)), ref=np.max)
fig, ax = plt.subplots(3, 1, figsize=(11, 6), sharex=True, gridspec_kw={"height_ratios": [5, 0.7, 1.3]})
librosa.display.specshow(S, sr=sr, hop_length=512, x_axis="time", y_axis="log", ax=ax[0], vmin=-80, vmax=0) if hasattr(librosa, "display") else None
ax[0].set_xlim(0, t1 - t0)
for s in sp["segments"]:
    for w0, w1, w in s["words"]:
        if w1 >= t0 and w0 <= t1: ax[1].axvspan(w0 - t0, w1 - t0, color="tab:blue", alpha=0.6)
ax[1].set_yticks([]); ax[1].set_ylabel("voice")
rms = librosa.feature.rms(y=y, hop_length=512)[0]
ax[2].plot(np.arange(len(rms)) * 512 / sr, 20 * np.log10(rms + 1e-6)); ax[2].set_ylabel("dBFS")
ax[2].set_xlabel(f"seconds from {t0:.1f}s ({vid})")
plt.tight_layout(); plt.savefig(out, dpi=80)
