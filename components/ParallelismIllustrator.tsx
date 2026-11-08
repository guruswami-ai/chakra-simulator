
import React, { useMemo } from 'react';
import { Layers, Activity, Cpu, Zap, ArrowRight, Box } from 'lucide-react';
import ConceptHelper from './ConceptHelper';
import { ClusterMode, ModelInstance } from '../types';
import { CHAKRA_COLORS } from '../constants';

interface ParallelismIllustratorProps {
  mode: ClusterMode;
  color: string;
  model?: ModelInstance;  // Optional model for multi-model display
  compact?: boolean;      // Compact mode for multiple cards
  totalLayers?: number;   // Total layers in model (default 128)
  tps?: number;           // Tokens per second — drives animation speed
}

const ParallelismIllustrator: React.FC<ParallelismIllustratorProps> = ({
  mode,
  color,
  model,
  compact = false,
  totalLayers = 128,
  tps = 0,
}) => {
  // New TP_RDMA naming (TP2_RDMA, TP4_RDMA) or legacy HYBRID_TP
  const isTPRDMA = mode.startsWith('TP') && mode.includes('RDMA');
  const isHybrid = isTPRDMA || mode === 'HYBRID_TP4' || mode.startsWith('HYBRID_TP');
  const isFullMesh = mode === 'FULL_MESH_TP5';
  const isRingPP = mode.startsWith('RING_PP');
  const isDualTP2 = mode === 'DUAL_TP2';
  const isTP3Mesh = mode === 'TP3_MESH';
  const isEP5 = mode === 'EP5_SOLO';
  const isTPSolo = mode.includes('_SOLO') && !isEP5;  // e.g., TP4_SOLO1

  // Strict mapping of node colors from Muladhara (0) to Vishuddha (4)
  const nodeColors = [
    CHAKRA_COLORS.muladhara.base,
    CHAKRA_COLORS.svadhisthana.base,
    CHAKRA_COLORS.manipura.base,
    CHAKRA_COLORS.anahata.base,
    CHAKRA_COLORS.vishuddha.base
  ];

  // Calculate node count for current mode
  const nodeCount = useMemo(() => {
    if (isRingPP) return parseInt(mode.replace('RING_PP', ''));
    if (isTPRDMA) {
      const match = mode.match(/TP(\d+)_RDMA/);
      return match ? parseInt(match[1]) : 4;
    }
    if (isHybrid) {
      const match = mode.match(/HYBRID_TP(\d+)/);
      return match ? parseInt(match[1]) : 4;
    }
    if (isFullMesh) return 5;
    if (isDualTP2) return 4;
    if (isTP3Mesh) return 3;
    if (isEP5) return 5;
    return 5;
  }, [mode, isRingPP, isTPRDMA, isHybrid, isFullMesh, isDualTP2, isTP3Mesh, isEP5]);

  // Calculate layer ranges — even splits for consistency
  const getLayerRanges = useMemo(() => {
    if (isEP5) return [];

    // Even split: all stages show the same layer count
    const layersPerNode = Math.round(totalLayers / nodeCount);
    const ranges: { start: number; end: number; nodeIdx: number }[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const start = i * layersPerNode + 1;
      const end = (i + 1) * layersPerNode;
      ranges.push({ start, end, nodeIdx: i });
    }

    return ranges;
  }, [totalLayers, nodeCount, isEP5]);

  // Animation duration based on TPS (faster TPS = faster animation)
  // Range: 4s at 0 TPS → 0.8s at 20+ TPS
  const animDuration = useMemo(() => {
    if (tps <= 0) return 4;
    return Math.max(0.8, 4 - (tps / 20) * 3.2);
  }, [tps]);

  const getDescription = () => {
    const modelName = model?.name || 'Model';
    let nodeCount = model?.nodeIds?.length || 4;
    if (isRingPP) nodeCount = parseInt(mode.replace('RING_PP', ''));
    else if (isTPRDMA) {
      const match = mode.match(/TP(\d+)_RDMA/);
      nodeCount = match ? parseInt(match[1]) : 4;
    }
    const layersPerNode = Math.floor(totalLayers / nodeCount);

    if (isEP5) return `Standalone: Each node runs independent model via 10GbE. Maximum throughput.`;
    if (isRingPP) {
      return `${nodeCount}-Stage Pipeline: Layers split sequentially (~${layersPerNode} layers/node). Data flows through each stage.`;
    }
    switch(mode) {
      case 'TP4_RDMA':
      case 'HYBRID_TP4':
        return `4-Way Tensor Parallel: Each layer sharded across 4 nodes. All-reduce sync via TB5 RDMA.`;
      case 'TP2_RDMA':
      case 'HYBRID_TP2':
        return `2-Way Tensor Parallel: Attention heads split 50/50. Low latency RDMA sync.`;
      case 'FULL_MESH_TP5':
        return `5-Way Full Mesh: Maximum parallelism. Every tensor split 5 ways with RDMA sync.`;
      case 'DUAL_TP2':
        return `Dual TP2 Pairs: Two independent 2-way groups for concurrent request handling.`;
      case 'TP3_MESH':
        return `3-Way Tensor Mesh: Core compute triad with balanced shard distribution.`;
      default:
        if (mode.startsWith('TP') && mode.includes('RDMA')) {
          const tpDegree = mode.match(/TP(\d+)/)?.[1] || '4';
          return `${tpDegree}-Way Tensor Parallel: Tensors sharded via TB5 RDMA mesh.`;
        }
        if (mode.startsWith('HYBRID_TP')) {
          const tpDegree = mode.match(/\d+/)?.[0] || '4';
          return `${tpDegree}-Way Tensor Parallel: Tensors sharded across ${tpDegree} nodes with sync barriers.`;
        }
        return `Distributed sharding optimized for ${nodeCount}-node topology.`;
    }
  };

  const nodeCoords = [
    { x: 50, y: 15 }, 
    { x: 83, y: 38 }, 
    { x: 70, y: 78 }, 
    { x: 30, y: 78 }, 
    { x: 17, y: 38 }, 
  ];

  const topologyLinks = useMemo(() => {
    const links: [number, number][] = [];
    if (isRingPP) {
      const stages = parseInt(mode.replace('RING_PP', ''));
      for (let i = 0; i < stages - 1; i++) {
        links.push([i, i + 1]);
      }
    } else if (isFullMesh) {
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) { links.push([i, j]); }
      }
    } else if (isTPRDMA) {
      // TP2_RDMA, TP4_RDMA: Nodes 0 to N-1 in full mesh
      const match = mode.match(/TP(\d+)_RDMA/);
      const tpDegree = match ? parseInt(match[1]) : 4;
      for (let i = 0; i < tpDegree; i++) {
        for (let j = i + 1; j < tpDegree; j++) { links.push([i, j]); }
      }
    } else if (isHybrid && !isTPRDMA) {
      // Legacy HYBRID_TP2/TP4
      const match = mode.match(/HYBRID_TP(\d+)/);
      const tpDegree = match ? parseInt(match[1]) : 4;
      for (let i = 0; i < tpDegree; i++) {
        for (let j = i + 1; j < tpDegree; j++) { links.push([i, j]); }
      }
    } else if (isDualTP2) {
      links.push([1, 2]);
      links.push([3, 4]);
    } else if (isTP3Mesh) {
      links.push([2, 3]); links.push([3, 4]); links.push([2, 4]);
    } else if (isEP5) {
      // No links for standalone - each node independent
    }
    return links;
  }, [mode, isRingPP, isFullMesh, isHybrid, isTPRDMA, isDualTP2, isTP3Mesh, isEP5]);

  const renderLayerMap = () => {
    const items = [];
    // All bars use flex-1 so the container distributes height evenly —
    // no fixed pixel heights that could overflow/clip unevenly.
    const barClass = 'flex-1 min-h-0 w-full rounded-sm';

    // ── EP: Full-model blocks with 100% labels ──
    if (isEP5) {
      const epNodeCount = parseInt(mode.replace('EP', '').replace('_SOLO', '')) || 5;
      const epVisual = compact ? 12 : 16;
      for (let i = 0; i < epVisual; i++) {
        items.push(
          <div key={i} className={`${barClass} flex gap-0.5`}>
            {Array.from({ length: epNodeCount }, (_, j) => (
              <div
                key={j}
                className="h-full flex-1 rounded-sm shadow-[inset_0_0_4px_rgba(255,255,255,0.2)] relative"
                style={{
                  backgroundColor: nodeColors[j] || '#333',
                  opacity: 0.95,
                  animation: tps > 0 ? `pulse ${animDuration}s ease-in-out infinite` : undefined,
                }}
              >
                {i === Math.floor(epVisual / 2) && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-black text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    100%
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      }
      return items;
    }

    if (isRingPP) {
      // ── PP: Even visual bars per stage ──
      const stages = parseInt(mode.replace('RING_PP', ''));
      const barsPerStage = compact ? Math.max(2, Math.round(12 / stages)) : Math.max(2, Math.round(16 / stages));
      const visualLayers = barsPerStage * stages;

      for (let i = 0; i < visualLayers; i++) {
        const stageIdx = Math.floor(i / barsPerStage);
        const stageColor = nodeColors[stageIdx] || '#333';
        const isMiddleOfStage = (i % barsPerStage) === Math.floor(barsPerStage / 2);
        const range = getLayerRanges[stageIdx];
        const animDelay = tps > 0 ? `${(i / visualLayers) * animDuration}s` : undefined;

        items.push(
          <div
            key={i}
            className={`${barClass} shadow-sm relative group`}
            style={{
              backgroundColor: stageColor,
              opacity: 0.95,
              animation: tps > 0 ? `ppScan ${animDuration}s ease-in-out ${animDelay} infinite` : undefined,
            }}
          >
            {isMiddleOfStage && range && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-mono font-black text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] tracking-tight">
                  {range.start}-{range.end}
                </span>
              </div>
            )}
          </div>
        );
      }
    } else {
      // ── TP: All layers sharded across nodes ──
      let shardConfig: (string | null)[] = [];

      if (isFullMesh) {
        shardConfig = nodeColors;
      } else if (isTPRDMA) {
        const match = mode.match(/TP(\d+)_RDMA/);
        const tpDegree = match ? parseInt(match[1]) : 4;
        shardConfig = nodeColors.slice(0, tpDegree);
      } else if (isHybrid && !isTPRDMA) {
        const match = mode.match(/HYBRID_TP(\d+)/);
        const tpDegree = match ? parseInt(match[1]) : 4;
        shardConfig = nodeColors.slice(0, tpDegree);
      } else if (isDualTP2) {
        shardConfig = [nodeColors[1], nodeColors[2], null, nodeColors[3], nodeColors[4]];
      } else if (isTP3Mesh) {
        shardConfig = nodeColors.slice(2, 5);
      } else {
        shardConfig = nodeColors.slice(0, 2);
      }

      const activeShards = shardConfig.filter(s => s !== null).length;
      const visualLayers = compact ? 12 : 16;

      // Header
      items.push(
        <div key="tp-header" className="text-[10px] font-mono font-black text-white/40 uppercase tracking-wider text-center mb-1 pb-1 border-b border-white/10">
          L1-{totalLayers} (sharded)
        </div>
      );

      for (let i = 0; i < visualLayers; i++) {
        // TP: entire row brightens together (parallel shards), wave moves down (layer by layer)
        const rowDelay = tps > 0 ? `${(i / visualLayers) * animDuration}s` : undefined;
        items.push(
          <div
            key={i}
            className={`${barClass} flex gap-0.5`}
            style={{
              animation: tps > 0 ? `tpRowScan ${animDuration}s ease-in-out ${rowDelay} infinite` : undefined,
            }}
          >
            {shardConfig.map((sc, shard) => {
              if (sc === null) return <div key={`gap-${shard}`} className="h-full w-1" />;
              return (
                <div
                  key={shard}
                  className="h-full flex-1 rounded-sm shadow-[inset_0_0_4px_rgba(255,255,255,0.2)] relative"
                  style={{ backgroundColor: sc, opacity: 0.95 }}
                >
                  {i === Math.floor(visualLayers / 2) && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-black text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                      {Math.floor(100 / activeShards)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
    }
    return items;
  };

  // Determine active node count for display
  const activeNodeCount = useMemo(() => {
    if (model?.nodeIds?.length) return model.nodeIds.length;
    return nodeCount;
  }, [model?.nodeIds?.length, nodeCount]);

  return (
    <div className={`flex flex-col gap-3 ${compact ? '' : 'mt-4'}`}>
      {/* Header - only show if not compact or no model name */}
      {!compact && (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-500" />
            Parallelism Strategy
            <ConceptHelper sectionId="mesh-ring" label="TP vs PP" />
          </h2>
          <span className="text-[10px] font-mono text-cyan-400/60 font-black uppercase tracking-wider">Live</span>
        </div>
      )}

      <div className="chakra-panel rounded-[1.5rem] overflow-hidden relative p-5" style={{ borderLeft: model ? `3px solid ${color}` : undefined }}>
        {/* Model name header if provided */}
        {model && (
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Box className="w-4 h-4" style={{ color }} />
              <span className="text-[13px] font-black text-white uppercase tracking-tight">{model.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-black text-white/40 uppercase">
                {activeNodeCount} Nodes
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className={`flex items-stretch gap-5 ${compact ? 'h-44' : 'h-48'}`}>
            {/* Stack Split Visualization */}
            <div className="w-28 flex flex-col relative group pr-4 border-r border-white/10">
              <div className="mb-3">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-wider leading-none block">Layer Split</span>
                <span className="text-[10px] font-mono text-white/20 mt-0.5 block">{totalLayers} layers</span>
              </div>

              <div className="flex-1 flex flex-col gap-0.5 relative overflow-hidden">
                {renderLayerMap()}
              </div>
            </div>

            {/* Topology and Description */}
            <div className="flex-1 flex flex-col justify-between relative min-w-0">
              <div className="flex items-start gap-4">
                {/* Mini topology diagram */}
                <div className={`${compact ? 'h-20 w-20' : 'h-24 w-24'} relative bg-black/50 rounded-2xl border border-white/10 shadow-lg flex-shrink-0 flex items-center justify-center p-2 z-10`}>
                  <svg viewBox="0 0 100 100" className="w-full h-full p-1 overflow-visible">
                    {topologyLinks.map(([from, to], idx) => (
                      <g key={`link-group-${idx}`}>
                        <line
                          x1={nodeCoords[from].x} y1={nodeCoords[from].y}
                          x2={nodeCoords[to].x} y2={nodeCoords[to].y}
                          stroke={isRingPP ? '#22d3ee' : '#a855f7'}
                          strokeWidth="2"
                          strokeOpacity="0.6"
                          strokeDasharray={isRingPP ? "4 2" : "none"}
                          className="transition-all duration-700"
                        />
                      </g>
                    ))}

                    {nodeCoords.map((coord, i) => {
                      // Node 0 (muladhara) is ALWAYS included in multi-node modes
                      const isActive = isRingPP
                        ? i < parseInt(mode.replace('RING_PP', ''))
                        : i < activeNodeCount;  // HYBRID_TP: Nodes 0 to N-1
                      return (
                        <circle
                          key={i}
                          cx={coord.x}
                          cy={coord.y}
                          r="6"
                          fill={isActive ? nodeColors[i] : '#222'}
                          stroke={isActive ? 'white' : '#333'}
                          strokeWidth="1"
                          className="transition-all duration-700"
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Mode name and description */}
                <div className="flex flex-col justify-center gap-3 relative min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border shadow-lg ${isRingPP ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-purple-500/10 border-purple-500/30'}`}>
                      {isRingPP ? <Layers className="w-4 h-4 text-cyan-400" /> : <Zap className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-black uppercase tracking-tight text-white">{mode.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-mono font-black text-white/30 uppercase tracking-widest">
                        {isRingPP ? 'Pipeline Parallel' : 'Tensor Parallel'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-white/50 font-medium border-l-2 border-white/20 pl-3">
                    {getDescription()}
                  </p>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center gap-3 bg-white/[0.04] rounded-xl border border-white/10 p-3 mt-3">
                <div className={`w-2 h-2 rounded-full ${isRingPP ? 'bg-cyan-400' : 'bg-purple-400'} animate-pulse`} />
                <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                  {isRingPP ? 'Sequential Flow' : 'Sync Mesh'}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black text-emerald-400/70 uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer info */}
          <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <div className="p-3 flex items-center gap-3">
                <div className="w-1 h-5 bg-cyan-400 rounded-full" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Fabric</span>
                  <span className="text-[11px] font-black text-white uppercase tracking-tight">TB5 RDMA</span>
                </div>
              </div>
              <div className="p-3 flex items-center gap-3">
                <Cpu className="w-4 h-4 text-emerald-400/60" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Backend</span>
                  <span className="text-[11px] font-black text-white uppercase tracking-tight">MLX JACCL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParallelismIllustrator;
