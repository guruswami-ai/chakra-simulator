import { describe, it, expect } from 'vitest';
import {
  getActiveNodeIndices,
  isTensorParallel,
  isPipelineParallel,
  isDataParallel,
  getNodeVisualState,
  getRingExpansionScale,
  getTokenFlowInterval,
  getExpectedTTFT,
  isLinkBidirectional,
  getAnimationProfile,
} from '../simulation/simulationUtils';
import type { ClusterMode, NodeMetrics } from '../types';

// ── getActiveNodeIndices ────────────────────────────────────────

describe('getActiveNodeIndices', () => {
  it('returns empty for OFFLINE', () => {
    expect(getActiveNodeIndices('OFFLINE')).toEqual([]);
  });

  it('returns all 5 nodes for EP5_SOLO', () => {
    expect(getActiveNodeIndices('EP5_SOLO')).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns all 5 nodes for DP5_REPLICATED', () => {
    expect(getActiveNodeIndices('DP5_REPLICATED')).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns correct count for PP topologies', () => {
    expect(getActiveNodeIndices('RING_PP2')).toHaveLength(2);
    expect(getActiveNodeIndices('RING_PP3')).toHaveLength(3);
    expect(getActiveNodeIndices('RING_PP4')).toHaveLength(4);
    expect(getActiveNodeIndices('RING_PP5')).toHaveLength(5);
  });

  it('PP nodes start from 0 sequentially', () => {
    expect(getActiveNodeIndices('RING_PP3')).toEqual([0, 1, 2]);
    expect(getActiveNodeIndices('RING_PP5')).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns correct count for TP RDMA topologies', () => {
    expect(getActiveNodeIndices('TP2_RDMA')).toHaveLength(2);
    expect(getActiveNodeIndices('TP4_RDMA')).toHaveLength(4);
  });

  it('TP nodes start from 0', () => {
    expect(getActiveNodeIndices('TP2_RDMA')).toEqual([0, 1]);
    expect(getActiveNodeIndices('TP4_RDMA')).toEqual([0, 1, 2, 3]);
  });

  it('returns 4 nodes as default fallback', () => {
    // Any unrecognized topology should default to 4
    expect(getActiveNodeIndices('TP4_CONTROLLER' as ClusterMode)).toEqual([0, 1, 2, 3]);
  });
});

// ── Topology classification ─────────────────────────────────────

describe('isTensorParallel', () => {
  it('correctly identifies TP RDMA modes', () => {
    expect(isTensorParallel('TP2_RDMA')).toBe(true);
    expect(isTensorParallel('TP4_RDMA')).toBe(true);
    expect(isTensorParallel('TP3_RDMA')).toBe(true);
    expect(isTensorParallel('TP5_RDMA')).toBe(true);
  });

  it('correctly identifies legacy HYBRID_TP modes', () => {
    expect(isTensorParallel('HYBRID_TP2')).toBe(true);
    expect(isTensorParallel('HYBRID_TP4')).toBe(true);
  });

  it('rejects EP/DP modes', () => {
    expect(isTensorParallel('EP5_SOLO')).toBe(false);
    expect(isTensorParallel('DP5_REPLICATED')).toBe(false);
  });

  it('rejects PP modes', () => {
    expect(isTensorParallel('RING_PP2')).toBe(false);
    expect(isTensorParallel('RING_PP5')).toBe(false);
  });
});

describe('isPipelineParallel', () => {
  it('correctly identifies PP modes', () => {
    expect(isPipelineParallel('RING_PP2')).toBe(true);
    expect(isPipelineParallel('RING_PP3')).toBe(true);
    expect(isPipelineParallel('RING_PP4')).toBe(true);
    expect(isPipelineParallel('RING_PP5')).toBe(true);
  });

  it('rejects non-PP modes', () => {
    expect(isPipelineParallel('TP2_RDMA')).toBe(false);
    expect(isPipelineParallel('EP5_SOLO')).toBe(false);
    expect(isPipelineParallel('OFFLINE')).toBe(false);
  });
});

describe('isDataParallel', () => {
  it('correctly identifies DP/EP modes', () => {
    expect(isDataParallel('DP5_REPLICATED')).toBe(true);
    expect(isDataParallel('EP5_SOLO')).toBe(true);
  });

  it('rejects TP and PP modes', () => {
    expect(isDataParallel('TP4_RDMA')).toBe(false);
    expect(isDataParallel('RING_PP5')).toBe(false);
  });
});

// ── Node visual state ───────────────────────────────────────────

