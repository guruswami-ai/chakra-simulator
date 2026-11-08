
/**
 * Cluster Operating Modes
 *
 * Each mode determines how the model is distributed across compute nodes
 * and which network topology is used for inter-node communication.
 *
 * NAMING CONVENTION:
 * - RING_PPn: Pipeline Parallel with n stages (ring/sequential)
 * - HYBRID_TPn: Tensor Parallel with n nodes (mesh, 1 controller separate)
 * - FULL_MESH_TPn: All nodes in tensor parallel mesh
 * - EPn_SOLO: Embarrassingly Parallel - n independent models
 * - DP: Data Parallel (replicated models)
 */
export type AppMode = 'SIM' | 'GAME';

export type ClusterMode =
  // ═══════════════════════════════════════════════════════════════════════
  // PIPELINE PARALLEL (PP) - Sequential layer split, ring topology
  // Best for: Maximum memory pooling, very large models, batch processing
  // ═══════════════════════════════════════════════════════════════════════
  | 'RING_PP2'   // 2-stage pipeline (layers 1-64, 65-128)
  | 'RING_PP3'   // 3-stage pipeline
  | 'RING_PP4'   // 4-stage pipeline
  | 'RING_PP5'   // 5-stage pipeline (all nodes, max RAM: 2.5TB)

  // ═══════════════════════════════════════════════════════════════════════
  // TENSOR PARALLEL (TP) - Sharded attention/MLP, mesh topology
  // Best for: Low latency, interactive chat, models with divisible heads
  // ═══════════════════════════════════════════════════════════════════════
  | 'TP2_RDMA'   // 2-node TP mesh over TB5 RDMA (64 heads each)
  | 'TP4_RDMA'   // 4-node TP mesh over TB5 RDMA (32 heads each - optimal)
  | 'HYBRID_TP2' // Legacy alias for TP2_RDMA
  | 'HYBRID_TP3' // 3-node TP mesh (careful: 128/3 = 42.67 → padding!)
  | 'HYBRID_TP4' // Legacy alias for TP4_RDMA
  | 'FULL_MESH_TP5' // 5-node full mesh (only if heads divisible by 5)
  | 'RING_TP5'   // 5-node ring with TP (alternative to mesh)

  // ═══════════════════════════════════════════════════════════════════════
  // TENSOR PARALLEL (TP) - Extended range
  // ═══════════════════════════════════════════════════════════════════════
  | 'TP3_RDMA'   // 3-node TP mesh (requires heads ÷ 3 = integer)
  | 'TP5_RDMA'   // 5-node TP mesh (requires heads ÷ 5 = integer)

  // ═══════════════════════════════════════════════════════════════════════
  // EXPERT/DATA PARALLEL - Independent models, minimal coordination
  // Best for: Small models, high throughput, A/B testing
  // ═══════════════════════════════════════════════════════════════════════
  | 'EP2_SOLO'   // 2 independent models
  | 'EP3_SOLO'   // 3 independent models
  | 'EP4_SOLO'   // 4 independent models
  | 'EP5_SOLO'   // 5 independent models (e.g., 5x Gemma-27B)
  | 'DP5_REPLICATED' // 5 replicas of same model (load balanced)

  // ═══════════════════════════════════════════════════════════════════════
  // SPECIAL CONFIGURATIONS - Mixed strategies
  // ═══════════════════════════════════════════════════════════════════════
  | 'DUAL_TP2'   // Two independent 2-node TP groups (A/B testing)
  | 'TP3_MESH'   // 3-node TP mesh (nodes 3-5), nodes 1-2 available
  | 'TP4_CONTROLLER' // 4-node TP with dedicated controller (recommended)

  // ═══════════════════════════════════════════════════════════════════════
  // HYBRID COMBINATIONS - TP group + standalone or PP chain
  // ═══════════════════════════════════════════════════════════════════════
  | 'TP2_SOLO3'  // 2-node TP + 3 standalone agents
  | 'TP3_SOLO2'  // 3-node TP + 2 standalone agents
  | 'TP4_SOLO1'  // 4-node TP + 1 standalone agent (common: large model + judge)
  | 'TP2_PP3'    // 2-node TP + 3-node PP chain
  | 'TP3_PP2'    // 3-node TP + 2-node PP chain

  // ═══════════════════════════════════════════════════════════════════════
  // ADVANCED MODES (Future)
  // ═══════════════════════════════════════════════════════════════════════
  | 'SEQUENCE_PARALLEL' // Ring Attention for million-token contexts
  | 'PREFILL_DECODE'    // Separate prefill and decode nodes

  // ═══════════════════════════════════════════════════════════════════════
  // SYSTEM STATES
  // ═══════════════════════════════════════════════════════════════════════
  | 'SINGLE'     // Single-node inference (no distribution)
  | 'OFFLINE';   // No model loaded, cluster idle

