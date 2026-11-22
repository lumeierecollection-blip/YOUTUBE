"""Word timings of the narration (faster-whisper small.en): output/sx/<slug>/voice.mp3 -> words.json [{w, t0, t1}]. Usage: python3 words.py <slug>"""
import json, sys, pathlib
from faster_whisper import WhisperModel
d = pathlib.Path(__file__).resolve().parents[2] / "output/sx" / sys.argv[1]
segs, _ = WhisperModel("small.en", compute_type="int8").transcribe(str(d / "voice.mp3"), word_timestamps=True)
w = [{"w": x.word.strip(), "t0": round(x.start, 3), "t1": round(x.end, 3)} for s in segs for x in s.words]
(d / "words.json").write_text(json.dumps(w))
print(f"{len(w)} words, {w[-1]['t1']:.1f} s")
