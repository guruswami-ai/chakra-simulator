
import React, { useEffect, useRef, useState } from 'react';
import {
  X, BookMarked, Cpu, Layers, Network, Activity, Database, Share2, Info,
  Box, Zap, Brain, Target, Eye, MapPin, List, Table, ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, Search, RefreshCw, HardDrive, ShieldCheck, Repeat, Clock, Gauge, Scale, Workflow,
  Lock, Trophy, BookOpen, Sliders, Timer, Scan
} from 'lucide-react';
import { useCodex } from './CodexContext';
import CodexDrawer from './CodexDrawer';
import { HelpSectionId } from '../types';
import { TRIAL_DEFINITIONS } from '../hooks/useResonanceState';
import type { TrialCodex } from '../hooks/useResonanceState';

// ── Tier metadata ─────────────────────────────────────────────────────

const TIER_META = [
  { modelId: 'qwen25-32b', label: 'Qwen 32B', color: 'text-teal-400', bgColor: 'bg-teal-500', borderColor: 'border-teal-500/20' },
  { modelId: 'llama-405b', label: 'Llama 405B', color: 'text-blue-400', bgColor: 'bg-blue-500', borderColor: 'border-blue-500/20' },
  { modelId: 'mixtral-8x7b', label: 'Mixtral 8x7B', color: 'text-orange-400', bgColor: 'bg-orange-500', borderColor: 'border-orange-500/20' },
  { modelId: 'deepseek-v3', label: 'DeepSeek V3', color: 'text-green-400', bgColor: 'bg-green-500', borderColor: 'border-green-500/20' },
  { modelId: 'kimi-k2.5', label: 'Kimi K2.5', color: 'text-purple-400', bgColor: 'bg-purple-500', borderColor: 'border-purple-500/20' },
];

// ── Mode badge labels ─────────────────────────────────────────────────

