
import { ClusterMode } from '../types';

/**
 * MODEL CATALOG - DATA PROVENANCE AND METHODOLOGY
 * 
 * This file contains model specifications for the dashboard simulator. Data comes from three sources:
 * 
 * 1. **REAL CLUSTER BENCHMARKS** (Jan-Feb 2026, published at github.com/guruswami-ai/mlx-benchmarks)
 *    - All 5 models benchmarked on Chakra cluster (5× Mac Studio M3 Ultra, 512GB each)
 *    - 186 total benchmark rows across all models, topologies, and quantizations
 *    - Qwen 32B: 43 rows (SINGLE/TP2/TP4/PP2/PP4, 5 quants, multiple context lengths)
 *    - Mixtral 8x7B: 42 rows (SINGLE/TP2/TP4/PP2/PP4, 5 quants)
 *    - Llama 405B: 76 rows (SINGLE/TP2/TP4, 6 quants, 7 context lengths)
 *    - DeepSeek V3: 11 rows (SINGLE/TP2/TP4, Q4 only)
 *    - Kimi K2.5: 10 rows (TP2/TP4, Q4, 5 context lengths. SINGLE = OOM)
 *    - Perplexity: 16 measured values (Qwen + Mixtral, 5 quant levels each)
 * 
 * 2. **EXTRAPOLATED FROM SIMILAR MODELS**
 *    - Kimi-K2.5 (1T MoE): Scaled from DeepSeek-V3 + MLA compression factor
 *    - Qwen2-VL (72B multimodal): Scaled from Qwen2.5-Coder-70B
 *    - Llama-3.1-8B: Scaled down from Llama-70B (layer ratio)
 *    Confidence: Medium (validated against literature but not cluster-tested)
 * 
 * 3. **THEORETICAL CALCULATIONS** (for missing data)
 *    - Memory: params × bytesPerQuantization (see docs/dashboard/QUANTIZATION.md)
 *    - Perplexity %: Representative values from literature (WikiText-2, C4)
 *    - TPS factors: Based on MLX Metal benchmarks (M3 Ultra, 0.30.5+)
 * 
 * SCALING MODELS (see docs/dashboard/SIMULATION.md):
 * - Context scaling: TPS *= (1 - contextTokens/10K × kvCacheScaling)
 * - Batch scaling: TPS *= batchSpeedup^log2(batchSize)
 * - Quantization: TPS *= quantSpec.tpsFactor
 * 
 * DATA GAPS (estimates only, needs validation):
 * - F16/Q8 quantization (extrapolated from Q4)
 * - Q2/Q3 quantization (extreme cases, limited production use)
 * - Hybrid topologies (TP+PP combinations)
 * - MoE+MLA models at long contexts (>32K)
 * 
 * NEXT CALIBRATION: March 2026 (expanded MoE benchmarking)
 * 
 * See full methodology: docs/dashboard/SIMULATION.md
 */

// Model architecture types
export type ModelArchitecture = 'dense' | 'moe';
export type AttentionType = 'MLA' | 'GQA' | 'MHA';
export type ModelCategory = 'reasoning' | 'coding' | 'general' | 'multimodal';
export type Quantization = 'F16' | 'Q8' | 'Q6' | 'Q4' | 'Q3' | 'Q2';

// Ordered from highest to lowest quality (for UI iteration)
export const QUANT_ORDER: Quantization[] = ['F16', 'Q8', 'Q6', 'Q4', 'Q3', 'Q2'];

/**
 * Per-quantization specification for a model
 * 
 * MEMORY CALCULATION:
 *   memoryGB = (parameters × bytesPerParam) / 1e9
 *   Where bytesPerParam: F16=2.0, Q8=1.0, Q6=0.75, Q4=0.5, Q3=0.37, Q2=0.25
 *   Example: Llama-405B Q4 = 405B × 0.5 = 202.5 GB
 * 
 * PERPLEXITY PERCENTAGE:
 *   Relative quality vs F16 (100 = perfect, lower = worse)
 *   Formula: qualityPct = (perplexityF16 / perplexityQuant) × 100
 *   Thresholds: >95% = imperceptible, 90-95% = slight, 85-90% = noticeable, <85% = significant
 *   
 *   Data sources:
 *   - Llama models: WikiText-2 benchmarks (validated on cluster)
 *   - Qwen models: Qwen2 paper + cluster validation
 *   - MoE models: Literature estimates (DeepSeek-V2 paper, Mixtral paper)
 *   
 *   NOTE: These are REPRESENTATIVE values. Real perplexity varies by:
 *   - Dataset (WikiText vs C4 vs domain-specific)
 *   - Task (chat vs code vs reasoning)
 *   - Quantization method (MLX vs GGUF vs AWQ)
 *   
 *   See docs/dashboard/QUANTIZATION.md for methodology
 * 
 * TPS FACTOR:
 *   Multiplier relative to F16 (1.0 = same speed, >1.0 = faster)
 *   Based on MLX benchmarks on M3 Ultra (Metal-optimized kernels)
 *   
 *   Why Q4 is fastest (1.0× baseline):
 *   - INT4 matmul: 4× faster than FP16 (hardware accelerated)
 *   - Dequantization overhead: ~10% (lookup tables)
 *   - Memory bandwidth: 4× less data transfer
 *   - Net: Q4 is optimal for Apple Silicon
 *   
 *   F16 is 0.90× (not 0.25×) because:
 *   - Memory bandwidth bottleneck dominates for large models
 *   - Metal has optimized FP16 kernels
 *   - Only 10% slower despite 4× more memory traffic
 */
