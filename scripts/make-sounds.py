#!/usr/bin/env python3
"""Synthesizes the original sound effects and music for "Our Little One" into shared/sounds.

Everything is generated from sine/triangle waves and filtered noise, so there are no
third-party samples or licenses. Run: python3 scripts/make-sounds.py
SFX peak at -3 dBFS; the music loops peak at -9 dBFS so they sit under the effects.
"""
import math
import os
import random
import struct
import wave

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "shared", "sounds")
random.seed(7)


def silence(sec):
    return [0.0] * int(SR * sec)


def mix(dst, src, at=0.0, gain=1.0, wrap=False):
    start = int(at * SR)
    for i, v in enumerate(src):
        j = start + i
        if j >= len(dst):
            if not wrap:
                break
            j %= len(dst)
        dst[j] += v * gain
    return dst


def env(n, attack=0.005, decay=None):
    """Fast attack, exponential decay over the whole sound."""
    a = max(1, int(attack * SR))
    d = decay or n / SR
    return [min(1.0, i / a) * math.exp(-(i / SR) / (d / 5)) for i in range(n)]


def sweep(f0, f1, sec, shape="sine", decay=None, attack=0.004):
    n = int(sec * SR)
    e = env(n, attack, decay)
    out, ph = [], 0.0
    for i in range(n):
        f = f0 * (f1 / f0) ** (i / n)
        ph += 2 * math.pi * f / SR
        if shape == "tri":
            v = 2 / math.pi * math.asin(math.sin(ph))
        else:
            v = math.sin(ph)
        out.append(v * e[i])
    return out


def bell(freq, sec, partials=((1, 1.0), (2.01, 0.35), (3.03, 0.12)), decay=None):
    n = int(sec * SR)
    e = env(n, 0.003, decay)
    return [e[i] * sum(a * math.sin(2 * math.pi * freq * m * i / SR) for m, a in partials) / 1.5 for i in range(n)]


def noise(sec, cutoff=0.2, decay=None, attack=0.002):
    """One-pole low-passed noise; cutoff 0..1 (higher = brighter)."""
    n = int(sec * SR)
    e = env(n, attack, decay)
    out, y = [], 0.0
    for i in range(n):
        y += cutoff * (random.uniform(-1, 1) - y)
        out.append(y * e[i] * 2.5)
    return out


def note(name):
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    octave = int(name[-1])
    semis = names[name[0]] + (1 if "#" in name else 0)
    return 440.0 * 2 ** ((semis - 9) / 12 + (octave - 4))


def normalize(x, peak_db):
    peak = max(1e-9, max(abs(v) for v in x))
    g = 10 ** (peak_db / 20) / peak
    return [v * g for v in x]


def fade_out(x, sec=0.01):
    n = min(len(x), int(sec * SR))
    for i in range(n):
        x[-1 - i] *= i / n
    return x


def save(name, x, peak_db=-3.0):
    x = normalize(x, peak_db)
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v)) * 32767)) for v in x))


# --- SFX --------------------------------------------------------------------
save("pop", fade_out(sweep(900, 260, 0.12, decay=0.1)))
save("pickup", fade_out(mix(sweep(320, 980, 0.14, "tri", decay=0.2), noise(0.14, 0.5, 0.1), gain=0.25)))
save("hover", fade_out(sweep(1250, 1500, 0.06, decay=0.06)))
save("land", fade_out(mix(sweep(180, 55, 0.18, decay=0.16), noise(0.03, 0.6), gain=0.4)))
save("click", fade_out(noise(0.02, 0.9, 0.02)))

for k, (f, c) in enumerate([(210, 0.25), (260, 0.32)]):
    save(f"chew{k + 1}", fade_out(mix(noise(0.07, c, 0.06), sweep(f, f * 0.7, 0.07, decay=0.06), gain=0.5)))

splash = noise(1.3, 0.35, 1.1, attack=0.01)
splash = [v * 0.35 for v in splash]
for _ in range(16):
    f = random.uniform(380, 900)
    mix(splash, sweep(f, f * 2.6, random.uniform(0.03, 0.06), decay=0.05), at=random.uniform(0.0, 1.15), gain=random.uniform(0.4, 0.8))
save("splash", fade_out(splash, 0.08))

