import { useState, useCallback } from 'react';

// ── Interfaces ───────────────────────────────────────────────────────

/** Configuration snapshot used to evaluate config trial win conditions */
export interface TrialConfig {
  modelId?: string;
  quant?: string;
  context?: number;
  batch?: boolean;
  topology?: string;
}

/** A quiz question for documentation trials */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

// ── Discriminated Union: Trial Types ─────────────────────────────────

/** Shared properties for all trial types */
interface BaseTrial {
  id: string;
  modelId: string;
  level: number;
  title: string;
  rewardTrack: string;
  teaches: string[];
}

/** Optional deep-dive documentation attached to a config trial */
export interface TrialCodex {
  markdownContent: string;
  quiz: QuizQuestion[];
  hintOnPass: string;
  bonusTrack: string | null;
}

/** Config trial — user sets dashboard sliders to meet a win condition */
export interface ConfigTrial extends BaseTrial {
  type: 'config';
  mission: string;
  hint: string;
  winCondition: (config: TrialConfig) => boolean;
  codex?: TrialCodex;
  /** Which Codex section to auto-open when this trial is active */
  codexSection?: string;
}

/** Documentation trial — user reads content and passes a quiz */
export interface DocumentationTrial extends BaseTrial {
  type: 'quiz';
  markdownContent: string;
  quiz: QuizQuestion[];
}

/** The discriminated union — React checks trial.type to narrow */
export type TrialDefinition = ConfigTrial | DocumentationTrial;

/** Mastery-tier bonus rewards (unlocked when all model trials complete) */
export interface MasteryRewards {
  continuousMix: string | null;
  vipRemix: string | null;
}

/** Per-model progress tracker */
export interface ModelProgress {
  completedTrials: string[];
  unlockedTracks: string[];
  mastered: boolean;
  masteryUnlockedAt: number | null;
  masteryRewards: MasteryRewards;
}

/** Codex reading/quiz progress (added in v2) */
export interface CodexProgress {
  sectionsViewed: string[];
  quizScores: Record<string, { score: number; total: number; passedAt: number | null }>;
  lastOpenedAt: number | null;
}

/** Top-level resonance state persisted to localStorage */
export interface ResonanceState {
  version: 2;
  models: Record<string, ModelProgress>;
  activeTrialId: string | null;
  totalTrialsCompleted: number;
  codexProgress: CodexProgress;
  hasGraduated: boolean;
}

// ── Trial Definitions ────────────────────────────────────────────────

