
import React from 'react';
import { ClusterMode } from '../types';
import { isTensorParallel, isPipelineParallel } from '../simulation/simulationUtils';
import { CHAKRA_COLORS } from '../constants';

// ═══════════════════════════════════════════════════════════════════════════
// LAYER STACK VISUALIZATION (#49, #50) — Revised
// ═══════════════════════════════════════════════════════════════════════════
// Wide-bar layout (wider than tall) matching the ParallelismIllustrator
// "Layer Split" diagram style.
//
// PP MODE — Sequential layer split:
// ┌──────────────────────────────────┐
// │          L0 - 31                 │  ← node color fill
// └──────────────────────────────────┘
//           32 LAYERS
//
// TP MODE — Tensor shard split:
// ┌────────┬────────┬────────┬──────┐
// │  ████  │  ░░░░  │  ░░░░  │ ░░░░ │  ← this node's shard bright
// └────────┴────────┴────────┴──────┘
//        128L × ¼ SHARD
//
// Switching between TP and PP clearly shows the distribution change:
// PP = "I have SOME layers (my stage)"
// TP = "I have ALL layers but only 1/N of each tensor"
// ═══════════════════════════════════════════════════════════════════════════

interface LayerStackProps {
  cx: number;              // Center X of the node circle
  cy: number;              // Center Y of the node circle
  nodeIndex: number;       // 0-based node position
  nodeName: string;        // For chakra color lookup
  totalLayers: number;     // Model total layer count
  topology: ClusterMode;   // Current cluster mode
  activeNodeCount: number; // How many nodes are in use
  isComputing: boolean;    // Is this node actively inferring
  gpuUtil: number;         // 0-100 GPU utilization
}

interface LayerRange {
  start: number;
  end: number;
}

// Wide-bar dimensions (wider than tall)
const BAR_WIDTH = 80;
const BAR_HEIGHT = 18;
const SHARD_GAP = 2;

// All 5 node colors in order for TP shard visualization
const NODE_COLORS = [
  CHAKRA_COLORS.muladhara.base,
  CHAKRA_COLORS.svadhisthana.base,
  CHAKRA_COLORS.manipura.base,
  CHAKRA_COLORS.anahata.base,
  CHAKRA_COLORS.vishuddha.base,
];

function getLayerRange(
  nodeIndex: number,
  totalLayers: number,
  topology: ClusterMode,
  activeNodeCount: number,
): LayerRange {
  if (isPipelineParallel(topology)) {
    // Even split — all stages show the same layer count
    const layersPerNode = Math.round(totalLayers / activeNodeCount);
    const start = nodeIndex * layersPerNode;
    const end = (nodeIndex + 1) * layersPerNode;
    return { start, end };
  }
  // TP/Single: all nodes hold all layers (sharded tensor-wise)
  return { start: 0, end: totalLayers };
}

