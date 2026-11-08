
import React, { useMemo } from 'react';
import { NodeMetrics, ModelInstance } from '../types';
import { Database, Zap, Cpu, Activity, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ClusterMetricsRingProps {
  nodes: NodeMetrics[];
  topology: string;
  activeModels: ModelInstance[];
  onOpenDetailed: () => void;
}

/**
 * Compact cluster metrics ring visualization for at-a-glance health monitoring.
 * 
 * Displays three concentric rings:
 * - Outer: SOC_UTIL (GPU utilization)
 * - Middle: VRAM_POOL (memory usage)
 * - Inner: PWR_DRAW (power consumption)
 * 
 * Center shows context-aware "Fabric Health" metric (0-100):
 * - Idle: Rewards low power consumption
 * - Active: Blends stability (GPU util, latency, thermal) with performance vs baseline
 * 
 * Interactions:
 * - Hover: Shows detailed tooltip with metric breakdown
 * - Click: Opens full Cluster Diagnostics HUD
 */
const ClusterMetricsRing: React.FC<ClusterMetricsRingProps> = ({ 
  nodes, 
  topology, 
  activeModels, 
  onOpenDetailed 
}) => {
  const { stats, health, status, breakdown, isActive } = useMemo(() => {
    // Aggregate stats across all nodes
    const totalRamUsed = nodes.reduce((acc, n) => acc + n.ram_used, 0);
    const totalRamMax = nodes.reduce((acc, n) => acc + n.ram_total, 0);
    const totalPower = nodes.reduce((acc, n) => acc + n.power_w, 0);
    const activeNodes = nodes.filter(n => n.tok_per_sec > 0);
    const avgGpu = activeNodes.length > 0 
      ? activeNodes.reduce((acc, n) => acc + n.gpu_util, 0) / activeNodes.length 
      : 0;
    
    const ramUsedTB = totalRamUsed / 1024;
    const ramMaxTB = totalRamMax / 1024;
    const ramPct = (totalRamUsed / totalRamMax) * 100;
    const powerPct = (totalPower / 2400) * 100; // 5 nodes × 480W max
    const gpuPct = avgGpu;

    // Calculate context-aware Fabric Health
    const isInferenceActive = activeModels.length > 0 && activeModels[0].tokPerSec > 0;
    
    let fabricHealth: number;
    let healthBreakdown: any;
    let currentStatus: any;

    if (!isInferenceActive) {
      // IDLE STATE: Health = low power efficiency + readiness
      const avgPowerPerNode = totalPower / nodes.length;
      const idleEfficiency = Math.max(0, Math.min(100, (200 - avgPowerPerNode) / 200 * 100)); // 0W=100, 200W=0
      
      // Small bonus for having some GPU activity (ready state)
      const readinessBonus = Math.min(10, gpuPct * 0.5);
      
      fabricHealth = Math.min(100, idleEfficiency + readinessBonus);
      
      healthBreakdown = {
        idleEfficiency: idleEfficiency.toFixed(0),
        avgPowerPerNode: avgPowerPerNode.toFixed(0),
        readiness: readinessBonus.toFixed(0)
      };

      currentStatus = { 
        label: 'Standby', 
        color: 'text-white/40', 
        icon: ShieldAlert, 
        bg: 'bg-white/5',
        glow: 'rgba(255, 255, 255, 0.2)'
      };
    } else {
      // ACTIVE STATE: Health = stability + performance
      
      // Base stability score (GPU utilization with penalties)
      let stabilityScore = avgGpu;
      const avgLatency = nodes.reduce((acc, n) => acc + n.rdma_latency_us, 0) / nodes.length;
      const latencyPenalty = Math.max(0, (avgLatency - 52) * 4);
      const maxTemp = Math.max(...nodes.map(n => n.temp_c));
      const thermalPenalty = Math.max(0, (maxTemp - 60) * 2.5);
      
      stabilityScore = Math.max(0, Math.min(100, stabilityScore - latencyPenalty - thermalPenalty));
      
      // Performance vs expected baseline (per-node TPS)
      const expectedTpsPerNode = getExpectedTPS(topology);
      const totalTps = activeModels[0].tokPerSec;
      const activeNodeCount = activeNodes.length > 0 ? activeNodes.length : getExpectedActiveNodes(topology);
      const actualTpsPerNode = totalTps / activeNodeCount;
      const performancePct = Math.min(150, (actualTpsPerNode / expectedTpsPerNode) * 100);
      
      // Utilization efficiency (are we using the nodes we have?)
      const utilizationPct = (activeNodes.length / nodes.length) * (avgGpu / 100) * 100;
      
      // Blend: 50% stability + 30% performance + 20% utilization
      fabricHealth = (stabilityScore * 0.5) + (performancePct * 0.3) + (utilizationPct * 0.2);
      fabricHealth = Math.max(0, Math.min(100, fabricHealth));
      
      healthBreakdown = {
        stability: stabilityScore.toFixed(0),
        performance: performancePct.toFixed(0),
        utilization: utilizationPct.toFixed(0),
        latencyPenalty: latencyPenalty.toFixed(0),
        thermalPenalty: thermalPenalty.toFixed(0),
        totalTps: totalTps.toFixed(1),
        activeNodes: activeNodeCount
      };

      // Status based on health and conditions
      if (thermalPenalty > 15) {
        currentStatus = { 
          label: 'Thermal', 
          color: 'text-orange-400', 
          icon: AlertTriangle, 
          bg: 'bg-orange-400/10',
          glow: 'rgba(251, 191, 36, 0.4)'
        };
      } else if (latencyPenalty > 15) {
        currentStatus = { 
          label: 'Congested', 
          color: 'text-cyan-400', 
          icon: Activity, 
          bg: 'bg-cyan-400/10',
          glow: 'rgba(34, 211, 238, 0.4)'
        };
      } else if (fabricHealth >= 80) {
        currentStatus = { 
          label: 'Optimal', 
          color: 'text-emerald-400', 
          icon: ShieldCheck, 
          bg: 'bg-emerald-500/10',
          glow: 'rgba(16, 185, 129, 0.4)'
        };
      } else if (fabricHealth >= 60) {
        currentStatus = { 
          label: 'Nominal', 
          color: 'text-cyan-400', 
          icon: ShieldCheck, 
          bg: 'bg-cyan-500/10',
          glow: 'rgba(34, 211, 238, 0.3)'
        };
      } else {
        currentStatus = { 
          label: 'Degraded', 
          color: 'text-amber-400', 
          icon: AlertTriangle, 
          bg: 'bg-amber-400/10',
          glow: 'rgba(251, 191, 36, 0.3)'
        };
      }
    }

    return {
      stats: {
        ramPct,
        powerPct,
        gpuPct,
        totalPower,
        ramUsedTB,
        ramMaxTB
      },
      health: fabricHealth,
      status: currentStatus,
      breakdown: healthBreakdown,
      isActive: isInferenceActive
    };
  }, [nodes, topology, activeModels]);

  // Ring visual configuration
  const size = 140; // Compact size for overlay
  const center = size / 2;
  const strokeWidth = 10; 
  
  const rings = [
    { 
      pct: stats.gpuPct, 
      radius: 58, 
      color: '#10b981', 
      icon: Cpu, 
      label: 'SOC_UTIL', 
      val: `${stats.gpuPct.toFixed(0)}%` 
    },
    { 
      pct: stats.ramPct, 
      radius: 44, 
      color: '#06b6d4', 
      icon: Database, 
      label: 'VRAM_POOL', 
      val: `${stats.ramUsedTB.toFixed(1)}TB` 
    },
    { 
      pct: stats.powerPct, 
      radius: 30, 
      color: '#eab308', 
      icon: Zap, 
      label: 'PWR_DRAW', 
      val: `${stats.totalPower.toFixed(0)}W` 
    },
  ];

  // Animation class based on activity
  const pulseClass = isActive 
    ? stats.gpuPct > 50 
      ? 'animate-pulse-fast' 
      : 'animate-pulse-slow'
    : '';

  return (
    <div 
      className="relative group cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onOpenDetailed();
      }}
    >
      {/* Main Ring SVG */}
      <svg 
        width={size} 
        height={size} 
        className={`transform -rotate-90 transition-all duration-500 ${pulseClass}`}
        style={{
          filter: `drop-shadow(0 0 20px ${status.glow})`
        }}
      >
        {/* Background rings */}
        {rings.map((ring, i) => (
          <circle
            key={`bg-${i}`}
            cx={center}
            cy={center}
            r={ring.radius}
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={strokeWidth}
          />
        ))}
        
        {/* Foreground rings (progress) */}
        {rings.map((ring, i) => {
          const circumference = 2 * Math.PI * ring.radius;
          const offset = circumference - (ring.pct / 100) * circumference;
          return (
            <circle
              key={`fg-${i}`}
              cx={center}
              cy={center}
              r={ring.radius}
              fill="none"
              stroke={ring.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{ 
                strokeDashoffset: offset,
                filter: `drop-shadow(0 0 8px ${ring.color}99)`,
                transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          );
        })}
      </svg>

      {/* Center content - Fabric Health */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-0.5">
          Fabric
        </span>
        <span 
          className="text-3xl font-black text-white font-mono leading-none tracking-tighter transition-all duration-500"
          style={{
            textShadow: `0 0 15px ${status.glow}`
          }}
        >
          {health.toFixed(0)}
        </span>
        <div className={`mt-1.5 px-2 py-0.5 rounded-full border border-white/5 flex items-center gap-1 ${status.bg}`}>
          <status.icon className={`w-2.5 h-2.5 ${status.color}`} />
          <span className={`text-[10px] font-mono ${status.color} font-black uppercase tracking-wider`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        <div className="bg-black/95 border border-white/20 rounded-xl p-4 shadow-2xl min-w-[240px]">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3">
            Cluster Metrics
          </div>
          
          {/* Metric Cards */}
          <div className="space-y-2">
            {rings.map((ring, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ring.icon className="w-3 h-3" style={{ color: ring.color }} />
                  <span className="text-[10px] font-mono text-white/60 uppercase tracking-wider">
                    {ring.label}
                  </span>
                </div>
                <span className="text-[10px] font-black font-mono text-white">
                  {ring.val}
                </span>
              </div>
            ))}
          </div>

          {/* Health Breakdown */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2">
              Health Breakdown
            </div>
            <div className="space-y-1.5">
              {isActive ? (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40 font-mono">Stability</span>
                    <span className="text-white/80 font-mono font-black">{breakdown.stability}%</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40 font-mono">Performance</span>
                    <span className="text-white/80 font-mono font-black">{breakdown.performance}%</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40 font-mono">Utilization</span>
                    <span className="text-white/80 font-mono font-black">{breakdown.utilization}%</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40 font-mono">TPS</span>
                    <span className="text-emerald-400 font-mono font-black">{breakdown.totalTps}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40 font-mono">Idle Efficiency</span>
                    <span className="text-white/80 font-mono font-black">{breakdown.idleEfficiency}%</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/40 font-mono">Avg Power/Node</span>
                    <span className="text-white/80 font-mono font-black">{breakdown.avgPowerPerNode}W</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/10">
            <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider text-center">
              Click for Diagnostics HUD
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Get expected TPS per node for a given topology (baseline for performance calculation)
 */
function getExpectedTPS(topology: string): number {
  // Baselines from benchmark data (see CLUSTER_METRICS_RING_DESIGN.md)
  const baselines: Record<string, number> = {
    'PP5': 3.04,
    'TP2': 7.0,
    'TP4': 4.5,
    'TP5': 3.5,
    'SOLO': 2.0
  };
  return baselines[topology] || 5.0; // Default fallback
}

/**
 * Get expected number of active nodes for a given topology
 */
function getExpectedActiveNodes(topology: string): number {
  const counts: Record<string, number> = {
    'PP5': 5,
    'TP2': 2,
    'TP4': 4,
    'TP5': 5,
    'SOLO': 1
  };
  return counts[topology] || 5;
}

export default ClusterMetricsRing;
