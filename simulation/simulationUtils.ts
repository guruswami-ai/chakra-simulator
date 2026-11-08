/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CHAKRA CLUSTER - TOPOLOGY-AWARE SIMULATION UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Provides educationally accurate simulation of distributed LLM inference patterns
 * for the Chakra Cluster Dashboard visualization.
 *
 * CLUSTER ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  CONTROLLER (sahasrara - M4 Pro)                                            │
 * │  └─ TensorZero Gateway, Open WebUI, Metrics                                 │
 * │      │                                                                      │
 * │      │ 10GbE (Prompts/Responses)                                            │
 * │      ▼                                                                      │
 * │  ╔═══════════════════════════════════════════════════════════════════════╗  │
 * │  ║  COMPUTE FABRIC (5x M3 Ultra, 2.5TB Unified RAM)                      ║  │
 * │  ║  muladhara ═══ svadhisthana ═══ manipura ═══ anahata ═══ vishuddha   ║  │
 * │  ║       └──────────────────────────────────────────────────────┘        ║  │
 * │  ║                    TB5 RDMA Full Mesh (80 Gbps/link)                  ║  │
 * │  ╚═══════════════════════════════════════════════════════════════════════╝  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PARALLELISM STRATEGIES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. TENSOR PARALLEL (TP) - "The Speed Demon"
 *    ─────────────────────────────────────────
 *    • Splits attention heads and MLP layers HORIZONTALLY across nodes
 *    • ALL nodes compute the SAME token simultaneously
 *    • Requires ALL-REDUCE sync after each transformer layer
 *    • Network: Full Mesh (TB5 RDMA) - latency critical!
 *
 *    Token Flow:  [All nodes process in parallel] → All-Reduce → [Next layer]
 *
 *    Pros: Lowest latency (TTFT), ideal for interactive chat
 *    Cons: "Prime Number Problem" - heads must divide evenly by node count
 *          (128 heads ÷ 5 = 25.6 → PADDING OVERHEAD!)
 *
 *    Best Node Counts: 2, 4 (most models have 32/64/128 heads)
 *
 * 2. PIPELINE PARALLEL (PP) - "The Deep Runner"
 *    ──────────────────────────────────────────
 *    • Splits model VERTICALLY - each node owns consecutive layers
 *    • Token flows SEQUENTIALLY through pipeline stages
 *    • Network: Ring topology (unidirectional activation passing)
 *
 *    Token Flow:  Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5 → Output
 *                 (Layers   (Layers   (Layers   (Layers   (Layers
 *                  1-25)     26-51)    52-76)    77-102)   103-128)
 *
 *    Pros: Works with any node count, maximum RAM pooling
 *    Cons: "Pipeline Bubble" - downstream nodes idle while waiting
 *          Higher TTFT (latency scales with stage count)
 *
 *    Best For: Giant models (Kimi-K2 1TB), batch processing
 *
 * 3. EMBARRASSINGLY PARALLEL (EP) - independent instances
 *    ────────────────────────────────────────────────────
 *    • Each node runs a complete independent copy of the model
 *    • No inter-node communication required
 *    • Network: None (each instance is fully self-contained)
 *
 *    Example: Llama-4-Maverick (128 experts)
 *             Node 1: Experts 1-32, Node 2: Experts 33-64, etc.
 *
 *    Best Node Counts: Divisors of expert count (2, 4, 8 for 128 experts)
 *
 * 4. DATA PARALLEL (DP) - "The Throughput King"
 *    ──────────────────────────────────────────
 *    • Full model REPLICATED on each node
 *    • Different requests routed to different replicas
 *    • Network: Minimal (just load balancing)
 *
 *    Best For: Small models (7B-70B), high concurrent users
 *
 * 5. SEQUENCE PARALLEL (SP) / Ring Attention
 *    ───────────────────────────────────────
 *    • Splits the CONTEXT WINDOW, not the model
 *    • Each node handles a segment of the input sequence
 *    • KV cache passed around ring for cross-attention
 *
 *    Best For: Extremely long context (1M+ tokens) that exceeds single-node VRAM
 *
 * 6. PREFILL-DECODE SEPARATION (PD Split)
 *    ────────────────────────────────────
 *    • Specialized nodes for different generation phases
 *    • Prefill Nodes: Process large prompts (compute-bound)
 *    • Decode Nodes: Generate output tokens (memory-bandwidth-bound)
 *    • KV cache transferred after prefill completes
 *
 *    Best For: RAG applications with huge retrieved contexts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * THE "UNIVERSAL BACKPLANE" STRATEGY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Physical topology: 5-Node FULL MESH (permanent, never unplug cables)
 *
 * Logical reconfiguration via SOFTWARE:
 * • Mesh mode (TP): Address all nodes, use all links
 * • Ring mode (PP): Address sequential nodes, use neighbor links only
 * • Hybrid mode: Run independent clusters on subsets of nodes
 *
 * The physical mesh supports ANY logical topology without recabling.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { ClusterMode, NodeMetrics, NodeVisualState } from '../types';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NODE VISUAL STATE DETECTION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Determines the visual state of a node based on its metrics. This drives the
 * visualization animation:
 *
 * OFFLINE → power_w < 5 or no data for 10s
 *   Visual: Darkened, no glow, dimmed SVG
 *
 * IDLE → online but no model loaded (wired_gb < 50)
 *   Visual: Normal brightness, minimal ring, dim glow
 *
 * STANDBY → model loaded (wired_gb > 50) but gpu_util < 5%
 *   Visual: Colored ring expanded proportionally to RAM, steady glow
 *
 * COMPUTE → actively inferring (gpu_util > 5%)
 *   Visual: Pulsing ring, spinning SVG, bright glow
 */
