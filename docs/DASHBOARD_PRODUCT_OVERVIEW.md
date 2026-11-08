# Guruswami.ai Dashboard — Product Overview

Last updated: 2026-02-22

## What It Is

A **flight simulator for distributed AI inference** — not a course, not a video platform, not a chatbot wrapper. Users configure a virtual 5-node Apple Silicon cluster and learn distributed computing by making decisions that succeed or fail in real time.

The simulator runs a **parametric engine** that calculates real TPS, TTFT, and VRAM from actual model specifications. Nothing is faked.

---

## First Impression: The Opening Sequence

A new visitor sees darkness. Then a **staggered cinematic boot**:

1. A TPS-driven mandala shader pulses to life in the background
2. A top bar fades in with a music player (ambient bed begins)
3. The **MeshGraph** reveals — an SVG ring of 5 chakra-colored nodes connected by animated token flow lines, each node glowing with its GPU utilization
4. **Guruswami appears** — a pre-recorded video avatar that speaks, thinks, waves. He greets the user with actual voice recordings (75+ lines across mood categories). Video playback speed syncs to inference TPS.
5. **Cluster Introduction** — Guruswami explains what the Chakra Cluster is: five Mac Studio M3 Ultras, Thunderbolt 5, 2.5TB unified memory. This gives first-time users context before any controls appear.
6. The sidebar reveals the **SimulationPanel** with the first question: *"Pick a model."*

The whole boot takes ~3 seconds. Each element arrives in its own moment — no wall of controls, no information dump.

### Post-Load Metrics Tour

After the model loads and the visualization springs to life, Guruswami walks the user through each metric:

1. **TPS** (tokens/second) — highlighted with amber glow, other sections dimmed
2. **TTFT** (time to first token) — highlight shifts
3. **Layer Split** — how layers distribute across nodes
4. **Per-Node Memory** — cyan for weights, purple for KV cache

Each section highlights sequentially with an 800ms pause between steps. The tour auto-completes and persists to localStorage so returning users skip it.

---

## The Engagement Loop: 30 Resonance Trials

Users progress through **5 tiers of 6 trials each**, ordered by architectural wall:

### Tier 1 — Qwen 32B: "The Dense Foundation" (Synthwave)

- Only 4 controls visible: model, quantization, context, batch mode
- Users learn when distribution *hurts* — splitting a 32B model across 5 nodes adds more network overhead than it saves. The trap is deliberate.
- Trial 1 example: "Awaken Qwen on one machine, optimize for conversation." Win condition: single node, Q4 quant, interactive mode.

### Tier 2 — Llama 405B: "The Immovable Object" (80s Synthpop)

