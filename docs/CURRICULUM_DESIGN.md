# Chakra Trials — Curriculum Design (Backward Design)

**This document is the canonical reference for the pedagogical progression of the Chakra Trials.**
All audio, music, trial definitions, and lesson content must follow this guide.

---

## Design Methodology: Backward Design

The final goal is for a user to successfully deploy a **1 Trillion parameter, multimodal MoE
across a 5-node Apple Silicon cluster** without setting their office on fire.

We work backward from that goal to identify the exact sequence of hardware and software
scaling walls they will encounter. Every model in the curriculum represents a specific,
unavoidable bottleneck in modern LLM architecture.

---

## The 5-Tier Curriculum

Each tier presents a **wall**. The next tier presents the **architectural innovation** that breaks through it.

```
Problem → Solution → New Problem → New Solution → Mastery

Tier 1: "Distribution hurts small models"
    ↓ (but what about big models?)
Tier 2: "Big dense models FORCE distribution"
    ↓ (distribution works, but 405B is slow — what if not all params fired?)
Tier 3: "MoE: only 13B of 47B are active — 6x faster"
    ↓ (MoE is fast, but the KV cache still chokes at long context)
Tier 4: "MLA compresses the KV cache 28-57x"
    ↓ (now combine everything at 1T scale)
Tier 5: "1T MoE+MLA+Vision+Swarm across 5 nodes — total mastery"
```

---

### Tier 1: The Dense Foundation

| Property | Value |
|----------|-------|
| **Model** | Qwen 32B |
| **Architecture** | Dense Transformer |
| **Sonic Identity** | Synthwave |
| **Core Lesson** | *Just because you can distribute, doesn't mean you should.* |
| **Hardware Wall** | Basic VRAM constraints |
| **Trials** | 6 (deploy → quantize → context → batch → topology trap → EP5) |

**The Curriculum:** This level teaches the absolute fundamentals of local inference.
The user learns what Quantization is (how to shrink weights to fit in memory) and how
Context Windows consume VRAM.

**The Trap:** The user is tempted to use all 5 nodes of the cluster. When they split a
small 32B model across the network, the latency of the physical cables destroys their
Tokens-Per-Second (TPS). They learn that for small models, keeping the memory localized
to a single Apple Silicon chip is always faster.

**The Mastery Moment:** Trial 6 ("The True Swarm") — the user realizes that if the model
fits on one node, scaling means **replicating** it (EP5), not splitting it (TP5).
Embarrassingly Parallel architecture.

---

### Tier 2: The Immovable Object

| Property | Value |
|----------|-------|
| **Model** | Llama 405B |
| **Architecture** | Dense Transformer (massive) |
| **Sonic Identity** | 80s Synthpop |
| **Core Lesson** | *When a model is heavier than the host, Tensor Parallelism is not optional.* |
| **Hardware Wall** | OOM and Apple Metal 60-second timeout |
| **Trials** | 6 (single-node crash → TP2 → Q8 precision → TP4 headroom → dense context limits → mastery) |

**The Curriculum:** The user tries to apply the lesson from Tier 1 ("keep it on one node")
and the system immediately crashes. A 405B dense model at Q4 is ~215GB — it technically
fits in 512GB unified memory, but leaves almost no room for KV cache. TPS crawls.

**The Trap:** The user must learn **Tensor Parallelism (TP)**, where the actual matrix
math is sliced horizontally across multiple GPUs. If they try Pipeline Parallelism
(passing layers sequentially), the prefill phase will hit the 60-second Metal API
hardware timeout and the OS will kill the process. They must learn to distribute
the compute side-by-side to survive.

**The Mirror:** This tier is Qwen's exact mirror image. Same architecture (dense transformer),
completely opposite lesson. The user's own newly acquired knowledge ("keep it local")
becomes the trap. This is the "aha" moment of the entire curriculum.

**The Mastery Moment:** Trial 6 ("The Iron Throne") — optimal TP4 + Q4 + batch deployment.
The bridge text says: *"Now you're ready for the experts."*

---

### Tier 3: The Illusion of Weight

| Property | Value |
|----------|-------|
| **Model** | Mixtral 8x7B |
| **Architecture** | Sparse Mixture of Experts (MoE) |
| **Sonic Identity** | High-BPM EDM (DnB, dubstep, techno, glitch hop) |
| **Core Lesson** | *Total parameters dictate VRAM; active parameters dictate speed.* |
| **Hardware Wall** | Understanding sparse routing |
| **Trials** | 6 (low-latency agent → code gen → multilingual → RAG → instruction following → sovereign deployment) |

