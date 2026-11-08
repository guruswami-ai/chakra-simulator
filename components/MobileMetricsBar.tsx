import React, { useState, useRef, useEffect } from 'react';
import { Cpu, Layers, Server, HardDrive, ChevronDown, X } from 'lucide-react';

export interface MobileMetrics {
  tps: number;
  ttft: number;
  topology: string;
  quantization: string;
  modelName: string;
  nodeCount: number;
  kvCachePercent: number;
}

interface MobileMetricsBarProps {
  metrics: MobileMetrics;
  /** The simulation panel content rendered inside the popover */
  children: React.ReactNode;
}

type Section = 'model' | 'quant' | 'topology' | 'context' | null;

const MobileMetricsBar: React.FC<MobileMetricsBarProps> = ({ metrics, children }) => {
  const [activeSection, setActiveSection] = useState<Section>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!activeSection) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveSection(null);
      }
    };
    // Delay to avoid immediately closing from the same click
    const t = setTimeout(() => document.addEventListener('click', handleClick), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', handleClick);
    };
  }, [activeSection]);

  const toggleSection = (section: Section) => {
    setActiveSection(prev => prev === section ? null : section);
  };

  return (
    <div className="relative z-30">
      {/* Metrics Row */}
      <div className="flex items-center gap-1 px-3 py-2 bg-black/85 border-b border-white/5">
        {/* TPS — primary metric, always visible */}
        <div className="flex items-baseline gap-1 mr-2">
          <span className="text-lg font-black font-mono text-emerald-400 tabular-nums">{metrics.tps.toFixed(1)}</span>
          <span className="text-[9px] font-bold text-emerald-400/60 uppercase">T/s</span>
        </div>

        {/* TTFT */}
        <div className="flex items-baseline gap-1 mr-2">
          <span className="text-sm font-black font-mono text-cyan-400 tabular-nums">{metrics.ttft.toFixed(2)}</span>
          <span className="text-[9px] font-bold text-cyan-400/60 uppercase">TTFT</span>
        </div>

        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* Tappable badges */}
        <button
          onClick={() => toggleSection('model')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
            activeSection === 'model' ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 text-white/50 active:bg-white/10'
          }`}
        >
          <Cpu className="w-3 h-3" />
          <span className="truncate max-w-[60px]">{metrics.modelName || 'Model'}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${activeSection === 'model' ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={() => toggleSection('quant')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
            activeSection === 'quant' ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/5 text-white/50 active:bg-white/10'
          }`}
        >
          <Layers className="w-3 h-3" />
          {metrics.quantization}
        </button>

        <button
          onClick={() => toggleSection('topology')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
            activeSection === 'topology' ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 text-white/50 active:bg-white/10'
          }`}
        >
          <Server className="w-3 h-3" />
          {metrics.topology.replace('_RDMA', '').replace('RING_', '')}
        </button>

        <button
          onClick={() => toggleSection('context')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
            activeSection === 'context' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/5 text-white/50 active:bg-white/10'
          }`}
        >
          <HardDrive className="w-3 h-3" />
          KV
        </button>
      </div>

      {/* Popover Panel */}
      {activeSection && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 right-0 z-40 max-h-[60vh] overflow-y-auto bg-black/95 border-b border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] drawer-transition"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
              {activeSection === 'model' ? 'Select Model' :
               activeSection === 'quant' ? 'Quantization' :
               activeSection === 'topology' ? 'Topology' : 'Context Length'}
            </span>
            <button
              onClick={() => setActiveSection(null)}
              className="p-1 text-white/30 hover:text-white/60 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileMetricsBar;
