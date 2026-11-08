/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CHAKRA CLUSTER - BENCHMARK REPLAY UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Handles loading and playing back recorded benchmark data through the dashboard
 * visualization. Enables "time travel" through actual inference runs with real
 * captured metrics from mactop, MQTT, and inference server.
 *
 * Data flow:
 * 1. benchmark_runner.py collects metrics during inference → BenchmarkSuite JSON
 * 2. This module loads and parses the replay data
 * 3. ReplayController advances through frames at configurable speed
 * 4. Dashboard visualization displays actual captured metrics
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { NodeMetrics, ClusterMode } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// REPLAY DATA TYPES (mirrors benchmark_schema.py)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReplayNodeMetrics {
  name: string;
  cpu_util: number;
  gpu_util: number;
  temp_c: number;
  power_w: number;
  ram_used: number;
  ram_total: number;
  tok_per_sec: number;
  kv_cache_pct: number;
  rx_gbps: number;
  tx_gbps: number;
}

export interface ReplayFrame {
  timestamp_ms: number;
  topology: string;
  nodes: ReplayNodeMetrics[];
  cluster_tps: number;
  active_model: string;
  ttft_ms: number;
  animation_profile: string;
}

export interface BenchmarkReplay {
  suite_id: string;
  config_id: string;
  iteration_id: number;
  model_name: string;
  topology: string;
  input_tokens: number;
  avg_tps: number;
  avg_ttft_ms: number;
  peak_memory_gb: number;
  total_energy_wh: number;
  frames: ReplayFrame[];
  total_duration_ms: number;
  frame_interval_ms: number;
}

export interface BenchmarkSummary {
  suite_id: string;
  suite_name: string;
  created_at: string;
  configurations: Array<{
    config_id: string;
    topology: string;
    input_tokens: number;
    iterations_completed: number;
    avg_tps: number;
    avg_ttft_ms: number;
  }>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLAY CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export type ReplaySpeed = 0.25 | 0.5 | 1 | 2 | 4;

export interface ReplayState {
  isPlaying: boolean;
  currentFrameIndex: number;
  currentTime: number;          // ms from start
  speed: ReplaySpeed;
  loop: boolean;
  replay: BenchmarkReplay | null;
}

export class ReplayController {
  private state: ReplayState;
  private intervalId: NodeJS.Timeout | null = null;
  private onFrameChange: (frame: ReplayFrame, state: ReplayState) => void;

  constructor(onFrameChange: (frame: ReplayFrame, state: ReplayState) => void) {
    this.onFrameChange = onFrameChange;
    this.state = {
      isPlaying: false,
      currentFrameIndex: 0,
      currentTime: 0,
      speed: 1,
      loop: true,
      replay: null,
    };
  }

  /**
   * Load a benchmark replay for playback
   */
  loadReplay(replay: BenchmarkReplay): void {
    this.stop();
    this.state = {
      ...this.state,
      replay,
      currentFrameIndex: 0,
      currentTime: 0,
      isPlaying: false,
    };

    // Emit first frame
    if (replay.frames.length > 0) {
      this.onFrameChange(replay.frames[0], this.state);
    }
  }