**The Curriculum:** The user is introduced to the MoE architecture. They deploy a
~47B parameter model, but notice the inference speed is lightning-fast.

**The Trap:** The user learns about the Router/Gating network. They see that while the
model takes up 47B of hard drive space, only 13B parameters are "active" during any
given forward pass. They learn that **MoE is a trick to decouple model intelligence
from compute latency.**

**Why After Llama (not before):** Placing MoE after dense-at-scale creates a relief effect.
The user just struggled with 405B dense parameters — every single one firing for every token.
Now they meet 47B that runs faster because only 13B activate. The contrast makes the sparse
routing concept visceral, not abstract.

**The Mastery Moment:** Trial 6 ("The Sovereign Mind") — full mesh deployment, proving
that open-weight local inference is viable for enterprise.

---

### Tier 4: The Memory Fold

| Property | Value |
|----------|-------|
| **Model** | DeepSeek V3 |
| **Architecture** | MoE + Multi-head Latent Attention (MLA) |
| **Sonic Identity** | Classical & Orchestral |
| **Core Lesson** | *At massive scales, the context window will kill you before the model weights do.* |
| **Hardware Wall** | KV cache bottleneck |
| **Trials** | 6 (first MoE+MLA → MLA compression demo → expert fugue → 128K context → balanced orchestra → mastery) |

**The Curriculum:** The user tries to feed a massive batch of documents into DeepSeek.
Even though the MoE routing is fast, the standard memory required to remember 100,000+
tokens of context would crash the cluster with GQA attention.

**The Trap:** The user must understand **Multi-Head Latent Attention (MLA)**. This teaches
them how modern architectures compress the KV cache into a tiny latent space, reducing
the memory footprint by roughly 28-57x compared to standard Multi-Head Attention.
This is how DeepSeek manages 128K+ token context without OOM.

**The Bridge:** DeepSeek V3 unifies the solutions from Tiers 2 and 3:
- From Llama: the need for distribution at scale
- From Mixtral: sparse MoE routing for compute efficiency
- New: MLA for memory efficiency

The user learns that **architectural elegance (folding the memory) is just as important
as raw scaling (adding nodes).**

**The Mastery Moment:** Trial 6 ("The Grand Unification") — TP4 + 128K context + batch mode.
The bridge text says: *"One model remains."*

---

### Tier 5: The Titan (Final Boss)

| Property | Value |
|----------|-------|
| **Model** | Kimi K2.5 |
| **Architecture** | 1T parameter MoE + MLA + MoonViT Vision + Agent Swarm |
| **Sonic Identity** | Space Ambient |
| **Core Lesson** | *Total mastery of the mesh.* |
| **Hardware Wall** | All of the above, simultaneously |
| **Trials** | 6 (full mesh deploy → sparse routing → 256K context → vision → expert topology → swarm orchestrator) |

**The Curriculum:** The user must balance a 1T parameter weight, route tokens through
massive expert networks (384 experts, 8 active per token), compress the KV cache for
a multimodal context window (256K tokens), and perfectly balance the Tensor Parallelism
across all 5 physical nodes via Thunderbolt 5 RDMA.

**If any single slider is wrong**, the network bottlenecks, the VRAM spills over,
or the Metal API times out.

**The Mastery Moment:** Trial 6 ("The Swarm Orchestrator") — agent swarm mode across
the maximum topology. The leviathan becomes a hive mind. Lotus Bloom animation triggers.

---

## Concept Dependency Graph

```
1. Single-node deployment ─────────────────── Qwen
2. Quantization (VRAM ↔ quality) ──────────── Qwen
3. Context window / KV cache cost ─────────── Qwen
4. Batch vs Interactive ───────────────────── Qwen
5. Topology trap (when NOT to distribute) ─── Qwen
6. EP scaling (replicate, don't split) ────── Qwen
                │
7. When distribution IS necessary ─────────── Llama 405B
8. Quantization debt at scale ─────────────── Llama 405B
9. GQA attention limits ───────────────────── Llama 405B
                │
10. Sparse MoE routing ────────────────────── Mixtral 8x7B
                │
11. MLA / KV cache compression ────────────── DeepSeek V3
12. Long context (128K-256K) feasibility ──── DeepSeek V3
                │
13. Vision / multimodal ───────────────────── Kimi K2.5
14. Agent orchestration / swarm ───────────── Kimi K2.5
```

