"""Generates ambient-music.wav — a seamlessly-loopable ambient pad for background music during
Playing. Run standalone: python3 tools/audio/generate_ambient_music.py

Loop seamlessness: the two sine layers (110Hz and 110.5Hz) are given a duration (24s) chosen so
both complete an exact integer number of cycles (2640 and 2652 respectively) — zero phase
discontinuity at the loop point by construction, no crossfade needed for that part. The
filtered-noise layer isn't periodic by nature, so its loop boundary is additionally smoothed
with a short crossfade of the tail into the head, making the whole mixed signal click-free when
IAudioPlayer restarts the loop.
"""

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SAMPLE_RATE, audio_output_dir, low_pass, write_wav

DURATION = 24.0
FREQ_A = 110.0
FREQ_B = 110.5
NOISE_LEVEL = 0.04
CROSSFADE_SECONDS = 0.05


def main() -> None:
    n = int(DURATION * SAMPLE_RATE)

    pad = []
    for i in range(n):
        t = i / SAMPLE_RATE
        a = math.sin(2 * math.pi * FREQ_A * t)
        b = math.sin(2 * math.pi * FREQ_B * t)
        pad.append((a + b) * 0.25)

    rng = random.Random(7)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    noise = low_pass(noise, alpha=0.03)
    noise_peak = max((abs(x) for x in noise), default=1.0) or 1.0
    noise = [x / noise_peak * NOISE_LEVEL for x in noise]

    combined = [p + nz for p, nz in zip(pad, noise)]

    fade_n = int(CROSSFADE_SECONDS * SAMPLE_RATE)
    for i in range(fade_n):
        fade_in = i / fade_n
        fade_out = 1.0 - fade_in
        tail_idx = n - fade_n + i
        combined[i] = combined[i] * fade_in + combined[tail_idx] * fade_out

    peak = max((abs(x) for x in combined), default=1.0) or 1.0
    combined = [x / peak * 0.7 for x in combined]

    out = audio_output_dir() / "ambient-music.wav"
    write_wav(out, combined)
    print(f"wrote {out} ({len(combined) / SAMPLE_RATE:.3f}s, {out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
