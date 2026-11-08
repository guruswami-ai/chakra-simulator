
import React, { useState, useEffect, useMemo } from 'react';
import { ClusterState, AppMode } from '../types';
import { Network, Boxes, AlertTriangle, Database, Zap, ShieldCheck, ShieldAlert, Activity as ActivityIcon, Menu, X } from 'lucide-react';
import { Breakpoint } from '../hooks/useBreakpoint';
import { OnboardingStep } from '../hooks/useGuruswamiState';
import { CHAKRA_COLORS } from '../constants';
import ClakyButton, { ClakyMetrics } from './ClakyButton';
import ClusterMetricsRing from './ClusterMetricsRing';

// Topology configurations matching landing page animation
const LOGO_TOPOLOGIES = [
  { name: 'PP2', tb5: [[0,1]] },
  { name: 'PP3', tb5: [[0,1], [1,2]] },
  { name: 'PP4', tb5: [[0,1], [1,2], [2,3]] },
  { name: 'PP5', tb5: [[0,1], [1,2], [2,3], [3,4]] },  // 4 links, no ring closure
  { name: 'TP2', tb5: [[0,1]] },
  { name: 'TP3', tb5: [[0,1], [1,2], [0,2]] },
  { name: 'TP4', tb5: [[0,1], [1,2], [2,3], [0,2], [0,3], [1,3]] },
  { name: 'TP5', tb5: [[0,1], [1,2], [2,3], [3,4], [4,0], [0,2], [0,3], [1,3], [1,4], [2,4]] },
  { name: 'SOLO', tb5: [] },
  { name: 'TP2+3', tb5: [[0,1], [2,3], [3,4], [2,4]] },
  { name: '1+TP4', tb5: [[1,2], [2,3], [3,4], [1,3], [1,4], [2,4]] },
];

// Animated Chakra Pentagram Logo - cycles through topologies
const ChakraPentagramLogo: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const [topoIndex, setTopoIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTopoIndex(prev => (prev + 1) % LOGO_TOPOLOGIES.length);
    }, 1000);  // Same speed as landing page
    return () => clearInterval(interval);
  }, []);

  // Node positions for a pentagon
  const cx = 50, cy = 50, r = 38;
  const nodes = [0, 1, 2, 3, 4].map(i => {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const chakraColors = [
    CHAKRA_COLORS.muladhara.base,
    CHAKRA_COLORS.svadhisthana.base,
    CHAKRA_COLORS.manipura.base,
    CHAKRA_COLORS.anahata.base,
    CHAKRA_COLORS.vishuddha.base,
  ];

  const currentTopo = LOGO_TOPOLOGIES[topoIndex];
  const activeLinks = new Set(currentTopo.tb5.map(([a, b]) => `${Math.min(a,b)}-${Math.max(a,b)}`));

  // All possible links
  const allLinks = [
    [0,1], [1,2], [2,3], [3,4], [4,0],  // Ring
    [0,2], [0,3], [1,3], [1,4], [2,4],  // Cross
  ];

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]">
      {/* TB5 mesh lines - fade in/out based on topology */}
      <g>
        {allLinks.map(([a, b]) => {
          const linkKey = `${Math.min(a,b)}-${Math.max(a,b)}`;
          const isActive = activeLinks.has(linkKey);
          return (
            <line
              key={linkKey}
              x1={nodes[a].x} y1={nodes[a].y}
              x2={nodes[b].x} y2={nodes[b].y}
              stroke="#0ea5e9"
              strokeWidth="2"
              opacity={isActive ? 0.9 : 0.1}
              style={{ transition: 'opacity 0.3s ease' }}
            />
          );
        })}
      </g>
      {/* Chakra-colored nodes */}
      {nodes.map((n, i) => (
        <circle key={`node-${i}`} cx={n.x} cy={n.y} r="8" fill={chakraColors[i]} />
      ))}
    </svg>
  );
};

interface TopBarProps {
  state: ClusterState;
  onToggleMode: () => void;
  mode: AppMode;
  onboardingStep?: OnboardingStep;
  clakyMetrics?: ClakyMetrics;
  onOpenClusterDetailed?: () => void;
  onSimulateVestaboard?: (grid: number[][]) => void;
  breakpoint?: Breakpoint;
}