Every concept has explicit prerequisites. The array order in `TRIAL_DEFINITIONS`
mirrors this dependency chain.

---

## Model-Specific Sonic Identities

Each model has a distinct musical genre that reflects its architectural personality:

| Tier | Model | Genre | Why This Sound |
|------|-------|-------|----------------|
| 1 | Qwen 32B | Synthwave | Warm, retro, foundational — the "home base" feeling of single-node simplicity |
| 2 | Llama 405B | 80s Synthpop | Depeche Mode/New Order dramatic weight — heavy analog synths mirror the heavy parameter count |
| 3 | Mixtral 8x7B | High-BPM EDM | Lightning-fast DnB and techno — acoustically represents the blazing inference speed of sparse routing |
| 4 | DeepSeek V3 | Classical/Orchestral | Bach fugues and symphonies — the intellectual elegance of MLA and expert counterpoint |
| 5 | Kimi K2.5 | Space Ambient | Vast, cosmic meditation — the scale of 1T parameters across a Thunderbolt mesh |

**Rule:** A track's genre must match its model's sonic identity. No EDM for DeepSeek, no ambient for Mixtral.

---

## Trial Structure Per Model

Each model has exactly **6 trials**, progressing from beginner to mastery:

| Level | Pattern | Description |
|-------|---------|-------------|
| 1 | First contact | Deploy the model, observe baseline behavior |
| 2 | Core mechanic | Apply the tier's primary concept |
| 3 | Refinement | Optimize a secondary parameter |
| 4 | Advanced | Combine multiple concepts |
| 5 | Edge case | Push to architectural limits, discover the wall |
| 6 | Mastery | Optimal configuration, bridge to next tier |

**Level 6 always bridges to the next tier.** The mastery track lyrics contain a spoken
word section that foreshadows the next model's challenge.

---

## Implementation Reference

| File | Purpose |
|------|---------|
| `hooks/useResonanceState.ts` | `TRIAL_DEFINITIONS` array (30 trials), state hook, persistence |
| `hooks/useBackgroundMusic.ts` | `MODEL_TRACKS` per-model sonic identity, audio playback |
| `public/guruswami/music/QWEN-32B-TRACKLIST.md` | Tier 1 Suno v5 scripts and lyrics |
| `public/guruswami/music/LLAMA-405B-TRACKLIST.md` | Tier 2 Suno v5 scripts and lyrics |
| `public/guruswami/music/MIXTRAL-8X7B-TRACKLIST.md` | Tier 3 Suno v5 scripts and lyrics |
| `public/guruswami/music/DEEPSEEK-V3-TRACKLIST.md` | Tier 4 Suno v5 scripts and lyrics |
| `public/guruswami/music/KIMI-K2.5-TRACKLIST.md` | Tier 5 Suno v5 scripts and lyrics |
| `public/guruswami/music/library/manifest.json` | Runtime track discovery |

---

## Progressive Disclosure — Why This Curriculum Won't Overwhelm Users

This curriculum is dense. Handed to an IT manager as a 50-page PDF, their eyes would glaze
over by the second slide. But this is a **simulator**, not a textbook. Three cognitive
principles make this level of complexity manageable:

### 1. Experiential Chunking

Cognitive Load Theory: the brain holds 4-7 "chunks" in working memory at once. In a textbook,
"MoE Sparse Routing" is a massive abstract chunk. In the dashboard, it's a **physical slider**.
The user doesn't memorize gating network calculus — they move the slider, watch TPS spike,
and hear the EDM kick in. Abstract math → tangible cause-and-effect.

### 2. The Dual-Pathway Effect (Dual-Coding Theory)

Pairing architectural milestones with specific musical genres (Synthwave for Qwen, Classical
for DeepSeek) utilizes dual-coding multimedia learning. The user processes visual UI constraints
while receiving auditory feedback. When Llama crashes, the music stops. When it succeeds,
the 80s synth drops. Audio cues offload processing from visual working memory.

### 3. Progressive Disclosure (The Critical UI Rule)

**You cannot show the user all sliders on Level 1.**

Controls are physically hidden until the exact moment the curriculum demands them. The user
only ever solves one new variable at a time. Unlocked controls accumulate tier-by-tier.

---

## Progressive Disclosure Map — Controls by Tier

### Tier 1: Qwen 32B (The Dense Foundation)

