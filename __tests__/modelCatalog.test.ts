import { describe, it, expect } from 'vitest';
import {
  MODEL_CATALOG,
  getModel,
  getNodeCount,
  getQuantSpec,
  getSupportedTopologies,
  isTopologySupported,
  willFitInCluster,
  getIncompatibilityReason,
  QUANT_ORDER,
} from '../simulation/modelCatalog';
import type { Quantization } from '../simulation/modelCatalog';

// ── Catalog integrity ───────────────────────────────────────────

describe('MODEL_CATALOG integrity', () => {
  it('has at least 5 models', () => {
    expect(MODEL_CATALOG.length).toBeGreaterThanOrEqual(5);
  });

  for (const model of MODEL_CATALOG) {
    describe(`${model.displayName} (${model.id})`, () => {
      it('has required fields', () => {
        expect(model.id).toBeTruthy();
        expect(model.name).toBeTruthy();
        expect(model.displayName).toBeTruthy();
        expect(model.layers).toBeGreaterThan(0);
        expect(model.attentionHeads).toBeGreaterThan(0);
        expect(model.maxContext).toBeGreaterThan(0);
        expect(model.kvBytesPerTokenPerLayer).toBeGreaterThan(0);
        expect(model.kvCacheScaling).toBeGreaterThan(0);
        expect(model.batchSpeedup).toBeGreaterThan(1);
        expect(model.color).toMatch(/^#[0-9a-f]{6}$/i);
      });

      it('has Q4 quantization available', () => {
        const q4 = model.quantizations['Q4'];
        expect(q4).toBeDefined();
        expect(q4!.available).toBe(true);
        expect(q4!.memoryGB).toBeGreaterThan(0);
      });

      it('quantization memory decreases with compression', () => {
        // F16 > Q8 > Q6 > Q4 > Q3 > Q2
        const quants = QUANT_ORDER.filter(q => model.quantizations[q]?.available);
        for (let i = 1; i < quants.length; i++) {
          const higher = model.quantizations[quants[i - 1]]!;
          const lower = model.quantizations[quants[i]]!;
          expect(lower.memoryGB).toBeLessThan(higher.memoryGB);
        }
      });

      it('perplexity decreases with quantization', () => {
        const quants = QUANT_ORDER.filter(q => model.quantizations[q]?.available);
        for (let i = 1; i < quants.length; i++) {
          const higher = model.quantizations[quants[i - 1]]!;
          const lower = model.quantizations[quants[i]]!;
          expect(lower.perplexityPct).toBeLessThanOrEqual(higher.perplexityPct);
        }
      });

      it('has at least one supported topology', () => {
        const topos = Object.keys(model.performance);
        expect(topos.length).toBeGreaterThan(0);
      });

      it('all working performance entries have positive TPS and TTFT', () => {
        for (const [topo, perf] of Object.entries(model.performance)) {
          if (perf!.error) continue; // Error topologies have tps: 0 by design
          expect(perf!.tps).toBeGreaterThan(0);
          expect(perf!.ttft).toBeGreaterThan(0);
        }
      });
    });
  }
});

// ── MLA vs GQA KV cache ────────────────────────────────────────

describe('MLA models have smaller KV cache than GQA', () => {
  it('DeepSeek V3 (MLA) uses less bytes per token than Llama 405B (GQA)', () => {
    const deepseek = getModel('deepseek-v3');
    const llama = getModel('llama-405b');
    expect(deepseek).toBeDefined();
    expect(llama).toBeDefined();
    expect(deepseek!.kvBytesPerTokenPerLayer).toBeLessThan(llama!.kvBytesPerTokenPerLayer);
  });
});

// ── getNodeCount ────────────────────────────────────────────────

describe('getNodeCount', () => {
  it('SINGLE = 1', () => expect(getNodeCount('SINGLE')).toBe(1));
  it('OFFLINE = 0', () => expect(getNodeCount('OFFLINE')).toBe(0));
  it('EP2_SOLO = 2', () => expect(getNodeCount('EP2_SOLO')).toBe(2));
  it('EP5_SOLO = 5', () => expect(getNodeCount('EP5_SOLO')).toBe(5));
  it('RING_PP2 = 2', () => expect(getNodeCount('RING_PP2')).toBe(2));
  it('RING_PP5 = 5', () => expect(getNodeCount('RING_PP5')).toBe(5));
  it('TP2_RDMA = 2', () => expect(getNodeCount('TP2_RDMA')).toBe(2));
  it('TP4_RDMA = 4', () => expect(getNodeCount('TP4_RDMA')).toBe(4));
  it('TP5_RDMA = 5', () => expect(getNodeCount('TP5_RDMA')).toBe(5));

  it('hybrid configs account for all nodes', () => {
    expect(getNodeCount('TP4_SOLO1')).toBe(5);
    expect(getNodeCount('TP2_SOLO3')).toBe(5);
  });
});

// ── Topology support ────────────────────────────────────────────

describe('isTopologySupported', () => {
  it('Kimi K2.5 supports TP4_RDMA', () => {
    expect(isTopologySupported('kimi-k2.5', 'TP4_RDMA')).toBe(true);
  });

  it('Kimi K2.5 SINGLE is in performance map but with OOM error', () => {
    // SINGLE is selectable — user experiences the OOM, guru explains
    expect(isTopologySupported('kimi-k2.5', 'SINGLE')).toBe(true);
    const model = getModel('kimi-k2.5')!;
    expect(model.performance['SINGLE']?.error).toBe('OOM');
  });

  it('Qwen 32B supports SINGLE', () => {
    expect(isTopologySupported('qwen25-32b', 'SINGLE')).toBe(true);
  });
});

// ── TP divisibility (the Prime Number Problem) ──────────────────

describe('TP divisibility', () => {
  it('Llama 405B (128 heads) supports TP2 and TP4', () => {
    const llama = getModel('llama-405b')!;
    expect(llama.attentionHeads % 2).toBe(0);
    expect(llama.attentionHeads % 4).toBe(0);
    expect(isTopologySupported('llama-405b', 'TP2_RDMA')).toBe(true);
    expect(isTopologySupported('llama-405b', 'TP4_RDMA')).toBe(true);
  });

  it('Qwen 32B TP5 is in performance map with RDMA_UNSTABLE error', () => {
    // TP5 math works (40÷5=8) but RDMA dies in practice — the topology trap
    const qwen = getModel('qwen25-32b')!;
    expect(qwen.attentionHeads % 5).toBe(0);
    expect(isTopologySupported('qwen25-32b', 'TP5_RDMA')).toBe(true);
    expect(qwen.performance['TP5_RDMA']?.error).toBe('RDMA_UNSTABLE');
  });

  it('getIncompatibilityReason returns SHARD ERR for bad TP divisions', () => {
    // Qwen 32B has 40 heads. 40 ÷ 3 = 13.33 — not supported
    const reason = getIncompatibilityReason('qwen25-32b', 'TP3_RDMA');
    expect(reason).toBe('SHARD ERR');
  });
});

// ── willFitInCluster ────────────────────────────────────────────

describe('willFitInCluster', () => {
  it('Qwen 32B Q4 fits on single node', () => {
    expect(willFitInCluster('qwen25-32b', 'Q4', 'SINGLE')).toBe(true);
  });

  it('Kimi K2.5 Q4 does NOT fit on single node', () => {
    // 612GB model on 512GB node
    expect(willFitInCluster('kimi-k2.5', 'Q4', 'SINGLE')).toBe(false);
  });

  it('Kimi K2.5 Q4 fits on TP4 (612/4 = 153GB/node)', () => {
    expect(willFitInCluster('kimi-k2.5', 'Q4', 'TP4_RDMA')).toBe(true);
  });

  it('Llama 405B F16 is not available (marked unavailable in catalog)', () => {
    // F16 at 810GB is OOM even on full cluster — marked available: false
    const spec = getQuantSpec('llama-405b', 'F16');
    expect(spec?.available).toBe(false);
  });
});

// ── getSupportedTopologies ──────────────────────────────────────

describe('getSupportedTopologies', () => {
  it('returns empty array for unknown model', () => {
    expect(getSupportedTopologies('nonexistent')).toEqual([]);
  });

  it('Kimi K2.5 supports TP2 and TP4 (benchmarked topologies)', () => {
    const topos = getSupportedTopologies('kimi-k2.5');
    expect(topos).toContain('TP4_RDMA');
    expect(topos).toContain('TP2_RDMA');
    // PP topologies removed — no benchmark data
    expect(topos).not.toContain('RING_PP5');
  });
});

// ── QUANT_ORDER ─────────────────────────────────────────────────

describe('QUANT_ORDER', () => {
  it('ordered from highest to lowest quality', () => {
    expect(QUANT_ORDER).toEqual(['F16', 'Q8', 'Q6', 'Q4', 'Q3', 'Q2']);
  });
});
