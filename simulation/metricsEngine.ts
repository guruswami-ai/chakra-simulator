
import { ClusterMode } from '../types';
import {
  ModelSpec,
  Quantization,
  getModel,
  getNodeCount,
} from './modelCatalog';

// Simulation configuration - user-controlled parameters
export interface SimulationConfig {
  modelId: string;
  quantization: Quantization;
  topology: ClusterMode;
  kvCacheTokens: number;        // 1024 - 131072
  batchMode: boolean;
}

// Calculated metrics from configuration
export interface SimulationMetrics {
  tps: number;                  // Tokens per second
  ttft: number;                 // Time to first token (seconds)
  memPerNode: number;           // Memory per node (GB)
  totalMemory: number;          // Total cluster memory usage (GB)
  totalPower: number;           // Estimated total power (W)
  kvCachePercent: number;       // Percentage of max context used
  nodeCount: number;            // Number of active nodes
  feasible: boolean;            // Can this configuration run?
  warnings: string[];           // Warning messages
  errorType?: 'GPU_TIMEOUT' | 'SHARD_ERR' | 'OOM' | 'RDMA_UNSTABLE' | 'CONTEXT_EXCEEDED';  // Specific failure mode
  model: ModelSpec | null;      // Resolved model (for display)
  perplexityPct: number;        // Quality % (100 = full, <80 = gibberish)
  weightsPerNode: number;       // Model weights GB per node
  kvCachePerNode: number;       // KV cache GB per node
  freePerNode: number;          // Remaining GB per node (512 - weights - kv)
}

// Node memory capacity (M3 Ultra = 512GB unified memory)
const NODE_MEMORY_GB = 512;

// Power estimates (watts)
const NODE_IDLE_POWER = 80;     // Idle M3 Ultra
const NODE_ACTIVE_POWER = 130;  // Full inference load

// MLX stores KV cache at full precision (FP16) regardless of model quantization.
// Verified empirically: memory growth with context is identical across quant levels.
// The kvBytesPerTokenPerLayer values in modelCatalog already reflect real FP16 KV storage.

/**
 * Calculate simulation metrics from configuration
 */
