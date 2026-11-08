
import React, { useEffect, useState } from 'react';
import { NodeMetrics } from '../types';
import { X, Thermometer, Zap, Database, Cpu, Activity, Info, Network, Clock, Box, AlertTriangle, WifiOff } from 'lucide-react';
import { CHAKRA_SYMBOLS } from '../constants';
import ConceptHelper from './ConceptHelper';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
interface NodeFocusViewProps {
  node: NodeMetrics;
  onClose: () => void;
}

const NodeFocusView: React.FC<NodeFocusViewProps> = ({ node, onClose }) => {
  const nodeRole = node.role === 'compute' ? 'Compute' : node.role === 'standalone' ? 'Standalone' : 'Idle';
  const isMeshDegraded = false;
  const isRecoveryFailed = false;
  const meshHealth = { healthy: true, rdma: true };
  const [activeTab, setActiveTab] = useState<'metrics' | 'prometheus' | 'system'>('metrics');

  const [history, setHistory] = useState(() => Array.from({ length: 40 }, (_, i) => ({
    val: 50 + Math.random() * 20
  })));

  useEffect(() => {
    const timer = setInterval(() => {
      setHistory(prev => [...prev.slice(1), { val: 50 + Math.random() * 20 }]);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const prometheusData = {
    [`cluster_node_info{node="${node.name}", cpu="M3 Ultra", ram_gb="512", role="compute", network="jaccl"}`]: "1",
    "vllm_tokens_per_second_total": node.tok_per_sec.toFixed(2),
    "vllm_time_to_first_token_seconds{quantile=\"0.5\"}": "0.342",
    "vllm_gpu_cache_usage_percent": node.kv_cache_pct.toFixed(2),
    "vllm_num_requests_running": "3",
    "jaccl_rdma_buffer_sync_latency_us": node.rdma_latency_us.toFixed(1),
    "mactop_gpu_utilization_percent": node.gpu_util.toFixed(1),
    "mactop_cpu_utilization_percent": node.cpu_util.toFixed(1),
    "mactop_power_draw_watts": node.power_w.toFixed(2),
    "mactop_soc_temperature_celsius": node.temp_c.toFixed(1),
    "mactop_memory_gb{type=\"used\"}": node.ram_used.toFixed(2),
    "jaccl_link_bandwidth_rx_gbps": node.rx_gbps.toFixed(2),
    "jaccl_link_bandwidth_tx_gbps": node.tx_gbps.toFixed(2),
    "jaccl_link_status": "1",
    "chakra_config_mode": "tp4_jaccl_rdma"
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/95 animate-in fade-in zoom-in duration-300">
      <div className="relative w-[96%] h-[92vh] bg-[#050505] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_200px_rgba(0,0,0,1)] flex flex-col">
        
        {/* Header */}
        <div className="h-28 border-b border-white/5 flex items-center justify-between px-12 bg-white/[0.02]">
          <div className="flex items-center gap-8">
            <div 
              className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center border relative overflow-hidden"
              style={{ borderColor: node.color, backgroundColor: `${node.color}10`, color: node.color }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
              <svg viewBox="0 0 100 100" className="w-full h-full p-3 drop-shadow-[0_0_15px_currentColor]">
                {CHAKRA_SYMBOLS[node.name.toLowerCase()]}
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-5">
                <h2 className="text-4xl font-black uppercase tracking-tighter text-white">{node.name}</h2>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${nodeRole !== 'Idle' ? 'animate-pulse bg-emerald-500' : 'bg-white/20'}`} />
                  <span className={`text-[10px] font-mono font-black tracking-widest uppercase ${nodeRole !== 'Idle' ? 'text-emerald-500' : 'text-white/40'}`}>
                    {nodeRole}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-[10px] font-mono text-white/40 uppercase mt-2 tracking-widest font-bold">
                <span>Instance: {node.id}</span>
                <span className="opacity-20">|</span>
                <span>Role: {nodeRole}</span>
                <span className="opacity-20">|</span>
                <span>
                  RDMA Latency: {`${node.rdma_latency_us.toFixed(1)}μs`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Mesh Health Alert Badge */}
            {isMeshDegraded && (
              <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${
                isRecoveryFailed
                  ? 'bg-red-950/50 border-red-500/50'
                  : 'bg-amber-950/50 border-amber-500/50'
              }`}>
                {isRecoveryFailed ? (
                  <WifiOff className="w-5 h-5 text-red-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                    isRecoveryFailed ? 'text-red-300' : 'text-amber-300'
                  }`}>
                    {!meshHealth?.rdma ? 'RDMA Offline' : 'Mesh Degraded'}
                  </span>
                  <span className="text-[10px] font-mono text-white/50">
                    TB5 fabric unavailable
                  </span>
                </div>
              </div>
            )}
             <div className="bg-white/5 px-8 py-3 rounded-2xl border border-white/10 flex flex-col items-end">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Compute Slot</span>
                <span className="text-2xl font-black text-white font-mono">NODE_0{node.index + 1}</span>
             </div>
             <button 
               onClick={onClose}
               className="p-5 bg-white/5 hover:bg-red-500/20 hover:border-red-500/50 border border-white/10 rounded-[2rem] transition-all group"
             >
               <X className="w-8 h-8 text-white/40 group-hover:text-red-400 transition-colors" />
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          
          {/* Navigation Sidebar */}
          <div className="w-24 border-r border-white/5 flex flex-col items-center py-12 gap-10 bg-black/40">
            <button 
              onClick={() => setActiveTab('metrics')} 
              className={`p-5 rounded-2xl transition-all relative group ${activeTab === 'metrics' ? 'bg-white/10 text-white shadow-[0_0_40px_rgba(255,255,255,0.1)]' : 'text-white/20 hover:text-white/40'}`}
              title="Metrics HUD"
            >
              <Activity className="w-7 h-7" />
              {activeTab === 'metrics' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white rounded-l-full shadow-[0_0_15px_white]" />}
            </button>
            <button 
              onClick={() => setActiveTab('prometheus')} 
              className={`p-5 rounded-2xl transition-all relative group ${activeTab === 'prometheus' ? 'bg-white/10 text-white shadow-[0_0_40px_rgba(255,255,255,0.1)]' : 'text-white/20 hover:text-white/40'}`}
              title="Prometheus Metrics"
            >
              <Network className="w-7 h-7" />
              {activeTab === 'prometheus' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white rounded-l-full shadow-[0_0_15px_white]" />}
            </button>
            <button 
              onClick={() => setActiveTab('system')} 
              className={`p-5 rounded-2xl transition-all relative group ${activeTab === 'system' ? 'bg-white/10 text-white shadow-[0_0_40px_rgba(255,255,255,0.1)]' : 'text-white/20 hover:text-white/40'}`}
              title="Hardware Specs"
            >
              <Info className="w-7 h-7" />
              {activeTab === 'system' && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white rounded-l-full shadow-[0_0_15px_white]" />}
            </button>
          </div>

          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
            {activeTab === 'metrics' && (
              <div className="grid grid-cols-12 gap-8 max-w-[1400px] mx-auto">
                <div className="col-span-8 grid grid-cols-2 gap-8">
                  <div className="bg-white/[0.03] border border-white/5 rounded-[3rem] p-8 flex flex-col items-center justify-center relative group/card">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500/40 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-3 mb-6">
                       <Cpu className="w-5 h-5 text-emerald-400" />
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] flex items-center">
                          Accelerator Util
                          <ConceptHelper sectionId="hardware" label="GPU Load" />
                       </span>
                    </div>
                    <div className="relative w-56 h-56 flex items-center justify-center">
                      <svg viewBox="0 0 256 256" className="w-full h-full transform -rotate-90">
                        <circle cx="128" cy="128" r="110" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="24" />
                        <circle 
                          cx="128" cy="128" r="110" fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round"
                          strokeDasharray={691} 
                          strokeDashoffset={691 - (691 * node.gpu_util) / 100} 
                          className="text-emerald-500 transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-6xl font-black text-white tabular-nums">{node.gpu_util.toFixed(0)}%</span>
                        <span className="text-[10px] text-emerald-500 font-black tracking-widest uppercase mt-1">GPU ACTIVE</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/5 rounded-[3rem] p-8 flex flex-col items-center justify-center relative group/card">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500/40 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-3 mb-6">
                       <Thermometer className="w-5 h-5 text-red-400" />
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] flex items-center">
                          SoC Junction
                          <ConceptHelper sectionId="hardware" label="Thermal State" />
                       </span>
                    </div>
                    <div className="relative w-56 h-56 flex items-center justify-center">
                      <svg viewBox="0 0 256 256" className="w-full h-full transform -rotate-90">
                        <circle cx="128" cy="128" r="110" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="24" />
                        <circle 
                          cx="128" cy="128" r="110" fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="round"
                          strokeDasharray={691} 
                          strokeDashoffset={691 - (691 * node.temp_c) / 100} 
                          className="text-red-500 transition-all duration-700"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-6xl font-black text-white tabular-nums">{node.temp_c.toFixed(0)}°</span>
                        <span className="text-[10px] text-red-500 font-black tracking-widest uppercase mt-1">CELSIUS</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 bg-white/[0.03] border border-white/5 rounded-[3rem] p-10">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <Database className="w-6 h-6 text-purple-400" />
                        <span className="text-xl font-black uppercase tracking-widest text-white flex items-center">
                          KV Cache residency
                          <ConceptHelper sectionId="mla-compression" label="MLA Cache Efficiency" />
                        </span>
                      </div>
                      <span className="text-xs font-mono text-purple-400 font-black uppercase bg-purple-400/10 px-3 py-1 rounded-lg border border-purple-400/20">
                        {node.kv_cache_pct.toFixed(1)}% Saturation
                      </span>
                    </div>
                    <div className="h-40 flex items-end gap-2 px-1">
                      {[...Array(60)].map((_, i) => (
                        <div 
                          key={i} 
                          className="flex-1 bg-purple-500/20 hover:bg-purple-500/60 transition-all rounded-t-sm" 
                          style={{ height: `${node.kv_cache_pct + Math.sin(i * 0.4) * 8 + (Math.random() - 0.5) * 4}%` }} 
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-span-4 flex flex-col gap-8">
                  <div className="bg-white/[0.04] p-8 rounded-[2.5rem] border border-white/10 flex-1 shadow-xl">
                    <div className="flex items-center gap-4 text-white/50 mb-8">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Hardware Power Profile</span>
                    </div>
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-mono font-bold">
                          <span className="text-white/40 tracking-widest uppercase text-[10px]">Compute Rails</span>
                          <span className="text-white">{(node.power_w * 0.75).toFixed(1)} W</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500/60 transition-all duration-700" style={{ width: '75%' }} />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-mono font-bold">
                          <span className="text-white/40 tracking-widest uppercase text-[10px]">Fabric / TB5 PHY</span>
                          <span className="text-white">{(node.power_w * 0.25).toFixed(1)} W</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-700" style={{ width: '25%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-white/5">
                       <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest">Network Telemetry (RX/TX)</h4>
                          <span className="text-[10px] font-mono text-cyan-400 font-bold">{(node.rx_gbps + node.tx_gbps).toFixed(1)} Gbps Aggregate</span>
                       </div>
                       <div className="h-24 w-full bg-black/40 rounded-xl overflow-hidden p-2">
                          <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={history}>
                                <Line type="monotone" dataKey="val" stroke={node.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                             </LineChart>
                          </ResponsiveContainer>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prometheus' && (
              <div className="max-w-5xl mx-auto space-y-8 font-mono pb-20">
                <div className="flex items-center justify-between px-6">
                   <h3 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-3">
                      <Network className="w-4 h-4" /> Endpoint: /metrics/node_{node.index + 1}
                   </h3>
                   <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] text-emerald-500 font-black">200 OK</span>
                </div>
                <div className="bg-black/50 rounded-[2rem] p-8 border border-white/5 shadow-2xl space-y-3">
                  {Object.entries(prometheusData).map(([key, value]) => (
                    <div key={key} className="group flex items-center justify-between py-3 border-b border-white/[0.04] hover:bg-white/[0.02] px-4 rounded-xl transition-all">
                      <span className="text-[12px] text-white/50 tracking-tight font-medium group-hover:text-white/80">{key}</span>
                      <span className="text-base text-cyan-400 font-black tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="max-w-4xl mx-auto grid grid-cols-2 gap-8 pb-20">
                 <div className="bg-white/5 p-10 rounded-[3rem] border border-white/5">
                    <h3 className="text-white font-black uppercase text-xs mb-8 tracking-[0.3em] flex items-center gap-3">
                       <Cpu className="w-5 h-5 text-emerald-400" /> SOC ARCHITECTURE
                    </h3>
                    <ul className="space-y-5 text-[11px] text-white/60 font-medium">
                       <li className="flex justify-between border-b border-white/5 pb-2"><span>Silicon Batch</span><span className="text-white font-black">M3 Ultra (Jan '26)</span></li>
                       <li className="flex justify-between border-b border-white/5 pb-2"><span>Performance Cores</span><span className="text-white font-black">24x Avalanche</span></li>
                       <li className="flex justify-between border-b border-white/5 pb-2"><span>Efficiency Cores</span><span className="text-white font-black">8x Blizzard</span></li>
                       <li className="flex justify-between border-b border-white/5 pb-2"><span>GPU Cores</span><span className="text-white font-black">80 Core Neural Engine</span></li>
                       <li className="flex justify-between"><span>Memory Bandwidth</span><span className="text-white font-black">800 GB/s (Local)</span></li>
                    </ul>
                 </div>
                 <div className={`p-10 rounded-[3rem] border ${
                   isMeshDegraded
                     ? 'bg-red-950/20 border-red-500/30'
                     : 'bg-white/5 border-white/5'
                 }`}>
                    <h3 className={`font-black uppercase text-xs mb-8 tracking-[0.3em] flex items-center gap-3 ${
                      isMeshDegraded ? 'text-red-300' : 'text-white'
                    }`}>
                       <Network className={`w-5 h-5 ${isMeshDegraded ? 'text-red-400' : 'text-cyan-400'}`} />
                       FABRIC CONNECTIVITY
                       {isMeshDegraded && (
                         <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/30 text-red-300 ml-2">
                           DEGRADED
                         </span>
                       )}
                    </h3>
                    <ul className="space-y-5 text-[11px] text-white/60 font-medium">
                       <li className="flex justify-between border-b border-white/5 pb-2">
                         <span>Active TB5 Ports</span>
                         <span className={`font-black ${isMeshDegraded ? 'text-red-400' : 'text-white'}`}>
                           {node.tb5_links || 0} of 4 Active
                         </span>
                       </li>
                       <li className="flex justify-between border-b border-white/5 pb-2">
                         <span>RDMA Status</span>
                         <span className={`font-black flex items-center gap-2 ${
                           meshHealth?.rdma ? 'text-emerald-400' : 'text-red-400'
                         }`}>
                           <div className={`w-2 h-2 rounded-full ${
                             meshHealth?.rdma ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'
                           }`} />
                           {meshHealth?.rdma ? 'ONLINE' : 'OFFLINE'}
                         </span>
                       </li>
                       <li className="flex justify-between border-b border-white/5 pb-2">
                         <span>RDMA Stack</span>
                         <span className={`font-black ${isMeshDegraded ? 'text-white/40' : 'text-white'}`}>
                           {isMeshDegraded ? 'N/A' : 'JACCL 2.4.1'}
                         </span>
                       </li>
                       <li className="flex justify-between border-b border-white/5 pb-2">
                         <span>Mesh Health</span>
                         <span className={`font-black flex items-center gap-2 ${
                           meshHealth?.healthy ? 'text-emerald-400' : 'text-amber-400'
                         }`}>
                           <div className={`w-2 h-2 rounded-full ${
                             meshHealth?.healthy ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                           }`} />
                           {meshHealth?.healthy ? 'HEALTHY' : isRecoveryFailed ? 'RECOVERY FAILED' : 'DEGRADED'}
                         </span>
                       </li>
                       <li className="flex justify-between"><span>10GbE IP</span><span className="text-white font-black">10.61.106.{31 + node.index}</span></li>
                    </ul>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeFocusView;
