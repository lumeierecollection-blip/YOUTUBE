#!/usr/bin/env python3
"""
tts_words.py - ONE Edge-TTS synthesis that writes the voiceover, its
sentence-level SRT, and real per-word timings, all from the same audio.

    python src/utils/tts_words.py --voice V --rate=-8% --pitch=+2Hz \
        --file text.txt --mp3 out.mp3 --srt out.srt --words out-words.json

Word timings are the service's WordBoundary events (offset/duration of each
spoken word, in the audio actually written) - not a model of speech rate.
The SRT is built from those same words, grouped into the input's
sentences, so the SRT cues, the word timings and the mp3 cannot disagree.

--display-file (optional): the WRITTEN text, when --file is the spoken
form (src/utils/tts-normalize.js: "50%" -> "fifty percent"). The audio and
the word timings come from --file; each SRT sentence cue takes its text from
the same-numbered sentence of the display file, so the planner still reads
"50%". If the two split into different sentence counts, the cues keep the
spoken text and a warning is printed - never a misaligned cue.

Where this stops: sentences are split from the input text with a regex
(terminal . ! ? followed by space, minus common abbreviations such as
"U.S." and "Dr."), not by the service's own sentence boundaries (Edge
reports either word or sentence boundaries per synthesis, not both). A
sentence with an unusual abbreviation may be split in two; the words and
their times are still exact.
"""
import argparse
import asyncio
import json
import re
import sys

ABBREV = {"u.s.", "u.k.", "e.u.", "u.n.", "mr.", "mrs.", "ms.", "dr.", "st.", "jr.", "sr.", "vs.", "e.g.", "i.e.",
          "inc.", "no.", "co.", "corp.", "ltd.", "etc.", "approx.", "dept.", "gov.", "sen.", "rep.", "gen.", "a.m.", "p.m."}


def sentence_spans(text):
    """[(start, end)] character spans of the sentences in text."""
    spans, start = [], 0
    for m in re.finditer(r'[.!?]+["\')\]]*(?=\s)|\n\s*\n', text):
        end = m.end()
        if m.group(0)[0] in ".!?":
            tok = text[:end].split()[-1].lower() if text[:end].split() else ""
            tok = tok.strip("\"')]")
            if tok in ABBREV or re.fullmatch(r"(?:[a-z]\.){1,3}", tok):
                continue
        if text[start:end].strip():
            spans.append((start, end))
        start = end
    if text[start:].strip():
        spans.append((start, len(text)))
    return spans


def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


async def synth(a, text):
    import edge_tts
    comm = edge_tts.Communicate(text, a.voice, rate=a.rate, pitch=a.pitch, boundary="WordBoundary")
    words = []
    with open(a.mp3, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"text": ch["text"], "start": ch["offset"] / 1e7, "end": (ch["offset"] + ch["duration"]) / 1e7})
    return words


def main():
    p = argparse.ArgumentParser()
    for k in ("voice", "rate", "pitch", "file", "mp3", "srt", "words"):
        p.add_argument(f"--{k}", required=True)
    p.add_argument("--display-file", dest="display_file", default=None)
    a = p.parse_args()
    text = open(a.file, encoding="utf-8").read()
    display = open(a.display_file, encoding="utf-8").read() if a.display_file else None
    words = asyncio.run(synth(a, text))
    if not words:
        print("tts_words: the service returned no WordBoundary events", file=sys.stderr)
        return 1
    spans = sentence_spans(text)
    cur, si = 0, 0
    for w in words:
        at = text.find(w["text"], cur)
        if at < 0:
            at = cur
        else:
            cur = at + len(w["text"])
        while si < len(spans) - 1 and at >= spans[si][1]:
            si += 1
        w["sentence"] = si
    shown, shown_spans = text, spans
    if display is not None:
        dspans = sentence_spans(display)
        if len(dspans) == len(spans):
            shown, shown_spans = display, dspans
        else:
            print(f"tts_words: WARNING display text has {len(dspans)} sentences, spoken text {len(spans)} - SRT cues use the spoken text", file=sys.stderr)
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
        json.dump({"version": 1, "source": "edge-tts WordBoundary", "voice": a.voice,
                   "words": [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in w.items()} for w in words],
                   "sentences": cues}, f, indent=1)
    print(f"tts_words: {len(words)} words, {len(cues)} sentences")
    return 0


if __name__ == "__main__":
    sys.exit(main())
