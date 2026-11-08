
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Play, Pause, Cpu, Layers, Zap, Server, HardDrive, Info, HelpCircle, SkipBack, SkipForward, Shuffle, Volume2, VolumeX, Music, Music2, BookMarked } from 'lucide-react';

// Inline help tooltip component — hover for quick tip, click ? for deep Guruswami explanation
const HelpTip: React.FC<{
  tip: string;
  controlType?: string;
  onHelpRequest?: (controlType: string) => void;
}> = ({ tip, controlType, onHelpRequest }) => (
  <div className="group relative inline-flex ml-1">
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (controlType && onHelpRequest) {
          const clickIdx = Math.floor(Math.random() * 7) + 1;
          const sfx = new Audio(`${import.meta.env.BASE_URL || '/'}guruswami/sfx/guru_clicked0000${clickIdx}.m4a`);
          sfx.volume = 0.25;
          sfx.play().catch(() => {});
          onHelpRequest(controlType);
        }
      }}
      className="focus:outline-none"
      title={controlType ? 'Click for detailed explanation' : undefined}
    >
      <HelpCircle className={`w-3 h-3 transition-colors ${
        controlType && onHelpRequest
          ? 'text-white/20 hover:text-amber-400 cursor-pointer'
          : 'text-white/20 hover:text-cyan-400 cursor-help'
      }`} />
    </button>
    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900/95 border border-white/10 rounded-lg text-[10px] text-white/80 leading-relaxed w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none">
      {tip}
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-gray-900/95 border-r border-b border-white/10 transform rotate-45 -mt-1" />
    </div>
  </div>
);
import { OnboardingStep, TUTORIAL_RECOMMENDED } from '../hooks/useGuruswamiState';
import { ClusterMode } from '../types';
import { CHAKRA_COLORS } from '../constants';
import {
  MODEL_CATALOG,
  ModelSpec,
  Quantization,
  QuantizationSpec,
  KV_CACHE_PRESETS,
  QUANTIZATION_DISPLAY,
  QUANT_ORDER,
  getNodeCount,
  getQualityColor,
  isTopologySupported,
  getIncompatibilityReason,
} from '../simulation/modelCatalog';

/**
 * Signal-fidelity waveform icon.
 * FP16 renders a smooth sine wave; Q2 renders a blocky stepped square wave.
 * The `steps` parameter controls the resolution — fewer steps = more aliasing.
 */
const QuantWaveform: React.FC<{ steps: number; color: string; width?: number; height?: number }> = ({
  steps, color, width = 28, height = 14,
}) => {
  // Generate a sine wave sampled at `steps` points, then rendered as a stepped polyline
  const points: string[] = [];
  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const mid = height / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = pad + t * w;
    const y = mid - Math.sin(t * Math.PI * 2) * (h * 0.42);

    if (steps <= 6) {
      // Stepped/blocky rendering for low-fidelity quantization
      if (i > 0) {
        const prevX = pad + ((i - 1) / steps) * w;
        const prevY = mid - Math.sin(((i - 1) / steps) * Math.PI * 2) * (h * 0.42);
        points.push(`${x.toFixed(1)},${prevY.toFixed(1)}`); // horizontal step
      }
    }
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={steps >= 18 ? 1.2 : steps >= 10 ? 1.4 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      {/* Baseline reference line */}
      <line x1={pad} y1={mid} x2={width - pad} y2={mid} stroke={color} strokeWidth={0.3} opacity={0.25} />
    </svg>
  );
};
import {
  SimulationConfig,
  SimulationMetrics,
  calculateMetrics,
  getDefaultConfig,
} from '../simulation/metricsEngine';

// Topology options with visualization data
interface TopologyOption {
  id: ClusterMode;
  label: string;
  shortLabel: string;
  type: 'pp' | 'tp' | 'ep';
  nodeCount: number;
}

