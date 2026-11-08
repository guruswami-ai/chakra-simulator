
import { useMemo } from 'react';
import { NodeMetrics, ClusterMode } from '../types';
import { CHAKRA_COLORS } from '../constants';
import { isTensorParallel, isPipelineParallel } from '../simulation/simulationUtils';

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════
// Maps quantization + hardware stress into three visual states:
//
//   REFERENCE  — FP16 full-precision: calm, high-fidelity glow
//   OPTIMAL    — Q4-Q8 sweet spot: balanced, efficient rendering
//   DISSONANCE — Q2/Q3 or KV overload: jitter, distortion, chromatic aberration
//
// These states drive SVG filters, glow intensity, animation speed,
// and CSS classes across MeshGraph, SimulationPanel, and InferenceCore.
// ═══════════════════════════════════════════════════════════════════════════

export type ThemeState = 'REFERENCE' | 'OPTIMAL' | 'DISSONANCE';

export type NodeAnimation = 'steady-breathe' | 'none' | 'jitter';

export interface ChakraNodeTheme {
  color: string;
  glow: string;
  glowIntensity: number;   // 0-1, drives SVG glow opacity
  pulseSpeed: number;       // seconds per pulse cycle
  animation: NodeAnimation; // Named animation mode
  filter: string | undefined; // SVG filter URL or undefined
}

export interface ChakraMeshTheme {
  opacity: number;          // Link opacity multiplier
  lineWidth: number;        // Base link stroke width
  particleSpeed: number;    // Particle animation duration in seconds (lower = faster)
  flowSpeed: 'fast' | 'medium' | 'slow' | 'none'; // Named speed tier
  linkColor: string;        // Override link color (or default)
}

export interface ChakraTheme {
  state: ThemeState;
  isDissonant: boolean;
  chromaticAberration: boolean; // CSS text distortion on node labels

  // Per-node glow parameters keyed by node name
  nodeThemes: Record<string, ChakraNodeTheme>;

  // Mesh-wide visual parameters
  mesh: ChakraMeshTheme;

  // SVG filter to apply to compute links and node orbs
  svgFilter: string | undefined;

  // Status label for HUD display
  statusLabel: string;

  // CSS class for container-level effects
  containerClass: string;
}

const KV_PRESSURE_THRESHOLD = 95;  // Only at extreme memory pressure (near OOM)

export function useChakraTheme(
  nodes: NodeMetrics[],
  quantization: string | undefined,
  topology: ClusterMode,
  tps: number,
): ChakraTheme {
  return useMemo(() => {
    // 1. Determine base state from quantization
    let state: ThemeState = 'OPTIMAL';
    if (quantization === 'F16') state = 'REFERENCE';
    if (quantization === 'Q2' || quantization === 'Q3') state = 'DISSONANCE';

    // 2. Hardware stress override: high KV pressure forces DISSONANCE
    const maxKvPressure = nodes.length > 0
      ? Math.max(...nodes.map(n => n.kv_cache_pct ?? 0))
      : 0;
    const isKvOverloaded = maxKvPressure > KV_PRESSURE_THRESHOLD;
    if (isKvOverloaded) state = 'DISSONANCE';

    const isDissonant = state === 'DISSONANCE';

    // 3. Build per-node themes from CHAKRA_COLORS
    const nodeThemes: Record<string, ChakraNodeTheme> = {};
    for (const node of nodes) {
      const name = node.name.toLowerCase();
      const chakra = (CHAKRA_COLORS as Record<string, { base: string; glow: string }>)[name];
      if (!chakra) continue;

      // Glow intensity scales with state and node activity
      const baseIntensity = state === 'REFERENCE' ? 0.9
        : state === 'OPTIMAL' ? 0.6
        : 0.3; // DISSONANCE: dim glow, distortion takes over

      // Active nodes glow brighter
      const activityBoost = node.gpu_util > 5
        ? Math.min(0.3, node.gpu_util / 300)
        : 0;

      const animation: NodeAnimation = isDissonant ? 'jitter'
        : state === 'REFERENCE' ? 'steady-breathe'
        : 'none';

      nodeThemes[name] = {
        color: chakra.base,
        glow: chakra.glow,
        glowIntensity: Math.min(1, baseIntensity + activityBoost),
        pulseSpeed: isDissonant ? 0.3 : (state === 'REFERENCE' ? 4 : 2),
        animation,
        filter: isDissonant ? 'url(#dissonance-filter)' : undefined,
      };
    }

    // 4. Mesh-wide visual parameters
    const isTP = isTensorParallel(topology);
    const isPP = isPipelineParallel(topology);

    // Flow speed derived from TPS + topology
    const flowSpeed: ChakraMeshTheme['flowSpeed'] = isTP
      ? (tps > 5 ? 'fast' : 'medium')
      : isPP
        ? 'medium'
        : (topology === 'EP5_SOLO' ? 'none' : 'slow');

    // Particle speed scales inversely with TPS (higher TPS = faster particles)
    const baseParticleSpeed = isDissonant ? 0.6 : 1.0;
    const tpsScale = tps > 0 ? Math.max(0.3, 1.0 - (tps / 30)) : 1.0;

    const mesh: ChakraMeshTheme = {
      opacity: isDissonant ? 0.7 : (state === 'REFERENCE' ? 1.0 : 0.85),
      lineWidth: isTP ? 2.5 : (isPP ? 1.5 : 1),
      particleSpeed: baseParticleSpeed * tpsScale,
      flowSpeed,
      linkColor: isDissonant ? '#ef4444' : '#22d3ee', // Red distortion vs calm cyan
    };

    // 5. Status label
    const statusLabel = isKvOverloaded
      ? 'KV PRESSURE'
      : state === 'DISSONANCE' ? 'DEGRADED'
      : state === 'REFERENCE' ? 'HIGH FIDELITY'
      : 'BALANCED';

    // 6. Container CSS class
    const containerClass = `chakra-theme-${state.toLowerCase()}`;

    return {
      state,
      isDissonant,
      chromaticAberration: isDissonant,
      nodeThemes,
      mesh,
      svgFilter: isDissonant ? 'url(#dissonance-filter)' : undefined,
      statusLabel,
      containerClass,
    };
  }, [nodes, quantization, topology, tps]);
}