export function getNodeVisualState(node: NodeMetrics): NodeVisualState {
  // No power means offline (threshold lowered from 5W to 1W for idle M4 Pro support)
  if (!node.power_w || node.power_w < 1) {
    return 'offline';
  }

  // Check if GPU is actively computing
  if (node.gpu_util > 5) {
    return 'compute';
  }

  // Check if model is loaded (wired memory > 50GB indicates model in VRAM)
  if (node.wired_gb > 50) {
    return 'standby';
  }

  // Online but no model
  return 'idle';
}

/**
 * Calculate the ring expansion scale based on memory usage
 * Ring expands proportionally to show model size in VRAM
 *
 * @returns Scale factor (1.0 = no expansion, 1.5 = 50% larger)
 */
export function getRingExpansionScale(node: NodeMetrics): number {
  if (!node.wired_gb || !node.ram_total) return 1.0;
  // Cap at 50% expansion when RAM is full
  return 1.0 + (node.wired_gb / node.ram_total) * 0.5;
}

/**
 * Calculate token flow animation interval based on TPS
 * Returns milliseconds between token particle spawns
 *
 * @param tps - Tokens per second
 * @returns Interval in milliseconds (e.g., 13 TPS → ~77ms)
 */
export function getTokenFlowInterval(tps: number): number {
  if (tps <= 0) return 0; // No tokens flowing
  // Cap at 5ms minimum (200 TPS max visual rate)
  return Math.max(5, 1000 / tps);
}

/**
 * Check if node should show warning overlay
 */
export function getNodeWarnings(node: NodeMetrics): NodeMetrics['warnings'] {
  const warnings: NodeMetrics['warnings'] = [];

  // Memory leak: GPU idle but high wired memory
  if (node.gpu_util < 5 && node.wired_gb > 50) {
    warnings.push({
      type: 'memory_leak',
      msg: `GPU idle but ${node.wired_gb.toFixed(0)}GB wired memory`
    });
  }

  // Thermal warning
  if (node.temp_c > 95) {
    warnings.push({
      type: 'thermal',
      msg: `High temperature: ${node.temp_c.toFixed(0)}°C`
    });
  }

  // Power warning (high idle power)
  if (node.gpu_util < 5 && node.power_w > 60) {
    warnings.push({
      type: 'power',
      msg: `Idle power high: ${node.power_w.toFixed(0)}W`
    });
  }

  // TB5 connectivity warning
  if (node.tb5_reachable < 2 && node.tb5_links > 0) {
    warnings.push({
      type: 'tb5_down',
      msg: `TB5 degraded: ${node.tb5_reachable}/4 peers reachable`
    });
  }

  return warnings;
}

/**
 * REFERENCE MODEL: Kimi-K2-Thinking (Verified on Chakra Cluster)
 *
 * Model specs:
 * - Size: 614GB (1 trillion params, 32B active, 4-bit quantized)
 * - Architecture: MoE with 128 attention heads
 * - Tensor dimensions: 12288, 16384
 * - DIVISIBILITY: Works with 1, 2, 4, 8 nodes (NOT 3, 5, 6, 7!)
 *
 * VERIFIED BENCHMARKS (January 2026):
 *
 * TP4 JACCL (4-node Tensor Parallel via RDMA):
 *   - Memory: 185 GB/node (stable through all context lengths)
 *   - TPS: 15.64 tok/s (16.3 at 1024 tokens)
 *   - TTFT: 0.34s
 *
 * PP5 Ring (5-node Pipeline Parallel via TB5):
 *   - Memory: 123 GB/node
 *   - TPS: 15.13 tok/s
 *   - TTFT: 1.6s (5-stage pipeline latency)
 *
 * PP4 Ring (4-node Pipeline Parallel):
 *   - Memory: 154 GB/node
 *   - TPS: 13.2 tok/s (estimated)
 *   - TTFT: 1.3s
 *
 * TP2 (2-node Tensor Parallel):
 *   - Memory: 320 GB/node
 *   - TPS: 8.5 tok/s (more all-reduce overhead)
 *   - TTFT: 0.45s
 *
 * INCOMPATIBLE CONFIGURATIONS (Prime Number Problem):
 *   - TP3: 128 heads ÷ 3 = 42.67 → requires padding, ~10% overhead
 *   - TP5: 128 heads ÷ 5 = 25.6 → requires padding, ~15% overhead
 *   - Use PP for 3 or 5 nodes instead
 */

// Reference model: Kimi-K2-Thinking (verified on cluster)
const REFERENCE_MODEL = {
  name: 'Kimi-K2-Thinking',
  totalSizeGB: 614,
  layers: 128, // 128 transformer layers
  attentionHeads: 128, // Divisible by 1, 2, 4, 8, 16, 32, 64, 128
};

// Performance scaling based on VERIFIED BENCHMARKS (January 2026)
const PERFORMANCE_SCALING = {
  // Pipeline Parallel: Linear layer split, sequential processing
  // TPS scales sub-linearly due to pipeline bubble
  // TTFT increases with stages (each stage adds ~0.3s latency)
  PP: {
    1: { tps: 3.0, ttft: 0.6, memPerNode: 614 },   // Single node (memory limited)
    2: { tps: 8.0, ttft: 0.9, memPerNode: 307 },   // 2 stages
    3: { tps: 11.0, ttft: 1.1, memPerNode: 205 },  // 3 stages
    4: { tps: 13.2, ttft: 1.3, memPerNode: 154 },  // 4 stages
    5: { tps: 15.1, ttft: 1.6, memPerNode: 123 },  // 5 stages (VERIFIED)
  },

  // Tensor Parallel: Sharded attention/MLP, synchronized compute
  // Requires model dimensions divisible by node count!
  // TTFT is lower due to parallelized attention computation
  TP: {
    1: { tps: 3.0, ttft: 0.6, memPerNode: 614 },   // Same as solo
    2: { tps: 8.5, ttft: 0.45, memPerNode: 320 },  // 64 heads each
    3: { tps: 10.0, ttft: 0.42, memPerNode: 220, warning: 'PADDING' }, // NOT DIVISIBLE
    4: { tps: 15.6, ttft: 0.34, memPerNode: 185 }, // 32 heads each (VERIFIED)
    5: { tps: 14.0, ttft: 0.38, memPerNode: 145, warning: 'PADDING' }, // NOT DIVISIBLE
  },

  // Embarrassingly Parallel / Solo: Each node runs independent model copy
  // For comparison: what if each node ran its own model?
  SOLO: {
    '7B': { tps: 85.0, ttft: 0.05, memPerNode: 14 },    // Very fast
    '70B': { tps: 12.0, ttft: 0.25, memPerNode: 140 },  // Llama-3.1-70B class
    '405B': { tps: 2.5, ttft: 0.8, memPerNode: 480 },   // Just fits on 1 node
  },
};

