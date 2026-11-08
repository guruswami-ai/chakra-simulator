#!/usr/bin/env python3
"""
Generate Guruswami onboarding voice clips with ElevenLabs v3 emotion tags.
Tier 1: Onboarding + key error/achievement/encouragement clips.

Usage:
    python scripts/generate_onboarding_v3.py --dry-run     # Preview what will be generated
    python scripts/generate_onboarding_v3.py                # Generate all clips
    python scripts/generate_onboarding_v3.py --category onboarding  # Single category
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────
VOICE_ID = "1wuPdpXI8zr7v8YJnrpV"
MODEL_ID = "eleven_v3"
OUTPUT_FORMAT = "pcm_24000"
VOICE_SETTINGS = {
    "stability": 0.45,          # Slightly more creative for emotion
    "similarity_boost": 0.75,
    "style": 0.4,              # More expressiveness for v3 tags
}

VOICE_DIR = Path(__file__).parent.parent / "public" / "guruswami" / "voice"
TRANSCRIPTIONS_PATH = Path(__file__).parent.parent / "public" / "guruswami" / "voice-transcriptions.json"

# Load API key
_env_path = Path(__file__).parent.parent.parent / "services" / "dashboard" / "scripts" / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

API_KEY = os.environ.get("ELEVENLABS_API_KEY")

# ── Clips to Generate ────────────────────────────────────────────
# (category, filename, tagged_text)
# Tags are for ElevenLabs v3 — stripped for transcription metadata.

CLIPS = [
    # ═══════════════════════════════════════════════════════════════
    # ONBOARDING — the full tutorial narration
    # ═══════════════════════════════════════════════════════════════
    ("onboarding", "gs_onboard_greeting_001",
     "[warmly] Hi! I'm Guruswami. [pause] I live right here on this cluster — [impressed] these five computers you can see around me. This is my home."),

    ("onboarding", "gs_onboard_help_001",
     "[earnestly] I need your help with something. Each of these machines has half a terabyte of memory — [impressed] half a terabyte! [gasp] That's a lot. [pause] Together they can run some incredibly powerful models. [hopefully] But someone needs to pick the right settings, and that someone [pause] is you."),

    ("onboarding", "gs_onboard_role_001",
     "[warmly] I'll be right here in the middle if you need me. You're in charge — [reassuringly] I'll speak up if something goes wrong. [playfully] And trust me, things will go wrong. [laughs] That's half the fun."),

    ("onboarding", "gs_onboard_controls_001",
     "[calmly] OK, these are our controls. Five models, a few settings to play with. [reassuringly] Nothing scary. [pause] [excited] Let's just jump in."),

    ("onboarding", "gs_onboard_pick_model_v2_001",
     "[warmly] First up — click on Qwen 32 B. [pause] It's a good one to start with. [impressed] Thirty-two billion parameters — not too big, not too small."),

    ("onboarding", "gs_onboard_pick_quant_v2_001",
     "Now pick Q4. [pause] This is how compressed the model is. [approvingly] Q4 keeps it smart but small enough to be fast."),

    ("onboarding", "gs_onboard_pick_context_001",
     "Set the context to 1 K. [pause] Think of this as how much I can hold in my head at once [playfully] during a conversation."),

    ("onboarding", "gs_onboard_pick_topology_v2_001",
     "[excited] Now for the fun part — click E P 1. [pause] This loads everything onto just one computer. Simple."),

    ("onboarding", "gs_onboard_loading_v2_001",
     "[excited] Yes! [gasp] It's alive! [laughs] The model is loaded and running. [impressed] Look at that."),

    ("onboarding", "gs_onboard_tour_tps_v2_001",
     "[warmly] See this number? [pause] That's speed — how many words per second the model can produce. [seriously] Higher is faster. [emphatically] Much better."),

    ("onboarding", "gs_onboard_tour_ttft_v2_001",
     "And this one is the wait time — how long before it starts talking back. [seriously] We want this tiny. [playfully] Nobody likes waiting."),

    ("onboarding", "gs_onboard_tour_layers_v2_001",
     "[calmly] This shows how the model is spread across the computers. Right now [pause] it's all on one."),

    ("onboarding", "gs_onboard_tour_memory_v2_001",
     "And this is memory — how full each computer is. The model has to fit, [pause] plus room for that context window we set. [sighs] It gets tight."),

    ("onboarding", "gs_onboard_try_break_001",
     "[playfully] OK — let's break something. [pause] On purpose. [mischievously] Click T P 5 and watch what happens."),

    ("onboarding", "gs_onboard_explain_break_001",
     "[concerned] Ouch. [pause] The model can't split evenly across five computers, so everything just... [sighs] crashes. [pause] [warmly] Not every configuration works. [playfully] Good to know, right?"),

    ("onboarding", "gs_onboard_try_ep5_001",
     "[reassuringly] Don't worry — click E P 5. [pause] That'll fix it."),

    ("onboarding", "gs_onboard_explain_ep5_001",
     "[excited] There we go! Now each computer is running its own copy. [impressed] Look at the speed — five times faster! [happily] That's more like it."),

    ("onboarding", "gs_onboard_freeplay_001",
     "[warmly] That's the basics. Now it's your turn. [pause] Try different settings. [playfully] Some will crash, some will fly. [reassuringly] I'll let you know either way."),

    ("onboarding", "gs_onboard_complete_v2_001",
     "[proudly] You're a natural. [pause] [warmly] I made you a track to celebrate — you've earned it. [excited] Go explore the other models when you're ready."),

    # ═══════════════════════════════════════════════════════════════
    # ERRORS — dramatic moments, need genuine emotion
    # ═══════════════════════════════════════════════════════════════
    ("error", "gs_error_oom_v2_001",
     "[concerned] Oh no. [pause] The model is too big for this setup. [sighs] We need more nodes or a smaller model."),
    ("error", "gs_error_oom_v2_002",
     "[worried] That's not going to fit. [pause] [reassuringly] Try spreading it across more computers, or drop down a quantisation level."),
    ("error", "gs_error_oom_v2_003",
     "[gasp] Out of memory! [pause] [calmly] Don't panic. There's always a configuration that works — we just need to find it."),
    ("error", "gs_error_oom_v2_004",
     "[concerned] [sighs] Too much model, not enough memory. [pause] [warmly] It happens. Try Q4 or spread across more nodes."),
    ("error", "gs_error_oom_v2_005",
     "[worried] The memory is full and we haven't even started. [pause] [reassuringly] Drop the quantisation or add more computers to the mix."),

    ("error", "gs_error_shard_v2_001",
     "[frustrated] The math doesn't work out. [pause] The model's attention heads won't divide evenly across that many nodes. [reassuringly] Try a different number."),
    ("error", "gs_error_shard_v2_002",
     "[concerned] Shard error. [pause] [warmly] Think of it like splitting a pizza — some cuts just don't work evenly. [pause] Try two or four nodes instead."),
    ("error", "gs_error_shard_v2_003",
     "[sighs] It can't split like that. [pause] The heads need to divide cleanly. [reassuringly] Two or four usually work."),

    ("error", "gs_error_timeout_v2_001",
     "[worried] The GPU timed out. [sighs] Pipeline parallel needs each stage to finish fast enough. [pause] [helpfully] Tensor parallel might work better here."),
    ("error", "gs_error_timeout_v2_002",
     "[concerned] Metal timed out. [pause] The pipeline is just too slow for this model. [warmly] Try tensor parallel — it processes in parallel instead of stages."),

    ("error", "gs_error_context_v2_001",
     "[concerned] That context window is too large for this model. [pause] [reassuringly] Bring it down and we should be fine."),
    ("error", "gs_error_context_v2_002",
     "[worried] We're asking it to remember too much. [sighs] The model can't handle that context length. [warmly] Try something smaller."),

    ("error", "gs_error_rdma_v2_001",
     "[nervous] The RDMA mesh is unstable with five nodes. [pause] [sighs] Thunderbolt 5 mesh gets unreliable at this scale. [reassuringly] Try four nodes instead."),

    # ═══════════════════════════════════════════════════════════════
    # ACHIEVEMENTS — reward moments, burst with pride
    # ═══════════════════════════════════════════════════════════════
    ("achievement", "gs_achieve_big_model_v2_001",
     "[gasp] [excited] You deployed a model over four hundred billion parameters! [laughs] [impressed] This is what the cluster was built for!"),
    ("achievement", "gs_achieve_big_model_v2_002",
     "[impressed] [slows down] Over four hundred billion parameters. Alive. Running. [pause] [proudly] You did that."),
    ("achievement", "gs_achieve_all_models_v2_001",
     "[proudly] You've tried all five models! [pause] Dense, mixture of experts, different attention types — [impressed] you've seen the full range. [laughs] Not bad at all."),
    ("achievement", "gs_achieve_all_topos_v2_001",
     "[excited] Every topology! Single, tensor parallel, pipeline, embarrassingly parallel — [impressed] you've mapped the whole space. [proudly] I'm genuinely impressed."),
    ("achievement", "gs_achieve_first_load_001",
     "[excited] Your first model! [laughs] [warmly] This is just the beginning. Wait until you see what happens when we push the settings."),
    ("achievement", "gs_achieve_max_tps_001",
     "[excited][shouts] Look at that throughput! [laughs] [impressed] That might be the fastest we've ever gone. [proudly] Beautiful."),
    ("achievement", "gs_achieve_recovered_001",
     "[relieved] [happily] We're back! [pause] [warmly] The cluster recovered. [playfully] Crisis averted."),

    # ═══════════════════════════════════════════════════════════════
    # ENCOURAGEMENT — micro-feedback with genuine emotion
    # ═══════════════════════════════════════════════════════════════
    ("encouragement", "gs_encouragement_brilliant_v2_001",
     "[excited] Brilliant!"),
    ("encouragement", "gs_encouragement_brilliant_v2_002",
     "[impressed] Brilliant! [laughs]"),
    ("encouragement", "gs_encouragement_yes_001",
     "[happily] Yes! That's it!"),
    ("encouragement", "gs_encouragement_yes_002",
     "[excited] Yes! [laughs] Perfect!"),
    ("encouragement", "gs_encouragement_perfect_001",
     "[warmly] Perfect choice."),
    ("encouragement", "gs_encouragement_perfect_002",
     "[impressed] Perfect. Exactly right."),
    ("encouragement", "gs_encouragement_awesome_v2_001",
     "[excited] Could you be any more awesome? [laughs]"),
    ("encouragement", "gs_encouragement_engineer_001",
     "[impressed] Now you're thinking like an engineer."),
    ("encouragement", "gs_encouragement_absolutely_v2_001",
     "[happily] Absolutely!"),
    ("encouragement", "gs_encouragement_absolutely_v2_002",
     "[proudly] Absolutely! That's exactly right."),
    ("encouragement", "gs_encouragement_nice_001",
     "[warmly] Nice. [pause] Very nice."),
    ("encouragement", "gs_encouragement_smart_001",
     "[impressed] Smart move. That's a good configuration."),
    ("encouragement", "gs_encouragement_wow_001",
     "[gasp] [excited] Wow! Look at those numbers!"),
    ("encouragement", "gs_encouragement_getting_it_001",
     "[warmly] You're getting the hang of this. [happily] I can tell."),

    # ═══════════════════════════════════════════════════════════════
    # MODEL GREETINGS — v2 with emotion (one per model to test)
    # ═══════════════════════════════════════════════════════════════
    # ═══════════════════════════════════════════════════════════════
    # ONBOARDING VARIANTS — _002 and _003 for each step
    # ═══════════════════════════════════════════════════════════════
    ("onboarding", "gs_onboard_greeting_002",
     "[excited] Hey there! Guruswami here. [pause] Welcome to my cluster — [impressed] five computers, all mine. [playfully] Well, ours now."),
    ("onboarding", "gs_onboard_greeting_003",
     "[warmly] Oh! Someone new. [pause] I'm Guruswami. [impressed] See these five machines around me? That's the Chakra cluster. I live here."),

    ("onboarding", "gs_onboard_help_002",
     "[warmly] Here's the thing — these machines are powerful. [impressed] Half a terabyte of memory each. [pause] But raw power means nothing without the right configuration. [hopefully] That's where you come in."),
    ("onboarding", "gs_onboard_help_003",
     "[impressed] Each of these computers has more memory than most people's entire setup. [gasp] Half a terabyte. [pause] [warmly] But I can't configure them myself — I need someone with good instincts. [hopefully] Interested?"),

    ("onboarding", "gs_onboard_role_002",
     "[playfully] You drive, I'll navigate. [pause] If you're about to crash into something, [laughs] I'll shout. Probably."),
    ("onboarding", "gs_onboard_role_003",
     "[warmly] I'll hang out here in the middle and keep an eye on things. [pause] You make the decisions — [reassuringly] I'll tell you how they went. Fair?"),

    ("onboarding", "gs_onboard_controls_002",
     "[warmly] Right — here's what we're working with. Models, settings, topologies. [reassuringly] Sounds complicated but it's really not. Let me show you."),
    ("onboarding", "gs_onboard_controls_003",
     "[calmly] These are the controls. [reassuringly] Don't worry about what everything does yet. [warmly] We'll go through it step by step."),

    ("onboarding", "gs_onboard_pick_model_v2_002",
     "[warmly] Let's start with Qwen 32 B — click on it. [pause] It's the friendliest model we've got. [impressed] Big enough to be smart, small enough to be fast."),
    ("onboarding", "gs_onboard_pick_model_v2_003",
     "[calmly] Click Qwen 32 B. [pause] Thirty-two billion parameters. [reassuringly] Don't let the number scare you — it's actually one of the smaller ones."),

    ("onboarding", "gs_onboard_pick_quant_v2_002",
     "[warmly] Next — click Q4. [pause] Think of this like image quality. [approvingly] Q4 is high quality without being wasteful."),
    ("onboarding", "gs_onboard_pick_quant_v2_003",
     "[calmly] Hit Q4. [pause] This controls how tightly we pack the model into memory. [approvingly] Q4 gives us the best trade-off."),

    ("onboarding", "gs_onboard_pick_context_002",
     "[warmly] Click 1 K for context. [pause] This is the model's short-term memory — how much of the conversation it can see at once."),
    ("onboarding", "gs_onboard_pick_context_003",
     "[calmly] Tap 1 K. [pause] That's the conversation window. [reassuringly] Small for now — we can always make it bigger later."),

    ("onboarding", "gs_onboard_pick_topology_v2_002",
     "[warmly] Almost there — click E P 1. [pause] This puts the whole model on a single machine. The simplest setup."),
    ("onboarding", "gs_onboard_pick_topology_v2_003",
     "[excited] Last setting — E P 1. [pause] One computer, one model, no splitting. [playfully] Click it and let's see what happens."),

    ("onboarding", "gs_onboard_loading_v2_002",
     "[excited] There we go — first model loaded! [pause] [warmly] Let me walk you through what you're looking at."),
    ("onboarding", "gs_onboard_loading_v2_003",
     "[impressed] Look at that! The cluster is running. [pause] [warmly] Before you start clicking things, let me point out a few numbers that matter."),

    ("onboarding", "gs_onboard_tour_tps_v2_002",
     "[warmly] That gauge is your speedometer. Tokens per second. [pause] [seriously] The higher the number, the faster the model talks back. [impressed] This is the number we're always trying to push up."),
    ("onboarding", "gs_onboard_tour_tps_v2_003",
     "[seriously] First number to watch — tokens per second on that gauge. [pause] That's your speed. [warmly] Everything we do from here is about making that number bigger."),

    ("onboarding", "gs_onboard_tour_ttft_v2_002",
     "[warmly] Next number — time to first token. [pause] That's the awkward silence before the model starts talking. [seriously] Smaller is better. [emphatically] Much smaller."),
    ("onboarding", "gs_onboard_tour_ttft_v2_003",
     "[calmly] See the number underneath? That's the wait time. [pause] How long before the first word comes out. [impressed] Fast models start talking almost instantly."),

    ("onboarding", "gs_onboard_tour_layers_v2_002",
     "[warmly] See how all the layers are stacked on one computer? [pause] That's because we used E P 1. [calmly] When we try other topologies, the layers split across nodes."),
    ("onboarding", "gs_onboard_tour_layers_v2_003",
     "[calmly] The coloured bars on the node show the model's layers — [impressed] all sixty-four of them squeezed onto one machine. [warmly] That changes when we use different topologies."),

    ("onboarding", "gs_onboard_tour_memory_v2_002",
     "[warmly] Check the memory bar on the active node. [pause] The model weights take up most of it, and the context window adds more on top. [seriously] This is always the constraint we're fighting."),
    ("onboarding", "gs_onboard_tour_memory_v2_003",
     "[seriously] Last thing — memory. [pause] The model has to fit in memory, and so does the context. [concerned] If they don't fit, nothing works. [warmly] Keep an eye on this one."),

    ("onboarding", "gs_onboard_try_break_002",
     "[playfully] Time to crash the cluster. [pause] Intentionally. [mischievously] Click T P 5."),
    ("onboarding", "gs_onboard_try_break_003",
     "[excited] Ready to break something? [pause] Click T P 5. [playfully] I promise it'll be educational."),

    ("onboarding", "gs_onboard_explain_break_002",
     "[concerned] And there it goes. [pause] Five doesn't divide evenly into Qwen's head count, so the whole thing falls over. [seriously] This is why configuration matters."),
    ("onboarding", "gs_onboard_explain_break_003",
     "[gasp] Boom. [pause] The math didn't work and the cluster crashed. [warmly] This is actually one of the most common mistakes — picking a topology that doesn't fit the model."),

    ("onboarding", "gs_onboard_try_ep5_002",
     "[reassuringly] Easy fix — click E P 5. [pause] Instead of splitting one model, we'll run five separate copies."),
    ("onboarding", "gs_onboard_try_ep5_003",
     "[warmly] No stress — hit E P 5. [pause] [playfully] Different approach entirely. You'll see."),

    ("onboarding", "gs_onboard_explain_ep5_002",
     "[excited] Five copies, five computers, five times the speed. [pause] [impressed] This is the simplest way to scale Qwen. [warmly] Check the throughput gauge."),
    ("onboarding", "gs_onboard_explain_ep5_003",
     "[impressed] See that? Each machine runs independently now. [pause] [excited] The throughput jumped to five times what it was. [proudly] For this model, this is the best configuration."),

    ("onboarding", "gs_onboard_freeplay_002",
     "[warmly] You've got the controls. [pause] Experiment. Break things. Fix them. [playfully] That's how you learn what works."),
    ("onboarding", "gs_onboard_freeplay_003",
     "[playfully] OK, the training wheels are off. [pause] Click around, try things. [warmly] I'll be here if it all goes sideways."),

    ("onboarding", "gs_onboard_complete_v2_002",
     "[excited] Tutorial complete! [pause] [warmly] There's a whole playlist waiting as you try different models. Each one has its own sound."),
    ("onboarding", "gs_onboard_complete_v2_003",
     "[warmly] And that's it — you know the basics. [pause] [impressed] The bigger models are waiting. Each one is a different challenge. [reassuringly] I'll be here."),

    # ═══════════════════════════════════════════════════════════════
    # MODEL GREETINGS — v2 with emotion (one per model to test)
    # ═══════════════════════════════════════════════════════════════
    ("model_greeting", "gs_model_greeting_qwen_v2_001",
     "[excited] Qwen 32 B! [pause] [warmly] My favourite starting point. Thirty-two billion parameters of pure versatility. [pause] Let's see what it can do."),

    ("model_greeting", "gs_model_greeting_llama_v2_001",
     "[impressed] [slows down] Llama 405 B. [pause] Four hundred and five billion parameters. [gasp] This is a beast. [seriously] We're going to need some serious hardware for this one."),

    ("model_greeting", "gs_model_greeting_mixtral_v2_001",
     "[excited] Mixtral! [pause] Eight experts, but only two fire at once. [impressed] Like having eight musicians but only needing two to play any song. [playfully] Efficient."),

    ("model_greeting", "gs_model_greeting_deepseek_v2_001",
     "[impressed] [deliberately] DeepSeek V3. [pause] Six hundred and seventy-one billion parameters. [gasp] But only thirty-seven billion wake up for each question. [pause] [warmly] The rest stay silent. Waiting."),

    ("model_greeting", "gs_model_greeting_kimi_v2_001",
     "[gasp] [whispers] Kimi K 2.5. [pause] [impressed] One trillion parameters. [pause] [seriously] The largest model in our collection. [sighs] Even the cluster struggles with this one. [warmly] But when it works... [pause] it's something else."),
]


def strip_tags(text: str) -> str:
    """Remove ElevenLabs audio tags for transcription metadata."""
    return re.sub(r'\[.*?\]\s*', '', text).strip()


def generate_clip(client, text: str) -> bytes:
    """Generate audio via ElevenLabs v3."""
    audio = client.text_to_speech.convert(
        text=text,
        voice_id=VOICE_ID,
        model_id=MODEL_ID,
        output_format=OUTPUT_FORMAT,
        voice_settings=VOICE_SETTINGS,
    )
    return b"".join(audio)


def save_wav(audio_bytes: bytes, path: Path):
    """Save raw PCM as WAV."""
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(audio_bytes)


def convert_to_m4a(wav_path: Path, m4a_path: Path) -> bool:
    """WAV → M4A (AAC 128k)."""
    try:
        subprocess.run(
            ["ffmpeg", "-i", str(wav_path), "-c:a", "aac", "-b:a", "128k",
             "-ar", "24000", "-ac", "1", "-y", str(m4a_path)],
            capture_output=True, check=True,
        )
        wav_path.unlink()
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"  ! ffmpeg failed: {e}")
        return False


def update_transcriptions(new_entries: dict[str, str]):
    """Merge new transcriptions into voice-transcriptions.json."""
    existing = {}
    if TRANSCRIPTIONS_PATH.exists():
        existing = json.loads(TRANSCRIPTIONS_PATH.read_text())
    existing.update(new_entries)
    TRANSCRIPTIONS_PATH.write_text(json.dumps(existing, indent=2, sort_keys=True))
    print(f"\n  Updated {TRANSCRIPTIONS_PATH.name} ({len(new_entries)} entries)")


def main():
    parser = argparse.ArgumentParser(description="Generate Guruswami v3 voice clips")
    parser.add_argument("--dry-run", action="store_true", help="Preview without generating")
    parser.add_argument("--category", type=str, help="Only generate this category")
    args = parser.parse_args()

    clips = CLIPS
    if args.category:
        clips = [(c, f, t) for c, f, t in clips if c == args.category]

    print(f"\n  Guruswami v3 Voice Generation")
    print(f"  Clips: {len(clips)}")
    print(f"  Model: {MODEL_ID}")
    print(f"  Voice: {VOICE_ID}")
    print(f"  Output: {VOICE_DIR}\n")

    if args.dry_run:
        for cat, fname, text in clips:
            clean = strip_tags(text)
            m4a = VOICE_DIR / cat / f"{fname}.m4a"
            exists = "EXISTS" if m4a.exists() else "NEW"
            print(f"  [{exists}] {cat}/{fname}.m4a")
            print(f"    Tags: {text[:100]}...")
            print(f"    Text: {clean[:100]}...")
            print()
        print(f"  Total: {len(clips)} clips")
        est_chars = sum(len(strip_tags(t)) for _, _, t in clips)
        print(f"  Est. characters: {est_chars:,}")
        return

    if not API_KEY:
        print("  ERROR: ELEVENLABS_API_KEY not set")
        sys.exit(1)

    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=API_KEY)

    transcription_updates = {}
    generated = 0
    failed = 0

    for i, (cat, fname, text) in enumerate(clips):
        cat_dir = VOICE_DIR / cat
        cat_dir.mkdir(parents=True, exist_ok=True)
        m4a_path = cat_dir / f"{fname}.m4a"

        clean_text = strip_tags(text)
        print(f"  [{i+1}/{len(clips)}] {cat}/{fname}.m4a")
        print(f"    {clean_text[:80]}...")

        try:
            audio_bytes = generate_clip(client, text)
            wav_path = cat_dir / f"{fname}.wav"
            save_wav(audio_bytes, wav_path)

            if convert_to_m4a(wav_path, m4a_path):
                size_kb = m4a_path.stat().st_size / 1024
                print(f"    OK ({size_kb:.0f} KB)")
                generated += 1
                # Add transcription keyed by relative path
                rel_key = f"{cat}/{fname}.m4a"
                transcription_updates[rel_key] = clean_text
            else:
                failed += 1

        except Exception as e:
            print(f"    FAILED: {e}")
            failed += 1

        # Rate limit: ~3 requests/sec for v3
        time.sleep(0.4)

    print(f"\n  Done: {generated} generated, {failed} failed")

    if transcription_updates:
        update_transcriptions(transcription_updates)


if __name__ == "__main__":
    main()