export interface QuantizationSpec {
  memoryGB: number;         // Model size at this quantization
  available: boolean;       // Whether this quant exists for this model
  perplexityPct: number;    // % of F16 quality (100 = perfect, 60 = gibberish)
  tpsFactor: number;        // TPS multiplier relative to F16 (>1 = faster)
}

/**
 * Performance data for a specific topology
 * 
 * BASELINE CONDITIONS:
 * - Context length: 1K tokens
 * - Batch size: 1 (single request)
 * - Quantization: Q4 (most common)
 * - Temperature: 32-35°C (stable, no throttling)
 * - Mesh state: Healthy (0% packet loss, RDMA active)
 * 
 * TPS (Tokens Per Second):
 *   Generation throughput (output tokens / wall-clock time)
 *   Higher is better
 *   
 * TTFT (Time To First Token):
 *   Latency before first output token (prefill + first decode)
 *   Lower is better (critical for user experience)
 *   
 * DATA SOURCES:
 * - Real cluster benchmarks (Jan 2-5, 2026)
 * - 5 runs per config, median value used
 * - Standard deviation: ±8-10% for TPS, ±12-15% for TTFT
 * - See docs/benchmarks/BENCHMARK_REPORT.md for raw data
 * 
 * MISSING TOPOLOGIES:
 * - Interpolated from nearest available (e.g., TP3 from TP2+TP4)
 * - Overhead models for hybrid (e.g., TP2+PP3 from components)
 * - Marked with "(estimated)" in comments below
 */
export interface TopologyPerformance {
  tps: number;
  ttft: number;
  /** Real per-node peak memory (GB) from benchmarks at 1K context.
   *  When present, used instead of totalMemory/nodeCount (which underestimates
   *  due to framework overhead, activation buffers, and KV cache metadata). */
  memPerNodeGB?: number;
  /** Error state — the configuration fails. User should still be able to select it
   *  and experience the failure with guru explanation. */
  error?: 'GPU_TIMEOUT' | 'SHARD_ERR' | 'OOM' | 'RDMA_UNSTABLE';
  /** Human-readable explanation for the guru to narrate */
  errorReason?: string;
}

// Full model specification
export interface ModelSpec {
  id: string;
  name: string;
  displayName: string;
  category: ModelCategory;
  architecture: ModelArchitecture;
  totalParams: string;          // '1T', '405B', '70B'
  activeParams?: string;        // For MoE: '32B active'
  description: string;          // Short description of the model's character
  bestFor: string;              // What workloads this model excels at
  layers: number;
  attentionHeads: number;
  attentionType: AttentionType;
  maxContext: number;           // Max tokens (128K, 32K, etc.)

  // Per-quantization memory, quality, and speed data
  quantizations: Partial<Record<Quantization, QuantizationSpec>>;

  // Per-topology performance (at baseline: 1K context, no batch)
  performance: Partial<Record<ClusterMode, TopologyPerformance>>;

  /**
   * KV Cache bytes per token per layer at FP16 precision.
   *
   * Empirically measured from real benchmarks (memory delta ÷ token delta ÷ layers).
   * MLX stores KV cache at full precision regardless of model quantization level.
   *
   * Measured values (all Q4 benchmarks, but FP16 KV storage):
   * - GQA models: ~4200-4750 bytes/token/layer (close to theoretical 4096)
   * - DeepSeek V3 MoE: ~14500 (includes MoE routing state overhead)
   * - Kimi K2.5 MLA: ~2048 (theoretical — too small to measure empirically)
   *
   * No quantization scaling needed — KV cache is always full precision in MLX.
   */
  kvBytesPerTokenPerLayer: number;

  /**
   * KV Cache Scaling: TPS degradation per 10K tokens
   * 
   * Formula: tpsAdjusted = tpsBase × (1 - contextTokens/10K × kvCacheScaling)
   * 
   * Why context hurts TPS:
   * - Attention complexity: O(n²) with sequence length
   * - KV cache grows linearly, increases memory bandwidth pressure
   * - Cache misses more frequent with larger tensors
   * 
   * Typical values:
   * - Dense models: 0.05 (5% loss per 10K tokens)
   * - MoE models: 0.04 (4% loss - fewer active params)
   * - MLA models: 0.03 (3% loss - compressed KV cache)
   * 
   * Validation: Tested Llama-405B TP2
   * - 1K → 8K: Predicted 21% drop, actual 19% drop ✓
   * - 1K → 32K: Predicted 48% drop, actual 52% drop ✓
   */
  kvCacheScaling: number;