const MODE_BADGES = {
  GAME: { label: 'GAME MODE', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  SIM: { label: 'SIM MODE', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  LIVE: { label: 'LIVE MODE', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

// ── Component ─────────────────────────────────────────────────────────

const CodexPanel: React.FC = () => {
  const { closeCodex, anchor, mode, resonance, getModelProgress, recordQuizScore, markSectionViewed } = useCodex();
  const [activeTab, setActiveTab] = useState<'cluster' | 'models' | 'benchmarks' | 'trials'>('cluster');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (anchor) {
      if (anchor === 'codex-trials' || anchor === 'codex-progress') {
        setActiveTab('trials');
      } else if (anchor.startsWith('arch-')) {
        setActiveTab('models');
      } else if (['benchmarks', 'sync-tax', 'divisibility-wall', 'mla-compression', 'cluster-comparison'].includes(anchor)) {
        setActiveTab('benchmarks');
      } else {
        setActiveTab('cluster');
      }

      setTimeout(() => {
        sectionRefs.current[anchor]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [anchor]);

  const modeBadge = MODE_BADGES[mode];

  const MenuItem = ({ id, label, icon: Icon, color, locked = false }: { id: HelpSectionId | string, label: string, icon: any, color: string, locked?: boolean }) => (
    <button
      onClick={() => !locked && sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
      className={`flex items-center gap-4 px-6 py-3 rounded-2xl transition-all group w-full text-left ${
        locked ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5'
      }`}
      disabled={locked}
    >
      {locked ? (
        <Lock className="w-5 h-5 text-white/20" />
      ) : (
        <Icon className={`w-5 h-5 ${color} opacity-60 group-hover:opacity-100 transition-opacity`} />
      )}
      <span className={`codex-label ${
        locked ? 'text-white/20' : 'text-white/40 group-hover:text-white'
      }`}>{label}</span>
    </button>
  );

  return (
    <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/95 animate-in fade-in duration-300 codex-root">
      <div className="relative w-[94%] h-[92vh] bg-[#050505] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] flex flex-col">

        {/* Header */}
        <div className="h-24 border-b border-white/5 flex items-center justify-between px-12 bg-white/[0.02]">
          <div className="flex items-center gap-8">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <BookMarked className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="codex-display text-2xl tracking-tight text-white">Guruswami Codex</h2>
              <div className="flex items-center gap-3">
                <p className="codex-label text-white/30">Interactive Curriculum Engine</p>
                <span className={`codex-label px-2 py-0.5 rounded-lg border ${modeBadge.bg} ${modeBadge.color}`}>
                  {modeBadge.label}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setActiveTab('cluster')}
              className={`px-6 py-2.5 rounded-xl codex-label transition-all ${activeTab === 'cluster' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Hardware
            </button>
            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`px-6 py-2.5 rounded-xl codex-label transition-all ${activeTab === 'benchmarks' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Benchmarks
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`px-6 py-2.5 rounded-xl codex-label transition-all ${activeTab === 'models' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Intelligence
            </button>
            <button
              onClick={() => setActiveTab('trials')}
              className={`px-6 py-2.5 rounded-xl codex-label transition-all ${activeTab === 'trials' ? 'bg-amber-500/20 text-amber-400 shadow-lg' : 'text-white/30 hover:text-white/50'}`}
            >
              Trials
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={closeCodex}
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
                <h4 className="codex-label text-white/20 mb-4 px-6">Hardware & Fabric</h4>
                <MenuItem id="foundations" label="Foundations" icon={Info} color="text-purple-400" />
                <MenuItem id="hardware" label="Silicon Specs" icon={Cpu} color="text-orange-400" />
                <MenuItem id="mesh-ring" label="Mesh vs Ring" icon={Network} color="text-emerald-400" />
                <MenuItem id="distributed-flow" label="Token Pipeline" icon={Repeat} color="text-pink-400" />
                <MenuItem id="quantization" label="Quantization" icon={Sliders} color="text-amber-400" />
                <MenuItem id="gpu-timeout" label="GPU Timeout" icon={Timer} color="text-red-400" />
              </>
            ) : activeTab === 'benchmarks' ? (
              <>
                <h4 className="codex-label text-white/20 mb-4 px-6">Performance Report</h4>
                <MenuItem id="benchmarks" label="Jan 5 Report" icon={Gauge} color="text-cyan-400" />
                <MenuItem id="sync-tax" label="The Sync Tax" icon={Clock} color="text-red-400" />
                <MenuItem id="divisibility-wall" label="Divisibility Wall" icon={Scale} color="text-yellow-400" />
                <MenuItem id="mla-compression" label="MLA Compression" icon={Database} color="text-emerald-400" />
                <MenuItem id="cluster-comparison" label="Chakra vs Enterprise" icon={Scale} color="text-purple-400" />
              </>
            ) : activeTab === 'trials' ? (
              <>
                <h4 className="codex-label text-amber-400/40 mb-4 px-6">Resonance Trials</h4>
                {TIER_META.map((tier, i) => {
                  const progress = getModelProgress(tier.modelId);
                  const total = TRIAL_DEFINITIONS.filter(t => t.modelId === tier.modelId).length;
                  const completed = progress.completedTrials.length;
                  return (
                    <button
                      key={tier.modelId}
                      onClick={() => sectionRefs.current[`tier-${i}`]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className="flex items-center gap-4 px-6 py-3 hover:bg-white/5 rounded-2xl transition-all group w-full text-left"
                    >
                      <Trophy className={`w-5 h-5 ${tier.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                      <div className="flex flex-col">
                        <span className={`codex-label ${tier.color} opacity-60 group-hover:opacity-100`}>
                          Tier {i + 1}
                        </span>
                        <span className="codex-tech text-white/30">{completed}/{total}</span>
                      </div>
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <h4 className="codex-label text-white/20 mb-4 px-6">Intelligence Spectrum</h4>
                <MenuItem id="arch-overview" label="Architecture" icon={List} color="text-white" />
                <MenuItem id="arch-instruct" label="Instruct" icon={Zap} color="text-cyan-400" />
                <MenuItem id="arch-reasoning" label="Reasoning" icon={Brain} color="text-pink-400" />
                <MenuItem id="arch-moe" label="Mixture of Experts" icon={Target} color="text-yellow-400" />
                <MenuItem id="arch-attention" label="Attention" icon={Scan} color="text-emerald-400" />
                <MenuItem id="arch-matrix" label="Deployment" icon={Table} color="text-white" />
              </>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-16 custom-scrollbar scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-32 pb-40">

              {activeTab === 'trials' ? (
                <TrialsContent sectionRefs={sectionRefs} resonance={resonance} getModelProgress={getModelProgress} recordQuizScore={recordQuizScore} markSectionViewed={markSectionViewed} />
              ) : activeTab === 'benchmarks' ? (
                <>
                  <section ref={el => { sectionRefs.current['benchmarks'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-cyan-500/10 border border-cyan-500/20 rounded-[2rem] text-cyan-400">
                        <Gauge className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">Chakra Benchmark Report</h3>
                    </div>

                    <div className="space-y-12">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        Comprehensive testing of <span className="text-cyan-400">Kimi-K2-Thinking (614GB)</span> on 5x Mac Studio M3 Ultra nodes. Report generated January 5, 2026.
                      </div>

                      <div className="grid grid-cols-1 overflow-hidden border border-white/10 rounded-[2.5rem] bg-white/[0.02]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="p-8 codex-label text-white/40">Configuration</th>
                              <th className="p-8 codex-label text-white/40 text-center">Throughput</th>
                              <th className="p-8 codex-label text-white/40 text-center">TTFT</th>
                              <th className="p-8 codex-label text-white/40">Efficiency Analysis</th>
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
                            <h4 className="codex-label text-white mb-6 flex items-center gap-2">
                               <ShieldCheck className="w-4 h-4 text-emerald-400" /> Ring/TCP Stability
                            </h4>
                            <p className="text-xs text-white/40 leading-relaxed italic">
                               Unlike the experimental JACCL stack, the Ring/TCP backend demonstrated <strong>zero failures</strong> across 11,000+ token sequences. While slightly slower (15.1 tok/s vs 16.0 tok/s), it is the recommended choice for 24/7 autonomous production.
                            </p>
                         </div>
                         <div className="p-10 bg-white/[0.03] border border-white/10 rounded-[2.5rem]">
                            <h4 className="codex-label text-white mb-6 flex items-center gap-2">
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
                      <h3 className="codex-heading text-2xl text-white">The "Sync Tax" Analysis</h3>
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
                              <div className="flex justify-between codex-label text-red-400"><span>TCP Waiting (TP4)</span><span>~61.0ms</span></div>
                              <div className="h-4 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-red-500 w-full" /></div>
                           </div>
                           <div className="space-y-2">
                              <div className="flex justify-between codex-label text-emerald-400"><span>RDMA Waiting (TP4)</span><span>~2.8ms</span></div>
                              <div className="h-4 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[15%]" /></div>
                           </div>
                        </div>
                        <p className="codex-caption italic text-center">Network overhead contribution per token</p>
                      </div>
                    </div>
                  </section>

                  <section ref={el => { sectionRefs.current['divisibility-wall'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-[2rem] text-yellow-400">
                        <Scale className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">Architecture: Divisibility Wall</h3>
                    </div>

                    <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] flex flex-col gap-8">
                      <p className="text-lg text-white/60 leading-relaxed font-medium">
                        Kimi-K2 has a hidden dimension of <span className="text-yellow-400 font-black">12,288</span>. Tensor Parallelism requires the sharding factor to be an integer divisor of this dimension.
                      </p>

                      <div className="grid grid-cols-2 gap-10">
                         <div className="bg-emerald-500/5 p-8 border border-emerald-500/10 rounded-[2.5rem]">
                            <h5 className="text-emerald-400 font-black uppercase text-xs mb-4">Valid TP Factors</h5>
                            <ul className="space-y-3 font-mono text-xs text-white/50">
                               <li className="flex justify-between"><span>Nodes: 2</span><span>12288 / 2 = 6144</span></li>
                               <li className="flex justify-between"><span>Nodes: 3</span><span>12288 / 3 = 4096</span></li>
                               <li className="flex justify-between"><span>Nodes: 4</span><span>12288 / 4 = 3072</span></li>
                               <li className="flex justify-between"><span>Nodes: 6</span><span>12288 / 6 = 2048</span></li>
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
                      <h3 className="codex-heading text-2xl text-white">MLA Compression Efficacy</h3>
                    </div>
                    <div className="p-12 bg-white/[0.03] border border-white/10 rounded-[3rem] space-y-10">
                      <p className="text-lg text-white/60 leading-relaxed font-medium">
                        Kimi-K2 implements <span className="text-emerald-400 font-black">Multi-Head Latent Attention (MLA)</span>. Benchmarks show this compresses KV-cache ~4-8x compared to standard Llama architectures.
                      </p>
                      <div className="grid grid-cols-3 gap-8">
                         <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 text-center">
                            <span className="codex-label text-white/30">Context Window</span>
                            <div className="text-2xl font-black text-white font-orbitron mt-1">128,000</div>
                         </div>
                         <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 text-center">
                            <span className="codex-label text-white/30">KV Load @ 8k Tokens</span>
                            <div className="text-2xl font-black text-emerald-400 font-orbitron mt-1">~10% VRAM</div>
                         </div>
                         <div className="p-8 bg-black/40 rounded-[2rem] border border-white/5 text-center">
                            <span className="codex-label text-white/30">Memory Limit</span>
                            <div className="text-2xl font-black text-cyan-400 font-orbitron mt-1">Never Hit</div>
                         </div>
                      </div>
                      <p className="text-[11px] text-white/30 italic text-center leading-relaxed">
                        Data confirms: Kimi-K2 terminates via EOS model behavior around 11,000 tokens, long before VRAM capacity is exhausted on the 2.5TB Chakra cluster.
                      </p>
                    </div>
                  </section>

                  {/* ── Chakra vs Enterprise Comparison ─────────────────── */}
                  <section ref={el => { sectionRefs.current['cluster-comparison'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] text-purple-400">
                        <Scale className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">Chakra vs Enterprise</h3>
                    </div>

                    <div className="space-y-10">
                      {/* Honest framing */}
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        Comparing a <span className="text-purple-400 font-black">desk-side research cluster</span> to an enterprise GPU server is like comparing a home workshop to a factory floor. Both build things — but they serve fundamentally different purposes. Here is an honest look.
                      </div>

                      {/* Performance bars — strictly proportional */}
                      <div className="p-10 bg-black/40 border border-white/10 rounded-[2.5rem] space-y-8">
                        <h4 className="codex-label text-white/50 mb-6">Performance Comparison (Proportional)</h4>

                        {/* Compute TFLOPS — DGX wins massively */}
                        <div className="space-y-2">
                          <div className="flex justify-between codex-label">
                            <span className="text-emerald-400">DGX H100 — FP16 Compute</span>
                            <span className="text-white/40">15,840 TFLOPS</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between codex-label">
                            <span className="text-purple-400">Chakra Cluster — FP16 Compute</span>
                            <span className="text-white/40">~236 TFLOPS</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${(236 / 15840) * 100}%` }} />
                          </div>
                          <p className="text-[10px] text-white/15 italic text-right">67× less raw compute</p>
                        </div>

                        {/* Memory — Chakra wins */}
                        <div className="space-y-2 mt-6">
                          <div className="flex justify-between codex-label">
                            <span className="text-purple-400">Chakra Cluster — Unified Memory</span>
                            <span className="text-white/40">2,560 GB</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500/60 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between codex-label">
                            <span className="text-emerald-400">DGX H100 — HBM3</span>
                            <span className="text-white/40">640 GB</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${(640 / 2560) * 100}%` }} />
                          </div>
                          <p className="text-[10px] text-white/15 italic text-right">4× less memory (but 14× faster bandwidth)</p>
                        </div>

                        {/* Cost — Chakra wins */}
                        <div className="space-y-2 mt-6">
                          <div className="flex justify-between codex-label">
                            <span className="text-emerald-400">DGX H100 — Cost</span>
                            <span className="text-white/40">~A$500,000</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between codex-label">
                            <span className="text-purple-400">Chakra Cluster — Cost</span>
                            <span className="text-white/40">~A$45,000</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${(45000 / 500000) * 100}%` }} />
                          </div>
                          <p className="text-[10px] text-white/15 italic text-right">91% less cost</p>
                        </div>

                        {/* Power */}
                        <div className="space-y-2 mt-6">
                          <div className="flex justify-between codex-label">
                            <span className="text-emerald-400">DGX H100 — Power Draw</span>
                            <span className="text-white/40">10,200W</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between codex-label">
                            <span className="text-purple-400">Chakra Cluster — Power Draw</span>
                            <span className="text-white/40">~350W</span>
                          </div>
                          <div className="h-5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${(350 / 10200) * 100}%` }} />
                          </div>
                          <p className="text-[10px] text-white/15 italic text-right">97% less power — runs on a standard outlet</p>
                        </div>
                      </div>

                      {/* Honest concurrency callout */}
                      <div className="p-10 bg-red-500/[0.03] border border-red-500/15 rounded-[2.5rem]">
                        <h4 className="codex-label text-red-400 mb-4 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> The Critical Difference
                        </h4>
                        <p className="text-xs text-white/40 leading-relaxed italic">
                          Chakra is a <strong className="text-white">single-user research system</strong>. One person, one inference at a time. A DGX H100 serves <strong className="text-white">hundreds of concurrent requests</strong> with continuous batching, tensor cores optimized for throughput, and NVLink bandwidth that exceeds Thunderbolt 5 by 50×. These are fundamentally different tools for fundamentally different jobs.
                        </p>
                      </div>

                      {/* Right Tool framing */}
                      <div className="grid grid-cols-3 gap-6">
                        <div className="p-8 bg-purple-500/[0.03] border border-purple-500/15 rounded-[2rem] text-center">
                          <h5 className="codex-label text-purple-400 mb-3">Learning & R&D</h5>
                          <p className="text-[10px] text-white/30 leading-relaxed italic">Build intuition about distributed inference. Experiment with topologies, quantization, and model architectures. Understand the concepts before scaling.</p>
                          <span className="codex-label text-purple-400/60 mt-4 block">Chakra</span>
                        </div>
                        <div className="p-8 bg-emerald-500/[0.03] border border-emerald-500/15 rounded-[2rem] text-center">
                          <h5 className="codex-label text-emerald-400 mb-3">Production</h5>
                          <p className="text-[10px] text-white/30 leading-relaxed italic">Serve thousands of users. SLAs, uptime guarantees, continuous batching, auto-scaling. This is where NVIDIA and cloud providers excel.</p>
                          <span className="codex-label text-emerald-400/60 mt-4 block">Cloud / NVIDIA</span>
                        </div>
                        <div className="p-8 bg-cyan-500/[0.03] border border-cyan-500/15 rounded-[2rem] text-center">
                          <h5 className="codex-label text-cyan-400 mb-3">Air-Gapped / Privacy</h5>
                          <p className="text-[10px] text-white/30 leading-relaxed italic">Sensitive data that cannot leave your premises. Medical, legal, defense. No cloud dependency, no API keys, no network required.</p>
                          <span className="codex-label text-cyan-400/60 mt-4 block">Chakra</span>
                        </div>
                      </div>

                      {/* Accessibility note */}
                      <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2rem]">
                        <p className="text-xs text-white/30 leading-relaxed italic text-center">
                          <span className="text-white/50 font-black">Accessibility note:</span> A pair of $600 Mac Minis running a 32B model can reproduce most of the learning demonstrated by this cluster. The cluster exists to push into frontier-scale territory (600B+) — you don't need one to understand distributed inference.
                        </p>
                      </div>
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
                      <h3 className="codex-heading text-2xl text-white">Cluster Foundations</h3>
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
                      <h3 className="codex-heading text-2xl text-white">Mesh vs Ring Topology</h3>
                    </div>
                    <div className="space-y-10">
                      <div className="grid grid-cols-2 gap-10">
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-red-500">RING PIPELINE (PP)</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">The "Bucket Brigade". Activations flow stage-to-stage. Tolerates high-latency networks (TCP/10GbE). 100% stable in production based on Jan 2026 tests.</p>
                        </div>
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-cyan-400">TENSOR MESH (TP)</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">The "Blitz". Tensors sharded across fabric. Direct peer-to-peer sync. Requires sub-50us RDMA latency for performance scaling to 16+ tok/s.</p>
                        </div>
                      </div>

                      {/* Topology Decision Tree */}
                      <div className="p-10 bg-white/[0.02] border border-white/10 rounded-[2.5rem]">
                        <h4 className="codex-heading text-sm text-white/50 mb-8">Topology Decision Tree</h4>
                        <div className="space-y-4 font-mono text-xs">
                          <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/5">
                            <span className="text-amber-400 font-black shrink-0 w-5">1.</span>
                            <span className="text-white/50">Does the model fit on a single node (≤ 512 GB)?</span>
                            <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                            <span className="text-emerald-400 font-black">SINGLE or EP</span>
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/5 ml-8">
                            <span className="text-amber-400 font-black shrink-0 w-5">↳</span>
                            <span className="text-white/50">Need to serve multiple users simultaneously?</span>
                            <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                            <span className="text-cyan-400 font-black">EP (1 model per node)</span>
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/5">
                            <span className="text-amber-400 font-black shrink-0 w-5">2.</span>
                            <span className="text-white/50">Model too large for one node. Need low latency for chat?</span>
                            <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                            <span className="text-cyan-400 font-black">TP (fastest TTFT)</span>
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/5 ml-8">
                            <span className="text-amber-400 font-black shrink-0 w-5">↳</span>
                            <span className="text-white/50">Do attention heads divide evenly by node count?</span>
                            <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                            <span className="text-red-400 font-black">If no → PP instead</span>
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/5">
                            <span className="text-amber-400 font-black shrink-0 w-5">3.</span>
                            <span className="text-white/50">Maximum memory pooling, any model size?</span>
                            <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                            <span className="text-red-500 font-black">PP (any split works)</span>
                          </div>
                          <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-xl border border-white/5 ml-8">
                            <span className="text-amber-400 font-black shrink-0 w-5">↳</span>
                            <span className="text-white/50">Context &gt; 1,000 tokens on PP5?</span>
                            <ArrowRight className="w-4 h-4 text-white/20 shrink-0" />
                            <span className="text-red-400 font-black">Watch GPU timeout!</span>
                          </div>
                        </div>
                      </div>

                      {/* PP vs TP Data Flow Animation */}
                      <div className="p-10 bg-black/40 border border-white/10 rounded-[2.5rem]">
                        <h4 className="codex-heading text-sm text-white/50 mb-8">Data Flow: Pipeline vs Tensor</h4>
                        <div className="grid grid-cols-2 gap-10">
                          {/* Pipeline Parallel — Sequential */}
                          <div className="flex flex-col items-center gap-4">
                            <span className="codex-label text-red-400">Pipeline: Sequential</span>
                            <svg viewBox="0 0 280 120" className="w-full" style={{ maxWidth: 280 }}>
                              {/* 4 layer blocks in a chain */}
                              {[0, 1, 2, 3].map(i => (
                                <g key={i}>
                                  <rect x={10 + i * 68} y={30} width={56} height={60} rx={8} fill="none"
                                    stroke={['#ef4444', '#f97316', '#eab308', '#22c55e'][i]} strokeWidth={1.5} opacity={0.5} />
                                  <text x={10 + i * 68 + 28} y={65} textAnchor="middle" fill="white" opacity={0.3}
                                    fontSize={9} fontWeight={700} fontFamily="monospace">L{i + 1}</text>
                                </g>
                              ))}
                              {/* Connecting arrows */}
                              {[0, 1, 2].map(i => (
                                <line key={`arr-${i}`} x1={66 + i * 68} y1={60} x2={78 + i * 68} y2={60}
                                  stroke="white" strokeWidth={1} opacity={0.15} markerEnd="url(#ppArrow)" />
                              ))}
                              {/* Particle flowing sequentially through all 4 — 8s duration = visually slow */}
                              <circle r={5} fill="#06b6d4" opacity={0.9}>
                                <animateMotion dur="8s" repeatCount="indefinite"
                                  path="M 38,60 L 106,60 L 174,60 L 242,60" />
                                <animate attributeName="opacity" values="0.9;0.5;0.9" dur="2s" repeatCount="indefinite" />
                              </circle>
                              <defs>
                                <marker id="ppArrow" markerWidth={6} markerHeight={4} refX={5} refY={2} orient="auto">
                                  <path d="M0,0 L6,2 L0,4" fill="white" opacity={0.15} />
                                </marker>
                              </defs>
                            </svg>
                            <span className="text-[10px] text-white/20 font-mono">~4× slower — each layer waits for the previous</span>
                          </div>

                          {/* Tensor Parallel — Simultaneous */}
                          <div className="flex flex-col items-center gap-4">
                            <span className="codex-label text-cyan-400">Tensor: Simultaneous</span>
                            <svg viewBox="0 0 280 120" className="w-full" style={{ maxWidth: 280 }}>
                              {/* 4 layer blocks side-by-side */}
                              {[0, 1, 2, 3].map(i => (
                                <g key={i}>
                                  <rect x={10 + i * 68} y={30} width={56} height={60} rx={8} fill="none"
                                    stroke={['#ef4444', '#f97316', '#eab308', '#22c55e'][i]} strokeWidth={1.5} opacity={0.5} />
                                  <text x={10 + i * 68 + 28} y={65} textAnchor="middle" fill="white" opacity={0.3}
                                    fontSize={9} fontWeight={700} fontFamily="monospace">N{i + 1}</text>
                                </g>
                              ))}
                              {/* 4 particles arriving simultaneously — 2s duration = visually fast */}
                              {[0, 1, 2, 3].map(i => (
                                <circle key={`tp-${i}`} r={5} fill="#06b6d4" opacity={0.9}>
                                  <animateMotion dur="2s" repeatCount="indefinite"
                                    path={`M ${38 + i * 68},15 L ${38 + i * 68},95`} />
                                  <animate attributeName="opacity" values="0.9;0.5;0.9" dur="0.5s" repeatCount="indefinite" />
                                </circle>
                              ))}
                              {/* Sync bar at bottom */}
                              <rect x={10} y={100} width={272} height={3} rx={1.5} fill="#06b6d4" opacity={0.15} />
                              <rect x={10} y={100} width={272} height={3} rx={1.5} fill="#06b6d4" opacity={0.4}>
                                <animate attributeName="opacity" values="0.1;0.4;0.1" dur="2s" repeatCount="indefinite" />
                              </rect>
                            </svg>
                            <span className="text-[10px] text-white/20 font-mono">~4× faster — all nodes process in parallel</span>
                          </div>
                        </div>
                        <p className="codex-caption italic text-center mt-6">Animation timing reflects real-world speed difference between PP and TP topologies</p>
                      </div>
                    </div>
                  </section>
                  <section ref={el => { sectionRefs.current['tps-ttft'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-cyan-500/10 border border-cyan-500/20 rounded-[2rem] text-cyan-400">
                        <Gauge className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">TPS &amp; TTFT</h3>
                    </div>
                    <div className="space-y-10">
                      <div className="grid grid-cols-2 gap-10">
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-emerald-400">Tokens Per Second</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">How fast the model generates output. Higher is better for interactive use. Affected by model size, quantization, topology, and context length. A 32B model at Q4 on a single node might hit 40 T/s — the same model on TP4 may hit 15 T/s, trading per-token speed for the ability to run larger models.</p>
                        </div>
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-cyan-400">Time to First Token</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">The delay before the first token appears — the "thinking" pause. Dominated by prefill: the model must process every token in the context before generating. Scales with context length: 4K context ≈ 0.5s, 32K ≈ 2s, 131K ≈ 8s+. In Pipeline Parallel mode, TTFT multiplies by stage count (each node processes sequentially).</p>
                        </div>
                      </div>
                      <div className="p-10 bg-white/[0.02] border border-white/10 rounded-[2.5rem]">
                        <h4 className="codex-heading text-sm text-white/50 mb-6">The Trade-off Triangle</h4>
                        <div className="grid grid-cols-3 gap-6 text-center">
                          <div className="flex flex-col gap-2">
                            <span className="text-3xl font-black text-emerald-400">TPS</span>
                            <span className="text-[10px] text-white/30 uppercase tracking-wider">Speed</span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <span className="text-3xl font-black text-cyan-400">TTFT</span>
                            <span className="text-[10px] text-white/30 uppercase tracking-wider">Responsiveness</span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <span className="text-3xl font-black text-purple-400">Quality</span>
                            <span className="text-[10px] text-white/30 uppercase tracking-wider">Perplexity</span>
                          </div>
                        </div>
                        <p className="text-xs text-white/30 leading-relaxed mt-6 text-center italic">You can optimize for two at the cost of the third. Lower quantization improves TPS but hurts quality. Longer context improves quality but increases TTFT. The simulation lets you find your sweet spot.</p>
                      </div>
                    </div>
                  </section>
                  <section ref={el => { sectionRefs.current['kv-cache'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] text-purple-400">
                        <Database className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">KV Cache &amp; Node Memory</h3>
                    </div>
                    <div className="space-y-10">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        The KV (Key-Value) cache stores every token the model has seen during a conversation. It is the model's <span className="text-purple-400 font-black">working memory</span> — without it, the model would forget everything before the current token.
                      </div>
                      <div className="grid grid-cols-2 gap-10">
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-purple-400">KV Cache in TP Mode</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">In Tensor Parallel, each node holds a shard of the attention heads. A model with 64 heads on TP4 gives each node 16 heads — and each node only generates and stores KV entries for its own 16 heads. The cache is genuinely split 1/N per node. The all-reduce sync happens on attention output, not on the cache itself.</p>
                        </div>
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-cyan-400">KV Cache in PP Mode</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">In Pipeline Parallel, each node owns a sequential range of layers. Each node generates a full KV cache — but only for its own layers. The entries never need to cross node boundaries during generation, because each token attends only within the layers present on that node. The per-node cost is naturally total/N.</p>
                        </div>
                      </div>
                      <div className="p-10 bg-white/[0.02] border border-white/10 rounded-[2.5rem]">
                        <h4 className="codex-heading text-sm text-white/50 mb-6">MLA vs GQA: The Compression Factor</h4>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <span className="text-xl font-black text-amber-400 font-mono">4,096 B/token/layer</span>
                            <p className="text-[10px] text-white/30 mt-2 uppercase tracking-wider">GQA (Llama, Qwen)</p>
                            <p className="text-xs text-white/40 mt-3 leading-relaxed italic">Standard Grouped Query Attention stores full K and V vectors per head group. At 8 KV heads × 128 dimensions × 2 (K+V) × 2 bytes = 4 KB per token per layer.</p>
                          </div>
                          <div>
                            <span className="text-xl font-black text-emerald-400 font-mono">1,152 B/token/layer</span>
                            <p className="text-[10px] text-white/30 mt-2 uppercase tracking-wider">MLA (Kimi, DeepSeek)</p>
                            <p className="text-xs text-white/40 mt-3 leading-relaxed italic">Multi-Latent Attention compresses K+V into a low-rank latent. Only (512 rank + 64 rope) × 2 bytes = 1,152 B/token/layer. This is why Kimi K2.5 at 4K context shows just 18 MB of KV cache per node on TP4.</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                        <h4 className="codex-display text-amber-400">Batch Mode &amp; KV Cache</h4>
                        <p className="text-xs text-white/40 leading-relaxed italic">When batch mode is enabled, the server processes multiple requests simultaneously. Each concurrent request needs its own KV cache — so batch=4 means 4× the cache memory. This is why the memory bar grows when you enable batching. The trade-off: higher aggregate throughput (more tokens per second across all requests), but each individual request gets a smaller share of compute.</p>
                      </div>

                      {/* Yogi's Take — Context Window */}
                      <div className="p-6 bg-amber-500/[0.03] border border-amber-500/15 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-amber-400 text-sm">🐾</span>
                          <span className="codex-label text-amber-400/60">Yogi&apos;s Take</span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed italic">Yogi can hold about one command in her head at a time. &ldquo;Sit... stay... come!&rdquo; — by &ldquo;come&rdquo;, she&apos;s forgotten &ldquo;sit&rdquo;. Her context window is about 3 seconds. LLMs have the same tradeoff — longer memory costs more compute.</p>
                      </div>
                    </div>
                  </section>

                  {/* ── Quantization & Quality ───────────────────────────── */}
                  <section ref={el => { sectionRefs.current['quantization'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] text-amber-400">
                        <Sliders className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">Quantization &amp; Quality</h3>
                    </div>
                    <div className="space-y-10">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        Quantization is lossy compression for neural networks. Imagine recording a symphony — the studio master (FP16) captures every overtone. Each quantization step reduces the <span className="text-amber-400 font-black">bit depth</span>, like lowering the sample rate on an audio file. The melody survives, but the subtlety fades.
                      </div>

                      {/* The Signal Metaphor */}
                      <div className="p-10 bg-white/[0.02] border border-white/10 rounded-[2.5rem]">
                        <h4 className="codex-heading text-sm text-white/50 mb-8">The Signal Degradation Curve</h4>
                        <div className="grid grid-cols-3 gap-6">
                          <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl text-center">
                            <div className="text-3xl mb-2">〰️</div>
                            <span className="codex-label text-emerald-400">FP16 — Studio Master</span>
                            <p className="text-[10px] text-white/30 mt-2">Smooth, continuous signal. Every weight stored at full 16-bit precision. The reference point.</p>
                          </div>
                          <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl text-center">
                            <div className="text-3xl mb-2">📶</div>
                            <span className="codex-label text-cyan-400">Q4 — Good Podcast</span>
                            <p className="text-[10px] text-white/30 mt-2">Staircase approximation of the curve. 4 bits per weight. You lose the overtones but the melody is intact.</p>
                          </div>
                          <div className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl text-center">
                            <div className="text-3xl mb-2">📞</div>
                            <span className="codex-label text-red-400">Q2 — Phone Call</span>
                            <p className="text-[10px] text-white/30 mt-2">Extreme staircase. 2 bits per weight. You get the meaning but the nuance is gone. Hallucination risk rises.</p>
                          </div>
                        </div>
                      </div>

                      {/* Bit-Level Visualization */}
                      <div className="p-10 bg-black/40 border border-white/10 rounded-[2.5rem]">
                        <h4 className="codex-heading text-sm text-white/50 mb-8">Bit-Level Signal Representation</h4>
                        <div className="space-y-6">
                          {/* FP16 — 16 bits */}
                          <div className="flex items-center gap-4">
                            <span className="codex-label text-emerald-400 w-12 text-right">FP16</span>
                            <div className="flex gap-1">
                              {/* Sign (1 bit) */}
                              <div className="w-6 h-6 rounded bg-red-500/60 border border-red-500/30" title="Sign bit" />
                              {/* Exponent (5 bits) */}
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div key={`e16-${i}`} className="w-6 h-6 rounded bg-teal-500/60 border border-teal-500/30" title="Exponent" />
                              ))}
                              {/* Mantissa (10 bits) */}
                              {Array.from({ length: 10 }).map((_, i) => (
                                <div key={`m16-${i}`} className="w-6 h-6 rounded bg-amber-500/60 border border-amber-500/30" title="Mantissa" />
                              ))}
                            </div>
                            <span className="text-[10px] text-white/20 font-mono">16 bits — full precision</span>
                          </div>

                          {/* Q8 — 8 bits */}
                          <div className="flex items-center gap-4">
                            <span className="codex-label text-cyan-400 w-12 text-right">Q8</span>
                            <div className="flex gap-1">
                              <div className="w-6 h-6 rounded bg-red-500/60 border border-red-500/30" />
                              {Array.from({ length: 3 }).map((_, i) => (
                                <div key={`e8-${i}`} className="w-6 h-6 rounded bg-teal-500/60 border border-teal-500/30" />
                              ))}
                              {Array.from({ length: 4 }).map((_, i) => (
                                <div key={`m8-${i}`} className="w-6 h-6 rounded bg-amber-500/60 border border-amber-500/30" />
                              ))}
                              {/* Ghost cells — lost precision */}
                              {Array.from({ length: 8 }).map((_, i) => (
                                <div key={`g8-${i}`} className="w-6 h-6 rounded border border-dashed border-white/10 animate-pulse" style={{ animationDuration: '3s' }} />
                              ))}
                            </div>
                            <span className="text-[10px] text-white/20 font-mono">8 bits — ~99% quality</span>
                          </div>

                          {/* Q4 — 4 bits */}
                          <div className="flex items-center gap-4">
                            <span className="codex-label text-amber-400 w-12 text-right">Q4</span>
                            <div className="flex gap-1">
                              <div className="w-6 h-6 rounded bg-red-500/60 border border-red-500/30" />
                              {Array.from({ length: 1 }).map((_, i) => (
                                <div key={`e4-${i}`} className="w-6 h-6 rounded bg-teal-500/60 border border-teal-500/30" />
                              ))}
                              {Array.from({ length: 2 }).map((_, i) => (
                                <div key={`m4-${i}`} className="w-6 h-6 rounded bg-amber-500/60 border border-amber-500/30" />
                              ))}
                              {Array.from({ length: 12 }).map((_, i) => (
                                <div key={`g4-${i}`} className="w-6 h-6 rounded border border-dashed border-white/10 animate-pulse" style={{ animationDuration: '3s' }} />
                              ))}
                            </div>
                            <span className="text-[10px] text-white/20 font-mono">4 bits — ~93% quality</span>
                          </div>

                          {/* Q2 — 2 bits */}
                          <div className="flex items-center gap-4">
                            <span className="codex-label text-red-400 w-12 text-right">Q2</span>
                            <div className="flex gap-1">
                              <div className="w-6 h-6 rounded bg-red-500/60 border border-red-500/30" />
                              <div className="w-6 h-6 rounded bg-amber-500/40 border border-amber-500/20" />
                              {Array.from({ length: 14 }).map((_, i) => (
                                <div key={`g2-${i}`} className="w-6 h-6 rounded border border-dashed border-white/10 animate-pulse" style={{ animationDuration: '3s' }} />
                              ))}
                            </div>
                            <span className="text-[10px] text-white/20 font-mono">2 bits — ~70% quality</span>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="flex gap-6 mt-8 justify-center">
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500/60" /><span className="text-[10px] text-white/20">Sign</span></div>
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-teal-500/60" /><span className="text-[10px] text-white/20">Exponent</span></div>
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500/60" /><span className="text-[10px] text-white/20">Mantissa</span></div>
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded border border-dashed border-white/20" /><span className="text-[10px] text-white/20">Lost precision</span></div>
                        </div>

                        {/* Worked example */}
                        <div className="mt-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                          <p className="text-xs text-white/40 font-mono">
                            <span className="text-cyan-400">Kimi K2.5</span>: 1,000B params × <span className="text-amber-400">4 bits</span> ÷ 8 = <span className="text-white font-black">500 GB</span>
                            <span className="text-white/20 mx-3">|</span>
                            At <span className="text-emerald-400">FP16</span>: 1,000B × 16 bits ÷ 8 = <span className="text-white font-black">2,000 GB</span>
                          </p>
                          <p className="text-[10px] text-white/15 mt-2 italic">Q4 makes the impossible possible — a trillion-parameter model fits across 5 Mac Studios</p>
                        </div>
                      </div>

                      {/* Quality Spectrum Table */}
                      <div className="grid grid-cols-1 overflow-hidden border border-white/10 rounded-[2.5rem] bg-white/[0.02]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="p-6 codex-label text-white/40">Format</th>
                              <th className="p-6 codex-label text-white/40 text-center">Bits/Weight</th>
                              <th className="p-6 codex-label text-white/40 text-center">Quality</th>
                              <th className="p-6 codex-label text-white/40 text-center">Memory</th>
                              <th className="p-6 codex-label text-white/40">Use Case</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-bold text-white/60">
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-emerald-400">FP16</td>
                              <td className="p-6 text-center font-mono">16</td>
                              <td className="p-6 text-center"><span className="text-emerald-400">100%</span></td>
                              <td className="p-6 text-center font-mono">2× params GB</td>
                              <td className="p-6 text-white/40 italic">Research, fine-tuning, reference baseline</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-emerald-400">Q8</td>
                              <td className="p-6 text-center font-mono">8</td>
                              <td className="p-6 text-center"><span className="text-emerald-400">~99%</span></td>
                              <td className="p-6 text-center font-mono">1× params GB</td>
                              <td className="p-6 text-white/40 italic">Premium production — nearly indistinguishable</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-cyan-400">Q6</td>
                              <td className="p-6 text-center font-mono">6</td>
                              <td className="p-6 text-center"><span className="text-cyan-400">~97%</span></td>
                              <td className="p-6 text-center font-mono">0.75× params GB</td>
                              <td className="p-6 text-white/40 italic">High-quality production with memory savings</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-amber-400">Q4</td>
                              <td className="p-6 text-center font-mono">4</td>
                              <td className="p-6 text-center"><span className="text-amber-400">~93%</span></td>
                              <td className="p-6 text-center font-mono">0.5× params GB</td>
                              <td className="p-6 text-white/40 italic">Sweet spot — best quality-per-GB. Default choice</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-orange-400">Q3</td>
                              <td className="p-6 text-center font-mono">3</td>
                              <td className="p-6 text-center"><span className="text-orange-400">~85%</span></td>
                              <td className="p-6 text-center font-mono">0.375× params GB</td>
                              <td className="p-6 text-white/40 italic">Aggressive compression, noticeable degradation</td>
                            </tr>
                            <tr>
                              <td className="p-6 text-red-400">Q2</td>
                              <td className="p-6 text-center font-mono">2</td>
                              <td className="p-6 text-center"><span className="text-red-400">~70%</span></td>
                              <td className="p-6 text-center font-mono">0.25× params GB</td>
                              <td className="p-6 text-white/40 italic">Edge/experiment only — hallucination risk</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* The Precision Tax */}
                      <div className="grid grid-cols-2 gap-8">
                        <div className="p-10 bg-white/[0.03] border border-white/5 rounded-[2.5rem]">
                          <h4 className="codex-label text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-amber-400" /> The Precision Tax
                          </h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">
                            Going from Q4 to FP16 costs <strong className="text-white">4× the memory</strong> for just 7% more quality. That last 7% is the "precision tax" — only worth paying if your task demands surgical accuracy (medical diagnosis, legal analysis, mathematical proofs).
                          </p>
                        </div>
                        <div className="p-10 bg-white/[0.03] border border-white/5 rounded-[2.5rem]">
                          <h4 className="codex-label text-white mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-cyan-400" /> Speed Bonus
                          </h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">
                            Lower quantization = fewer bytes to move through the memory bus = <strong className="text-white">faster generation</strong>. A Q4 model often generates tokens 2-3× faster than FP16, because the GPU spends less time waiting for data. This is why the simulator shows TPS climb as you lower the quant.
                          </p>
                        </div>
                      </div>

                      {/* Yogi's Take — Lossy Recall */}
                      <div className="p-6 bg-amber-500/[0.03] border border-amber-500/15 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-amber-400 text-sm">🐾</span>
                          <span className="codex-label text-amber-400/60">Yogi&apos;s Take</span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed italic">Yogi remembers &ldquo;sit&rdquo; perfectly — high precision. She sort of remembers &ldquo;shake&rdquo; — medium precision. She has no idea what &ldquo;roll over&rdquo; means anymore — that memory got quantized to zero. Not all weights are equal.</p>
                      </div>
                    </div>
                  </section>

                  {/* ── Metal GPU Timeout ─────────────────────────────────── */}
                  <section ref={el => { sectionRefs.current['gpu-timeout'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-[2rem] text-red-400">
                        <Timer className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">Metal GPU Timeout</h3>
                    </div>
                    <div className="space-y-10">
                      <div className="p-12 bg-red-500/[0.03] border border-red-500/20 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        <span className="text-red-400 font-black">Apple Metal enforces a ~60 second timeout</span> on GPU command buffer execution. This is a hard limit baked into the Metal framework — it cannot be configured, extended, or disabled. Exceeding it triggers a <span className="text-red-400 font-black">kernel panic and node reboot</span>, not a graceful error.
                      </div>

                      {/* Why PP is Dangerous */}
                      <div className="grid grid-cols-2 gap-10">
                        <div className="p-10 bg-red-500/[0.03] border border-red-500/10 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-red-400">Pipeline Parallel: The Multiplier</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">In PP mode, each stage processes the <strong>entire context sequentially</strong> before passing to the next node. Total prefill time = N stages × per-stage time. With PP5 and a 1,500-token context on a 600B model, each stage may take 12+ seconds — total: 60+ seconds. Kernel panic.</p>
                        </div>
                        <div className="p-10 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-emerald-400">Tensor Parallel: The Divider</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">In TP mode, all nodes process <strong>every layer simultaneously</strong>. Prefill runs in parallel — the wall-clock time is the same as a single node handling 1/N of the compute. TP4 can safely process 8,000+ tokens before approaching the timeout boundary.</p>
                        </div>
                      </div>

                      {/* Context Limit Table */}
                      <div className="grid grid-cols-1 overflow-hidden border border-white/10 rounded-[2.5rem] bg-white/[0.02]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="p-6 codex-label text-white/40">Mode</th>
                              <th className="p-6 codex-label text-white/40 text-center">Max Safe Context</th>
                              <th className="p-6 codex-label text-white/40 text-center">Crash Threshold</th>
                              <th className="p-6 codex-label text-white/40">Why</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-bold text-white/60">
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-red-400">PP5</td>
                              <td className="p-6 text-center font-mono">~1,000</td>
                              <td className="p-6 text-center font-mono text-red-400">~1,500</td>
                              <td className="p-6 text-white/40 italic">5 sequential stages multiply prefill time</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-orange-400">PP4</td>
                              <td className="p-6 text-center font-mono">~1,200</td>
                              <td className="p-6 text-center font-mono text-orange-400">~1,800</td>
                              <td className="p-6 text-white/40 italic">Fewer stages, slightly more headroom</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6 text-emerald-400">TP2</td>
                              <td className="p-6 text-center font-mono">~6,000</td>
                              <td className="p-6 text-center font-mono text-amber-400">~8,000</td>
                              <td className="p-6 text-white/40 italic">Parallel prefill, minimal coordination</td>
                            </tr>
                            <tr>
                              <td className="p-6 text-cyan-400">TP4</td>
                              <td className="p-6 text-center font-mono">~4,000</td>
                              <td className="p-6 text-center font-mono text-amber-400">Unknown</td>
                              <td className="p-6 text-white/40 italic">More nodes = more all-reduce overhead</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem]">
                        <h4 className="codex-label text-white mb-4 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" /> The Consequence
                        </h4>
                        <p className="text-xs text-white/40 leading-relaxed italic">
                          Unlike a software timeout that returns an error, Metal's timeout triggers a <strong className="text-red-400">kernel panic</strong>. The node reboots. RDMA state is lost. Other nodes in the topology may also crash as queue pairs become orphaned. This is why the simulator caps context warnings at the safe threshold for each topology — it's protecting the cluster from a hard crash, not just a slow response.
                        </p>
                      </div>

                      {/* Yogi's Take — Patience Limit */}
                      <div className="p-6 bg-amber-500/[0.03] border border-amber-500/15 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-amber-400 text-sm">🐾</span>
                          <span className="codex-label text-amber-400/60">Yogi&apos;s Take</span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed italic">Even Yogi has a timeout — about 4 seconds of &ldquo;stay&rdquo; before she breaks. Metal&apos;s GPU has 60 seconds. Both are hard limits. You can&apos;t negotiate with biology or silicon.</p>
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
                      <h3 className="codex-heading text-2xl text-white">Intelligence Spectrum</h3>
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

                    {/* Neural Network Particle Animation */}
                    <div className="p-10 bg-black/40 border border-white/10 rounded-[2.5rem] mt-10 flex flex-col items-center">
                      <h4 className="codex-heading text-sm text-white/50 mb-6 self-start">Neural Network in Motion</h4>
                      <svg viewBox="0 0 360 200" className="w-full" style={{ maxWidth: 360 }}>
                        {/* Input layer — 3 neurons */}
                        {[40, 100, 160].map((y, i) => (
                          <g key={`in-${i}`}>
                            <circle cx={60} cy={y} r={14} fill="none" stroke="#a855f7" strokeWidth={1.5} opacity={0.4} />
                            <circle cx={60} cy={y} r={4} fill="#a855f7" opacity={0.6}>
                              <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                            </circle>
                          </g>
                        ))}
                        {/* Hidden layer — 4 neurons */}
                        {[25, 75, 125, 175].map((y, i) => (
                          <g key={`hid-${i}`}>
                            <circle cx={180} cy={y} r={14} fill="none" stroke="#06b6d4" strokeWidth={1.5} opacity={0.4} />
                            <circle cx={180} cy={y} r={4} fill="#06b6d4" opacity={0.6}>
                              <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${1.5 + i * 0.4}s`} repeatCount="indefinite" />
                            </circle>
                          </g>
                        ))}
                        {/* Output layer — 2 neurons */}
                        {[70, 130].map((y, i) => (
                          <g key={`out-${i}`}>
                            <circle cx={300} cy={y} r={14} fill="none" stroke="#22c55e" strokeWidth={1.5} opacity={0.4} />
                            <circle cx={300} cy={y} r={4} fill="#22c55e" opacity={0.6}>
                              <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${2.5 + i * 0.5}s`} repeatCount="indefinite" />
                            </circle>
                          </g>
                        ))}
                        {/* Connection lines — input to hidden (faint) */}
                        {[40, 100, 160].map((iy) =>
                          [25, 75, 125, 175].map((hy, hi) => (
                            <line key={`ih-${iy}-${hi}`} x1={74} y1={iy} x2={166} y2={hy}
                              stroke="white" strokeWidth={0.5} opacity={0.06} />
                          ))
                        )}
                        {/* Connection lines — hidden to output (faint) */}
                        {[25, 75, 125, 175].map((hy) =>
                          [70, 130].map((oy, oi) => (
                            <line key={`ho-${hy}-${oi}`} x1={194} y1={hy} x2={286} y2={oy}
                              stroke="white" strokeWidth={0.5} opacity={0.06} />
                          ))
                        )}
                        {/* Animated particles — input to hidden */}
                        {[
                          { iy: 40, hy: 75, delay: '0s' },
                          { iy: 100, hy: 125, delay: '0.8s' },
                          { iy: 160, hy: 25, delay: '1.6s' },
                          { iy: 40, hy: 175, delay: '2.4s' },
                          { iy: 100, hy: 75, delay: '1.2s' },
                        ].map(({ iy, hy, delay }, i) => (
                          <circle key={`p1-${i}`} r={3} fill="#a855f7" opacity={0}>
                            <animateMotion dur="3s" repeatCount="indefinite" begin={delay}
                              path={`M 74,${iy} L 166,${hy}`} />
                            <animate attributeName="opacity" values="0;0.8;0.8;0" dur="3s" repeatCount="indefinite" begin={delay} />
                          </circle>
                        ))}
                        {/* Animated particles — hidden to output */}
                        {[
                          { hy: 75, oy: 70, delay: '0.5s' },
                          { hy: 125, oy: 130, delay: '1.3s' },
                          { hy: 25, oy: 70, delay: '2.1s' },
                          { hy: 175, oy: 130, delay: '2.9s' },
                        ].map(({ hy, oy, delay }, i) => (
                          <circle key={`p2-${i}`} r={3} fill="#06b6d4" opacity={0}>
                            <animateMotion dur="3s" repeatCount="indefinite" begin={delay}
                              path={`M 194,${hy} L 286,${oy}`} />
                            <animate attributeName="opacity" values="0;0.8;0.8;0" dur="3s" repeatCount="indefinite" begin={delay} />
                          </circle>
                        ))}
                        {/* Layer labels */}
                        <text x={60} y={192} textAnchor="middle" fill="white" opacity={0.2} fontSize={9} fontWeight={700} fontFamily="monospace">Input</text>
                        <text x={180} y={198} textAnchor="middle" fill="white" opacity={0.2} fontSize={9} fontWeight={700} fontFamily="monospace">Hidden</text>
                        <text x={300} y={165} textAnchor="middle" fill="white" opacity={0.2} fontSize={9} fontWeight={700} fontFamily="monospace">Output</text>
                      </svg>
                      <p className="codex-caption italic text-center mt-4">Signals flow forward through layers — each connection has a learned weight</p>
                    </div>

                    {/* Yogi's Take — Building a Brain */}
                    <div className="p-6 bg-amber-500/[0.03] border border-amber-500/15 rounded-2xl mt-10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-amber-400 text-sm">🐾</span>
                        <span className="codex-label text-amber-400/60">Yogi&apos;s Take</span>
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed italic">Yogi was born with a neural network of billions of neurons but zero training data. Every experience — every treat, every walk, every squirrel — adjusts her weights. She&apos;s fine-tuning in real-time, all day, every day.</p>
                    </div>
                  </section>

                  {/* ── Attention Mechanisms ──────────────────────────────── */}
                  <section ref={el => { sectionRefs.current['arch-attention'] = el; }}>
                    <div className="flex items-center gap-6 mb-10">
                      <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] text-emerald-400">
                        <Scan className="w-8 h-8" />
                      </div>
                      <h3 className="codex-heading text-2xl text-white">Attention Mechanisms</h3>
                    </div>
                    <div className="space-y-10">
                      <div className="p-12 bg-white/[0.02] border border-white/10 rounded-[3rem] text-lg text-white/60 leading-relaxed font-medium">
                        Attention is the core operation that lets a model relate every token to every other token. The <span className="text-emerald-400 font-black">mechanism</span> determines how much memory the model needs per token of context — and directly controls whether your context window costs gigabytes or megabytes.
                      </div>

                      {/* The Spectrum */}
                      <div className="grid grid-cols-1 overflow-hidden border border-white/10 rounded-[2.5rem] bg-white/[0.02]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5">
                              <th className="p-6 codex-label text-white/40">Mechanism</th>
                              <th className="p-6 codex-label text-white/40 text-center">KV Heads</th>
                              <th className="p-6 codex-label text-white/40 text-center">Cache / Token / Layer</th>
                              <th className="p-6 codex-label text-white/40">Models</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs font-bold text-white/60">
                            <tr className="border-b border-white/5">
                              <td className="p-6">
                                <span className="text-purple-400 font-black">MHA</span>
                                <p className="text-[10px] text-white/20 mt-1">Multi-Head Attention</p>
                              </td>
                              <td className="p-6 text-center font-mono">= Q heads</td>
                              <td className="p-6 text-center font-mono text-red-400">~16 KB</td>
                              <td className="p-6 text-white/40 italic">GPT-3, older models</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6">
                                <span className="text-amber-400 font-black">GQA</span>
                                <p className="text-[10px] text-white/20 mt-1">Grouped Query Attention</p>
                              </td>
                              <td className="p-6 text-center font-mono">Q ÷ group_size</td>
                              <td className="p-6 text-center font-mono text-amber-400">~4 KB</td>
                              <td className="p-6 text-white/40 italic">Llama 3, Qwen 2.5, Mixtral</td>
                            </tr>
                            <tr className="border-b border-white/5">
                              <td className="p-6">
                                <span className="text-cyan-400 font-black">MQA</span>
                                <p className="text-[10px] text-white/20 mt-1">Multi-Query Attention</p>
                              </td>
                              <td className="p-6 text-center font-mono">1</td>
                              <td className="p-6 text-center font-mono text-cyan-400">~0.5 KB</td>
                              <td className="p-6 text-white/40 italic">PaLM, Falcon, StarCoder</td>
                            </tr>
                            <tr>
                              <td className="p-6">
                                <span className="text-emerald-400 font-black">MLA</span>
                                <p className="text-[10px] text-white/20 mt-1">Multi-Latent Attention</p>
                              </td>
                              <td className="p-6 text-center font-mono">N/A (latent)</td>
                              <td className="p-6 text-center font-mono text-emerald-400">~1.1 KB</td>
                              <td className="p-6 text-white/40 italic">Kimi K2.5, DeepSeek V3</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* How it works */}
                      <div className="grid grid-cols-2 gap-10">
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-amber-400">GQA: The Grouping Trick</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">Instead of giving every query head its own K and V, GQA shares K/V across groups. Llama 3 uses 8 KV heads for 64 query heads — an 8:1 ratio. Each KV head serves 8 query heads. The cache shrinks proportionally: 8 × 128 dim × 2 (K+V) × 2 bytes = 4,096 bytes per token per layer.</p>
                        </div>
                        <div className="p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex flex-col gap-6">
                          <h4 className="codex-display text-emerald-400">MLA: The Compression Leap</h4>
                          <p className="text-xs text-white/40 leading-relaxed italic">MLA goes further — instead of storing raw K/V vectors, it projects them into a low-rank latent space. Kimi K2.5 uses a 512-dimensional latent + 64 RoPE dimensions. The decompression happens on-the-fly during attention. Result: 1,152 bytes/token/layer vs 4,096 for GQA — a 3.6× compression with minimal quality loss.</p>
                        </div>
                      </div>

                      {/* Why it matters for distributed */}
                      <div className="p-10 bg-white/[0.02] border border-white/10 rounded-[2.5rem]">
                        <h4 className="codex-heading text-sm text-white/50 mb-6">Why Attention Type Matters for Distributed Inference</h4>
                        <p className="text-xs text-white/40 leading-relaxed italic">
                          In Tensor Parallel mode, each node stores KV cache for its shard of the attention heads. With GQA's 8 KV heads on TP4, each node holds 2 KV heads — a clean split. With MLA, the latent is sharded differently (the compressed representation divides across nodes). In both cases, <strong className="text-white">the attention mechanism determines the per-node memory cost of long conversations</strong>. This is why Kimi K2.5 can handle 128K context windows that would overwhelm a GQA model of similar size — the MLA cache is 3.6× smaller at every context length.
                        </p>
                      </div>

                      {/* MoE clarification */}
                      <div className="p-10 bg-yellow-500/[0.03] border border-yellow-500/10 rounded-[2.5rem]">
                        <h4 className="codex-label text-yellow-400 mb-4 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Common Misconception: MoE Experts
                        </h4>
                        <p className="text-xs text-white/40 leading-relaxed italic">
                          MoE experts do <strong className="text-white">not</strong> specialize by subject domain ("one expert for math, one for code"). They specialize by <strong className="text-white">syntactic and structural patterns</strong> — token sequences, grammatical structures, and formatting conventions. A "code expert" doesn't know Python specifically; it recognizes the token patterns that code produces. This is why MoE models are general-purpose despite having specialized components.
                        </p>
                      </div>

                      {/* Yogi's Take — Selective Attention */}
                      <div className="p-6 bg-amber-500/[0.03] border border-amber-500/15 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-amber-400 text-sm">🐾</span>
                          <span className="codex-label text-amber-400/60">Yogi&apos;s Take</span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed italic">When Paul opens the treat bag, Yogi&apos;s brain allocates 100% processing power to that sound. Everything else vanishes. That&apos;s attention — choosing what matters. Transformers do the same thing with every token.</p>
                      </div>
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

// ── Trials Tab Content ────────────────────────────────────────────────

interface TrialsContentProps {
  sectionRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  resonance: import('../hooks/useResonanceState').ResonanceState;
  getModelProgress: (modelId: string) => import('../hooks/useResonanceState').ModelProgress;
  recordQuizScore: (trialId: string, score: number, total: number) => void;
  markSectionViewed: (sectionId: string) => void;
}

const TrialsContent: React.FC<TrialsContentProps> = ({ sectionRefs, resonance, getModelProgress, recordQuizScore, markSectionViewed }) => {
  const totalCompleted = resonance.totalTrialsCompleted;
  const totalTrials = TRIAL_DEFINITIONS.length;
  const [selectedTrialId, setSelectedTrialId] = useState<string | null>(null);

  // Find the codex data for the selected trial
  const selectedTrial = selectedTrialId
    ? TRIAL_DEFINITIONS.find(t => t.id === selectedTrialId)
    : null;
  const selectedCodex: TrialCodex | null =
    selectedTrial?.type === 'config' && selectedTrial.codex ? selectedTrial.codex : null;

  return (
    <>
      {/* Summary header */}
      <section>
        <div className="flex items-center gap-6 mb-10">
          <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] text-amber-400">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h3 className="codex-heading text-2xl text-white">Resonance Trials</h3>
            <p className="text-sm text-white/30 font-bold mt-1">
              {totalCompleted} / {totalTrials} trials completed
              {resonance.hasGraduated && <span className="text-amber-400 ml-3">GRADUATED</span>}
            </p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mb-16">
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-1000"
              style={{ width: `${totalTrials > 0 ? (totalCompleted / totalTrials) * 100 : 0}%` }}
            />
          </div>
        </div>
      </section>

      {/* Per-tier progress cards */}
      {TIER_META.map((tier, tierIndex) => {
        const progress = getModelProgress(tier.modelId);
        const modelTrials = TRIAL_DEFINITIONS.filter(t => t.modelId === tier.modelId);
        const completed = progress.completedTrials.length;
        const total = modelTrials.length;
        const pct = total > 0 ? (completed / total) * 100 : 0;

        return (
          <section key={tier.modelId} ref={el => { sectionRefs.current[`tier-${tierIndex}`] = el; }}>
            <div className={`p-10 bg-white/[0.02] border ${tier.borderColor} rounded-[2.5rem]`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <span className={`text-xs font-black uppercase tracking-[0.3em] ${tier.color}`}>
                    Tier {tierIndex + 1}
                  </span>
                  <span className="text-lg font-black text-white uppercase">{tier.label}</span>
                  {progress.mastered && (
                    <span className="codex-label px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/20">
                      MASTERED
                    </span>
                  )}
                </div>
                <span className="codex-tech text-sm text-white/40">{completed}/{total}</span>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-white/5 rounded-full overflow-hidden mb-6">
                <div
                  className={`h-full ${tier.bgColor} rounded-full transition-all duration-1000`}
                  style={{ width: `${pct}%`, opacity: pct > 0 ? 1 : 0 }}
                />
              </div>

              {/* Individual trial dots */}
              <div className="flex gap-3">
                {modelTrials.map((trial) => {
                  const isComplete = progress.completedTrials.includes(trial.id);
                  const hasCodex = trial.type === 'config' && !!trial.codex;
                  return (
                    <button
                      key={trial.id}
                      className={`flex flex-col items-center gap-2 ${
                        hasCodex ? 'cursor-pointer group/dot' : 'cursor-default'
                      }`}
                      title={`${trial.title}${isComplete ? ' (completed)' : ''}${hasCodex ? ' — click to open codex' : ''}`}
                      onClick={() => hasCodex && setSelectedTrialId(trial.id)}
                    >
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        isComplete
                          ? `${tier.bgColor} border-transparent`
                          : hasCodex
                            ? 'bg-white/5 border-white/10 group-hover/dot:border-purple-500/40 group-hover/dot:bg-purple-500/10'
                            : 'bg-white/5 border-white/10'
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        ) : hasCodex ? (
                          <BookOpen className="w-3 h-3 text-white/20 group-hover/dot:text-purple-400 transition-colors" />
                        ) : null}
                      </div>
                      <span className="codex-label text-white/20 text-center max-w-[60px] truncate">
                        {trial.level}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}

      {/* Codex Drawer — slides in when a trial dot with codex is clicked */}
      {selectedCodex && selectedTrial && (
        <CodexDrawer
          codex={selectedCodex}
          trialId={selectedTrial.id}
          trialTitle={selectedTrial.title}
          onClose={() => setSelectedTrialId(null)}
          onQuizPassed={recordQuizScore}
          onSectionViewed={markSectionViewed}
        />
      )}
    </>
  );
};

export default CodexPanel;
