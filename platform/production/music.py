#!/usr/bin/env python3
"""
Original background music, synthesised from scratch by this script with numpy. No sample, loop, recording or third-party track is used,
so there is no third-party licence to track: the output is original to this repository.

  music.py OUT.wav --mood suspense|glam|editorial|warm --seconds 24 [--hits 0,5.4,9.4] [--seed 3]

suspense  : low drone, slow heartbeat pulse, a thin bending tone, a riser into each hit. Restrained documentary tension.
glam      : 108 bpm, bright plucked arpeggio over a four-chord loop, soft kick and hat. Premium and celebratory.
editorial : 100 bpm, marimba-like plucks, soft kick and clap. Modern explainer.
warm      : slow pads and sparse piano-like notes (used by character stories).
Music is written to sit UNDER narration: the mix step ducks it further whenever the voice speaks.
"""
import argparse
import wave
import numpy as np

SR = 44100


def t_axis(n):
    return np.arange(n) / SR


def env_pluck(n, decay):
    return np.exp(-np.arange(n) / (SR * decay))


def tone(freq, n, harmonics=((1, 1.0), (2, 0.35), (3, 0.15)), decay=0.35):
    t = t_axis(n)
    s = sum(a * np.sin(2 * np.pi * freq * h * t) for h, a in harmonics)
    return s * env_pluck(n, decay)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, start_s, sig, gain=1.0):
    i = int(start_s * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def kick(n=int(0.28 * SR)):
    t = t_axis(n)
    f = 110 * np.exp(-t * 18) + 42
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)


def hat(rng, n=int(0.05 * SR)):
    return rng.normal(0, 1, n) * np.exp(-t_axis(n) * 90)


def clap(rng, n=int(0.12 * SR)):
    return rng.normal(0, 1, n) * np.exp(-t_axis(n) * 38)


def lowpass(x, k):
    ker = np.ones(k) / k
    return np.convolve(x, ker, mode="same")


def suspense(total, hits, rng):
    n = int(total * SR); out = np.zeros(n); t = t_axis(n)
    drone = np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 55.4 * t) + 0.45 * np.sin(2 * np.pi * 82.4 * t + 0.4 * np.sin(2 * np.pi * 0.11 * t))
    out += drone * (0.5 + 0.2 * np.sin(2 * np.pi * 0.07 * t)) * 0.45
    bend = np.sin(2 * np.pi * np.cumsum(1318 + 55 * np.sin(2 * np.pi * 0.05 * t)) / SR)
    out += bend * 0.035 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.09 * t))
    for k in range(int(total / 1.05)):
        add(out, k * 1.05, kick(int(0.3 * SR)), 0.42)
        add(out, k * 1.05 + 0.26, kick(int(0.2 * SR)), 0.2)
    noise = lowpass(rng.normal(0, 1, n), 40)
    for h in hits:
        r0 = max(0.0, h - 1.1)
        i0, i1 = int(r0 * SR), int(h * SR)
        if i1 > i0:
            out[i0:i1] += noise[i0:i1] * np.linspace(0, 1, i1 - i0) ** 2 * 0.5
        add(out, h, kick(int(0.6 * SR)), 0.9)
        add(out, h, tone(55, int(1.2 * SR), decay=0.6), 0.5)
    return out


def glam(total, hits, rng):
    n = int(total * SR); out = np.zeros(n); beat = 60 / 108
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
    for bar in range(int(total / (beat * 4)) + 1):
        ch = chords[bar % 4]
        for step in range(8):
            note = ch[step % 3] + (12 if step % 2 else 24)
            add(out, bar * beat * 4 + step * beat / 2, tone(midi(note), int(0.45 * SR), ((1, 1), (2, 0.5), (3, 0.3), (4, 0.15)), 0.2), 0.16)
        add(out, bar * beat * 4, tone(midi(ch[0] - 12), int(beat * 4 * SR), ((1, 1), (2, 0.2)), 1.6), 0.18)
        for b in range(4):
            add(out, bar * beat * 4 + b * beat, kick(), 0.5)
            add(out, bar * beat * 4 + b * beat + beat / 2, hat(rng), 0.12)
    return out


def editorial(total, hits, rng):
    n = int(total * SR); out = np.zeros(n); beat = 60 / 100
    scale = [60, 62, 64, 67, 69, 72]
    r = np.random.default_rng(11)
    for step in range(int(total / (beat / 2)) + 1):
        if r.random() < 0.62:
            add(out, step * beat / 2, tone(midi(scale[r.integers(0, len(scale))]), int(0.5 * SR), ((1, 1), (3.9, 0.25), (9.2, 0.06)), 0.16), 0.16)
    for b in range(int(total / beat) + 1):
        if b % 2 == 0:
            add(out, b * beat, kick(), 0.42)
        else:
            add(out, b * beat, clap(rng), 0.25)
    add(out, 0, tone(midi(36), int(total * SR), ((1, 1), (2, 0.1)), 400), 0.08)
    return out


def warm(total, hits, rng):
    n = int(total * SR); out = np.zeros(n); t = t_axis(n)
    for freq, g in ((midi(45), 0.22), (midi(52), 0.16), (midi(57), 0.12), (midi(60), 0.09)):
        out += np.sin(2 * np.pi * freq * t + 0.3 * np.sin(2 * np.pi * 0.2 * t)) * g * (0.6 + 0.4 * np.sin(2 * np.pi * 0.06 * t + freq))
    r = np.random.default_rng(5)
    for k in range(int(total / 2.2)):
        add(out, k * 2.2 + 0.3, tone(midi([64, 67, 69, 72][r.integers(0, 4)]), int(1.6 * SR), ((1, 1), (2, 0.25), (3, 0.08)), 0.7), 0.13)
    return out


MOODS = {"suspense": suspense, "glam": glam, "editorial": editorial, "warm": warm}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dst"); ap.add_argument("--mood", choices=MOODS, required=True)
    ap.add_argument("--seconds", type=float, required=True); ap.add_argument("--hits", default="")
    ap.add_argument("--seed", type=int, default=3)
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    hits = [float(x) for x in a.hits.split(",") if x.strip()] if a.hits else []
    mono = MOODS[a.mood](a.seconds, hits, rng)
    n = len(mono)
    fade = np.minimum(1, np.minimum(np.arange(n) / (SR * 1.2), (n - np.arange(n)) / (SR * 1.6)))
    mono = mono * fade
    mono = mono / (np.max(np.abs(mono)) + 1e-9) * 0.8
    right = np.concatenate([np.zeros(int(0.012 * SR)), mono])[:n]  # a few ms of delay gives a little width
    st = np.stack([mono, right], axis=1)
    pcm = (np.clip(st, -1, 1) * 32767).astype("<i2")
    with wave.open(a.dst, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(f"music: {a.mood} {a.seconds:.1f}s hits={hits} -> {a.dst}")


if __name__ == "__main__":
    main()