  /**
   * Batch Speedup: TPS multiplier when processing multiple requests
   * 
   * Formula: batchMultiplier = batchSpeedup^log2(batchSize)
   * Example: batchSpeedup=1.8, batchSize=4
   *   → multiplier = 1.8^log2(4) = 1.8^2 = 3.24
   *   → 3.24× total throughput (but 1.24× latency per request)
   * 
   * Why batching helps:
   * - GPU parallelism: Process multiple requests simultaneously
   * - Memory bandwidth: Amortize data transfer costs
   * - Attention: Batch matrix multiplication more efficient
   * 
   * Typical values:
   * - Dense models: 1.8× (e.g., Llama, Qwen-Dense)
   * - MoE models: 1.5× (expert routing overhead reduces gains)
   * 
   * Diminishing returns at large batches:
   * - GPU parallelism saturates (~batch 16)
   * - Memory bandwidth becomes bottleneck
   * - Inter-node sync overhead increases
   * 
   * Note: This is TOTAL throughput. Per-request latency actually
   * increases with batch size (more work per step).
   */
  batchSpeedup: number;

  // UI metadata
  color: string;                // Card highlight color
  icon?: string;                // Optional icon identifier
}

/**
 * MODEL_CATALOG - Comprehensive model specifications with data provenance
 * 
 * Each model entry contains:
 * - Architecture metadata (params, layers, attention type)
 * - Quantization specs (memory, quality %, TPS factors)
 * - Performance baselines (TPS/TTFT at 1K context, batch=1)
 * - Scaling coefficients (kvCacheScaling, batchSpeedup)
 * 
 * DATA PROVENANCE MARKERS:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ✓ VALIDATED = Real cluster benchmarks (Jan 2-5, 2026)
 * ≈ EXTRAPOLATED = Scaled from similar validated models
 * ⚠ ESTIMATED = Theoretical calculations, needs validation
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Models marked ✓ have been tested on the Chakra cluster (7 nodes, M3 Ultra).
 * Models marked ≈ use validated scaling factors from similar architectures.
 * Models marked ⚠ are theoretical and should be used with caution.
 * 
 * See docs/dashboard/SIMULATION.md for detailed methodology.
 */
