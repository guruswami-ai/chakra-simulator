
import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ChevronRight, Activity } from 'lucide-react';
import { ClusterMode, HistoryPoint } from '../types';
import { CHAKRA_COLORS } from '../constants';
import ConceptHelper from './ConceptHelper';

interface ClusterTopologyCardProps {
  topology: ClusterMode;
  tps: number;
  ttft?: number;
  nodeCount: number;
  modelName?: string;
  onClick: () => void;
  history: HistoryPoint[];
  totalLayers?: number;
  weightsPerNode?: number;
  kvCachePerNode?: number;
  freePerNode?: number;
  /** Animation speed scales with TPS */
  animTps?: number;
  /** Highlight a specific section during metrics tour */
  highlightSection?: 'tps' | 'ttft' | 'layers' | 'memory' | null;
  /** Style applied to root container (e.g. dimming opacity) */
  containerStyle?: React.CSSProperties;
  /** Extra className on root container (e.g. transition classes) */
  containerClassName?: string;
  /** Compact horizontal mode for mobile/tablet */
  compactMode?: boolean;
}

const NODE_COLORS = [
  CHAKRA_COLORS.muladhara.base,
  CHAKRA_COLORS.svadhisthana.base,
  CHAKRA_COLORS.manipura.base,
  CHAKRA_COLORS.anahata.base,
  CHAKRA_COLORS.vishuddha.base,
];

const NODE_NAMES = ['muladhara', 'svadhisthana', 'manipura', 'anahata', 'vishuddha'];

const getTopologyLabel = (topology: ClusterMode): string => {
  if (topology.includes('TP')) return 'TENSOR PARALLEL';
  if (topology.includes('PP')) return 'PIPELINE PARALLEL';
  if (topology.includes('EP')) return 'INDEPENDENT';
  if (topology === 'SINGLE') return 'SINGLE NODE';
  if (topology === 'OFFLINE') return 'OFFLINE';
  return 'HYBRID';
};

const getTopologyDotColor = (topology: ClusterMode): string => {
  if (topology.includes('TP')) return 'bg-purple-500 animate-pulse';
  if (topology.includes('PP')) return 'bg-cyan-500 animate-pulse';
  if (topology === 'OFFLINE') return 'bg-red-500';
  return 'bg-yellow-500';
};

/** Extract node count from topology mode string */
const getNodeCountFromTopology = (topology: ClusterMode): number => {
  if (topology === 'SINGLE' || topology === 'OFFLINE') return 1;
  const match = topology.match(/(\d+)/);
  return match ? parseInt(match[1]) : 1;
};

/** Format GB value — shows MB when < 1 GB for precision */
const fmtMem = (gb: number): string => {
  if (gb < 0.01) return '0';
  if (gb < 1) return `${Math.round(gb * 1024)} MB`;
  return `${gb.toFixed(1)} GB`;
};

const VISUAL_LAYERS = 10;

/** Helper to apply tour highlight/dim styling to a section */
const tourStyle = (
  sectionId: 'tps' | 'ttft' | 'layers' | 'memory',
  highlight: 'tps' | 'ttft' | 'layers' | 'memory' | null | undefined,
) => {
  if (!highlight) return {};
  if (highlight === sectionId) {
    return {
      outline: '2px solid rgba(255, 200, 50, 0.5)',
      borderRadius: '0.75rem',
      boxShadow: '0 0 30px rgba(255, 180, 40, 0.2), 0 0 60px rgba(255, 150, 30, 0.1)',
      padding: '0.5rem',
      margin: '-0.5rem',
      transition: 'all 500ms ease',
    };
  }
  return {
    opacity: 0.2,
    filter: 'blur(1px)',
    transition: 'all 500ms ease',
  };
};

