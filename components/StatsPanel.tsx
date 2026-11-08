
import React from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { HistoryPoint, NodeMetrics, ModelInstance, ClusterMode } from '../types';
import ModelDeploymentCard from './ModelDeploymentCard';
import ConceptHelper from './ConceptHelper';
import { Activity, BarChart2, Box, Layers, Database, ExternalLink, TrendingUp, Server } from 'lucide-react';

interface StatsPanelProps {
  history: HistoryPoint[];
  nodes: NodeMetrics[];
  activeModels: ModelInstance[];
  topology: ClusterMode;
}

const CustomTick = (props: any) => {
  const { x, y, payload, nodes } = props;
  const node = nodes.find((n: any) => n.name === payload.value);
  if (!node) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx="0" cy="12" r="3" fill={node.color} />
      <text
        x="0"
        y="28"
        textAnchor="middle"
        fill="white"
        className="text-[10px] font-mono font-black uppercase tracking-widest opacity-60"
      >
        {node.name}
      </text>
      <text
        x="0"
        y="42"
        textAnchor="middle"
        fill={node.color}
        className="text-[10px] font-mono font-black tabular-nums"
      >
        {node.kv_cache_pct.toFixed(0)}%
      </text>
    </g>
  );
};

const StatsPanel: React.FC<StatsPanelProps> = ({ history, nodes, activeModels, topology }) => {
  // Determine if we have multiple distinct model groups
  const hasMultipleModels = activeModels.length > 1;

  return (
    <div className="flex flex-col gap-10">

      {/* 1. MONITORING SECTION (PRIORITY 1) */}
      <section className="chakra-panel p-10 rounded-[3.5rem] order-first">
        <div className="space-y-10">
          {/* TPS History */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50 flex items-center gap-3">
                <Activity className="w-5 h-5 text-emerald-500" />
                Flow Rate (T/S)
                <ConceptHelper sectionId="tps-ttft" label="Throughput" />
              </h2>
            </div>
            <div className="h-36 w-full bg-black/40 rounded-[2rem] p-5 border border-white/5 shadow-inner">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorTps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 900, fontFamily: 'Source Code Pro' }}
                    tickFormatter={(val) => val.toFixed(1)}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0c0c0c', border: '1px solid #333', borderRadius: '16px', fontSize: '12px', padding: '12px' }}
                    itemStyle={{ color: '#10b981', fontWeight: 900 }}
                    formatter={(val: any) => [`${parseFloat(val).toFixed(1)} tps`, 'TPS']}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokPerSec"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTps)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Deployments - Unified model + topology cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50 flex items-center gap-2">
                <Server className="w-4 h-4 text-purple-500" />
                Active Deployments
                <ConceptHelper sectionId="mesh-ring" label="TP vs PP" />
              </h2>
              <span className="text-[10px] font-mono text-purple-400/60 font-black uppercase tracking-wider">
                {activeModels.length > 0 ? `${activeModels.length} Running` : 'Idle'}
              </span>
            </div>

            {activeModels.length === 0 ? (
              <div className="chakra-panel rounded-[2rem] p-8 text-center">
                <div className="text-white/20 text-sm font-mono font-black uppercase tracking-widest mb-2">
                  No Model Deployed
                </div>
                <div className="text-white/10 text-xs font-mono">
                  Start an inference server to see deployment metrics
                </div>
              </div>
            ) : (
              activeModels.map((model) => (
                <ModelDeploymentCard
                  key={model.id}
                  model={model}
                  compact={hasMultipleModels}
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* 3. KV PRESSURE (FOOTER ANALYTICS) */}
      <section className="chakra-panel p-10 rounded-[3.5rem]">
        <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-8 flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-purple-500" />
            VRAM Cache Pressure
            <ConceptHelper sectionId="kv-cache" label="KV Pressure" />
          </h2>
          <div className="h-44 w-full bg-black/30 rounded-[2rem] p-6 border border-white/5 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nodes} margin={{ top: 5, right: 10, left: 10, bottom: 45 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  interval={0}
                  tick={<CustomTick nodes={nodes} />}
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0c0c0c', border: '1px solid #333', borderRadius: '16px', fontSize: '11px', fontWeight: 900 }}
                  itemStyle={{ color: '#a855f7' }}
                  formatter={(val: any) => [`${parseFloat(val).toFixed(1)}%`, 'Pressure']}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  labelStyle={{ display: 'none' }}
                />
                <Bar dataKey="kv_cache_pct" radius={[8, 8, 0, 0]} barSize={44} animationDuration={600}>
                  {nodes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} stroke={entry.color} strokeWidth={2} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StatsPanel;