const TopBar: React.FC<TopBarProps> = ({ state, onToggleMode, mode, clakyMetrics, onOpenClusterDetailed, onboardingStep, onSimulateVestaboard, breakpoint = 'desktop' }) => {
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isCompact = isMobile || isTablet;
  const [menuOpen, setMenuOpen] = useState(false);
  // TPS: Use authoritative inference TPS (same source as MeshGraph),
  // with fallback to node aggregate for when no model is active
  const clusterTps = state.activeModels[0]?.tokPerSec || state.nodes.reduce((acc, n) => acc + n.tok_per_sec, 0);
  const avgKv = state.nodes.reduce((acc, n) => acc + n.kv_cache_pct, 0) / state.nodes.length;

  // Compact Fabric Health computation (same logic as ClusterMetricsRing)
  const fabricHealthData = useMemo(() => {
    const totalRamUsed = state.nodes.reduce((acc, n) => acc + n.ram_used, 0);
    const totalRamMax = state.nodes.reduce((acc, n) => acc + n.ram_total, 0);
    const totalPower = state.nodes.reduce((acc, n) => acc + n.power_w, 0);
    const activeNodes = state.nodes.filter(n => n.tok_per_sec > 0);
    const avgGpu = activeNodes.length > 0
      ? activeNodes.reduce((acc, n) => acc + n.gpu_util, 0) / activeNodes.length
      : 0;

    const ramPct = totalRamMax > 0 ? (totalRamUsed / totalRamMax) * 100 : 0;
    const gpuPct = avgGpu;
    const powerPct = (totalPower / 2400) * 100;
    const isInferring = state.activeModels.length > 0 && state.activeModels[0].tokPerSec > 0;

    let health: number;
    let statusColor: string;
    let statusLabel: string;

    if (!isInferring) {
      const avgPower = totalPower / state.nodes.length;
      health = Math.max(0, Math.min(100, (200 - avgPower) / 200 * 100 + Math.min(10, gpuPct * 0.5)));
      statusColor = '#9ca3af'; // gray
      statusLabel = 'Standby';
    } else {
      let stability = gpuPct;
      const avgLatency = state.nodes.reduce((acc, n) => acc + n.rdma_latency_us, 0) / state.nodes.length;
      stability = Math.max(0, Math.min(100, stability - Math.max(0, (avgLatency - 52) * 4) - Math.max(0, (Math.max(...state.nodes.map(n => n.temp_c)) - 60) * 2.5)));
      health = Math.max(0, Math.min(100, stability * 0.5 + 50 * 0.3 + (activeNodes.length / state.nodes.length * gpuPct) * 0.2));

      if (health >= 80) { statusColor = '#10b981'; statusLabel = 'Optimal'; }
      else if (health >= 60) { statusColor = '#06b6d4'; statusLabel = 'Nominal'; }
      else { statusColor = '#f59e0b'; statusLabel = 'Degraded'; }
    }

    return { health, statusColor, statusLabel, gpuPct, ramPct, powerPct, isInferring };
  }, [state.nodes, state.activeModels]);

  const connStatus = { label: 'SIM', color: 'text-purple-400', dot: 'bg-purple-400' };

  // ── Action Buttons (shared between desktop and mobile menu) ──
  const ActionButtons = ({ vertical = false }: { vertical?: boolean }) => (
    <div className={`flex ${vertical ? 'flex-col' : 'items-center'} gap-3`}>
      {/* SIM Mode Indicator */}
      <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1">
        <div className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            SIM
          </span>
        </div>
      </div>

      {!isMobile && clakyMetrics && <ClakyButton metrics={clakyMetrics} mode={mode} onSimulate={onSimulateVestaboard} />}
    </div>
  );

  return (
    <div className={`absolute ${isMobile ? 'top-3 left-3 right-3' : 'top-6 left-6 w-[calc(100%-3rem)]'} z-[100] pointer-events-none`}>
      <header className={`chakra-panel pointer-events-auto ${isMobile ? 'h-14 px-4 rounded-2xl' : 'h-20 px-8 rounded-[2.5rem]'} w-full flex items-center justify-between shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-white/10`}>
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          <a
            href="/"
            className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} bg-black/40 border border-cyan-500/30 rounded-xl flex items-center justify-center overflow-hidden hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-all`}
            title="Return to Cluster Hub"
          >
            <ChakraPentagramLogo size={isMobile ? 24 : 32} />
          </a>
          <div className="flex flex-col">
            <h1 className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-black tracking-[0.4em] text-white uppercase font-orbitron`}>
              Chakra
            </h1>
            {!isMobile && (
              <span className="text-[10px] font-mono text-white/30 font-black tracking-[0.2em] uppercase">
                Node_Manager: Sahasrara_v5.6
              </span>
            )}
          </div>

        </div>

        {/* Right: Desktop/Tablet full controls, Mobile hamburger */}
        {isMobile ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="p-2 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/10"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {/* Cluster Health + Metrics */}
            {!isTablet && (
              <div className="relative group/metrics">
                <button
                  onClick={() => onOpenClusterDetailed?.()}
                  className="flex items-center gap-5 bg-black/40 border border-white/5 px-5 py-2 rounded-2xl hover:border-white/15 transition-all"
                >
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <svg width={40} height={40} viewBox="0 0 40 40" className="-rotate-90">
                      <circle cx={20} cy={20} r={16} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4} />
                      <circle cx={20} cy={20} r={16} fill="none" stroke={fabricHealthData.statusColor} strokeWidth={4} strokeLinecap="round" strokeDasharray={2 * Math.PI * 16} style={{ strokeDashoffset: 2 * Math.PI * 16 * (1 - fabricHealthData.health / 100), transition: 'stroke-dashoffset 1s ease' }} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono text-white leading-none">
                      {fabricHealthData.health.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-0.5">Throughput</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black font-mono text-emerald-400 tabular-nums leading-none">{clusterTps.toFixed(1)}</span>
                      <span className="text-[10px] font-black text-white/20 uppercase font-mono">T/S</span>
                    </div>
                  </div>
                  <div className="h-6 w-px bg-white/5" />
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-0.5">KV_Pressure</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black font-mono text-cyan-400 tabular-nums leading-none">{avgKv.toFixed(0)}%</span>
                      <span className="text-[10px] font-black text-white/20 uppercase font-mono">SAT</span>
                    </div>
                  </div>
                </button>
                {onOpenClusterDetailed && (
                  <div className="absolute top-full right-0 mt-3 opacity-0 group-hover/metrics:opacity-100 pointer-events-none group-hover/metrics:pointer-events-auto transition-all duration-200 z-[200]">
                    <div className="bg-black/95 border border-white/10 rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
                      <ClusterMetricsRing nodes={state.nodes} topology={state.globalTopology} activeModels={state.activeModels} onOpenDetailed={onOpenClusterDetailed} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="h-8 w-px bg-white/10" />
            <ActionButtons />
          </div>
        )}
      </header>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div className="pointer-events-auto mt-2 bg-black/95 border border-white/10 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col gap-4">
          <ActionButtons vertical />
          {clakyMetrics && <ClakyButton metrics={clakyMetrics} mode={mode} onSimulate={onSimulateVestaboard} />}
        </div>
      )}
    </div>
  );
};

export default TopBar;