// Topology options grouped by parallelism strategy
const TOPOLOGY_GROUPS: {
  label: string;
  helpType: string;
  tip: string;
  color: 'emerald' | 'cyan' | 'purple';
  options: TopologyOption[];
}[] = [
  {
    label: 'Embarrassingly Parallel',
    helpType: 'ep',
    tip: 'Each node runs a full copy independently. Max per-instance speed, zero communication overhead. Best for models that fit on one node.',
    color: 'emerald',
    options: [
      { id: 'SINGLE', label: 'Single Node', shortLabel: 'EP1', type: 'ep', nodeCount: 1 },
      { id: 'EP2_SOLO', label: '2x Independent', shortLabel: 'EP2', type: 'ep', nodeCount: 2 },
      { id: 'EP3_SOLO', label: '3x Independent', shortLabel: 'EP3', type: 'ep', nodeCount: 3 },
      { id: 'EP4_SOLO', label: '4x Independent', shortLabel: 'EP4', type: 'ep', nodeCount: 4 },
      { id: 'EP5_SOLO', label: '5x Independent', shortLabel: 'EP5', type: 'ep', nodeCount: 5 },
    ],
  },
  {
    label: 'Pipeline Parallel',
    helpType: 'pp',
    tip: 'Layers split sequentially across nodes in a ring. Works with any model but adds pipeline latency. TTFT increases with more stages.',
    color: 'cyan',
    options: [
      { id: 'RING_PP2', label: 'Pipeline 2', shortLabel: 'PP2', type: 'pp', nodeCount: 2 },
      { id: 'RING_PP3', label: 'Pipeline 3', shortLabel: 'PP3', type: 'pp', nodeCount: 3 },
      { id: 'RING_PP4', label: 'Pipeline 4', shortLabel: 'PP4', type: 'pp', nodeCount: 4 },
      { id: 'RING_PP5', label: 'Pipeline 5', shortLabel: 'PP5', type: 'pp', nodeCount: 5 },
    ],
  },
  {
    label: 'Tensor Parallel',
    helpType: 'tp',
    tip: 'Attention heads sharded across nodes via TB5 RDMA. Lowest latency for large models. Requires attention heads divisible by node count.',
    color: 'purple',
    options: [
      { id: 'TP2_RDMA', label: 'Tensor 2', shortLabel: 'TP2', type: 'tp', nodeCount: 2 },
      { id: 'TP3_RDMA', label: 'Tensor 3', shortLabel: 'TP3', type: 'tp', nodeCount: 3 },
      { id: 'TP4_RDMA', label: 'Tensor 4', shortLabel: 'TP4', type: 'tp', nodeCount: 4 },
      { id: 'TP5_RDMA', label: 'Tensor 5', shortLabel: 'TP5', type: 'tp', nodeCount: 5 },
    ],
  },
];

// Flat list for backward compatibility
const TOPOLOGY_OPTIONS: TopologyOption[] = TOPOLOGY_GROUPS.flatMap(g => g.options);

// Node colors for topology visualization
const nodeColors = [
  CHAKRA_COLORS.muladhara.base,
  CHAKRA_COLORS.svadhisthana.base,
  CHAKRA_COLORS.manipura.base,
  CHAKRA_COLORS.anahata.base,
  CHAKRA_COLORS.vishuddha.base,
];

// Pentagon node coordinates for mini diagrams
const nodeCoords = [
  { x: 50, y: 12 },
  { x: 88, y: 38 },
  { x: 74, y: 82 },
  { x: 26, y: 82 },
  { x: 12, y: 38 },
];

// Mini topology diagram component
const MiniTopologyDiagram: React.FC<{
  option: TopologyOption;
  isSelected: boolean;
  isSupported: boolean;
  reason?: string | null;
  typeColor?: string;  // hex color for selected label
}> = ({ option, isSelected, isSupported, reason, typeColor }) => {
  const links = useMemo(() => {
    const result: [number, number][] = [];

    if (option.type === 'pp') {
      for (let i = 0; i < option.nodeCount - 1; i++) {
        result.push([i, i + 1]);
      }
    } else if (option.type === 'tp') {
      for (let i = 0; i < option.nodeCount; i++) {
        for (let j = i + 1; j < option.nodeCount; j++) {
          result.push([i, j]);
        }
      }
    }
    // 'ep' type: no links (nodes are independent)

    return result;
  }, [option]);

  const activeNodes = Array.from({ length: option.nodeCount }, (_, i) => i);
  const linkColor = option.type === 'pp' ? '#22d3ee' : option.type === 'tp' ? '#a855f7' : '#10b981';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Links */}
      {links.map(([from, to], idx) => (
        <line
          key={`link-${idx}`}
          x1={nodeCoords[from].x}
          y1={nodeCoords[from].y}
          x2={nodeCoords[to].x}
          y2={nodeCoords[to].y}
          stroke={linkColor}
          strokeWidth={isSelected ? 2.5 : 1.5}
          strokeOpacity={isSelected ? 0.8 : 0.4}
          strokeDasharray={option.type === 'pp' ? "3 2" : "none"}
        />
      ))}

      {/* Nodes */}
      {nodeCoords.map((coord, i) => {
        const isActive = activeNodes.includes(i);
        return (
          <circle
            key={i}
            cx={coord.x}
            cy={coord.y}
            r={isSelected ? 8 : 6}
            fill={isActive ? nodeColors[i] : '#333'}
            stroke={isSelected && isActive ? 'white' : (isActive ? nodeColors[i] : '#444')}
            strokeWidth={isSelected ? 2 : 1}
            opacity={isActive ? 1 : 0.3}
          />
        );
      })}

      {/* Center label */}
      <circle cx="50" cy="50" r={16} fill="rgba(0,0,0,0.6)" />
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={isSelected && typeColor ? typeColor : 'rgba(255,255,255,0.6)'}
        fontSize="13"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
      >
        {option.shortLabel}
      </text>
    </svg>
  );
};