export const TRIAL_DEFINITIONS: TrialDefinition[] = [
  // ─── Qwen 32B — Beginner Boot Camp (Dense Model Fundamentals) ────
  // Teaches: single-node deployment → quantization → context → batch → topology trap → EP5 mastery
  // Must be completed before MoE models make sense
  {
    id: 'qwen-first-breath',
    type: 'config',
    modelId: 'qwen25-32b',
    level: 1,
    title: 'The First Breath',
    mission: 'Before we run, we must learn to stand. This mind is dense, but small enough to be carried by a single host. Awaken it on one machine, and prepare it for a simple, fast conversation.',
    hint: 'Deploy Qwen 32B on a single node in interactive mode — no distribution needed.',
    rewardTrack: 'the-unbroken-wall',
    teaches: ['single-node deployment', 'EP1 topology', 'dense model basics'],
    winCondition: (c) => {
      const isQwen = c.modelId?.includes('qwen') || c.modelId?.includes('32b') || false;
      const isSingleNode = !c.topology?.includes('TP') && !c.topology?.includes('PP');
      const isInteractive = !c.batch;
      return isQwen && isSingleNode && isInteractive;
    },
  },
  {
    id: 'qwen-sharpening',
    type: 'config',
    modelId: 'qwen25-32b',
    level: 2,
    title: 'Sharpening the Mind',
    mission: 'The mind is awake, but it is heavy. By compressing its weights, we lose a fraction of a percent of perfection, but we double its speed. Compress the scholar so it may think faster.',
    hint: 'Apply Q4 quantization to Qwen 32B on a single node to see the speed improvement.',
    rewardTrack: 'the-razors-edge',
    teaches: ['quantization', 'VRAM reduction', 'TPS vs quality tradeoff'],
    winCondition: (c) => {
      const isQwen = c.modelId?.includes('qwen') || c.modelId?.includes('32b') || false;
      const isQ4 = c.quant === 'Q4';
      const isSingleNode = !c.topology?.includes('TP') && !c.topology?.includes('PP');
      return isQwen && isQ4 && isSingleNode;
    },
  },
  {
    id: 'qwen-working-memory',
    type: 'config',
    modelId: 'qwen25-32b',
    level: 3,
    title: 'The Working Memory',
    mission: 'A conversation requires memory, but holding onto the past consumes the present. We are writing code today. Expand the scholar\'s context just enough to hold a script, but no larger.',
    hint: 'Set the context window to 8K tokens in interactive mode for code generation.',
    rewardTrack: 'the-syntax-engine',
    teaches: ['context window', 'KV cache VRAM cost', 'right-sizing context'],
    winCondition: (c) => {
      const isQwen = c.modelId?.includes('qwen') || c.modelId?.includes('32b') || false;
      const is8K = (c.context || 4096) >= 8192;
      const isInteractive = !c.batch;
      return isQwen && is8K && isInteractive;
    },
  },
  {
    id: 'qwen-midnight-oil',
    type: 'config',
    modelId: 'qwen25-32b',
    level: 4,
    title: 'The Midnight Oil',
    mission: 'We are no longer speaking face-to-face. I have a thousand documents to process by morning. Shift the mind from instant reflexes to maximum throughput.',
    hint: 'Switch to batch mode — sacrifice latency for throughput when processing many documents.',
    rewardTrack: 'the-wide-horizon',
    teaches: ['batch vs interactive', 'throughput optimization', 'TTFT vs total throughput'],
    winCondition: (c) => {
      const isQwen = c.modelId?.includes('qwen') || c.modelId?.includes('32b') || false;
      const isBatch = c.batch === true;
      return isQwen && isBatch;
    },
  },
  {
    id: 'qwen-topology-trap',
    type: 'config',
    modelId: 'qwen25-32b',
    level: 5,
    title: 'The Topology Trap',
    mission: 'A novice believes that using five machines is always faster than one. But to slice a small mind across five nodes is to force it to constantly whisper across the network. Prove you understand the trap. To make this single model run its absolute fastest, where must it live?',
    hint: 'More nodes is not always faster. Try single-node — network latency destroys small-model TP performance.',
    rewardTrack: 'the-topology-trap',
    teaches: ['network latency', 'TP overhead', 'when NOT to distribute'],
    // The trap: user tries TP and sees TPS crash. Win = returning to single node.
    winCondition: (c) => {
      const isQwen = c.modelId?.includes('qwen') || c.modelId?.includes('32b') || false;
      const isSingleNode = !c.topology?.includes('TP') && !c.topology?.includes('PP');
      const isQ4 = c.quant === 'Q4';
      return isQwen && isSingleNode && isQ4;
    },
  },
  {
    id: 'qwen-true-swarm',
    type: 'config',
    modelId: 'qwen25-32b',
    level: 6,
    title: 'The True Swarm',
    mission: 'You have learned that splitting the mind slows it down. But we still have five machines, and we have five thousand users waiting to speak. Do not split the mind. Multiply it.',
    hint: 'Embarrassingly Parallel: run 5 independent copies of the model, one per node. EP5 topology.',
    rewardTrack: 'this-song-extended',
    teaches: ['embarrassingly parallel', 'EP vs TP', 'horizontal scaling for dense models'],
    // EP5 = 5 independent copies. Aspirational until dashboard adds EP topology selector.
    winCondition: (c) => {
      const isQwen = c.modelId?.includes('qwen') || c.modelId?.includes('32b') || false;
      const isEP5 = c.topology?.includes('EP5') || c.topology?.includes('EP 5') || false;
      return isQwen && isEP5;
    },
  },

  // ─── Llama 405B — The Immovable Object (Dense at Scale) ──────────
  // Tier 2: The mirror of Qwen. The user applies their Tier 1 knowledge
  // ("keep it on one node") and the system CRASHES. 405B dense doesn't fit
  // comfortably on one node. TP becomes a necessity, not a luxury.
  {
    id: 'llama-sleeping-giant',
    type: 'config',
    modelId: 'llama-405b',
    level: 1,
    title: 'The Sleeping Giant',
    mission: 'The leviathan sleeps in four hundred and five billion weights. It is dense — every parameter fires for every token. Try to carry it on a single host. Feel the strain. This is the lesson Qwen could not teach you.',
    hint: 'Deploy Llama 405B at Q4 on a single node. It technically fits in 512GB, but barely.',
    rewardTrack: 'the-sleeping-giant',
    teaches: ['dense model scale limits', 'memory pressure', 'single-node ceiling'],
    winCondition: (c) => {
      const isLlama = c.modelId?.includes('llama') || c.modelId?.includes('405') || false;
      const isSingleNode = !c.topology?.includes('TP') && !c.topology?.includes('PP');
      const isQ4 = c.quant === 'Q4';
      return isLlama && isSingleNode && isQ4;
    },
  },
  {
    id: 'llama-necessary-split',
    type: 'config',
    modelId: 'llama-405b',
    level: 2,
    title: 'The Necessary Split',
    mission: 'You felt the strain. Now divide the weight across two hosts. Watch the latency drop — not because the network is fast, but because the memory pressure is halved. This is why Tensor Parallelism exists.',
    hint: 'Deploy Llama 405B at Q4 across TP2. Memory pressure halves, speed doubles.',
    rewardTrack: 'the-necessary-split',
    teaches: ['when TP helps', 'memory bandwidth bottleneck', 'Qwen topology trap reversal'],
    winCondition: (c) => {
      const isLlama = c.modelId?.includes('llama') || c.modelId?.includes('405') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP2 = tpCount === 2;
      const isQ4 = c.quant === 'Q4';
      return isLlama && isTP2 && isQ4;
    },
  },
  {
    id: 'llama-weight-of-precision',
    type: 'config',
    modelId: 'llama-405b',
    level: 3,
    title: 'The Weight of Precision',
    mission: 'You compressed the giant to Q4, trading precision for speed. But four hundred billion parameters lose more than Qwen\'s thirty-two billion did. Now give it Q8 fidelity across two hosts. Feel the difference in its reasoning.',
    hint: 'Q8 at TP2 — ~430GB split across two 512GB nodes. The quality improvement is measurable.',
    rewardTrack: 'the-weight-of-precision',
    teaches: ['quantization debt at scale', 'Q4 vs Q8 quality', 'precision-memory tradeoff'],
    winCondition: (c) => {
      const isLlama = c.modelId?.includes('llama') || c.modelId?.includes('405') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP2 = tpCount === 2;
      const isQ8 = c.quant === 'Q8';
      return isLlama && isTP2 && isQ8;
    },
  },
  {
    id: 'llama-leviathan-stride',
    type: 'config',
    modelId: 'llama-405b',
    level: 4,
    title: "The Leviathan's Stride",
    mission: 'Two nodes carried the weight. But four nodes give the leviathan room to breathe. With memory pressure at a quarter, the Metal GPU can focus entirely on computation. Set it to interactive mode and feel the latency drop.',
    hint: 'TP4 with interactive mode — only ~54GB per node leaves massive headroom for KV cache.',
    rewardTrack: 'the-leviathans-stride',
    teaches: ['TP4 memory headroom', 'latency optimization', 'compute vs memory bottleneck'],
    winCondition: (c) => {
      const isLlama = c.modelId?.includes('llama') || c.modelId?.includes('405') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP4 = tpCount >= 4;
      const isInteractive = !c.batch;
      return isLlama && isTP4 && isInteractive;
    },
  },
  {
    id: 'llama-dense-horizon',
    type: 'config',
    modelId: 'llama-405b',
    level: 5,
    title: 'The Dense Horizon',
    mission: 'Now push the context deep — eight thousand tokens, enough to hold an entire codebase in the leviathan\'s gaze. Switch to batch mode. This is the practical deployment: maximum throughput on a dense model that sees everything at once.',
    hint: 'TP4 + batch mode + 8K context. Feel how GQA attention limits further context expansion.',
    rewardTrack: 'the-dense-horizon',
    teaches: ['GQA KV cache cost', 'dense context limits', 'why MLA was invented'],
    winCondition: (c) => {
      const isLlama = c.modelId?.includes('llama') || c.modelId?.includes('405') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP4 = tpCount >= 4;
      const is8K = (c.context || 4096) >= 8192;
      const isBatch = c.batch === true;
      return isLlama && isTP4 && is8K && isBatch;
    },
  },
  {
    id: 'llama-iron-throne',
    type: 'config',
    modelId: 'llama-405b',
    level: 6,
    title: 'The Iron Throne',
    mission: 'You carried the leviathan from a single struggling node to a four-node throne of optimized batch inference. You understand that dense models demand distribution, that precision costs memory, and that the KV cache is the hidden weight. The iron throne is yours.',
    hint: 'The mastery configuration: TP4 + Q4 + batch mode. Maximum throughput for the largest open-weight dense model.',
    rewardTrack: 'the-iron-throne',
    teaches: ['dense-at-scale mastery', 'optimal TP4 deployment', 'ready for MoE'],
    winCondition: (c) => {
      const isLlama = c.modelId?.includes('llama') || c.modelId?.includes('405') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP4 = tpCount >= 4;
      const isQ4 = c.quant === 'Q4';
      const isBatch = c.batch === true;
      return isLlama && isTP4 && isQ4 && isBatch;
    },
  },

  // ─── Mixtral 8x7B — The Illusion of Weight (Sparse MoE Intro) ───
  // Tier 3: After struggling with 405B dense, the user discovers MoE.
  // 47B total but only 13B active — the decoupling of intelligence from
  // compute cost. "Total parameters dictate VRAM; active parameters dictate speed."
  {
    id: 'mixtral-fast-twitch',
    type: 'config',
    modelId: 'mixtral-8x7b',
    level: 1,
    title: 'The Fast Twitch',
    mission: 'The agent must react before the adversary blinks. Strip the model to its fighting weight — lowest latency, tightest context. Show me a mind that moves like lightning.',
    hint: 'Try Mixtral with Q4 quantization, interactive mode, and a short context window.',
    rewardTrack: 'the-low-latency-agent',
    teaches: ['quantization-speed tradeoff', 'latency optimization', 'agent loop design'],
    winCondition: (c) => {
      const isMixtral = c.modelId?.includes('mixtral') || false;
      const isQ4 = c.quant === 'Q4';
      const isInteractive = !c.batch;
      const isShortCtx = (c.context || 4096) <= 2048;
      return isMixtral && isQ4 && isInteractive && isShortCtx;
    },
  },
  {
    id: 'mixtral-logic-builder',
    type: 'config',
    modelId: 'mixtral-8x7b',
    level: 2,
    title: 'The Logic Builder',
    mission: 'Code is crystallized thought. The compiler demands precision — give the model enough fidelity to reason about syntax, and enough context to hold a full module in mind.',
    hint: 'Mixtral needs Q6 quality and an 8K context window for reliable code generation.',
    rewardTrack: 'the-code-compiler',
    teaches: ['quantization fidelity', 'code generation context', 'Q6 precision benefits'],
    winCondition: (c) => {
      const isMixtral = c.modelId?.includes('mixtral') || false;
      const isQ6 = c.quant === 'Q6';
      const is8K = (c.context || 4096) >= 8192;
      return isMixtral && isQ6 && is8K;
    },
  },
  {
    id: 'mixtral-universal-translator',
    type: 'config',
    modelId: 'mixtral-8x7b',
    level: 3,
    title: 'The Universal Translator',
    mission: 'Five languages in a single breath — the polyglot must hold parallel grammars in working memory. Batch processing lets us feed entire documents. Give it room to think across tongues.',
    hint: 'Enable batch mode with a 16K context window for multilingual document processing.',
    rewardTrack: 'the-polyglot',
    teaches: ['batch inference', 'multilingual context', 'throughput vs latency'],
    winCondition: (c) => {
      const isMixtral = c.modelId?.includes('mixtral') || false;
      const isBatch = c.batch === true;
      const is16K = (c.context || 4096) >= 16384;
      return isMixtral && isBatch && is16K;
    },
  },
  {
    id: 'mixtral-deep-archive',
    type: 'config',
    modelId: 'mixtral-8x7b',
    level: 4,
    title: 'The Deep Archive',
    mission: 'The retrieval engine must hold an entire archive in its gaze — 32,000 tokens of dense corporate memory. This requires batch processing and the distributed strength of multiple nodes.',
    hint: 'You need batch mode, 32K context, and a multi-node topology (TP2+).',
    rewardTrack: 'the-deep-retrieval',
    teaches: ['long-context RAG', 'distributed inference', 'KV cache pressure'],
    winCondition: (c) => {
      const isMixtral = c.modelId?.includes('mixtral') || false;
      const is32K = (c.context || 4096) >= 32768;
      const isBatch = c.batch === true;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isMultiNode = tpCount >= 2;
      return isMixtral && is32K && isBatch && isMultiNode;
    },
  },
  {
    id: 'mixtral-obedient-scribe',
    type: 'config',
    modelId: 'mixtral-8x7b',
    level: 5,
    title: 'The Obedient Scribe',
    mission: 'Instruction-following demands the highest fidelity — every nuance of the prompt must survive quantization. Q8 preserves the full weight spectrum. Interactive mode keeps the feedback loop tight.',
    hint: 'Q8 quantization with interactive mode gives Mixtral the best instruction-following fidelity.',
    rewardTrack: 'the-instruction-follower',
    teaches: ['Q8 fidelity', 'instruction following', 'quantization vs quality'],
    winCondition: (c) => {
      const isMixtral = c.modelId?.includes('mixtral') || false;
      const isQ8 = c.quant === 'Q8';
      const isInteractive = !c.batch;
      return isMixtral && isQ8 && isInteractive;
    },
  },
  {
    id: 'mixtral-sovereign-mind',
    type: 'config',
    modelId: 'mixtral-8x7b',
    level: 6,
    title: 'The Sovereign Mind',
    mission: 'The open-weight rebel runs free — no cloud dependency, no API keys, no data leaving the premises. Deploy the full mesh and prove that sovereign inference is not just possible, but optimal.',
    hint: 'Deploy Mixtral across the full mesh topology and ensure it fits entirely in VRAM.',
    rewardTrack: 'the-open-weight-rebel',
    teaches: ['local inference sovereignty', 'full mesh topology', 'VRAM capacity planning'],
    winCondition: (c) => {
      const isMixtral = c.modelId?.includes('mixtral') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isFullMesh = tpCount >= 4;
      const fitsVRAM = c.quant === 'Q4' || c.quant === 'Q3' || c.quant === 'Q2';
      return isMixtral && isFullMesh && fitsVRAM;
    },
  },

  // ─── DeepSeek V3 — The Memory Fold (MoE+MLA) ──────────────────────
  // Tier 4: The KV cache bottleneck. Mixtral proved MoE works, but standard
  // attention still chokes at long context. MLA compresses the KV cache 28-57x,
  // proving that architectural elegance (folding memory) is as powerful as
  // brute-force scaling (adding nodes). Prepares the user for Kimi's 1T finale.
  {
    id: 'deepseek-first-movement',
    type: 'config',
    modelId: 'deepseek-v3',
    level: 1,
    title: 'The First Movement',
    mission: 'You felt the weight of four hundred billion dense parameters. Now meet six hundred and seventy-one billion — but only thirty-seven billion will fire. DeepSeek combines sparse routing with a new kind of memory. Deploy it across the mesh and listen to the difference.',
    hint: 'Deploy DeepSeek V3 at Q4 across TP4. Despite being 671B, it runs lighter than Llama 405B.',
    rewardTrack: 'the-first-movement',
    teaches: ['MoE+MLA combined', '671B total / 37B active', 'architectural efficiency'],
    winCondition: (c) => {
      const isDeepSeek = c.modelId?.includes('deepseek') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP4 = tpCount >= 4;
      const isQ4 = c.quant === 'Q4';
      return isDeepSeek && isTP4 && isQ4;
    },
  },
  {
    id: 'deepseek-latent-compression',
    type: 'config',
    modelId: 'deepseek-v3',
    level: 2,
    title: 'The Latent Compression',
    mission: 'Llama\'s attention cached every key and value at full dimension — that is why its context window choked. DeepSeek compresses the cache into a latent space, shrinking it by a factor of forty. Push the context to thirty-two thousand tokens on just two nodes. Watch what Llama could not do.',
    hint: 'TP2 + 32K context. MLA compresses the KV cache so dramatically that 32K fits where Llama struggled with 8K.',
    rewardTrack: 'the-latent-compression',
    teaches: ['MLA KV cache compression', 'GQA vs MLA', '28-57x compression ratio'],
    winCondition: (c) => {
      const isDeepSeek = c.modelId?.includes('deepseek') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP2 = tpCount === 2;
      const is32K = (c.context || 4096) >= 32768;
      return isDeepSeek && isTP2 && is32K;
    },
  },
  {
    id: 'deepseek-expert-fugue',
    type: 'config',
    modelId: 'deepseek-v3',
    level: 3,
    title: 'The Expert Fugue',
    mission: 'Mixtral chose two experts from eight — a simple vote. DeepSeek consults two hundred and fifty-six, plus a shared expert that always speaks. Like voices in a fugue, each expert carries a different thread of the computation. Set the model to interactive mode and feel how the routing shapes the response.',
    hint: 'Interactive mode + Q4. Compare per-token latency to Mixtral — 256 experts vs 8.',
    rewardTrack: 'the-expert-fugue',
    teaches: ['256 routed experts + 1 shared', 'expert topology depth', 'auxiliary-loss-free balancing'],
    winCondition: (c) => {
      const isDeepSeek = c.modelId?.includes('deepseek') || false;
      const isInteractive = !c.batch;
      const isQ4 = c.quant === 'Q4';
      return isDeepSeek && isInteractive && isQ4;
    },
  },
  {
    id: 'deepseek-infinite-score',
    type: 'config',
    modelId: 'deepseek-v3',
    level: 4,
    title: 'The Infinite Score',
    mission: 'One hundred and twenty-eight thousand tokens — the length of a novel. Standard attention would need terabytes of cache to hold this context. MLA compresses it to gigabytes. Push the context to its maximum in batch mode and process an entire corpus in a single pass.',
    hint: 'Push context to 128K tokens + batch mode. This is what MLA was designed for.',
    rewardTrack: 'the-infinite-score',
    teaches: ['128K context with MLA', 'KV cache at extreme context', 'throughput at scale'],
    winCondition: (c) => {
      const isDeepSeek = c.modelId?.includes('deepseek') || false;
      const isBatch = c.batch === true;
      const is128K = (c.context || 4096) >= 131072;
      return isDeepSeek && isBatch && is128K;
    },
  },
  {
    id: 'deepseek-balanced-orchestra',
    type: 'config',
    modelId: 'deepseek-v3',
    level: 5,
    title: 'The Balanced Orchestra',
    mission: 'An orchestra with two hundred and fifty-six musicians requires a conductor who ensures no section is overworked. DeepSeek\'s auxiliary-loss-free balancing achieves this without the crude penalty terms other models use. Deploy at Q8 fidelity across four nodes in batch mode — maximum precision, maximum throughput.',
    hint: 'TP4 + Q8 + batch mode. Q8 preserves routing precision across 256 experts.',
    rewardTrack: 'the-balanced-orchestra',
    teaches: ['expert load balancing', 'auxiliary-loss-free training', 'Q8 MoE precision'],
    winCondition: (c) => {
      const isDeepSeek = c.modelId?.includes('deepseek') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP4 = tpCount >= 4;
      const isQ8 = c.quant === 'Q8';
      const isBatch = c.batch === true;
      return isDeepSeek && isTP4 && isQ8 && isBatch;
    },
  },
  {
    id: 'deepseek-grand-unification',
    type: 'config',
    modelId: 'deepseek-v3',
    level: 6,
    title: 'The Grand Unification',
    mission: 'You have seen what the leviathan could not do — hold a novel in its gaze. You have heard the fugue of two hundred and fifty-six experts. You have witnessed the latent compression that turned terabytes into gigabytes. Now unify every lesson: full mesh, maximum context, batch throughput. The grand unification prepares you for the final movement — one trillion parameters.',
    hint: 'The mastery configuration: TP4 + 128K context + batch mode. Every MoE+MLA lesson combined.',
    rewardTrack: 'the-grand-unification',
    teaches: ['MoE+MLA mastery', 'complete architectural understanding', 'ready for 1T'],
    winCondition: (c) => {
      const isDeepSeek = c.modelId?.includes('deepseek') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isTP4 = tpCount >= 4;
      const is128K = (c.context || 4096) >= 131072;
      const isBatch = c.batch === true;
      return isDeepSeek && isTP4 && is128K && isBatch;
    },
  },

  // ─── Kimi K2.5 — The Titan (Final Boss) ───────────────────────────
  // Tier 5: All walls simultaneously. 1T MoE+MLA+Vision+Swarm across
  // the full 5-node TB5 mesh. Every slider must be correct or the
  // network bottlenecks, VRAM spills over, or the Metal API times out.
  {
    id: 'kimi-leviathans-wake',
    type: 'config',
    modelId: 'kimi-k2.5',
    level: 1,
    title: "Leviathan's Wake",
    mission: 'One trillion parameters — a mind so vast it spans five machines. Awaken the leviathan across the full Thunderbolt mesh. Compress it to Q4 so it fits in the VRAM ocean.',
    hint: 'Kimi K2.5 needs all 5 nodes (TP4+ or full mesh) at Q4 quantization.',
    rewardTrack: 'the-trillion-node-sphere',
    teaches: ['trillion-parameter models', 'full mesh deployment', 'Q4 compression for MoE'],
    winCondition: (c) => {
      const isKimi = c.modelId?.includes('kimi') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isFullMesh = tpCount >= 4;
      const isQ4 = c.quant === 'Q4';
      return isKimi && isFullMesh && isQ4;
    },
  },
  {
    id: 'kimi-efficient-spark',
    type: 'config',
    modelId: 'kimi-k2.5',
    level: 2,
    title: 'The Efficient Spark',
    mission: 'One trillion parameters, yet only 32 billion fire at once — the miracle of sparse routing. Set the model to interactive mode and witness how MoE activates only what it needs.',
    hint: 'Run Kimi in interactive mode to see sparse MoE routing in action.',
    rewardTrack: 'the-active-spark',
    teaches: ['sparse MoE routing', 'active vs total parameters', 'inference efficiency'],
    winCondition: (c) => {
      const isKimi = c.modelId?.includes('kimi') || false;
      const isInteractive = !c.batch;
      return isKimi && isInteractive;
    },
  },
  {
    id: 'kimi-endless-scroll',
    type: 'config',
    modelId: 'kimi-k2.5',
    level: 3,
    title: 'The Endless Scroll',
    mission: 'Multi-Latent Attention compresses the key-value cache to a fraction of its size — the secret to 256K context. Push the context to its maximum and batch-process an entire library.',
    hint: 'Enable batch mode and push the context window to 256K tokens.',
    rewardTrack: 'the-deep-memory',
    teaches: ['MLA attention', 'KV cache compression', '256K context windows'],
    winCondition: (c) => {
      const isKimi = c.modelId?.includes('kimi') || false;
      const isBatch = c.batch === true;
      const isMaxCtx = (c.context || 4096) >= 131072;
      return isKimi && isBatch && isMaxCtx;
    },
  },
  {
    id: 'kimi-seeing-eye',
    type: 'config',
    modelId: 'kimi-k2.5',
    level: 4,
    title: 'The Seeing Eye',
    mission: 'MoonViT gives the leviathan sight — a 400-million parameter vision encoder fused into the trillion-parameter mind. Enable multimodal mode and let it see.',
    hint: 'This trial requires multimodal/vision capabilities — not yet available in dashboard controls.',
    rewardTrack: 'the-attention-gaze',
    teaches: ['multimodal inference', 'vision encoders', 'MoonViT architecture'],
    // Aspirational: requires future dashboard controls for vision mode
    winCondition: (c) => {
      const isKimi = c.modelId?.includes('kimi') || false;
      // Future: check for multimodal flag when dashboard supports it
      const hasVision = (c as Record<string, unknown>).multimodal === true;
      return isKimi && hasVision;
    },
  },
  {
    id: 'kimi-council-384',
    type: 'config',
    modelId: 'kimi-k2.5',
    level: 5,
    title: 'The Council of 384',
    mission: '384 experts across 61 layers — the deepest topology in any production model. Give it Q8 fidelity so every expert speaks with full precision, and configure top-K routing to select the wisest council.',
    hint: 'Q8 quantization preserves expert weight precision. Top-K routing is not yet configurable.',
    rewardTrack: 'the-fabric-of-the-mind',
    teaches: ['expert topology', 'Q8 for MoE precision', 'top-K routing strategies'],
    // Aspirational: requires future top-K routing controls
    winCondition: (c) => {
      const isKimi = c.modelId?.includes('kimi') || false;
      const isQ8 = c.quant === 'Q8';
      const hasTopK = (c as Record<string, unknown>).topKRouting === true;
      return isKimi && isQ8 && hasTopK;
    },
  },
  {
    id: 'kimi-swarm-orchestrator',
    type: 'config',
    modelId: 'kimi-k2.5',
    level: 6,
    title: 'The Swarm Orchestrator',
    mission: 'The ultimate configuration — agent swarm mode across the maximum topology. The leviathan becomes a hive mind, each agent a specialized limb of a distributed intelligence.',
    hint: 'Agent swarm mode requires future dashboard controls. Deploy at maximum topology to prepare.',
    rewardTrack: 'the-breath-of-the-guru',
    teaches: ['agent swarm orchestration', 'maximum topology', 'distributed intelligence'],
    // Aspirational: requires future agent swarm controls
    winCondition: (c) => {
      const isKimi = c.modelId?.includes('kimi') || false;
      const tpCount = parseInt(c.topology?.match(/TP(\d+)/)?.[1] || '1');
      const isMaxTopo = tpCount >= 4;
      const hasSwarm = (c as Record<string, unknown>).agentSwarm === true;
      return isKimi && isMaxTopo && hasSwarm;
    },
  },
];