// Network bandwidth characteristics (Gbps)
const NETWORK_CHARACTERISTICS = {
  TB5_RDMA_PEAK: 80,      // TB5 bidirectional per link
  TB5_INFERENCE_TP: 12,   // Typical TP all-reduce traffic
  TB5_INFERENCE_PP: 6,    // Typical PP activation passing
  ETHERNET_10G: 9.4,      // 10GbE practical max
  MANAGEMENT_PLANE: 0.05, // Heartbeat/telemetry traffic
};

export interface SimulatedNodeState {
  cpu_util: number;
  gpu_util: number;
  temp_c: number;
  power_w: number;
  ram_used: number;
  rx_gbps: number;
  tx_gbps: number;
  tok_per_sec: number;
  kv_cache_pct: number;
  role: string;
}

export interface TopologySimulation {
  nodes: SimulatedNodeState[];
  clusterTps: number;
  description: string;
}

/**
 * Get active node indices for a given topology
 *
 * Node assignment philosophy:
 * - Node 0 (muladhara) is ALWAYS included as API endpoint for distributed modes
 * - For PP modes: Sequential nodes 0→N-1
 * - For TP modes: Mesh nodes 0→N-1 (requires heads divisible by N)
 * - For Solo/DP modes: All 5 nodes operate independently
 */
export function getActiveNodeIndices(topology: ClusterMode): number[] {
  if (!topology || topology === 'OFFLINE') return [];

  // Standalone/DP modes - all nodes active independently
  if (topology === 'EP5_SOLO' || topology === 'DP5_REPLICATED') {
    return [0, 1, 2, 3, 4]; // All 5 nodes
  }

  // Pipeline Parallel - sequential stages starting from node 0
  if (topology.startsWith('RING_PP')) {
    const stages = parseInt(topology.replace('RING_PP', ''));
    return Array.from({ length: stages }, (_, i) => i);
  }

  // TP RDMA modes - new cleaner names (TP2_RDMA, TP4_RDMA)
  if (topology.startsWith('TP') && topology.includes('RDMA')) {
    const match = topology.match(/TP(\d+)_RDMA/);
    const degree = match ? parseInt(match[1]) : 4;
    return Array.from({ length: degree }, (_, i) => i);
  }

  // Legacy Hybrid TP modes - use first N nodes
  if (topology.startsWith('HYBRID_TP')) {
    const match = topology.match(/HYBRID_TP(\d+)/);
    const degree = match ? parseInt(match[1]) : 4;
    return Array.from({ length: degree }, (_, i) => i);
  }

  return [0, 1, 2, 3]; // Default to 4 nodes
}

/**
 * Determine if topology uses Tensor Parallel (synchronous all-reduce)
 * TP requires high-bandwidth mesh for all-reduce operations
 */
export function isTensorParallel(topology: ClusterMode): boolean {
  // Exclude solo/DP modes which aren't pure TP
  if (topology === 'EP5_SOLO' || topology === 'DP5_REPLICATED') return false;
  // New naming: TP2_RDMA, TP4_RDMA
  if (topology.startsWith('TP') && topology.includes('RDMA')) return true;
  // Legacy naming: HYBRID_TP2, HYBRID_TP4
  return topology.includes('TP') || topology.includes('MESH');
}

/**
 * Determine if topology uses Pipeline Parallel (sequential stages)
 * PP uses ring topology with unidirectional data flow
 */
export function isPipelineParallel(topology: ClusterMode): boolean {
  return topology.startsWith('RING_PP');
}

/**
 * Determine if topology is Data Parallel (replicated models)
 * DP has independent replicas handling different requests
 */
export function isDataParallel(topology: ClusterMode): boolean {
  return topology === 'DP5_REPLICATED' || topology === 'EP5_SOLO';
}

/**
 * Determine if topology is a hybrid (multiple strategies combined)
 */
export function isHybridTopology(topology: ClusterMode): boolean {
  return topology.includes('SOLO') ||
         topology === 'DUAL_TP2' ||
         topology.includes('_PP');
}

/**
 * Generate topology-aware simulation for educational accuracy
 */
