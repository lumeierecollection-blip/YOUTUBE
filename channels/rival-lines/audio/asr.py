"""Speech map for each reference: where the narrator talks. usage: python asr.py <work_dir> [id ...]
Writes <work>/<id>/speech.json with VAD speech segments and word-timed transcript (kept in the work dir only;
the repo is public, so full transcripts of other creators' narration are never committed)."""
import json, os, sys, time
from faster_whisper import WhisperModel

work = sys.argv[1]
only = set(sys.argv[2:])
model = WhisperModel("base.en", device="cpu", compute_type="int8", cpu_threads=8)
for vid in sorted(os.listdir(work)):
    d = os.path.join(work, vid)
    wav = os.path.join(d, "audio.wav")
    out = os.path.join(d, "speech.json")
    if not os.path.exists(wav) or (only and vid not in only) or os.path.exists(out):
        continue
    t0 = time.time()
    segs, info = model.transcribe(
        wav, language="en", word_timestamps=True, vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 120, "speech_pad_ms": 40},
        condition_on_previous_text=False, beam_size=1)
    res = []
    for s in segs:
        res.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip(),
                    "words": [[round(w.start, 2), round(w.end, 2), w.word.strip()] for w in (s.words or [])]})
    json.dump({"duration": round(info.duration, 2), "segments": res}, open(out, "w", encoding="utf8"), ensure_ascii=False)
    print(vid, f"{info.duration:.0f}s audio, {len(res)} segs, {time.time()-t0:.0f}s", flush=True)