| Control | State | Why |
|---------|-------|-----|
| Model selector | **Qwen 32B only** | No other models visible yet |
| Quantization | **Visible** (Q4, Q8, FP16) | Core Tier 1 concept |
| Context window | **Visible** (2K - 32K) | Core Tier 1 concept |
| Batch / Interactive | **Visible** | Core Tier 1 concept |
| Topology | **Visible** (EP1, TP2, TP4, EP5) | Needed for topology trap |
| TP/PP distinction | Hidden | Not relevant until Tier 2 |
| Attention type | Hidden | Not relevant until Tier 4 |
| Vision toggle | Hidden | Not relevant until Tier 5 |
| Agent swarm | Hidden | Not relevant until Tier 5 |

**Dashboard state:** Clean, simple. 4 controls + model selector. The user focuses
entirely on VRAM, quantization, and the topology trap.

### Tier 2: Llama 405B (The Immovable Object)

| Control | State | Why |
|---------|-------|-----|
| Model selector | **Qwen + Llama visible** | Llama unlocks after Qwen mastery |
| Quantization | Visible (adds Q2, Q3) | More options needed for 405B |
| Context window | Visible (2K - 32K) | Unchanged |
| Batch / Interactive | Visible | Unchanged |
| Topology | **TP/PP split illuminates** | User must learn TP vs PP (PP fails) |
| Active vs Total params | Hidden | Not relevant for dense models |
| Attention type | Hidden | Not relevant until Tier 4 |

**New concept introduced:** The TP/PP distinction. The topology selector now shows
the difference between Tensor Parallelism (parallel matrix math) and Pipeline
Parallelism (sequential layer passing). PP is the trap — it hits the 60s Metal timeout.

### Tier 3: Mixtral 8x7B (The Illusion of Weight)

| Control | State | Why |
|---------|-------|-----|
| Model selector | **Qwen + Llama + Mixtral** | Mixtral unlocks after Llama mastery |
| All Tier 2 controls | Visible | Accumulated from previous tiers |
| Active vs Total params | **Illuminates** | Shows "47B total / 13B active" |
| Expert routing indicator | **New** | Visualizes which experts fire per token |

**New concept introduced:** The Active vs Total parameter display. This is the "wait,
only 13B are running?" moment. The topology visualizer shows expert routing in real-time.

### Tier 4: DeepSeek V3 (The Memory Fold)

| Control | State | Why |
|---------|-------|-----|
| Model selector | **+ DeepSeek V3** | Unlocks after Mixtral mastery |
| All Tier 3 controls | Visible | Accumulated |
| Attention type | **Illuminates** (GQA vs MLA) | Core Tier 4 concept |
| KV cache memory gauge | **New** | Shows cache VRAM consumption in real-time |
| Context window | **Extended** (2K - 128K) | MLA enables much longer context |

**New concept introduced:** The Attention Type toggle and KV cache gauge. The user can
switch between GQA and MLA and watch the cache memory indicator shrink by 28-57x.
This is the "aha" moment for MLA.

### Tier 5: Kimi K2.5 (The Titan)

| Control | State | Why |
|---------|-------|-----|
| Model selector | **All 5 models** | Full roster unlocked |
| All Tier 4 controls | Visible | Accumulated |
| Vision / Multimodal | **Illuminates** | MoonViT 400M vision encoder |
| Agent Swarm toggle | **Illuminates** | Multi-agent orchestration |
| Top-K routing | **Illuminates** | Expert selection granularity |
| Context window | **Extended** (2K - 256K) | Kimi's full context range |

**All controls visible.** The user has graduated through the full curriculum and
can now configure every parameter. The complexity is manageable because they
learned each control in isolation, tier by tier.

---

## The Guruswami Codex (Contextual Help System)

### Problem

Some users want deeper technical understanding. Others just want to experiment.
The main UI must stay clean for experimenters, but "hardcore" users need access
to the raw documentation.

### Solution: Contextual Help Drawer

A slide-out panel ("Consult Guruswami") that provides **in-context documentation**
without leaving the dashboard. It uses the `DocumentationTrial` interface already
in the codebase — but attached to config trials as optional help, not as standalone levels.

### How It Works

1. **User hits a wall** (e.g., Llama crashes on single node)
2. **"Consult Guruswami" button** appears (pulsing gently, not intrusive)
3. **Side panel slides out** with a brief, technical explanation:
   - What Tensor Parallelism vs Pipeline Parallelism actually means
   - Why PP hits the Metal 60s timeout for this model
   - A diagram showing horizontal vs vertical sharding
