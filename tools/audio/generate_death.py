"""Generates death.wav — a short descending tone with a slight wobble, reading as a failure
cue for Game Over. Run standalone: python3 tools/audio/generate_death.py"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SAMPLE_RATE, audio_output_dir, envelope, normalize, write_wav

FREQ_START = 440.0
FREQ_END = 110.0
DURATION = 0.5
TREMOR_HZ = 7.0
TREMOR_DEPTH = 0.15


def main() -> None:
    n = int(DURATION * SAMPLE_RATE)
    samples = []
    for i in range(n):
        t = i / SAMPLE_RATE
        phase = 2 * math.pi * (FREQ_START * t + (FREQ_END - FREQ_START) * t * t / (2 * DURATION))
        tremor = 1.0 + TREMOR_DEPTH * math.sin(2 * math.pi * TREMOR_HZ * t)
        samples.append(math.sin(phase) * tremor)

    samples = envelope(samples, attack=0.01, decay=0.05, sustain_level=0.6, release=0.25)
    samples = normalize(samples, peak=0.85)

    out = audio_output_dir() / "death.wav"
    write_wav(out, samples)
    print(f"wrote {out} ({len(samples) / SAMPLE_RATE:.3f}s, {out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