- The mirror image. 405B won't fit on one node. Now distribution is mandatory.
- Users discover Tensor Parallelism (parallel, works) vs Pipeline Parallelism (sequential, hits Apple's 60-second Metal GPU timeout and crashes). The simulator calculates this from real constraints.
- TP/PP selector controls unlock for the first time.

### Tier 3 — Mixtral 8x7B: "The Illusion of Weight" (High-BPM EDM)

- 47B total parameters, but only 13B active per token. Sparse Mixture-of-Experts.
- Placed *after* Llama for maximum contrast — users just learned "big = must distribute," now they learn "big but sparse = lightning fast on fewer nodes."
- Expert routing visualizer appears in the MeshGraph.

### Tier 4 — DeepSeek V3: "The Memory Fold" (Classical/Orchestral)

- Multi-Head Latent Attention compresses the KV cache 28-57x. At massive scale, memory kills you before model weights do.
- GQA vs MLA toggle appears. Users watch the VRAM gauge shrink dramatically when MLA activates.

### Tier 5 — Kimi K2.5: "The Titan" (Space Ambient)

- 1 Trillion parameters. MoE + MLA + Vision + multi-node. Every lesson simultaneously.
- All controls visible. One wrong slider crashes the system — Metal timeout, VRAM overflow, divisibility wall (12,288 hidden dim ÷ 5 = non-integer).
- The final boss.

### How a Trial Works

The user drags sliders and picks topology. The simulation engine evaluates their config in real time (TPS, TTFT, VRAM per node, feasibility warnings). When the win condition triggers — trial complete, reward track unlocks, Guruswami celebrates, next tier opens.

---

## Progressive Disclosure: Cognitive Load Prevention

Controls appear **only when the curriculum demands them.** Tier 1 shows 4 sliders. Tier 2 adds TP/PP. Tier 3 adds expert routing. Tier 5 shows everything. A new user never sees 15 controls at once.

This is Cognitive Load Theory applied as UI architecture.

---

## The Guruswami Codex: Optional Deep Knowledge

A slide-out drawer with **5 tabs**: Hardware, Benchmarks, Intelligence, Integration, Trials. Each contains:

- **Markdown content** rendered with full GitHub Flavored Markdown (tables, code blocks, diagrams)
- **Knowledge quizzes**: 3 multiple-choice questions per section, validated in real time, scores persisted
- **Bonus track unlock**: 100% quiz score unlocks an instrumental remix

The Codex is non-intrusive — a pulsing "Consult Guruswami?" button appears when users hit a wall. It explains *why* their config failed, then offers a quiz to confirm understanding.

---

## Visual Design: The Synesthesia Palette

All colors follow a **perceptually uniform system**: 72 hues at 5-degree intervals, all `hsl(H, 43%, 50%)`.

The 5 compute nodes map to chakra positions on the color wheel:

| Node | Hue | Color | Chakra Meaning |
|------|-----|-------|----------------|
| Muladhara | 0° | Red | Root, foundation |
| Svadhisthana | 30° | Orange | Sacral, flow |
| Manipura | 60° | Gold | Solar plexus, power |
| Anahata | 120° | Green | Heart, balance |
| Vishuddha | 180° | Cyan | Throat, communication |

No color dominates. Every node feels equally important yet maximally distinct. The palette carries through the entire UI — topology lines, VRAM gauges, TPS charts, quiz scoring.

See also: [SYNESTHESIA_PALETTE.md](./SYNESTHESIA_PALETTE.md)

---

## The MeshGraph: Central Visualization

A **1,700-line SVG animation engine** showing the 5-node ring:

- **Chakra-colored nodes** arranged in a circle, each pulsing with GPU utilization
- **Token particles** flow along RDMA links at the actual simulated TPS rate
- **Link thickness** scales with bandwidth utilization
- **Ring expansion** grows with overall cluster throughput
- **Mesh health banner** alerts when RDMA links degrade (with recovery action suggestions)
- **Topology overlay** morphs between ring (PP), full mesh (TP), and isolated nodes (expert parallel)

When inference is idle, the mesh breathes slowly. When TPS spikes, particles flood the links and nodes flare.

---

## The Sonic Identity System

Each model tier has a distinct musical character, played through a sophisticated audio system:

| Tier | Model | Music Genre | Why |
|------|-------|-------------|-----|
| 1 | Qwen 32B | Synthwave | Warm, retro, foundational — like single-node inference |
| 2 | Llama 405B | 80s Synthpop | Heavy analog synths mirror heavy parameters |
| 3 | Mixtral 8x7B | High-BPM EDM | DnB, dubstep — lightning-fast MoE routing |
| 4 | DeepSeek V3 | Classical/Orchestral | Bach fugues reflect intellectual elegance of MLA |
| 5 | Kimi K2.5 | Space Ambient | Cosmic meditation at trillion-parameter scale |

### Audio Features

- **Phase transitions**: Ambient bed during onboarding → model-specific tracks when deployed → crescendo on trial completion
- **Deploy stinger**: A "big brass rise and ceremony" sound layers over the ambient when deployment fires
- **Trial rewards**: Completing a trial unlocks a bonus track. Completing all 6 in a tier unlocks a continuous mix + VIP remix.
- **Guruswami voice**: 75+ pre-recorded lines across categories (greeting, wisdom, thinking, affirmation, error). He reacts to what's happening — "Running hot, full speed ahead" when TPS climbs.

When Llama crashes on single-node, **the music stops.** When it succeeds on TP4, the synthpop drops. The audio channel carries emotional information that the visual channel can't.

See also: [Model-specific music notes](../../../docs/model-music.md)

---

## The Guruswami Avatar

A pre-recorded video avatar with **18 animation states** (appear, talk, think, wave, disappear, listen, yes, no) and **75+ voice lines** across mood categories:

- **Greeting**: Welcome messages for first-time and returning users
- **Wisdom**: Contextual insights triggered by cluster state
- **Thinking**: Filler phrases while simulations compute
- **Affirmation**: Celebration when trials complete
- **Error**: Warm, non-judgmental explanations when configs fail

Video playback rate syncs to TPS. When inference is fast, Guruswami moves fast. When it stalls, he slows.

The avatar drives the **onboarding narrative**: "Pick a model..." → "Try adjusting context length..." → "3... 2... 1... Deploying!"

---

## State & Progression

### ResonanceState v2

Persisted to localStorage:

- **Per-model**: completed trials, unlocked tracks, mastery status
- **Codex**: sections viewed, quiz scores with timestamps
- **Active trial ID**: drives GAME mode restrictions
- **Graduation flag**: auto-set at 30/30 trials

### Three Modes (derived from state, not stored)

| Mode | Trigger | Experience |
|------|---------|------------|
| GAME | Active trial | Restricted controls, mission briefing visible, win condition evaluating |
| SIM | Graduated or free-play | Full library unlocked, all controls available |
| LIVE | Wired to real hardware | Telemetry overlay, read-only monitoring, deployment wizard |

---

## The Reward Loop

1. **Sonic progression** — users want to *hear* what each architecture sounds like
2. **Mastery bloom** — completing all 6 trials in a tier triggers a visual celebration + 2 bonus tracks
3. **Graduation** — 30/30 trials switches to SIM mode, full library access
4. **Novelty expiration** — gamification deliberately fades as mastery grows. By Tier 5, users play for intellectual satisfaction, not game mechanics. This is by design.
5. **The final boss** — Kimi K2.5 requires perfect balance across all dimensions learned in Tiers 1-4

---

## Teaching Logic: The Pedagogical Framework

### Backward Design (Wiggins & McTighe)

The curriculum starts from what users should *understand* after Tier 5, then works backward:

- Tier 5 requires understanding TP, MoE routing, MLA compression, VRAM math, and topology selection
- Tier 4 introduces memory compression in isolation
- Tier 3 introduces sparsity in isolation
- Tier 2 introduces mandatory distribution in isolation
- Tier 1 establishes baselines and the trap (over-distribution)

### Split-Attention Prevention

- Audio and dense data **never compete** for analytical attention simultaneously
- Guruswami speaks during transitions (low cognitive load), not during active configuration (high load)
- Music carries emotional state; visuals carry data state

### Three Pedagogical States

| State | Role | UI Behavior |
|-------|------|-------------|
| THE_LIBRARY | Tutor mode | Codex open, Guruswami explains, quizzes active |
| THE_HANDOFF | Transition | Codex closes, controls highlight, "now you try" |
| BARE_METAL | Expert telemetry | Full dashboard, no hand-holding, production monitoring |

---

## Dashboard Layout

```
┌──────────────────────────────────────────────────────────────┐
│ TOP BAR                                                       │
│ [Mode] [Help] [Deploy] [Music: ▶ Qwen-Synthwave] [Speech]   │
├──────────────────────────────────┬───────────────────────────┤
│                                  │                           │
│  LEFT (66%): VISUALIZATION       │  RIGHT (34%): SIDEBAR    │
│                                  │                           │
│  ┌────────────────────────────┐  │  ┌─────────────────────┐ │
│  │  MandalaShader (bg)        │  │  │ SimulationPanel     │ │
│  │  (TPS-driven mandala)      │  │  │ (topology, params)  │ │
│  └────────────────────────────┘  │  └─────────────────────┘ │
│                                  │                           │
│  ┌────────────────────────────┐  │  ┌─────────────────────┐ │
│  │  MeshGraph (SVG ring)      │  │  │ StatsPanel          │ │
│  │  - 5 chakra-colored nodes  │  │  │ (TPS history)       │ │
│  │  - Token particle flow     │  │  └─────────────────────┘ │
│  │  - Link quality indicators │  │                           │
│  │  - Topology overlay        │  │  ┌─────────────────────┐ │
│  ├────────────────────────────┤  │  │ NodePanel           │ │
│  │  GuruswamiAvatar (overlay) │  │  │ (per-node metrics)  │ │
│  │  - Speaking bubble         │  │  └─────────────────────┘ │
│  │  - Contextual guidance     │  │                           │
│  └────────────────────────────┘  │                           │
│                                  │                           │
├──────────────────────────────────┴───────────────────────────┤
│ FOOTER                                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Status

| Feature | Status | Scope |
|---------|--------|-------|
| 30 trial definitions with win conditions | Built | Production logic, not stubs |
| Parametric simulation engine | Built | Real TPS/TTFT/VRAM math from model specs |
| MeshGraph SVG visualization | Built | 1,723 lines, animated token flow |
| Music system (12+ tracks) | Built | Per-model genres, phase transitions, stingers |
| Guruswami avatar (18 videos, 75+ voice lines) | Built | Pre-recorded, video-synced, contextual |
| Codex markdown + quiz system | Built | react-markdown rendering, score persistence |
| Onboarding state machine | Built | Cinematic 5-step narrative flow |
| Progressive control disclosure | Built | Controls unlock per tier |
| ResonanceState persistence | Built | localStorage v2 with auto-migration |

---

## The Philosophy

> "Flight simulator, not LMS."

It teaches distributed computing by making you *feel* the consequences. You don't read about the Metal 60-second timeout — you watch Pipeline Parallelism crash and hear the music die. You don't study MoE routing — you see 47B parameters running at single-node speed and hear DnB kick in.

The invariant: **education and production are the same interface.** The visualizations that teach Tier 1 students scale to monitor real inference at Tier 5.

---

## Key Technical Insights Taught

1. **Dual-Network Architecture**: Ethernet (10GbE, control) + Thunderbolt 5 (RDMA, data) prevents single point of failure
2. **The Sync Tax**: TP4 requires 61 All-Reduce operations per token. TCP adds ~61ms; RDMA reduces to ~3ms (350% TPS increase)
3. **Metal 60-Second Timeout**: Apple's unfixable GPU limit. PP fails (sequential prefill); TP survives (parallel)
4. **The Divisibility Wall**: Kimi hidden_dim = 12,288. TP5 impossible (÷5 = non-integer). TP2 and TP4 work.
5. **Sparse MoE**: 1T total parameters, 32B active per token = 6x faster than dense equivalent
6. **MLA Compression**: KV cache 28-57x smaller, enabling 256K context on finite hardware

---

## Related Documentation

- [CODEX_ARCHITECTURE.md](./CODEX_ARCHITECTURE.md) — Codex engine technical architecture
- [CURRICULUM_DESIGN.md](./CURRICULUM_DESIGN.md) — 5-tier backward design curriculum
- [SYNESTHESIA_PALETTE.md](./SYNESTHESIA_PALETTE.md) — Color system specification
- [GURUSWAMI_CODEX_VISION.md](../../../docs/GURUSWAMI_CODEX_VISION.md) — Scope control + expansion roadmap
- [GURUSWAMI_VISION.md](../../../docs/GURUSWAMI_VISION.md) — Product vision (LLMSH → Dashboard → guruswami.ai)
