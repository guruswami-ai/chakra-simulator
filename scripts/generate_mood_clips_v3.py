#!/usr/bin/env python3
"""Generate mood/reaction voice clips to fill thin categories — ElevenLabs v3."""

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
    # ═══════════════════════════════════════════════════════════════
    # TPS MOOD — reactions to throughput speed
    # ═══════════════════════════════════════════════════════════════
    ("tps_mood_ludicrous", "gs_tps_mood_ludicrous_003",
     "[excited][shouts] Look at that number! [laughs] We're absolutely flying!"),
    ("tps_mood_ludicrous", "gs_tps_mood_ludicrous_004",
     "[gasp] [excited] Over a hundred tokens a second! [laughs] The mesh can barely keep up!"),

    ("tps_mood_energised", "gs_tps_mood_energised_004",
     "[excited] The throughput is climbing. [impressed] This configuration really works."),
    ("tps_mood_energised", "gs_tps_mood_energised_005",
     "[happily] Fast! [pause] Really fast. [impressed] The nodes are earning their keep."),

    ("tps_mood_moderate", "gs_tps_mood_moderate_002",
     "[calmly] Steady cruising speed. [pause] Not record-breaking, but reliable."),
    ("tps_mood_moderate", "gs_tps_mood_moderate_003",
     "[warmly] A comfortable pace. Good enough for most tasks."),
    ("tps_mood_moderate", "gs_tps_mood_moderate_004",
     "[thoughtfully] Middle of the road on throughput. [pause] We could push it higher with a different topology."),

    ("tps_mood_steady", "gs_tps_mood_steady_004",
     "[calmly] Ticking along. Steady and predictable. [pause] Sometimes that's exactly what you need."),
    ("tps_mood_steady", "gs_tps_mood_steady_005",
     "[warmly] Not the fastest, but it hasn't missed a beat."),

    # ═══════════════════════════════════════════════════════════════
    # TTFT MOOD — reactions to first-token latency
    # ═══════════════════════════════════════════════════════════════
    ("ttft_mood_fast", "gs_ttft_mood_fast_003",
     "[excited] Almost instant! [pause] The prefill barely took a moment."),
    ("ttft_mood_fast", "gs_ttft_mood_fast_004",
     "[impressed] First token in under a second. [pause] That's snappy."),

    ("ttft_mood_slow", "gs_ttft_mood_slow_003",
     "[concerned] That first token is taking a while. [pause] [reassuringly] Long context or big model — it needs time to think."),
    ("ttft_mood_slow", "gs_ttft_mood_slow_004",
     "[thoughtfully] Slow to start. [pause] The prefill has a lot of layers to process. [warmly] It'll get there."),

    # ═══════════════════════════════════════════════════════════════
    # TOPOLOGY MOOD — reactions to topology choice
    # ═══════════════════════════════════════════════════════════════
    ("topo_mood_single", "gs_topo_mood_single_003",
     "[warmly] One node doing all the work. [pause] Simple and clean. No network overhead."),
    ("topo_mood_single", "gs_topo_mood_single_004",
     "[calmly] Solo mode. If the model fits, this is always the fastest option."),

    ("topo_mood_tp2", "gs_topo_mood_tp2_002",
     "[warmly] Two nodes sharing the load. [pause] Halves the memory, keeps things fast."),
    ("topo_mood_tp2", "gs_topo_mood_tp2_003",
     "[impressed] Tensor parallel across two. [pause] Clean split — each node handles half the attention heads."),
    ("topo_mood_tp2", "gs_topo_mood_tp2_004",
     "[calmly] T P 2 is a good balance. Not too complex, big memory saving."),

    ("topo_mood_tp4", "gs_topo_mood_tp4_004",
     "[impressed] Four nodes in a full mesh. [pause] The Thunderbolt fabric is working hard on this one."),
    ("topo_mood_tp4", "gs_topo_mood_tp4_005",
     "[warmly] T P 4 — the go-to for big models. [pause] Quarter the memory per node."),

    ("topo_mood_pp", "gs_topo_mood_pp_003",
     "[thoughtfully] Pipeline parallel. [pause] Each stage processes its layers, then passes the baton."),
    ("topo_mood_pp", "gs_topo_mood_pp_004",
     "[calmly] Sequential processing. [pause] [concerned] Watch the time to first token — pipelines add latency."),

    # ═══════════════════════════════════════════════════════════════
    # QUANTIZATION MOOD — reactions to quant level
    # ═══════════════════════════════════════════════════════════════
    ("quant_mood_fp16", "gs_quant_mood_fp16_003",
     "[impressed] Full precision. [pause] Every weight at its true value. [concerned] But the memory cost is enormous."),
    ("quant_mood_fp16", "gs_quant_mood_fp16_004",
     "[warmly] F P 16 — maximum fidelity. [pause] [thoughtfully] The question is whether you have the memory for it."),

    ("quant_mood_q2", "gs_quant_mood_q2_003",
     "[concerned] Q2. [pause] [sighs] The speed is incredible but the output will be... questionable."),
    ("quant_mood_q2", "gs_quant_mood_q2_004",
     "[playfully] Two bits per weight. [pause] It's like photocopying a photocopy of a photocopy. [laughs] Fast though."),

    # ═══════════════════════════════════════════════════════════════
    # RECOVERY — cluster comes back online
    # ═══════════════════════════════════════════════════════════════
    ("recovery", "gs_recovery_v2_001",
     "[relieved] [happily] We're back! [pause] [warmly] The configuration works."),
    ("recovery", "gs_recovery_v2_002",
     "[excited] There it is! [pause] [warmly] Running again. [impressed] Look at those numbers come alive."),
    ("recovery", "gs_recovery_v2_003",
     "[relieved] Crisis averted. [pause] [playfully] See? There's always a way."),

    # ═══════════════════════════════════════════════════════════════
    # MODEL FAREWELL — when guru disappears during model switch
    # ═══════════════════════════════════════════════════════════════
    ("model_farewell", "gs_farewell_switch_001",
     "[warmly] Switching models. [pause] Be right back."),
    ("model_farewell", "gs_farewell_switch_002",
     "[calmly] One moment — loading a new model."),
    ("model_farewell", "gs_farewell_switch_003",
     "[playfully] Out with the old, in with the new. [pause] Hang on."),
]

def strip_tags(text):
    return re.sub(r'\[.*?\]\s*', '', text).strip()

def main():
    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

    transcriptions = {}
    if TRANSCRIPTIONS_PATH.exists():
        transcriptions = json.loads(TRANSCRIPTIONS_PATH.read_text())

    generated = 0
    for i, (cat, fname, text) in enumerate(CLIPS):
        cat_dir = VOICE_DIR / cat
        cat_dir.mkdir(parents=True, exist_ok=True)
        m4a = cat_dir / f"{fname}.m4a"
        clean = strip_tags(text)
        print(f"  [{i+1}/{len(CLIPS)}] {cat}/{fname}: {clean[:60]}...")

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
        generated += 1
        time.sleep(0.4)

    TRANSCRIPTIONS_PATH.write_text(json.dumps(transcriptions, indent=2, sort_keys=True))
    print(f"\n  Done: {generated} clips. Transcriptions updated.")

if __name__ == "__main__":
    main()