export function calculateMetrics(config: SimulationConfig): SimulationMetrics {
  const model = getModel(config.modelId);

  const emptyMetrics: SimulationMetrics = {
    tps: 0,
    ttft: 0,
    memPerNode: 0,
    totalMemory: 0,
    totalPower: 0,
    kvCachePercent: 0,
    nodeCount: 0,
    feasible: false,
    warnings: [],
    model: null,
    perplexityPct: 100,
    weightsPerNode: 0,
    kvCachePerNode: 0,
    freePerNode: 0,
  };

  // No model selected or model not found — cluster is off
  if (!config.modelId || !model) {
    return { ...emptyMetrics };
  }

  const nodeCount = getNodeCount(config.topology);
  const basePerf = model.performance[config.topology];

  // Topology not supported or has error state
  if (!basePerf) {
    return {
      ...emptyMetrics,
      totalPower: NODE_IDLE_POWER * nodeCount,
      nodeCount,
      warnings: [`${model.displayName} does not support ${config.topology}`],
      model,
    };
  }

  // Error topology — user selected a configuration that fails
  // Return it as infeasible with the error info so the guru can explain
  if (basePerf.error) {
    return {
      ...emptyMetrics,
      totalPower: NODE_IDLE_POWER * nodeCount,
      nodeCount,
      feasible: false,
      warnings: [basePerf.errorReason || `${basePerf.error}: ${config.topology} fails on ${model.displayName}`],
      errorType: basePerf.error,
      model,
    };
  }

  // Get quantization spec for this model
  const quantSpec = model.quantizations[config.quantization];
  if (!quantSpec || !quantSpec.available) {
    return {
      ...emptyMetrics,
      nodeCount,
      warnings: [`${config.quantization} not available for ${model.displayName}`],
      model,
    };
  }

  const warnings: string[] = [];

  // Calculate base memory from quantization spec
  const baseMemory = quantSpec.memoryGB;

  // Calculate KV cache memory
  // MLX stores KV at full precision — kvBytesPerTokenPerLayer is the measured real cost
  const kvCacheBytes = config.kvCacheTokens * model.layers * model.kvBytesPerTokenPerLayer;
  const kvCacheGB = kvCacheBytes / (1024 * 1024 * 1024);

  // Total memory
  // EP modes: each node runs a full independent copy (no sharding)
  // PP/TP modes: model is split across nodes
  const isEP = config.topology === 'SINGLE' || config.topology.startsWith('EP');
  const totalMemory = baseMemory + kvCacheGB;

  // Per-node memory: use REAL benchmark data when available (includes framework overhead,
  // activation buffers, and metadata that simple division misses).
  // Benchmarks were at Q4 — scale proportionally for other quantizations.
  const benchMemPerNodeQ4 = basePerf.memPerNodeGB;
  const q4MemoryGB = model.quantizations.Q4?.memoryGB;
  // Scale benchmark per-node memory by the ratio of selected quant to Q4
  const quantScale = (benchMemPerNodeQ4 && q4MemoryGB && q4MemoryGB > 0)
    ? baseMemory / q4MemoryGB
    : 1;
  const benchMemPerNode = benchMemPerNodeQ4 ? benchMemPerNodeQ4 * quantScale : undefined;
  const kvCachePerNodeRaw = isEP ? kvCacheGB : kvCacheGB / nodeCount;
  const memPerNode = benchMemPerNode
    ? benchMemPerNode + kvCachePerNodeRaw  // Scaled base + calculated KV cache growth
    : (isEP ? totalMemory : totalMemory / nodeCount);  // Fallback: simple division

  // Per-node memory breakdown (weights vs KV cache vs free)
  const weightsPerNode = benchMemPerNode
    ? benchMemPerNode  // Scaled measured weights+overhead per node
    : (isEP ? baseMemory : baseMemory / nodeCount);
  const kvCachePerNode = kvCachePerNodeRaw;
  const freePerNode = Math.max(0, NODE_MEMORY_GB - memPerNode);

  // Check context limit FIRST — if context exceeds model max, don't also blame memory
  let feasible = true;
  let errorType: SimulationMetrics['errorType'];
  const contextExceeded = config.kvCacheTokens > model.maxContext;
  if (contextExceeded) {
    feasible = false;
    errorType = 'CONTEXT_EXCEEDED';
    warnings.push(`${model.displayName} supports max ${(model.maxContext / 1024)}K context. ${(config.kvCacheTokens / 1024)}K exceeds this limit.`);
  }

  // Check memory feasibility (skip if already failed due to context — the inflated KV cache would mislead)
  if (!contextExceeded) {
    if (memPerNode > NODE_MEMORY_GB * 0.95) {
      feasible = false;
      warnings.push(`Requires ${memPerNode.toFixed(0)}GB/node, exceeds ${NODE_MEMORY_GB}GB capacity`);
    } else if (memPerNode > NODE_MEMORY_GB * 0.85) {
      warnings.push('Memory pressure high - may experience swapping');
    } else if (memPerNode > NODE_MEMORY_GB * 0.75) {
      warnings.push('KV cache may be constrained at longer contexts');
    }
  }

  // Calculate TPS with scaling factors
  // 1. Context length scaling (longer context = slower)
  const contextScalingFactor = 1 - (config.kvCacheTokens / 10000) * model.kvCacheScaling;
  const contextTps = basePerf.tps * Math.max(0.3, contextScalingFactor);

  // 2. Batch mode speedup
  const batchedTps = config.batchMode ? contextTps * model.batchSpeedup : contextTps;

  // 3. Quantization TPS adjustment (from per-model spec)
  const quantFactor = quantSpec.tpsFactor;
  const finalTps = batchedTps * quantFactor;

  // Calculate TTFT (prefill time scales with context)
  const contextTtftFactor = 1 + (config.kvCacheTokens / 10000) * 0.15;
  const ttft = basePerf.ttft * contextTtftFactor;

  // Metal timeout warning (PP mode with long context)
  if (config.topology.startsWith('RING_PP') && config.kvCacheTokens > 4000) {
    const estimatedPrefillTime = ttft * 1.5;
    if (estimatedPrefillTime > 50) {
      warnings.push('Long context in PP mode may trigger Metal GPU timeout');
    }
  }

  // Calculate power
  const utilization = Math.min(1, finalTps / basePerf.tps);
  const powerPerNode = NODE_IDLE_POWER + (NODE_ACTIVE_POWER - NODE_IDLE_POWER) * utilization;
  const totalPower = powerPerNode * nodeCount;

  // KV cache percentage (context limit already checked above)
  const kvCachePercent = (config.kvCacheTokens / model.maxContext) * 100;

  // Perplexity quality percentage from quantization spec
  const perplexityPct = quantSpec.perplexityPct;

  // Quality warnings
  if (perplexityPct < 70) {
    warnings.push('Severe quality loss - output will be largely incoherent');
  } else if (perplexityPct < 85) {
    warnings.push('Noticeable quality degradation at this quantization');
  }

  // EP modes: total cluster throughput = per-instance TPS × node count
  // (each node runs independently, throughput scales linearly)
  const clusterTps = isEP && nodeCount > 1 ? finalTps * nodeCount : finalTps;

  return {
    tps: Math.round(clusterTps * 10) / 10,
    ttft: Math.round(ttft * 1000) / 1000,
    memPerNode: Math.round(memPerNode),
    totalMemory: Math.round(totalMemory),
    totalPower: Math.round(totalPower),
    kvCachePercent: Math.min(100, Math.round(kvCachePercent * 10) / 10),
    nodeCount,
    feasible,
    warnings,
    errorType,
    model,
    perplexityPct,
    weightsPerNode: Math.round(weightsPerNode * 10) / 10,
    kvCachePerNode: Math.round(kvCachePerNode * 1000) / 1000,
    freePerNode: Math.round(freePerNode),
  };
}

