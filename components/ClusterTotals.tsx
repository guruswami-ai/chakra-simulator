
import React, { useMemo } from 'react';
import { NodeMetrics } from '../types';
import { Database, Zap, Cpu, Activity, BarChart2, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ClusterTotalsProps {
  nodes: NodeMetrics[];
  onOpenDetailed: () => void;
}

const ClusterTotals: React.FC<ClusterTotalsProps> = ({ nodes, onOpenDetailed }) => {
  const { stats, health, status } = useMemo(() => {
    const totalRamUsed = nodes.reduce((acc, n) => acc + n.ram_used, 0);
    const totalRamMax = nodes.reduce((acc, n) => acc + n.ram_total, 0);
    const totalPower = nodes.reduce((acc, n) => acc + n.power_w, 0);
    const activeNodes = nodes.filter(n => n.tok_per_sec > 0);
    const avgGpu = activeNodes.length > 0 
      ? activeNodes.reduce((acc, n) => acc + n.gpu_util, 0) / activeNodes.length 
      : 0;
    
    const ramUsedTB = totalRamUsed / 1024;
    const ramMaxTB = totalRamMax / 1024;

    let healthScore = avgGpu;
    const avgLatency = nodes.reduce((acc, n) => acc + n.rdma_latency_us, 0) / nodes.length;
    const latencyPenalty = Math.max(0, (avgLatency - 52) * 4);
    const maxTemp = Math.max(...nodes.map(n => n.temp_c));
    const thermalPenalty = Math.max(0, (maxTemp - 60) * 2.5);

    const finalHealth = Math.max(0, Math.min(100, healthScore - latencyPenalty - thermalPenalty));

    let currentStatus = { label: 'Nominal', color: 'text-emerald-400', icon: ShieldCheck, bg: 'bg-emerald-500/10' };
    if (thermalPenalty > 15) {
      currentStatus = { label: 'Thermal', color: 'text-orange-400', icon: AlertTriangle, bg: 'bg-orange-400/10' };
    } else if (latencyPenalty > 15) {
      currentStatus = { label: 'Congested', color: 'text-cyan-400', icon: Activity, bg: 'bg-cyan-400/10' };
    } else if (finalHealth < 20 && avgGpu < 10) {
      currentStatus = { label: 'Standby', color: 'text-white/40', icon: ShieldAlert, bg: 'bg-white/5' };
    }

    return {
      stats: {
        ramPct: (totalRamUsed / totalRamMax) * 100,
        powerPct: (totalPower / 2400) * 100,
        gpuPct: avgGpu,
        totalPower,
        ramUsedTB,
        ramMaxTB
      },
      health: finalHealth,
      status: currentStatus
    };
  }, [nodes]);

  const size = 200; 
  const center = size / 2;
  const strokeWidth = 14; 
  
  const rings = [
    { pct: stats.gpuPct, radius: 82, color: '#10b981', icon: Cpu, label: 'SOC_UTIL', val: `${stats.gpuPct.toFixed(0)}%`, sub: 'Active Load' },
    { pct: stats.ramPct, radius: 64, color: '#06b6d4', icon: Database, label: 'VRAM_POOL', val: `${stats.ramUsedTB.toFixed(1)}TB`, sub: `${stats.ramMaxTB.toFixed(1)}TB Pool` },
    { pct: stats.powerPct, radius: 46, color: '#eab308', icon: Zap, label: 'PWR_DRAW', val: `${stats.totalPower.toFixed(0)}W`, sub: 'Aggregate' },
  ];

  return (
    <div className="chakra-panel p-8 rounded-[3rem] flex flex-col gap-8 w-full flex-shrink-0 pointer-events-auto border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
      {/* HEADER */}
      <div className="flex items-center justify-between w-full px-2">
        <div className="flex flex-col">
          <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-white/50 flex items-center gap-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            Cluster Metrics
          </h3>
          <span className="text-[10px] font-mono text-emerald-400/40 uppercase mt-1 tracking-widest font-black">Fabric Telemetry V5.6</span>
        </div>
        <button 
          onClick={onOpenDetailed}
          className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
        >
          <BarChart2 className="w-4.5 h-4.5 text-white/30 group-hover:text-white" />
        </button>
      </div>

      {/* MAIN CONTENT - LANDSCAPE SPLIT */}
      <div className="flex flex-row items-center gap-10">
        
        {/* LEFT: HERO GAUGE */}
        <div className="relative flex-shrink-0 flex items-center justify-center w-[200px] h-[200px]">
          <svg width={size} height={size} className="transform -rotate-90 filter drop-shadow-[0_0_20px_rgba(0,0,0,0.4)]">
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
                    filter: `drop-shadow(0 0 10px ${ring.color}66)`,
                    transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-1">Stability</span>
            <span className="text-5xl font-black text-white font-mono leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              {health.toFixed(0)}
            </span>
            <div className={`mt-3 px-3 py-1 rounded-full border border-white/5 flex items-center gap-2 ${status.bg}`}>
               <status.icon className={`w-3 h-3 ${status.color}`} />
               <span className={`text-[10px] font-mono ${status.color} font-black uppercase tracking-widest`}>
                  {status.label}
               </span>
            </div>
          </div>
        </div>

        {/* RIGHT: METRIC CARDS - VERTICAL STACK */}
        <div className="flex flex-col gap-4 flex-1">
          {rings.map((ring, i) => (
            <div key={`card-${i}`} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-white/[0.08] transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 transition-transform group-hover:scale-110">
                  <ring.icon className="w-4 h-4" style={{ color: ring.color }} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1.5">
                    {ring.label}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black font-mono tabular-nums text-white">
                      {ring.val}
                    </span>
                    <span className="text-[10px] font-mono text-white/20 uppercase font-black tracking-tighter">
                      {ring.sub}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-black font-mono text-white/60">
                  {ring.pct.toFixed(0)}%
                </span>
                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-1000" 
                    style={{ width: `${ring.pct}%`, backgroundColor: ring.color, boxShadow: `0 0 8px ${ring.color}` }} 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER ACTION */}
      <button 
        onClick={onOpenDetailed}
        className="w-full py-4 bg-white/[0.04] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:bg-white/10 hover:text-white transition-all font-mono flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg"
      >
        <ShieldCheck className="w-4 h-4" />
        Diagnostics_Report_v5.6
      </button>
    </div>
  );
};

export default ClusterTotals;
