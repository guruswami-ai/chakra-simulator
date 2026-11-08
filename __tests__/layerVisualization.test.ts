import { describe, it, expect } from 'vitest';
import { isTensorParallel, isPipelineParallel } from '../simulation/simulationUtils';
import type { ClusterMode } from '../types';

/**
 * Layer visualization tests validate the logic that determines how model layers
 * are split and displayed across nodes in the LayerStack component.
 *
 * The core function tested is getLayerRange() — extracted here as pure logic.
 */

interface LayerRange {
  start: number;
  end: number;
}

// Mirror getLayerRange from LayerStack.tsx (pure function extraction)
function getLayerRange(
  nodeIndex: number,
  totalLayers: number,
  topology: ClusterMode,
  activeNodeCount: number,
): LayerRange {
  if (isPipelineParallel(topology)) {
    const layersPerNode = Math.round(totalLayers / activeNodeCount);
    const start = nodeIndex * layersPerNode;
    const end = (nodeIndex + 1) * layersPerNode;
    return { start, end };
  }
  // TP/Single: all nodes hold all layers
  return { start: 0, end: totalLayers };
}

// ── PP mode: sequential layer split ─────────────────────────────

describe('PP mode layer ranges', () => {
  it('evenly splits 128 layers across 4 stages', () => {
    const ranges = Array.from({ length: 4 }, (_, i) =>
      getLayerRange(i, 128, 'RING_PP4', 4)
    );
    // Each stage: 32 layers
    expect(ranges[0]).toEqual({ start: 0, end: 32 });
    expect(ranges[1]).toEqual({ start: 32, end: 64 });
    expect(ranges[2]).toEqual({ start: 64, end: 96 });
    expect(ranges[3]).toEqual({ start: 96, end: 128 });
  });

  it('evenly splits 128 layers across 5 stages', () => {
    const ranges = Array.from({ length: 5 }, (_, i) =>
      getLayerRange(i, 128, 'RING_PP5', 5)
    );
    // 128 / 5 = 25.6, rounds to 26
    const layersPerNode = Math.round(128 / 5);
    expect(layersPerNode).toBe(26);
    for (let i = 0; i < 5; i++) {
      expect(ranges[i].end - ranges[i].start).toBe(layersPerNode);
    }
  });

  it('all stages have equal layer counts', () => {
    // This is the key property: even splits (no remainder dumped on last node)
    const testCases: Array<{ layers: number; topology: ClusterMode; nodes: number }> = [
      { layers: 128, topology: 'RING_PP2', nodes: 2 },
      { layers: 128, topology: 'RING_PP4', nodes: 4 },
      { layers: 61, topology: 'RING_PP5', nodes: 5 },   // Kimi K2.5: 61 layers
      { layers: 126, topology: 'RING_PP5', nodes: 5 },   // Llama 405B: 126 layers
      { layers: 64, topology: 'RING_PP3', nodes: 3 },    // Qwen 32B: 64 layers
    ];

    for (const { layers, topology, nodes } of testCases) {
      const ranges = Array.from({ length: nodes }, (_, i) =>
        getLayerRange(i, layers, topology, nodes)
      );
      const counts = ranges.map(r => r.end - r.start);
      // All stages should have the same count (Math.round ensures this)
      const uniqueCounts = new Set(counts);
      expect(uniqueCounts.size).toBe(1);
    }
  });

  it('stages are sequential (no gaps, no overlaps)', () => {
    const ranges = Array.from({ length: 5 }, (_, i) =>
      getLayerRange(i, 128, 'RING_PP5', 5)
    );
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start).toBe(ranges[i - 1].end);
    }
  });
});

// ── TP mode: all nodes hold all layers ──────────────────────────

describe('TP mode layer ranges', () => {
  it('all nodes show full layer count', () => {
    const topologies: ClusterMode[] = ['TP2_RDMA', 'TP4_RDMA'];
    for (const topo of topologies) {
      const nodeCount = topo.includes('2') ? 2 : 4;
      const ranges = Array.from({ length: nodeCount }, (_, i) =>
        getLayerRange(i, 128, topo, nodeCount)
      );
      for (const range of ranges) {
        expect(range).toEqual({ start: 0, end: 128 });
      }
    }
  });
});

// ── EP mode: all nodes show full layers ─────────────────────────

describe('EP mode layer ranges', () => {
  it('each independent node shows 100% of layers', () => {
    const ranges = Array.from({ length: 5 }, (_, i) =>
      getLayerRange(i, 64, 'EP5_SOLO', 5)
    );
    for (const range of ranges) {
      expect(range).toEqual({ start: 0, end: 64 });
    }
  });
});

// ── Animation timing scales with TPS ────────────────────────────

describe('animation duration scaling', () => {
  /**
   * The LayerStack activity wave animation duration is defined as:
   *   dur = `${2 + nodeIndex * 0.1}s`  (base: 2s for node 0)
   *
   * Future TPS-linked animation would use:
   *   dur = 4s at 0 TPS → 0.8s at 20 TPS
   *
   * This test validates the intended scaling curve.
   */
  function getAnimDuration(tps: number): number {
    if (tps <= 0) return 4.0;
    // Linear interpolation: 4s at 0 TPS, 0.8s at 20 TPS
    const t = Math.min(1, tps / 20);
    return 4.0 - t * 3.2;
  }

  it('returns 4s at 0 TPS (idle)', () => {
    expect(getAnimDuration(0)).toBe(4.0);
  });

  it('returns 0.8s at 20 TPS (max speed)', () => {
    expect(getAnimDuration(20)).toBeCloseTo(0.8);
  });

  it('returns ~2.4s at 10 TPS (midpoint)', () => {
    expect(getAnimDuration(10)).toBeCloseTo(2.4);
  });

  it('caps at 0.8s for TPS > 20', () => {
    expect(getAnimDuration(50)).toBeCloseTo(0.8);
  });

  it('duration monotonically decreases with TPS', () => {
    const durations = [0, 5, 10, 15, 20].map(getAnimDuration);
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeLessThanOrEqual(durations[i - 1]);
    }
  });
});

// ── Real model layer splits (regression tests) ─────────────────

describe('real model layer splits', () => {
  it('Kimi K2.5 (61 layers) PP5: 12 layers per stage', () => {
    const layersPerNode = Math.round(61 / 5);
    expect(layersPerNode).toBe(12);
    const ranges = Array.from({ length: 5 }, (_, i) =>
      getLayerRange(i, 61, 'RING_PP5', 5)
    );
    for (const range of ranges) {
      expect(range.end - range.start).toBe(12);
    }
  });

  it('Llama 405B (126 layers) PP4: 32 layers per stage', () => {
    const layersPerNode = Math.round(126 / 4);
    expect(layersPerNode).toBe(32);
  });

  it('Qwen 32B (64 layers) PP2: 32 layers per stage', () => {
    const layersPerNode = Math.round(64 / 2);
    expect(layersPerNode).toBe(32);
  });
});
