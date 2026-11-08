import { describe, it, expect } from 'vitest';
import {
  calculateMetrics,
  formatTps,
  formatTtft,
  formatMemory,
  formatPower,
  getDefaultConfig,
} from '../simulation/metricsEngine';
import type { SimulationConfig } from '../simulation/metricsEngine';

// ── calculateMetrics ────────────────────────────────────────────

describe('calculateMetrics', () => {
  it('returns empty metrics for unknown or empty model', () => {
    const config: SimulationConfig = {
      modelId: 'nonexistent-model',
      quantization: 'Q4',
      topology: 'TP4_RDMA',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const m = calculateMetrics(config);
    expect(m.feasible).toBe(false);
    expect(m.tps).toBe(0);

    // Empty model ID = cluster off
    const empty = calculateMetrics({ ...config, modelId: '' });
    expect(empty.feasible).toBe(false);
    expect(empty.tps).toBe(0);
  });

  it('returns unfeasible for unsupported topology', () => {
    // Kimi K2.5 has no SINGLE topology
    const config: SimulationConfig = {
      modelId: 'kimi-k2.5',
      quantization: 'Q4',
      topology: 'SINGLE',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const m = calculateMetrics(config);
    expect(m.feasible).toBe(false);
  });

  it('calculates reasonable TPS for Kimi K2.5 TP4', () => {
    const config: SimulationConfig = {
      modelId: 'kimi-k2.5',
      quantization: 'Q4',
      topology: 'TP4_RDMA',
      kvCacheTokens: 1024,
      batchMode: false,
    };
    const m = calculateMetrics(config);
    expect(m.feasible).toBe(true);
    expect(m.tps).toBeGreaterThan(5);
    expect(m.tps).toBeLessThan(30);
    expect(m.nodeCount).toBe(4);
  });

  it('calculates reasonable TPS for Qwen 32B single node', () => {
    const config: SimulationConfig = {
      modelId: 'qwen25-32b',
      quantization: 'Q4',
      topology: 'SINGLE',
      kvCacheTokens: 1024,
      batchMode: false,
    };
    const m = calculateMetrics(config);
    expect(m.feasible).toBe(true);
    expect(m.tps).toBeGreaterThan(25);  // Real benchmark: 31.46 T/s
    expect(m.tps).toBeLessThan(40);
    expect(m.nodeCount).toBe(1);
  });

  it('longer context reduces TPS', () => {
    const short: SimulationConfig = {
      modelId: 'llama-405b',
      quantization: 'Q4',
      topology: 'TP4_RDMA',
      kvCacheTokens: 1024,
      batchMode: false,
    };
    const long: SimulationConfig = {
      ...short,
      kvCacheTokens: 32768,
    };
    const mShort = calculateMetrics(short);
    const mLong = calculateMetrics(long);
    expect(mLong.tps).toBeLessThan(mShort.tps);
  });

  it('batch mode increases total throughput', () => {
    const config: SimulationConfig = {
      modelId: 'qwen25-32b',
      quantization: 'Q4',
      topology: 'SINGLE',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const batched = { ...config, batchMode: true };
    expect(calculateMetrics(batched).tps).toBeGreaterThan(calculateMetrics(config).tps);
  });

  it('memory per node decreases with more TP nodes', () => {
    const tp2: SimulationConfig = {
      modelId: 'llama-405b',
      quantization: 'Q4',
      topology: 'TP2_RDMA',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const tp4 = { ...tp2, topology: 'TP4_RDMA' as const };
    const mTP2 = calculateMetrics(tp2);
    const mTP4 = calculateMetrics(tp4);
    expect(mTP4.memPerNode).toBeLessThan(mTP2.memPerNode);
  });

  it('EP modes multiply throughput by node count', () => {
    const single: SimulationConfig = {
      modelId: 'qwen25-32b',
      quantization: 'Q4',
      topology: 'SINGLE',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const ep5 = { ...single, topology: 'EP5_SOLO' as const };
    const mSingle = calculateMetrics(single);
    const mEP5 = calculateMetrics(ep5);
    // EP5 should be roughly 5× single (with slight per-node variation)
    expect(mEP5.tps).toBeGreaterThan(mSingle.tps * 3);
  });

  it('includes perplexity quality percentage', () => {
    const config: SimulationConfig = {
      modelId: 'llama-405b',
      quantization: 'Q4',
      topology: 'TP4_RDMA',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const m = calculateMetrics(config);
    expect(m.perplexityPct).toBeGreaterThan(80);
    expect(m.perplexityPct).toBeLessThanOrEqual(100);
  });

  it('Q2 quantization has low quality warning', () => {
    const config: SimulationConfig = {
      modelId: 'llama-405b',
      quantization: 'Q2',
      topology: 'TP4_RDMA',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const m = calculateMetrics(config);
    expect(m.perplexityPct).toBeLessThan(80);
    expect(m.warnings.some(w => w.toLowerCase().includes('quality'))).toBe(true);
  });

  it('provides per-node memory breakdown', () => {
    const config: SimulationConfig = {
      modelId: 'llama-405b',
      quantization: 'Q4',
      topology: 'TP4_RDMA',
      kvCacheTokens: 4096,
      batchMode: false,
    };
    const m = calculateMetrics(config);
    expect(m.weightsPerNode).toBeGreaterThan(0);
    expect(m.kvCachePerNode).toBeGreaterThan(0);
    expect(m.freePerNode).toBeGreaterThanOrEqual(0);
    // weights + kv + free should approximately equal node capacity
    expect(m.weightsPerNode + m.kvCachePerNode + m.freePerNode).toBeCloseTo(512, -1);
  });
});

// ── getDefaultConfig ────────────────────────────────────────────

describe('getDefaultConfig', () => {
  it('prefers TP4 for large models', () => {
    const config = getDefaultConfig('llama-405b');
    expect(config.topology).toBe('TP4_RDMA');
  });

  it('returns Q4 quantization by default', () => {
    const config = getDefaultConfig('qwen25-32b');
    expect(config.quantization).toBe('Q4');
  });

  it('returns 4096 context tokens by default', () => {
    const config = getDefaultConfig('kimi-k2.5');
    expect(config.kvCacheTokens).toBe(4096);
  });
});

// ── Formatting functions ────────────────────────────────────────

describe('formatTps', () => {
  it('rounds to integer for high TPS', () => {
    expect(formatTps(125.7)).toBe('126');
  });

  it('shows one decimal for medium TPS', () => {
    expect(formatTps(15.64)).toBe('15.6');
  });

  it('shows two decimals for low TPS', () => {
    expect(formatTps(4.02)).toBe('4.02');
  });
});

describe('formatTtft', () => {
  it('shows milliseconds for sub-second TTFT', () => {
    expect(formatTtft(0.34)).toBe('340ms');
  });

  it('shows seconds for >= 1s TTFT', () => {
    expect(formatTtft(1.6)).toBe('1.60s');
  });
});

describe('formatMemory', () => {
  it('shows GB for < 1000', () => {
    expect(formatMemory(512)).toBe('512GB');
  });

  it('shows TB for >= 1000', () => {
    expect(formatMemory(2560)).toBe('2.6TB');
  });
});

describe('formatPower', () => {
  it('shows W for < 1000', () => {
    expect(formatPower(380)).toBe('380W');
  });

  it('shows kW for >= 1000', () => {
    expect(formatPower(1200)).toBe('1.2kW');
  });
});
