
import React from 'react';
import { NodeMetrics, ModelInstance } from '../types';
import { Thermometer, Zap, Network } from 'lucide-react';
import { CHAKRA_SYMBOLS } from '../constants';

interface NodePanelProps {
  nodes: NodeMetrics[];
  activeModels: ModelInstance[];
}

const NodePanel: React.FC<NodePanelProps> = ({ nodes, activeModels }) => {
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="grid grid-cols-1 gap-4">
        {nodes.map((node) => {
          const model = activeModels.find(m => m.id === node.assignedModelId);
          const color = node.color;
          const ramPct = (node.ram_used / node.ram_total) * 100;
          
          return (
            <div 
              key={node.id} 
              className="chakra-panel group relative rounded-[2rem] p-6 hover:bg-white/[0.08] transition-all duration-300"
            >
              <div 
                className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[2rem] transition-all duration-500" 
                style={{ backgroundColor: color }} 
              />

              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  {/* Chakra Symbol */}
                  <div
                    className="w-12 h-12 flex-shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
                    style={{ color }}
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_currentColor]">
                      {CHAKRA_SYMBOLS[node.name.toLowerCase()]}
                    </svg>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-black text-white uppercase tracking-tight">
                        {node.name}
                      </span>
                      <span className="text-[10px] font-mono text-white/50 font-black tracking-[0.2em] uppercase bg-white/10 px-2.5 py-1 rounded-lg">
                        SHARD_0{node.index + 1}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-black text-white/30 uppercase tracking-[0.2em] truncate max-w-[200px]">
                      {model?.name || 'IDLE_VIGILANT'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2.5 text-emerald-400 font-black">
                    <span className="text-3xl font-mono tabular-nums leading-none">{node.tok_per_sec.toFixed(1)}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-60">T/S</span>
                  </div>
                </div>
              </div>

              {/* Triple Grid Metrics */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] font-black">
                    <span>SoC Load</span>
                    <span className="text-white/80">{node.gpu_util.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500/50" style={{ width: `${node.gpu_util}%` }} />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] font-black">
                    <span>Unified RAM</span>
                    <span className="text-white/80">{ramPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500/50" style={{ width: `${ramPct}%` }} />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] font-black">
                    <span>KV Cache</span>
                    <span className="text-cyan-400 font-black">{node.kv_cache_pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500/50" style={{ width: `${node.kv_cache_pct}%` }} />
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono font-black uppercase tracking-[0.2em] text-white/30">
                <div className="flex gap-6">
                  <span className="flex items-center gap-2.5 bg-white/5 px-3 py-1.5 rounded-xl"><Zap className="w-4 h-4 text-yellow-500/60" /> {node.power_w.toFixed(0)}W</span>
                  <span className="flex items-center gap-2.5 bg-white/5 px-3 py-1.5 rounded-xl"><Thermometer className="w-4 h-4 text-red-500/60" /> {node.temp_c.toFixed(0)}°</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/5 px-4 py-1.5 rounded-xl text-cyan-400/80">
                  <Network className="w-4 h-4" /> {node.rdma_latency_us.toFixed(0)}μs
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NodePanel;
