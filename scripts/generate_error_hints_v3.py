#!/usr/bin/env python3
"""Generate guru error-state hint voice clips with ElevenLabs v3 emotion tags."""

import os, re, subprocess, sys, time, wave, json
from pathlib import Path

VOICE_ID = "1wuPdpXI8zr7v8YJnrpV"
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "pcm_24000"
VOICE_SETTINGS = {"stability": 0.45, "similarity_boost": 0.75, "style": 0.4}
VOICE_DIR = Path(__file__).parent.parent / "public" / "guruswami" / "voice"
TRANSCRIPTIONS_PATH = Path(__file__).parent.parent / "public" / "guruswami" / "voice-transcriptions.json"

_env_path = Path(__file__).parent.parent.parent / "services" / "dashboard" / "scripts" / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

CLIPS = [
    ("error_hint", "gs_error_hint_001",
     "[helpfully] Try a different topology — [pause] T P 2 or T P 4 usually work."),
    ("error_hint", "gs_error_hint_002",
     "[reassuringly] Lower the quantisation. [pause] Q4 is a safe choice."),
    ("error_hint", "gs_error_hint_003",
     "[warmly] Reduce the context length — that frees up memory."),
    ("error_hint", "gs_error_hint_004",
     "[thoughtfully] Some models just don't fit certain topologies. [pause] That's the puzzle."),
    ("error_hint", "gs_error_hint_005",
     "[reassuringly] E P modes are the safest — each node runs independently."),
    ("error_hint", "gs_error_hint_006",
     "[calmly] The attention heads need to divide evenly for tensor parallel. [pause] Try two or four nodes."),
    ("error_hint", "gs_error_hint_007",
     "[warmly] Check the memory bar — if it's full, something has to give."),
    ("error_hint", "gs_error_hint_008",
     "[helpfully] The model is too big for one node. [pause] Spread it across more with T P."),
    ("error_hint", "gs_error_hint_009",
     "[playfully] Sometimes the answer is just... pick a smaller model. [pause] No shame in that."),
    ("error_hint", "gs_error_hint_010",
     "[reassuringly] Don't worry — every configuration that crashes teaches you something."),
]

def strip_tags(text):
    return re.sub(r'\[.*?\]\s*', '', text).strip()

def main():
    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

    cat_dir = VOICE_DIR / "error_hint"
    cat_dir.mkdir(parents=True, exist_ok=True)

    transcriptions = {}
    if TRANSCRIPTIONS_PATH.exists():
        transcriptions = json.loads(TRANSCRIPTIONS_PATH.read_text())

    for i, (cat, fname, text) in enumerate(CLIPS):
        m4a = cat_dir / f"{fname}.m4a"
        clean = strip_tags(text)
        print(f"  [{i+1}/{len(CLIPS)}] {fname}: {clean[:60]}...")

        audio = client.text_to_speech.convert(
            text=text, voice_id=VOICE_ID, model_id=MODEL_ID,
            output_format=OUTPUT_FORMAT, voice_settings=VOICE_SETTINGS,
        )
        raw = b"".join(audio)

        wav_path = cat_dir / f"{fname}.wav"
        with wave.open(str(wav_path), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes(raw)

        subprocess.run(["ffmpeg", "-i", str(wav_path), "-c:a", "aac", "-b:a", "128k",
                        "-ar", "24000", "-ac", "1", "-y", str(m4a)],
                       capture_output=True, check=True)
        wav_path.unlink()
        size_kb = m4a.stat().st_size / 1024
        print(f"    OK ({size_kb:.0f} KB)")

        transcriptions[f"{cat}/{fname}.m4a"] = clean
        time.sleep(0.4)

    TRANSCRIPTIONS_PATH.write_text(json.dumps(transcriptions, indent=2, sort_keys=True))
    print(f"\n  Done: {len(CLIPS)} clips. Transcriptions updated.")

if __name__ == "__main__":
    main()
