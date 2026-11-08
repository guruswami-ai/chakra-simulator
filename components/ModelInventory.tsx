
import React, { useMemo } from 'react';
import { ModelInstance, NodeMetrics } from '../types';
import { Box, Layers, Database, ChevronRight, ExternalLink } from 'lucide-react';
import ConceptHelper from './ConceptHelper';

interface ModelInventoryProps {
  activeModels: ModelInstance[];
  nodes: NodeMetrics[];
}

const ModelInventory: React.FC<ModelInventoryProps> = ({ activeModels, nodes }) => {
  const globalVram = useMemo(() => {
    const totalGb = nodes.reduce((acc, node) => acc + node.ram_total, 0);
    if (totalGb >= 1024) {
      return { value: (totalGb / 1024).toFixed(1), unit: 'TB' };
    }
    return { value: totalGb.toString(), unit: 'GB' };
  }, [nodes]);

  return (
    <div className="bg-black/80 border border-white/10 p-7 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex flex-col gap-6 min-w-[320px] pointer-events-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black tracking-[0.4em] text-white/40 uppercase flex items-center gap-3">
          <Box className="w-4 h-4" />
          Model Inventory
        </h3>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 border border-cyan-400/20 rounded-md font-black">
          {activeModels.length} ACTIVE
        </span>
      </div>

      <div className="space-y-4">
        {activeModels.map((model) => (
          <div key={model.id} className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.06] transition-all">
            <div 
              className="absolute left-0 top-3 bottom-3 w-1 rounded-full" 
              style={{ backgroundColor: model.color }} 
            />
            <div className="flex justify-between items-start mb-2 pl-2">
              <div>
                <div className="text-xs font-black text-white uppercase tracking-tight mb-0.5">{model.name}</div>
                <div className="flex items-center">
                  <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest font-black">Architecture: MoE-128x</div>
                  <ConceptHelper 
                    term="Mixture of Experts (MoE)" 
                    definition="A sparse transformer architecture where only a subset of parameters (experts) are activated for each token, significantly increasing capacity without increasing compute cost per token." 
                    example="Enables 1.8T parameter models to run at the speed of much smaller dense models."
                  />
                </div>
              </div>
              <a 
                href={`https://huggingface.co/models?search=${model.name}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-white/20" />
              </a>
            </div>
            
            <div className="flex items-center gap-4 pl-2">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-purple-400/60" />
                <span className="text-[10px] font-mono text-white/60 font-black">1.8T Params</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-cyan-400/60" />
                <span className="text-[10px] font-mono text-white/60 font-black">614GB FP8</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
           <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1 flex items-center">
            Global VRAM
            <ConceptHelper 
              term="VRAM (Video RAM)" 
              definition="The dedicated high-bandwidth memory used to store model weights and the KV cache. In this cluster, VRAM is shared across all 5 Mac Studio nodes via JACCL." 
            />
           </span>
           <span className="text-sm font-black text-white font-mono">{globalVram.value} {globalVram.unit}</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
           <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1 flex items-center">
            Context Limit
            <ConceptHelper 
              term="Context Window" 
              definition="The maximum number of tokens the model can process in a single conversation. Larger windows require exponentially more VRAM for KV caching." 
            />
           </span>
           <span className="text-sm font-black text-white font-mono">128K</span>
        </div>
      </div>
    </div>
  );
};

export default ModelInventory;
