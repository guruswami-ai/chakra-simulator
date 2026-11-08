# Audio Design — Chakra Cluster Simulator

## Overview

The simulator has three audio layers that play simultaneously. Each has a distinct role, encoding format, and loudness target. All processing uses ffmpeg with EBU R128 loudness normalisation.

## Audio Layers

| Layer | Role | LUFS | Channels | Sample Rate | Bitrate | Format |
|-------|------|------|----------|-------------|---------|--------|
| **Music** | Featured — the star when guru isn't talking | -14 | Stereo | 44.1kHz | 192kbps AAC | .m4a |
| **Speech** | Guru voice — ducks music when playing | -14 | Mono | 24kHz | 104kbps AAC | .m4a |
| **SFX** | Button clicks, gongs, transitions — sits just under music | -15 | Mono | 24kHz | 64kbps AAC | .m4a |

### Why these levels?

- **Music at -14 LUFS**: Loud enough to be a feature, not background wallpaper. The tier-specific tracks (synthwave, hip-hop, EDM, Chinese fusion, space ambient) are a core part of the experience.
- **Speech at -14 LUFS**: Same base level as music. Doesn't need to be louder because music **ducks to 35% volume** when guru talks. The ducking mechanism provides separation.
- **SFX at -15 LUFS**: 1 dB below music. Audible alongside playing tracks (users click buttons constantly while music plays) but never dominating.

### Code volume multipliers (on top of file levels)

| Source | Volume | Ducked |
|--------|--------|--------|
| Music (main) | 0.35 | 0.12 (35% of main) |
| Guru speech | 0.35 | — |
| SFX | 0.25 | — |

The combination of normalised files + code multipliers gives the final mix.

## Processing Pipeline

### New audio files

Run the normalisation script after adding any new audio:

```bash
bash scripts/normalize_audio.sh
```

This processes all files in `public/guruswami/music/`, `voice/`, and `sfx/`.

### Single file processing

```bash
# Music (stereo, high quality)
ffmpeg -i input.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -c:a aac -b:a 192k -ar 44100 -ac 2 -y output.m4a

# Speech (mono, voice-optimised)
ffmpeg -i input.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -c:a aac -b:a 104k -ar 24000 -ac 1 -y output.m4a

# SFX (mono, compressed)
ffmpeg -i input.wav -af "loudnorm=I=-15:TP=-1.5:LRA=11" \
  -c:a aac -b:a 64k -ar 24000 -ac 1 -y output.m4a
```

### Parameters explained

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `loudnorm=I=-14` | Integrated loudness target | EBU R128 standard — consistent perceived volume |
| `TP=-1.5` | True peak ceiling | Prevents clipping on all DACs. -1.5 dB headroom is web standard |
| `LRA=11` | Loudness range | How much dynamic variation is allowed. 11 LU keeps music lively |
| `-c:a aac` | AAC codec | Universal browser support, good compression |
| `-b:a 192k` | Bitrate (music) | High enough for stereo music quality |
| `-b:a 104k` | Bitrate (speech) | Sufficient for clear voice at mono 24kHz |
| `-b:a 64k` | Bitrate (SFX) | Short sounds don't need high bitrate |
| `-ar 44100` | Sample rate (music) | CD quality — preserves high frequencies in music |
| `-ar 24000` | Sample rate (speech/SFX) | Voice doesn't benefit from >24kHz. Saves bandwidth |
| `-ac 2` | Stereo (music) | Spatial audio, stereo mix as intended |
| `-ac 1` | Mono (speech/SFX) | Voice and clicks don't need stereo |

## Additional Quality Tricks

### For music

**High-pass filter** — Remove sub-bass rumble below 30Hz that wastes bitrate and causes speaker distortion on laptops/phones:
```bash
ffmpeg -i input.wav -af "highpass=f=30,loudnorm=I=-14:TP=-1.5:LRA=11" \
  -c:a aac -b:a 192k -ar 44100 -ac 2 -y output.m4a
```

**Limiter** — For tracks with extreme transients (EDM, trap) that clip after normalisation:
```bash
-af "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.95:attack=0.5:release=50"
```

### For speech (ElevenLabs v3 clips)

**De-ess** — ElevenLabs v3 can produce harsh sibilants. A gentle de-esser smooths them:
```bash
-af "equalizer=f=6500:t=q:w=2:g=-3,loudnorm=I=-14:TP=-1.5:LRA=11"
```

**Noise gate** — Remove low-level background noise between words:
```bash
-af "agate=threshold=0.01:ratio=3:attack=5:release=50,loudnorm=I=-14:TP=-1.5:LRA=11"
```

**Compression** — Make quiet parts louder and loud parts quieter for more consistent delivery:
```bash
-af "acompressor=threshold=-20dB:ratio=3:attack=5:release=100,loudnorm=I=-14:TP=-1.5:LRA=11"
```

### For SFX

**Trim silence** — SFX files often have trailing silence. Remove it to reduce file size and latency:
```bash
ffmpeg -i input.wav -af "silenceremove=stop_periods=-1:stop_duration=0.1:stop_threshold=-50dB,loudnorm=I=-15:TP=-1.5:LRA=11" \
  -c:a aac -b:a 64k -ar 24000 -ac 1 -y output.m4a
```

**Fade out** — Prevent hard cuts on short SFX:
```bash
-af "afade=t=out:st=3.5:d=0.5,loudnorm=I=-15:TP=-1.5:LRA=11"
```

## ElevenLabs v3 Voice Generation

### Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| Voice ID | `1wuPdpXI8zr7v8YJnrpV` | Guruswami custom voice |
| Model | `eleven_v3` | Required for audio tag support |
| Output format | `pcm_24000` | 24kHz 16-bit PCM (raw, we encode ourselves) |
| Stability | 0.45 | Slightly creative for emotional variation |
| Similarity boost | 0.75 | High consistency with source voice |
| Style | 0.4 | Moderate expressiveness for v3 tags |

### Post-processing pipeline

1. Generate PCM from ElevenLabs API
2. Save as WAV (24kHz, 16-bit, mono)
3. Convert to M4A: `ffmpeg -i input.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 104k -ar 24000 -ac 1 -y output.m4a`
4. Update `voice-transcriptions.json` with the clean (tag-stripped) text
5. Regenerate `voice-library.json` from disk scan

### Audio tags reference

```
[excited] [warmly] [concerned] [impressed] [playfully] [seriously]
[laughs] [sighs] [gasp] [pause] [whispers] [shouts]
[reassuringly] [nervously] [proudly] [deliberately] [helpfully]
```

Combine: `[excited][shouts] Look at that number! [laughs]`

## File Inventory

| Location | Files | Size (approx) |
|----------|-------|---------------|
| `public/guruswami/music/` | ~200 tracks | ~400MB |
| `public/guruswami/voice/` | ~1,090 clips (72 categories) | ~120MB |
| `public/guruswami/sfx/` | ~60 effects | ~5MB |
| Total | ~1,350 files | ~525MB |

## Music Ducking

When the guru speaks, music volume drops to 35% over a quick ramp. When he stops, it ramps back up. This is handled by `useBackgroundMusic.ts` via the `setDucking` callback, driven by the audio element's `play`/`pause`/`ended` events (not the `isSpeaking` state flag, which lingers 30s for text display).

## OOM Mute

When the cluster crashes (infeasible config), music is muted with a record scratch SFX. When the config becomes feasible again, music resumes from the same position with a 1.5s fade-in and a model loading chime.
