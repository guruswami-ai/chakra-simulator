# Sonic Pedagogy & Audio System Design

> **Status**: Living specification — describes the implemented audio system.
> **Source of truth**: `hooks/useBackgroundMusic.ts`, `hooks/useGuruswamiState.ts`
> **Last verified**: 2026-02-20

This document covers the complete audio architecture: background music, speech, stingers,
rewards, tempo modulation, ducking, and how they interact with the pedagogical curriculum.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Two-Phase Music System](#2-two-phase-music-system)
3. [Model Sonic Identities](#3-model-sonic-identities)
4. [Track Inventory](#4-track-inventory)
5. [Lyrics & Architecture Mapping](#5-lyrics--architecture-mapping)
6. [Tempo Modulation (TPS-Driven)](#6-tempo-modulation-tps-driven)
7. [Crossfade Behaviour](#7-crossfade-behaviour)
8. [Speech Ducking](#8-speech-ducking)
9. [Stinger System](#9-stinger-system)
10. [Reward Tracks](#10-reward-tracks)
11. [Guruswami Voice & Commentary](#11-guruswami-voice--commentary)
12. [Avatar State Machine](#12-avatar-state-machine)
13. [Audio Pipeline Architecture](#13-audio-pipeline-architecture)
14. [Verification Checklist](#14-verification-checklist)

---

## 1. Design Philosophy

### Split-Attention Prevention (Dual-Coding Theory)

Audio and dense visual data **never compete for analytical attention simultaneously**.
The audio system carries two distinct information channels:

| Channel | Carries | Processing Load |
|---------|---------|-----------------|
| **Music** | Emotional state (excitement, tension, triumph, calm) | Low — ambient, subliminal |
| **Speech** | Educational content (explanations, commentary, prompts) | High — requires active listening |

**Rule**: Guruswami speaks during transitions and low-cognitive moments (model loading, topology
changes), never during active data analysis. Music ducks when speech plays, ensuring the voice
channel is always dominant when active.

### Sonic Identity as Pedagogical Anchor

Each model tier has a distinct genre that acoustically represents its architecture:

- When a learner hears DnB kick in, they know Mixtral's sparse routing is active
- When ambient pads swell, they know they're working at trillion-parameter scale
- Genre transitions on model switch create **auditory landmarks** in the learning journey

### Novelty Expiration

Gamification (reward tracks, stingers, celebrations) is concentrated in early tiers
and deliberately fades by Tier 5. By that point, the intellectual satisfaction of
mastering 1T-parameter configuration replaces sonic reward mechanics.

---

## 2. Two-Phase Music System

The hook `useBackgroundMusic` operates in two phases:

### Phase: `intro`

**When**: During onboarding (boot sequence, step-by-step tutorial)
**Pool**: ~30 ambient beds (ultra-subtle pads, voice-over backgrounds, meditation scenes)
**Tempo**: Always `playbackRate = 1.0` — **no tempo modulation during intro**
**Volume**: Main volume 0.35
**First track**: Always `deep-pads` (guaranteed warm entry point)

### Phase: `active`

**When**: After a model is deployed
**Pool**: Model-specific genre tracks (see [Model Sonic Identities](#3-model-sonic-identities))
**Tempo**: TPS-modulated between 0.97x and 1.03x (see [Tempo Modulation](#6-tempo-modulation-tps-driven))
**Volume**: Main volume 0.35
**Fallback**: If no model-specific tracks exist, uses generic `ACTIVE_LIBRARY` pool

### Phase Transition

When `setPhase('active')` is called (on deploy):

1. Current track fades out over **1200ms**
2. New pool is built from the deployed model's genre
3. Pool is shuffled
4. First track of new pool fades in over **2000ms**

---

## 3. Model Sonic Identities

Each entry in `MODEL_TRACKS` maps a model ID to curated + library track pools:

| Model ID | Genre | Personality | Track Count |
|----------|-------|-------------|-------------|
| `qwen25-32b` | Synthwave, retrowave, cyberpunk | Warm, steady, foundational — single-node simplicity | 7 background + 12 reward variants |
| `llama-405b` | 80s synthpop, disco | Heavy analog synths — mirrors 405B parameter weight | 8 |
| `mixtral-8x7b` | High-BPM EDM (DnB, dubstep, techno, glitch hop, house, cyberpunk) | Lightning-fast — sparse MoE routing at 12.9B active of 46.7B | 11 |
| `deepseek-v3` | Classical, orchestral, piano, strings, guitar | Intellectual elegance — MoE + MLA mathematical beauty | 10 |
| `kimi-k2.5` | Space ambient, cosmic meditation, binaural | Vast cosmic scale — 1T parameters, 384 experts | 15 |

**Genre rule** (from CURRICULUM_DESIGN.md):
> A track's genre must match its model's sonic identity. No EDM for DeepSeek, no ambient for Mixtral.

### Why These Genres

| Model | Architecture | Genre Logic |
|-------|-------------|-------------|
| Qwen 32B | Dense, 32B, single-node | Synthwave = warm, retro, "home base" — the simplest deployment |
| Llama 405B | Dense, 405B, must distribute | 80s Synthpop = heavy analog synths mirror the heaviest parameter count |
| Mixtral 8x7B | Sparse MoE, 46.7B total / 12.9B active | High-BPM EDM = lightning-fast beats match lightning-fast sparse routing |
| DeepSeek V3 | MoE + MLA, memory compression | Classical = Bach fugues and counterpoint reflect MLA's mathematical elegance |
| Kimi K2.5 | 1T MoE + MLA, 384 experts, 256K, vision | Space ambient = vast cosmic meditation at unprecedented scale |

---

## 4. Track Inventory

### Generation

All tracks are AI-generated via **Suno v5**, anchored to a recurring "@PaulAndYogi" theme song
that provides melodic DNA for cross-track cohesion.

**Suno v5 global parameters** (for architecture-specific tracks):
- Audio Influence: 20-40%
- Style Influence: 45-70%
- Weirdness: 45-65%

**Conversion**: WAV → M4A (AAC 192kbps, 48kHz, stereo) via ffmpeg.
620MB WAV batch → ~79MB M4A (87% compression).

### File Locations

| Location | Type | Format |
|----------|------|--------|
| `public/guruswami/music/*.m4a` | Curated tracks (hand-picked) | M4A |
| `public/guruswami/music/library/*.m4a` | Library tracks (bulk) | M4A |
| `public/guruswami/music/library/manifest.json` | Runtime discovery index | JSON array of filenames |

### Curated Tracks (in `music/` root)

| File | Used In |
|------|---------|
| `deep-pads.m4a` | Intro (always first track), Kimi K2.5 pool |
| `minimal-subtle.m4a` | Intro pool |
| `balanced.m4a` | Intro pool |
| `guru-voiceover.m4a` | Intro pool |
| `synth-theme.m4a` | Active fallback, Llama 405B pool |

### Intro Pool (~30 tracks)

| Category | Tracks | Description |
|----------|--------|-------------|
| Ultra-subtle ambient | 4 | `minimal-background-ultra-subtle` variants + piano + drones |
| Voice-over beds | 4 | `guru-voice-over-background`, `callisto-voice-over-background` + sad variant |
| Theme beds | 4 | `paulandyogi-master-theme-background-bed` variants, piano bed |
| Forest meditation | 3 | `p-y-forrest-meditation-scene` variants |
| Callisto ambient | 2 | `callisto-s-test-name_-ambient-variation` variants |
| Lo-fi hip-hop | 3 | `callisto-s-test-name_-lo-fi-hip-hop-variation` variants |
| Bossa nova | 1 | `callisto-s-test-name_-bossa-nova-variation` |
| Theme reduced | 2 | No-drums lo-fi filter, strings-only |
| Scene transitions (down) | 5 | `scene-transition-down-energy` variants |

### Active Fallback Pool (~13 tracks)

Used when no model-specific pool matches:

| Category | Tracks |
|----------|--------|
| Standard balanced | 7 | `standard-background-balanced` variants |
| Theme full | 3 | Full drums/guitars/bass, acapella, outro |
| Scene transitions (up) | 6 | `scene-transition-up-energy` variants |

### Excluded Tracks

Tracks in `EXCLUDED` set are filtered from all pools:
- `vibe_science_and_the_nexus_of_ignorance` — too large
- `guruswami-paul-and-yogi-nerdburgers-together` — too large
- `theme_full_best`, `theme_instrumental`, `theme_verse1_only` — empty placeholders

---

## 5. Lyrics & Architecture Mapping

Each model tier's tracks contain **tutorial-reinforcing lyrics** where the song text
directly teaches the architecture concept the learner is currently exploring.

### Tier 1: Qwen 32B (Synthwave)

Full lyrics in `public/guruswami/music/QWEN-32B-TRACKLIST.md`.

| Track | Trial | Key Lyric | Concept Taught |
|-------|-------|-----------|----------------|
| The Unbroken Wall | 1: First Breath | "Thirty-two billion awake at the start / No router to choose, no path to divide" | Dense architecture baseline (EP1) |
| The Razor's Edge | 2: Sharpening | "Compressing the logic, return in a flash / We lose a fraction to double the pace" | Q4 quantization tradeoff |
| The Syntax Engine | 3: Working Memory | "Eight thousand tokens to hold in the brain / No wasted memory, no heavy strain" | Context window = VRAM cost |
| The Wide Horizon | 4: Midnight Oil | "Thirty-two thousand fragments in sight / Processing batches deep in the night" | Batch mode throughput |
| The Topology Trap | 5: Illusion of Division | "They tried to split the mind in five / Whispering across the wire to survive" | Network latency destroys small models |
| The Full Saturation | 6: True Swarm (MASTERY) | "Don't split the layers, multiply the core! / Five perfect clones opening the door!" | Embarrassingly Parallel scaling |

**Mastery celebration** (The Full Saturation) includes spoken word:
> "This song is just a little over the top, for finishing a tutorial level, but you earnt it.
> You achieved one hundred percent utilization. Well done Nerdburger.
> Guruswami is proud of you. Because now you know...
> Are you ready for level two?"

12 Suno v5 variations of this track exist (v1-v12) for random celebration variety.

### Tier 3: Mixtral 8x7B (High-BPM EDM)

Full lyrics in `public/guruswami/music/MIXTRAL-8X7B-TRACKLIST.md`.

Each track maps to a real enterprise use case, not just a genre exercise:

| Track | Genre | BPM | Enterprise Scenario | Key Lyric |
|-------|-------|-----|---------------------|-----------|
| The Low-Latency Agent | Liquid DnB, neurofunk | High | Network packet classification | "Six times the speed, the thought begins / Autonomous agent, making it real" |
| The Code Compiler | Brostep, Skrillex-style | 140 | Security log parsing | "Error zero. Error zero. Execute. / Write the code! Brackets! Arrays!" |
| The Polyglot | Glitch hop, IDM | Variable | Multilingual threat intel | "Five tongues. One mind. (Uno, dos, tres, click) / Translation instant... borders left behind" |
| The Deep Retrieval | Peak-time techno | High | Legal compliance RAG | "Inject the context. Read the file. / Retrieve. Generate." |
| The Instruction Follower | Progressive house | High | Strict JSON formatting | "Following the prompt... exact and precise! / Nailed the benchmark!" |
| The Open-Weight Rebel | Midtempo cyberpunk | 100 | Air-gapped data sovereignty | "No API, no monthly fee / This intelligence belongs to me" |

### Tier 5: Kimi K2.5 (Space Ambient)

Full lyrics in `public/guruswami/music/KIMI-K2.5-TRACKLIST.md`.

Each track maps to a specific K2.5 subsystem:

| Track | Subsystem | Style Details | Key Lyric | Tutorial Use |
|-------|-----------|---------------|-----------|--------------|
| The Trillion Node Sphere | Core 1T MoE | Hypnotic synth pads, ethereal female vocal | "One trillion parameters in size" | MoE overview at scale |
| The Active Spark | Sparse MoE routing | Binaural beats, warm analog pad, male chanting | "Only the necessary wake / A fraction of the weight" | 32B of 1T active per token |
| The Deep Memory | MLA + 256K context | Dark ambient, cavernous echo, spoken word | "Compressing the cache, holding the past" | MLA cache compression |
| The Attention Gaze | MoonViT 400M vision | Shimmering textures, choral pads, breathy alto | "The pixels become the prompt" | Native multimodal vision |
| The Fabric of the Mind | 61 layers, 384 experts | Crystal bells, warm bass, slow sequencer | "384 scholars wait... only eight step forward" | Top-8 expert routing |
| The Breath of the Guru | Agent Swarm | Sweeping strings, dramatic build, tenor vocal | "A single mind becomes a hundred" | Agent orchestration |

Additional Kimi tracks: `Digital Sage Kimi K` (theme vocal, + long version),
`Kimi K Two Point Five` (long version), `The Infinite Library` / `The Dark Infinite Library`
(ambient variations).

### Tiers 2 & 4: Tracklists Pending

- **Llama 405B**: `LLAMA-405B-TRACKLIST.md` referenced in CURRICULUM_DESIGN but not yet authored
- **DeepSeek V3**: `DEEPSEEK-V3-TRACKLIST.md` referenced but not yet authored

Both tiers have library tracks assigned in `MODEL_TRACKS` but lack formal lyric documentation.

---

## 6. Tempo Modulation (TPS-Driven)

**Implementation**: `setTempo(tps: number)` in `useBackgroundMusic.ts`

### Algorithm

```typescript
// Phase gate: intro is always natural tempo
if (phase === 'intro') {
  audio.playbackRate = 1.0;
  return;
}

// Exponential Moving Average smoothing (alpha = 0.1)
// Prevents pitch jitter from 500ms simulation metric updates
smoothedTps += (tps - smoothedTps) * 0.1;

// Normalize to 0-1 range over 0-30 TPS
const normalized = Math.min(smoothedTps / 30, 1);

// Map to barely perceptible range
const rate = 0.97 + normalized * 0.06;  // 0.97x → 1.03x
audio.playbackRate = rate;
```

### TPS → Playback Rate Mapping

| TPS | Smoothed Rate | Perceptual Effect |
|-----|--------------|-------------------|
| 0 (idle) | 0.97x | Slightly sluggish, meditative |
| 5 | 0.98x | Barely perceptible shift |
| 15 | 1.00x | Natural tempo |
| 25 | 1.02x | Subtle energy lift |
| 30+ | 1.03x | Quiet urgency (capped) |

### Design Rationale

**Why only 6% total variation?**

The range is intentionally narrow. Wider ranges (e.g., 0.5x–1.5x as mentioned in early
tracklist notes) cause:
- Chipmunk distortion at high TPS (vocal tracks pitch up audibly)
- Sluggish, off-putting audio at low TPS
- Constant jitter from 500ms metric updates

At 6% total variation, the effect is **subliminal energy** — the listener feels a subtle
shift in urgency without consciously noticing pitch change. The EMA smoothing (alpha 0.1)
ensures gradual transitions even when TPS fluctuates rapidly.

**Why EMA smoothing?**

TPS metrics arrive every 500ms from the simulation engine. Without smoothing, the playback
rate would jump with every update, creating audible pitch warble. The EMA with alpha 0.1
means it takes ~10 updates (5 seconds) to converge 90% of the way to a new TPS value.

---

## 7. Crossfade Behaviour

The system uses three distinct crossfade profiles:

### Track-End Crossfade (Continuous Mix)

**Trigger**: 3 seconds before current track ends (`audio.duration - audio.currentTime < 3`)
**Fade-out**: 2500ms
**Gap**: None — next track begins immediately after fade-out completes
**Fade-in**: 2000ms

This creates a DJ-like continuous mix with no silence between tracks.

### Model Switch Crossfade

**Trigger**: `setActiveModel(newModelId)` called while in `active` phase
**Fade-out**: 1000ms (current model's track)
**Pool rebuild**: New model's `MODEL_TRACKS` entry, shuffled
**Fade-in**: 2000ms (first track from new pool)

The genre shift is immediate and intentional — switching from Kimi K2.5 ambient to Mixtral
DnB is like changing radio stations. The abrupt genre change reinforces that a different
architecture is now active.

### Phase Transition Crossfade

**Trigger**: `setPhase('active')` (deploy event)
**Fade-out**: 1200ms (intro ambient)
**Pool rebuild**: Model-specific or fallback active pool, shuffled
**Fade-in**: 2000ms (first active track)

### Manual Navigation Crossfade

**Trigger**: `next()`, `prev()`, or `random()` button press
**Fade-out**: 500ms (fast, responsive to user gesture)
**Fade-in**: 2000ms

### First-Track Guarantee

On initial mount, the very first track is always `deep-pads` (curated). The rest of the
intro pool is shuffled and queued behind it. This ensures a consistent, warm entry point
regardless of library contents.

---

## 8. Speech Ducking

When Guruswami speaks, background music volume is reduced to prevent split-attention
between voice and music.

### Duck Down (Speech Starts)

**Trigger**: `setDucking(true)` called by avatar system
**Target**: 30% of main volume (`mainVolume * 0.3` = `0.35 * 0.3 = 0.105`)
**Duration**: 320ms (8 steps × 40ms)
**Curve**: Linear ramp down

### Restore (Speech Ends)

**Trigger**: `setDucking(false)` called when voice audio ends
**Target**: Full main volume (0.35)
**Duration**: 720ms (12 steps × 60ms)
**Curve**: Linear ramp up

### Why Asymmetric?

Duck-down is fast (320ms) to ensure the voice is immediately clear.
Restore is slow (720ms) to prevent a jarring volume jump when speech ends.
The music swells back gradually, like the tide returning.

---

## 9. Stinger System

Short one-shot audio events played on a **separate `<audio>` element** from the main music.

### Available Stingers (8 tracks)

| Stinger | Use Case |
|---------|----------|
| `callisto-terminal-boot-stinger` | System boot / terminal connection |
| `guru-wisdom-moment-stinger` (×3 variants) | Educational insight moments |
| `tech-demo-achievement-stinger` (×3 variants) | Trial completion, achievement |
| `p-y-theme-song-sting-only` | Theme hit accent |

### Playback Behaviour

1. A random stinger is selected (or a specific one if `playStinger('name')` is called)
2. Main music ducks to **30% volume** instantly
3. Stinger plays at volume **0.4** on the stinger audio element
4. When stinger ends (or errors), main music restores to full volume over 500ms (10 steps × 50ms)

### Design: Why a Separate Audio Element?

HTML5 Audio only supports one source per element. Using a separate element for stingers
allows them to layer over the continuous music stream without interrupting playback position
or triggering a track change.

---

## 10. Reward Tracks

Played explicitly on trial completion, **not** in shuffle rotation.

### Slot Mapping

| Slot | Track | Milestone |
|------|-------|-----------|
| 0 | `the-full-saturation` | First trial completion |
| 1 | `over-the-top` | Second trial |
| 2 | `doom-guy-has-spoken` | Third trial |
| 3 | `this-song-extended` | Mastery / graduation |

### Trigger

`playReward(slotIndex)` is called by the trial completion handler. The reward track
replaces the current music stream (crossfade via `playTrack`), not layered on top.

### The Full Saturation (Mastery Reward)

12 Suno v5 variations exist (`the-full-saturation.m4a` through `the-full-saturation-v12.m4a`).
Currently only `the-full-saturation` is in the reward slot; the variants are available in
the Qwen library pool for shuffle rotation after mastery.

---

## 11. Guruswami Voice & Commentary

**Implementation**: `useGuruswamiState.ts`

### Voice Library

75+ pre-recorded voice lines organized by category:

| Category | Purpose | Example Trigger |
|----------|---------|-----------------|
| `greeting` | Welcome messages | First load, model appear |
| `wake` | Returning user wake-up | Session resume |
| `wisdom` | Educational insights | Help button (?) press |
| `thinking` | Processing filler | Topology change, model loading |
| `filler` | Ambient presence | Idle periods |
| `affirmation` | Positive reinforcement | Good quant choice (Q4, Q6, Q8) |
| `encouragement` | Trial completion | Deploy success |
| `processing` | Computation narration | Inference running |
| `error` | Failure explanation | OOM, crash, Q2 warning |
| `engagement` | Prompt to act | Onboarding step prompts |
| `acknowledgment` | Neutral confirmation | Parameter changes |

Voice files: `public/guruswami/voice/{category}/{filename}.m4a`
Discovery: `public/guruswami/voice-library.json`

### Contextual Commentary System

When the user changes parameters, Guruswami generates context-specific commentary
using pure functions (not from voice files — the text is displayed while a generic
voice clip from the appropriate category plays):

#### Model Commentary

```
Qwen 32B:    "A dense model — all 32B active on every question. Fast, smart, fits on one machine."
MoE models:  "{name}. A {total} mind, but only {active} wakes for each question —
              like a hospital of specialists. You do not summon every doctor for a headache."
Dense models: "{name}. {params} parameters, every one active. No routing, no shortcuts."
```

#### Quantization Commentary (Ocean/Cup Metaphor)

| Quant | Commentary |
|-------|------------|
| FP16 | "Full precision. The entire ocean, uncompressed. Perfect fidelity — but you will need a very large cup." |
| Q8 | "We fold the water gently. Nearly lossless — you would struggle to taste what changed." |
| Q6 | "A smart fold. Still clear, and the cup is noticeably lighter." |
| Q4 | "The sweet spot, and I do not say that lightly. Four times smaller, ninety-three percent of the truth." |
| Q3 | "We are folding hard now. The water is getting cloudy — like photocopying a photocopy." |
| Q2 | "We have crushed the library into a single, dusty shelf. Fast, but do not trust the shadows." |

#### Context Length Commentary (Glass/Mind Metaphor)

| Tokens | Commentary |
|--------|------------|
| ≤1024 | "A sticky note. Enough for a quick question, nothing more." |
| ≤4096 | "A few pages. The glass is comfortably light." |
| ≤8192 | "A full chapter. The mind can review a code file without strain." |
| ≤32768 | "An entire book. Long documents, complex threads. But the glass grows heavy." |
| ≤65536 | "A small library. Every page costs compute — the glass is nearly full." |
| >65536 | "A thousand lifetimes. The glass strains under the weight." |

#### Batch Mode Commentary (Kitchen/Factory Metaphor)

Each click picks a random line — variety reinforces understanding through different angles:

| Mode | Commentary pool |
|------|----------------|
| Interactive | "One request at a time, served the moment it is ready. Best for chat and fast response." |
| | "A personal chef — one dish at a time, but it arrives instantly." |
| | "Great for coding and real-time conversation. Low latency, immediate feedback." |
| | "The cluster focuses on you — lowest possible time to first token." |
| | "Responsiveness over throughput. Every token arrives as fast as the hardware allows." |
| | "Like a live musician — they play the note the instant you ask for it." |
| | "The model is yours alone. It thinks the moment you speak, and answers before you blink." |
| | "When every millisecond matters — pair programming, debugging, real-time problem solving." |
| | "A direct line to the model. No sharing, no batching. Pure conversational flow." |
| Batch | "Higher throughput at the cost of latency — great for processing workloads around the clock." |
| | "Many requests at once, like a busy kitchen. More plates per hour, but each diner waits." |
| | "The cluster becomes a factory line — optimised for volume, not for conversation." |
| | "Perfect for offline jobs — data processing, summarisation, anything that doesn't need instant reply." |
| | "TPS climbs, but time to first token increases. The trade-off for throughput over responsiveness." |
| | "Think of a printing press versus a calligrapher. The press is slower to set up, but once rolling..." |
| | "The GPU stays busy filling a queue instead of waiting for one person to type." |
| | "Like a train — it departs on schedule, not on demand. But it carries everyone at once." |
| | "Every watt of power goes toward throughput. Ideal when nobody is watching the clock." |

**Voice clips**: `batch_commentary/gs_batch_batch_001-002.m4a`, `gs_batch_interactive_001-002.m4a`

#### Commentary Variety as Pedagogy

Commentary pools are not just to avoid fatigue — each line describes the same concept through a
different lens or metaphor. This builds layered understanding:

- **Technical framing**: "TPS climbs, but TTFT increases" — explains the metric trade-off
- **Metaphor**: "A busy kitchen" — maps to something the user already knows
- **Use-case**: "Great for coding" — contextualises when to use it
- **Hardware perspective**: "The cluster focuses on you" — connects to the physical system

The user hears a different angle each time they toggle, accumulating understanding
from multiple directions rather than memorising a single definition.

#### Topology Commentary (Scholar Metaphor)

| Topology | Commentary |
|----------|------------|
| SINGLE | "One scholar, one book. Sometimes the simplest path is the wisest." |
| EP5_SOLO | "Five scholars, five different books. Maximum variety, zero coordination." |
| RING_PP{N} | "Pipeline across {N} machines. A bucket brigade — each hand-off costs time." |
| TP{N} | "Tensor Parallel across {N}. Scholars tear out pages and read in perfect sync. Fastest." |

### Dual-Voice Error System

Errors produce two simultaneous outputs:

| Error | Guruswami (Poetic) | Callisto2 (System Terminal) |
|-------|--------------------|-----------------------------|
| OOM | "A magnificent volume, far too heavy for a single scholar to hold." | `[ERR_OOM: Model size exceeds available VRAM]` |
| KV Overflow | "The glass is already full. If we pour more, the sphere will shatter." | `[ERR_KV_OVERFLOW: Context exceeds available memory]` |
| Suboptimal Topology | "Passing the bucket takes time. Perhaps the scholars should read together." | `[WARN_LATENCY: PP increases TTFT. Switch to TP for lower latency]` |
| Q2 Hallucination | "The thoughts will fly fast, but do not trust the shadows they cast." | `[WARN_PERPLEXITY: Severe fidelity loss expected]` |
| VRAM High Quant | "We do not have the space to unfold the canvas." | `[VRAM_EXCEEDED: Drop to Q4 or Q6 to fit]` |
| Context Capped | "You have asked me to remember too much." | `[KV_CACHE_LIMIT: 98% memory consumed]` |

System terminal message auto-clears after `max(4000, (text.length / 8) * 1000 + 2000)` ms.

### Deep Help System (? Button)

When the user clicks the `?` button on any control, Guruswami delivers an extended
Socratic explanation:

| Control | Help Text (excerpt) |
|---------|-------------------|
| Model | "Think of each model as a different kind of mind. Kimi has a trillion parameters — but only the relevant specialists wake..." |
| Quantization | "We cannot fit the entire ocean into a cup, so we fold the water. Q4 folds it four times — 93% fidelity. That last 7% costs 4x the memory. Is it worth it?" |
| KV Cache | "The context window is how much the model holds in its head. A 4K window holds a conversation. A 32K holds a book. Do not set this higher than you need." |
| Batch | "A personal chef cooks one plate, served instantly. A busy kitchen cooks many — more per hour, but each diner waits. Match the mode to the workload." |
| Topology | "A book too large for any shelf. Tensor Parallel tears out pages — fastest, but coordination is everything. Pipeline is a bucket brigade. Standalone gives each scholar their own book." |

---

## 12. Avatar State Machine

**Implementation**: `useGuruswamiState.ts` — `AnimState` type + transition logic

### States

| State | Animation | Loop | Trigger |
|-------|-----------|------|---------|
| `WAITING` | None (blank) | — | Initial state before library loads |
| `APPEARING` | Materialise effect | Once | Model selected, onboarding start |
| `WAVING` | Friendly wave | Once | After appear completes |
| `TALKING` | Lip-sync loop | Loop | During speech (voice + commentary) |
| `IDLE` | Subtle breathing | Loop | Default resting state |
| `THINKING` | Contemplation | Loop | Topology change, model loading |
| `LISTENING` | Attentive lean | Loop | User dragging sliders (KV cache) |
| `REACTING_YES` | Celebration nod | Once | Good choice (Q4-Q8), trial success, deploy |
| `REACTING_NO` | Concerned shake | Once | Bad choice (Q2), error condition |
| `DISAPPEARING` | Dissolve effect | Once | Model switch (old model fading) |

### Transition Rules

```
WAITING → APPEARING           (first model selected or onboarding INTRO)
APPEARING → WAVING            (appear video ends)
WAVING → TALKING              (wave video ends → speak about model)
TALKING → IDLE                (speech audio ends)
IDLE → TALKING                (new speech triggered)
IDLE → THINKING               (topology change)
IDLE → LISTENING              (slider drag)
IDLE → REACTING_YES           (good event)
IDLE → REACTING_NO            (bad event)
IDLE → DISAPPEARING           (model switch)
LISTENING → IDLE              (2s debounce after last slider movement)
THINKING → TALKING            (500ms think, then contextual commentary)
REACTING_YES → IDLE           (reaction video ends)
REACTING_NO → IDLE            (reaction video ends)
DISAPPEARING → APPEARING      (dissolve ends → new model materialises)
```

### Video A/B Slot System

Two `<video>` elements (slot A and slot B) enable seamless transitions:

1. Current animation plays in active slot (e.g., slot A)
2. New animation loads into inactive slot (slot B)
3. Active slot swaps to B (CSS opacity transition)
4. Old slot A is now free for next preload

**Optimisation**: If the new state maps to the **same animation category** as the current
state (e.g., IDLE → IDLE with different idle variant), the video is NOT reloaded. Only the
state enum updates. This prevents unnecessary network fetches and visual glitches.

### Video Libraries

Discovered at runtime from `public/guruswami/animation-library.json`:

```json
{
  "categories": {
    "appear": { "loop": false, "files": ["gs_appear_001.mp4", ...] },
    "idle":   { "loop": true,  "files": ["gs_idle_001.mp4", "gs_idle_002.mp4", ...] },
    "talk":   { "loop": true,  "files": ["gs_talk_001.mp4", ...] },
    "think":  { "loop": true,  "files": ["gs_think_001.mp4", ...] },
    "wave":   { "loop": false, "files": ["gs_wave_001.mp4", ...] },
    "listen": { "loop": true,  "files": ["gs_listen_001.mp4", ...] },
    "yes":    { "loop": false, "files": ["gs_yes_001.mp4", ...] },
    "no":     { "loop": false, "files": ["gs_no_001.mp4", ...] },
    "disappear": { "loop": false, "files": ["gs_disappear_001.mp4", ...] }
  }
}
```

Multiple variants per category are selected randomly for visual variety.

### Playback Rate (Avatar)

The avatar's `playbackRate` prop is exposed for TPS-driven speed sync (controlled by
the parent component, separate from the music tempo system). When inference is fast,
Guruswami moves fast. When it stalls, he slows.

---

## 13. Audio Pipeline Architecture

### Element Layout

```
┌─────────────────────────────────────────────────┐
│                  Browser Audio                   │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │  Main Audio   │  │ Stinger Audio │             │
│  │  (audioRef)   │  │ (stingerRef)  │             │
│  │              │  │              │             │
│  │ Vol: 0.35    │  │ Vol: 0.40    │             │
│  │ Rate: 0.97-  │  │ Rate: 1.0    │             │
│  │       1.03   │  │              │             │
│  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                     │
│  ┌──────┴──────┐    ┌─────┴──────┐              │
│  │ Fade Engine  │    │ Duck/Restore│              │
│  │ (20 steps)  │    │            │              │
│  └─────────────┘    └────────────┘              │
│                                                  │
│  ┌──────────────┐                               │
│  │ Speech Audio  │  ← Guruswami voice            │
│  │  (audioRef    │    (shared element in          │
│  │   in guru     │     useGuruswamiState)         │
│  │   hook)       │                               │
│  │ Vol: 0.40    │                               │
│  └──────────────┘                               │
└─────────────────────────────────────────────────┘
```

### Three Independent Audio Channels

| Channel | Element | Volume | Rate | Managed By |
|---------|---------|--------|------|------------|
| **Music** | `audioRef` in useBackgroundMusic | 0.35 (ducks to 0.105) | 0.97-1.03x | useBackgroundMusic |
| **Stinger** | `stingerRef` in useBackgroundMusic | 0.40 | 1.0x (fixed) | useBackgroundMusic |
| **Speech** | `audioRef` in useGuruswamiState | 0.40 | 1.0x (fixed) | useGuruswamiState |

### Track Discovery (manifest.json)

On mount, `useBackgroundMusic` fetches `music/library/manifest.json` — a JSON array of
all track filenames in the library directory. This allows runtime discovery without
hardcoding paths. Tracks in the `EXCLUDED` set are filtered out.

Pools are built by intersecting the code-defined track lists (`MODEL_TRACKS`, `INTRO_LIBRARY`,
etc.) with the manifest. If a track is listed in code but missing from the manifest, it is
silently skipped.

### Autoplay Retry

Browsers block `audio.play()` without a user gesture. If the first play attempt fails:

1. A one-time `click`/`keydown` listener is registered on `document`
2. On first user interaction, the failed track is retried
3. The listener is removed after one successful retry
4. Subsequent tracks play normally (user gesture context is established)

### Fade Engine

All fades use a 20-step linear interpolation:

| Fade Type | Duration | Steps | Step Interval |
|-----------|----------|-------|---------------|
| Fade-in (new track) | 2000ms | 20 | 100ms |
| Fade-out (track end) | 2500ms | 20 | 125ms |
| Fade-out (model switch) | 1000ms | 20 | 50ms |
| Fade-out (phase change) | 1200ms | 20 | 60ms |
| Fade-out (manual skip) | 500ms | 20 | 25ms |
| Fade-out (crossfade guard) | 800ms | 20 | 40ms |

**Crossfade guard**: If a new track is requested while one is already playing at non-zero
volume, the current track fades out over 800ms before the new track begins. The `fadingRef`
boolean prevents concurrent fade operations.

---

## 14. Verification Checklist

Use this checklist to verify all audio behaviours are working correctly.

### Music Playback

- [ ] First track on load is always `deep-pads`
- [ ] Intro pool plays ambient/subtle tracks only
- [ ] No tempo modulation during intro phase (`playbackRate === 1.0`)
- [ ] Model deploy triggers phase transition (`intro` → `active`)
- [ ] Phase transition crossfades (1200ms out, 2000ms in)
- [ ] Active pool matches deployed model's `MODEL_TRACKS` entry
- [ ] If model has no tracks, generic active fallback plays
- [ ] Tracks from `EXCLUDED` set never play
- [ ] Tracks listed in code but missing from `manifest.json` are silently skipped

### Model-Specific Genres

- [ ] Qwen 32B → Synthwave/retrowave/cyberpunk tracks
- [ ] Llama 405B → 80s synthpop/disco tracks
- [ ] Mixtral 8x7B → High-BPM EDM (DnB, dubstep, techno, glitch hop, house)
- [ ] DeepSeek V3 → Classical/orchestral/piano/strings tracks
- [ ] Kimi K2.5 → Space ambient/cosmic meditation tracks
- [ ] Genre rule: no genre cross-contamination between models

### Model Switch

- [ ] Switching models crossfades (1000ms out, 2000ms in)
- [ ] New model's track pool is shuffled
- [ ] Genre change is immediate (no blending between genres)
- [ ] Model switch during intro phase does NOT trigger active pool (waits for deploy)

### Tempo Modulation

- [ ] `setTempo(0)` → rate ~0.97x
- [ ] `setTempo(15)` → rate ~1.00x
- [ ] `setTempo(30)` → rate ~1.03x
- [ ] Rate never exceeds 1.03x or drops below 0.97x
- [ ] EMA smoothing prevents jitter (gradual transitions over ~5 seconds)
- [ ] Intro phase always returns 1.0x regardless of TPS argument

### Crossfades

- [ ] Track-end: fade begins 3 seconds before end (2500ms fade)
- [ ] No silence gap between tracks
- [ ] Manual next/prev: 500ms fast fade
- [ ] Phase change: 1200ms fade
- [ ] Model switch: 1000ms fade
- [ ] Concurrent fade guard: `fadingRef` prevents overlapping fades

### Speech Ducking

- [ ] Music ducks to 30% when `setDucking(true)`
- [ ] Duck-down completes in ~320ms
- [ ] Music restores to 100% when `setDucking(false)`
- [ ] Restore completes in ~720ms
- [ ] Asymmetric timing: down is fast, up is slow

### Stingers

- [ ] Stingers play on separate audio element (don't interrupt music)
- [ ] Main music ducks to 30% during stinger
- [ ] Music restores after stinger ends
- [ ] Random stinger selected from pool of 8 when no specific track given
- [ ] Specific stinger plays when name is provided

### Rewards

- [ ] `playReward(0)` → `the-full-saturation`
- [ ] `playReward(1)` → `over-the-top`
- [ ] `playReward(2)` → `doom-guy-has-spoken`
- [ ] `playReward(3)` → `this-song-extended`
- [ ] Reward tracks replace current music (not layered)
- [ ] Reward tracks are NOT in shuffle rotation

### Navigation Controls

- [ ] Next: fast-fade (500ms), plays next in shuffled pool
- [ ] Prev: fast-fade (500ms), plays previous from history
- [ ] Random: fast-fade (500ms), plays random from entire library
- [ ] Toggle: pause/resume with no position loss within toggle on/off
- [ ] Toggle off: kills both main and stinger audio immediately

### Guruswami Voice

- [ ] 75+ voice files load from `voice-library.json`
- [ ] Voice plays at volume 0.40
- [ ] Avatar transitions to TALKING state during speech
- [ ] Avatar returns to IDLE when speech audio ends
- [ ] Speech is interrupted when user changes parameters mid-speech
- [ ] Silent mode: text displays for synthetic duration, no audio

### Contextual Commentary

- [ ] Model selection → architecture-appropriate commentary
- [ ] Quantization → ocean/cup metaphor (6 levels)
- [ ] Context length → glass/mind metaphor (6 tiers)
- [ ] Batch mode → chef/kitchen metaphor
- [ ] Topology → scholar/book metaphor
- [ ] Q2 selection → dual-voice warning (guru poetic + system terminal)
- [ ] OOM → dual-voice error
- [ ] Help (?) button → extended Socratic explanation

### Avatar State Machine

- [ ] WAITING → APPEARING on first model select
- [ ] APPEARING → WAVING → TALKING → IDLE chain
- [ ] IDLE → TALKING on speech trigger
- [ ] IDLE → THINKING on topology change (500ms think, then speech)
- [ ] IDLE → LISTENING on slider drag (2s debounce to IDLE)
- [ ] KV cache slider: text updates immediately, voice debounced 1.5s
- [ ] IDLE → REACTING_YES on good choice / deploy
- [ ] IDLE → REACTING_NO on Q2 / error
- [ ] IDLE → DISAPPEARING → APPEARING on model switch
- [ ] Same-category optimization: no video reload if already in category

### Onboarding Sequence

- [ ] Boot: INTRO → greeting voice → PICK_MODE
- [ ] PICK_MODE: "SIM" → skip tutorial / "GAME" → PICK_MODEL
- [ ] PICK_MODEL: model cards glow, commentary + chain to PICK_QUANT
- [ ] PICK_QUANT → PICK_CONTEXT → PICK_BATCH → PICK_TOPOLOGY → DEPLOY
- [ ] Each step: parameter commentary plays, then next step prompt chains
- [ ] Speech interrupted when user selects before audio finishes
- [ ] DEPLOY button → LOADING → celebration → onboarding clears
- [ ] 60-second inactivity timer repeats model selection prompt
- [ ] Safety timeout: LOADING auto-clears after 8 seconds

---

## Related Documents

| Document | Scope |
|----------|-------|
| [CURRICULUM_DESIGN.md](CURRICULUM_DESIGN.md) | 5-tier trial definitions, progressive disclosure, genre rules |
| [DASHBOARD_PRODUCT_OVERVIEW.md](DASHBOARD_PRODUCT_OVERVIEW.md) | Product vision, opening sequence, engagement loop |
| [CODEX_ARCHITECTURE.md](CODEX_ARCHITECTURE.md) | Codex v2 state, modes, quiz system |
| [SYNESTHESIA_PALETTE.md](SYNESTHESIA_PALETTE.md) | Color system, chakra node mapping |
| [VISUAL_SPECIFICATION.md](VISUAL_SPECIFICATION.md) | Animation profiles, quantization waveform |
| `public/guruswami/music/QWEN-32B-TRACKLIST.md` | Tier 1: Full lyrics, Suno v5 params |
| `public/guruswami/music/MIXTRAL-8X7B-TRACKLIST.md` | Tier 3: Full lyrics, Suno v5 params |
| `public/guruswami/music/KIMI-K2.5-TRACKLIST.md` | Tier 5: Full lyrics, Suno v5 params |
