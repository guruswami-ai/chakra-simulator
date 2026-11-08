# Guruswami Codex — Architecture & Implementation

**Status:** V1 infrastructure complete (2026-02-15). Content authoring pending.

---

## What Is the Codex?

The Guruswami Codex is a **progressive educational platform** embedded in the Chakra
Dashboard. It merges documentation, quizzes, and trial progress into a single
pedagogical loop:

```
Theory (Codex) → Quiz (Knowledge Check) → Practice (Sliders) → Reward (Music)
```

It replaces the generic `?` help button with a thematic `BookMarked` icon, replaces
`HelpDocumentation` with a progress-aware knowledge base (`CodexPanel`), and wires
trial state into the content routing so the Codex always opens to the relevant chapter.

---

## The Guruswami Training Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    GURUSWAMI TRAINING LOOP                   │
│                                                              │
│  1. THEORY ─── Codex opens to current trial's chapter       │
│       │         (markdown + diagrams + architecture refs)    │
│       ▼                                                      │
│  2. QUIZ ──── QuizQuestionCard from CodexDrawer.tsx          │
│       │        Pass → hintOnPass revealed + bonusTrack       │
│       ▼                                                      │
│  3. PRACTICE ─ Quiz pass closes Codex, unlocks sliders      │
│       │         User configures dashboard to meet winCondition│
│       ▼                                                      │
│  4. REWARD ── winCondition fires → music track drops         │
│       │        → next trial activates → loop repeats         │
│       └──────────────────────────────────────────────────────┘
```

---

## Three Operational Modes

| Mode | Trigger | Codex Shows | Music | Controls |
|------|---------|-------------|-------|----------|
| **GAME** | `activeTrialId !== null` | Only the active trial's chapter | Unlockable rewards | Restricted to active trial |
| **SIM** | `hasGraduated && !activeTrialId` | Full library up to highest completed tier | Free-play (all unlocked) | Full access |
| **LIVE** | Future (`isLive` prop) | Telemetry reference overlay | Adaptive to TPS | Read-only |

Mode is **derived from state**, not stored. The `CodexContext` computes it automatically:

```typescript
const mode: CodexMode = useMemo(() => {
  if (resonance.activeTrialId) return 'GAME';
  if (resonance.hasGraduated) return 'SIM';
  return 'GAME'; // Default until graduated
}, [resonance.activeTrialId, resonance.hasGraduated]);
```

---

## Architecture

### State Layer

```
ResonanceState (v2, localStorage)
├── models: Record<string, ModelProgress>
│   ├── completedTrials: string[]
│   ├── unlockedTracks: string[]
│   ├── mastered: boolean
│   └── masteryRewards: { continuousMix, vipRemix }
├── activeTrialId: string | null
├── totalTrialsCompleted: number
├── codexProgress: CodexProgress        ← NEW in v2
│   ├── sectionsViewed: string[]
│   ├── quizScores: Record<trialId, { score, total, passedAt }>
│   └── lastOpenedAt: number | null
└── hasGraduated: boolean               ← NEW in v2
```

### Context Layer

```
CodexProvider (app root)
├── wraps useResonanceState() internally
├── derives: mode, currentTier, hasGraduated
├── exposes: openCodex, closeCodex, anchor
├── exposes: resonance, getModelProgress, isTrialCompleted
├── isSectionUnlocked() → always true (V1)
└── backward compat: openHelp/closeHelp aliases
```

### Backward Compatibility Bridge

```
HelpContext.tsx → re-exports CodexProvider as HelpProvider, useCodex as useHelp
```

All existing consumers (`ConceptHelper`, `AppContent`) continue working without changes.

### Tier Derivation

Tier is computed from the ordered model progression:

```
Tier 0: Nothing mastered
Tier 1: qwen25-32b mastered
Tier 2: llama-405b mastered
Tier 3: mixtral-8x7b mastered
Tier 4: deepseek-v3 mastered
Tier 5: kimi-k2.5 mastered (Global Mastery)
```

---

## File Map

| File | Role |
|------|------|
| `hooks/useResonanceState.ts` | State + persistence + migration + trial definitions |
| `components/CodexContext.tsx` | Context provider: mode, tier, graduation |
| `components/CodexPanel.tsx` | Full-screen Codex UI (5 tabs including Trials) |
| `components/HelpContext.tsx` | Backward compat re-export bridge (2 lines) |
| `components/TopBar.tsx` | BookMarked icon entry point |
| `types.ts` | `CodexSectionId` type (superset of `HelpSectionId`) |

---

## Content Routing Map

Each trial's `teaches[]` array maps to existing Codex sections:

| Trial Concept | Codex Section | Tab |
|---|---|---|
| `single-node deployment` | `foundations` | Hardware |
| `quantization` | `arch-instruct` | Intelligence |
| `context window`, `KV cache` | `kv-cache` | Benchmarks |
| `batch vs interactive` | `tps-ttft` | Benchmarks |
| `network latency`, `TP overhead` | `sync-tax` | Benchmarks |
| `when TP helps` | `mesh-ring` | Hardware |
| `GQA KV cache cost` | `mla-compression` | Benchmarks |
| `MoE+MLA combined` | `arch-moe` | Intelligence |
| `expert topology` | `divisibility-wall` | Benchmarks |

When the user opens the Codex during an active trial, the `codexSection` field on
`ConfigTrial` determines which section to auto-navigate to.

---

## Version Migration (v1 → v2)

Existing `GURU-` hash strings and localStorage data auto-migrate on load:

```typescript
function migrateV1(parsed): ResonanceState {
  return {
    ...parsed,
    version: 2,
    codexProgress: DEFAULT_CODEX_PROGRESS,
    hasGraduated: parsed.totalTrialsCompleted >= 30,
  };
}
```

Migration runs in both `loadState()` and `importHash()`.

---

## What V1 Does NOT Include

- **No react-markdown**: Content stays as JSX until chapters are authored
- **No tier-gating**: `isSectionUnlocked()` returns `true` for all sections
- **No rich media**: No charts/videos/animations inside Codex content
- **No `sectionsViewed` tracking**: IntersectionObserver integration is future
- **No `codexHasNew` logic**: Prop exists but defaults to `false`
- **No SimulationPanel wiring**: `checkWinCondition` ↔ slider changes is separate
- **No progressive disclosure**: All controls visible regardless of tier
- **No MDX/markdown library**
- **No actual chapter content**: Infrastructure only

---

## Next Steps (V2: Content Authoring)

1. Author Tier 1 Qwen chapter content (6 trials × markdown)
2. Install react-markdown for content rendering
3. Wire `codexSection` field on each trial definition
4. Implement `sectionsViewed` tracking via IntersectionObserver
5. Wire `checkWinCondition` to SimulationPanel slider changes
6. Implement progressive disclosure (hide controls until tier unlocks them)
7. Add `codexHasNew` derivation (compare `lastOpenedAt` vs trial timestamps)