export function simulateTopology(
  topology: ClusterMode,
  baseNodes: NodeMetrics[],
  timeOffset: number = 0
): TopologySimulation {
  const activeIndices = getActiveNodeIndices(topology);
  const isTP = isTensorParallel(topology);
  const isPP = isPipelineParallel(topology);
  const nodeCount = activeIndices.length;

  // Add some temporal variation for realistic animation
  const timeFactor = Math.sin(timeOffset / 1000) * 0.5 + 0.5;
  const jitter = () => (Math.random() - 0.5) * 0.1;

  const nodes: SimulatedNodeState[] = baseNodes.map((node, index) => {
    const isActive = activeIndices.includes(index);
    const isIdle = !isActive;

    // OFFLINE mode - everything idle
    if (topology === 'OFFLINE') {
      return {
        cpu_util: 2 + Math.random() * 3,
        gpu_util: 0,
        temp_c: 35 + Math.random() * 5,
        power_w: 15 + Math.random() * 5,
        ram_used: 8 + Math.random() * 4,
        rx_gbps: 0,
        tx_gbps: 0,
        tok_per_sec: 0,
        kv_cache_pct: 0,
        role: 'idle',
      };
    }

    // Idle node in partial topology
    if (isIdle) {
      return {
        cpu_util: 2 + Math.random() * 3,
        gpu_util: 0,
        temp_c: 35 + Math.random() * 5,
        power_w: 15 + Math.random() * 5,
        ram_used: 8 + Math.random() * 4,
        rx_gbps: NETWORK_CHARACTERISTICS.MANAGEMENT_PLANE,
        tx_gbps: NETWORK_CHARACTERISTICS.MANAGEMENT_PLANE,
        tok_per_sec: 0,
        kv_cache_pct: 0,
        role: 'idle',
      };
    }

    // TENSOR PARALLEL - Synchronized computation across all nodes
    // All nodes compute same token simultaneously, then sync via all-reduce
    if (isTP) {
      const tpDegree = nodeCount;
      // Get performance from scaling table
      const tpPerf = PERFORMANCE_SCALING.TP[tpDegree as keyof typeof PERFORMANCE_SCALING.TP]
        || PERFORMANCE_SCALING.TP[4]; // Fallback to TP4

      const clusterTps = tpPerf.tps * (0.95 + Math.random() * 0.1);
      const nodeTps = clusterTps / tpDegree;

      // TP nodes are SYNCHRONIZED - similar utilization patterns across all
      // All-reduce causes periodic spikes in network traffic at layer boundaries
      const syncCyclePhase = (timeOffset / 100) % 1; // Sync cycle ~100ms
      const allReduceSpike = Math.sin(syncCyclePhase * Math.PI * 8) * 0.25 + 0.75;

      // GPU utilization is HIGH and synchronized (all doing same work)
      const baseGpuUtil = 78 + Math.random() * 8;

      return {
        cpu_util: 35 + Math.random() * 10 + timeFactor * 5,
        gpu_util: baseGpuUtil + allReduceSpike * 10, // Synchronized, with sync spikes
        temp_c: 58 + Math.random() * 8,
        power_w: 85 + Math.random() * 40 + allReduceSpike * 20,
        ram_used: tpPerf.memPerNode + Math.random() * 10,
        // TP: High bidirectional traffic during all-reduce (mesh pattern)
        rx_gbps: NETWORK_CHARACTERISTICS.TB5_INFERENCE_TP * allReduceSpike * (0.9 + jitter()),
        tx_gbps: NETWORK_CHARACTERISTICS.TB5_INFERENCE_TP * allReduceSpike * (0.9 + jitter()),
        tok_per_sec: nodeTps,
        kv_cache_pct: 45 + timeFactor * 25 + Math.random() * 10,
        role: 'compute',
      };
    }

    // PIPELINE PARALLEL - Sequential stages, each handles different layers
    // Token flows: Stage 0 → Stage 1 → Stage 2 → ... → Output
    if (isPP) {
      const stageIndex = activeIndices.indexOf(index);
      const numStages = activeIndices.length;

      // Get performance from scaling table
      const ppPerf = PERFORMANCE_SCALING.PP[numStages as keyof typeof PERFORMANCE_SCALING.PP]
        || PERFORMANCE_SCALING.PP[5]; // Fallback to PP5

      const clusterTps = ppPerf.tps * (0.95 + Math.random() * 0.1);
      const nodeTps = clusterTps / numStages;

      // PP stages have DIFFERENT timing patterns - sequential pipeline
      // Token arrives at stage N after all previous stages complete
      // Creates a "wave" effect through the pipeline
      const pipelineLatency = 0.15; // ~150ms per stage
      const tokenCycle = (timeOffset / 1000) % 1; // 1 second token cycle
      const stageDelay = stageIndex * (pipelineLatency / numStages);
      const stagePhase = (tokenCycle + stageDelay) % 1;
      const gpuBurstPhase = Math.sin(stagePhase * Math.PI * 2);

      // Stage position affects utilization pattern:
      // First stage: Processes embedding + early layers
      // Middle stages: Process their layer range
      // Last stage: Final layers + output token generation
      const stageLoadFactor = stageIndex === numStages - 1
        ? 1.15  // Last stage has output head work
        : stageIndex === 0
          ? 1.0 // First stage has embedding
          : 0.95;

      // GPU utilization varies with pipeline position
      // NOT synchronized - each stage runs when it has data
      const baseGpuUtil = 60 + stageIndex * 3; // Later stages slightly busier (backpressure)

      return {
        cpu_util: 28 + Math.random() * 12 + gpuBurstPhase * 5,
        gpu_util: baseGpuUtil + gpuBurstPhase * 18 * stageLoadFactor,
        temp_c: 52 + stageIndex * 1.5 + Math.random() * 5, // Later stages warmer
        power_w: 70 + Math.random() * 30 + gpuBurstPhase * 20,
        ram_used: ppPerf.memPerNode + Math.random() * 8,
        // PP traffic is UNIDIRECTIONAL - stage N sends to stage N+1 only
        // First stage receives from controller, last stage sends to controller
        rx_gbps: stageIndex === 0
          ? NETWORK_CHARACTERISTICS.MANAGEMENT_PLANE  // First: input from controller
          : NETWORK_CHARACTERISTICS.TB5_INFERENCE_PP * (0.8 + jitter()),
        tx_gbps: stageIndex === numStages - 1
          ? NETWORK_CHARACTERISTICS.MANAGEMENT_PLANE  // Last: output to controller
          : NETWORK_CHARACTERISTICS.TB5_INFERENCE_PP * (0.8 + jitter()),
        tok_per_sec: nodeTps,
        // KV cache grows differently per stage - later stages accumulate more
        kv_cache_pct: 30 + stageIndex * 10 + timeFactor * 15 + Math.random() * 8,
        role: 'compute',
      };
    }

    // STANDALONE/DP modes - Each node runs independently
    // No inter-node communication, just 10GbE to controller
    if (topology === 'EP5_SOLO' || topology === 'DP5_REPLICATED') {
      // Each node runs its own smaller model (~27-70GB each)
      // Independent computation, no coordination overhead
      const modelSize = 27 + index * 10; // Vary by node for visual interest
      const baseTps = 25 + Math.random() * 15; // Smaller models = faster

      return {
        cpu_util: 30 + Math.random() * 15 + timeFactor * 10,
        gpu_util: 65 + Math.random() * 20, // Not synchronized - varies by request
        temp_c: 48 + Math.random() * 8,
        power_w: 60 + Math.random() * 30,
        ram_used: modelSize + Math.random() * 5,
        // 10GbE only - each node talks directly to controller
        rx_gbps: NETWORK_CHARACTERISTICS.MANAGEMENT_PLANE + (0.5 + Math.random() * 0.3),
        tx_gbps: NETWORK_CHARACTERISTICS.MANAGEMENT_PLANE + (0.5 + Math.random() * 0.3),
        tok_per_sec: baseTps,
        kv_cache_pct: 20 + Math.random() * 25, // Lower - smaller context per model
        role: 'standalone',
      };
    }

    // Default compute pattern for hybrid/other topologies
    return {
      cpu_util: 40 + Math.random() * 20,
      gpu_util: 70 + Math.random() * 20,
      temp_c: 55 + Math.random() * 10,
      power_w: 80 + Math.random() * 50,
      ram_used: 120 + Math.random() * 30,
      rx_gbps: 5 + Math.random() * 3,
      tx_gbps: 5 + Math.random() * 3,
      tok_per_sec: 4 + Math.random() * 2,
      kv_cache_pct: 40 + Math.random() * 30,
      role: 'compute',
    };
  });

  // Calculate cluster-wide TPS
  const clusterTps = nodes.reduce((sum, n) => sum + n.tok_per_sec, 0);

  // Generate educational description
  const description = getTopologyDescription(topology, nodeCount);

  return { nodes, clusterTps, description };
}

