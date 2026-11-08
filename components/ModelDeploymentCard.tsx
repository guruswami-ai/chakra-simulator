
import React from 'react';
import { ModelInstance } from '../types';
import { Activity, Zap, Database } from 'lucide-react';

interface ModelDeploymentCardProps {
  model: ModelInstance;
  compact?: boolean;
}

const ModelDeploymentCard: React.FC<ModelDeploymentCardProps> = ({ model, compact = false }) => {
  return (
    <div className={`bg-white/[0.03] border border-white/10 rounded-2xl ${compact ? 'p-4' : 'p-6'} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: model.color }} />
          <span className="text-sm font-black text-white uppercase tracking-wider">{model.name}</span>
        </div>
        <span className="text-[10px] font-mono text-white/30 uppercase">{model.mode}</span>
      </div>
      <div className="flex items-center gap-6 text-[10px] font-mono text-white/50">
        <span className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-cyan-400" />
          {model.tokPerSec.toFixed(1)} tok/s
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-amber-400" />
          {(model.medianTTFT * 1000).toFixed(0)}ms TTFT
        </span>
        <span className="flex items-center gap-1.5">
          <Database className="w-3 h-3 text-purple-400" />
          {model.activeRequests} req
        </span>
      </div>
    </div>
  );
};

export default ModelDeploymentCard;