4. **Knowledge Check** — 3 multiple-choice questions at the bottom
5. **Pass the quiz →** Two rewards:
   - Guruswami gives a specific slider hint (e.g., *"Set the network to TP4."*)
   - A bonus audio track unlocks (instrumental version of the tier's theme)

### TypeScript Integration

Each `ConfigTrial` gains an optional `codex` property:

```typescript
interface TrialCodex {
  markdownContent: string;       // Technical explanation (rendered in drawer)
  quiz: QuizQuestion[];          // 2-3 questions
  hintOnPass: string;            // Specific slider hint revealed on quiz pass
  bonusTrack: string | null;     // Bonus track unlocked on quiz pass
}

interface ConfigTrial extends BaseTrial {
  type: 'config';
  mission: string;
  hint: string;
  winCondition: (config: TrialConfig) => boolean;
  codex?: TrialCodex;            // Optional deep-dive documentation
}
```

This reuses the existing `QuizQuestion` interface and `checkQuizAnswers` hook method.
The codex is optional — not every trial needs one. Priority codex entries:

| Trial | Codex Topic | Why |
|-------|-------------|-----|
| `llama-sleeping-giant` | Dense model VRAM calculation | First OOM crash |
| `llama-necessary-split` | TP vs PP explained | Critical architectural choice |
| `mixtral-fast-twitch` | MoE sparse routing mechanics | First MoE encounter |
| `deepseek-latent-compression` | MLA math (latent projection) | Core Tier 4 concept |
| `kimi-leviathans-wake` | TB5 RDMA mesh architecture | Full mesh deployment |

### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Model + Trial Title + Progress Dots                │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│   3D Topology Visualizer     │  Guruswami Codex Drawer      │
│   (WebGL Sphere)             │  (slides from right)         │
│                              │                              │
│                              │  ┌────────────────────────┐  │
│                              │  │ # Tensor Parallelism   │  │
│                              │  │ vs Pipeline Parallelism│  │
│                              │  │                        │  │
│                              │  │ [markdown content]     │  │
│                              │  │                        │  │
│                              │  │ ── Quiz ──────────     │  │
│                              │  │ Q1: ○ ○ ○             │  │
│                              │  │ Q2: ○ ○ ○             │  │
│                              │  │ Q3: ○ ○ ○             │  │
│                              │  │ [Submit]               │  │
│                              │  └────────────────────────┘  │
├──────────────────────────────┴──────────────────────────────┤
│  Control Panel: Sliders (progressive disclosure per tier)    │
│  [Quant ▼] [Context ▼] [Batch ◉] [Topology ▼]              │
│  [Deploy ▶]                          [Consult Guruswami ?]  │
└─────────────────────────────────────────────────────────────┘
```

The codex drawer overlays the right side of the viewport, pushing nothing.
It can be dismissed at any time. Quiz results persist in `ResonanceState`.

---

## Key Design Rules

1. **Every trial teaches exactly one concept.** If a trial teaches two, split it.
2. **Win conditions are pure functions.** `(config: TrialConfig) => boolean` — no side effects, no server calls.
3. **Mastery = all 6 trials complete.** Triggers Lotus Bloom animation + bonus tracks.
4. **Track locking is future work.** Currently all tracks play freely. When GAME mode is implemented, only unlocked tracks play.
5. **The array order IS the curriculum order.** Iterate `TRIAL_DEFINITIONS` for course catalog views.
6. **No model appears out of order.** A future UI should gate Tier N behind Tier N-1 completion.
7. **Spoken word bridges connect tiers.** Level 6 mastery tracks foreshadow the next tier's challenge.
8. **Progressive disclosure is mandatory.** Controls are hidden until the curriculum introduces them.
9. **The Guruswami Codex is optional help, not a gate.** Users can always solve trials by experimentation — the codex rewards reading, not requires it.

---

## Historical Note

This curriculum was designed using **Backward Design** (Wiggins & McTighe) — starting from the
desired end-state (deploying Kimi K2.5 on a 5-node TB5 cluster) and working backward to identify
the prerequisite knowledge at each scaling wall. The model selection and ordering were dictated
entirely by the pedagogical requirements, not by model popularity or release date.

The "problem → solution" rhythm ensures each tier creates a need that the next tier satisfies,
making the progression feel inevitable rather than arbitrary.

The progressive disclosure framework is based on Cognitive Load Theory (Sweller, 1988) and
Dual-Coding Theory (Paivio, 1971), ensuring that gamification physically alters how users
process complex architectural concepts rather than merely sugar-coating a textbook.