/**
 * Get educational description for a topology with performance context
 * Distributed modes reference Kimi-K2-Thinking (614GB, 128 attention heads)
 * Standalone modes reference smaller models (7B-70B)
 */
export function getTopologyDescription(topology: ClusterMode, nodeCount: number): string {
  if (topology === 'OFFLINE') {
    return 'Cluster idle. No inference workload active.';
  }

  // Standalone mode - 5 independent smaller models
  if (topology === 'EP5_SOLO') {
    return 'Standalone: 5 independent models (7B-70B each). Each node serves different ' +
           'requests via 10GbE. ~150+ tok/s aggregate, TTFT ~0.15s. Ideal for A/B testing.';
  }

  // Pipeline Parallel modes - Kimi-K2 works with ANY stage count
  if (isPipelineParallel(topology)) {
    const stages = parseInt(topology.replace('RING_PP', ''));
    const perf = PERFORMANCE_SCALING.PP[stages as keyof typeof PERFORMANCE_SCALING.PP];
    const layersPerStage = Math.floor(REFERENCE_MODEL.layers / stages);
    return `Pipeline Parallel (PP${stages}): Kimi-K2's ${REFERENCE_MODEL.layers} layers split into ${stages} stages. ` +
           `~${layersPerStage} layers/node. Ring topology. ` +
           `${perf.tps} tok/s, ${perf.memPerNode}GB/node, TTFT ${perf.ttft}s`;
  }

  // Tensor Parallel modes - only 2 and 4 work with Kimi-K2 (128 heads)
  if (isTensorParallel(topology)) {
    const tpDegree = topology.includes('4') ? 4 : 2;
    const perf = PERFORMANCE_SCALING.TP[tpDegree as keyof typeof PERFORMANCE_SCALING.TP];
    const headsPerNode = REFERENCE_MODEL.attentionHeads / tpDegree;
    return `Tensor Parallel (TP${tpDegree} RDMA): Kimi-K2's ${REFERENCE_MODEL.attentionHeads} heads split ` +
           `(${headsPerNode} heads/node). Full mesh, all-reduce sync. ` +
           `${perf.tps} tok/s, ${perf.memPerNode}GB/node, TTFT ${perf.ttft}s`;
  }

  return `${topology}: ${nodeCount} active nodes.`;
}

/**
 * Get expected TTFT for a topology (for simulation)
 *
 * TTFT (Time to First Token) varies significantly by parallelism strategy:
 * - Standalone: Fastest TTFT (no distribution overhead, small models)
 * - TP: Low TTFT (parallel attention computation, all-reduce sync)
 * - PP: Higher TTFT (sequential through all pipeline stages)
 *
 * Kimi-K2 verified TTFT:
 * - TP4: 0.34s (optimal)
 * - TP2: 0.45s
 * - PP5: 1.6s (5 stages)
 * - PP4: 1.3s (4 stages)
 */
export function getExpectedTTFT(topology: ClusterMode): number {
  if (topology === 'OFFLINE') return 0;

  // Standalone - fastest TTFT (small models, no distribution overhead)
  if (topology === 'EP5_SOLO' || topology === 'DP5_REPLICATED') {
    return 0.15; // Typical for 7B-70B models
  }

  // Pipeline Parallel - TTFT scales with stage count
  if (isPipelineParallel(topology)) {
    const stages = parseInt(topology.replace('RING_PP', ''));
    const perf = PERFORMANCE_SCALING.PP[stages as keyof typeof PERFORMANCE_SCALING.PP];
    return perf?.ttft || 1.0;
  }

  // Tensor Parallel modes - low TTFT due to parallel attention
  if (isTensorParallel(topology)) {
    const tpDegree = topology.includes('4') ? 4 : 2;
    const perf = PERFORMANCE_SCALING.TP[tpDegree as keyof typeof PERFORMANCE_SCALING.TP];
    return perf?.ttft || 0.4;
  }

  return 0.5; // Default
}