// ── Default State ────────────────────────────────────────────────────

const EMPTY_MODEL_PROGRESS: ModelProgress = {
  completedTrials: [],
  unlockedTracks: [],
  mastered: false,
  masteryUnlockedAt: null,
  masteryRewards: { continuousMix: null, vipRemix: null },
};

const DEFAULT_CODEX_PROGRESS: CodexProgress = {
  sectionsViewed: [],
  quizScores: {},
  lastOpenedAt: null,
};

const DEFAULT_RESONANCE_STATE: ResonanceState = {
  version: 2,
  models: {
    'qwen25-32b': { ...EMPTY_MODEL_PROGRESS },
    'mixtral-8x7b': { ...EMPTY_MODEL_PROGRESS },
    'kimi-k2.5': { ...EMPTY_MODEL_PROGRESS },
    'deepseek-v3': { ...EMPTY_MODEL_PROGRESS },
    'llama-405b': { ...EMPTY_MODEL_PROGRESS },
  },
  activeTrialId: null,
  totalTrialsCompleted: 0,
  codexProgress: { ...DEFAULT_CODEX_PROGRESS },
  hasGraduated: false,
};

// ── Persistence ──────────────────────────────────────────────────────

const STORAGE_KEY = 'chakra-resonance-state';

/** Migrate v1 state to v2 by adding codexProgress and hasGraduated */
function migrateV1(parsed: Record<string, unknown>): ResonanceState {
  const v1 = parsed as Omit<ResonanceState, 'version' | 'codexProgress' | 'hasGraduated'>;
  return {
    ...v1,
    version: 2,
    codexProgress: { ...DEFAULT_CODEX_PROGRESS },
    hasGraduated: (v1.totalTrialsCompleted ?? 0) >= 30,
  } as ResonanceState;
}