  /**
   * Start or resume playback
   */
  play(): void {
    if (!this.state.replay || this.state.replay.frames.length === 0) return;
    if (this.state.isPlaying) return;

    this.state.isPlaying = true;

    // Calculate tick interval based on speed
    const baseInterval = this.state.replay.frame_interval_ms;
    const tickInterval = baseInterval / this.state.speed;

    this.intervalId = setInterval(() => {
      this.advanceFrame();
    }, tickInterval);
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.state.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Stop and reset to beginning
   */
  stop(): void {
    this.pause();
    this.state.currentFrameIndex = 0;
    this.state.currentTime = 0;

    if (this.state.replay && this.state.replay.frames.length > 0) {
      this.onFrameChange(this.state.replay.frames[0], this.state);
    }
  }

  /**
   * Seek to a specific time (ms)
   */
  seekTo(timeMs: number): void {
    if (!this.state.replay) return;

    const wasPlaying = this.state.isPlaying;
    this.pause();

    // Find the frame closest to the target time
    const frames = this.state.replay.frames;
    let targetIndex = 0;

    for (let i = 0; i < frames.length; i++) {
      if (frames[i].timestamp_ms <= timeMs) {
        targetIndex = i;
      } else {
        break;
      }
    }

    this.state.currentFrameIndex = targetIndex;
    this.state.currentTime = frames[targetIndex].timestamp_ms;
    this.onFrameChange(frames[targetIndex], this.state);

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: ReplaySpeed): void {
    const wasPlaying = this.state.isPlaying;
    if (wasPlaying) {
      this.pause();
    }

    this.state.speed = speed;

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Toggle loop mode
   */
  setLoop(loop: boolean): void {
    this.state.loop = loop;
  }

  /**
   * Get current state
   */
  getState(): ReplayState {
    return { ...this.state };
  }

  /**
   * Get current frame
   */
  getCurrentFrame(): ReplayFrame | null {
    if (!this.state.replay) return null;
    return this.state.replay.frames[this.state.currentFrameIndex] || null;
  }

  /**
   * Advance to next frame
   */
  private advanceFrame(): void {
    if (!this.state.replay) return;

    const frames = this.state.replay.frames;
    const nextIndex = this.state.currentFrameIndex + 1;

    if (nextIndex >= frames.length) {
      if (this.state.loop) {
        this.state.currentFrameIndex = 0;
        this.state.currentTime = 0;
      } else {
        this.pause();
        return;
      }
    } else {
      this.state.currentFrameIndex = nextIndex;
      this.state.currentTime = frames[nextIndex].timestamp_ms;
    }

    this.onFrameChange(frames[this.state.currentFrameIndex], this.state);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map topology string from benchmark to ClusterMode
 */
export function mapTopologyToClusterMode(topology: string): ClusterMode {
  const mapping: Record<string, ClusterMode> = {
    'TP4_RDMA': 'TP4_RDMA',
    'TP2_RDMA': 'TP2_RDMA',
    'RING_PP5': 'RING_PP5',
    'RING_PP4': 'RING_PP4',
    'RING_PP3': 'RING_PP3',
    'RING_PP2': 'RING_PP2',
    'EP5_SOLO': 'EP5_SOLO',
    'DP5_REPLICATED': 'DP5_REPLICATED',
  };

  return mapping[topology] || 'TP4_RDMA';
}

/**
 * Convert replay frame to dashboard node metrics
 */
export function replayFrameToNodeMetrics(
  frame: ReplayFrame,
  baseNodes: NodeMetrics[]
): NodeMetrics[] {
  return baseNodes.map((baseNode, index) => {
    const replayNode = frame.nodes.find(n => n.name === baseNode.name) ||
                       frame.nodes[index];

    if (!replayNode) {
      return {
        ...baseNode,
        cpu_util: 0,
        gpu_util: 0,
        temp_c: 35,
        power_w: 15,
        ram_used: 8,
        tok_per_sec: 0,
        kv_cache_pct: 0,
        rx_gbps: 0,
        tx_gbps: 0,
        role: 'idle',
      };
    }

    // Determine role from topology and node activity
    const topology = mapTopologyToClusterMode(frame.topology);
    let role: string = 'compute';

    if (topology === 'EP5_SOLO') {
      role = 'standalone';
    } else if (replayNode.gpu_util < 5 && replayNode.tok_per_sec < 0.1) {
      role = 'idle';
    }

    return {
      ...baseNode,
      cpu_util: replayNode.cpu_util,
      gpu_util: replayNode.gpu_util,
      temp_c: replayNode.temp_c,
      power_w: replayNode.power_w,
      ram_used: replayNode.ram_used,
      ram_total: replayNode.ram_total,
      tok_per_sec: replayNode.tok_per_sec,
      kv_cache_pct: replayNode.kv_cache_pct,
      rx_gbps: replayNode.rx_gbps,
      tx_gbps: replayNode.tx_gbps,
      role,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load benchmark suite summary from server
 */
export async function loadBenchmarkSummaries(): Promise<BenchmarkSummary[]> {
  try {
    const response = await fetch('/api/benchmarks');
    if (!response.ok) throw new Error('Failed to load benchmarks');
    return await response.json();
  } catch (e) {
    console.error('Error loading benchmark summaries:', e);
    return [];
  }
}

/**
 * Load a specific benchmark replay
 */
export async function loadBenchmarkReplay(
  suiteId: string,
  configId: string,
  iterationId: number
): Promise<BenchmarkReplay | null> {
  try {
    const response = await fetch(
      `/api/benchmarks/${suiteId}/${configId}/${iterationId}/replay`
    );
    if (!response.ok) throw new Error('Failed to load replay');
    return await response.json();
  } catch (e) {
    console.error('Error loading benchmark replay:', e);
    return null;
  }
}

/**
 * Load replay from a local file (for development/testing)
 */
export async function loadReplayFromFile(file: File): Promise<BenchmarkReplay | null> {
  try {
    const text = await file.text();
    return JSON.parse(text) as BenchmarkReplay;
  } catch (e) {
    console.error('Error parsing replay file:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE DATA (for testing without actual benchmarks)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate sample replay data for testing the visualization
 * This simulates what real benchmark data would look like
 */
export function generateSampleReplay(
  topology: ClusterMode,
  inputTokens: number,
  durationSeconds: number = 30
): BenchmarkReplay {
  const frameIntervalMs = 500;
  const frameCount = Math.floor((durationSeconds * 1000) / frameIntervalMs);

  const nodes = ['muladhara', 'svadhisthana', 'manipura', 'anahata', 'vishuddha'];

  // Determine active nodes based on topology
  let activeNodeCount = 5;
  if (topology === 'TP4_RDMA' || topology === 'RING_PP4') activeNodeCount = 4;
  if (topology === 'TP2_RDMA' || topology === 'RING_PP2') activeNodeCount = 2;
  if (topology === 'RING_PP3') activeNodeCount = 3;

  // Reference performance values (from verified benchmarks)
  const perfByTopology: Record<string, { tps: number; ttft: number; memPerNode: number }> = {
    'TP4_RDMA': { tps: 15.6, ttft: 340, memPerNode: 185 },
    'TP2_RDMA': { tps: 8.5, ttft: 450, memPerNode: 320 },
    'RING_PP5': { tps: 15.1, ttft: 1600, memPerNode: 123 },
    'RING_PP4': { tps: 13.2, ttft: 1300, memPerNode: 154 },
    'RING_PP3': { tps: 11.0, ttft: 1100, memPerNode: 205 },
    'RING_PP2': { tps: 8.0, ttft: 900, memPerNode: 307 },
    'EP5_SOLO': { tps: 150, ttft: 150, memPerNode: 45 },
  };

  const perf = perfByTopology[topology] || perfByTopology['TP4_RDMA'];

  const frames: ReplayFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const timestampMs = i * frameIntervalMs;
    const progress = i / frameCount;

    // Simulate inference phases
    // Phase 1 (0-10%): Warming up
    // Phase 2 (10-90%): Steady state generation
    // Phase 3 (90-100%): Finishing
    let phase = 'steady';
    let phaseMultiplier = 1.0;

    if (progress < 0.1) {
      phase = 'warmup';
      phaseMultiplier = 0.3 + progress * 7; // Ramp up
    } else if (progress > 0.9) {
      phase = 'finishing';
      phaseMultiplier = 1.0 - (progress - 0.9) * 5; // Ramp down
    }

    // Add temporal variation
    const timeFactor = Math.sin(timestampMs / 2000) * 0.1;
    const jitter = () => (Math.random() - 0.5) * 0.1;

    const frameNodes: ReplayNodeMetrics[] = nodes.map((name, nodeIndex) => {
      const isActive = nodeIndex < activeNodeCount;

      if (!isActive) {
        return {
          name,
          cpu_util: 2 + Math.random() * 3,
          gpu_util: 0,
          temp_c: 35 + Math.random() * 3,
          power_w: 15 + Math.random() * 5,
          ram_used: 8 + Math.random() * 2,
          ram_total: 512,
          tok_per_sec: 0,
          kv_cache_pct: 0,
          rx_gbps: 0.01,
          tx_gbps: 0.01,
        };
      }

      // Active node metrics vary by topology type
      const isTP = topology.includes('TP');
      const isPP = topology.startsWith('RING_PP');

      // For PP: wave effect through nodes
      const stagePhase = isPP
        ? (progress + nodeIndex * 0.2) % 1
        : progress;

      const gpuBurst = Math.sin(stagePhase * Math.PI * 8) * 0.15;

      return {
        name,
        cpu_util: 35 + Math.random() * 15 + timeFactor * 10,
        gpu_util: (70 + gpuBurst * 100 + Math.random() * 10) * phaseMultiplier,
        temp_c: 55 + nodeIndex * 1.5 + Math.random() * 5,
        power_w: (80 + Math.random() * 40) * phaseMultiplier,
        ram_used: perf.memPerNode + Math.random() * 8,
        ram_total: 512,
        tok_per_sec: (perf.tps / activeNodeCount) * (0.9 + jitter()) * phaseMultiplier,
        kv_cache_pct: 30 + progress * 40 + Math.random() * 10,
        rx_gbps: isTP ? 12 * (0.8 + jitter()) : (isPP ? (nodeIndex > 0 ? 6 : 0.1) : 0.1),
        tx_gbps: isTP ? 12 * (0.8 + jitter()) : (isPP ? (nodeIndex < activeNodeCount - 1 ? 6 : 0.1) : 0.1),
      };
    });

    const clusterTps = frameNodes.reduce((sum, n) => sum + n.tok_per_sec, 0);

    frames.push({
      timestamp_ms: timestampMs,
      topology,
      nodes: frameNodes,
      cluster_tps: clusterTps,
      active_model: 'Kimi-K2-Thinking',
      ttft_ms: perf.ttft,
      animation_profile: topology.includes('TP') ? 'network_melter' :
                         topology.startsWith('RING_PP') ? 'memory_giant' : 'the_swarm',
    });
  }

  return {
    suite_id: 'sample-' + Date.now(),
    config_id: `${topology}_${inputTokens}tok`,
    iteration_id: 1,
    model_name: 'Kimi-K2-Thinking',
    topology,
    input_tokens: inputTokens,
    avg_tps: perf.tps,
    avg_ttft_ms: perf.ttft,
    peak_memory_gb: perf.memPerNode * activeNodeCount,
    total_energy_wh: 0.15,
    frames,
    total_duration_ms: durationSeconds * 1000,
    frame_interval_ms: frameIntervalMs,
  };
}