interface SimulationPanelProps {
  onConfigChange: (config: SimulationConfig, metrics: SimulationMetrics) => void;
  initialConfig?: Partial<SimulationConfig>;
  /** Whether model cards should pulse/glow (Guruswami prompting user to choose) */
  modelCardsGlow?: boolean;
  /** Callback to notify Guruswami of parameter changes */
  onParameterChange?: (type: string, value: string) => void;
  /** Current onboarding step for progressive reveal */
  onboardingStep?: OnboardingStep;
  /** Callback for ? button deep help (triggers Guruswami wisdom speech) */
  onHelpRequest?: (controlType: string) => void;
  // Music controls
  musicEnabled?: boolean;
  onMusicToggle?: () => void;
  musicTrack?: string;
  onMusicNext?: () => void;
  onMusicPrev?: () => void;
  onMusicRandom?: () => void;
  // Speech control
  speechEnabled?: boolean;
  onSpeechEnabledChange?: (enabled: boolean) => void;
  /** Callback to trigger dual-voice error notifications via Guruswami */
  onTriggerError?: (errorId: string) => void;
  /** Open the Guruswami Codex panel */
  onOpenCodex?: () => void;
  /** Restart the tutorial */
  onRestartTutorial?: () => void;
  /** Skip the current tutorial */
  onSkipTutorial?: () => void;
}

// Map onboarding steps to numeric indices for progressive unlock
// Context (2) and Batch (3) unlock automatically when Topology (4) is current
const STEP_INDEX: Record<string, number> = {
  PICK_MODEL: 0,
  PICK_QUANT: 1,
  PICK_CONTEXT: 2,
  PICK_TOPOLOGY: 4,
  // Interactive tutorial steps: all controls visible
  TRY_BREAK: 99,
  EXPLAIN_BREAK: 99,
  TRY_EP5: 99,
  EXPLAIN_EP5: 99,
  FREEPLAY: 99,
  COMPLETE: 99,
};

const STEP_LABELS = ['Model', 'Quant', 'Context', 'Topology'];

// Control type to step index mapping
const CONTROL_INDEX: Record<string, number> = {
  model: 0,
  quant: 1,
  kvCache: 2,
  batch: 3,
  topology: 4,
};

/** Wrapper that dims/locks controls based on onboarding progress OR config readiness */
const OnboardingSection: React.FC<{
  controlType: string;
  onboardingStep: OnboardingStep;
  unlocked?: boolean;  // Progressive config: is this section ready to interact with?
  children: React.ReactNode;
}> = ({ controlType, onboardingStep, unlocked = true, children }) => {
  // Post-onboarding: use progressive config unlock
  if (!onboardingStep) {
    if (unlocked) return <>{children}</>;
    return (
      <div className="opacity-20 pointer-events-none blur-[1px] transition-all duration-500">
        {children}
      </div>
    );
  }

  // During INTRO steps: visible but not interactive (controls emerge from shadow)
  // Exception: INTRO_CONTROLS unlocks model cards since guru is about to say "pick a model"
  if (onboardingStep.startsWith('INTRO')) {
    if (onboardingStep === 'INTRO_CONTROLS' && controlType === 'model') {
      return <>{children}</>;
    }
    return (
      <div className="pointer-events-none opacity-60 transition-opacity duration-1000">
        {children}
      </div>
    );
  }

  // Loading & tour: visible but NOT interactive (guru is explaining, don't let user break it)
  if (onboardingStep === 'LOADING' || onboardingStep.startsWith('TOUR_')
      || onboardingStep.startsWith('EXPLAIN_')) {
    return (
      <div className="pointer-events-none transition-opacity duration-500">
        {children}
      </div>
    );
  }

  // Interactive tutorial steps: controls unlocked
  // TRY_CLICK_GURU: controls stay locked (user clicks guru, not controls)
  // REWARD_INTRO: narration, locked
  if ((onboardingStep.startsWith('TRY_') && onboardingStep !== 'TRY_CLICK_GURU')
      || onboardingStep === 'FREEPLAY' || onboardingStep === 'COMPLETE') {
    return <>{children}</>;
  }

  // TRY_CLICK_GURU and REWARD_INTRO: visible but locked
  if (onboardingStep === 'TRY_CLICK_GURU' || onboardingStep === 'REWARD_INTRO') {
    return (
      <div className="pointer-events-none transition-opacity duration-500">
        {children}
      </div>
    );
  }

  // PICK steps: progressive reveal — only current section is interactive
  const currentStepIdx = STEP_INDEX[onboardingStep] ?? -1;
  const controlIdx = CONTROL_INDEX[controlType] ?? -1;
  const isCurrent = controlIdx === currentStepIdx;
  const isActive = controlIdx <= currentStepIdx;

  return (
    <div
      className={`relative transition-all duration-500 rounded-2xl ${
        isActive ? '' : 'opacity-20 pointer-events-none blur-[1px]'
      }`}
      style={isCurrent ? {
        outline: '2px solid rgba(255, 200, 50, 0.4)',
        background: 'rgba(255, 200, 50, 0.03)',
        boxShadow: '0 0 40px rgba(255, 180, 40, 0.15), 0 0 80px rgba(255, 150, 30, 0.08)',
      } : undefined}
    >
      {isCurrent && (
        <div className="absolute inset-0 rounded-2xl animate-pulse pointer-events-none opacity-60"
          style={{
            boxShadow: '0 0 25px rgba(255, 180, 40, 0.25), 0 0 60px rgba(255, 150, 30, 0.12)',
            animationDuration: '2s',
          }}
        />
      )}
      {children}
    </div>
  );
};

