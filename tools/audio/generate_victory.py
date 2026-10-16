"""Generates victory.wav — a short rising three-note chime (C5-E5-G5) for the Victory screen.
Run standalone: python3 tools/audio/generate_victory.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SAMPLE_RATE, audio_output_dir, envelope, normalize, sine_wave, write_wav

NOTES = [523.25, 659.25, 783.99]  # C5, E5, G5
NOTE_DURATION = 0.15
# Notes start 100ms apart but each lasts 150ms, so consecutive notes overlap by 50ms — reads
# as a connected rising chime rather than three disjoint blips.
NOTE_SPACING = 0.1


def main() -> None:
    total_duration = NOTE_SPACING * (len(NOTES) - 1) + NOTE_DURATION
    total_samples = int(total_duration * SAMPLE_RATE) + 1
    track = [0.0] * total_samples

    for i, freq in enumerate(NOTES):
        tone = sine_wave(freq, NOTE_DURATION)
        tone = envelope(tone, attack=0.005, decay=0.02, sustain_level=0.6, release=0.1)
        start = int(i * NOTE_SPACING * SAMPLE_RATE)
        for j, s in enumerate(tone):
            idx = start + j
            if idx < len(track):
                track[idx] += s * 0.6

    track = normalize(track, peak=0.85)

    out = audio_output_dir() / "victory.wav"
    write_wav(out, track)
    print(f"wrote {out} ({len(track) / SAMPLE_RATE:.3f}s, {out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