export type HelpSectionId =
  | 'foundations' | 'tp' | 'pp' | 'mesh-ring' | 'tps-ttft' | 'kv-cache' | 'hardware' | 'distributed-flow'
  | 'quantization' | 'gpu-timeout'
  | 'benchmarks' | 'sync-tax' | 'divisibility-wall' | 'mla-compression' | 'cluster-comparison'
  | 'arch-overview' | 'arch-base' | 'arch-instruct' | 'arch-reasoning' | 'arch-moe'
  | 'arch-attention'
  | 'arch-multimodal' | 'arch-embedding' | 'arch-matrix' | 'arch-real-world' | 'arch-summary';

/** Extended section IDs for the Guruswami Codex (superset of HelpSectionId) */
export type CodexSectionId = HelpSectionId
  | 'codex-trials' | 'codex-progress';

export interface ModelInstance {
  id: string;
  name: string;
  mode: ClusterMode;
  nodeIds: string[];
  tokPerSec: number;
  medianTTFT: number;
  activeRequests: number;
  color: string;
}

/**
 * Node Visual State - derived from metrics for visualization
 * OFFLINE → IDLE → STANDBY → COMPUTE
 */
export type NodeVisualState = 'offline' | 'idle' | 'standby' | 'compute';

/**
 * Warning types for node health indicators
 */
export interface NodeWarning {
  type: 'memory_leak' | 'thermal' | 'power' | 'tb5_down' | 'offline';
  msg: string;
}

export interface NodeMetrics {
  id: string;
  name: string;
  role: string;
  hw_model: string;
  cpu_util: number;
  gpu_util: number;
  soc_load: number;        // SoC load percentage (from MQTT)
  temp_c: number;
  power_w: number;
  ram_used: number;
  ram_total: number;
  wired_gb: number;        // GPU memory (wired pages) - key for state detection
  kv_cache_pct: number;
  rx_gbps: number;
  tx_gbps: number;
  tok_per_sec: number;
  rdma_latency_us: number;
  tb5_links: number;
  tb5_reachable: number;   // Number of TB5 peers reachable (0-4)
  tb5_latency_ms: number;  // Average TB5 ping latency
  tb5_status: 'healthy' | 'degraded' | 'down' | 'unknown';
  index: number;
  color: string;
  glowColor: string;
  assignedModelId?: string;
  warnings: NodeWarning[]; // Active warnings for this node
}

export interface HistoryPoint {
  timestamp: number;
  tokPerSec: number;
  ttft: number;
}

/**
 * Fabric types for inter-node communication
 * - TB5: Thunderbolt 5 ring topology (Pipeline Parallel)
 * - MLX_RDMA: RDMA over TB5 mesh (Tensor Parallel)
 * - LOCAL: Single-node, no inter-node communication
 * - OFFLINE: No active inference
 */
export type ClusterFabric = 'TB5' | 'MLX_RDMA' | 'LOCAL' | 'OFFLINE';

export interface ClusterState {
  globalTopology: ClusterMode;
  fabric: ClusterFabric;
  activeModels: ModelInstance[];
  nodes: NodeMetrics[];
  history: HistoryPoint[];
}
