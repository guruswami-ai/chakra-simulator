
import React, { useMemo } from 'react';
import { X, Activity, Server, Cpu, Database, Network, TrendingUp, BarChart, Scale, Zap, Info, Thermometer, ShieldCheck, Calculator, AlertTriangle, ShieldAlert, BarChart2, Layers, Box } from 'lucide-react';
import { ClusterState, ModelInstance } from '../types';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Cell } from 'recharts';
import ModelDeploymentCard from './ModelDeploymentCard';
import ConceptHelper from './ConceptHelper';

interface ClusterDetailedViewProps {
  state: ClusterState;
  onClose: () => void;
  // Migrated panel data
  labPerplexity?: number;
  labQuantization?: string;
  weightsPerNode?: number;
  kvCachePerNode?: number;
  freePerNode?: number;
  modelLayers?: number;
  modelArchitecture?: 'dense' | 'moe';
  estimatedTps?: number;
  estimatedTtft?: number;
  modelName?: string;
  isLive?: boolean;
}

const ClusterDetailedView: React.FC<ClusterDetailedViewProps> = ({
  state,
  onClose,
  labPerplexity,
  labQuantization,
  weightsPerNode,
  kvCachePerNode,
  freePerNode,
  modelLayers,
  modelArchitecture,
  estimatedTps,
  estimatedTtft,
  modelName,
  isLive,
}) => {
  const { nodes, history, activeModels, globalTopology } = state;

  const metrics = useMemo(() => {
    const totalTps = nodes.reduce((acc, n) => acc + n.tok_per_sec, 0);
    const avgTpsPerNode = nodes.length > 0 ? totalTps / nodes.length : 0;
    const peakPower = Math.max(...nodes.map(n => n.power_w));
    const avgKv = nodes.reduce((acc, n) => acc + n.kv_cache_pct, 0) / nodes.length;

    // Baseline efficiency (assuming PP5 as baseline of 3.04 tok/s/node)
    const baseline = 3.04;
    const relativeEfficiency = (avgTpsPerNode / baseline) * 100;

    return {
      totalTps,
      avgTpsPerNode,
      peakPower,
      avgKv,
      relativeEfficiency
    };
  }, [nodes]);

  // Intelligence mood for Model Quality section
  const intelligenceMood = useMemo(() => {
    if (labPerplexity === undefined) return null;
    if (labPerplexity < 3) return 'genius';
    if (labPerplexity < 6) return 'smart';
    if (labPerplexity < 15) return 'average';
    if (labPerplexity < 30) return 'struggling';
    return 'confused';
  }, [labPerplexity]);

  const qualityPct = labPerplexity !== undefined
    ? Math.max(0, Math.min(100, (1 - (labPerplexity - 1) / 49) * 100))
    : 0;

  const qualityColor = intelligenceMood === 'genius' ? 'text-violet-400' :
    intelligenceMood === 'smart' ? 'text-emerald-400' :
    intelligenceMood === 'average' ? 'text-blue-400' :
    intelligenceMood === 'struggling' ? 'text-amber-400' :
    intelligenceMood === 'confused' ? 'text-red-400' : 'text-white/40';

  const qualityBarGradient = intelligenceMood === 'genius' ? 'from-violet-500 to-purple-500' :
    intelligenceMood === 'smart' ? 'from-emerald-500 to-green-500' :
    intelligenceMood === 'average' ? 'from-blue-500 to-indigo-500' :
    intelligenceMood === 'struggling' ? 'from-amber-500 to-yellow-500' :
    'from-red-500 to-rose-500';

  return (
    <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/95 animate-in fade-in duration-300 overflow-hidden">
      <div className="relative w-[96%] h-[92vh] bg-[#050505] border border-white/10 rounded-[4rem] shadow-[0_0_200px_rgba(0,0,0,1)] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="h-32 border-b border-white/5 flex items-center justify-between px-16 bg-white/[0.02]">
          <div className="flex items-center gap-10">
            <div className="w-20 h-20 rounded-[2rem] bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.1)]">
              <Activity className="w-10 h-10 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white font-orbitron">Cluster Diagnostics HUD</h2>
              <div className="text-xs font-mono text-white/40 uppercase mt-3 tracking-[0.3em] font-black flex items-center gap-4">
                Session: {globalTopology} <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Fabric Link: TB5 RDMA <span className="w-1 h-1 rounded-full bg-emerald-500" />
                Internal Spec: M3 Ultra (5×)
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-6 bg-white/5 hover:bg-red-500/20 hover:border-red-500/50 border border-white/10 rounded-[2.5rem] transition-all group"
          >
            <X className="w-10 h-10 text-white/40 group-hover:text-red-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-20 flex flex-col gap-24 custom-scrollbar scroll-smooth">

          {/* ══════════════════════════════════════════════════════════════
              NEW: Estimated Performance + Flow Rate
              ══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-12 gap-12">
            {/* Estimated Performance */}
            <div className="col-span-5 bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex flex-col gap-8">
              <div className="flex items-center gap-4 text-emerald-400">
                <TrendingUp className="w-8 h-8" />
                <h3 className="text-xl font-black uppercase tracking-widest">
                  {isLive ? 'Live' : 'Estimated'} Performance
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Throughput</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono text-emerald-400 tabular-nums">
                      {(estimatedTps ?? metrics.totalTps).toFixed(1)}
                    </span>
                    <span className="text-sm font-mono font-black text-white/30">T/s</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Time to First Token</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono text-cyan-400 tabular-nums">
                      {(estimatedTtft ?? 0).toFixed(2)}
                    </span>
                    <span className="text-sm font-mono font-black text-white/30">s</span>
                  </div>
                </div>
              </div>
              {modelName && (
                <div className="pt-6 border-t border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Model</span>
                  <div className="text-sm font-mono font-bold text-white/60 mt-1">{modelName}</div>
                  <div className="flex gap-3 mt-2">
                    {labQuantization && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        {labQuantization}
                      </span>
                    )}
                    {modelArchitecture && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 uppercase">
                        {modelArchitecture}
                      </span>
                    )}
                    {modelLayers && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-white/50">
                        {modelLayers}L
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Flow Rate Chart (full size) */}
            <div className="col-span-7 bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex flex-col gap-6">
              <div className="flex items-center gap-4 text-emerald-400">
                <Activity className="w-8 h-8" />
                <h3 className="text-xl font-black uppercase tracking-widest">Flow Rate (T/S)</h3>
                <ConceptHelper sectionId="tps-ttft" label="Throughput" />
              </div>
              <div className="flex-1 min-h-[200px] bg-black/40 rounded-[2rem] p-5 border border-white/5 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="detailColorTps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 900, fontFamily: 'Source Code Pro' }}
                      tickFormatter={(val: number) => val.toFixed(1)}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0c0c0c', border: '1px solid #333', borderRadius: '16px', fontSize: '12px', padding: '12px' }}
                      itemStyle={{ color: '#10b981', fontWeight: 900 }}
                      formatter={(val: number) => [`${val.toFixed(1)} tps`, 'TPS']}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokPerSec"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#detailColorTps)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              NEW: Active Deployments + VRAM Cache Pressure
              ══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-2 gap-20">
            {/* Active Deployments */}
            <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-purple-400">
                  <Server className="w-8 h-8" />
                  <h3 className="text-xl font-black uppercase tracking-widest">Active Deployments</h3>
                  <ConceptHelper sectionId="mesh-ring" label="TP vs PP" />
                </div>
                <span className="text-[10px] font-mono text-purple-400/60 font-black uppercase tracking-wider">
                  {activeModels.length > 0 ? `${activeModels.length} Running` : 'Idle'}
                </span>
              </div>
              {activeModels.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="text-white/20 text-sm font-mono font-black uppercase tracking-widest mb-2">
                      No Model Deployed
                    </div>
                    <div className="text-white/10 text-xs font-mono">
                      Start an inference server to see deployment metrics
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {activeModels.map((model) => (
                    <ModelDeploymentCard key={model.id} model={model} compact={activeModels.length > 1} />
                  ))}
                </div>
              )}
            </div>

            {/* VRAM Cache Pressure */}
            <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex flex-col gap-6">
              <div className="flex items-center gap-4 text-purple-400">
                <BarChart2 className="w-8 h-8" />
                <h3 className="text-xl font-black uppercase tracking-widest">VRAM Cache Pressure</h3>
                <ConceptHelper sectionId="kv-cache" label="KV Pressure" />
              </div>
              <div className="flex-1 min-h-[200px] bg-black/30 rounded-[2rem] p-6 border border-white/5 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={nodes} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900 }}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0c0c0c', border: '1px solid #333', borderRadius: '16px', fontSize: '11px', fontWeight: 900 }}
                      itemStyle={{ color: '#a855f7' }}
                      formatter={(val: number) => [`${val.toFixed(1)}%`, 'Pressure']}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Bar dataKey="kv_cache_pct" radius={[8, 8, 0, 0]} barSize={44} animationDuration={600}>
                      {nodes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} stroke={entry.color} strokeWidth={2} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              NEW: Model Quality + Node Memory
              ══════════════════════════════════════════════════════════════ */}
          {(labPerplexity !== undefined || (weightsPerNode !== undefined && weightsPerNode > 0)) && (
            <section className="grid grid-cols-2 gap-20">
              {/* Model Quality */}
              {labPerplexity !== undefined && (
                <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-violet-400">
                      <Zap className="w-8 h-8" />
                      <h3 className="text-xl font-black uppercase tracking-widest">Model Quality</h3>
                    </div>
                    {labQuantization && (
                      <span className="text-[11px] font-mono font-bold px-3 py-1 rounded-full bg-violet-500/20 text-violet-300">
                        {labQuantization}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <span className={`text-5xl font-black font-mono tabular-nums ${qualityColor}`}>
                        {labPerplexity.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono text-white/40 uppercase">PPL</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] font-mono text-white/30 mb-1">
                        <span>CHAOS</span>
                        <span>FUZZY</span>
                        <span>OK</span>
                        <span>SHARP</span>
                        <span>GENIUS</span>
                      </div>
                      <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full bg-gradient-to-r ${qualityBarGradient}`}
                          style={{ width: `${qualityPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-white/20 mt-1">
                        <span>50+</span>
                        <span>30</span>
                        <span>15</span>
                        <span>5</span>
                        <span>1</span>
                      </div>
                    </div>
                  </div>

                  <div className={`px-4 py-2 rounded-2xl border ${
                    intelligenceMood === 'genius' ? 'bg-violet-500/10 border-violet-500/20' :
                    intelligenceMood === 'smart' ? 'bg-emerald-500/10 border-emerald-500/20' :
                    intelligenceMood === 'average' ? 'bg-blue-500/10 border-blue-500/20' :
                    intelligenceMood === 'struggling' ? 'bg-amber-500/10 border-amber-500/20' :
                    'bg-red-500/10 border-red-500/20'
                  }`}>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${qualityColor}`}>
                      {intelligenceMood === 'genius' ? 'GENIUS MODE — Crystal clear reasoning' :
                       intelligenceMood === 'smart' ? 'SHARP — Strong logical coherence' :
                       intelligenceMood === 'average' ? 'THINKING — Adequate token predictions' :
                       intelligenceMood === 'struggling' ? 'STRUGGLING — Noticeable quality loss' :
                       'CONFUSED — Significant degradation from quantization'}
                    </span>
                  </div>
                </div>
              )}

              {/* Node Memory */}
              {weightsPerNode !== undefined && weightsPerNode > 0 && (
                <div className={`bg-white/[0.03] border rounded-[3rem] p-10 flex flex-col gap-6 ${
                  freePerNode !== undefined && freePerNode <= 0
                    ? 'border-red-500/50'
                    : freePerNode !== undefined && freePerNode < 25
                    ? 'border-amber-500/30'
                    : 'border-white/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-cyan-400">
                      <Database className="w-8 h-8" />
                      <h3 className="text-xl font-black uppercase tracking-widest">Node Memory</h3>
                    </div>
                    <span className="text-sm font-mono font-bold text-white/50">
                      {Math.round((weightsPerNode || 0) + (kvCachePerNode || 0))}/512 GB
                      {freePerNode !== undefined && freePerNode <= 0 && (
                        <span className="ml-2 text-xs font-black text-red-400 bg-red-500/20 px-2 py-0.5 rounded-full animate-pulse">
                          OOM
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Large stacked bar */}
                  <div className="w-full h-8 bg-white/10 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (weightsPerNode / 512) * 100)}%` }}
                    />
                    <div
                      className="h-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${Math.min(100 - (weightsPerNode / 512) * 100, (kvCachePerNode || 0) / 512 * 100)}%` }}
                    />
                  </div>

                  {/* Legend */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-cyan-500 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-mono font-bold text-cyan-400">{weightsPerNode.toFixed(1)} GB</span>
                        <div className="text-[10px] font-mono text-white/30">Weights</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-purple-500 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-mono font-bold text-purple-400">{(kvCachePerNode || 0) < 1 && (kvCachePerNode || 0) >= 0.01 ? `${Math.round((kvCachePerNode || 0) * 1024)} MB` : `${(kvCachePerNode || 0).toFixed(1)} GB`}</span>
                        <div className="text-[10px] font-mono text-white/30">KV Cache</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded flex-shrink-0 ${
                        freePerNode !== undefined && freePerNode < 25 ? 'bg-amber-500 animate-pulse' : 'bg-white/20'
                      }`} />
                      <div>
                        <span className={`text-sm font-mono font-bold ${
                          freePerNode !== undefined && freePerNode <= 0 ? 'text-red-400' :
                          freePerNode !== undefined && freePerNode < 25 ? 'text-amber-400' :
                          'text-white/40'
                        }`}>
                          {freePerNode !== undefined ? freePerNode.toFixed(0) : 0} GB
                        </span>
                        <div className={`text-[10px] font-mono ${
                          freePerNode !== undefined && freePerNode < 25 ? 'text-amber-400/60' : 'text-white/30'
                        }`}>
                          {freePerNode !== undefined && freePerNode < 25 ? 'Free — LOW' : 'Free'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════
              EXISTING: Composite Stability Index
              ══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-12 gap-12">
            <div className="col-span-4 bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex flex-col gap-8">
              <div className="flex items-center gap-4 text-emerald-400">
                <Calculator className="w-8 h-8" />
                <h3 className="text-xl font-black uppercase tracking-widest">Composite Stability Index</h3>
              </div>
              <div className="space-y-6">
                <p className="text-xs text-white/40 leading-relaxed font-bold uppercase tracking-widest">
                  The central Health metric is a non-linear stability score calculating real-time inference viability.
                </p>
                <div className="p-6 bg-black/40 rounded-2xl border border-white/5 font-mono text-sm">
                  <div className="text-emerald-400 mb-2 font-black">Score = Base Load</div>
                  <div className="text-red-400 mb-2">- Fabric Latency Penalty</div>
                  <div className="text-orange-400 mb-2">- Thermal Throttling Risk</div>
                  <div className="h-px bg-white/10 my-4" />
                  <div className="text-white font-black text-center">Output: 0 - 100%</div>
                </div>
              </div>
            </div>

            <div className="col-span-8 grid grid-cols-3 gap-8">
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-4">
                <div className="flex items-center gap-3 text-emerald-500">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Base Weight (80%)</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">Derived from GPU compute utilization. High scores indicate the cluster is successfully processing matrix multiplications at target clock speeds.</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-4">
                <div className="flex items-center gap-3 text-cyan-500">
                  <Activity className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Latency Floor (52μs)</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">We deduct 4 points for every microsecond above the 52μs baseline. Crossing this threshold indicates TB5 RDMA buffer congestion.</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-4">
                <div className="flex items-center gap-3 text-orange-500">
                  <Thermometer className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Thermal Ceiling (60°C)</span>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">Aggressive deduction begins at 60°C. M3 Ultra SOCs are most efficient under 65°C; exceeding this triggers fan RPM ramp-up.</p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              EXISTING: Live Node Telemetry (absorbs Fabric_Health_Telemetry / NodePanel)
              ══════════════════════════════════════════════════════════════ */}
          <section>
             <div className="flex items-center justify-between mb-12 px-2">
                <div className="flex items-center gap-6">
                  <BarChart className="w-8 h-8 text-cyan-400" />
                  <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white">Live Node Telemetry</h3>
                </div>
             </div>
             <div className="overflow-hidden border border-white/10 rounded-[3rem] bg-white/[0.02] shadow-2xl">
                <table className="w-full text-left border-collapse font-mono">
                   <thead>
                      <tr className="bg-white/5">
                        <th className="p-8 text-xs font-black uppercase text-white/40 tracking-[0.3em]">Node ID</th>
                        <th className="p-8 text-xs font-black uppercase text-white/40 tracking-[0.3em]">Status</th>
                        <th className="p-8 text-xs font-black uppercase text-white/40 tracking-[0.3em] text-center">Throughput</th>
                        <th className="p-8 text-xs font-black uppercase text-white/40 tracking-[0.3em] text-center">SoC Load</th>
                        <th className="p-8 text-xs font-black uppercase text-white/40 tracking-[0.3em] text-center">Temp</th>
                        <th className="p-8 text-xs font-black uppercase text-white/40 tracking-[0.3em] text-center">VRAM (TB)</th>
                        <th className="p-8 text-xs font-black uppercase text-white/40 tracking-[0.3em] text-center">Latency</th>
                      </tr>
                   </thead>
                   <tbody className="text-sm font-black text-white/60">
                      {nodes.map((node) => (
                        <tr key={node.id} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors group">
                          <td className="p-8">
                            <div className="flex items-center gap-4">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: node.color }} />
                              <span className="text-white uppercase font-black">{node.name}</span>
                            </div>
                          </td>
                          <td className="p-8 text-white/40 uppercase">
                             {node.tok_per_sec > 0.1 ? 'Active_Compute' : 'Vigilant_Idle'}
                          </td>
                          <td className="p-8 text-center tabular-nums text-emerald-400 font-black">
                            {node.tok_per_sec.toFixed(2)} <span className="text-[10px] opacity-40">T/S</span>
                          </td>
                          <td className="p-8 text-center tabular-nums">
                            {node.gpu_util.toFixed(0)}%
                          </td>
                          <td className="p-8 text-center tabular-nums text-red-400">
                            {node.temp_c.toFixed(0)}°C
                          </td>
                          <td className="p-8 text-center tabular-nums text-cyan-400">
                            {(node.ram_used / 1024).toFixed(3)} TB
                          </td>
                          <td className="p-8 text-center tabular-nums text-purple-400">
                            {node.rdma_latency_us.toFixed(0)}μs
                          </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              EXISTING: VRAM & KV Cache Logic + Fabric Efficiency
              ══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 gap-20">
             <section>
                <div className="flex items-center gap-6 mb-12">
                   <Database className="w-8 h-8 text-cyan-400" />
                   <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white">VRAM & KV Cache Logic</h3>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 space-y-12">
                   <p className="text-xs text-white/40 leading-relaxed font-bold uppercase tracking-widest">
                     Critical Monitoring of KV Cache (Key-Value Cache) is vital for multi-user inference. The cluster uses MLA (Multi-Head Latent Attention) to significantly compress the memory footprint of long context windows (128K).
                   </p>
                   <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-4">
                         <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-white/40">
                            <span>Aggregate KV Saturation</span>
                            <span className="text-cyan-400">{metrics.avgKv.toFixed(1)}%</span>
                         </div>
                         <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.4)]" style={{ width: `${metrics.avgKv}%` }} />
                         </div>
                      </div>
                      <div className="space-y-4">
                         <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest text-white/40">
                            <span>MLA Compression Ratio</span>
                            <span className="text-emerald-400">8:1 Target</span>
                         </div>
                         <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/60" style={{ width: `100%` }} />
                         </div>
                      </div>
                   </div>

                   <div className="p-8 bg-black/40 border border-white/5 rounded-[2.5rem]">
                      <div className="flex items-center gap-4 mb-4 text-cyan-400">
                         <Info className="w-6 h-6" />
                         <span className="text-sm font-black uppercase tracking-[0.2em]">Context Strategy Verified</span>
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed italic font-bold uppercase tracking-widest">
                         Context remains stable. Automatic cache eviction is currently disabled as current utilization (avg {metrics.avgKv.toFixed(0)}%) remains well below the OOM threshold of 92%.
                      </p>
                   </div>
                </div>
             </section>

             <section>
                <div className="flex items-center gap-6 mb-12">
                   <Scale className="w-8 h-8 text-emerald-400" />
                   <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white">Fabric Efficiency</h3>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-10 flex flex-col justify-center gap-12">
                   <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                         <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Tok/s per Node</span>
                         <span className="text-5xl font-black font-mono text-white tabular-nums">{metrics.avgTpsPerNode.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                         <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Relative Performance</span>
                         <span className={`text-5xl font-black font-mono tabular-nums ${metrics.relativeEfficiency > 100 ? 'text-emerald-400' : 'text-white/60'}`}>
                            {metrics.relativeEfficiency.toFixed(0)}%
                         </span>
                      </div>
                   </div>

                   <div className="pt-10 border-t border-white/5 grid grid-cols-2 gap-8">
                      <div className="flex flex-col gap-1">
                         <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Mode Efficiency Target</span>
                         <span className="text-xs font-bold text-cyan-400 font-mono">
                           {globalTopology === 'HYBRID_TP4' ? '4.00 T/S/NODE' : '3.04 T/S/NODE'}
                         </span>
                      </div>
                      <div className="flex flex-col gap-1">
                         <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Compute Overhead</span>
                         <span className="text-xs font-bold text-red-500 font-mono">
                            {((1 - (metrics.avgTpsPerNode / 7.39)) * 100).toFixed(1)}% Synchronization Tax
                         </span>
                      </div>
                   </div>
                </div>
             </section>
          </div>

          <div className="h-20" />
        </div>
      </div>
    </div>
  );
};

export default ClusterDetailedView;
