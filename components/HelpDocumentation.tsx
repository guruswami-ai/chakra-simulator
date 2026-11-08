
import React, { useEffect, useRef, useState } from 'react';
import { 
  X, Book, Cpu, Layers, Network, Activity, Database, Share2, Info, 
  Box, Zap, Brain, Target, Eye, MapPin, List, Table, ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, Search, RefreshCw, HardDrive, ShieldCheck, Repeat, Clock, Gauge, Scale, Workflow, Server, Terminal, Code
} from 'lucide-react';
import { useHelp } from './HelpContext';
import { HelpSectionId } from '../types';

const HelpDocumentation: React.FC = () => {
  const { closeHelp, anchor } = useHelp();
  const [activeTab, setActiveTab] = useState<'cluster' | 'models' | 'benchmarks' | 'deployment'>('cluster');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (anchor) {
      if (anchor.startsWith('arch-')) setActiveTab('models');
      else if (['benchmarks', 'sync-tax', 'divisibility-wall', 'mla-compression'].includes(anchor)) setActiveTab('benchmarks');
      else setActiveTab('cluster');

      setTimeout(() => {
        sectionRefs.current[anchor]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [anchor]);

  const MenuItem = ({ id, label, icon: Icon, color }: { id: HelpSectionId | string, label: string, icon: any, color: string }) => (
    <button 
      onClick={() => sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
      className="flex items-center gap-4 px-6 py-3 hover:bg-white/5 rounded-2xl transition-all group w-full text-left"
    >
      <Icon className={`w-5 h-5 ${color} opacity-60 group-hover:opacity-100 transition-opacity`} />
      <span className="text-xs font-mono font-black text-white/40 group-hover:text-white uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/95 animate-in fade-in duration-300 font-mono">
      <div className="relative w-[94%] h-[92vh] bg-[#050505] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] flex flex-col">
        
        {/* Header */}
        <div className="h-24 border-b border-white/5 flex items-center justify-between px-12 bg-white/[0.02]">
          <div className="flex items-center gap-8">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <Book className="w-6 h-6 text-white/50" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">Chakra Knowledge Base</h2>
              <p className="text-xs font-mono text-white/30 uppercase tracking-[0.2em] font-bold">Jan 2026 Cluster Benchmark & Architecture v5.5</p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            <button 
              onClick={() => setActiveTab('cluster')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'cluster' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Hardware
            </button>
            <button 
              onClick={() => setActiveTab('benchmarks')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'benchmarks' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Benchmarks
            </button>
            <button 
              onClick={() => setActiveTab('models')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'models' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Intelligence
            </button>
            <button 
              onClick={() => setActiveTab('deployment')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'deployment' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Integration
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={closeHelp}
              className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
            >
              <X className="w-6 h-6 text-white/40" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Menu */}
          <div className="w-72 border-r border-white/5 flex flex-col p-8 gap-1 overflow-y-auto custom-scrollbar bg-black/20">
            {activeTab === 'cluster' ? (
              <>
                <h4 className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black mb-4 px-6">Hardware & Fabric</h4>
                <MenuItem id="foundations" label="Foundations" icon={Info} color="text-purple-400" />
                <MenuItem id="hardware" label="Silicon Specs" icon={Cpu} color="text-orange-400" />
                <MenuItem id="mesh-ring" label="Mesh vs Ring" icon={Network} color="text-emerald-400" />
                <MenuItem id="distributed-flow" label="Token Pipeline" icon={Repeat} color="text-pink-400" />
              </>
            ) : activeTab === 'benchmarks' ? (
              <>
                <h4 className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black mb-4 px-6">Performance Report</h4>
                <MenuItem id="benchmarks" label="Jan 5 Report" icon={Gauge} color="text-cyan-400" />
                <MenuItem id="sync-tax" label="The Sync Tax" icon={Clock} color="text-red-400" />
                <MenuItem id="divisibility-wall" label="Divisibility Wall" icon={Scale} color="text-yellow-400" />
                <MenuItem id="mla-compression" label="MLA Compression" icon={Database} color="text-emerald-400" />
              </>
            ) : activeTab === 'deployment' ? (
              <>
                <h4 className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black mb-4 px-6">Integration Guide</h4>
                <MenuItem id="deploy-overview" label="Deployment" icon={Server} color="text-cyan-400" />
                <MenuItem id="deploy-prom" label="Prometheus Bridge" icon={Terminal} color="text-emerald-400" />
                <MenuItem id="deploy-api" label="API Schema" icon={Code} color="text-white" />
              </>
            ) : (
              <>
                <h4 className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black mb-4 px-6">Intelligence Spectrum</h4>
                <MenuItem id="arch-overview" label="Architecture" icon={List} color="text-white" />
                <MenuItem id="arch-instruct" label="Instruct" icon={Zap} color="text-cyan-400" />
                <MenuItem id="arch-reasoning" label="Reasoning" icon={Brain} color="text-pink-400" />
                <MenuItem id="arch-moe" label="Mixture of Experts" icon={Target} color="text-yellow-400" />
                <MenuItem id="arch-matrix" label="Deployment" icon={Table} color="text-white" />
              </>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-16 custom-scrollbar scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-32 pb-40">
              
              {activeTab === 'deployment' ? (
                <>
                  <section ref={el => { sectionRefs.current['deploy-overview'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-cyan-500/10 border border-cyan-500/20 rounded-[2rem] text-cyan-400">
                        <Server className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Deployment Architecture</h3>
                    </div>
                    <div className="space-y-12">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        To deploy the Chakra Dashboard on your **Cluster_Controller** (sahasrara), you must provide a telemetry bridge between your Prometheus instance and the UI components.
                      </div>
                      <div className="grid grid-cols-3 gap-8">
                         <div className="bg-white/[0.03] p-8 rounded-[2rem] border border-white/5">
                            <h4 className="text-white font-black uppercase text-xs mb-4">1. Static Hosting</h4>
                            <p className="text-[11px] text-white/40 italic">Serve index.html via Nginx. All UI animations run client-side on the GPU.</p>
                         </div>
                         <div className="bg-white/[0.03] p-8 rounded-[2rem] border border-white/5">
                            <h4 className="text-white font-black uppercase text-xs mb-4">2. Telemetry Bridge</h4>
                            <p className="text-[11px] text-white/40 italic">A lightweight Flask/FastAPI app queries Prometheus and formats JSON for the dashboard.</p>
                         </div>
                         <div className="bg-white/[0.03] p-8 rounded-[2rem] border border-white/5">
                            <h4 className="text-white font-black uppercase text-xs mb-4">3. Fabric Gate</h4>
                            <p className="text-[11px] text-white/40 italic">Reverse proxy (Nginx) secures the /metrics/ endpoint from external access.</p>
                         </div>
                      </div>
                    </div>
                  </section>

                  <section ref={el => { sectionRefs.current['deploy-prom'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] text-emerald-400">
                        <Terminal className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Prometheus Integration</h3>
                    </div>
                    <div className="p-10 bg-black/60 border border-white/10 rounded-[3rem] space-y-8">
                       <h4 className="text-xs font-black text-white/50 uppercase tracking-[0.3em]">Required PromQL Queries</h4>
                       <div className="grid grid-cols-1 gap-4 font-mono text-xs">
                          <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group">
                             <span className="text-white/40">Throughput (T/S)</span>
                             <code className="text-emerald-400">rate(vllm_tokens_per_second_total[1m])</code>
                          </div>
                          <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group">
                             <span className="text-white/40">Fabric Load (Gbps)</span>
                             <code className="text-cyan-400">jaccl_link_bandwidth_tx_gbps</code>
                          </div>
                          <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group">
                             <span className="text-white/40">VRAM Pressure (%)</span>
                             <code className="text-purple-400">vllm_gpu_cache_usage_percent</code>
                          </div>
                       </div>
                    </div>
                  </section>

                  <section ref={el => { sectionRefs.current['deploy-api'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-white/10 border border-white/20 rounded-[2rem] text-white">
                        <Code className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">API Data Schema</h3>
                    </div>
                    <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem]">
                       <p className="text-xs text-white/40 uppercase font-black tracking-widest mb-6">The UI polls `/metrics/cluster-status` every 1000ms. Expected format:</p>
                       <pre className="text-[10px] text-cyan-400/80 leading-relaxed font-bold bg-black p-8 rounded-2xl border border-white/5 overflow-x-auto">
{`{
  "nodes": [
    {
      "id": "1",
      "name": "muladhara",
      "gpu_util": 85.2,
      "tok_per_sec": 4.1,
      "temp_c": 52,
      "power_w": 182,
      "rx_gbps": 6.4,
      "tx_gbps": 5.9,
      "kv_cache_pct": 22.5,
      "rdma_latency_us": 48
    },
    ...
  ]
}`}
                       </pre>
                    </div>
                  </section>
                </>
              ) : activeTab === 'benchmarks' ? (
                <>
                  <section ref={el => { sectionRefs.current['benchmarks'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-cyan-500/10 border border-cyan-500/20 rounded-[2rem] text-cyan-400">
                        <Gauge className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Chakra Benchmark Report</h3>
                    </div>
                    
                    <div className="space-y-12">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        Comprehensive testing of <span className="text-cyan-400">Kimi-K2-Thinking (614GB)</span> on 5× Mac Studio M3 Ultra nodes. Report generated January 5, 2026.
                      </div>

                      <div className="grid grid-cols-1 overflow-hidden border border-white/10 rounded-[2.5rem] bg-white/[0.02]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="p-8 text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Configuration</th>
                              <th className="p-8 text-[10px] font-black uppercase text-white/40 tracking-[0.2em] text-center">Throughput</th>
                              <th className="p-8 text-[10px] font-black uppercase text-white/40 tracking-[0.2em] text-center">TTFT</th>
                              <th className="p-8 text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Efficiency Analysis</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-bold text-white/60">
                            <tr className="border-b border-white/5 hover:bg-emerald-500/[0.03] transition-colors">
                              <td className="p-8 text-emerald-400">TP4 JACCL/RDMA</td>
                              <td className="p-8 text-center font-orbitron text-white">16.01 tok/s</td>
                              <td className="p-8 text-center tabular-nums">0.34s</td>
                              <td className="p-8">MAX (Requires node reboot for state)</td>
                            </tr>
                            <tr className="border-b border-white/5 hover:bg-cyan-500/[0.03] transition-colors">
                              <td className="p-8 text-cyan-400">PP5 Ring/TCP</td>
                              <td className="p-8 text-center font-orbitron text-white">15.18 tok/s</td>
                              <td className="p-8 text-center tabular-nums">0.41s</td>
                              <td className="p-8">PRODUCTION (100% Stability)</td>
                            </tr>
                            <tr className="border-b border-white/5 hover:bg-purple-500/[0.03] transition-colors">
                              <td className="p-8 text-purple-400">TP2 JACCL/RDMA</td>
                              <td className="p-8 text-center font-orbitron text-white">14.78 tok/s</td>
                              <td className="p-8 text-center tabular-nums">0.26s</td>
                              <td className="p-8">CHAT (Lowest response latency)</td>
                            </tr>
                            <tr className="hover:bg-red-500/[0.03] opacity-40 transition-colors">
                              <td className="p-8 text-red-500">TP4 Ring/TCP</td>
                              <td className="p-8 text-center font-orbitron">4.55 tok/s</td>
                              <td className="p-8 text-center tabular-nums">0.90s</td>
                              <td className="p-8">AVOID (TCP overhead bottleneck)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                         <div className="p-10 bg-white/[0.03] border border-white/10 rounded-[2.5rem]">
                            <h4 className="text-xs font-black text-white uppercase mb-6 tracking-widest flex items-center gap-2">
                               <ShieldCheck className="w-4 h-4 text-emerald-400" /> Ring/TCP Stability
                            </h4>
                            <p className="text-xs text-white/40 leading-relaxed italic">
                               Unlike the experimental JACCL stack, the Ring/TCP backend demonstrated <strong>zero failures</strong> across 11,000+ token sequences. While slightly slower (15.1 tok/s vs 16.0 tok/s), it is the recommended choice for 24/7 autonomous production.
                            </p>
                         </div>
                         <div className="p-10 bg-white/[0.03] border border-white/10 rounded-[2.5rem]">
                            <h4 className="text-xs font-black text-white uppercase mb-6 tracking-widest flex items-center gap-2">
                               <Zap className="w-4 h-4 text-cyan-400" /> TP2 Responsive Edge
                            </h4>
                            <p className="text-xs text-white/40 leading-relaxed italic">
                               The TP2 configuration achieves the cluster's fastest TTFT (0.26s) and highest per-node efficiency (7.39 tok/s/node). It is ideal for human-interactive chat where latency perceived at word 1 is critical.
                            </p>
                         </div>
                      </div>
                    </div>
                  </section>

                  <section ref={el => { sectionRefs.current['sync-tax'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-[2rem] text-red-400">
                        <Clock className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">The "Sync Tax" Analysis</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-10 items-start">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-base text-white/60 leading-relaxed font-medium">
                        Tensor Parallelism (TP) requires massive synchronization. For Kimi-K2, each token generation triggers <span className="text-red-400 font-black">61 All-Reduce operations</span> across the fabric.
                        <br/><br/>
                        On a 10GbE network, TCP overhead results in ~61ms of network waiting per token. RDMA over TB5 brings this down to &lt;3ms, enabling a 350% increase in overall system throughput.
                      </div>
                      <div className="bg-black/40 border border-white/5 p-10 rounded-[3rem] space-y-8">
                        <div className="space-y-6">
                           <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-bold text-red-400 uppercase"><span>TCP Waiting (TP4)</span><span>~61.0ms</span></div>
                              <div className="h-4 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-red-500 w-full" /></div>
                           </div>
                           <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-bold text-emerald-400 uppercase"><span>RDMA Waiting (TP4)</span><span>~2.8ms</span></div>
                              <div className="h-4 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[15%]" /></div>
                           </div>
                        </div>
                        <p className="text-[10px] text-white/20 italic text-center font-bold uppercase tracking-widest">Network overhead contribution per token</p>
                      </div>
                    </div>
                  </section>

                  <section ref={el => { sectionRefs.current['divisibility-wall'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-[2rem] text-yellow-400">
                        <Scale className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Architecture: Divisibility Wall</h3>
                    </div>

                    <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] flex flex-col gap-8">
                      <p className="text-lg text-white/60 leading-relaxed font-medium">
                        Kimi-K2 has a hidden dimension of <span className="text-yellow-400 font-black">12,288</span>. Tensor Parallelism requires the sharding factor to be an integer divisor of this dimension.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-10">
                         <div className="bg-emerald-500/5 p-8 border border-emerald-500/10 rounded-[2.5rem]">
                            <h5 className="text-emerald-400 font-black uppercase text-xs mb-4">Valid TP Factors</h5>
                            <ul className="space-y-3 font-mono text-xs text-white/50">
                               <li className="flex justify-between"><span>Nodes: 2</span><span>12288 / 2 = 6144 ✅</span></li>
                               <li className="flex justify-between"><span>Nodes: 3</span><span>12288 / 3 = 4096 ✅</span></li>
                               <li className="flex justify-between"><span>Nodes: 4</span><span>12288 / 4 = 3072 ✅</span></li>
                               <li className="flex justify-between"><span>Nodes: 6</span><span>12288 / 6 = 2048 ✅</span></li>
                            </ul>
                         </div>
                         <div className="bg-red-500/5 p-8 border border-red-500/10 rounded-[2.5rem]">
                            <h5 className="text-red-400 font-black uppercase text-xs mb-4">The 5-Node Constraint</h5>
                            <p className="text-xs text-white/40 leading-relaxed italic">
                               12288 is not divisible by 5 (2457.6). Therefore, a 5-node cluster <strong>must</strong> use Pipeline Parallelism (PP5) or a Hybrid approach. TP5 is physically impossible for this model architecture.
                            </p>
                         </div>
                      </div>
                    </div>
                  </section>

                  <section ref={el => { sectionRefs.current['mla-compression'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] text-emerald-400">
                        <Database className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">MLA Compression Efficacy</h3>
                    </div>
                    <div className="p-12 bg-white/[0.03] border border-white/10 rounded-[3rem] space-y-10">
                      <p className="text-lg text-white/60 leading-relaxed font-medium">
                        Kimi-K2 implements <span className="text-emerald-400 font-black">Multi-Head Latent Attention (MLA)</span>. Benchmarks show this compresses KV-cache ~4-8× compared to standard Llama architectures.
                      </p>
                      <div className="grid grid-cols-3 gap-8">
                         <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 text-center">
                            <span className="text-[10px] text-white/30 uppercase font-black">Context Window</span>
                            <div className="text-2xl font-black text-white font-orbitron mt-1">128,000</div>
                         </div>
                         <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 text-center">
                            <span className="text-[10px] text-white/30 uppercase font-black">KV Load @ 8k Tokens</span>
                            <div className="text-2xl font-black text-emerald-400 font-orbitron mt-1">~10% VRAM</div>
                         </div>
                         <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 text-center">
                            <span className="text-[10px] text-white/30 uppercase font-black">Memory Limit</span>
                            <div className="text-2xl font-black text-cyan-400 font-orbitron mt-1">Never Hit</div>
                         </div>
                      </div>
                      <p className="text-[11px] text-white/30 italic text-center leading-relaxed">
                        Data confirms: Kimi-K2 terminates via EOS model behavior around 11,000 tokens, long before VRAM capacity is exhausted on the 2.5TB Chakra cluster.
                      </p>
                    </div>
                  </section>
                </>
              ) : activeTab === 'cluster' ? (
                <>
                  <section ref={el => { sectionRefs.current['foundations'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] text-purple-400">
                        <Info className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Cluster Foundations</h3>
                    </div>
                    <div className="space-y-10">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        The Chakra Cluster is a 5-node distributed inference environment built on Apple M3 Ultra silicon. By utilizing <span className="text-purple-400 font-black">RDMA-enabled Thunderbolt 5 Mesh</span>, we pool high-bandwidth memory into a unified 2.56TB address space, enabling the inference of frontier-scale models (600B+ parameters) with sub-100ms synchronization latency.
                      </div>
                    </div>
                  </section>
                  <section ref={el => { sectionRefs.current['mesh-ring'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] text-emerald-400">
                        <Network className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Mesh vs Ring Topology</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-10">
                      <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                        <h4 className="font-orbitron text-red-500 uppercase font-black tracking-widest">🔄 RING PIPELINE (PP)</h4>
                        <p className="text-xs text-white/40 leading-relaxed italic">The "Bucket Brigade". Activations flow stage-to-stage. Tolerates high-latency networks (TCP/10GbE). 100% stable in production based on Jan 2026 tests.</p>
                      </div>
                      <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                        <h4 className="font-orbitron text-cyan-400 uppercase font-black tracking-widest">⚡ TENSOR MESH (TP)</h4>
                        <p className="text-xs text-white/40 leading-relaxed italic">The "Blitz". Tensors sharded across fabric. Direct peer-to-peer sync. Requires sub-50μs RDMA latency for performance scaling to 16+ tok/s.</p>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section ref={el => { sectionRefs.current['arch-overview'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-white/10 border border-white/20 rounded-[2rem] text-white">
                        <List className="w-8 h-8" />
                      </div>
                      <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Intelligence Spectrum</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      {[
                        { icon: Box, name: "Base / Foundation", tag: "Raw Material", color: "text-purple-400", desc: "Pure next-token prediction trained on trillions of points." },
                        { icon: Zap, name: "Instruct", tag: "Fast & Direct", color: "text-cyan-400", desc: "Fine-tuned to follow orders and chat." },
                        { icon: Brain, name: "Reasoning", tag: "Think First", color: "text-pink-400", desc: "Explicit chain-of-thought logic." },
                        { icon: Target, name: "MoE", tag: "Experts", color: "text-yellow-400", desc: "Massive scale with sparse compute." },
                      ].map((card, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 p-8 rounded-[2.5rem] flex flex-col gap-4">
                          <card.icon className={`w-10 h-10 ${card.color}`} />
                          <h4 className="text-xl font-black text-white uppercase">{card.name}</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">{card.desc}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <div className="h-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpDocumentation;