bubble = silence(0.25)
for t, f in [(0.0, 520), (0.08, 700), (0.15, 600)]:
    mix(bubble, sweep(f, f * 2.4, 0.05, decay=0.05), at=t, gain=0.8)
save("bubble", fade_out(bubble))


def syllable(f, sec=0.11):
    """A breathy "he": a few harmonics shaped like a vowel, with a little pitch wobble."""
    n = int(sec * SR)
    out = []
    for i in range(n):
        t = i / SR
        a = math.sin(math.pi * min(1.0, i / n)) ** 1.5
        f0 = f * (1 + 0.04 * math.sin(2 * math.pi * 18 * t))
        v = sum(amp * math.sin(2 * math.pi * f0 * h * t) for h, amp in ((1, 1.0), (2, 0.6), (3, 0.45), (4, 0.2), (5, 0.12)))
        out.append(a * (v + random.uniform(-0.25, 0.25)))
    return out


for k, base in enumerate([520, 600]):
    g = silence(0.75)
    for j in range(4):
        mix(g, syllable(base * (1.08 - j * 0.04)), at=j * 0.15)
    save(f"giggle{k + 1}", fade_out(g, 0.03))

sparkle = silence(0.9)
for j, nm in enumerate(["C6", "E6", "G6", "C7"]):
    mix(sparkle, bell(note(nm), 0.6, decay=0.5), at=j * 0.07, gain=0.7)
save("sparkle", fade_out(sparkle, 0.05))

save("ding", fade_out(bell(note("E6"), 0.6, ((1, 1.0), (2.76, 0.4), (5.4, 0.1)), decay=0.55), 0.05))

boing = silence(1.4)
for j, t in enumerate([0.0, 0.42, 0.75, 1.0]):
    mix(boing, sweep(330, 130, 0.16, decay=0.15), at=t, gain=1.0 - j * 0.2)
save("boing", fade_out(boing, 0.05))

fanfare = silence(1.8)
for j, nm in enumerate(["C5", "E5", "G5"]):
    mix(fanfare, sweep(note(nm), note(nm), 0.16, "tri", decay=0.3), at=j * 0.12, gain=0.8)
for nm in ["C5", "E5", "G5", "C6"]:
    mix(fanfare, sweep(note(nm), note(nm), 1.3, "tri", decay=1.4, attack=0.01), at=0.4, gain=0.45)
mix(fanfare, sparkle, at=0.4, gain=0.5)
save("fanfare", fade_out(fanfare, 0.1))


# --- Music (seamless loops: tails wrap around to the start) -------------------
def loop(bpm, beats_per_bar, bars, melody, bass, tone_decay, chord_gain):
    beat = 60 / bpm
    total = silence(beat * beats_per_bar * bars)
    for start, length, nm in melody:
        mix(total, bell(note(nm), length * beat + 1.2, decay=tone_decay), at=start * beat, gain=0.55, wrap=True)
    for start, nm in bass:
        mix(total, sweep(note(nm), note(nm), beat * beats_per_bar + 0.6, "tri", decay=2.4, attack=0.03), at=start * beat, gain=chord_gain, wrap=True)
    return total


# Day theme: an original, gentle music-box tune, C major pentatonic, 4/4 at 92 BPM, 4 bars.
day_melody = [(0, 1, "E5"), (1, 1, "G5"), (2, 1, "A5"), (3, 1, "G5"), (4, 1, "E5"), (5, 1, "D5"), (6, 2, "C5"),
              (8, 1, "D5"), (9, 1, "E5"), (10, 1, "G5"), (11, 1, "E5"), (12, 1, "D5"), (13, 1, "C5"), (14, 2, "D5")]
day_bass = [(0, "C3"), (4, "A2"), (8, "F2"), (12, "G2")]
save("music_day", loop(92, 4, 4, day_melody, day_bass, 1.4, 0.3), peak_db=-9)

# Lullaby: slower and softer, 3/4 at 66 BPM, 4 bars, played when the lights go off.
night_melody = [(0, 2, "G4"), (2, 1, "E4"), (3, 2, "D4"), (5, 1, "E4"), (6, 2, "G4"), (8, 1, "A4"), (9, 3, "G4")]
night_bass = [(0, "C3"), (3, "A2"), (6, "F2"), (9, "G2")]
save("music_night", loop(66, 3, 4, night_melody, night_bass, 2.2, 0.35), peak_db=-11)

print("wrote", sorted(os.listdir(OUT)))