const LayerStack: React.FC<LayerStackProps> = ({
  cx, cy, nodeIndex, nodeName, totalLayers, topology, activeNodeCount, isComputing, gpuUtil
}) => {
  const chakra = (CHAKRA_COLORS as Record<string, { base: string }>)[nodeName.toLowerCase()];
  const color = chakra?.base ?? '#06b6d4';

  if (totalLayers === 0) return null;

  const isPP = isPipelineParallel(topology);
  const isTP = isTensorParallel(topology);
  const barX = cx - BAR_WIDTH / 2;
  const barY = cy + 38;

  if (isPP) {
    // ═══════════════════════════════════════════════════════════════════
    // PP MODE — Wide bar showing this node's sequential layer range
    // ═══════════════════════════════════════════════════════════════════
    const range = getLayerRange(nodeIndex, totalLayers, topology, activeNodeCount);
    const layerCount = range.end - range.start;
    // Proportion of total layers this node holds (for bar fill width)
    const fillRatio = layerCount / totalLayers;

    return (
      <g opacity={isComputing ? 0.95 : 0.5} style={{ transition: 'opacity 0.5s ease' }}>
        {/* Background shell — full width, shows total model size */}
        <rect
          x={barX - 1}
          y={barY - 1}
          width={BAR_WIDTH + 2}
          height={BAR_HEIGHT + 2}
          rx={4}
          fill="black"
          fillOpacity={0.7}
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={1}
        />

        {/* Layer bar — filled proportional to this node's share */}
        <rect
          x={barX}
          y={barY}
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
          rx={3}
          fill={color}
          fillOpacity={isComputing ? 0.55 : 0.2}
        >
          {isComputing && (
            <animate
              attributeName="fill-opacity"
              values={`0.35;0.65;0.35`}
              dur={`${1.5 + nodeIndex * 0.15}s`}
              repeatCount="indefinite"
            />
          )}
        </rect>

        {/* Activity wave — travels across the bar during inference */}
        {isComputing && (
          <rect
            x={barX}
            y={barY}
            width={16}
            height={BAR_HEIGHT}
            rx={3}
            fill="white"
            fillOpacity={0.15}
          >
            <animate
              attributeName="x"
              values={`${barX};${barX + BAR_WIDTH - 16};${barX}`}
              dur={`${2 + nodeIndex * 0.1}s`}
              repeatCount="indefinite"
            />
          </rect>
        )}

        {/* Layer range text — centered on bar */}
        <text
          x={cx}
          y={barY + BAR_HEIGHT / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fillOpacity={isComputing ? 0.9 : 0.6}
          fontSize={9}
          fontWeight="900"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.05em"
        >
          L{range.start}–{range.end - 1}
        </text>

        {/* Subtitle: layer count */}
        <text
          x={cx}
          y={barY + BAR_HEIGHT + 11}
          textAnchor="middle"
          fill={color}
          fillOpacity={0.4}
          fontSize={7}
          fontWeight="900"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.1em"
        >
          {layerCount} OF {totalLayers} LAYERS
        </text>
      </g>
    );
  }

  if (isTP) {
    // ═══════════════════════════════════════════════════════════════════
    // TP MODE — Shard visualization (all layers, split tensors)
    // N vertical segments, this node's segment highlighted in color
    // Shows "I have ALL layers but only my 1/N shard of each tensor"
    // ═══════════════════════════════════════════════════════════════════
    const segWidth = (BAR_WIDTH - (activeNodeCount - 1) * SHARD_GAP) / activeNodeCount;

    return (
      <g opacity={isComputing ? 0.95 : 0.5} style={{ transition: 'opacity 0.5s ease' }}>
        {/* Background */}
        <rect
          x={barX - 1}
          y={barY - 1}
          width={BAR_WIDTH + 2}
          height={BAR_HEIGHT + 2}
          rx={4}
          fill="black"
          fillOpacity={0.7}
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={1}
        />

        {/* Shard segments — one per TP node */}
        {Array.from({ length: activeNodeCount }).map((_, i) => {
          const isThisNode = i === nodeIndex;
          const segX = barX + i * (segWidth + SHARD_GAP);
          const segColor = NODE_COLORS[i] || '#666';
          const isFirst = i === 0;
          const isLast = i === activeNodeCount - 1;

          return (
            <rect
              key={i}
              x={segX}
              y={barY}
              width={segWidth}
              height={BAR_HEIGHT}
              rx={isFirst || isLast ? 3 : 1}
              fill={segColor}
              fillOpacity={isThisNode ? (isComputing ? 0.65 : 0.3) : 0.06}
              stroke={isThisNode ? segColor : 'white'}
              strokeOpacity={isThisNode ? 0.4 : 0.03}
              strokeWidth={isThisNode ? 1.5 : 0.5}
            >
              {isComputing && isThisNode && (
                <animate
                  attributeName="fill-opacity"
                  values="0.45;0.75;0.45"
                  dur="2s"
                  repeatCount="indefinite"
                />
              )}
            </rect>
          );
        })}

        {/* Shard label — overlaid centered */}
        <text
          x={cx}
          y={barY + BAR_HEIGHT / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fillOpacity={isComputing ? 0.85 : 0.55}
          fontSize={8}
          fontWeight="900"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.03em"
        >
          {totalLayers}L × 1/{activeNodeCount}
        </text>

        {/* Subtitle */}
        <text
          x={cx}
          y={barY + BAR_HEIGHT + 11}
          textAnchor="middle"
          fill={color}
          fillOpacity={0.4}
          fontSize={7}
          fontWeight="900"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.1em"
        >
          TENSOR SHARD
        </text>
      </g>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // FALLBACK — Single node / EP5 / other (full model, no split)
  // ═══════════════════════════════════════════════════════════════════
  return (
    <g opacity={isComputing ? 0.9 : 0.4} style={{ transition: 'opacity 0.5s ease' }}>
      <rect
        x={barX - 1}
        y={barY - 1}
        width={BAR_WIDTH + 2}
        height={BAR_HEIGHT + 2}
        rx={4}
        fill="black"
        fillOpacity={0.6}
        stroke={color}
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      <rect
        x={barX}
        y={barY}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
        rx={3}
        fill={color}
        fillOpacity={isComputing ? 0.5 : 0.15}
      >
        {isComputing && (
          <animate attributeName="fill-opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
        )}
      </rect>
      <text
        x={cx}
        y={barY + BAR_HEIGHT / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fillOpacity={0.6}
        fontSize={8}
        fontWeight="900"
        fontFamily="'JetBrains Mono', monospace"
      >
        {totalLayers}L · 100%
      </text>
      <text
        x={cx}
        y={barY + BAR_HEIGHT + 11}
        textAnchor="middle"
        fill={color}
        fillOpacity={0.4}
        fontSize={7}
        fontWeight="900"
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing="0.1em"
      >
        ALL LAYERS
      </text>
    </g>
  );
};

export default LayerStack;
