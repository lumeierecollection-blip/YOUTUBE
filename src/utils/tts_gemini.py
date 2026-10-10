#!/usr/bin/env python3
"""
tts_gemini.py - the voiceover from Gemini's own text-to-speech, with real per-word timings.

    python src/utils/tts_gemini.py --voice Charon --style "..." --file spoken.txt [--display-file written.txt] \
        --mp3 out.mp3 --srt out.srt --words out-words.json

Why (owner, 2026-10-10: "THE VOICE IS ROBOTIC"): the narration came from Microsoft Edge's free read-aloud voices
(edge-tts, en-US-GuyNeural / AriaNeural ...). In a blind Gemini listening test on the same sentence, edge-tts scored
SYNTHETIC 4/10 ("pacing very even ... lacking dynamic variation"); gemini-3.1-flash-tts-preview scored HUMAN 9/10
("natural cadence, good emotional tone"). The same Gemini keys the pipeline already holds are used.

The audio: Gemini returns 24 kHz 16-bit mono PCM (or WAV); ffmpeg writes it as a 192 kbps mp3 at 24 kHz with NO
EQ, compression or limiting - the voice is left as synthesised.

The word timings: Gemini TTS returns no timestamps, and the renderer pops words on the frame they are spoken. The mp3 is
transcribed by faster-whisper (word_timestamps) and the recognised words are aligned to the script's words in order
(difflib); a script word the recogniser missed takes a time interpolated between its matched neighbours. Where this stops:
the times are the recogniser's estimate of the real audio (typically within ~50-100 ms), not the engine's own boundaries as
edge-tts gave; if fewer than 60% of the script's words align, the run fails and tts.js falls back to edge-tts rather than
ship timings that are wrong.

Output files have the exact shape tts_words.py writes (the renderer and the gates read them unchanged).
"""
import argparse
import base64
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tts_words import sentence_spans, ts  # noqa: E402

MODELS = ["gemini-3.1-flash-tts-preview", "gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"]


def keys():
    seen, out = set(), []
    for k in ("GEMINI_API_KEY_4", "GEMINI_API_KEY_1", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GOOGLE_GENERATIVE_AI_API_KEY"):
        v = os.environ.get(k)
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def synth(text, voice, style):
    prompt = f"{style}\n\n{text}" if style else text
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}},
    }).encode()
    last = None
    for model in MODELS:
        for key in keys():
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", data=body,
                                         headers={"x-goog-api-key": key, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=240) as r:
                    j = json.loads(r.read())
                part = j["candidates"][0]["content"]["parts"][0]["inlineData"]
                print(f"tts_gemini: {model} answered (voice {voice})", file=sys.stderr)
                return part["mimeType"], base64.b64decode(part["data"]), model
            except urllib.error.HTTPError as e:
                last = f"{model}: HTTP {e.code} {e.read()[:160]!r}"
            except Exception as e:  # noqa: BLE001
                last = f"{model}: {e}"
            print(f"tts_gemini: {last}", file=sys.stderr)
    raise RuntimeError(f"no Gemini TTS model answered ({last})")


def to_mp3(mime, data, mp3):
    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as f:
        f.write(data)
        raw = f.name
    m = re.search(r"rate=(\d+)", mime or "")
    src = ["-f", "s16le", "-ar", m.group(1) if m else "24000", "-ac", "1", "-i", raw] if "l16" in (mime or "").lower() or "pcm" in (mime or "").lower() else ["-i", raw]
    subprocess.run(["ffmpeg", "-v", "error", "-y", *src, "-ar", "24000", "-ac", "1", "-b:a", "192k", mp3], check=True)
    os.unlink(raw)


def norm(w):
    return re.sub(r"[^\w']", "", w.lower()).strip("'")