function loadState(): ResonanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_RESONANCE_STATE);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version === 1) return migrateV1(parsed);
    if (parsed.version !== 2) return structuredClone(DEFAULT_RESONANCE_STATE);
    return parsed as unknown as ResonanceState;
  } catch {
    return structuredClone(DEFAULT_RESONANCE_STATE);
  }
}

function saveState(state: ResonanceState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently degrade
  }
}

// ── Resonance Hash (cross-device portability) ────────────────────────

export function exportHash(state: ResonanceState): string {
  return 'GURU-' + btoa(JSON.stringify(state));
}

export function importHash(hash: string): ResonanceState | null {
  try {
    if (!hash.startsWith('GURU-')) return null;
    const decoded = JSON.parse(atob(hash.slice(5))) as Record<string, unknown>;
    if (decoded.version === 1) return migrateV1(decoded);
    if (decoded.version !== 2) return null;
    return decoded as unknown as ResonanceState;
  } catch {
    return null;
  }
}

// ── Mastery Check ────────────────────────────────────────────────────

function checkMastery(progress: ModelProgress, modelId: string): ModelProgress {
  const modelTrials = TRIAL_DEFINITIONS.filter(t => t.modelId === modelId);
  const allComplete = modelTrials.length > 0 &&
    modelTrials.every(t => progress.completedTrials.includes(t.id));

  if (allComplete && !progress.mastered) {
    return {
      ...progress,
      mastered: true,
      masteryUnlockedAt: Date.now(),
      masteryRewards: {
        continuousMix: `${modelId}-continuous-mix`,
        vipRemix: `${modelId}-vip-remix`,
      },
    };
  }
  return progress;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useResonanceState() {
  const [state, setState] = useState<ResonanceState>(loadState);

  const persist = useCallback((next: ResonanceState) => {
    setState(next);
    saveState(next);
  }, []);

  /** Mark a trial as completed and unlock its reward track */
  const completeTrial = useCallback((trialId: string, modelId: string, rewardTrack: string) => {
    setState(prev => {
      const model = prev.models[modelId] || { ...EMPTY_MODEL_PROGRESS };
      if (model.completedTrials.includes(trialId)) return prev; // idempotent

      const updated: ModelProgress = {
        ...model,
        completedTrials: [...model.completedTrials, trialId],
        unlockedTracks: [...model.unlockedTracks, rewardTrack],
      };

      const withMastery = checkMastery(updated, modelId);

      const next: ResonanceState = {
        ...prev,
        models: { ...prev.models, [modelId]: withMastery },
        totalTrialsCompleted: prev.totalTrialsCompleted + 1,
      };
      saveState(next);
      return next;
    });
  }, []);

  /** Check quiz answers and complete the trial if all correct */
  const checkQuizAnswers = useCallback((trialId: string, answers: number[]): { passed: boolean; correctCount: number; total: number } => {
    const trial = TRIAL_DEFINITIONS.find(t => t.id === trialId);
    if (!trial || trial.type !== 'quiz') return { passed: false, correctCount: 0, total: 0 };

    const total = trial.quiz.length;
    const correctCount = trial.quiz.filter((q, i) => answers[i] === q.correctAnswerIndex).length;
    const passed = correctCount === total;

    if (passed) {
      completeTrial(trialId, trial.modelId, trial.rewardTrack);
    }

    return { passed, correctCount, total };
  }, [completeTrial]);

  /** Check if a specific track is unlocked (across all models) */
  const isTrackUnlocked = useCallback((trackName: string): boolean => {
    return (Object.values(state.models) as ModelProgress[]).some(m => m.unlockedTracks.includes(trackName));
  }, [state]);

  /** Check if a specific trial has been completed */
  const isTrialCompleted = useCallback((trialId: string): boolean => {
    return (Object.values(state.models) as ModelProgress[]).some(m => m.completedTrials.includes(trialId));
  }, [state]);

  /** Get progress for a specific model */
  const getModelProgress = useCallback((modelId: string): ModelProgress => {
    return state.models[modelId] || { ...EMPTY_MODEL_PROGRESS };
  }, [state]);

  /** Get the currently active trial definition (or null) */
  const getActiveTrial = useCallback((): TrialDefinition | null => {
    if (!state.activeTrialId) return null;
    return TRIAL_DEFINITIONS.find(t => t.id === state.activeTrialId) || null;
  }, [state.activeTrialId]);

  /** Set the active trial (or null to deactivate) */
  const setActiveTrial = useCallback((trialId: string | null) => {
    persist({ ...state, activeTrialId: trialId });
  }, [state, persist]);

  /** Check if current config wins the active trial (config trials only) */
  const checkWinCondition = useCallback((config: TrialConfig): { won: boolean; trial: TrialDefinition | null } => {
    if (!state.activeTrialId) return { won: false, trial: null };
    const trial = TRIAL_DEFINITIONS.find(t => t.id === state.activeTrialId);
    if (!trial || trial.type !== 'config') return { won: false, trial: null };
    return { won: trial.winCondition(config), trial };
  }, [state.activeTrialId]);

  /** Export state as a portable hash string */
  const doExportHash = useCallback((): string => {
    return exportHash(state);
  }, [state]);

  /** Import state from a hash string — returns true on success */
  const doImportHash = useCallback((hash: string): boolean => {
    const imported = importHash(hash);
    if (!imported) return false;
    persist(imported);
    return true;
  }, [persist]);

  /** Record that a Codex section was viewed */
  const markSectionViewed = useCallback((sectionId: string) => {
    setState(prev => {
      if (prev.codexProgress.sectionsViewed.includes(sectionId)) return prev;
      const next: ResonanceState = {
        ...prev,
        codexProgress: {
          ...prev.codexProgress,
          sectionsViewed: [...prev.codexProgress.sectionsViewed, sectionId],
        },
      };
      saveState(next);
      return next;
    });
  }, []);

  /** Record a quiz score for a trial */
  const recordQuizScore = useCallback((trialId: string, score: number, total: number) => {
    setState(prev => {
      const passed = score === total;
      const next: ResonanceState = {
        ...prev,
        codexProgress: {
          ...prev.codexProgress,
          quizScores: {
            ...prev.codexProgress.quizScores,
            [trialId]: { score, total, passedAt: passed ? Date.now() : null },
          },
        },
      };
      saveState(next);
      return next;
    });
  }, []);

  /** Mark the user as graduated (all 30 trials complete) */
  const graduate = useCallback(() => {
    setState(prev => {
      if (prev.hasGraduated) return prev;
      const next: ResonanceState = { ...prev, hasGraduated: true };
      saveState(next);
      return next;
    });
  }, []);

  return {
    state,
    completeTrial,
    checkQuizAnswers,
    isTrackUnlocked,
    isTrialCompleted,
    getModelProgress,
    getActiveTrial,
    setActiveTrial,
    checkWinCondition,
    markSectionViewed,
    recordQuizScore,
    graduate,
    exportHash: doExportHash,
    importHash: doImportHash,
    TRIAL_DEFINITIONS,
  };
}