/**
 * Calculate realistic particle animation speeds based on topology
 * Returns multiplier for base particle speed (lower = faster)
 */
export function getParticleSpeedMultiplier(
  topology: ClusterMode,
  sourceIndex: number,
  targetIndex: number
): number {
  if (isPipelineParallel(topology)) {
    // PP: Particles flow in one direction, speed indicates data volume
    // Earlier links (closer to input) are slightly faster as they process first
    const stages = parseInt(topology.replace('RING_PP', ''));
    const linkPosition = Math.min(sourceIndex, targetIndex);
    return 0.8 + (linkPosition / stages) * 0.4; // 0.8 to 1.2
  }

  if (isTensorParallel(topology)) {
    // TP: All links have similar traffic (all-reduce is symmetric)
    // Slight variation to avoid visual monotony
    return 0.9 + Math.random() * 0.2; // 0.9 to 1.1
  }

  return 1.0;
}

/**
 * Determine if a link should show bidirectional traffic
 */
export function isLinkBidirectional(
  topology: ClusterMode,
  sourceIndex: number,
  targetIndex: number
): boolean {
  // PP is always unidirectional (data flows one way through stages)
  if (isPipelineParallel(topology)) {
    return false;
  }

  // TP/Mesh uses bidirectional all-reduce
  if (isTensorParallel(topology)) {
    return true;
  }

  // Solo has no inter-node links
  if (topology === 'EP5_SOLO') {
    return false;
  }

  return true; // Default to bidirectional for hybrid topologies
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANIMATION PROFILES - The Four Cardinal Scenarios
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * These profiles define how the mesh visualization should animate for different
 * workload types, enabling the simulator to show visually accurate representations
 * of actual cluster behavior.
 */

export interface AnimationProfile {
  id: string;
  name: string;
  scenario: 'network_melter' | 'memory_giant' | 'moe_router' | 'the_swarm';

  // Node animation
  nodePulse: 'uniform' | 'wave' | 'chaotic' | 'independent';
  nodePulseSpeed: number;       // Duration in seconds (lower = faster)
  nodeGlowIntensity: number;    // 0-1, multiplier for glow effect
  nodeSyncPhase: boolean;       // Whether nodes should pulse in sync

  // Link animation
  linkPattern: 'all_active' | 'ring' | 'sparse_random' | 'dark';
  linkColor: string;            // Primary link color
  linkSecondaryColor?: string;  // For bidirectional or gradient effects
  linkIntensity: number;        // 0-1, base opacity
  linkPulseVariance: number;    // How much intensity varies (0-1)
  linkBidirectional: boolean;   // Show reverse particles

  // Particle animation
  particleSpeed: number;        // Base duration in seconds
  particleSpeedVariance: number;// Random variance (0-1)
  particleSize: number;         // Base radius in pixels
  particleDensity: number;      // Particles per link (1-5)
  particleColor: string;        // Primary particle color

  // Traffic patterns
  trafficPattern: 'steady' | 'burst' | 'wave' | 'random';
  trafficPhaseOffset: number;   // For wave patterns, phase shift per node (0-1)

  // Power/thermal visualization
  powerDrawPattern: 'uniform' | 'sawtooth' | 'spiky' | 'steady';
  expectedPowerWatts: number;   // Typical cluster power draw
}

/**
 * The Four Cardinal Animation Profiles
 *
 * These represent extreme workload types that stress different cluster aspects:
 */
export const ANIMATION_PROFILES: Record<string, AnimationProfile> = {
  /**
   * 🔴 SCENARIO A: "The Network Melter" (Tensor Parallelism)
   *
   * Focus: Maximum Inter-node Bandwidth & Latency Sensitivity
   * Model: Large TP-compatible model (Llama-405B, Kimi-K2)
   * Topology: 4-Node Full Mesh with RDMA
   *
   * Visual characteristics:
   * - ALL 4 nodes pulse in PERFECT SYNC (all-reduce synchronization)
   * - Continuous, high-intensity traffic on ALL links (all-to-all pattern)
   * - Bright cyan mesh, particles moving in both directions
   * - Steady, high power draw
   */
  'network_melter': {
    id: 'network_melter',
    name: 'The Network Melter',
    scenario: 'network_melter',

    // Nodes: Synchronized pulsing (all computing same token)
    nodePulse: 'uniform',
    nodePulseSpeed: 0.8,
    nodeGlowIntensity: 0.9,
    nodeSyncPhase: true,

    // Links: All active, high intensity mesh
    linkPattern: 'all_active',
    linkColor: '#22d3ee',       // Cyan-400 (RDMA color)
    linkSecondaryColor: '#06b6d4',
    linkIntensity: 0.85,
    linkPulseVariance: 0.15,
    linkBidirectional: true,

    // Particles: Fast, dense, bidirectional
    particleSpeed: 0.25,
    particleSpeedVariance: 0.1,
    particleSize: 6,
    particleDensity: 3,
    particleColor: '#ffffff',

    // Traffic: Steady high throughput with sync bursts
    trafficPattern: 'burst',
    trafficPhaseOffset: 0,      // No phase offset - all in sync

    // Power: Steady, high
    powerDrawPattern: 'uniform',
    expectedPowerWatts: 380,
  },

  /**
   * 🔵 SCENARIO B: "The Memory Giant" (Pipeline Parallelism)
   *
   * Focus: Maximum VRAM Capacity & Sequential Flow
   * Model: Kimi-K2-Thinking (1TB+)
   * Topology: 5-Node Ring (sequential stages)
   *
   * NETWORK: Uses 10GbE Ethernet (NOT TB5)
   * - PP traffic is very light (~5 Mbps, just activation passing)
   * - 10GbE provides 10,000 Mbps, which is ~2000x more than needed
   * - Ring backend routes via 10.61.106.x (Ethernet IPs), not 192.168.x (TB5)
   * - TB5 would provide no measurable benefit for PP workloads
   *
   * Visual characteristics:
   * - WAVE of activity traveling around the ring (N1→N2→N3→N4→N5)
   * - Orange links to accurately show 10GbE usage
   * - Bursty traffic on neighbor links only during layer handoffs
   * - "Sawtooth" power pattern (nodes idle while waiting for data)
   */
  'memory_giant': {
    id: 'memory_giant',
    name: 'The Memory Giant',
    scenario: 'memory_giant',

    // Nodes: Wave pattern (sequential activation)
    nodePulse: 'wave',
    nodePulseSpeed: 1.5,        // Slower, more deliberate
    nodeGlowIntensity: 0.7,
    nodeSyncPhase: false,       // Explicitly NOT synchronized

    // Links: Ring only (neighbor-to-neighbor) over 10GbE
    linkPattern: 'ring',
    linkColor: '#f97316',       // Orange-500 (10GbE color) - NOT TB5!
    linkSecondaryColor: '#22c55e', // Green for output return
    linkIntensity: 0.5,         // Lower intensity - network almost idle
    linkPulseVariance: 0.4,     // High variance - bursty
    linkBidirectional: false,   // Unidirectional pipeline

    // Particles: Medium speed, sequential flow
    particleSpeed: 0.6,
    particleSpeedVariance: 0.2,
    particleSize: 7,            // Larger to show activation chunks
    particleDensity: 2,
    particleColor: '#ffffff',

    // Traffic: Wave pattern through stages
    trafficPattern: 'wave',
    trafficPhaseOffset: 0.2,    // 20% phase offset per stage

    // Power: Sawtooth (nodes idle while waiting)
    powerDrawPattern: 'sawtooth',
    expectedPowerWatts: 320,
  },

  /**
   * 🟢 SCENARIO C: "The MoE Router" (Data Parallel / Embarrassingly Parallel)
   *
   * Focus: Sparse Activation & Routing Jitter
   * Model: DeepSeek-V3, MiniMax-M2 (MoE architectures)
   * Topology: 4-Node Mesh (Hybrid/TP with expert routing)
   *
   * Visual characteristics:
   * - CHAOTIC/SPARKING - links light up randomly based on expert routing
   * - Asymmetric traffic - some links saturated, others quiet
   * - High variance in activity across nodes
   * - Unpredictable, jittery animation
   */
  'moe_router': {
    id: 'moe_router',
    name: 'The MoE Router',
    scenario: 'moe_router',

    // Nodes: Chaotic, unsynchronized pulsing
    nodePulse: 'chaotic',
    nodePulseSpeed: 0.4,        // Fast but irregular
    nodeGlowIntensity: 0.75,
    nodeSyncPhase: false,

    // Links: Sparse random (only some active at a time)
    linkPattern: 'sparse_random',
    linkColor: '#a855f7',       // Purple (MoE routing color)
    linkSecondaryColor: '#f97316', // Orange highlights
    linkIntensity: 0.5,
    linkPulseVariance: 0.8,     // Very high variance - chaotic
    linkBidirectional: true,

    // Particles: Variable speed, unpredictable
    particleSpeed: 0.35,
    particleSpeedVariance: 0.5, // High variance
    particleSize: 5,
    particleDensity: 2,
    particleColor: '#e879f9',   // Fuchsia sparks

    // Traffic: Random (token routing varies)
    trafficPattern: 'random',
    trafficPhaseOffset: 0,

    // Power: Spiky (varies with expert activation)
    powerDrawPattern: 'spiky',
    expectedPowerWatts: 350,
  },

  /**
   * 🟡 SCENARIO D: "The Swarm" (Data Parallelism)
   *
   * Focus: Total Throughput (QPS) & Independence
   * Model: Gemma-27B, Qwen-7B, Mistral-7B (smaller models)
   * Topology: 5 Independent Nodes (no interconnect needed)
   *
   * Visual characteristics:
   * - All 5 nodes glowing INDEPENDENTLY (different phases)
   * - Network mesh is DARK (no inter-node traffic)
   * - Only 10GbE management links visible
   * - Maximum aggregate TPS, linear scaling
   */
  'the_swarm': {
    id: 'the_swarm',
    name: 'The Swarm',
    scenario: 'the_swarm',

    // Nodes: Independent pulsing (each handles own requests)
    nodePulse: 'independent',
    nodePulseSpeed: 1.0,
    nodeGlowIntensity: 0.8,
    nodeSyncPhase: false,

    // Links: DARK (no TB5 traffic - only management plane)
    linkPattern: 'dark',
    linkColor: '#000000',       // No color
    linkSecondaryColor: '#f97316', // Orange for 10GbE only
    linkIntensity: 0.0,         // TB5 links invisible
    linkPulseVariance: 0,
    linkBidirectional: false,

    // Particles: None on TB5, only on management links
    particleSpeed: 2.0,
    particleSpeedVariance: 0.3,
    particleSize: 2,
    particleDensity: 1,
    particleColor: '#f97316',   // Orange (management)

    // Traffic: Steady (individual nodes process independently)
    trafficPattern: 'steady',
    trafficPhaseOffset: 0,

    // Power: Steady, moderate (smaller models)
    powerDrawPattern: 'steady',
    expectedPowerWatts: 450,    // All 5 nodes active
  },
};

/**
 * Get the animation profile for a given topology
 */
export function getAnimationProfile(topology: ClusterMode): AnimationProfile {
  // Map topologies to their animation profiles
  if (isTensorParallel(topology)) {
    return ANIMATION_PROFILES['network_melter'];
  }

  if (isPipelineParallel(topology)) {
    return ANIMATION_PROFILES['memory_giant'];
  }

  if (topology === 'SINGLE' || topology.startsWith('EP') || topology === 'DP5_REPLICATED') {
    return ANIMATION_PROFILES['the_swarm'];
  }

  // Default to network melter for unknown topologies
  return ANIMATION_PROFILES['network_melter'];
}

/**
 * Get animation profile by scenario name (for explicit selection)
 */
export function getAnimationProfileByScenario(
  scenario: 'network_melter' | 'memory_giant' | 'moe_router' | 'the_swarm'
): AnimationProfile {
  return ANIMATION_PROFILES[scenario];
}

/**
 * Calculate node glow parameters based on animation profile
 */
export function getNodeAnimationParams(
  profile: AnimationProfile,
  nodeIndex: number,
  timeOffset: number,
  nodeCount: number,
  tps: number = 10,
): {
  glowOpacity: number;
  pulsePhase: number;
  glowRadius: number;
} {
  // Cycle speed linked to TPS: faster TPS = faster pulse (same formula as layer split)
  const cycleDuration = tps > 0 ? Math.max(800, 4000 - (tps / 20) * 3200) : 4000;
  const basePhase = (timeOffset / cycleDuration) % 1;

  switch (profile.nodePulse) {
    case 'uniform':
      // All nodes pulse together — visible glow within sphere
      return {
        glowOpacity: profile.nodeGlowIntensity * (0.3 + Math.sin(basePhase * Math.PI * 2) * 0.5),
        pulsePhase: basePhase,
        glowRadius: 95,
      };

    case 'wave':
      // Wave propagates through nodes
      const wavePhase = (basePhase + nodeIndex * profile.trafficPhaseOffset) % 1;
      return {
        glowOpacity: profile.nodeGlowIntensity * (0.2 + Math.sin(wavePhase * Math.PI * 2) * 0.6),
        pulsePhase: wavePhase,
        glowRadius: 95,
      };

    case 'chaotic':
      // Random, jittery pulsing
      const chaoticPhase = (basePhase * (1 + nodeIndex * 0.3) + Math.sin(nodeIndex * 7.3)) % 1;
      const jitter = Math.sin(timeOffset / 50 + nodeIndex * 2.7) * 0.2;
      return {
        glowOpacity: profile.nodeGlowIntensity * (0.3 + Math.sin(chaoticPhase * Math.PI * 4) * 0.4 + jitter),
        pulsePhase: chaoticPhase,
        glowRadius: 95,
      };

    case 'independent':
      // Each node has its own independent rhythm
      const independentPhase = (basePhase * (0.8 + nodeIndex * 0.15) + nodeIndex * 0.2) % 1;
      return {
        glowOpacity: profile.nodeGlowIntensity * (0.3 + Math.sin(independentPhase * Math.PI * 2) * 0.5),
        pulsePhase: independentPhase,
        glowRadius: 95,
      };

    default:
      return {
        glowOpacity: profile.nodeGlowIntensity * 0.4,
        pulsePhase: 0,
        glowRadius: 95,
      };
  }
}

/**
 * Calculate link animation parameters based on animation profile
 */
export function getLinkAnimationParams(
  profile: AnimationProfile,
  sourceIndex: number,
  targetIndex: number,
  timeOffset: number
): {
  intensity: number;
  particleSpeed: number;
  showLink: boolean;
  showParticles: boolean;
} {
  const basePhase = (timeOffset / 1000) % 1;

  switch (profile.linkPattern) {
    case 'all_active':
      // All mesh links active with synchronized intensity
      const syncIntensity = profile.linkIntensity * (0.7 + Math.sin(basePhase * Math.PI * 4) * 0.3);
      return {
        intensity: syncIntensity,
        particleSpeed: profile.particleSpeed,
        showLink: true,
        showParticles: true,
      };

    case 'ring':
      // Only show sequential neighbor links (ring topology)
      const isNeighbor = Math.abs(sourceIndex - targetIndex) === 1 ||
                         (sourceIndex === 0 && targetIndex === 4) ||
                         (sourceIndex === 4 && targetIndex === 0);
      // Wave pattern along ring
      const ringPhase = (basePhase + sourceIndex * profile.trafficPhaseOffset) % 1;
      const ringIntensity = profile.linkIntensity * (0.4 + Math.sin(ringPhase * Math.PI * 2) * 0.6);
      return {
        intensity: isNeighbor ? ringIntensity : 0,
        particleSpeed: profile.particleSpeed * (0.8 + ringPhase * 0.4),
        showLink: isNeighbor,
        showParticles: isNeighbor,
      };

    case 'sparse_random':
      // Random links light up (MoE routing simulation)
      const linkHash = (sourceIndex * 7 + targetIndex * 13) % 10;
      const randomPhase = (basePhase * 3 + linkHash * 0.1) % 1;
      const isActive = Math.sin(randomPhase * Math.PI * 6 + linkHash) > 0.3;
      const sparseIntensity = isActive
        ? profile.linkIntensity * (0.5 + Math.random() * 0.5)
        : profile.linkIntensity * 0.1;
      return {
        intensity: sparseIntensity,
        particleSpeed: profile.particleSpeed * (0.5 + Math.random() * profile.particleSpeedVariance),
        showLink: true,
        showParticles: isActive,
      };

    case 'dark':
      // No TB5 links visible (swarm mode)
      return {
        intensity: 0,
        particleSpeed: 0,
        showLink: false,
        showParticles: false,
      };

    default:
      return {
        intensity: profile.linkIntensity,
        particleSpeed: profile.particleSpeed,
        showLink: true,
        showParticles: true,
      };
  }
}
