
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cpu, Sparkles, Gauge, Timer, Database, ChevronDown, Zap, Check, X, Layers, Network, Play, Pause, RotateCcw, Upload, Film, Settings, HardDrive, MemoryStick } from 'lucide-react';
import { ClusterMode } from '../types';
import {
  ReplayController,
  ReplayState,
  ReplayFrame,
  BenchmarkReplay,
  ReplaySpeed,
  generateSampleReplay,
  loadReplayFromFile,
  replayFrameToNodeMetrics,
  mapTopologyToClusterMode,
} from './benchmarkReplay';

// Re-export replay types for use by parent components
export type { ReplayState, ReplayFrame, BenchmarkReplay };

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * UNIFIED SIMULATION CONTROL PANEL
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This component provides an interactive benchmark explorer that lets users:
 * 1. Select different models to see how they perform
 * 2. Adjust input token count to see impact on TPS/TTFT/KV Cache
 * 3. Change network topology to compare PP vs TP strategies
 * 4. See real-time metric updates based on verified cluster benchmarks
 */

export interface ModelBenchmark {
  id: string;
  name: string;
  shortName: string;
  sizeGB: number;
  quantization: string;
  attentionHeads: number;
  params: string;           // e.g., "1T", "480B", "123B"
  architecture: 'MoE' | 'Dense' | 'Hybrid';  // Model architecture type
  activeParams?: string;    // For MoE: active params per forward pass
  performance: Partial<Record<ClusterMode, {
    tps: number;
    ttft: number;
    memPerNode: number;
  }>>;
  tokenScaling: Record<number, number>;
  recommendedMode: ClusterMode;
  category: 'reasoning' | 'coding' | 'general' | 'multimodal';
  strengths: string;        // Key use case / what it's best at
  description: string;
}

// Real benchmark data from Chakra Cluster (January 2026)
export const BENCHMARK_DATA: ModelBenchmark[] = [
  {
    id: 'kimi-k2.5',
    name: 'Kimi-K2.5',
    shortName: 'K2.5',
    sizeGB: 612,
    quantization: '4-bit',
    attentionHeads: 128,
    params: '1T',
    architecture: 'MoE',
    activeParams: '32B',
    performance: {
      'TP4_RDMA': { tps: 11.5, ttft: 0.8, memPerNode: 153 },
      'TP2_RDMA': { tps: 4.0, ttft: 2.5, memPerNode: 306 },
    },
    tokenScaling: { 50: 0.57, 256: 1.0, 512: 1.02, 1024: 1.03, 2048: 1.02, 4096: 1.02, 8192: 1.0 },
    recommendedMode: 'TP4_RDMA',
    category: 'reasoning',
    strengths: 'Deep reasoning, chain-of-thought, complex problem solving',
    description: '1T param MoE with MLA attention, 32B active per token. Best at TP4 RDMA with 11.5 TPS.',
  },
  {
    id: 'deepseek-v3-speciale',
    name: 'DeepSeek-V3.2-Speciale',
    shortName: 'DS-V3.2',
    sizeGB: 336,
    quantization: '4-bit',
    attentionHeads: 128,
    params: '671B',
    architecture: 'MoE',
    activeParams: '37B',
    performance: {
      'TP4_RDMA': { tps: 22.5, ttft: 0.28, memPerNode: 95 },
      'TP2_RDMA': { tps: 14.0, ttft: 0.35, memPerNode: 180 },
      'RING_PP4': { tps: 18.5, ttft: 1.0, memPerNode: 95 },
      'RING_PP3': { tps: 16.0, ttft: 0.85, memPerNode: 125 },
      'RING_PP2': { tps: 12.0, ttft: 0.7, memPerNode: 180 },
      'EP5_SOLO': { tps: 22.5, ttft: 0.28, memPerNode: 95 },
    },
    tokenScaling: { 50: 0.6, 256: 1.0, 512: 1.05, 1024: 1.08, 2048: 1.05, 4096: 1.0, 8192: 0.95 },
    recommendedMode: 'TP4_RDMA',
    category: 'general',
    strengths: 'Fast inference, versatile, strong coding & reasoning',
    description: '671B MoE with 256 experts, 37B active. Excellent speed-to-quality ratio for everyday tasks.',
  },
  {
    id: 'qwen3-coder-480b',
    name: 'Qwen3-Coder-480B',
    shortName: 'Qwen3-480B',
    sizeGB: 503,
    quantization: '8-bit',
    attentionHeads: 64,
    params: '480B',
    architecture: 'Dense',
    performance: {
      'TP4_RDMA': { tps: 12.0, ttft: 0.42, memPerNode: 145 },
      'TP2_RDMA': { tps: 7.0, ttft: 0.55, memPerNode: 270 },
      'RING_PP5': { tps: 11.5, ttft: 1.8, memPerNode: 105 },
      'RING_PP4': { tps: 10.0, ttft: 1.4, memPerNode: 135 },
    },
    tokenScaling: { 50: 0.55, 256: 1.0, 512: 1.1, 1024: 1.15, 2048: 1.1, 4096: 1.0, 8192: 0.9 },
    recommendedMode: 'RING_PP5',
    category: 'coding',
    strengths: 'Long context code completion, refactoring, debugging',
    description: 'Massive 480B dense transformer optimized for code. 128k context window, multi-language support.',
  },
  {
    id: 'devstral-2-123b',
    name: 'Devstral-2-123B',
    shortName: 'Devstral-2',
    sizeGB: 95,
    quantization: '6.5-bit',
    attentionHeads: 96,
    params: '123B',
    architecture: 'Dense',
    performance: {
      'TP4_RDMA': { tps: 45.0, ttft: 0.12, memPerNode: 28 },
      'TP2_RDMA': { tps: 32.0, ttft: 0.18, memPerNode: 52 },
      'RING_PP2': { tps: 28.0, ttft: 0.35, memPerNode: 52 },
      'EP5_SOLO': { tps: 35.0, ttft: 0.15, memPerNode: 95 },
    },
    tokenScaling: { 50: 0.7, 256: 1.0, 512: 1.1, 1024: 1.15, 2048: 1.1, 4096: 1.0, 8192: 0.85 },
    recommendedMode: 'TP4_RDMA',
    category: 'coding',
    strengths: 'Fast code gen, IDE integration, real-time completion',
    description: 'Mistral-based 123B coder. Low latency makes it ideal for agentic workflows and autocomplete.',
  },
  {
    id: 'minimax-m2',
    name: 'MiniMax-M2.1',
    shortName: 'MiniMax-M2',
    sizeGB: 115,
    quantization: '4-bit',
    attentionHeads: 64,
    params: '456B',
    architecture: 'MoE',
    activeParams: '45B',
    performance: {
      'TP4_RDMA': { tps: 38.0, ttft: 0.15, memPerNode: 35 },
      'TP2_RDMA': { tps: 28.0, ttft: 0.22, memPerNode: 65 },
      'EP5_SOLO': { tps: 32.0, ttft: 0.18, memPerNode: 115 },
    },
    tokenScaling: { 50: 0.65, 256: 1.0, 512: 1.08, 1024: 1.1, 2048: 1.05, 4096: 0.95, 8192: 0.85 },
    recommendedMode: 'TP4_RDMA',
    category: 'general',
    strengths: 'Multimodal, high throughput, balanced performance',
    description: '456B MoE (45B active) with vision. Fast generalist for chat, analysis, and image understanding.',
  },
];

export const TOKEN_STEPS = [50, 256, 512, 1024, 2048, 4096, 8192];

// ═══════════════════════════════════════════════════════════════════════════════
// INPUT TOKEN USE CASES - What different token counts represent in practice
// ═══════════════════════════════════════════════════════════════════════════════

export interface InputTokenUseCase {
  tokens: number;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  examples: string;
  kvCacheImpact: 'minimal' | 'low' | 'moderate' | 'high' | 'very_high' | 'extreme';
  ttftImpact: 'instant' | 'fast' | 'moderate' | 'noticeable' | 'slow' | 'very_slow';
}

export const INPUT_TOKEN_USE_CASES: InputTokenUseCase[] = [
  {
    tokens: 50,
    label: 'Quick Chat',
    shortLabel: 'Chat',
    description: 'Simple question or command',
    icon: '💬',
    examples: '"What is 2+2?" or "Hello, how are you?"',
    kvCacheImpact: 'minimal',
    ttftImpact: 'instant',
  },
  {
    tokens: 256,
    label: 'Email / Message',
    shortLabel: 'Email',
    description: 'Short email or chat context',
    icon: '📧',
    examples: 'Reply to an email, summarize a message thread',
    kvCacheImpact: 'low',
    ttftImpact: 'fast',
  },
  {
    tokens: 512,
    label: 'Article Summary',
    shortLabel: 'Article',
    description: 'Blog post or news article',
    icon: '📰',
    examples: 'Summarize a blog post, explain an article',
    kvCacheImpact: 'low',
    ttftImpact: 'fast',
  },
  {
    tokens: 1024,
    label: 'Document Review',
    shortLabel: 'Document',
    description: 'Multi-page document or report',
    icon: '📄',
    examples: 'Review a contract, analyze a report',
    kvCacheImpact: 'moderate',
    ttftImpact: 'moderate',
  },
  {
    tokens: 2048,
    label: 'PDF Analysis',
    shortLabel: 'PDF',
    description: 'Full PDF or technical document',
    icon: '📑',
    examples: 'Analyze research paper, review legal document',
    kvCacheImpact: 'high',
    ttftImpact: 'noticeable',
  },
  {
    tokens: 4096,
    label: 'Codebase Review',
    shortLabel: 'Code',
    description: 'Multiple source files or large codebase',
    icon: '💻',
    examples: 'Code review, refactor multiple files, debug complex issues',
    kvCacheImpact: 'very_high',
    ttftImpact: 'slow',
  },
  {
    tokens: 8192,
    label: 'Book Chapter',
    shortLabel: 'Book',
    description: 'Entire book chapter or massive context',
    icon: '📚',
    examples: 'Analyze full chapter, large codebase with context',
    kvCacheImpact: 'extreme',
    ttftImpact: 'very_slow',
  },
];

export function getInputTokenUseCase(tokens: number): InputTokenUseCase {
  // Find the closest matching use case
  const sorted = [...INPUT_TOKEN_USE_CASES].sort((a, b) =>
    Math.abs(a.tokens - tokens) - Math.abs(b.tokens - tokens)
  );
  return sorted[0];
}