describe('getNodeVisualState', () => {
  const makeNode = (overrides: Partial<NodeMetrics>): NodeMetrics => ({
    id: 'test-node',
    name: 'test',
    role: 'worker',
    hw_model: 'Mac Studio M4 Ultra',
    cpu_util: 10,
    gpu_util: 0,
    soc_load: 0,
    temp_c: 40,
    power_w: 20,
    ram_used: 20,
    ram_total: 512,
    wired_gb: 10,
    kv_cache_pct: 0,
    rx_gbps: 0,
    tx_gbps: 0,
    tok_per_sec: 0,
    rdma_latency_us: 0,
    tb5_links: 4,
    tb5_reachable: 4,
    tb5_latency_ms: 0,
    tb5_status: 'healthy',
    index: 0,
    color: '#6366f1',
    glowColor: '#6366f1',
    warnings: [],
    ...overrides,
  });

  it('returns offline when power < 1W', () => {
    expect(getNodeVisualState(makeNode({ power_w: 0.5 }))).toBe('offline');
  });

  it('returns offline when power_w is 0', () => {
    expect(getNodeVisualState(makeNode({ power_w: 0 }))).toBe('offline');
  });

  it('returns compute when GPU is active', () => {
    expect(getNodeVisualState(makeNode({ gpu_util: 80, power_w: 100 }))).toBe('compute');
  });

  it('returns standby when model loaded but GPU idle', () => {
    expect(getNodeVisualState(makeNode({ gpu_util: 2, wired_gb: 150, power_w: 50 }))).toBe('standby');
  });

  it('returns idle when online but no model', () => {
    expect(getNodeVisualState(makeNode({ gpu_util: 0, wired_gb: 10, power_w: 20 }))).toBe('idle');
  });
});

// ── Ring expansion scale ────────────────────────────────────────

describe('getRingExpansionScale', () => {
  const makeNode = (wired: number, total: number): NodeMetrics => ({
    id: 'test-node', name: 'test', role: 'worker', hw_model: 'Mac Studio M4 Ultra',
    cpu_util: 0, gpu_util: 0, soc_load: 0, temp_c: 40, power_w: 20,
    ram_used: 20, ram_total: total, wired_gb: wired, kv_cache_pct: 0,
    rx_gbps: 0, tx_gbps: 0, tok_per_sec: 0, rdma_latency_us: 0,
    tb5_links: 0, tb5_reachable: 0, tb5_latency_ms: 0, tb5_status: 'unknown',
    index: 0, color: '#6366f1', glowColor: '#6366f1', warnings: [],
  });

  it('returns 1.0 when no memory used', () => {
    expect(getRingExpansionScale(makeNode(0, 512))).toBe(1.0);
  });

  it('returns 1.5 when RAM fully used', () => {
    expect(getRingExpansionScale(makeNode(512, 512))).toBe(1.5);
  });

  it('scales linearly', () => {
    const scale = getRingExpansionScale(makeNode(256, 512));
    expect(scale).toBeCloseTo(1.25);
  });
});

// ── Token flow interval ─────────────────────────────────────────

describe('getTokenFlowInterval', () => {
  it('returns 0 for 0 TPS (no flow)', () => {
    expect(getTokenFlowInterval(0)).toBe(0);
  });

  it('returns 0 for negative TPS', () => {
    expect(getTokenFlowInterval(-1)).toBe(0);
  });

  it('returns ~77ms for 13 TPS', () => {
    expect(getTokenFlowInterval(13)).toBeCloseTo(1000 / 13, 0);
  });

  it('caps at 5ms minimum (200 TPS max visual rate)', () => {
    expect(getTokenFlowInterval(500)).toBe(5);
  });
});

// ── Expected TTFT ───────────────────────────────────────────────

describe('getExpectedTTFT', () => {
  it('returns 0 for OFFLINE', () => {
    expect(getExpectedTTFT('OFFLINE')).toBe(0);
  });

  it('TP modes have lower TTFT than PP modes', () => {
    const tpTtft = getExpectedTTFT('TP4_RDMA');
    const ppTtft = getExpectedTTFT('RING_PP5');
    expect(tpTtft).toBeLessThan(ppTtft);
  });

  it('standalone has lowest TTFT', () => {
    const soloTtft = getExpectedTTFT('EP5_SOLO');
    const tpTtft = getExpectedTTFT('TP4_RDMA');
    expect(soloTtft).toBeLessThan(tpTtft);
  });

  it('PP TTFT scales with stage count', () => {
    const pp2 = getExpectedTTFT('RING_PP2');
    const pp5 = getExpectedTTFT('RING_PP5');
    expect(pp5).toBeGreaterThan(pp2);
  });
});

// ── Link directionality ─────────────────────────────────────────

describe('isLinkBidirectional', () => {
  it('PP links are unidirectional', () => {
    expect(isLinkBidirectional('RING_PP5', 0, 1)).toBe(false);
  });

  it('TP links are bidirectional (all-reduce)', () => {
    expect(isLinkBidirectional('TP4_RDMA', 0, 1)).toBe(true);
  });

  it('EP5_SOLO has no bidirectional links', () => {
    expect(isLinkBidirectional('EP5_SOLO', 0, 1)).toBe(false);
  });
});

// ── Animation profiles ──────────────────────────────────────────

describe('getAnimationProfile', () => {
  it('TP topologies get network_melter profile', () => {
    expect(getAnimationProfile('TP4_RDMA').scenario).toBe('network_melter');
  });

  it('PP topologies get memory_giant profile', () => {
    expect(getAnimationProfile('RING_PP5').scenario).toBe('memory_giant');
  });

  it('EP/DP topologies get the_swarm profile', () => {
    expect(getAnimationProfile('EP5_SOLO').scenario).toBe('the_swarm');
    expect(getAnimationProfile('DP5_REPLICATED').scenario).toBe('the_swarm');
  });
});
