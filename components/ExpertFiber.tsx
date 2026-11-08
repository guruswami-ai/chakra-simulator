
import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// EXPERT FIBER (#51) — MoE Expert Routing Visualization
// ═══════════════════════════════════════════════════════════════════════════
// Renders fast "fiber flash" paths between the central gateway and compute
// nodes to visualize MoE expert selection. Uses prime-number animation
// durations to avoid repetitive patterns (0.17s, 0.23s, 0.29s).
//
// Active only when topology includes MoE models (architecture === 'moe').
// Each flash represents a token being routed to a specific expert on a node.
// ═══════════════════════════════════════════════════════════════════════════

interface ExpertFiberProps {
  centerX: number;
  centerY: number;
  nodePositions: Array<{ x: number; y: number; name: string }>;
  isActive: boolean;     // MoE model is actively inferring
  tps: number;           // Current tokens per second
  expertColor?: string;  // Fiber color (default: amber)
}

// Prime-number durations to avoid synchronized patterns
const PRIME_DURATIONS = [0.17, 0.23, 0.29, 0.31, 0.37, 0.41, 0.43, 0.47];

const ExpertFiber: React.FC<ExpertFiberProps> = ({
  centerX, centerY, nodePositions, isActive, tps, expertColor = '#f59e0b'
}) => {
  if (!isActive || tps < 0.1 || nodePositions.length === 0) return null;

  // More fibers at higher TPS (1 per 3 TPS, capped at 3 per node)
  const fibersPerNode = Math.min(3, Math.max(1, Math.floor(tps / 3)));

  return (
    <g id="expert-fibers" opacity={0.7}>
      {nodePositions.map((node, ni) => {
        const fibers = [];
        for (let f = 0; f < fibersPerNode; f++) {
          const dur = PRIME_DURATIONS[(ni * fibersPerNode + f) % PRIME_DURATIONS.length];
          const delay = dur * f * 0.6;
          // Slight curve via quadratic bezier for organic look
          const midX = (centerX + node.x) / 2 + (f - 1) * 15;
          const midY = (centerY + node.y) / 2 + (f - 1) * 10;
          const path = `M ${centerX} ${centerY} Q ${midX} ${midY} ${node.x} ${node.y}`;

          fibers.push(
            <g key={`fiber-${ni}-${f}`}>
              {/* Fiber flash — small circle racing along the path */}
              <circle r={3} fill={expertColor} fillOpacity={0}>
                <animateMotion dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`} path={path} />
                <animate attributeName="fill-opacity" values="0;0.9;0.9;0" dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`} keyTimes="0;0.1;0.7;1" />
                <animate attributeName="r" values="2;4;2" dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`} />
              </circle>
              {/* Faint trail line (only visible during flash) */}
              <path
                d={path}
                fill="none"
                stroke={expertColor}
                strokeWidth={1}
                strokeOpacity={0}
              >
                <animate attributeName="stroke-opacity" values="0;0.3;0" dur={`${dur}s`} repeatCount="indefinite" begin={`${delay}s`} keyTimes="0;0.3;1" />
              </path>
            </g>
          );
        }
        return <g key={`expert-node-${ni}`}>{fibers}</g>;
      })}
    </g>
  );
};

export default ExpertFiber;