const ClusterTopologyCard: React.FC<ClusterTopologyCardProps> = ({
  topology,
  tps,
  ttft,
  nodeCount,
  onClick,
  history,
  totalLayers,
  weightsPerNode,
  kvCachePerNode,
  freePerNode,
  animTps,
  highlightSection,
  containerStyle,
  containerClassName,
  compactMode = false,
}) => {
  const isTP = topology.includes('TP') && !topology.includes('EP');
  const isPP = topology.startsWith('RING_PP');
  const isEP = topology.includes('EP') && topology.includes('SOLO');
  const isSingle = topology === 'SINGLE' || topology === 'OFFLINE';

  const topoNodeCount = getNodeCountFromTopology(topology);
  const effectiveTps = animTps ?? tps;

  // Animation duration: 4s at 0 TPS → 0.8s at 20+ TPS
  const animDuration = useMemo(() => {
    if (effectiveTps <= 0) return 0;
    return Math.max(0.8, 4 - (effectiveTps / 20) * 3.2);
  }, [effectiveTps]);

  // Layer ranges for PP mode — even splits
  const ppRanges = useMemo(() => {
    if (!isPP || !totalLayers) return [];
    const layersPerNode = Math.round(totalLayers / topoNodeCount);
    return Array.from({ length: topoNodeCount }, (_, i) => ({
      start: i * layersPerNode + 1,
      end: (i + 1) * layersPerNode,
    }));
  }, [isPP, totalLayers, topoNodeCount]);

  const showLayerSplit = totalLayers !== undefined && totalLayers > 0;
  const showMemory = weightsPerNode !== undefined && weightsPerNode > 0;

  // ── Layer column rendering ────────────────────────────────────────────
  const renderLayerColumn = () => {
    if (!totalLayers) return null;

    // ── EP: Solid blocks with 100% label ──
    if (isEP) {
      return (
        <div className="flex gap-[3px] h-full">
          {Array.from({ length: topoNodeCount }, (_, i) => (
            <div
              key={i}
              className="flex-1 rounded-md shadow-[inset_0_0_8px_rgba(255,255,255,0.1)] relative flex items-center justify-center"
              style={{
                backgroundColor: NODE_COLORS[i % NODE_COLORS.length],
                opacity: 0.9,
                animation: animDuration > 0 ? `pulse ${animDuration}s ease-in-out infinite` : undefined,
              }}
            >
              <span className="text-[9px] font-mono font-black text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                100%
              </span>
            </div>
          ))}
        </div>
      );
    }

    // ── SINGLE: One solid block with 100% label ──
    if (isSingle) {
      return (
        <div
          className="h-full rounded-md shadow-[inset_0_0_8px_rgba(255,255,255,0.1)] flex items-center justify-center"
          style={{
            backgroundColor: NODE_COLORS[0],
            opacity: 0.9,
            animation: animDuration > 0 ? `pulse ${animDuration}s ease-in-out infinite` : undefined,
          }}
        >
          <span className="text-[9px] font-mono font-black text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {totalLayers}L
          </span>
        </div>
      );
    }

    // ── PP: Layer bars grouped by stage, whole stage pulses together ──
    if (isPP) {
      const barsPerStage = Math.max(2, Math.round(VISUAL_LAYERS / topoNodeCount));

      return (
        <div className="flex flex-col gap-[2px] h-full">
          {Array.from({ length: topoNodeCount }, (_, stageIdx) => {
            const stageColor = NODE_COLORS[stageIdx % NODE_COLORS.length];
            const range = ppRanges[stageIdx];
            // Animation on the STAGE container — all bars in this stage brighten together
            const stageDelay = animDuration > 0 ? `${(stageIdx / topoNodeCount) * animDuration}s` : undefined;
            return (
              <div
                key={stageIdx}
                className="flex-1 flex flex-col gap-[1px] relative min-h-0"
                style={{
                  animation: animDuration > 0 ? `ppScan ${animDuration}s linear ${stageDelay} infinite` : undefined,
                }}
              >
                {/* Layer bars — no individual animation, stage container handles it */}
                {Array.from({ length: barsPerStage }, (_, barIdx) => (
                  <div
                    key={barIdx}
                    className="w-full flex-1 rounded-[1px]"
                    style={{
                      backgroundColor: stageColor,
                      opacity: 0.9,
                    }}
                  />
                ))}
                {/* Label floated over the stage group center */}
                {range && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-black text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none">
                    {range.start}-{range.end}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // ── TP: All shards in a row brighten together (parallel compute),
    //        then wave moves down (layer by layer, top → bottom) ──
    if (isTP) {
      const pct = Math.floor(100 / topoNodeCount);
      const rows = [];
      for (let i = 0; i < VISUAL_LAYERS; i++) {
        const isMidRow = i === Math.floor(VISUAL_LAYERS / 2);
        const rowDelay = animDuration > 0 ? `${(i / VISUAL_LAYERS) * animDuration}s` : undefined;
        rows.push(
          <div
            key={i}
            className="w-full flex-1 flex gap-[2px]"
            style={{
              animation: animDuration > 0 ? `tpRowScan ${animDuration}s ease-in-out ${rowDelay} infinite` : undefined,
            }}
          >
            {Array.from({ length: topoNodeCount }, (_, j) => (
              <div
                key={j}
                className="h-full flex-1 rounded-[2px] shadow-[inset_0_0_4px_rgba(255,255,255,0.15)] relative flex items-center justify-center"
                style={{
                  backgroundColor: NODE_COLORS[j % NODE_COLORS.length],
                  opacity: 0.9,
                }}
              >
                {isMidRow && (
                  <span className="text-[7px] font-mono font-black text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                    {pct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      }
      return <div className="flex flex-col gap-[2px] h-full">{rows}</div>;
    }

    return null;
  };

  // ── Legend text below column ──
  const renderLegend = () => {
    if (!totalLayers) return null;

    if (isSingle) {
      return (
        <span className="text-[9px] font-mono text-white/25">
          {totalLayers}L on 1 node
        </span>
      );
    }

    if (isEP) {
      return (
        <span className="text-[9px] font-mono text-white/25">
          {topoNodeCount}x independent · 100% each
        </span>
      );
    }

    if (isPP) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          {ppRanges.map((range, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NODE_COLORS[i % NODE_COLORS.length] }} />
              <span className="text-[9px] font-mono text-white/25">
                L{range.start}-{range.end}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (isTP) {
      return (
        <span className="text-[9px] font-mono text-white/25">
          All {totalLayers}L sharded x{topoNodeCount}
        </span>
      );
    }

    return null;
  };

  return (
    <div
      className={`absolute z-40 pointer-events-auto ${
        compactMode
          ? 'bottom-4 left-4 right-4'
          : 'top-[7.5rem] left-10'
      } ${containerClassName ?? ''}`}
      style={compactMode ? containerStyle : { width: 320, ...containerStyle }}
    >
      <button
        onClick={onClick}
        className={`w-full chakra-panel border border-white/10 hover:border-white/20 transition-all cursor-pointer group text-left ${
          compactMode
            ? 'rounded-2xl px-5 py-3 flex items-center gap-4'
            : 'rounded-[2rem] p-7 flex flex-col gap-4'
        }`}
      >
        {/* Topology bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getTopologyDotColor(topology)}`} />
            <span className="text-[11px] font-black text-white/60 uppercase tracking-wider font-mono">
              {topology}
            </span>
            <span className={`text-[10px] font-mono font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
              topology.includes('TP') ? 'bg-purple-500/20 text-purple-300' :
              topology.includes('PP') ? 'bg-cyan-500/20 text-cyan-300' :
              topology === 'OFFLINE' ? 'bg-red-500/20 text-red-300' :
              'bg-white/10 text-white/50'
            }`}>
              {getTopologyLabel(topology)}
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/30">{nodeCount}/5</span>
        </div>

        {/* TPS — compact shows inline, desktop shows large */}
        {compactMode ? (
          <div className="flex items-baseline gap-2 flex-1 min-w-0">
            <span className="text-2xl font-black font-mono text-white tabular-nums">{tps.toFixed(1)}</span>
            <span className="text-[10px] font-black font-mono text-emerald-400 uppercase">T/s</span>
            {ttft != null && ttft > 0 && (
              <>
                <div className="h-4 w-px bg-white/10 mx-1" />
                <span className="text-sm font-black font-mono text-cyan-400 tabular-nums">{ttft.toFixed(2)}s</span>
                <span className="text-[10px] font-mono text-white/30 uppercase">TTFT</span>
              </>
            )}
            <ChevronRight className="w-4 h-4 text-white/20 ml-auto flex-shrink-0" />
          </div>
        ) : (
          <div style={tourStyle('tps', highlightSection)}>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 flex items-center gap-2">
              Throughput
              <ConceptHelper sectionId="tps-ttft" label="TPS" />
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-6xl font-black font-mono text-white tabular-nums drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                {tps.toFixed(1)}
              </span>
              <span className="text-sm font-black font-mono text-emerald-400 uppercase tracking-widest">T/s</span>
            </div>
          </div>
        )}

        {/* Flow Rate sparkline — desktop only */}
        {!compactMode && (<div style={tourStyle('tps', highlightSection)}>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3 h-3 text-emerald-500/60" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Flow Rate</span>
          </div>
          <div className="h-[60px] w-full bg-black/30 rounded-xl border border-white/5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="sparkTps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="tokPerSec"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#sparkTps)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>)}

        {/* TTFT, Layers, Memory — desktop only */}
        {!compactMode && (<>
        {/* Large TTFT */}
        <div style={tourStyle('ttft', highlightSection)}>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 flex items-center gap-2">
            Time to First Token
            <ConceptHelper sectionId="tps-ttft" label="TTFT" />
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-5xl font-black font-mono text-cyan-400 tabular-nums drop-shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              {(ttft ?? 0).toFixed(2)}
            </span>
            <span className="text-sm font-black font-mono text-cyan-400/60 uppercase tracking-widest">s</span>
          </div>
        </div>

        {/* Awaiting deployment placeholder — visible when no model data yet */}
        {!showLayerSplit && !showMemory && (
          <div className="flex flex-col items-center gap-2 py-4 opacity-30">
            <div className="w-8 h-[2px] bg-white/20 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
              Awaiting deployment
            </span>
            <div className="w-8 h-[2px] bg-white/20 rounded-full" />
          </div>
        )}

        {/* Layer Split Column */}
        {showLayerSplit && (
          <div style={tourStyle('layers', highlightSection)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-1">
                Layer Split
                <ConceptHelper sectionId="mesh-ring" label="Layer Split" />
              </span>
              <span className="text-[10px] font-mono text-white/20">
                {totalLayers}L
                {isEP ? ` x${topoNodeCount} independent` :
                 isTP ? ` sharded x${topoNodeCount}` :
                 isPP ? ` / ${topoNodeCount} stages` :
                 ''}
              </span>
            </div>
            {/* The column */}
            <div className="h-[120px] w-full rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 p-1.5">
              {renderLayerColumn()}
            </div>
            {/* Legend */}
            <div className="mt-1.5">
              {renderLegend()}
            </div>
          </div>
        )}

        {/* Compact Node Memory */}
        {showMemory && (
          <div style={tourStyle('memory', highlightSection)}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-1">
                Per-Node Memory
                <ConceptHelper sectionId="kv-cache" label="Node Memory" />
              </span>
              {freePerNode !== undefined && freePerNode <= 0 && (
                <span className="text-[9px] font-black text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded-full animate-pulse">
                  OOM
                </span>
              )}
            </div>
            <div className={`h-3 w-full rounded-full overflow-hidden flex ${
              freePerNode !== undefined && freePerNode <= 0
                ? 'bg-red-500/30 ring-2 ring-red-500/80 animate-pulse'
                : freePerNode !== undefined && freePerNode < 25
                  ? 'bg-white/10 ring-1 ring-amber-500/60'
                  : 'bg-white/10'
            }`}>
              <div
                className={`h-full transition-all duration-500 ${
                  freePerNode !== undefined && freePerNode <= 0 ? 'bg-red-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, (weightsPerNode! / 512) * 100)}%` }}
              />
              <div
                className={`h-full transition-all duration-500 ${
                  freePerNode !== undefined && freePerNode <= 0 ? 'bg-red-400' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100 - (weightsPerNode! / 512) * 100, ((kvCachePerNode ?? 0) / 512) * 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[9px] font-mono">
              <div className="w-1.5 h-1.5 rounded-sm bg-cyan-500 shrink-0" />
              <span className="text-cyan-400/70">{fmtMem(weightsPerNode!)}</span>
              <span className="text-white/15">Wt</span>
              <div className="w-1.5 h-1.5 rounded-sm bg-purple-500 shrink-0" />
              <span className="text-purple-400/70">{fmtMem(kvCachePerNode ?? 0)}</span>
              <span className="text-white/15">KV</span>
              <div className={`w-1.5 h-1.5 rounded-sm shrink-0 ${
                freePerNode !== undefined && freePerNode < 25 ? 'bg-amber-500' : 'bg-white/20'
              }`} />
              <span className={
                freePerNode !== undefined && freePerNode <= 0 ? 'text-red-400' :
                freePerNode !== undefined && freePerNode < 25 ? 'text-amber-400' :
                'text-white/30'
              }>
                {fmtMem(freePerNode ?? 0)}
              </span>
              <span className={
                freePerNode !== undefined && freePerNode < 25 ? 'text-amber-400/60' : 'text-white/15'
              }>
                {freePerNode !== undefined && freePerNode < 25 ? 'Free LOW' : 'Free'}
              </span>
            </div>
          </div>
        )}

        {/* Details link */}
        <div className="flex items-center gap-1 text-white/20 group-hover:text-white/50 transition-colors pt-1 border-t border-white/5">
          <span className="text-[10px] font-black uppercase tracking-wider">Cluster Diagnostics</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
        </>)}
      </button>
    </div>
  );
};

export default ClusterTopologyCard;