/** Step progress dots shown at top of panel during onboarding */
const StepProgressDots: React.FC<{ onboardingStep: OnboardingStep }> = ({ onboardingStep }) => {
  if (!onboardingStep || onboardingStep === 'LOADING' || onboardingStep.startsWith('INTRO') || onboardingStep.startsWith('TOUR_') || onboardingStep.startsWith('TRY_') || onboardingStep.startsWith('EXPLAIN_') || onboardingStep === 'FREEPLAY' || onboardingStep === 'COMPLETE') return null;
  const currentIdx = STEP_INDEX[onboardingStep] ?? -1;

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isCompleted
                    ? 'bg-amber-500'
                    : isCurrent
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-white/10'
                }`}
                style={isCurrent ? { boxShadow: '0 0 10px rgba(255, 200, 50, 0.6)' } : undefined}
              />
              <span className={`text-[10px] font-mono uppercase tracking-wider ${
                isCompleted ? 'text-amber-400/60' : isCurrent ? 'text-amber-300' : 'text-white/15'
              }`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-6 h-px mb-3 ${
                i < currentIdx ? 'bg-amber-500/50' : 'bg-white/5'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const SimulationPanel: React.FC<SimulationPanelProps> = ({
  onConfigChange,
  initialConfig,
  modelCardsGlow = false,
  onParameterChange,
  onboardingStep,
  onHelpRequest,
  onTriggerError,
  musicEnabled,
  onMusicToggle,
  musicTrack,
  onMusicNext,
  onMusicPrev,
  onMusicRandom,
  speechEnabled,
  onSpeechEnabledChange,
  onOpenCodex,
  onRestartTutorial,
  onSkipTutorial,
}) => {
  // ── SFX playback ──────────────────────────────────────────────
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    sfxRef.current = new Audio();
    sfxRef.current.volume = 0.25;
    return () => { if (sfxRef.current) { sfxRef.current.pause(); sfxRef.current.src = ''; } };
  }, []);

  const BASE_URL = import.meta.env.BASE_URL || '/';
  const selectSounds = [`${BASE_URL}guruswami/sfx/select_1.m4a`, `${BASE_URL}guruswami/sfx/select_2.m4a`, `${BASE_URL}guruswami/sfx/select_3.m4a`];

  const playSfx = useCallback((src: string) => {
    const audio = sfxRef.current;
    if (!audio) return;
    audio.src = src;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  const playSelectSound = useCallback(() => {
    playSfx(selectSounds[Math.floor(Math.random() * selectSounds.length)]);
  }, [playSfx, selectSounds]);

  // Bubble pop SFX — number of pops matches node count
  // Single node uses the select sounds (they're already single pops)
  const bubbleVariants: Record<number, number> = { 1: 3, 2: 5, 3: 8, 4: 4, 5: 7 };
  const playBubbleSound = useCallback((nodeCount: number) => {
    const count = Math.min(nodeCount, 5);
    const maxVariant = bubbleVariants[count] || 3;
    if (count <= 1) {
      // Single node — use select sounds as single pops
      playSfx(selectSounds[Math.floor(Math.random() * selectSounds.length)]);
    } else {
      const variant = Math.floor(Math.random() * maxVariant) + 1;
      playSfx(`${BASE_URL}guruswami/sfx/bubble_${count}_${variant}.m4a`);
    }
  }, [playSfx, selectSounds, BASE_URL]);

  // During onboarding, highlight the guru's recommended option
  const recommendedValue = onboardingStep ? TUTORIAL_RECOMMENDED[onboardingStep] ?? null : null;

  // During PICK steps, only the recommended value is clickable
  const isOnboardingPick = onboardingStep?.startsWith('PICK_') || onboardingStep?.startsWith('TRY_');
  const isAllowedClick = useCallback((value: string) => {
    if (!isOnboardingPick || !recommendedValue) return true;
    return value === recommendedValue;
  }, [isOnboardingPick, recommendedValue]);

  // Configuration state — starts empty (no model selected, cluster off)
  const [config, setConfig] = useState<SimulationConfig>(() => ({
    modelId: '',
    quantization: '' as any,
    topology: '' as any,
    kvCacheTokens: 0,
    batchMode: false,
    ...initialConfig,
  }));

  // Calculate metrics whenever config changes
  const metrics = useMemo(() => calculateMetrics(config), [config]);

  // Notify parent of config changes
  useEffect(() => {
    onConfigChange(config, metrics);
  }, [config, metrics, onConfigChange]);

  // Update config helper
  const updateConfig = useCallback((updates: Partial<SimulationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle model selection — resets all other params, cluster goes dark
  // User must re-select quant → context → topology to load
  const handleModelSelect = useCallback((modelId: string) => {
    if (!isAllowedClick(modelId)) return;
    playSelectSound();
    const model = MODEL_CATALOG.find(m => m.id === modelId);
    if (!model) return;

    // Reset everything — new model = fresh configuration session
    setConfig({
      modelId,
      quantization: '' as any,
      topology: '' as any,
      kvCacheTokens: 0,
      batchMode: false,
    });
    onParameterChange?.('model', modelId);
  }, [updateConfig, onParameterChange, playSelectSound, isAllowedClick]);

  const handleTopologySelect = useCallback((topology: ClusterMode) => {
    if (!isAllowedClick(topology)) return;
    const nodeCount = getNodeCount(topology);
    playBubbleSound(nodeCount);
    updateConfig({ topology });
    onParameterChange?.('topology', topology);
  }, [config.modelId, updateConfig, onParameterChange, playBubbleSound]);


  // Get selected model
  const selectedModel = MODEL_CATALOG.find(m => m.id === config.modelId);

  // Progressive config: each section unlocks after the previous one is set
  // Model → Quant → Context → Topology (batch is optional, always available after model)
  const noModel = !config.modelId;
  const noQuant = !config.quantization;
  const noContext = !config.kvCacheTokens;
  const hasModel = !!config.modelId;
  const hasQuant = hasModel && !!config.quantization;
  const hasContext = hasQuant && config.kvCacheTokens > 0;
  const hasTopology = hasContext && !!config.topology;

  // During onboarding, override visual selections for progressive reveal
  const effectiveModelId = onboardingStep === 'PICK_MODEL' || noModel ? '' : config.modelId;
  const effectiveQuant = onboardingStep === 'PICK_QUANT' || noModel ? ('' as Quantization) : config.quantization;
  const effectiveContext = onboardingStep === 'PICK_CONTEXT' || noModel ? 0 : config.kvCacheTokens;
  const effectiveBatchMode = noModel ? undefined : config.batchMode;
  const effectiveTopology = onboardingStep === 'PICK_TOPOLOGY' || noModel ? '' : config.topology;

  const isIntroReveal = onboardingStep === 'INTRO_CONTROLS';

  return (
    <div
      className="chakra-panel rounded-2xl overflow-hidden transition-all duration-1000"
      style={{
        border: isIntroReveal
          ? '2px solid rgba(255, 200, 50, 0.5)'
          : '1px solid rgba(168, 85, 247, 0.3)',
        boxShadow: isIntroReveal
          ? '0 0 40px rgba(255, 180, 40, 0.2), 0 0 80px rgba(255, 150, 30, 0.1)'
          : undefined,
      }}
    >
      {/* Skip tutorial — prominent at the top during onboarding */}
      {onboardingStep && onSkipTutorial && (
        <div className="px-5 pt-3 pb-2 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-amber-400/60 uppercase tracking-wider">Tutorial</span>
          <button
            onClick={onSkipTutorial}
            className="text-[10px] font-mono text-white/30 hover:text-amber-300 uppercase tracking-wider transition-colors"
          >
            Skip &rarr;
          </button>
        </div>
      )}

      {/* Music & Speech Controls */}
      <div className="px-5 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Music controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onMusicToggle}
              className={`p-2 rounded-lg transition-all ${
                musicEnabled
                  ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                  : 'bg-white/5 text-white/30 hover:bg-white/10'
              }`}
              title={musicEnabled ? 'Music off' : 'Music on'}
            >
              {musicEnabled ? <Music size={14} /> : <Music2 size={14} />}
            </button>
            <button
              onClick={onMusicPrev}
              className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/15 transition-all"
              title="Previous track"
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={onMusicNext}
              className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/15 transition-all"
              title="Next track"
            >
              <SkipForward size={14} />
            </button>
            <button
              onClick={onMusicRandom}
              className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/15 transition-all"
              title="Random track"
            >
              <Shuffle size={14} />
            </button>
          </div>

          <div className="h-5 w-px bg-white/10" />

          {/* Speech toggle */}
          <button
            onClick={() => onSpeechEnabledChange?.(!speechEnabled)}
            className={`p-2 rounded-lg transition-all ${
              speechEnabled
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-white/5 text-white/30 hover:bg-white/10'
            }`}
            title={speechEnabled ? 'Mute guru voice' : 'Enable guru voice'}
          >
            {speechEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>

        {/* Track name */}
        {musicTrack && musicEnabled && (
          <div className="mt-2 text-[10px] font-mono text-amber-400/40 uppercase tracking-wider truncate">
            {musicTrack.replace(/-/g, ' ').replace(/^t\d /, '')}
          </div>
        )}
      </div>

        <div className="px-5 pb-5 pt-4 space-y-5">
          {/* Step Progress Dots (during onboarding) */}
          <StepProgressDots onboardingStep={onboardingStep ?? null} />
          {/* Model Selection */}
          <OnboardingSection controlType="model" onboardingStep={onboardingStep ?? null} unlocked={true}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Model</span>
              <HelpTip tip="Each model has a different architecture, size, and purpose. Dense models use all parameters per token. MoE models route to a subset of experts — faster but larger total size. Bigger models reason better but need more nodes and run slower." controlType="model" onHelpRequest={onHelpRequest} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {MODEL_CATALOG.map((model) => {
                const isSelected = effectiveModelId === model.id;
                const isRecommended = recommendedValue === model.id && !isSelected;
                return (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    title={model.description}
                    className={`flex-shrink-0 group relative rounded-xl p-4 transition-all duration-200 min-w-[140px] ${
                      isSelected
                        ? 'border-2 shadow-lg'
                        : isRecommended
                          ? 'bg-amber-500/10 border-2 border-amber-400/50 ring-1 ring-amber-400/30'
                          : 'bg-white/5 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500/30'
                    } ${modelCardsGlow && !isSelected && !isRecommended ? 'animate-pulse' : ''}`}
                    style={{
                      backgroundColor: isSelected ? `${model.color}20` : undefined,
                      borderColor: isSelected ? `${model.color}80` : (modelCardsGlow && !isRecommended ? 'rgba(168, 85, 247, 0.4)' : undefined),
                      boxShadow: isSelected ? `0 4px 12px ${model.color}30` : (isRecommended ? '0 0 20px rgba(255, 200, 50, 0.25), 0 0 40px rgba(255, 180, 30, 0.1)' : (modelCardsGlow ? '0 0 20px rgba(168, 85, 247, 0.2), 0 0 40px rgba(168, 85, 247, 0.1)' : undefined)),
                    }}
                  >
                    {isRecommended && (
                      <div className="absolute inset-0 rounded-xl animate-pulse pointer-events-none opacity-60"
                        style={{
                          boxShadow: '0 0 25px rgba(255, 180, 40, 0.25), 0 0 60px rgba(255, 150, 30, 0.12)',
                          animationDuration: '2s',
                        }}
                      />
                    )}
                    <div className={`text-sm font-bold text-center mb-1.5 ${
                      isSelected ? '' : isRecommended ? 'text-amber-200' : 'text-white/70 group-hover:text-purple-300'
                    }`}
                    style={{ color: isSelected ? model.color : undefined }}>
                      {model.displayName}
                    </div>
                    <div className={`text-xs font-mono text-center ${isSelected ? 'text-white/50' : 'text-white/40'}`}>
                      {model.totalParams} {model.architecture === 'moe' ? 'MoE' : 'Dense'}
                    </div>
                    {model.activeParams && (
                      <div className="text-[10px] font-mono text-center text-white/30 mt-0.5">
                        {model.activeParams}
                      </div>
                    )}
                    <div className="text-[9px] text-center text-white/20 mt-1 leading-tight">
                      {model.bestFor.split(',')[0]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          </OnboardingSection>

          {/* Quantization */}
          <OnboardingSection controlType="quant" onboardingStep={onboardingStep ?? null} unlocked={hasModel}>
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Quantization</span>
                <HelpTip tip="MLX quantizes FP16 weights into Q2-Q8 levels. Lower bits = less memory & faster TPS, but perplexity increases (quality drops). Q4 is the standard sweet spot." controlType="quant" onHelpRequest={onHelpRequest} />
                {selectedModel && config.quantization && QUANTIZATION_DISPLAY[config.quantization] && (
                  <span className="ml-auto text-[10px] font-mono text-white/30">
                    {QUANTIZATION_DISPLAY[config.quantization].quality}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1">
                {QUANT_ORDER.map((quant) => {
                  const spec = selectedModel?.quantizations[quant];
                  const available = spec?.available ?? false;
                  const nodeCount = getNodeCount(config.topology);
                  const isEP = config.topology === 'SINGLE' || config.topology.startsWith('EP');
                  const memPerNode = spec ? (isEP ? spec.memoryGB : spec.memoryGB / nodeCount) : 0;
                  const memFits = spec ? memPerNode < 512 * 0.95 : false;
                  const enabled = available;  // OOM tiles stay clickable — BSOD teaches the lesson
                  const isSelected = effectiveQuant === quant;
                  const isRecommendedQuant = recommendedValue === quant && !isSelected && enabled;
                  const display = QUANTIZATION_DISPLAY[quant];
                  const pctColor = spec ? getQualityColor(spec.perplexityPct) : 'text-white/20';

                  return (
                    <button
                      key={quant}
                      onClick={() => {
                        if (!isAllowedClick(quant)) return;
                        playSelectSound();
                        updateConfig({ quantization: quant });
                        onParameterChange?.('quantization', quant);
                      }}
                      title={`${display.quality}${spec?.perplexityPct ? ` (${spec.perplexityPct}%)` : ''}`}
                      data-text={quant === 'Q2' ? quant : undefined}
                      className={`group relative flex flex-col items-center justify-center rounded-xl p-2 transition-all duration-200 ${
                        quant === 'Q2' ? 'quant-glitch' : ''
                      } ${
                        isSelected
                          ? 'border-2 shadow-lg'
                          : isRecommendedQuant
                            ? 'bg-amber-500/10 border-2 border-amber-400/50 ring-1 ring-amber-400/30'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-opacity-30'
                      }`}
                      style={{
                        backgroundColor: isSelected ? `${display.color}20` : undefined,
                        borderColor: isSelected ? `${display.color}80` : undefined,
                        boxShadow: isSelected ? `0 4px 12px ${display.color}30` : (isRecommendedQuant ? '0 0 20px rgba(255, 200, 50, 0.25), 0 0 40px rgba(255, 180, 30, 0.1)' : undefined),
                      }}
                    >
                      <QuantWaveform
                        steps={display.waveformSteps}
                        color={isSelected ? display.color : 'rgba(255,255,255,0.4)'}
                      />
                      <div className={`text-[11px] font-bold mt-0.5 ${
                        isSelected ? '' : 'text-white/70'
                      }`}
                      style={{ color: isSelected ? display.color : undefined }}>
                        {quant}
                      </div>
                      <div className={`text-[10px] mt-0.5 font-mono ${
                        isSelected ? '' : 'text-white/30'
                      }`}
                      style={{ color: isSelected ? `${display.color}bb` : undefined }}>
                        {display.quality}
                      </div>
                      {spec && (
                        <div className={`text-[10px] font-mono font-bold mt-1 ${isSelected ? pctColor : 'text-white/40'}`}>
                          {spec.perplexityPct}%
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
          </OnboardingSection>

            {/* Batch Mode */}
          <OnboardingSection controlType="batch" onboardingStep={onboardingStep ?? null} unlocked={hasQuant}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Batch</span>
                <HelpTip tip="Process multiple requests together for higher throughput. Increases TPS but adds latency. Best for batch workloads, not interactive chat." controlType="batch" onHelpRequest={onHelpRequest} />
              </div>
              <div className="flex gap-2">
                {(() => {
                  const isRecommendedInteractive = recommendedValue === 'false' && effectiveBatchMode !== false;
                  const isRecommendedBatch = recommendedValue === 'true' && effectiveBatchMode !== true;
                  return (<>
                    <button
                      onClick={() => {
                        playSelectSound();
                        updateConfig({ batchMode: false });
                        onParameterChange?.('batchMode', 'false');
                      }}
                      className={`py-1.5 px-4 rounded-lg text-[10px] font-bold transition-all ${
                        effectiveBatchMode === false
                          ? 'bg-white/10 text-white/70 border border-white/30'
                          : isRecommendedInteractive
                            ? 'bg-amber-500/10 text-amber-300 border-2 border-amber-400/50 ring-1 ring-amber-400/30'
                            : effectiveBatchMode === undefined
                              ? 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                              : 'bg-white/5 text-white/30 border border-white/10 hover:bg-white/10'
                      }`}
                      style={isRecommendedInteractive ? { boxShadow: '0 0 20px rgba(255, 200, 50, 0.25), 0 0 40px rgba(255, 180, 30, 0.1)' } : undefined}
                    >
                      Interactive
                    </button>
                    <button
                      onClick={() => {
                        playSelectSound();
                        updateConfig({ batchMode: true });
                        onParameterChange?.('batchMode', 'true');
                      }}
                      className={`py-1.5 px-4 rounded-lg text-[10px] font-bold transition-all ${
                        effectiveBatchMode === true
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                          : isRecommendedBatch
                            ? 'bg-amber-500/10 text-amber-300 border-2 border-amber-400/50 ring-1 ring-amber-400/30'
                            : effectiveBatchMode === undefined
                              ? 'bg-white/5 text-white/40 border border-white/10 hover:bg-amber-500/10'
                              : 'bg-white/5 text-white/30 border border-white/10 hover:bg-amber-500/10'
                      }`}
                      style={isRecommendedBatch ? { boxShadow: '0 0 20px rgba(255, 200, 50, 0.25), 0 0 40px rgba(255, 180, 30, 0.1)' } : undefined}
                    >
                      Batch
                    </button>
                  </>);
                })()}
              </div>
            </div>
          </OnboardingSection>

          {/* KV Cache Slider */}
          <OnboardingSection controlType="kvCache" onboardingStep={onboardingStep ?? null} unlocked={hasQuant}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Context Length</span>
              <HelpTip tip="Context window determines how much text the model sees at once. Longer contexts use more KV cache RAM and reduce TPS. Pick the workload that matches your use case." controlType="kvCache" onHelpRequest={onHelpRequest} />
              {selectedModel && (
                <span className="ml-auto text-[10px] font-mono text-white/30">
                  max {(selectedModel.maxContext / 1024)}K
                </span>
              )}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {KV_CACHE_PRESETS.map((preset) => {
                const maxCtx = selectedModel?.maxContext || 131072;
                const exceedsMax = preset.tokens > maxCtx;
                const isSelected = effectiveContext === preset.tokens;
                const isRecommendedCtx = recommendedValue != null && preset.tokens === parseInt(recommendedValue) && !isSelected;
                const tokenLabel = `${(preset.tokens / 1024)}K`;

                return (
                  <button
                    key={preset.tokens}
                    onClick={() => {
                      if (!isAllowedClick(String(preset.tokens))) return;
                      playSelectSound();
                      updateConfig({ kvCacheTokens: preset.tokens });
                      onParameterChange?.('kvCache', String(preset.tokens));
                    }}
                    title={`${preset.description} (${tokenLabel} tokens)`}
                    className={`group relative flex flex-col items-center justify-center rounded-xl p-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-2 shadow-lg'
                        : isRecommendedCtx
                          ? 'bg-amber-500/10 border-2 border-amber-400/50 ring-1 ring-amber-400/30'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-500/30'
                    }`}
                    style={{
                      backgroundColor: isSelected ? 'rgba(16,185,129,0.15)' : undefined,
                      borderColor: isSelected ? 'rgba(16,185,129,0.5)' : undefined,
                      boxShadow: isSelected ? '0 4px 12px rgba(16,185,129,0.2)' : (isRecommendedCtx ? '0 0 20px rgba(255, 200, 50, 0.25)' : undefined),
                    }}
                  >
                    <div className={`text-[11px] font-bold ${
                      isSelected ? 'text-emerald-400' : 'text-white/70'
                    }`}>
                      {tokenLabel}
                    </div>
                    <div className={`text-[10px] font-bold mt-0.5 ${
                      isSelected ? 'text-emerald-300/70' : 'text-white/40'
                    }`}>
                      {preset.label}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${
                      isSelected ? 'text-emerald-400/50' : 'text-white/25'
                    }`}>
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          </OnboardingSection>

          {/* Topology Selection */}
          <OnboardingSection controlType="topology" onboardingStep={onboardingStep ?? null} unlocked={hasContext}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Topology</span>
              <HelpTip tip="EP: Single/independent nodes, fastest for small models. PP: Sequential pipeline, works with any model. TP: Parallel sharding via RDMA, lowest latency for large models." controlType="topology" onHelpRequest={onHelpRequest} />
            </div>
            <div className="space-y-3">
              {TOPOLOGY_GROUPS.map((group) => {
                const colorClassMap = { emerald: 'text-emerald-400/50', cyan: 'text-cyan-400/50', purple: 'text-purple-400/50' } as const;
                return (
                  <div key={group.helpType}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${colorClassMap[group.color]}`}>
                        {group.label}
                      </span>
                      <HelpTip tip={group.tip} controlType={`topology-${group.helpType}`} onHelpRequest={onHelpRequest} />
                    </div>
                    <div className={`grid gap-2 ${group.options.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
                      {group.options.map((option) => {
                        const supported = isTopologySupported(config.modelId, option.id);
                        const selected = effectiveTopology === option.id;
                        const isRecommendedTopo = recommendedValue === option.id && !selected && supported;
                        const reason = !supported ? getIncompatibilityReason(config.modelId, option.id, config.quantization) : null;
                        const typeColorMap = { pp: 'cyan', tp: 'purple', ep: 'emerald' } as const;
                        const typeColor = typeColorMap[option.type];
                        const rgbaMap = { cyan: '34,211,238', purple: '168,85,247', emerald: '16,185,129' } as const;
                        const hexMap = { cyan: '#22d3ee', purple: '#a855f7', emerald: '#10b981' } as const;

                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              // All topologies selectable — unsupported ones trigger BSOD / error state
                              handleTopologySelect(option.id);
                            }}
                            title={option.label}
                            className={`group relative rounded-xl p-2 transition-all duration-200 ${
                              selected
                                ? 'border-2 shadow-lg'
                                : isRecommendedTopo
                                  ? 'bg-amber-500/10 border-2 border-amber-400/50 ring-1 ring-amber-400/30'
                                  : 'bg-white/5 border border-white/10 hover:border-opacity-30'
                            }`}
                            style={{
                              backgroundColor: selected ? `rgba(${rgbaMap[typeColor]}, 0.2)` : undefined,
                              borderColor: selected ? `rgba(${rgbaMap[typeColor]}, 0.5)` : undefined,
                              boxShadow: selected ? `0 10px 15px -3px rgba(${rgbaMap[typeColor]}, 0.2)` : (isRecommendedTopo ? '0 0 20px rgba(255, 200, 50, 0.25), 0 0 40px rgba(255, 180, 30, 0.1)' : undefined),
                            }}
                          >
                            <div className="w-full aspect-square">
                              <MiniTopologyDiagram option={option} isSelected={selected} isSupported={supported} reason={reason} typeColor={hexMap[typeColor]} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </OnboardingSection>

          {/* Model Info Footer */}
          {selectedModel && (
            <div className="flex items-center gap-2 text-[10px] text-white/30 pt-1">
              <Info className="w-3 h-3" />
              <span>
                {selectedModel.displayName} • {selectedModel.layers} layers • {selectedModel.attentionHeads} heads • {selectedModel.attentionType}
              </span>
            </div>
          )}

          {/* Codex & Tutorial — bottom utility buttons */}
          {!onboardingStep && (
            <div className="flex items-center gap-2 pt-3 mt-2 border-t border-white/5">
              {onOpenCodex && (
                <button
                  onClick={() => onOpenCodex()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-white/30 hover:text-white/60 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider"
                >
                  <BookMarked className="w-3.5 h-3.5" />
                  Codex
                </button>
              )}
              {onRestartTutorial && (
                <button
                  onClick={onRestartTutorial}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-white/30 hover:text-amber-300 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Tutorial
                </button>
              )}
            </div>
          )}
        </div>
    </div>
  );
};

export default SimulationPanel;
