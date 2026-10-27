from pathlib import Path
import math
import wave

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
AUDIO_ROOT = ROOT / "assets" / "audio"
BGM_RATE = 11025
SFX_RATE = 22050
RNG = np.random.default_rng(20260808)


def midi_frequency(note):
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def write_wav(path, samples, sample_rate):
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = float(np.max(np.abs(samples))) if len(samples) else 1.0
    if peak > 0.96:
        samples = samples * (0.96 / peak)
    pcm = np.clip(samples, -1, 1)
    pcm = (pcm * 32767).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm.tobytes())


def envelope(length, sample_rate, attack=0.012, release=0.12):
    result = np.ones(length, dtype=np.float64)
    attack_samples = min(length, max(1, int(attack * sample_rate)))
    release_samples = min(length, max(1, int(release * sample_rate)))
    result[:attack_samples] *= np.linspace(0, 1, attack_samples, endpoint=False)
    result[-release_samples:] *= np.linspace(1, 0, release_samples)
    return result


def instrument_wave(kind, frequency, seconds, sample_rate):
    length = max(1, int(seconds * sample_rate))
    time = np.arange(length, dtype=np.float64) / sample_rate
    if kind == "pluck":
        wave_data = np.sin(2 * math.pi * frequency * time)
        wave_data += 0.34 * np.sin(2 * math.pi * frequency * 2 * time)
        wave_data += 0.16 * np.sin(2 * math.pi * frequency * 3 * time)
        wave_data *= np.exp(-3.1 * time / max(seconds, 0.05))
        return wave_data * envelope(length, sample_rate, 0.006, min(0.12, seconds * 0.3))
    if kind == "horn":
        wave_data = np.zeros(length)
        for harmonic in range(1, 6):
            wave_data += np.sin(2 * math.pi * frequency * harmonic * time) / (harmonic * 1.4)
        return np.tanh(wave_data * 0.85) * envelope(length, sample_rate, 0.035, 0.1)
    if kind == "bell":
        wave_data = np.sin(2 * math.pi * frequency * time)
        wave_data += 0.42 * np.sin(2 * math.pi * frequency * 2.01 * time)
        wave_data += 0.18 * np.sin(2 * math.pi * frequency * 3.98 * time)
        wave_data *= np.exp(-2.4 * time / max(seconds, 0.05))
        return wave_data * envelope(length, sample_rate, 0.004, 0.08)
    wave_data = np.sin(2 * math.pi * frequency * time)
    wave_data += 0.22 * np.sin(2 * math.pi * frequency * 2 * time)
    return wave_data * envelope(length, sample_rate, 0.01, 0.08)


def add_note(buffer, beat_seconds, start_beat, duration_beats, note, kind, volume):
    start = int(start_beat * beat_seconds * BGM_RATE)
    seconds = duration_beats * beat_seconds
    data = instrument_wave(kind, midi_frequency(note), seconds, BGM_RATE) * volume
    end = min(len(buffer), start + len(data))
    if start < len(buffer):
        buffer[start:end] += data[:end - start]


def add_kick(buffer, beat_seconds, beat, volume):
    start = int(beat * beat_seconds * BGM_RATE)
    length = min(len(buffer) - start, int(0.17 * BGM_RATE))
    if length <= 0:
        return
    time = np.arange(length) / BGM_RATE
    phase = 2 * math.pi * (105 * time - 170 * time * time)
    buffer[start:start + length] += np.sin(phase) * np.exp(-22 * time) * volume


def add_snare(buffer, beat_seconds, beat, volume):
    start = int(beat * beat_seconds * BGM_RATE)
    length = min(len(buffer) - start, int(0.11 * BGM_RATE))
    if length <= 0:
        return
    time = np.arange(length) / BGM_RATE
    noise = RNG.normal(0, 1, length)
    tone = np.sin(2 * math.pi * 165 * time)
    buffer[start:start + length] += (noise * 0.7 + tone * 0.3) * np.exp(-28 * time) * volume


def add_hat(buffer, beat_seconds, beat, volume):
    start = int(beat * beat_seconds * BGM_RATE)
    length = min(len(buffer) - start, int(0.045 * BGM_RATE))
    if length <= 0:
        return
    time = np.arange(length) / BGM_RATE
    noise = RNG.normal(0, 1, length)
    buffer[start:start + length] += noise * np.exp(-70 * time) * volume