/**
 * Create a default configuration for a model
 */
export function getDefaultConfig(modelId: string): SimulationConfig {
  const model = getModel(modelId);
  const supportedTopologies = model ? Object.keys(model.performance) as ClusterMode[] : [];

  // Pick best topology (prefer TP4 for large models, SOLO for small)
  const defaultTopology = supportedTopologies.includes('TP4_RDMA') ? 'TP4_RDMA' :
                          supportedTopologies.includes('TP2_RDMA') ? 'TP2_RDMA' :
                          supportedTopologies.includes('RING_PP4') ? 'RING_PP4' :
                          supportedTopologies[0] || 'TP4_RDMA';

  return {
    modelId,
    quantization: 'Q4',
    topology: defaultTopology,
    kvCacheTokens: 4096,
    batchMode: false,
  };
}

/**
 * Format TPS for display
 */
export function formatTps(tps: number): string {
  if (tps >= 100) return `${Math.round(tps)}`;
  if (tps >= 10) return `${tps.toFixed(1)}`;
  return `${tps.toFixed(2)}`;
}

/**
 * Format TTFT for display (converts to ms if appropriate)
 */
export function formatTtft(ttft: number): string {
  if (ttft < 1) return `${Math.round(ttft * 1000)}ms`;
  return `${ttft.toFixed(2)}s`;
}

/**
 * Format memory for display
 */
export function formatMemory(memoryGB: number): string {
  if (memoryGB >= 1000) return `${(memoryGB / 1000).toFixed(1)}TB`;
  return `${Math.round(memoryGB)}GB`;
}

/**
 * Format power for display
 */
export function formatPower(powerW: number): string {
  if (powerW >= 1000) return `${(powerW / 1000).toFixed(1)}kW`;
  return `${Math.round(powerW)}W`;
}

/**
 * Get a comparison between two configurations
 */
export function compareConfigs(config1: SimulationConfig, config2: SimulationConfig): {
  tpsDelta: number;
  ttftDelta: number;
  memoryDelta: number;
  powerDelta: number;
} {
  const metrics1 = calculateMetrics(config1);
  const metrics2 = calculateMetrics(config2);

  return {
    tpsDelta: metrics2.tps - metrics1.tps,
    ttftDelta: metrics2.ttft - metrics1.ttft,
    memoryDelta: metrics2.memPerNode - metrics1.memPerNode,
    powerDelta: metrics2.totalPower - metrics1.totalPower,
  };
}

/**
 * Suggest the best topology for a model + config combo
 */
export function suggestBestTopology(
  modelId: string,
  quantization: Quantization,
  priority: 'throughput' | 'latency' | 'memory'
): ClusterMode | null {
  const model = getModel(modelId);
  if (!model) return null;

  const topologies = Object.keys(model.performance) as ClusterMode[];
  if (topologies.length === 0) return null;

  // Evaluate each topology
  const ranked = topologies.map(topology => {
    const config: SimulationConfig = {
      modelId,
      quantization,
      topology,
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const metrics = calculateMetrics(config);

    // Score based on priority
    let score = 0;
    if (priority === 'throughput') {
      score = metrics.tps * (metrics.feasible ? 1 : 0);
    } else if (priority === 'latency') {
      score = metrics.feasible ? (1 / metrics.ttft) : 0;
    } else {
      score = metrics.feasible ? (1 / metrics.memPerNode) : 0;
    }

    return { topology, score, feasible: metrics.feasible };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  // Return best feasible option
  const best = ranked.find(r => r.feasible);
  return best?.topology || ranked[0]?.topology || null;
}