// Topology mode descriptions and education
export const MODE_INFO: Record<string, {
  title: string;
  shortTitle: string;
  strategy: 'Pipeline Parallel' | 'Tensor Parallel' | 'Standalone';
  description: string;
  keyBenefit: string;
  keyDrawback: string;
  nodeCount: number;
}> = {
  'RING_PP2': {
    title: 'Pipeline Parallel (2 Stages)',
    shortTitle: 'PP2',
    strategy: 'Pipeline Parallel',
    description: 'Model layers split across 2 nodes sequentially',
    keyBenefit: 'Good memory pooling (307GB/node)',
    keyDrawback: 'Higher latency (TTFT 0.9s)',
    nodeCount: 2,
  },
  'RING_PP3': {
    title: 'Pipeline Parallel (3 Stages)',
    shortTitle: 'PP3',
    strategy: 'Pipeline Parallel',
    description: 'Model layers split across 3 nodes sequentially',
    keyBenefit: 'Better memory distribution (205GB/node)',
    keyDrawback: 'Increasing latency (TTFT 1.1s)',
    nodeCount: 3,
  },
  'RING_PP4': {
    title: 'Pipeline Parallel (4 Stages)',
    shortTitle: 'PP4',
    strategy: 'Pipeline Parallel',
    description: 'Model layers split across 4 nodes sequentially',
    keyBenefit: 'Only 154GB per node needed',
    keyDrawback: 'Pipeline latency (TTFT 1.3s)',
    nodeCount: 4,
  },
  'RING_PP5': {
    title: 'Pipeline Parallel (5 Stages)',
    shortTitle: 'PP5',
    strategy: 'Pipeline Parallel',
    description: 'Full cluster pipeline, maximum memory pooling',
    keyBenefit: 'Runs 1TB+ models (123GB/node)',
    keyDrawback: 'Highest latency (TTFT 1.6s)',
    nodeCount: 5,
  },
  'TP2_RDMA': {
    title: 'Tensor Parallel (2-Node)',
    shortTitle: 'TP2',
    strategy: 'Tensor Parallel',
    description: 'Attention heads split across 2 nodes with RDMA sync',
    keyBenefit: 'Low latency (TTFT 0.45s)',
    keyDrawback: 'Requires 320GB per node',
    nodeCount: 2,
  },
  'TP4_RDMA': {
    title: 'Tensor Parallel (4-Node)',
    shortTitle: 'TP4',
    strategy: 'Tensor Parallel',
    description: 'Attention heads split across 4 nodes with RDMA sync',
    keyBenefit: 'Lowest latency (TTFT 0.34s)',
    keyDrawback: 'High bandwidth required',
    nodeCount: 4,
  },
  'EP5_SOLO': {
    title: 'Standalone (5 Models)',
    shortTitle: 'Solo',
    strategy: 'Standalone',
    description: 'Each node runs an independent model',
    keyBenefit: 'Highest throughput (150+ tok/s)',
    keyDrawback: 'Limited to smaller models',
    nodeCount: 5,
  },
};

// Ordered list for cycling through modes
const MODE_ORDER: ClusterMode[] = [
  'RING_PP2', 'RING_PP3', 'RING_PP4', 'RING_PP5',
  'TP2_RDMA', 'TP4_RDMA',
  'EP5_SOLO',
];

export function isPipelineParallel(topology: ClusterMode): boolean {
  return topology.startsWith('RING_PP');
}

export function isTensorParallel(topology: ClusterMode): boolean {
  if (topology === 'EP5_SOLO' || topology === 'DP5_REPLICATED') return false;
  if (topology.startsWith('TP') && topology.includes('RDMA')) return true;
  return topology.includes('TP') || topology.includes('MESH');
}

