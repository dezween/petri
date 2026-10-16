"""Generates eat-bot.wav — a deeper, meatier pop/crunch, distinct by ear from eat-food.wav's
light high-pitched blip. Run standalone: python3 tools/audio/generate_eat_bot.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SAMPLE_RATE, audio_output_dir, envelope, mix, normalize, sine_wave, white_noise, write_wav


def main() -> None:
    duration = 0.16

    tone = mix(sine_wave(220, duration), sine_wave(330, duration))
    tone = [s * 0.5 for s in tone]

    # A short noise "crunch" layered under the tone, decayed to silence well before the tone's
    # own release so it reads as an attack transient rather than a sustained hiss.
    noise = white_noise(duration, seed=42)
    noise = envelope(noise, attack=0.0, decay=0.03, sustain_level=0.0, release=0.03)
    noise = [n * 0.3 for n in noise]

    combined = mix(tone, noise)
    combined = envelope(combined, attack=0.003, decay=0.04, sustain_level=0.4, release=0.08)
    combined = normalize(combined, peak=0.85)

    out = audio_output_dir() / "eat-bot.wav"
    write_wav(out, combined)
    print(f"wrote {out} ({len(combined) / SAMPLE_RATE:.3f}s, {out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