def align(mp3, text):
    from faster_whisper import WhisperModel  # pip install faster-whisper
    model = WhisperModel(os.environ.get("TTS_ALIGN_MODEL", "base.en"), device="cpu", compute_type="int8")
    segs, _ = model.transcribe(mp3, word_timestamps=True, language="en", beam_size=1, vad_filter=False)
    heard = [{"w": norm(w.word), "start": float(w.start), "end": float(w.end)} for s in segs for w in (s.words or []) if norm(w.word)]
    tokens = [t for t in re.findall(r"\S+", text)]
    script = [{"text": re.sub(r"^[^\w']+|[^\w']+$", "", t) or t, "n": norm(t)} for t in tokens]
    script = [s for s in script if s["n"]]
    sm = difflib.SequenceMatcher(a=[s["n"] for s in script], b=[h["w"] for h in heard], autojunk=False)
    times = [None] * len(script)
    for a0, b0, size in sm.get_matching_blocks():
        for k in range(size):
            times[a0 + k] = (heard[b0 + k]["start"], heard[b0 + k]["end"])
    matched = sum(1 for t in times if t)
    if not script or matched / len(script) < 0.6:
        raise RuntimeError(f"alignment: only {matched}/{len(script)} script words matched the recognised audio")
    # interpolate the unmatched words between their matched neighbours
    for i in range(len(script)):
        if times[i]:
            continue
        a = i - 1
        while a >= 0 and not times[a]:
            a -= 1
        b = i + 1
        while b < len(script) and not times[b]:
            b += 1
        t0 = times[a][1] if a >= 0 else (times[b][0] if b < len(script) else 0.0)
        t1 = times[b][0] if b < len(script) else t0 + 0.3 * (i - a)
        span = (t1 - t0) / max(1, b - a)
        st = t0 + span * (i - a - 1)
        times[i] = (st, st + max(0.08, span))
    words = [{"text": s["text"], "start": round(t[0], 3), "end": round(max(t[1], t[0] + 0.05), 3)} for s, t in zip(script, times)]
    for i in range(1, len(words)):  # monotone
        if words[i]["start"] < words[i - 1]["start"]:
            words[i]["start"] = words[i - 1]["start"]
    return words, matched, len(script)


def main():
    p = argparse.ArgumentParser()
    for k in ("voice", "file", "mp3", "srt", "words"):
        p.add_argument(f"--{k}", required=True)
    p.add_argument("--style", default="")
    p.add_argument("--display-file", dest="display_file", default=None)
    a = p.parse_args()
    text = open(a.file, encoding="utf-8").read()
    display = open(a.display_file, encoding="utf-8").read() if a.display_file else None
    mime, data, model = synth(text, a.voice, a.style)
    to_mp3(mime, data, a.mp3)
    words, matched, total = align(a.mp3, text)
    spans = sentence_spans(text)
    # each word's sentence: walk the text in order
    cur, si = 0, 0
    for w in words:
        at = text.find(w["text"], cur)
        if at >= 0:
            cur = at + len(w["text"])
        else:
            at = cur
        while si < len(spans) - 1 and at >= spans[si][1]:
            si += 1
        w["sentence"] = si
    shown, shown_spans = text, spans
    if display is not None:
        dspans = sentence_spans(display)
        if len(dspans) == len(spans):
            shown, shown_spans = display, dspans
    cues = []
    for i, (s0, s1) in enumerate(spans):
        ws = [w for w in words if w["sentence"] == i]
        if not ws:
            continue
        d0, d1 = shown_spans[i]
        cues.append({"text": re.sub(r"\s+", " ", shown[d0:d1]).strip(), "start": ws[0]["start"], "end": ws[-1]["end"]})
    with open(a.srt, "w", encoding="utf-8") as f:
        for i, c in enumerate(cues):
            f.write(f"{i + 1}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
    with open(a.words, "w", encoding="utf-8") as f:
        json.dump({"version": 1, "source": f"gemini-tts {model} + faster-whisper alignment ({matched}/{total} words matched)", "voice": a.voice,
                   "words": words, "sentences": cues}, f, indent=1)
    print(f"tts_gemini: {model} voice {a.voice}: {len(words)} words ({matched} aligned), {len(cues)} sentences")
    return 0


if __name__ == "__main__":
    sys.exit(main())
