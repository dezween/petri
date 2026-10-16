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

    # Standard crossfade-loop: blend the head with the tail, then actually discard (trim) the
    # tail region the blend drew from. Blending alone (without trimming) does NOT make a loop
    # seamless for a non-periodic signal like this noise layer — it just replaces one
    # uncorrelated discontinuity (old head vs. old tail) with another (new blended head vs. the
    # still-untouched final sample), and empirically makes the seam discontinuity larger, not
    # smaller, since fade_out is largest exactly where the written value is least related to the
    # true original last sample. Trimming removes the duplicated tail so the blended region
    # becomes the one and only seam.
    fade_n = int(CROSSFADE_SECONDS * SAMPLE_RATE)
    blended_head = [
        combined[i] * (i / fade_n) + combined[n - fade_n + i] * (1.0 - i / fade_n)
        for i in range(fade_n)
    ]
    combined = blended_head + combined[fade_n : n - fade_n]

    peak = max((abs(x) for x in combined), default=1.0) or 1.0
    combined = [x / peak * 0.7 for x in combined]

    out = audio_output_dir() / "ambient-music.wav"
    write_wav(out, combined)
    print(f"wrote {out} ({len(combined) / SAMPLE_RATE:.3f}s, {out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
