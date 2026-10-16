"""Generates eat-food.wav — a short, light, high-pitched pop for the frequent, low-stakes
eat-food event. Run standalone: python3 tools/audio/generate_eat_food.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SAMPLE_RATE, audio_output_dir, chirp, envelope, normalize, write_wav


def main() -> None:
    duration = 0.09
    samples = chirp(880, 1200, duration)
    samples = envelope(samples, attack=0.005, decay=0.02, sustain_level=0.3, release=0.05)
    samples = normalize(samples, peak=0.8)

    out = audio_output_dir() / "eat-food.wav"
    write_wav(out, samples)
    print(f"wrote {out} ({len(samples) / SAMPLE_RATE:.3f}s, {out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