export function calculateMetrics(
  modelId: string,
  inputTokens: number,
  topology: ClusterMode
): {
  tps: number;
  ttft: number;
  memPerNode: number;
  kvCachePct: number;
  compatible: boolean;
} {
  const model = BENCHMARK_DATA.find(m => m.id === modelId);
  if (!model) {
    return { tps: 0, ttft: 0, memPerNode: 0, kvCachePct: 0, compatible: false };
  }

  const topoPerf = model.performance[topology];
  if (!topoPerf) {
    return { tps: 0, ttft: 0, memPerNode: 0, kvCachePct: 0, compatible: false };
  }

  const sortedSteps = TOKEN_STEPS.slice().sort((a, b) =>
    Math.abs(a - inputTokens) - Math.abs(b - inputTokens)
  );
  const closestTokenCount = sortedSteps[0];
  const tokenScale = model.tokenScaling[closestTokenCount] || 1.0;

  const tps = topoPerf.tps * tokenScale;
  const ttftScale = 1 + (inputTokens / 8192) * 0.3;
  const ttft = topoPerf.ttft * ttftScale;
  const kvCachePct = Math.min(95, 5 + (inputTokens / 8192) * 60 + Math.random() * 5);

  return { tps, ttft, memPerNode: topoPerf.memPerNode, kvCachePct, compatible: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION MODE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type SimMode = 'bench' | 'sim' | 'replay';

// ═══════════════════════════════════════════════════════════════════════════════
// LAB MODE: QUANTIZATION & PERPLEXITY SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════
// Simulates single-node inference with adjustable quantization.
// Lower quantization = higher TPS but worse perplexity (dumber model)

export interface QuantizationLevel {
  id: string;
  label: string;
  bits: number;
  tpsMultiplier: number;      // How fast relative to FP16
  perplexityMultiplier: number; // How much worse perplexity gets
  memoryMultiplier: number;   // Memory usage relative to FP16
  description: string;
}

export const QUANTIZATION_LEVELS: QuantizationLevel[] = [
  {
    id: 'fp16',
    label: 'F16',
    bits: 16,
    tpsMultiplier: 1.0,
    perplexityMultiplier: 1.0,
    memoryMultiplier: 1.0,
    description: 'Full precision - Maximum quality, slowest speed',
  },
  {
    id: '8bit',
    label: '8-bit',
    bits: 8,
    tpsMultiplier: 1.8,
    perplexityMultiplier: 1.02,
    memoryMultiplier: 0.5,
    description: 'High quality with 2x compression',
  },
  {
    id: '6bit',
    label: '6-bit',
    bits: 6,
    tpsMultiplier: 2.5,
    perplexityMultiplier: 1.05,
    memoryMultiplier: 0.375,
    description: 'Good balance of speed and quality',
  },
  {
    id: '4bit',
    label: '4-bit',
    bits: 4,
    tpsMultiplier: 3.5,
    perplexityMultiplier: 1.15,
    memoryMultiplier: 0.25,
    description: 'Fast inference, slight quality loss',
  },
  {
    id: '3bit',
    label: '3-bit',
    bits: 3,
    tpsMultiplier: 4.2,
    perplexityMultiplier: 1.4,
    memoryMultiplier: 0.1875,
    description: 'Very fast, noticeable quality degradation',
  },
  {
    id: '2bit',
    label: '2-bit',
    bits: 2,
    tpsMultiplier: 5.0,
    perplexityMultiplier: 2.5,
    memoryMultiplier: 0.125,
    description: 'Maximum speed, significant quality loss',
  },
  {
    id: '1bit',
    label: '1-bit',
    bits: 1,
    tpsMultiplier: 8.0,
    perplexityMultiplier: 6.0,
    memoryMultiplier: 0.0625,
    description: 'Binary weights - Speed demon, chaos brain 🤪',
  },
];

// Model size presets for lab mode
export interface LabModelPreset {
  id: string;
  name: string;
  baseTps: number;       // TPS at FP16 on single M3 Ultra
  basePerplexity: number; // Perplexity at FP16
  sizeGB: number;         // Size at FP16
  description: string;
}

export const LAB_MODEL_PRESETS: LabModelPreset[] = [
  { id: 'tiny', name: '7B Model', baseTps: 120, basePerplexity: 5.5, sizeGB: 14, description: 'Small, fast, good for quick tasks' },
  { id: 'small', name: '13B Model', baseTps: 85, basePerplexity: 4.8, sizeGB: 26, description: 'Balanced size and capability' },
  { id: 'medium', name: '34B Model', baseTps: 45, basePerplexity: 3.5, sizeGB: 68, description: 'Strong reasoning, moderate speed' },
  { id: 'large', name: '70B Model', baseTps: 22, basePerplexity: 2.8, sizeGB: 140, description: 'Excellent quality, slower inference' },
  { id: 'xlarge', name: '123B Model', baseTps: 12, basePerplexity: 2.2, sizeGB: 246, description: 'Near-frontier capabilities' },
  { id: 'giant', name: '405B Model', baseTps: 4, basePerplexity: 1.8, sizeGB: 810, description: 'Frontier model - requires multi-node' },
];

// Hardware tier requirements based on memory needs
export type HardwareTier = 'consumer_gpu' | 'prosumer_gpu' | 'workstation' | 'unified_memory' | 'cluster' | 'cloud';

export interface HardwareRequirement {
  tier: HardwareTier;
  label: string;
  icon: string;
  description: string;
  color: string;
  examples: string;
}

export const HARDWARE_TIERS: Record<HardwareTier, HardwareRequirement> = {
  consumer_gpu: {
    tier: 'consumer_gpu',
    label: 'Gaming GPU',
    icon: '🎮',
    description: 'Affordable home setup. Great for small models and experimentation.',
    color: 'text-emerald-400',
    examples: 'RTX 3080 (10GB) ~$500 • RTX 4080 (16GB) ~$1,000',
  },
  prosumer_gpu: {
    tier: 'prosumer_gpu',
    label: 'Pro GPU',
    icon: '🖥️',
    description: 'Enthusiast/creator hardware. Handles medium models with good speed.',
    color: 'text-blue-400',
    examples: 'RTX 4090 (24GB) ~$1,800 • A6000 (48GB) ~$4,500',
  },
  workstation: {
    tier: 'workstation',
    label: 'Workstation',
    icon: '🏢',
    description: 'Professional ML lab. Multi-GPU configs for serious development.',
    color: 'text-purple-400',
    examples: 'A100 80GB ~$15k • H100 80GB ~$30k • Multi-GPU: $50k+',
  },
  unified_memory: {
    tier: 'unified_memory',
    label: 'Apple Silicon',
    icon: '🍎',
    description: 'Mac unified memory. CPU+GPU share RAM—great for large context.',
    color: 'text-pink-400',
    examples: 'M4 Max 128GB ~$4k • M3 Ultra 512GB ~$10k',
  },
  cluster: {
    tier: 'cluster',
    label: 'Compute Cluster',
    icon: '🌐',
    description: 'Multi-node distributed inference. Required for 400B+ models.',
    color: 'text-cyan-400',
    examples: 'Chakra Cluster (5× M3 Ultra, 2.5TB) ~$50k total',
  },
  cloud: {
    tier: 'cloud',
    label: 'Cloud Required',
    icon: '☁️',
    description: 'Enterprise cloud infrastructure. Pay-per-hour, scales infinitely.',
    color: 'text-amber-400',
    examples: 'AWS p5.48xlarge ~$100/hr • GCP TPU v5p ~$200/hr',
  },
};

export function getHardwareTier(memoryGB: number): HardwareTier {
  if (memoryGB <= 16) return 'consumer_gpu';
  if (memoryGB <= 48) return 'prosumer_gpu';
  if (memoryGB <= 160) return 'workstation';
  if (memoryGB <= 512) return 'unified_memory';
  if (memoryGB <= 2500) return 'cluster';
  return 'cloud';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAB MESH TOPOLOGY OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════
// Hypothetical model that can split in any configuration for educational purposes

export interface LabMeshOption {
  id: string;
  label: string;
  shortLabel: string;
  nodeCount: number;
  strategy: 'Solo' | 'Pipeline Parallel' | 'Tensor Parallel';
  // Performance characteristics
  tpsMultiplier: number;       // Relative to single node (includes overhead)
  ttftBaseMs: number;          // Base TTFT in ms (pipeline bubble effect)
  ttftPerTokenMs: number;      // Additional TTFT per input token
  memoryDivisor: number;       // How much memory is split across nodes
  description: string;
  icon: string;
}

export const LAB_MESH_OPTIONS: LabMeshOption[] = [
  {
    id: 'solo',
    label: 'Single Node',
    shortLabel: 'Solo',
    nodeCount: 1,
    strategy: 'Solo',
    tpsMultiplier: 1.0,          // Baseline - no overhead
    ttftBaseMs: 50,              // Very low latency
    ttftPerTokenMs: 0.05,        // Fast prefill
    memoryDivisor: 1,
    description: 'One node, zero overhead. Fastest when model fits in memory.',
    icon: '🖥️',
  },
  {
    id: 'pp2',
    label: 'Pipeline 2-Node',
    shortLabel: 'PP2',
    nodeCount: 2,
    strategy: 'Pipeline Parallel',
    tpsMultiplier: 0.85,         // 15% overhead from pipeline bubbles
    ttftBaseMs: 200,             // 2-stage pipeline bubble
    ttftPerTokenMs: 0.08,
    memoryDivisor: 2,
    description: '2-stage pipeline. Moderate latency, good memory pooling.',
    icon: '🔗',
  },
  {
    id: 'pp3',
    label: 'Pipeline 3-Node',
    shortLabel: 'PP3',
    nodeCount: 3,
    strategy: 'Pipeline Parallel',
    tpsMultiplier: 0.78,         // More bubble overhead
    ttftBaseMs: 350,             // 3-stage bubble
    ttftPerTokenMs: 0.10,
    memoryDivisor: 3,
    description: '3-stage pipeline. Higher latency, better memory distribution.',
    icon: '🔗',
  },
  {
    id: 'pp4',
    label: 'Pipeline 4-Node',
    shortLabel: 'PP4',
    nodeCount: 4,
    strategy: 'Pipeline Parallel',
    tpsMultiplier: 0.72,
    ttftBaseMs: 500,             // 4-stage bubble
    ttftPerTokenMs: 0.12,
    memoryDivisor: 4,
    description: '4-stage pipeline. High latency, runs larger models.',
    icon: '🔗',
  },
  {
    id: 'pp5',
    label: 'Pipeline 5-Node',
    shortLabel: 'PP5',
    nodeCount: 5,
    strategy: 'Pipeline Parallel',
    tpsMultiplier: 0.65,
    ttftBaseMs: 700,             // 5-stage bubble - significant latency
    ttftPerTokenMs: 0.15,
    memoryDivisor: 5,
    description: '5-stage pipeline. Maximum memory, highest latency.',
    icon: '🔗',
  },
  {
    id: 'tp2',
    label: 'Tensor 2-Node',
    shortLabel: 'TP2',
    nodeCount: 2,
    strategy: 'Tensor Parallel',
    tpsMultiplier: 0.75,         // All-reduce overhead each layer
    ttftBaseMs: 120,             // Low latency (parallel prefill)
    ttftPerTokenMs: 0.06,
    memoryDivisor: 2,
    description: 'Tensor parallel over 2 nodes. Low latency, needs RDMA.',
    icon: '⚡',
  },
  {
    id: 'tp4',
    label: 'Tensor 4-Node',
    shortLabel: 'TP4',
    nodeCount: 4,
    strategy: 'Tensor Parallel',
    tpsMultiplier: 0.60,         // More all-reduce overhead
    ttftBaseMs: 150,             // Still low due to parallel prefill
    ttftPerTokenMs: 0.07,
    memoryDivisor: 4,
    description: 'Tensor parallel over 4 nodes. Lowest latency for large models.',
    icon: '⚡',
  },
];

export interface SimulatedNodeMetrics {
  cpuPercent: number;
  gpuPercent: number;
  memoryUsedGB: number;
  powerWatts: number;
  kvCachePercent: number;
  temperature: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFERENCE WORKFLOW SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════
// Simulates the full inference lifecycle: prompt → TTFT → generation → complete

export interface PromptPreset {
  id: string;
  label: string;
  description: string;
  inputTokens: number;
  expectedOutputTokens: number;
  icon: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'quick',
    label: 'Quick Question',
    description: '"What is 2+2?"',
    inputTokens: 12,
    expectedOutputTokens: 25,
    icon: '💬',
  },
  {
    id: 'chat',
    label: 'Chat Message',
    description: '"Explain quantum computing simply"',
    inputTokens: 50,
    expectedOutputTokens: 150,
    icon: '🗣️',
  },
  {
    id: 'paragraph',
    label: 'Short Prompt',
    description: 'A paragraph with context',
    inputTokens: 200,
    expectedOutputTokens: 300,
    icon: '📝',
  },
  {
    id: 'document',
    label: 'Document',
    description: 'Multi-page document analysis',
    inputTokens: 2000,
    expectedOutputTokens: 500,
    icon: '📄',
  },
  {
    id: 'book_chapter',
    label: 'Book Chapter',
    description: 'Long-form content processing',
    inputTokens: 8000,
    expectedOutputTokens: 1000,
    icon: '📚',
  },
  {
    id: 'codebase',
    label: 'Codebase',
    description: 'Full codebase context window',
    inputTokens: 32000,
    expectedOutputTokens: 2000,
    icon: '💻',
  },
];

export type InferencePhase = 'idle' | 'prefilling' | 'generating' | 'complete';

/**
 * Simulation inference workflow state (NOT the same as real-time InferenceState from useClusterSocket)
 * Tracks the simulated inference phases for the laboratory mode
 */
export interface SimulationInferenceState {
  phase: InferencePhase;
  promptPreset: PromptPreset | null;
  startTime: number;
  ttftProgress: number;       // 0-100% during prefill
  tokensGenerated: number;
  totalTime: number;
}

export function calculateLabMetrics(
  modelPreset: LabModelPreset,
  quantLevel: QuantizationLevel,
  meshOption: LabMeshOption = LAB_MESH_OPTIONS[0],
  inputTokens: number = 256
): {
  tps: number;
  perplexity: number;
  memoryGB: number;
  memoryPerNode: number;
  hardwareTier: HardwareTier;
  ttftMs: number;
  nodeCount: number;
  canFitSingleNode: boolean;
  efficiency: number;
  // Simulated node metrics
  nodeMetrics: SimulatedNodeMetrics;
  modelName: string;
  modelParams: string;
  modelLayers: number;
  modelHeads: number;
} {
  const totalMemoryGB = modelPreset.sizeGB * quantLevel.memoryMultiplier;
  const memoryPerNode = totalMemoryGB / meshOption.memoryDivisor;

  // Check if model can fit on a single M3 Ultra (512GB)
  const canFitSingleNode = totalMemoryGB <= 450; // Leave headroom

  // Base TPS from model and quantization
  let tps = modelPreset.baseTps * quantLevel.tpsMultiplier;

  // Apply mesh overhead (distributed = slower than single node)
  tps = tps * meshOption.tpsMultiplier;

  // But if model is too big for fewer nodes, we MUST use more nodes
  // This simulates the "forced distribution" scenario
  const minNodesNeeded = Math.ceil(totalMemoryGB / 450);
  if (meshOption.nodeCount < minNodesNeeded) {
    // Model won't fit! TPS goes to zero
    tps = 0;
  }

  // Calculate TTFT (pipeline bubble + prefill time)
  const ttftMs = meshOption.ttftBaseMs + (inputTokens * meshOption.ttftPerTokenMs);

  // Efficiency: how close are we to theoretical single-node performance?
  const theoreticalMax = modelPreset.baseTps * quantLevel.tpsMultiplier;
  const efficiency = tps > 0 ? (tps / theoreticalMax) * 100 : 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMULATED NODE METRICS - Derive from model config and TPS
  // ═══════════════════════════════════════════════════════════════════════════

  // GPU usage scales with TPS and quantization (lower bits = more GPU work)
  const baseGpuLoad = 30 + (tps / theoreticalMax) * 60;
  const quantGpuBoost = (16 - quantLevel.bits) * 2; // Lower bits = more computation
  const gpuPercent = Math.min(98, baseGpuLoad + quantGpuBoost);

  // CPU usage is lower, mainly for tokenization and coordination
  const baseCpuLoad = 10 + (tps > 0 ? 15 : 0);
  const distributedCpuOverhead = meshOption.nodeCount > 1 ? 10 : 0;
  const cpuPercent = Math.min(60, baseCpuLoad + distributedCpuOverhead);

  // Power consumption (M3 Ultra baseline ~60W idle, up to ~150W under load)
  const idlePower = 60;
  const loadPower = 90 * (gpuPercent / 100);
  const powerWatts = Math.round(idlePower + loadPower);

  // KV Cache grows with input tokens and model size
  const kvCachePercent = Math.min(85, 5 + (inputTokens / 8192) * 70 + (modelPreset.sizeGB / 800) * 10);

  // Temperature correlates with GPU load
  const baseTemp = 45;
  const loadTemp = 35 * (gpuPercent / 100);
  const temperature = Math.round(baseTemp + loadTemp);

  // Memory actually used (model weights + KV cache + overhead)
  const kvCacheGB = memoryPerNode * (kvCachePercent / 100) * 0.3;
  const memoryUsedGB = memoryPerNode + kvCacheGB + 8; // 8GB OS/overhead

  // ═══════════════════════════════════════════════════════════════════════════
  // MEGA-BRAIN-LLM MODEL SPECS - Scale with model size preset
  // ═══════════════════════════════════════════════════════════════════════════
  const sizeIndex = LAB_MODEL_PRESETS.findIndex(m => m.id === modelPreset.id);
  const paramMultiplier = [7, 13, 34, 70, 123, 405][sizeIndex] || 70;
  const modelParams = `${paramMultiplier}B`;
  const modelLayers = Math.round(32 + sizeIndex * 16); // 32 to 112 layers
  const modelHeads = Math.round(32 + sizeIndex * 16); // 32 to 112 heads

  // Creative model names based on size tier
  const modelNames = [
    'MEGA-BRAINY-LITE-7B',           // 7B - tiny
    'MEGA-BRAINY-SMALL-13B',         // 13B - small
    'MEGA-BRAINY-MEDIUM-34B',        // 34B - medium
    'MEGA-BRAINY-LARGE-70B',         // 70B - large
    'MEGA-BRAINY-ULTRA-123B',        // 123B - xlarge
    'MEGA-BRAINY-EXTRA-MEGA-405B',   // 405B - giant
  ];
  const modelName = modelNames[sizeIndex] || 'MEGA-BRAINY-LLM';

  return {
    tps,
    perplexity: modelPreset.basePerplexity * quantLevel.perplexityMultiplier,
    memoryGB: totalMemoryGB,
    memoryPerNode,
    hardwareTier: getHardwareTier(memoryPerNode),
    ttftMs,
    nodeCount: meshOption.nodeCount,
    canFitSingleNode,
    efficiency,
    nodeMetrics: {
      cpuPercent,
      gpuPercent,
      memoryUsedGB,
      powerWatts,
      kvCachePercent,
      temperature,
    },
    modelName,
    modelParams,
    modelLayers,
    modelHeads,
  };
}

interface SimulatorControlsProps {
  selectedModelId: string;
  inputTokens: number;
  topology: ClusterMode;
  onModelChange: (modelId: string) => void;
  onTokensChange: (tokens: number) => void;
  onTopologyChange: (topology: ClusterMode) => void;
  // Replay mode callbacks
  onReplayFrame?: (frame: ReplayFrame) => void;
  onReplayStateChange?: (state: ReplayState) => void;
  // Lab/Sim mode callbacks - Extended with full sim state
  onLabMetricsChange?: (tps: number, perplexity: number, quantization: string) => void;
  onSimStateChange?: (simState: SimStateUpdate) => void;
}

// Extended sim state for driving visualization
export interface SimStateUpdate {
  mode: SimMode;
  modelLoaded: boolean;
  isLoading: boolean;
  inferencePhase: InferencePhase;
  meshTopology: {
    id: string;
    nodeCount: number;
    strategy: 'Solo' | 'Pipeline Parallel' | 'Tensor Parallel';
  };
  metrics: {
    tps: number;
    ttftMs: number;
    perplexity: number;
    memoryPerNode: number;
    kvCachePercent: number;
  };
  nodeMetrics: SimulatedNodeMetrics;
  inference: {
    tokensGenerated: number;
    totalTokens: number;
    progress: number; // 0-100
  };
}

const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  selectedModelId,
  inputTokens,
  topology,
  onModelChange,
  onTokensChange,
  onTopologyChange,
  onReplayFrame,
  onReplayStateChange,
  onLabMetricsChange,
  onSimStateChange,
}) => {
  // Simulation mode state
  const [simMode, setSimMode] = useState<SimMode>('sim');

  // Replay state
  const [replayState, setReplayState] = useState<ReplayState | null>(null);
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
  const replayControllerRef = useRef<ReplayController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lab mode state
  const [labModelIndex, setLabModelIndex] = useState(3); // Default to 70B
  const [quantIndex, setQuantIndex] = useState(3); // Default to 4-bit
  const [labMeshIndex, setLabMeshIndex] = useState(0); // Default to Solo
  const [labInputTokens, setLabInputTokens] = useState(256); // Default input tokens
  const [simModelLoaded, setSimModelLoaded] = useState(false); // Model load state
  const [simIsLoading, setSimIsLoading] = useState(false); // Loading animation state

  // Inference workflow state
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(1); // Default to "Chat Message"
  const [inferenceState, setInferenceState] = useState<SimulationInferenceState>({
    phase: 'idle',
    promptPreset: null,
    startTime: 0,
    ttftProgress: 0,
    tokensGenerated: 0,
    totalTime: 0,
  });
  const inferenceAnimationRef = useRef<number | null>(null);

  const labModel = LAB_MODEL_PRESETS[labModelIndex];
  const quantLevel = QUANTIZATION_LEVELS[quantIndex];
  const labMesh = LAB_MESH_OPTIONS[labMeshIndex];
  const selectedPrompt = PROMPT_PRESETS[selectedPromptIndex];
  // Use the selected prompt's input tokens for metrics calculation
  const effectiveInputTokens = inferenceState.phase !== 'idle' && inferenceState.promptPreset
    ? inferenceState.promptPreset.inputTokens
    : selectedPrompt.inputTokens;
  const labMetrics = calculateLabMetrics(labModel, quantLevel, labMesh, effectiveInputTokens);

  // Handle model load/unload with animation
  const handleLoadToggle = useCallback(() => {
    if (simModelLoaded) {
      // Unload immediately - also stop any running inference
      setSimModelLoaded(false);
      setInferenceState({
        phase: 'idle',
        promptPreset: null,
        startTime: 0,
        ttftProgress: 0,
        tokensGenerated: 0,
        totalTime: 0,
      });
      if (inferenceAnimationRef.current) {
        cancelAnimationFrame(inferenceAnimationRef.current);
        inferenceAnimationRef.current = null;
      }
    } else {
      // Simulate loading delay
      setSimIsLoading(true);
      setTimeout(() => {
        setSimIsLoading(false);
        setSimModelLoaded(true);
      }, 1500); // 1.5 second load time
    }
  }, [simModelLoaded]);

  // Start inference simulation
  const handleStartInference = useCallback(() => {
    if (!simModelLoaded || inferenceState.phase !== 'idle' || labMetrics.tps === 0) return;

    const prompt = PROMPT_PRESETS[selectedPromptIndex];
    const ttftMs = labMetrics.ttftMs;
    const startTime = performance.now();

    setInferenceState({
      phase: 'prefilling',
      promptPreset: prompt,
      startTime,
      ttftProgress: 0,
      tokensGenerated: 0,
      totalTime: 0,
    });

    // Animation loop for inference phases
    const animate = () => {
      const elapsed = performance.now() - startTime;

      setInferenceState(prev => {
        if (prev.phase === 'prefilling') {
          // During prefill, show TTFT progress
          const ttftProgress = Math.min((elapsed / ttftMs) * 100, 100);

          if (elapsed >= ttftMs) {
            // Transition to generating phase
            return {
              ...prev,
              phase: 'generating',
              ttftProgress: 100,
              tokensGenerated: 0,
            };
          }

          return { ...prev, ttftProgress };
        } else if (prev.phase === 'generating') {
          // During generation, count tokens at TPS rate
          const generationTime = elapsed - ttftMs;
          const tokensGenerated = Math.floor((generationTime / 1000) * labMetrics.tps);
          const expectedTokens = prompt.expectedOutputTokens;

          if (tokensGenerated >= expectedTokens) {
            // Inference complete
            return {
              ...prev,
              phase: 'complete',
              tokensGenerated: expectedTokens,
              totalTime: elapsed,
            };
          }

          return { ...prev, tokensGenerated, totalTime: elapsed };
        }

        return prev;
      });

      // Continue animation unless complete
      setInferenceState(curr => {
        if (curr.phase !== 'complete') {
          inferenceAnimationRef.current = requestAnimationFrame(animate);
        }
        return curr;
      });
    };

    inferenceAnimationRef.current = requestAnimationFrame(animate);
  }, [simModelLoaded, inferenceState.phase, selectedPromptIndex, labMetrics.ttftMs, labMetrics.tps]);

  // Stop/reset inference
  const handleStopInference = useCallback(() => {
    if (inferenceAnimationRef.current) {
      cancelAnimationFrame(inferenceAnimationRef.current);
      inferenceAnimationRef.current = null;
    }
    setInferenceState({
      phase: 'idle',
      promptPreset: null,
      startTime: 0,
      ttftProgress: 0,
      tokensGenerated: 0,
      totalTime: 0,
    });
  }, []);

  // Reset loaded state when config changes significantly
  useEffect(() => {
    if (simModelLoaded) {
      setSimModelLoaded(false);
      handleStopInference();
    }
  }, [labModelIndex, labMeshIndex]); // Reset when model size or mesh changes

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (inferenceAnimationRef.current) {
        cancelAnimationFrame(inferenceAnimationRef.current);
      }
    };
  }, []);

  // Notify parent of sim metrics changes (legacy callback)
  useEffect(() => {
    if (simMode === 'sim' && onLabMetricsChange) {
      onLabMetricsChange(labMetrics.tps, labMetrics.perplexity, quantLevel.label);
    }
  }, [simMode, labMetrics.tps, labMetrics.perplexity, quantLevel.label, onLabMetricsChange]);

  // Broadcast full sim state to parent for visualization
  useEffect(() => {
    if (simMode === 'sim' && onSimStateChange) {
      const expectedTokens = inferenceState.promptPreset?.expectedOutputTokens || 0;
      const progress = expectedTokens > 0
        ? (inferenceState.tokensGenerated / expectedTokens) * 100
        : 0;

      onSimStateChange({
        mode: simMode,
        modelLoaded: simModelLoaded,
        isLoading: simIsLoading,
        inferencePhase: inferenceState.phase,
        meshTopology: {
          id: labMesh.id,
          nodeCount: labMesh.nodeCount,
          strategy: labMesh.strategy,
        },
        metrics: {
          tps: simModelLoaded ? labMetrics.tps : 0,
          ttftMs: labMetrics.ttftMs,
          perplexity: labMetrics.perplexity,
          memoryPerNode: labMetrics.memoryPerNode,
          kvCachePercent: labMetrics.nodeMetrics.kvCachePercent,
        },
        nodeMetrics: labMetrics.nodeMetrics,
        inference: {
          tokensGenerated: inferenceState.tokensGenerated,
          totalTokens: expectedTokens,
          progress,
        },
      });
    }
  }, [
    simMode,
    simModelLoaded,
    simIsLoading,
    inferenceState.phase,
    inferenceState.tokensGenerated,
    inferenceState.promptPreset,
    labMesh.id,
    labMesh.nodeCount,
    labMesh.strategy,
    labMetrics.tps,
    labMetrics.ttftMs,
    labMetrics.perplexity,
    labMetrics.memoryPerNode,
    labMetrics.nodeMetrics,
    onSimStateChange,
  ]);

  // Initialize replay controller
  useEffect(() => {
    const handleFrame = (frame: ReplayFrame, state: ReplayState) => {
      setReplayState(state);
      onReplayFrame?.(frame);
      onReplayStateChange?.(state);
    };

    replayControllerRef.current = new ReplayController(handleFrame);

    return () => {
      replayControllerRef.current?.stop();
    };
  }, [onReplayFrame, onReplayStateChange]);

  // Handle replay file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const replay = await loadReplayFromFile(file);
    if (replay && replayControllerRef.current) {
      replayControllerRef.current.loadReplay(replay);
      setReplayState(replayControllerRef.current.getState());
    }
  }, []);

  // Load sample replay for demo
  const handleLoadSampleReplay = useCallback(() => {
    const sampleReplay = generateSampleReplay(topology, inputTokens, 30);
    if (replayControllerRef.current) {
      replayControllerRef.current.loadReplay(sampleReplay);
      setReplayState(replayControllerRef.current.getState());
    }
  }, [topology, inputTokens]);

  // Playback controls
  const handlePlay = useCallback(() => {
    replayControllerRef.current?.play();
  }, []);

  const handlePause = useCallback(() => {
    replayControllerRef.current?.pause();
  }, []);

  const handleStop = useCallback(() => {
    replayControllerRef.current?.stop();
  }, []);

  const handleSpeedChange = useCallback((speed: ReplaySpeed) => {
    setReplaySpeed(speed);
    replayControllerRef.current?.setSpeed(speed);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseFloat(e.target.value) / 100;
    const totalMs = replayState?.replay?.total_duration_ms || 0;
    replayControllerRef.current?.seekTo(percent * totalMs);
  }, [replayState?.replay?.total_duration_ms]);

  const selectedModel = BENCHMARK_DATA.find(m => m.id === selectedModelId);
  const metrics = calculateMetrics(selectedModelId, inputTokens, topology);
  const modeInfo = MODE_INFO[topology];
  const tokenIndex = TOKEN_STEPS.findIndex(t => t >= inputTokens) || 0;
  const isCompatible = metrics.compatible;

  // Calculate replay progress
  const replayProgress = replayState?.replay
    ? (replayState.currentTime / replayState.replay.total_duration_ms) * 100
    : 0;

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'reasoning': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'coding': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      case 'general': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-white/40 bg-white/10 border-white/20';
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'Pipeline Parallel': return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
      case 'Tensor Parallel': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'Standalone': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      default: return 'text-white/40 bg-white/10 border-white/20';
    }
  };

  return (
    <div className="w-full bg-black/80 border border-purple-500/20 rounded-2xl overflow-hidden">
      {/* Header with Mode Toggle */}
      <div className="flex items-center gap-3 p-4 border-b border-purple-500/20 bg-purple-500/5">
        <div className={`p-2 rounded-xl border transition-colors ${
          simMode === 'replay'
            ? 'bg-amber-500/20 border-amber-500/30'
            : simMode === 'sim'
            ? 'bg-emerald-500/20 border-emerald-500/30'
            : 'bg-purple-500/20 border-purple-500/30'
        }`}>
          {simMode === 'replay' ? (
            <Film className="w-5 h-5 text-amber-400" />
          ) : simMode === 'sim' ? (
            <Zap className="w-5 h-5 text-emerald-400" />
          ) : (
            <Sparkles className="w-5 h-5 text-purple-400" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-black text-white uppercase tracking-tight">
            {simMode === 'replay' ? 'Benchmark Replay' : simMode === 'sim' ? 'Inference Simulator' : 'Benchmark Explorer'}
          </h3>
          <p className="text-[10px] font-mono text-purple-400/60 uppercase tracking-widest">
            {simMode === 'replay' ? 'Playback recorded session data' :
             simMode === 'sim' ? 'Model any config to predict performance' :
             'Browse real cluster benchmark results'}
          </p>
        </div>
        {/* Mode Toggle */}
        <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
          <button
            onClick={() => setSimMode('bench')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
              simMode === 'bench'
                ? 'bg-purple-500/30 text-purple-300'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Bench
          </button>
          <button
            onClick={() => setSimMode('sim')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
              simMode === 'sim'
                ? 'bg-emerald-500/30 text-emerald-300'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Sim
          </button>
          <button
            onClick={() => setSimMode('replay')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
              simMode === 'replay'
                ? 'bg-amber-500/30 text-amber-300'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Replay
          </button>
        </div>
      </div>

      {/* Hidden file input for replay upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Control Sections */}
      <div className="p-4 space-y-5">

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* REPLAY MODE CONTROLS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {simMode === 'replay' && (
          <div className="space-y-4">
            {/* Mode Description */}
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-[10px] text-amber-300/80 leading-relaxed">
                <span className="font-bold">Replay Mode</span> — Load and playback recorded benchmark sessions frame-by-frame.
                Watch real inference metrics animate over time to understand how the cluster behaves during actual workloads.
                <span className="text-amber-400/60 ml-1">(Advanced feature - coming soon)</span>
              </p>
            </div>

            {/* Replay Source Selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Film className="w-4 h-4 text-amber-400/60" />
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  Replay Source
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[11px] font-mono text-white/70 hover:bg-white/10 hover:border-amber-500/30 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Load Benchmark File
                </button>
                <button
                  onClick={handleLoadSampleReplay}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] font-mono text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Generate Sample
                </button>
              </div>
            </div>

            {/* Loaded Replay Info */}
            {replayState?.replay && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    {replayState.replay.model_name}
                  </span>
                  <span className="text-[10px] font-mono text-amber-400/60">
                    {replayState.replay.topology} • {replayState.replay.input_tokens} tokens
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-white/50">
                  <span>{replayState.replay.frames.length} frames</span>
                  <span>•</span>
                  <span>{(replayState.replay.total_duration_ms / 1000).toFixed(1)}s duration</span>
                  <span>•</span>
                  <span>{replayState.replay.avg_tps.toFixed(1)} avg tok/s</span>
                </div>
              </div>
            )}

            {/* Playback Controls */}
            {replayState?.replay && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Play className="w-4 h-4 text-emerald-400/60" />
                  <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                    Playback
                  </label>
                  <span className="ml-auto text-[11px] font-mono text-white/40">
                    {(replayState.currentTime / 1000).toFixed(1)}s / {(replayState.replay.total_duration_ms / 1000).toFixed(1)}s
                  </span>
                </div>

                {/* Timeline Scrubber */}
                <div className="mb-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={replayProgress}
                    onChange={handleSeek}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between mt-1 text-[10px] font-mono text-white/30">
                    <span>0s</span>
                    <span>{(replayState.replay.total_duration_ms / 2000).toFixed(0)}s</span>
                    <span>{(replayState.replay.total_duration_ms / 1000).toFixed(0)}s</span>
                  </div>
                </div>

                {/* Transport Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStop}
                      className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-white/60" />
                    </button>
                    {replayState.isPlaying ? (
                      <button
                        onClick={handlePause}
                        className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition-colors"
                      >
                        <Pause className="w-5 h-5 text-amber-400" />
                      </button>
                    ) : (
                      <button
                        onClick={handlePlay}
                        className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/30 transition-colors"
                      >
                        <Play className="w-5 h-5 text-emerald-400" />
                      </button>
                    )}
                  </div>

                  {/* Speed Controls */}
                  <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/10">
                    {([0.25, 0.5, 1, 2, 4] as ReplaySpeed[]).map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                          replaySpeed === speed
                            ? 'bg-amber-500/30 text-amber-300'
                            : 'text-white/40 hover:text-white/60'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Frame Stats */}
                {replayState.replay.frames[replayState.currentFrameIndex] && (
                  <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="block text-[14px] font-mono font-black text-emerald-400">
                        {replayState.replay.frames[replayState.currentFrameIndex].cluster_tps.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-black text-white/40 uppercase">Tok/s</span>
                    </div>
                    <div>
                      <span className="block text-[14px] font-mono font-black text-amber-400">
                        {replayState.replay.frames[replayState.currentFrameIndex].ttft_ms.toFixed(0)}
                      </span>
                      <span className="text-[10px] font-black text-white/40 uppercase">TTFT ms</span>
                    </div>
                    <div>
                      <span className="block text-[14px] font-mono font-black text-blue-400">
                        {replayState.currentFrameIndex + 1}/{replayState.replay.frames.length}
                      </span>
                      <span className="text-[10px] font-black text-white/40 uppercase">Frame</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!replayState?.replay && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-[10px] text-white/40">
                  Load a benchmark file or generate a sample replay to visualize real inference patterns.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SIM MODE CONTROLS - Hypothetical model simulation */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {simMode === 'sim' && (
          <div className="space-y-5">
            {/* Mode Description */}
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                <span className="font-bold">Simulator</span> — Explore how model size, quantization, mesh topology, and input length
                affect inference performance. All combinations work on this hypothetical model.
              </p>
            </div>

            {/* MEGA-BRAIN-LLM Model Card */}
            <div className={`p-4 rounded-xl border transition-all duration-500 ${
              simModelLoaded
                ? 'bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-purple-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : simIsLoading
                ? 'bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-yellow-500/10 border-amber-500/40 animate-pulse'
                : 'bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-cyan-500/10 border-purple-500/30'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-lg transition-all duration-500 ${
                  simModelLoaded
                    ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-emerald-500/30'
                    : simIsLoading
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30 animate-spin'
                    : 'bg-gradient-to-br from-purple-500 to-fuchsia-500 shadow-purple-500/20'
                }`}>
                  {simIsLoading ? '⏳' : simModelLoaded ? '✅' : '🧠'}
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-black text-white tracking-tight">{labMetrics.modelName}</h4>
                  <p className="text-sm text-purple-300/60 font-mono">
                    {labMetrics.modelParams} Parameters • {quantLevel.label}
                    {simModelLoaded && <span className="text-emerald-400 ml-2">● LOADED</span>}
                    {simIsLoading && <span className="text-amber-400 ml-2">● LOADING...</span>}
                  </p>
                </div>
              </div>

              {/* RAM & Disk Requirements - Large Visual */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Disk Space */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <HardDrive className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <span className="block text-2xl font-mono font-black text-blue-400">
                        {labMetrics.memoryGB.toFixed(0)} GB
                      </span>
                      <span className="text-xs text-blue-300/60 font-bold uppercase tracking-wider">Disk Space</span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-blue-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (labMetrics.memoryGB / 1000) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-blue-300/50">Model weights file size</p>
                </div>

                {/* RAM Required */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <MemoryStick className="w-7 h-7 text-purple-400" />
                    </div>
                    <div>
                      <span className="block text-2xl font-mono font-black text-purple-400">
                        {(labMetrics.memoryGB * 1.15).toFixed(0)} GB
                      </span>
                      <span className="text-xs text-purple-300/60 font-bold uppercase tracking-wider">RAM Required</span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-purple-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, ((labMetrics.memoryGB * 1.15) / 1000) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-purple-300/50">Weights + KV cache + overhead</p>
                </div>
              </div>

              {/* Model Architecture Specs */}
              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                <div className="p-2 rounded-lg bg-white/5">
                  <span className="block text-base font-mono font-bold text-purple-400">{labMetrics.modelParams}</span>
                  <span className="text-[10px] text-white/40">Params</span>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <span className="block text-base font-mono font-bold text-fuchsia-400">{labMetrics.modelLayers}</span>
                  <span className="text-[10px] text-white/40">Layers</span>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <span className="block text-base font-mono font-bold text-cyan-400">{labMetrics.modelHeads}</span>
                  <span className="text-[10px] text-white/40">Heads</span>
                </div>
                <div className="p-2 rounded-lg bg-white/5">
                  <span className="block text-base font-mono font-bold text-amber-400">{quantLevel.bits}-bit</span>
                  <span className="text-[10px] text-white/40">Precision</span>
                </div>
              </div>

              {/* Load/Unload Button */}
              <button
                onClick={handleLoadToggle}
                disabled={simIsLoading || labMetrics.tps === 0}
                className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
                  labMetrics.tps === 0
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400 cursor-not-allowed'
                    : simIsLoading
                    ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400 cursor-wait'
                    : simModelLoaded
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                    : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                }`}
              >
                {labMetrics.tps === 0
                  ? '⚠️ Model Too Large for Config'
                  : simIsLoading
                  ? '⏳ Loading Model...'
                  : simModelLoaded
                  ? '⏏️ Unload Model'
                  : '▶️ Load Model to Simulate'
                }
              </button>

              <p className="mt-2 text-[11px] text-white/40 italic text-center">
                {simModelLoaded
                  ? '✨ Model active — select a prompt and run inference below'
                  : '💡 Load the model to start inference simulation'
                }
              </p>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* INFERENCE WORKFLOW SECTION */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {simModelLoaded && (
              <div className={`p-4 rounded-xl border transition-all duration-300 ${
                inferenceState.phase === 'idle'
                  ? 'bg-slate-800/50 border-slate-600/30'
                  : inferenceState.phase === 'prefilling'
                  ? 'bg-amber-500/10 border-amber-500/30 animate-pulse'
                  : inferenceState.phase === 'generating'
                  ? 'bg-cyan-500/10 border-cyan-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">
                    {inferenceState.phase === 'idle' ? '📤' :
                     inferenceState.phase === 'prefilling' ? '⏳' :
                     inferenceState.phase === 'generating' ? '✍️' : '✅'}
                  </span>
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">
                    {inferenceState.phase === 'idle' ? 'Send a Prompt' :
                     inferenceState.phase === 'prefilling' ? 'Prefilling (TTFT)...' :
                     inferenceState.phase === 'generating' ? 'Generating Tokens...' :
                     'Inference Complete!'}
                  </span>
                </div>

                {/* Prompt Selection (when idle) */}
                {inferenceState.phase === 'idle' && (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {PROMPT_PRESETS.map((prompt, idx) => (
                        <button
                          key={prompt.id}
                          onClick={() => setSelectedPromptIndex(idx)}
                          className={`p-2 rounded-lg text-center transition-all ${
                            selectedPromptIndex === idx
                              ? 'bg-cyan-500/20 border border-cyan-500/40'
                              : 'bg-white/5 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <span className="block text-lg mb-1">{prompt.icon}</span>
                          <span className={`block text-[10px] font-bold ${
                            selectedPromptIndex === idx ? 'text-cyan-300' : 'text-white/60'
                          }`}>
                            {prompt.label}
                          </span>
                          <span className="block text-[10px] text-white/40">
                            {prompt.inputTokens.toLocaleString()} tokens
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Selected:</span>
                        <span className="text-cyan-400 font-bold">{selectedPrompt.label}</span>
                      </div>
                      <p className="text-[10px] text-white/40 mt-1 italic">
                        {selectedPrompt.description}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[10px]">
                        <span className="text-white/40">
                          Input: <span className="text-blue-400 font-mono">{selectedPrompt.inputTokens.toLocaleString()}</span> tokens
                        </span>
                        <span className="text-white/40">
                          Output: ~<span className="text-purple-400 font-mono">{selectedPrompt.expectedOutputTokens.toLocaleString()}</span> tokens
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleStartInference}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-sm uppercase tracking-wider hover:from-cyan-500/40 hover:to-purple-500/40 transition-all"
                    >
                      🚀 Run Inference
                    </button>
                  </>
                )}

                {/* Prefilling Phase (TTFT countdown) */}
                {inferenceState.phase === 'prefilling' && inferenceState.promptPreset && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-400 font-bold">Processing {inferenceState.promptPreset.inputTokens.toLocaleString()} input tokens...</span>
                      <span className="text-white/50 font-mono">{inferenceState.ttftProgress.toFixed(0)}%</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-75"
                        style={{ width: `${inferenceState.ttftProgress}%` }}
                      />
                    </div>
                    <div className="text-center text-[10px] text-white/40">
                      ⏱️ TTFT: <span className="text-amber-400 font-mono">{labMetrics.ttftMs.toFixed(0)} ms</span> expected
                    </div>
                  </div>
                )}

                {/* Generating Phase (token counter) */}
                {inferenceState.phase === 'generating' && inferenceState.promptPreset && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-400 font-bold text-xs">Generating tokens...</span>
                      <span className="text-lg font-mono font-black text-emerald-400">
                        {labMetrics.tps.toFixed(0)} <span className="text-xs text-white/40">tok/s</span>
                      </span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-75"
                        style={{ width: `${(inferenceState.tokensGenerated / inferenceState.promptPreset.expectedOutputTokens) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white/40">
                        Tokens: <span className="text-cyan-400 font-mono">{inferenceState.tokensGenerated}</span>
                        /<span className="text-white/50">{inferenceState.promptPreset.expectedOutputTokens}</span>
                      </span>
                      <span className="text-white/40">
                        Time: <span className="text-purple-400 font-mono">{(inferenceState.totalTime / 1000).toFixed(1)}s</span>
                      </span>
                    </div>
                    <button
                      onClick={handleStopInference}
                      className="w-full py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-500/30 transition-all"
                    >
                      ⏹️ Stop Inference
                    </button>
                  </div>
                )}

                {/* Complete Phase (summary) */}
                {inferenceState.phase === 'complete' && inferenceState.promptPreset && (
                  <div className="space-y-3">
                    <div className="text-center">
                      <span className="text-2xl">✅</span>
                      <p className="text-emerald-400 font-bold text-sm mt-1">Inference Complete!</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <span className="block text-lg font-mono font-black text-amber-400">
                          {labMetrics.ttftMs.toFixed(0)}
                        </span>
                        <span className="text-[10px] text-white/40">TTFT (ms)</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <span className="block text-lg font-mono font-black text-cyan-400">
                          {inferenceState.tokensGenerated}
                        </span>
                        <span className="text-[10px] text-white/40">Tokens</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <span className="block text-lg font-mono font-black text-purple-400">
                          {(inferenceState.totalTime / 1000).toFixed(1)}s
                        </span>
                        <span className="text-[10px] text-white/40">Total Time</span>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <span className="text-[11px] text-emerald-300">
                        Effective throughput: <span className="font-mono font-bold">
                          {(inferenceState.tokensGenerated / ((inferenceState.totalTime - labMetrics.ttftMs) / 1000)).toFixed(1)} tok/s
                        </span>
                      </span>
                    </div>
                    <button
                      onClick={handleStopInference}
                      className="w-full py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase hover:bg-cyan-500/30 transition-all"
                    >
                      🔄 Run Another Prompt
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Model Size Selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-emerald-400/60" />
                <label className="text-xs font-black text-white/60 uppercase tracking-wider">
                  1. Model Size
                </label>
                <span className="ml-auto text-lg font-mono font-black text-emerald-400">
                  {labModel.name}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={LAB_MODEL_PRESETS.length - 1}
                value={labModelIndex}
                onChange={(e) => setLabModelIndex(parseInt(e.target.value))}
                className="w-full h-2.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between mt-2 text-[10px] font-mono text-white/40">
                {LAB_MODEL_PRESETS.map(m => (
                  <span key={m.id}>{m.name.split(' ')[0]}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/50">
                {labModel.description}
              </p>
            </div>

            {/* Quantization Level */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-cyan-400/60" />
                <label className="text-xs font-black text-white/60 uppercase tracking-wider">
                  2. Quantization
                </label>
                <span className={`ml-auto text-lg font-mono font-black ${
                  quantLevel.bits >= 8 ? 'text-violet-400' :
                  quantLevel.bits >= 4 ? 'text-emerald-400' :
                  quantLevel.bits >= 2 ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {quantLevel.label}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={QUANTIZATION_LEVELS.length - 1}
                value={quantIndex}
                onChange={(e) => setQuantIndex(parseInt(e.target.value))}
                className="w-full h-2.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between mt-2 text-[10px] font-mono text-white/40">
                {QUANTIZATION_LEVELS.map(q => (
                  <span key={q.id}>{q.label}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/50">
                {quantLevel.description}
              </p>
            </div>

            {/* Mesh Topology Selection */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Network className="w-4 h-4 text-purple-400/60" />
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  3. Mesh Topology
                </label>
                <span className="ml-auto text-[14px] font-mono font-black text-purple-400">
                  {labMesh.shortLabel}
                </span>
              </div>

              {/* Mesh type buttons */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {LAB_MESH_OPTIONS.map((mesh, idx) => (
                  <button
                    key={mesh.id}
                    onClick={() => setLabMeshIndex(idx)}
                    className={`px-2 py-2 rounded-lg text-[10px] font-mono font-bold transition-all ${
                      labMeshIndex === idx
                        ? mesh.strategy === 'Solo'
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          : mesh.strategy === 'Pipeline Parallel'
                          ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                          : 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                        : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {mesh.shortLabel}
                  </button>
                ))}
              </div>

              {/* Strategy indicator */}
              <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                labMesh.strategy === 'Solo'
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : labMesh.strategy === 'Pipeline Parallel'
                  ? 'bg-cyan-500/10 border-cyan-500/20'
                  : 'bg-purple-500/10 border-purple-500/20'
              }`}>
                <span className="text-lg">{labMesh.icon}</span>
                <div className="flex-1">
                  <span className={`text-[10px] font-black ${
                    labMesh.strategy === 'Solo' ? 'text-amber-400' :
                    labMesh.strategy === 'Pipeline Parallel' ? 'text-cyan-400' : 'text-purple-400'
                  }`}>
                    {labMesh.strategy}
                  </span>
                  <span className="text-[10px] text-white/40 ml-2">
                    • {labMesh.nodeCount} node{labMesh.nodeCount > 1 ? 's' : ''}
                  </span>
                </div>
                <span className={`text-[10px] font-mono ${
                  labMetrics.efficiency >= 90 ? 'text-emerald-400' :
                  labMetrics.efficiency >= 70 ? 'text-amber-400' :
                  labMetrics.efficiency >= 50 ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {labMetrics.efficiency.toFixed(0)}% eff
                </span>
              </div>

              <p className="mt-2 text-[10px] text-white/40">
                {labMesh.description}
              </p>

              {/* Warning if model doesn't fit */}
              {!labMetrics.canFitSingleNode && labMesh.nodeCount === 1 && (
                <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-[10px] text-red-400">
                    ⚠️ Model too large for single node! Need {Math.ceil(labMetrics.memoryGB / 450)} nodes minimum.
                  </p>
                </div>
              )}
            </div>

            {/* Input Tokens Slider - Enhanced with Use Cases */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-blue-400/60" />
                <label className="text-xs font-black text-white/60 uppercase tracking-wider">
                  4. Input Context
                </label>
                <span className="ml-auto text-lg font-mono font-black text-blue-400">
                  {labInputTokens.toLocaleString()} tokens
                </span>
              </div>

              {/* Current Use Case Display */}
              {(() => {
                const useCase = getInputTokenUseCase(labInputTokens);
                const kvColors = {
                  minimal: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
                  low: 'text-green-400 bg-green-500/20 border-green-500/30',
                  moderate: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
                  high: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
                  very_high: 'text-red-400 bg-red-500/20 border-red-500/30',
                  extreme: 'text-rose-400 bg-rose-500/20 border-rose-500/30',
                };
                const ttftColors = {
                  instant: 'text-emerald-400',
                  fast: 'text-green-400',
                  moderate: 'text-amber-400',
                  noticeable: 'text-orange-400',
                  slow: 'text-red-400',
                  very_slow: 'text-rose-400',
                };
                return (
                  <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">
                        {useCase.icon}
                      </div>
                      <div className="flex-1">
                        <h5 className="text-base font-bold text-white">{useCase.label}</h5>
                        <p className="text-xs text-blue-300/60">{useCase.description}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/50 italic mb-3">
                      {useCase.examples}
                    </p>
                    {/* Impact Indicators */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-2 rounded-lg border ${kvColors[useCase.kvCacheImpact]}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">🧠</span>
                          <div>
                            <span className="text-[10px] font-bold uppercase">KV Cache</span>
                            <span className="block text-xs font-mono font-bold capitalize">
                              {useCase.kvCacheImpact.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`p-2 rounded-lg bg-white/5 border border-white/10`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">⏱️</span>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-white/60">TTFT</span>
                            <span className={`block text-xs font-mono font-bold capitalize ${ttftColors[useCase.ttftImpact]}`}>
                              {useCase.ttftImpact.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Slider with Use Case Icons */}
              <input
                type="range"
                min={0}
                max={TOKEN_STEPS.length - 1}
                value={TOKEN_STEPS.findIndex(t => t >= labInputTokens) || 0}
                onChange={(e) => setLabInputTokens(TOKEN_STEPS[parseInt(e.target.value)])}
                className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
              <div className="flex justify-between mt-2">
                {INPUT_TOKEN_USE_CASES.map((uc, idx) => (
                  <button
                    key={uc.tokens}
                    onClick={() => setLabInputTokens(uc.tokens)}
                    className={`flex flex-col items-center transition-all ${
                      labInputTokens === uc.tokens
                        ? 'scale-110'
                        : 'opacity-50 hover:opacity-80'
                    }`}
                    title={`${uc.label} (${uc.tokens.toLocaleString()} tokens)`}
                  >
                    <span className="text-lg">{uc.icon}</span>
                    <span className={`text-[10px] font-mono ${
                      labInputTokens === uc.tokens ? 'text-blue-400 font-bold' : 'text-white/40'
                    }`}>
                      {uc.tokens >= 1000 ? `${uc.tokens/1000}K` : uc.tokens}
                    </span>
                  </button>
                ))}
              </div>

              {/* Performance Impact Note */}
              <div className="mt-3 p-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-white/50">
                  <span className="text-blue-400 font-bold">↑ More tokens</span> = larger KV cache memory, longer prefill (TTFT).
                  {labMesh.strategy === 'Pipeline Parallel' && (
                    <span className="text-cyan-400"> Pipeline stages multiply prefill latency.</span>
                  )}
                  {labMesh.strategy === 'Tensor Parallel' && (
                    <span className="text-purple-400"> Tensor parallelism keeps TTFT low via parallel prefill.</span>
                  )}
                </p>
              </div>
            </div>

            {/* Live Metrics */}
            <div className="pt-4 border-t border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="w-4 h-4 text-amber-400/60" />
                <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  Resulting Performance
                </label>
                {labMetrics.tps === 0 && (
                  <span className="ml-auto text-[10px] text-red-400 font-bold">
                    ⚠️ WON'T FIT
                  </span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {/* TPS */}
                <div className={`rounded-xl p-4 border text-center transition-all ${
                  !simModelLoaded ? 'bg-gray-500/10 border-gray-500/20' :
                  labMetrics.tps === 0 ? 'bg-red-500/10 border-red-500/20' :
                  labMetrics.tps >= 35 ? 'bg-fuchsia-500/10 border-fuchsia-500/20' :
                  labMetrics.tps >= 20 ? 'bg-yellow-500/10 border-yellow-500/20' :
                  labMetrics.tps >= 5 ? 'bg-emerald-500/10 border-emerald-500/20' :
                  'bg-gray-500/10 border-gray-500/20'
                }`}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Zap className={`w-4 h-4 ${
                      !simModelLoaded ? 'text-gray-500/60' :
                      labMetrics.tps === 0 ? 'text-red-400/60' :
                      labMetrics.tps >= 35 ? 'text-fuchsia-400/60' :
                      labMetrics.tps >= 20 ? 'text-yellow-400/60' :
                      labMetrics.tps >= 5 ? 'text-emerald-400/60' :
                      'text-gray-400/60'
                    }`} />
                  </div>
                  <span className={`block text-2xl font-mono font-black ${
                    !simModelLoaded ? 'text-gray-500' :
                    labMetrics.tps === 0 ? 'text-red-400' :
                    labMetrics.tps >= 35 ? 'text-fuchsia-400' :
                    labMetrics.tps >= 20 ? 'text-yellow-400' :
                    labMetrics.tps >= 5 ? 'text-emerald-400' :
                    'text-gray-400'
                  }`}>
                    {!simModelLoaded ? '—' : labMetrics.tps === 0 ? '✗' : labMetrics.tps.toFixed(0)}
                  </span>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Tok/Sec
                  </span>
                </div>

                {/* TTFT */}
                <div className={`rounded-xl p-4 border text-center transition-all ${
                  !simModelLoaded ? 'bg-gray-500/10 border-gray-500/20' :
                  labMetrics.ttftMs < 100 ? 'bg-emerald-500/10 border-emerald-500/20' :
                  labMetrics.ttftMs < 300 ? 'bg-amber-500/10 border-amber-500/20' :
                  labMetrics.ttftMs < 700 ? 'bg-orange-500/10 border-orange-500/20' :
                  'bg-red-500/10 border-red-500/20'
                }`}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Timer className={`w-4 h-4 ${
                      !simModelLoaded ? 'text-gray-500/60' :
                      labMetrics.ttftMs < 100 ? 'text-emerald-400/60' :
                      labMetrics.ttftMs < 300 ? 'text-amber-400/60' :
                      labMetrics.ttftMs < 700 ? 'text-orange-400/60' :
                      'text-red-400/60'
                    }`} />
                  </div>
                  <span className={`block text-2xl font-mono font-black ${
                    !simModelLoaded ? 'text-gray-500' :
                    labMetrics.ttftMs < 100 ? 'text-emerald-400' :
                    labMetrics.ttftMs < 300 ? 'text-amber-400' :
                    labMetrics.ttftMs < 700 ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    {!simModelLoaded ? '—' : labMetrics.ttftMs < 1000 ? labMetrics.ttftMs.toFixed(0) : (labMetrics.ttftMs / 1000).toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    {!simModelLoaded ? 'TTFT' : labMetrics.ttftMs < 1000 ? 'TTFT ms' : 'TTFT sec'}
                  </span>
                </div>

                {/* Perplexity */}
                <div className={`rounded-xl p-4 border text-center transition-all ${
                  !simModelLoaded ? 'bg-gray-500/10 border-gray-500/20' :
                  labMetrics.perplexity < 3 ? 'bg-violet-500/10 border-violet-500/20' :
                  labMetrics.perplexity < 6 ? 'bg-emerald-500/10 border-emerald-500/20' :
                  labMetrics.perplexity < 15 ? 'bg-blue-500/10 border-blue-500/20' :
                  labMetrics.perplexity < 30 ? 'bg-amber-500/10 border-amber-500/20' :
                  'bg-red-500/10 border-red-500/20'
                }`}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-sm">
                      {!simModelLoaded ? '💤' :
                       labMetrics.perplexity < 3 ? '🧠' :
                       labMetrics.perplexity < 6 ? '💡' :
                       labMetrics.perplexity < 15 ? '🤔' :
                       labMetrics.perplexity < 30 ? '😅' : '🤪'}
                    </span>
                  </div>
                  <span className={`block text-2xl font-mono font-black ${
                    !simModelLoaded ? 'text-gray-500' :
                    labMetrics.perplexity < 3 ? 'text-violet-400' :
                    labMetrics.perplexity < 6 ? 'text-emerald-400' :
                    labMetrics.perplexity < 15 ? 'text-blue-400' :
                    labMetrics.perplexity < 30 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {!simModelLoaded ? '—' : labMetrics.perplexity.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Perplexity
                  </span>
                </div>

                {/* Memory Per Node */}
                <div className={`rounded-xl p-4 border text-center transition-all ${
                  !simModelLoaded ? 'bg-gray-500/10 border-gray-500/20' : 'bg-blue-500/10 border-blue-500/20'
                }`}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Cpu className={`w-4 h-4 ${!simModelLoaded ? 'text-gray-500/60' : 'text-blue-400/60'}`} />
                  </div>
                  <span className={`block text-2xl font-mono font-black ${!simModelLoaded ? 'text-gray-500' : 'text-blue-400'}`}>
                    {labMetrics.memoryPerNode.toFixed(0)}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${!simModelLoaded ? 'text-gray-500/60' : 'text-blue-400/60'}`}>
                    GB/Node
                  </span>
                </div>
              </div>

              {/* Simulated Node Metrics */}
              <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-600/30">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-cyan-400/60" />
                  <span className="text-xs font-bold text-white/60 uppercase tracking-wider">
                    Simulated Node Metrics
                  </span>
                  <span className="ml-auto text-[10px] text-white/30">
                    Per-node when active
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {/* CPU */}
                  <div className="text-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="text-lg font-mono font-black text-blue-400">
                      {labMetrics.nodeMetrics.cpuPercent.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-blue-400/60 font-bold uppercase">CPU</div>
                  </div>

                  {/* GPU */}
                  <div className="text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-lg font-mono font-black text-emerald-400">
                      {labMetrics.nodeMetrics.gpuPercent.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-emerald-400/60 font-bold uppercase">GPU</div>
                  </div>

                  {/* Power */}
                  <div className="text-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="text-lg font-mono font-black text-amber-400">
                      {labMetrics.nodeMetrics.powerWatts}W
                    </div>
                    <div className="text-[10px] text-amber-400/60 font-bold uppercase">Power</div>
                  </div>

                  {/* KV Cache */}
                  <div className="text-center p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="text-lg font-mono font-black text-purple-400">
                      {labMetrics.nodeMetrics.kvCachePercent.toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-purple-400/60 font-bold uppercase">KV$</div>
                  </div>

                  {/* Temperature */}
                  <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-lg font-mono font-black text-red-400">
                      {labMetrics.nodeMetrics.temperature}°C
                    </div>
                    <div className="text-[10px] text-red-400/60 font-bold uppercase">Temp</div>
                  </div>
                </div>

                {/* Total cluster power */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-white/40">
                    Cluster total: <span className="font-mono text-amber-400">{labMetrics.nodeMetrics.powerWatts * labMetrics.nodeCount}W</span>
                    {' '}across {labMetrics.nodeCount} node{labMetrics.nodeCount > 1 ? 's' : ''}
                  </span>
                  <span className="text-white/30">
                    ~${((labMetrics.nodeMetrics.powerWatts * labMetrics.nodeCount * 24 * 30) / 1000 * 0.12).toFixed(0)}/mo electricity
                  </span>
                </div>
              </div>

              {/* Hardware Requirement Indicator */}
              {(() => {
                const hw = HARDWARE_TIERS[labMetrics.hardwareTier];
                return (
                  <div className={`mt-4 p-4 rounded-xl border ${
                    labMetrics.hardwareTier === 'consumer_gpu' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    labMetrics.hardwareTier === 'prosumer_gpu' ? 'bg-blue-500/10 border-blue-500/20' :
                    labMetrics.hardwareTier === 'workstation' ? 'bg-purple-500/10 border-purple-500/20' :
                    labMetrics.hardwareTier === 'unified_memory' ? 'bg-pink-500/10 border-pink-500/20' :
                    labMetrics.hardwareTier === 'cluster' ? 'bg-cyan-500/10 border-cyan-500/20' :
                    'bg-amber-500/10 border-amber-500/20'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{hw.icon}</span>
                      <div className="flex-1">
                        <span className={`text-sm font-black uppercase ${hw.color}`}>{hw.label}</span>
                        <span className="ml-2 text-xs font-mono text-white/40">
                          {labMetrics.nodeCount > 1
                            ? `${labMetrics.memoryPerNode.toFixed(0)} GB × ${labMetrics.nodeCount} = ${labMetrics.memoryGB.toFixed(0)} GB`
                            : `${labMetrics.memoryGB.toFixed(0)} GB needed`
                          }
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-white/60 mb-2">{hw.description}</p>
                    <p className="text-[11px] text-white/40 font-mono">{hw.examples}</p>
                  </div>
                );
              })()}

              {/* Tradeoff Explanation */}
              <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-white/60 leading-relaxed">
                  {labMesh.strategy === 'Solo' ? (
                    <>
                      <span className="text-amber-400 font-bold">Solo = Zero overhead</span>, fastest when model fits.{' '}
                      <span className="text-cyan-400">Add nodes</span> to run larger models, but expect efficiency loss.
                    </>
                  ) : labMesh.strategy === 'Pipeline Parallel' ? (
                    <>
                      <span className="text-cyan-400 font-bold">Pipeline Parallel</span>: Each stage adds ~150-200ms TTFT.{' '}
                      <span className="text-amber-400">High latency</span>, but can run huge models with modest per-node RAM.
                    </>
                  ) : (
                    <>
                      <span className="text-purple-400 font-bold">Tensor Parallel</span>: Low latency, but{' '}
                      <span className="text-amber-400">all-reduce overhead</span> every layer. Needs fast interconnect (RDMA).
                    </>
                  )}
                  {quantLevel.bits <= 2 && (
                    <span className="text-red-400 font-bold"> ⚠️ Extreme quantization may produce gibberish!</span>
                  )}
                </p>
              </div>

              {/* Quick presets */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => { setLabModelIndex(3); setQuantIndex(0); setLabMeshIndex(0); }} // 70B FP16 Solo - Genius
                  className="flex-1 min-w-[70px] px-2 py-2 bg-violet-500/10 border border-violet-500/30 rounded-lg text-[10px] font-mono text-violet-400 hover:bg-violet-500/20 transition-colors"
                >
                  🧠 Genius
                </button>
                <button
                  onClick={() => { setLabModelIndex(3); setQuantIndex(3); setLabMeshIndex(0); }} // 70B 4-bit Solo - Balanced
                  className="flex-1 min-w-[70px] px-2 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] font-mono text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  ⚖️ Balanced
                </button>
                <button
                  onClick={() => { setLabModelIndex(0); setQuantIndex(6); setLabMeshIndex(0); }} // 7B 1-bit Solo - Party
                  className="flex-1 min-w-[70px] px-2 py-2 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg text-[10px] font-mono text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors"
                >
                  🎉 Party
                </button>
                <button
                  onClick={() => { setLabModelIndex(5); setQuantIndex(3); setLabMeshIndex(4); }} // 405B 4-bit PP5 - Big Brain
                  className="flex-1 min-w-[70px] px-2 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-[10px] font-mono text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  🌐 Big PP5
                </button>
                <button
                  onClick={() => { setLabModelIndex(5); setQuantIndex(3); setLabMeshIndex(6); }} // 405B 4-bit TP4 - Fast Frontier
                  className="flex-1 min-w-[70px] px-2 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-[10px] font-mono text-purple-400 hover:bg-purple-500/20 transition-colors"
                >
                  ⚡ Fast TP4
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* BENCH MODE CONTROLS - Real benchmark data from cluster */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {simMode === 'bench' && (
          <>
        {/* Mode Description */}
        <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 mb-5">
          <p className="text-[10px] text-purple-300/80 leading-relaxed">
            <span className="font-bold">Benchmark Explorer</span> — Browse actual performance data from verified Chakra Cluster runs.
            Select a real model, adjust input tokens, and change network topology to see how each configuration
            performed on our 5-node Apple Silicon cluster (January 2026).
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: Model Selection */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-purple-400/60" />
            <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
              1. Choose Model
            </label>
          </div>
          <div className="relative">
            <select
              value={selectedModelId}
              onChange={(e) => onModelChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-mono text-white appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:border-purple-500/50"
            >
              {BENCHMARK_DATA.map(model => (
                <option key={model.id} value={model.id} className="bg-black text-white">
                  {model.shortName} ({model.sizeGB}GB, {model.quantization})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>
          {selectedModel && (
            <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/5">
              {/* Architecture & Size Row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getCategoryColor(selectedModel.category)}`}>
                  {selectedModel.category}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                  selectedModel.architecture === 'MoE'
                    ? 'text-amber-400 bg-amber-500/20 border-amber-500/30'
                    : 'text-sky-400 bg-sky-500/20 border-sky-500/30'
                }`}>
                  {selectedModel.architecture}
                </span>
                <span className="text-[10px] font-mono text-white/60 font-bold">
                  {selectedModel.params}
                  {selectedModel.activeParams && <span className="text-white/40"> ({selectedModel.activeParams} active)</span>}
                </span>
              </div>
              {/* Strengths */}
              <p className="text-[10px] text-emerald-400/80 mb-1 font-medium">
                ✦ {selectedModel.strengths}
              </p>
              {/* Description */}
              <p className="text-[10px] text-white/40 leading-relaxed">
                {selectedModel.description}
              </p>
              {/* Size Info */}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-white/30">
                <span>{selectedModel.sizeGB} GB</span>
                <span>•</span>
                <span>{selectedModel.quantization}</span>
                <span>•</span>
                <span>{selectedModel.attentionHeads} heads</span>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: Input Tokens */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-cyan-400/60" />
            <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
              2. Input Token Count
            </label>
            <span className="ml-auto text-[14px] font-mono font-black text-cyan-400">
              {inputTokens.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={TOKEN_STEPS.length - 1}
            value={tokenIndex}
            onChange={(e) => onTokensChange(TOKEN_STEPS[parseInt(e.target.value)])}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between mt-1 text-[10px] font-mono text-white/30">
            <span>50</span>
            <span>256</span>
            <span>512</span>
            <span>1K</span>
            <span>2K</span>
            <span>4K</span>
            <span>8K</span>
          </div>
          <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
            <span className="text-cyan-400">↑ More tokens</span> = larger KV cache, slightly higher TPS (up to optimal), then plateaus.
            <span className="text-amber-400"> TTFT increases</span> with longer prompts due to prefill time.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: Network Topology */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Network className="w-4 h-4 text-emerald-400/60" />
            <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
              3. Network Topology
            </label>
          </div>

          {/* Topology Dropdown */}
          <div className="relative mb-3">
            <select
              value={topology}
              onChange={(e) => onTopologyChange(e.target.value as ClusterMode)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-mono text-white appearance-none cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:border-emerald-500/50"
            >
              <optgroup label="Pipeline Parallel (Ring)" className="bg-black text-white">
                {MODE_ORDER.filter(m => m.startsWith('RING_PP')).map(mode => (
                  <option key={mode} value={mode} className="bg-black text-white">
                    {MODE_INFO[mode]?.shortTitle} — {MODE_INFO[mode]?.nodeCount} nodes, TTFT {
                      mode === 'RING_PP2' ? '0.9s' :
                      mode === 'RING_PP3' ? '1.1s' :
                      mode === 'RING_PP4' ? '1.3s' : '1.6s'
                    }
                  </option>
                ))}
              </optgroup>
              <optgroup label="Tensor Parallel (RDMA Mesh)" className="bg-black text-white">
                {MODE_ORDER.filter(m => m.includes('TP') && m.includes('RDMA')).map(mode => (
                  <option key={mode} value={mode} className="bg-black text-white">
                    {MODE_INFO[mode]?.shortTitle} — {MODE_INFO[mode]?.nodeCount} nodes, TTFT {
                      mode === 'TP2_RDMA' ? '0.45s' : '0.34s'
                    }
                  </option>
                ))}
              </optgroup>
              <optgroup label="Standalone (Independent)" className="bg-black text-white">
                <option value="EP5_SOLO" className="bg-black text-white">
                  Solo — 5 independent models, ~150+ tok/s
                </option>
              </optgroup>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>

          {/* Current Mode Details Card */}
          {modeInfo && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${getStrategyColor(modeInfo.strategy)}`}>
                    {modeInfo.strategy}
                  </span>
                  <span className="text-[11px] font-mono font-black text-white">
                    {modeInfo.shortTitle}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-white/40">
                  {modeInfo.nodeCount} nodes
                </span>
              </div>
              <p className="text-[10px] text-white/50 mb-2">
                {modeInfo.description}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[10px] text-emerald-400/80">{modeInfo.keyBenefit}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <X className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[10px] text-red-400/80">{modeInfo.keyDrawback}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: Live Impact Metrics */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="pt-4 border-t border-purple-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400/60" />
            <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">
              Resulting Performance
            </label>
          </div>

          {!isCompatible ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-[11px] text-red-400 font-bold mb-1">
                ⚠️ Incompatible Configuration
              </p>
              <p className="text-[10px] text-red-400/70">
                {selectedModel?.shortName} doesn't support {modeInfo?.shortTitle || topology}.
                {selectedModel?.recommendedMode && (
                  <> Try <span className="font-bold">{MODE_INFO[selectedModel.recommendedMode]?.shortTitle}</span> instead.</>
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {/* TPS */}
              <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Gauge className="w-3 h-3 text-emerald-400/60" />
                </div>
                <span className="block text-[18px] font-mono font-black text-emerald-400">
                  {metrics.tps.toFixed(1)}
                </span>
                <span className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest">
                  Tok/Sec
                </span>
              </div>

              {/* TTFT */}
              <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Timer className="w-3 h-3 text-amber-400/60" />
                </div>
                <span className="block text-[18px] font-mono font-black text-amber-400">
                  {metrics.ttft.toFixed(2)}
                </span>
                <span className="text-[10px] font-black text-amber-400/60 uppercase tracking-widest">
                  TTFT (s)
                </span>
              </div>

              {/* Memory */}
              <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Cpu className="w-3 h-3 text-blue-400/60" />
                </div>
                <span className="block text-[18px] font-mono font-black text-blue-400">
                  {metrics.memPerNode}
                </span>
                <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">
                  GB/Node
                </span>
              </div>

              {/* KV Cache */}
              <div className="bg-cyan-500/10 rounded-xl p-3 border border-cyan-500/20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Database className="w-3 h-3 text-cyan-400/60" />
                </div>
                <span className="block text-[18px] font-mono font-black text-cyan-400">
                  {metrics.kvCachePct.toFixed(0)}%
                </span>
                <span className="text-[10px] font-black text-cyan-400/60 uppercase tracking-widest">
                  KV Cache
                </span>
              </div>
            </div>
          )}

          {isCompatible && (
            <p className="mt-3 text-[10px] text-white/40 leading-relaxed">
              <span className="text-emerald-400">TPS</span> = output tokens/second.{' '}
              <span className="text-amber-400">TTFT</span> = time to first token (latency).{' '}
              <span className="text-blue-400">GB/Node</span> = memory per compute node.{' '}
              <span className="text-cyan-400">KV Cache</span> = context memory usage.
            </p>
          )}
        </div>
        </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-purple-500/10 bg-purple-500/5">
        <p className="text-[10px] text-purple-400/50 text-center font-mono uppercase tracking-widest">
          Data from verified Chakra Cluster benchmarks • January 2026
        </p>
      </div>
    </div>
  );
};

export default SimulatorControls;