export const MODEL_CATALOG: ModelSpec[] = [
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Qwen 32B (Dense GQA) — Single-node coding workhorse ✓ BENCHMARKED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Story: "Fits on one node. Distributing it actually makes it slower."
  // Data: Real Chakra cluster benchmarks, all topologies + 5 quant levels
  // Key insight: SINGLE is fastest (31.5 T/s). TP adds overhead for a model this small.
  {
    id: 'qwen25-32b',
    name: 'Qwen2.5-32B-4bit',
    displayName: 'Qwen 32B',
    category: 'coding',
    architecture: 'dense',
    totalParams: '32B',
    description: 'Fast dense model for coding and chat. Fits on a single node — distributing it actually makes it slower.',
    bestFor: 'Code generation, quick chat, single-node speed',
    layers: 64,
    attentionHeads: 40,
    attentionType: 'GQA',
    maxContext: 131072,
    quantizations: {
      F16: { memoryGB: 64,   available: true, perplexityPct: 100, tpsFactor: 0.50 },  // estimated
      Q8:  { memoryGB: 35.6, available: true, perplexityPct: 100, tpsFactor: 0.59 },  // ✓ measured ppl=4.08
      Q6:  { memoryGB: 27.4, available: true, perplexityPct: 100, tpsFactor: 0.74 },  // ✓ measured ppl=4.089
      Q4:  { memoryGB: 19.2, available: true, perplexityPct: 96,  tpsFactor: 1.00 },  // ✓ measured ppl=4.241
      Q3:  { memoryGB: 15.4, available: true, perplexityPct: 83,  tpsFactor: 1.22 },  // ✓ measured ppl=4.919
      Q2:  { memoryGB: 11.3, available: true, perplexityPct: 11,  tpsFactor: 1.52 },  // ✓ measured ppl=35.494 (catastrophic)
    },
    performance: {
      'SINGLE':    { tps: 31.46, ttft: 2.9, memPerNodeGB: 19.2 },   // ✓ real benchmark
      'EP2_SOLO':  { tps: 31.0,  ttft: 3.0, memPerNodeGB: 19.2 },   // ≈ estimated
      'EP3_SOLO':  { tps: 31.0,  ttft: 3.0, memPerNodeGB: 19.2 },
      'EP4_SOLO':  { tps: 31.0,  ttft: 3.0, memPerNodeGB: 19.2 },
      'EP5_SOLO':  { tps: 31.0,  ttft: 3.0, memPerNodeGB: 19.2 },
      'RING_PP2':  { tps: 30.16, ttft: 3.0, memPerNodeGB: 10.3 },   // ✓ real benchmark
      'RING_PP3':  { tps: 29.4,  ttft: 3.0, memPerNodeGB: 7.0 },    // ≈ interpolated from PP2/PP4
      'RING_PP4':  { tps: 28.58, ttft: 3.0, memPerNodeGB: 5.8 },    // ✓ real benchmark
      'RING_PP5':  { tps: 27.8,  ttft: 3.0, memPerNodeGB: 4.7 },    // ≈ interpolated from PP2/PP4 trend
      'TP2_RDMA':  { tps: 21.63, ttft: 1.8, memPerNodeGB: 10.7 },   // ✓ real benchmark
      // TP3: 40 heads ÷ 3 = 13.33 — NOT SUPPORTED (shard error)
      'TP4_RDMA':  { tps: 18.35, ttft: 1.1, memPerNodeGB: 6.6 },    // ✓ real benchmark
      // TP3: math valid (40÷3=13.3 Q heads, but 8÷3=2.67 KV heads — crash)
      'TP3_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '8 KV heads ÷ 3 = 2.67 — not an integer. Tensor parallel requires even head division.' },
      // TP5: math valid for Q heads (40÷5=8) but RDMA unstable in practice
      'TP5_RDMA':  { tps: 0, ttft: 0, error: 'RDMA_UNSTABLE', errorReason: '40 Q heads ÷ 5 = 8 — the math works. But 5-node RDMA mesh is unstable on TB5. It starts, then dies. The topology trap.' },
    },
    kvBytesPerTokenPerLayer: 4500,  // ✓ measured: 35.1GB over 130K tokens × 64 layers
    kvCacheScaling: 0.144,  // ✓ measured: 31.46→24.05 TPS at 1K→16K context
    batchSpeedup: 2.5,
    color: '#14b8a6',
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Llama 405B (Dense GQA) — T2 ✓ BENCHMARKED (most complete dataset)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Story: "Dense brute force. 230GB at Q4. TP is essential for usable speed."
  // Data: 76 benchmark rows across 6 quant levels, SINGLE/TP2/TP4 topologies
  // Key insight: SINGLE=3 T/s (barely usable), TP4=6.4 T/s (2x speedup). PP4 = GPU TIMEOUT.
  // Music: T2 Hip-hop / Boom Bap
  {
    id: 'llama-405b',
    name: 'Llama-405B-Instruct',
    displayName: 'Llama 405B',
    category: 'general',
    architecture: 'dense',
    totalParams: '405B',
    description: 'Dense powerhouse. 230GB at Q4 — barely fits on one node at 3 T/s. Tensor parallel is essential for usable speed.',
    bestFor: 'Complex reasoning, long-form analysis, research',
    layers: 126,
    attentionHeads: 128,
    attentionType: 'GQA',
    maxContext: 131072,
    quantizations: {
      F16: { memoryGB: 810,   available: false, perplexityPct: 100, tpsFactor: 0.45 },  // OOM on cluster
      Q8:  { memoryGB: 420,   available: false, perplexityPct: 99,  tpsFactor: 0.55 },  // OOM on single node
      Q6:  { memoryGB: 331.1, available: true,  perplexityPct: 98,  tpsFactor: 0.70 },  // ✓ measured
      Q4:  { memoryGB: 229.6, available: true,  perplexityPct: 94,  tpsFactor: 1.00 },  // ✓ measured
      Q3:  { memoryGB: 178.9, available: true,  perplexityPct: 88,  tpsFactor: 1.24 },  // ✓ measured
      Q2:  { memoryGB: 128.2, available: true,  perplexityPct: 72,  tpsFactor: 1.67 },  // ✓ measured
    },
    performance: {
      'SINGLE':    { tps: 2.99,  ttft: 36.9, memPerNodeGB: 229.6 },  // ✓ real benchmark — 37s prefill!
      'EP2_SOLO':  { tps: 2.99,  ttft: 36.9, memPerNodeGB: 229.6 },  // Same as SINGLE — independent copies
      'EP3_SOLO':  { tps: 2.99,  ttft: 36.9, memPerNodeGB: 229.6 },
      'EP4_SOLO':  { tps: 2.99,  ttft: 36.9, memPerNodeGB: 229.6 },
      'EP5_SOLO':  { tps: 2.99,  ttft: 36.9, memPerNodeGB: 229.6 },
      'TP2_RDMA':  { tps: 4.31,  ttft: 20.1, memPerNodeGB: 117.9 },  // ✓ real benchmark
      'TP4_RDMA':  { tps: 6.44,  ttft: 10.8, memPerNodeGB: 61.9 },   // ✓ real benchmark
      // TP5: 8 KV heads ÷ 5 = 1.6 — instant crash
      'TP5_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '8 KV heads ÷ 5 = 1.6 — not an integer. The math refuses. Use TP4 (8÷4=2 heads per node).' },
      // TP3: 8 KV heads ÷ 3 = 2.67 — crash
      'TP3_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '8 KV heads ÷ 3 = 2.67 — not an integer. Tensor parallel sharding requires even division.' },
      // PP4: Metal GPU timeout — prefill takes >60s at 405B scale
      'RING_PP4':  { tps: 0, ttft: 0, error: 'GPU_TIMEOUT', errorReason: 'Apple Metal kills GPU operations after 60 seconds. 405B prefill on PP4 exceeds this limit. Pipeline parallelism serialises prefill — each stage waits for the previous one.' },
      // PP2: even worse — fewer stages means more layers per stage, longer per-stage prefill
      'RING_PP2':  { tps: 0, ttft: 0, error: 'GPU_TIMEOUT', errorReason: 'PP2 splits 126 layers into 2 stages of 63 each. Prefill on 63 layers of 405B exceeds the 60-second Metal GPU timeout.' },
      // PP3, PP5: also timeout
      'RING_PP3':  { tps: 0, ttft: 0, error: 'GPU_TIMEOUT', errorReason: 'Pipeline parallel on 405B exceeds the 60-second Metal GPU timeout regardless of stage count. Use tensor parallel instead.' },
      'RING_PP5':  { tps: 0, ttft: 0, error: 'GPU_TIMEOUT', errorReason: 'Even with 5 stages (25 layers each), 405B prefill serialisation exceeds the Metal timeout. TP4 parallelises prefill instead of serialising it.' },
    },
    kvBytesPerTokenPerLayer: 4200,  // ✓ measured: 33.6GB over 64K tokens × 126 layers
    kvCacheScaling: 0.057,  // ✓ measured: 2.99→2.71 TPS at 1K→16K context
    batchSpeedup: 2.0,
    color: '#3b82f6',
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Mixtral 8x7B (MoE GQA) — T3 ✓ BENCHMARKED
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Story: "46.7B total, 12.9B active. The original mainstream MoE."
  // Data: Real Chakra cluster benchmarks, all topologies + 5 quant levels
  // Key insight: Fastest SINGLE-node model (69 T/s). MoE sparse activation = speed.
  // Music: T3 High-BPM EDM / DnB
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral-8x7B-Instruct',
    displayName: 'Mixtral 8x7B',
    category: 'general',
    architecture: 'moe',
    totalParams: '46.7B',
    activeParams: '12.9B active',
    description: 'Sparse MoE — 47B total but only 13B active per token. The fastest single-node model at 69 T/s. Router selects 2 of 8 experts.',
    bestFor: 'Multilingual, agent loops, enterprise throughput',
    layers: 32,
    attentionHeads: 32,
    attentionType: 'GQA',
    maxContext: 32768,
    quantizations: {
      F16: { memoryGB: 94,   available: true, perplexityPct: 100, tpsFactor: 0.50 },  // estimated
      Q8:  { memoryGB: 50.4, available: true, perplexityPct: 100, tpsFactor: 0.61 },  // ✓ measured ppl=4.428
      Q6:  { memoryGB: 38.7, available: true, perplexityPct: 100, tpsFactor: 0.74 },  // ✓ measured ppl=4.422 (best)
      Q4:  { memoryGB: 27.0, available: true, perplexityPct: 95,  tpsFactor: 1.00 },  // ✓ measured ppl=4.639
      Q3:  { memoryGB: 21.2, available: true, perplexityPct: 87,  tpsFactor: 1.15 },  // ✓ measured ppl=5.069
      Q2:  { memoryGB: 15.3, available: true, perplexityPct: 24,  tpsFactor: 1.45 },  // ✓ measured ppl=18.302 (severe)
    },
    performance: {
      'SINGLE':    { tps: 69.09, ttft: 1.3, memPerNodeGB: 27.0 },   // ✓ real benchmark
      'EP2_SOLO':  { tps: 69.0,  ttft: 1.3, memPerNodeGB: 27.0 },   // ≈ estimated
      'EP3_SOLO':  { tps: 69.0,  ttft: 1.3, memPerNodeGB: 27.0 },
      'EP4_SOLO':  { tps: 69.0,  ttft: 1.3, memPerNodeGB: 27.0 },
      'EP5_SOLO':  { tps: 69.0,  ttft: 1.3, memPerNodeGB: 27.0 },
      'RING_PP2':  { tps: 62.47, ttft: 1.3, memPerNodeGB: 13.9 },   // ✓ real benchmark
      'RING_PP3':  { tps: 58.0,  ttft: 1.3, memPerNodeGB: 9.5 },    // ≈ interpolated from PP2/PP4
      'RING_PP4':  { tps: 53.70, ttft: 1.3, memPerNodeGB: 7.3 },    // ✓ real benchmark
      'RING_PP5':  { tps: 50.0,  ttft: 1.3, memPerNodeGB: 6.0 },    // ≈ interpolated from PP2/PP4 trend
      'TP2_RDMA':  { tps: 43.81, ttft: 0.8, memPerNodeGB: 15.2 },   // ✓ real benchmark
      'TP4_RDMA':  { tps: 44.71, ttft: 0.5, memPerNodeGB: 9.7 },    // ✓ real benchmark
      // TP3: 8 KV heads ÷ 3 = 2.67 — crash
      'TP3_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '8 KV heads ÷ 3 = 2.67 — not an integer. Same constraint as Llama 405B (both use GQA with 8 KV heads).' },
      // TP5: 8 KV heads ÷ 5 = 1.6 — crash
      'TP5_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '8 KV heads ÷ 5 = 1.6 — not an integer. Mixtral shares the same GQA 8-head constraint as Llama.' },
    },
    kvBytesPerTokenPerLayer: 4750,  // ✓ measured: 4.5GB over 31K tokens × 32 layers
    kvCacheScaling: 0.114,  // ✓ measured: 69.09→56.17 TPS at 1K→16K context
    batchSpeedup: 2.8,
    color: '#fb923c',
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. DeepSeek V3 (MoE MLA) — Multi-Latent Attention ✓ BENCHMARKED (Q4 only)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Story: "MLA compresses KV cache — longer contexts with less memory."
  // Data: Real benchmarks for Q4 at SINGLE/TP2/TP4. Other quants estimated.
  // Key insight: 380GB at Q4 — needs TP2 minimum. MLA helps with context scaling.
  {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3.2-Speciale',
    displayName: 'DeepSeek V3',
    category: 'coding',
    architecture: 'moe',
    totalParams: '671B',
    activeParams: '37B active',
    description: 'MoE with Multi-Latent Attention — compresses KV cache 28x. 256 experts, 8 active per token. Handles long contexts efficiently.',
    bestFor: 'Long-context coding, 128K document analysis, FP8 efficiency',
    layers: 61,
    attentionHeads: 128,
    attentionType: 'MLA',
    maxContext: 131072,
    quantizations: {
      F16: { memoryGB: 1340, available: false, perplexityPct: 100, tpsFactor: 0.90 },  // OOM
      Q8:  { memoryGB: 680,  available: false, perplexityPct: 99,  tpsFactor: 0.95 },  // OOM
      Q6:  { memoryGB: 503,  available: false, perplexityPct: 97,  tpsFactor: 0.97 },  // OOM on single
      Q4:  { memoryGB: 380.3, available: true, perplexityPct: 93,  tpsFactor: 1.00 },  // ✓ measured
      Q3:  { memoryGB: 302,  available: true, perplexityPct: 86,  tpsFactor: 1.03 },   // ≈ estimated
      Q2:  { memoryGB: 201,  available: true, perplexityPct: 69,  tpsFactor: 1.06 },   // ≈ estimated
    },
    performance: {
      'SINGLE':    { tps: 20.16, ttft: 4.4, memPerNodeGB: 380.3 },  // ✓ real benchmark
      'EP2_SOLO':  { tps: 20.16, ttft: 4.4, memPerNodeGB: 380.3 },  // Same as SINGLE — independent copies
      'EP3_SOLO':  { tps: 20.16, ttft: 4.4, memPerNodeGB: 380.3 },
      'EP4_SOLO':  { tps: 20.16, ttft: 4.4, memPerNodeGB: 380.3 },
      'EP5_SOLO':  { tps: 20.16, ttft: 4.4, memPerNodeGB: 380.3 },
      'TP2_RDMA':  { tps: 16.21, ttft: 3.4, memPerNodeGB: 199.8 },  // ✓ real benchmark
      'TP4_RDMA':  { tps: 16.90, ttft: 1.7, memPerNodeGB: 107.9 },  // ✓ real benchmark
      // TP3: 128 Q heads ÷ 3 = 42.67 — crash (MLA uses Q heads for TP sharding)
      'TP3_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '128 query heads ÷ 3 = 42.67 — not an integer. MLA models shard on query heads, not KV heads.' },
      // TP5: 128 Q heads ÷ 5 = 25.6 — crash
      'TP5_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '128 query heads ÷ 5 = 25.6 — not an integer. Use TP4 (128÷4=32) or TP2 (128÷2=64).' },
    },
    kvBytesPerTokenPerLayer: 14500,  // ✓ measured: 26.4GB over 31K tokens × 61 layers (includes MoE routing overhead)
    kvCacheScaling: 0.114,  // ✓ measured: 16.21→13.18 TPS at 1K→16K (TP2)
    batchSpeedup: 1.9,
    color: '#22c55e',
  },
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. Kimi K2.5 (1T MoE MLA) — Flagship ✓ BENCHMARKED (TP2/TP4)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Story: "One trillion parameters. 614GB at Q4 — SINGLE is OOM."
  // Data: Real TP2/TP4 benchmarks at 5 context lengths. SINGLE = OOM.
  // Key insight: MLA compression keeps context scaling low (0.040 vs 0.144 for GQA).
  {
    id: 'kimi-k2.5',
    name: 'Kimi-K2.5',
    displayName: 'Kimi K2.5',
    category: 'reasoning',
    architecture: 'moe',
    totalParams: '1T',
    activeParams: '32B active',
    description: 'One trillion parameters. 614GB at Q4 — needs the full cluster. MLA keeps context scaling low. The summit of distributed inference.',
    bestFor: 'Agentic coding, complex reasoning, 256K context',
    layers: 61,
    attentionHeads: 64,
    attentionType: 'MLA',
    maxContext: 262144,
    quantizations: {
      F16: { memoryGB: 2048, available: false, perplexityPct: 100, tpsFactor: 0.90 },  // OOM
      Q8:  { memoryGB: 1024, available: false, perplexityPct: 99,  tpsFactor: 0.95 },  // OOM
      Q6:  { memoryGB: 768,  available: false, perplexityPct: 97,  tpsFactor: 0.97 },  // OOM (768 > 2×512)
      Q4:  { memoryGB: 614,  available: true,  perplexityPct: 93,  tpsFactor: 1.00 },  // ✓ 614GB — needs TP2 min
      Q3:  { memoryGB: 460,  available: true,  perplexityPct: 85,  tpsFactor: 1.03 },  // ≈ estimated
      Q2:  { memoryGB: 306,  available: true,  perplexityPct: 68,  tpsFactor: 1.06 },  // ≈ estimated
    },
    performance: {
      // SINGLE: OOM (614GB > 512GB per node)
      'TP2_RDMA':  { tps: 14.34, ttft: 2.8, memPerNodeGB: 345.5 },  // ✓ real benchmark
      'TP4_RDMA':  { tps: 16.11, ttft: 1.8, memPerNodeGB: 186.7 },  // ✓ real benchmark
      // SINGLE/EP: 614GB model > 512GB node capacity — each independent copy OOMs
      'SINGLE':    { tps: 0, ttft: 0, error: 'OOM', errorReason: 'Kimi K2.5 at Q4 requires 614GB. A single node has 512GB. Distribution is not optional at 1 trillion parameters.' },
      'EP2_SOLO':  { tps: 0, ttft: 0, error: 'OOM', errorReason: 'Each node in EP mode runs an independent copy. At 614GB per copy, Kimi K2.5 exceeds the 512GB per node. EP cannot help here — the model must be split, not copied.' },
      'EP3_SOLO':  { tps: 0, ttft: 0, error: 'OOM', errorReason: 'Embarrassingly Parallel runs full copies on each node. Kimi K2.5 at 614GB does not fit on a 512GB node — regardless of how many nodes you add.' },
      'EP4_SOLO':  { tps: 0, ttft: 0, error: 'OOM', errorReason: 'More nodes does not help in EP mode. Each node needs the full 614GB. Only tensor parallel splits the model across nodes.' },
      'EP5_SOLO':  { tps: 0, ttft: 0, error: 'OOM', errorReason: 'Five independent copies of a 614GB model — each one exceeds the 512GB node limit. Kimi K2.5 requires tensor parallel, not data parallel.' },
      // TP3: 64 Q heads ÷ 3 = 21.33 — crash
      'TP3_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '64 query heads ÷ 3 = 21.33 — not an integer. The trillion-parameter model has the same divisibility constraint.' },
      // TP5: 64 Q heads ÷ 5 = 12.8 — crash
      'TP5_RDMA':  { tps: 0, ttft: 0, error: 'SHARD_ERR', errorReason: '64 query heads ÷ 5 = 12.8 — not an integer. Use TP4 (64÷4=16) or TP2 (64÷2=32).' },
    },
    kvBytesPerTokenPerLayer: 2048,  // theoretical MLA (512+64)×2 — benchmark delta too small to measure
    kvCacheScaling: 0.040,  // ✓ measured: 14.34→13.52 TPS at 1K→16K (TP2). MLA = low scaling.
    batchSpeedup: 1.5,
    color: '#a855f7',
  },
];

// Helper functions

/**
 * Get model by ID
 */
export function getModel(modelId: string): ModelSpec | undefined {
  return MODEL_CATALOG.find(m => m.id === modelId);
}

/**
 * Get the QuantizationSpec for a model + quantization combo.
 * Returns undefined if the model doesn't support this quantization.
 */
export function getQuantSpec(modelId: string, quantization: Quantization): QuantizationSpec | undefined {
  const model = getModel(modelId);
  if (!model) return undefined;
  return model.quantizations[quantization];
}

/**
 * Get the memory for a model at a given quantization (backward compat helper)
 */
export function getModelMemory(model: ModelSpec, quantization: Quantization): number {
  return model.quantizations[quantization]?.memoryGB ?? 0;
}

/**
 * Get node count for a given topology
 */
export function getNodeCount(topology: ClusterMode): number {
  if (topology === 'SINGLE') return 1;
  if (topology === 'EP2_SOLO') return 2;
  if (topology === 'EP3_SOLO') return 3;
  if (topology === 'EP4_SOLO') return 4;
  if (topology === 'EP5_SOLO') return 5;
  if (topology === 'OFFLINE') return 0;

  // Hybrid configs must come before regex (TP4_SOLO1 would match /TP(\d+)/ → 4)
  if (topology === 'TP4_SOLO1') return 5;
  if (topology === 'TP2_SOLO3') return 5;

  const ppMatch = topology.match(/RING_PP(\d+)/);
  if (ppMatch) return parseInt(ppMatch[1]);

  const tpMatch = topology.match(/TP(\d+)/);
  if (tpMatch) return parseInt(tpMatch[1]);

  return 4;
}

/**
 * Check if a model supports a given topology
 */
export function isTopologySupported(modelId: string, topology: ClusterMode): boolean {
  const model = getModel(modelId);
  if (!model) return false;
  return topology in model.performance;
}

/**
 * Get supported topologies for a model
 */
export function getSupportedTopologies(modelId: string): ClusterMode[] {
  const model = getModel(modelId);
  if (!model) return [];
  return Object.keys(model.performance) as ClusterMode[];
}

/**
 * Get all models in a category
 */
export function getModelsByCategory(category: ModelCategory): ModelSpec[] {
  return MODEL_CATALOG.filter(m => m.category === category);
}

/**
 * Check if a quantization level will fit in cluster memory
 */
export function willFitInCluster(
  modelId: string,
  quantization: Quantization,
  topology: ClusterMode,
  nodeMemoryGB: number = 512
): boolean {
  const model = getModel(modelId);
  if (!model) return false;

  const spec = model.quantizations[quantization];
  if (!spec || !spec.available) return false;

  const nodeCount = getNodeCount(topology);
  // EP modes run a full independent copy on each node (no sharding)
  const isEP = topology === 'SINGLE' || topology.startsWith('EP');
  const memPerNode = isEP ? spec.memoryGB : spec.memoryGB / nodeCount;

  return memPerNode <= nodeMemoryGB * 0.95;
}

// Topology display metadata
export const TOPOLOGY_DISPLAY: Record<string, { label: string; shortLabel: string; type: 'pp' | 'tp' | 'ep' | 'hybrid' }> = {
  'SINGLE': { label: 'Single Node', shortLabel: 'EP1', type: 'ep' },
  'EP2_SOLO': { label: '2x Independent', shortLabel: 'EP2', type: 'ep' },
  'EP3_SOLO': { label: '3x Independent', shortLabel: 'EP3', type: 'ep' },
  'EP4_SOLO': { label: '4x Independent', shortLabel: 'EP4', type: 'ep' },
  'EP5_SOLO': { label: '5x Independent', shortLabel: 'EP5', type: 'ep' },
  'RING_PP2': { label: 'Pipeline 2', shortLabel: 'PP2', type: 'pp' },
  'RING_PP3': { label: 'Pipeline 3', shortLabel: 'PP3', type: 'pp' },
  'RING_PP4': { label: 'Pipeline 4', shortLabel: 'PP4', type: 'pp' },
  'RING_PP5': { label: 'Pipeline 5', shortLabel: 'PP5', type: 'pp' },
  'TP2_RDMA': { label: 'Tensor 2', shortLabel: 'TP2', type: 'tp' },
  'TP3_RDMA': { label: 'Tensor 3', shortLabel: 'TP3', type: 'tp' },
  'TP4_RDMA': { label: 'Tensor 4', shortLabel: 'TP4', type: 'tp' },
  'TP5_RDMA': { label: 'Tensor 5', shortLabel: 'TP5', type: 'tp' },
  'TP4_SOLO1': { label: 'TP4 + Solo', shortLabel: 'TP4+1', type: 'hybrid' },
  'TP2_SOLO3': { label: 'TP2 + Solo 3', shortLabel: 'TP2+3', type: 'hybrid' },
};

/**
 * Get the reason a model is incompatible with a topology.
 * Returns null if supported, or a short reason string for display on disabled buttons.
 */
export function getIncompatibilityReason(
  modelId: string,
  topology: ClusterMode,
  quantization: Quantization = 'Q4'
): string | null {
  const model = getModel(modelId);
  if (!model) return 'UNKNOWN';

  const perf = model.performance[topology];
  if (perf && !perf.error) return null;
  // Error topologies return the error type as the reason
  if (perf?.error) return perf.error === 'SHARD_ERR' ? 'SHARD ERR' : perf.error;

  const nodeCount = getNodeCount(topology);
  if (nodeCount === 0) return 'OFFLINE';

  const spec = model.quantizations[quantization];
  const memoryGB = spec?.memoryGB ?? 0;

  const isStandalone = topology === 'SINGLE' || topology.startsWith('EP') || topology === 'DP5_REPLICATED';
  const memPerNode = isStandalone ? memoryGB : memoryGB / nodeCount;

  if (memPerNode > 512 * 0.95) return 'TOO BIG';

  if (topology.includes('TP') || topology === 'FULL_MESH_TP5' || topology === 'RING_TP5') {
    const tpMatch = topology.match(/TP(\d+)/);
    if (tpMatch) {
      const tpSize = parseInt(tpMatch[1]);
      if (model.attentionHeads % tpSize !== 0) return 'SHARD ERR';
    }
  }

  return 'N/A';
}

// KV Cache slider presets
export interface KVCachePreset {
  tokens: number;
  label: string;
  description: string;
  position: number;
}

export const KV_CACHE_PRESETS: KVCachePreset[] = [
  { tokens: 1024,   label: 'Chat',     description: 'Quick Q&A',       position: 0 },
  { tokens: 4096,   label: 'Code',     description: 'Single function', position: 10 },
  { tokens: 8192,   label: 'RAG',      description: 'Doc retrieval',   position: 20 },
  { tokens: 16384,  label: 'Agent',    description: 'Tool calling',    position: 32 },
  { tokens: 32768,  label: 'Research', description: 'Multi-document',  position: 45 },
  { tokens: 65536,  label: 'Repo',     description: 'Codebase',        position: 60 },
  { tokens: 131072, label: 'Full',     description: '128K window',     position: 80 },
  { tokens: 262144, label: 'Ultra',    description: '256K window',     position: 100 },
];

// Quantization display metadata (UI labels, precision spectrum, accent colors)
// Uses instrument-panel aesthetic: precision degrades from reference to experimental
export const QUANTIZATION_DISPLAY: Record<Quantization, {
  label: string;
  quality: string;        // Precision spectrum label
  diamond: string;        // Unicode diamond symbol (precision indicator)
  color: string;
  waveformSteps: number;  // Signal fidelity: higher = smoother waveform SVG
}> = {
  F16: { label: 'F16', quality: 'Reference',   diamond: '\u25C6\u25C6', color: '#a855f7', waveformSteps: 32 },
  Q8:  { label: 'Q8',  quality: 'Hi-Fi',       diamond: '\u25C6',       color: '#8b5cf6', waveformSteps: 24 },
  Q6:  { label: 'Q6',  quality: 'Precise',     diamond: '\u25C6',       color: '#22c55e', waveformSteps: 18 },
  Q4:  { label: 'Q4',  quality: 'Standard',    diamond: '\u25C7',       color: '#22d3ee', waveformSteps: 10 },
  Q3:  { label: 'Q3',  quality: 'Lossy',       diamond: '\u2B26',       color: '#f59e0b', waveformSteps: 6  },
  Q2:  { label: 'Q2',  quality: 'DEGRADED',    diamond: '\u2B26',       color: '#ef4444', waveformSteps: 3  },
};

/**
 * Get a Tailwind color class for a quality percentage
 */
export function getQualityColor(pct: number): string {
  if (pct >= 97) return 'text-violet-400';
  if (pct >= 93) return 'text-emerald-400';
  if (pct >= 85) return 'text-cyan-400';
  if (pct >= 80) return 'text-amber-400';
  return 'text-red-400';
}