def build_bgm(name, bpm, scale, melody_kind, melody_volume, drum_level, bass_pattern):
    beat_seconds = 60.0 / bpm
    beats = 16
    duration = beats * beat_seconds
    buffer = np.zeros(int(duration * BGM_RATE), dtype=np.float64)
    motif = (0, 2, 4, 2, 0, 2, 5, 4, 2, 4, 6, 5, 4, 2, 1, 0)
    for beat, scale_index in enumerate(motif):
        add_note(buffer, beat_seconds, beat, 0.76, scale[scale_index], melody_kind, melody_volume)
    for beat in range(beats):
        root = bass_pattern[beat % len(bass_pattern)]
        add_note(buffer, beat_seconds, beat, 0.82, root, "bass", 0.19 if name == "calm" else 0.25)
    if name == "calm":
        for beat in (0, 4, 8, 12):
            add_note(buffer, beat_seconds, beat, 1.8, scale[0] + 12, "bell", 0.08)
        for beat in (0, 2, 4, 6, 8, 10, 12, 14):
            add_hat(buffer, beat_seconds, beat, drum_level * 0.42)
    else:
        for beat in range(beats):
            add_kick(buffer, beat_seconds, beat, drum_level)
            if beat % 2 == 1:
                add_snare(buffer, beat_seconds, beat, drum_level * 0.68)
            add_hat(buffer, beat_seconds, beat + 0.5, drum_level * 0.34)
    if name == "danger":
        for beat in range(0, beats, 2):
            add_note(buffer, beat_seconds, beat + 0.5, 0.38, scale[1] - 12, "horn", 0.11)
    buffer = np.tanh(buffer * 0.9)
    fade = min(64, len(buffer) // 2)
    buffer[:fade] *= np.linspace(0, 1, fade)
    buffer[-fade:] *= np.linspace(1, 0, fade)
    write_wav(AUDIO_ROOT / "bgm" / (name + ".wav"), buffer, BGM_RATE)


def chirp(seconds, start_frequency, end_frequency, noise_level=0.0, decay=4.0):
    length = int(seconds * SFX_RATE)
    time = np.arange(length) / SFX_RATE
    slope = (end_frequency - start_frequency) / max(seconds, 0.001)
    phase = 2 * math.pi * (start_frequency * time + 0.5 * slope * time * time)
    data = np.sin(phase)
    if noise_level:
        data += RNG.normal(0, 1, length) * noise_level
    data *= np.exp(-decay * time / max(seconds, 0.001))
    return data * envelope(length, SFX_RATE, 0.003, min(0.08, seconds * 0.35))


def sequence(notes, note_seconds, kind="bell", volume=0.7):
    gap = 0.025
    total = len(notes) * (note_seconds + gap)
    buffer = np.zeros(int(total * SFX_RATE), dtype=np.float64)
    cursor = 0
    for note in notes:
        data = instrument_wave(kind, midi_frequency(note), note_seconds, SFX_RATE) * volume
        end = min(len(buffer), cursor + len(data))
        buffer[cursor:end] += data[:end - cursor]
        cursor += int((note_seconds + gap) * SFX_RATE)
    return buffer


def build_sfx():
    effects = {
        "attack": chirp(0.17, 950, 180, 0.32, 5.5) * 0.62,
        "shot": chirp(0.12, 360, 880, 0.08, 5.0) * 0.55,
        "enemy-hit": chirp(0.11, 150, 72, 0.45, 7.0) * 0.72,
        "player-hit": chirp(0.24, 125, 48, 0.38, 4.0) * 0.85,
        "pickup": sequence((74, 79), 0.075, "bell", 0.55),
        "level-up": sequence((62, 66, 69, 74), 0.105, "bell", 0.6),
        "victory": sequence((62, 66, 69, 74, 78), 0.13, "horn", 0.62),
        "defeat": sequence((62, 60, 57, 50), 0.16, "bass", 0.7),
        "danger": sequence((50, 50, 51), 0.14, "horn", 0.64),
    }
    for name, data in effects.items():
        write_wav(AUDIO_ROOT / "sfx" / (name + ".wav"), data, SFX_RATE)


def main():
    build_bgm("calm", 80, (62, 64, 66, 69, 71, 74, 76), "pluck", 0.24, 0.15, (38, 38, 43, 38))
    build_bgm("heroic", 112, (62, 64, 66, 69, 71, 74, 76), "horn", 0.22, 0.22, (38, 45, 43, 45))
    build_bgm("danger", 136, (62, 63, 65, 67, 68, 70, 72), "horn", 0.24, 0.29, (38, 39, 36, 39))
    build_sfx()
    files = list(AUDIO_ROOT.rglob("*.wav"))
    total = sum(path.stat().st_size for path in files)
    print("Generated %d audio files, %d bytes" % (len(files), total))
    for path in files:
        print(path.relative_to(ROOT), path.stat().st_size)


if __name__ == "__main__":
    main()
