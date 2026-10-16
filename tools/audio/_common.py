"""Shared pure-stdlib WAV synthesis helpers for the tools/audio/generate_*.py scripts.

No third-party dependencies (no numpy/scipy) — just math/random/struct/wave from the standard
library, mirroring tools/blender/_common.py's "no extra install needed" ethos for a different
asset type.
"""

import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 22050


def audio_output_dir() -> Path:
    """src/assets/audio/, resolved relative to this file's own location so the scripts work
    from any working directory, the same convention tools/blender/_common.py uses."""
    return Path(__file__).resolve().parent.parent.parent / "src" / "assets" / "audio"


def sine_wave(freq: float, duration: float, sample_rate: int = SAMPLE_RATE, phase: float = 0.0):
    n = int(duration * sample_rate)
    return [math.sin(2 * math.pi * freq * (i / sample_rate) + phase) for i in range(n)]


def chirp(freq_start: float, freq_end: float, duration: float, sample_rate: int = SAMPLE_RATE):
    """Linear frequency sweep from freq_start to freq_end over duration, phase-continuous
    (integrates instantaneous frequency rather than naively interpolating raw sine args, which
    would produce an audible discontinuity)."""
    n = int(duration * sample_rate)
    samples = []
    for i in range(n):
        t = i / sample_rate
        phase = 2 * math.pi * (freq_start * t + (freq_end - freq_start) * t * t / (2 * duration))
        samples.append(math.sin(phase))
    return samples


def white_noise(duration: float, sample_rate: int = SAMPLE_RATE, seed: int | None = None):
    rng = random.Random(seed)
    n = int(duration * sample_rate)
    return [rng.uniform(-1, 1) for _ in range(n)]


def low_pass(samples, alpha: float = 0.05):
    """One-pole low-pass filter — enough to turn harsh white noise into a soft hiss without
    needing a real DSP library."""
    out = []
    prev = 0.0
    for s in samples:
        prev = prev + alpha * (s - prev)
        out.append(prev)
    return out


def envelope(samples, attack: float = 0.01, decay: float = 0.05, sustain_level: float = 0.7, release: float = 0.1, sample_rate: int = SAMPLE_RATE):
    """Simple ADSR gain envelope applied in place over the given samples."""
    n = len(samples)
    attack_n = int(attack * sample_rate)
    decay_n = int(decay * sample_rate)
    release_n = int(release * sample_rate)
    sustain_n = max(n - attack_n - decay_n - release_n, 0)
    out = []
    for i, s in enumerate(samples):
        if i < attack_n:
            g = i / max(attack_n, 1)
        elif i < attack_n + decay_n:
            g = 1.0 - (1.0 - sustain_level) * ((i - attack_n) / max(decay_n, 1))
        elif i < attack_n + decay_n + sustain_n:
            g = sustain_level
        else:
            rel_i = i - (attack_n + decay_n + sustain_n)
            g = sustain_level * max(1.0 - rel_i / max(release_n, 1), 0.0)
        out.append(s * g)
    return out


def mix(*tracks):
    """Sums tracks of possibly-different lengths, zero-padding the shorter ones."""
    length = max(len(t) for t in tracks)
    out = [0.0] * length
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    return out


def normalize(samples, peak: float = 0.9):
    m = max((abs(s) for s in samples), default=1.0)
    if m == 0:
        return samples
    scale = peak / m
    return [s * scale for s in samples]


def write_wav(path: Path, samples, sample_rate: int = SAMPLE_RATE) -> None:
    """16-bit PCM mono WAV — the simplest format HTMLAudioElement plays natively with zero
    decoding ambiguity, and Python's stdlib `wave` module writes it without any dependency."""
    path.parent.mkdir(parents=True, exist_ok=True)
    clipped = [max(-1.0, min(1.0, s)) for s in samples]
    frames = b"".join(struct.pack("<h", int(s * 32767)) for s in clipped)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(frames)
