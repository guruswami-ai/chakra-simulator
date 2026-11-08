
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import TopBar from './components/TopBar';
import MeshGraph from './components/MeshGraph';
import ClusterTopologyCard from './components/ClusterTopologyCard';
import MandalaShader from './components/MandalaShader';

// Lazy-loaded modals — only fetched when user opens them
// Saves ~200KB from the critical path (these are large components behind user interaction)
const NodeFocusView = lazy(() => import('./components/NodeFocusView'));
const ClusterDetailedView = lazy(() => import('./components/ClusterDetailedView'));
const CodexPanel = lazy(() => import('./components/CodexPanel'));
import SimulationPanel from './components/SimulationPanel';
import ClakyButton, { ClakyMetrics } from './components/ClakyButton';
import SimulatorControls, { calculateMetrics as simCalculateMetrics, BENCHMARK_DATA, SimMode, ReplayFrame, ReplayState, SimStateUpdate, InferencePhase } from './simulation/SimulatorControls';
import { SimulationConfig, SimulationMetrics } from './simulation/metricsEngine';
import { getModel, getNodeCount, getIncompatibilityReason } from './simulation/modelCatalog';
import { replayFrameToNodeMetrics, mapTopologyToClusterMode } from './simulation/benchmarkReplay';
import VestaboardOverlay from './components/VestaboardOverlay';
import GuruswamiAvatar from './components/GuruswamiAvatar';
import { OnboardingStep } from './hooks/useGuruswamiState';
import { useBackgroundMusic } from './hooks/useBackgroundMusic';
import { CodexProvider, useCodex } from './components/CodexContext';
import { ClusterState, NodeMetrics, HistoryPoint, ClusterMode, ModelInstance } from './types';
import { INITIAL_NODES } from './constants';
import { simulateTopology, getActiveNodeIndices, getExpectedTTFT } from './simulation/simulationUtils';
import ResponsiveDrawer from './components/ResponsiveDrawer';
import MobileMetricsBar, { MobileMetrics } from './components/MobileMetricsBar';
import { useBreakpoint } from './hooks/useBreakpoint';
import { SlidersHorizontal } from 'lucide-react';

const AppContent: React.FC = () => {
  const [focusedNode, setFocusedNode] = useState<NodeMetrics | null>(null);
  const [isClusterDetailedOpen, setIsClusterDetailedOpen] = useState(false);
  const { isOpen: isHelpOpen, openHelp, closeHelp, onSectionOpenRef } = useCodex();
  const breakpoint = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = breakpoint === 'desktop';

  // Guruswami state — lifted to App level for cross-component communication
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [modelCardsGlow, setModelCardsGlow] = useState(false);
  const guruParameterChangeRef = useRef<((type: string, value: string) => void) | null>(null);
  const guruHelpRequestRef = useRef<((controlType: string) => void) | null>(null);
  const guruTriggerErrorRef = useRef<((errorId: string) => void) | null>(null);
  const guruMusicTrackChangeRef = useRef<((trackChangeCount: number) => void) | null>(null);
  const guruSkipOnboardingRef = useRef<(() => void) | null>(null);
  const guruWelcomeDismissedRef = useRef<(() => void) | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);
  const onboardingStepRef = useRef<OnboardingStep>(null);
  useEffect(() => { onboardingStepRef.current = onboardingStep; }, [onboardingStep]);
  const [welcomeGateDismissed, setWelcomeGateDismissed] = useState(false);

  // Bridge ConceptHelper ? clicks → Guruswami voice
  useEffect(() => {
    onSectionOpenRef.current = (sectionId: string) => {
      guruHelpRequestRef.current?.(sectionId);
    };
    return () => { onSectionOpenRef.current = null; };
  }, [onSectionOpenRef]);

  // Simulated Vestaboard overlay callbacks
  const handleSimulateVestaboard = useCallback((grid: number[][]) => {
    setVestaGrid(grid);
    setVestaVisible(true);
  }, []);

  const handleDismissVestaboard = useCallback(() => {
    setVestaVisible(false);
    setTimeout(() => setVestaGrid(null), 500);
  }, []);

  // Simulated Vestaboard overlay state
  const [vestaGrid, setVestaGrid] = useState<number[][] | null>(null);
  const [vestaVisible, setVestaVisible] = useState(false);

  // Simulator controls state
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [inputTokens, setInputTokens] = useState(256);

  // Replay mode state
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [currentReplayState, setCurrentReplayState] = useState<ReplayState | null>(null);

  // Lab mode state (perplexity/quantization testing)
  const [labTps, setLabTps] = useState<number | undefined>(undefined);
  const [labPerplexity, setLabPerplexity] = useState<number | undefined>(undefined);
  const [labQuantization, setLabQuantization] = useState<string | undefined>(undefined);

  // Full sim state for driving visualization
  const [simState, setSimState] = useState<SimStateUpdate | null>(null);

  // Model metadata for layer stack / expert fiber visualization
  const [simModelLayers, setSimModelLayers] = useState<number>(0);
  const [simModelArch, setSimModelArch] = useState<'dense' | 'moe'>('dense');

  // OOM state — tracks when simulated config exceeds node memory
  const [simOom, setSimOom] = useState(false);
  const simOomRef = useRef(false);
  const oomErrorTypeRef = useRef<'oom' | 'shard'>('oom');

  // Chat simulator state
  const [simInferenceActive, setSimInferenceActive] = useState(false);
  const [simTps, setSimTps] = useState(15.6);
  const [simTtft, setSimTtft] = useState(0.34);
  const [simKvCachePercent, setSimKvCachePercent] = useState(0);
  const [simPerplexityPct, setSimPerplexityPct] = useState(93);

  // Node memory breakdown (weights / KV cache / free)
  const [simWeightsPerNode, setSimWeightsPerNode] = useState(0);
  const [simKvCachePerNode, setSimKvCachePerNode] = useState(0);
  const [simFreePerNode, setSimFreePerNode] = useState(0);

  // ── Staggered boot sequence: elements reveal at different times ──
  const [bootPhase, setBootPhase] = useState(0);

  useEffect(() => {
    if (onboardingStep !== 'LOADING') {
      setBootPhase(0);
      return;
    }
    const t1 = setTimeout(() => setBootPhase(1), 0);
    const t2 = setTimeout(() => setBootPhase(2), 600);
    const t3 = setTimeout(() => setBootPhase(3), 1200);
    const t4 = setTimeout(() => setBootPhase(4), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onboardingStep]);

  // ── Tour highlight: which ClusterTopologyCard section to spotlight ──
  const tourHighlight = useMemo(() => {
    switch (onboardingStep) {
      case 'TOUR_TPS': return 'tps' as const;
      case 'TOUR_TTFT': return 'ttft' as const;
      case 'TOUR_LAYERS': return 'layers' as const;
      case 'TOUR_MEMORY': return 'memory' as const;
      default: return null;
    }
  }, [onboardingStep]);

  // ── Onboarding dimming: progressive reveal of left panel elements ──
  const dimming = useMemo(() => {
    switch (onboardingStep) {
      case 'INTRO':          return { left: 0.03, mandala: 0.02, stats: 0, topbar: 0.08 };
      case 'INTRO_GREETING': return { left: 0.7,  mandala: 0.3,  stats: 0, topbar: 0.10 };  // Nodes visible for "five computers around me"
      case 'INTRO_HELP':     return { left: 0.7,  mandala: 0.3,  stats: 0, topbar: 0.10 };  // Nodes still visible for "half a terabyte each"
      case 'INTRO_ROLE':     return { left: 0.5,  mandala: 0.25, stats: 0, topbar: 0.12 };
      case 'INTRO_CONTROLS':
      case 'INTRO_CLUSTER':  return { left: 0.4,  mandala: 0.20, stats: 0.05, topbar: 0.15 };
      case 'PICK_MODEL':     return { left: 0.15, mandala: 0.08, stats: 0.05, topbar: 0.15 };
      case 'PICK_QUANT':     return { left: 0.18, mandala: 0.10, stats: 0.08, topbar: 0.20 };
      case 'PICK_CONTEXT':   return { left: 0.22, mandala: 0.12, stats: 0.10, topbar: 0.25 };
      case 'PICK_TOPOLOGY':  return { left: 0.35, mandala: 0.20, stats: 0.15, topbar: 0.35 };
      case 'LOADING': {
        const prev = { left: 0.35, mandala: 0.20, stats: 0.15, topbar: 0.35 };
        return {
          mandala: bootPhase >= 1 ? 1.0 : prev.mandala,
          topbar:  bootPhase >= 2 ? 1.0 : prev.topbar,
          left:    bootPhase >= 3 ? 1.0 : prev.left,
          stats:   bootPhase >= 4 ? 1.0 : prev.stats,
        };
      }
      case 'TOUR_NODE':
      case 'TOUR_TPS':
      case 'TOUR_TTFT':
      case 'TOUR_LAYERS':
      case 'TOUR_MEMORY':
      case 'TRY_BREAK':
      case 'EXPLAIN_BREAK':
      case 'TRY_EP5':
      case 'EXPLAIN_EP5':
      case 'FREEPLAY':      return { left: 1.0, mandala: 1.0, stats: 1.0, topbar: 0.5 };
      // "Click my glass sphere" — dim everything, guru stays bright
      case 'TRY_CLICK_GURU':return { left: 0.25, mandala: 0.15, stats: 0.15, topbar: 0.20 };
      case 'REWARD_INTRO':
      case 'COMPLETE':       return { left: 1.0, mandala: 1.0, stats: 1.0, topbar: 1.0 };
      default:               return { left: 1.0, mandala: 1.0, stats: 1.0, topbar: 1.0 };
    }
  }, [onboardingStep, bootPhase]);

  // Background music — lifted to App level so TopBar can control it
  const {
    enabled: musicEnabled, toggle: toggleMusic, trackName: musicTrack,
    setAudioQuality, next: musicNext, prev: musicPrev, random: musicRandom,
    phase: musicPhase, setPhase: setMusicPhase, playReward, setActiveModel: setMusicModel,
    setDucking, setOomMute, analyserRef, onTrackChangeRef, trackChangeCountRef,
  } = useBackgroundMusic();

  // Sync simInferenceActive with node-level metrics for particle animation
  useEffect(() => {
    if (simInferenceActive) {
      setState(prev => {
        const nodeCount = prev.globalTopology === 'SINGLE' ? 1 :
          prev.globalTopology === 'EP5_SOLO' ? 5 :
          prev.globalTopology.startsWith('RING_PP') ? parseInt(prev.globalTopology.replace('RING_PP', '')) :
          prev.globalTopology === 'TP2_RDMA' ? 2 :
          prev.globalTopology === 'TP4_RDMA' ? 4 : 5;

        return {
          ...prev,
          nodes: prev.nodes.map((node, i) => {
            const isActive = i < nodeCount && node.role !== 'idle';
            const nodeTps = isActive
              ? simTps / nodeCount + (Math.random() - 0.5) * 1.5
              : 0;
            return {
              ...node,
              tok_per_sec: nodeTps,
              gpu_util: isActive ? 65 + Math.random() * 20 : 5
            };
          })
        };
      });
    }
  }, [simInferenceActive, simTps]);

  // Handler for KV cache changes from ChatSimulator
  const handleKvCacheChange = useCallback((kvPercent: number, _totalTokens: number) => {
    setSimKvCachePercent(kvPercent);
    setState(prev => {
      const nodeCount = prev.globalTopology === 'SINGLE' ? 1 :
        prev.globalTopology === 'EP5_SOLO' ? 5 :
        prev.globalTopology.startsWith('RING_PP') ? parseInt(prev.globalTopology.replace('RING_PP', '')) :
        prev.globalTopology === 'TP2_RDMA' ? 2 :
        prev.globalTopology === 'TP4_RDMA' ? 4 : 5;

      return {
        ...prev,
        nodes: prev.nodes.map((node, i) => {
          const isActive = i < nodeCount;
          if (!isActive) return { ...node, kv_cache_pct: 0 };
          const nodeKvVariation = (Math.random() - 0.5) * 5;
          return {
            ...node,
            kv_cache_pct: Math.max(0, Math.min(95, kvPercent + nodeKvVariation))
          };
        })
      };
    });
  }, []);

  // Handler for simulation config changes from SimulationPanel
  const handleSimConfigChange = useCallback((
    config: SimulationConfig,
    metrics: SimulationMetrics
  ) => {
    const wasOom = simOomRef.current;
    const isOom = !metrics.feasible;
    setSimOom(isOom);
    simOomRef.current = isOom;

    // Recovery: error → working config — model loading SFX + success
    // Suppress during onboarding — first successful config is part of the tutorial flow
    if (wasOom && !isOom && !onboardingStepRef.current) {
      guruTriggerErrorRef.current?.('RECOVERY');
      // Model loading sound — the reward for finding a working config
      const loadIdx = Math.floor(Math.random() * 12) + 1;
      const loadSfx = new Audio(`${import.meta.env.BASE_URL || '/'}guruswami/sfx/model_loading_${String(loadIdx).padStart(5, '0')}.m4a`);
      loadSfx.volume = 0.25;
      loadSfx.play().catch(() => {});
    }

    // Error: working → broken config — red flash + error SFX + explanation
    // Suppress during onboarding — cluster starts in error state, not useful to announce
    if (isOom && !wasOom && !onboardingStepRef.current) {
      const errorSfx = new Audio(`${import.meta.env.BASE_URL || '/'}guruswami/sfx/${metrics.errorType === 'OOM' ? 'select_oom' : 'select_config_fail'}.m4a`);
      errorSfx.volume = 0.25;
      errorSfx.play().catch(() => {});
      // Map the specific error type from the metrics engine to a guru error ID
      const errorType = metrics.errorType;
      if (errorType === 'CONTEXT_EXCEEDED') {
        oomErrorTypeRef.current = 'oom';
        guruTriggerErrorRef.current?.('CONTEXT_CAPPED');
      } else if (errorType === 'SHARD_ERR') {
        oomErrorTypeRef.current = 'shard';
        guruTriggerErrorRef.current?.('SHARD_ERROR');
      } else if (errorType === 'GPU_TIMEOUT') {
        oomErrorTypeRef.current = 'oom';
        guruTriggerErrorRef.current?.('GPU_TIMEOUT');
      } else if (errorType === 'RDMA_UNSTABLE') {
        oomErrorTypeRef.current = 'shard';
        guruTriggerErrorRef.current?.('RDMA_UNSTABLE');
      } else {
        // OOM or generic infeasible
        oomErrorTypeRef.current = 'oom';
        guruTriggerErrorRef.current?.('OOM');
      }
    }

    setSimTps(isOom ? 0 : metrics.tps);
    setSimTtft(metrics.ttft);
    setSimKvCachePercent(metrics.kvCachePercent);
    setSimPerplexityPct(metrics.perplexityPct);
    setSimWeightsPerNode(metrics.weightsPerNode);
    setSimKvCachePerNode(metrics.kvCachePerNode);
    setSimFreePerNode(metrics.freePerNode);

    const rawPerplexity = 3 + (100 - metrics.perplexityPct) * 0.9;
    setLabPerplexity(rawPerplexity);

    const modelSpec = getModel(config.modelId);
    if (modelSpec) {
      setSimModelLayers(modelSpec.layers);
      setSimModelArch(modelSpec.architecture);
    }

    setSelectedModelId(config.modelId);
    setLabQuantization(config.quantization);
    setInputTokens(config.kvCacheTokens);
    setAudioQuality(config.quantization);

    // Music: only switch to model's tier when the config is feasible
    // Silence during configuration is intentional — music is the reward
    if (!isOom && config.modelId && config.topology) {
      if (!onboardingStepRef.current) setMusicPhase('active');
      setMusicModel(config.modelId);
    }

    const topology = config.topology;
    const nodeCount = metrics.nodeCount;
    const model = metrics.model;

    const getNodeType = (mode: ClusterMode) => {
      if (mode === 'SINGLE') return 'single';
      if (mode.startsWith('EP')) return 'solo';
      if (mode.startsWith('RING_PP')) return 'pp';
      if (mode.startsWith('TP')) return 'tp';
      return 'tp';
    };
    const nodeType = getNodeType(topology);
    const effectiveTps = isOom ? 0 : metrics.tps;

    setState(prev => ({
      ...prev,
      globalTopology: topology,
      nodes: prev.nodes.map((node, i) => {
        const isActive = i < nodeCount && !isOom;

        let role = 'idle';
        let assignedModelId = 'none';

        if (!isOom) {
          if (nodeType === 'single') {
            role = i === 0 ? 'compute' : 'idle';
            assignedModelId = i === 0 ? config.modelId : 'none';
          } else if (nodeType === 'solo' && i < nodeCount) {
            role = 'standalone';
            assignedModelId = config.modelId;
          } else if (i < nodeCount) {
            role = 'compute';
            assignedModelId = config.modelId;
          }
        }

        const baseLoad = isActive ? 45 + Math.random() * 30 : 0;
        // Per-node TPS depends on topology:
        // TP: each node contributes to every token — show per-node share
        // PP: output comes from last stage — only last node shows full TPS
        // EP/SINGLE: each node runs independently at full TPS
        const baseTps = isActive
          ? (nodeType === 'solo' || nodeType === 'single')
            ? effectiveTps + (Math.random() - 0.5) * 2  // Independent: full TPS per node
            : effectiveTps / nodeCount + (Math.random() - 0.5) * 1  // Distributed: share of cluster TPS
          : 0;

        return {
          ...node,
          role,
          assignedModelId,
          gpu_util: isActive ? baseLoad : 0,
          soc_load: isActive ? baseLoad * 0.8 : 0,
          tok_per_sec: baseTps,
          power_w: isActive ? metrics.totalPower / nodeCount + (Math.random() - 0.5) * 10 : 18,
          temp_c: isActive ? 55 + Math.random() * 20 : 35,
          kv_cache_pct: isActive ? metrics.kvCachePercent + (Math.random() - 0.5) * 5 : 0,
          ram_used: isActive ? metrics.memPerNode + Math.random() * 20 : 0,
          wired_gb: isActive ? metrics.memPerNode : 0,
          rdma_latency_us: isActive && nodeType !== 'solo' ? 8 + Math.random() * 5 : 0,
          tb5_reachable: isActive && nodeType !== 'solo' ? nodeCount - 1 : 0,
          tb5_status: isActive && nodeType !== 'solo' ? 'healthy' as const : 'unknown' as const,
        };
      }),
      activeModels: isOom ? [] : (topology === 'SINGLE' ? [{
        id: config.modelId,
        name: model?.displayName || 'Unknown Model',
        mode: topology,
        nodeIds: [INITIAL_NODES[0].id],
        tokPerSec: metrics.tps,
        medianTTFT: metrics.ttft,
        activeRequests: 1,
        color: model?.color || '#10b981'
      }] : topology === 'EP5_SOLO' ? [
        { id: 'qwen25-32b-0', name: 'Qwen 32B', mode: topology, nodeIds: [INITIAL_NODES[0].id], tokPerSec: 78, medianTTFT: 0.05, activeRequests: 1, color: '#14b8a6' },
        { id: 'mixtral-8x7b-1', name: 'Mixtral 8x7B', mode: topology, nodeIds: [INITIAL_NODES[1].id], tokPerSec: 98, medianTTFT: 0.03, activeRequests: 2, color: '#fb923c' },
        { id: 'llama-405b-2', name: 'Llama 405B', mode: topology, nodeIds: [INITIAL_NODES[2].id], tokPerSec: 29, medianTTFT: 0.14, activeRequests: 1, color: '#3b82f6' },
        { id: 'deepseek-v3-3', name: 'DeepSeek V3', mode: topology, nodeIds: [INITIAL_NODES[3].id], tokPerSec: 31, medianTTFT: 0.18, activeRequests: 1, color: '#22c55e' },
        { id: 'kimi-k2.5-4', name: 'Kimi K2.5', mode: topology, nodeIds: [INITIAL_NODES[4].id], tokPerSec: 4, medianTTFT: 2.5, activeRequests: 0, color: '#a855f7' },
      ] : [{
        id: config.modelId,
        name: model?.displayName || 'Unknown Model',
        mode: topology,
        nodeIds: INITIAL_NODES.slice(0, nodeCount).map(n => n.id),
        tokPerSec: metrics.tps,
        medianTTFT: metrics.ttft,
        activeRequests: 3,
        color: model?.color || '#a855f7'
      }])
    }));
  }, []);

  // Handler for lab mode metrics changes
  const handleLabMetricsChange = useCallback((tps: number, perplexity: number, quantization: string) => {
    setLabTps(tps);
    setLabPerplexity(perplexity);
    setLabQuantization(quantization);
  }, []);

  // Handler for full sim state changes - drives node visualization
  const handleSimStateChange = useCallback((newSimState: SimStateUpdate) => {
    setSimState(newSimState);
    setLabPerplexity(newSimState.metrics.perplexity);
    setLabQuantization(`${newSimState.meshTopology.strategy}`);

    const meshToTopology: Record<string, ClusterMode> = {
      'solo': 'EP5_SOLO',
      'pp2': 'RING_PP2',
      'pp3': 'RING_PP3',
      'pp4': 'RING_PP4',
      'pp5': 'RING_PP5',
      'tp2': 'TP2_RDMA',
      'tp4': 'TP4_RDMA',
    };
    const newTopology = meshToTopology[newSimState.meshTopology.id] || 'EP5_SOLO';
    const nodeCount = newSimState.meshTopology.nodeCount;
    const isGenerating = newSimState.inferencePhase === 'generating';
    const isPrefilling = newSimState.inferencePhase === 'prefilling';
    const isActive = newSimState.modelLoaded && (isGenerating || isPrefilling);

    setState(prev => ({
      ...prev,
      globalTopology: newTopology,
      nodes: prev.nodes.map((node, i) => {
        const isInMesh = i < nodeCount;
        const isNodeActive = isInMesh && newSimState.modelLoaded;

        const nodeTps = isNodeActive && isGenerating
          ? newSimState.metrics.tps / nodeCount
          : 0;

        const networkTraffic = isNodeActive && isGenerating
          ? newSimState.meshTopology.strategy === 'Tensor Parallel'
            ? 2.5 + Math.random() * 1.5
            : 0.8 + Math.random() * 0.5
          : 0;

        return {
          ...node,
          tok_per_sec: nodeTps,
          role: isInMesh
            ? (newSimState.modelLoaded ? 'compute' : 'idle')
            : 'idle',
          assignedModelId: isInMesh && newSimState.modelLoaded ? 'sim-model' : 'none',
          gpu_util: isNodeActive
            ? (isGenerating ? newSimState.nodeMetrics.gpuPercent : (isPrefilling ? 85 + Math.random() * 10 : 5))
            : 0,
          cpu_util: isNodeActive
            ? newSimState.nodeMetrics.cpuPercent
            : 0,
          power_w: isNodeActive
            ? newSimState.nodeMetrics.powerWatts
            : 5,
          temp_c: isNodeActive
            ? newSimState.nodeMetrics.temperature
            : 25,
          ram_used: isInMesh && newSimState.modelLoaded
            ? newSimState.metrics.memoryPerNode
            : 8,
          kv_cache_pct: isNodeActive
            ? newSimState.metrics.kvCachePercent
            : 0,
          rx_gbps: networkTraffic,
          tx_gbps: networkTraffic,
        };
      }),
      activeModels: newSimState.modelLoaded ? [{
        id: 'sim-model',
        name: `MEGA-BRAINY-LLM`,
        mode: newTopology,
        nodeIds: INITIAL_NODES.slice(0, nodeCount).map(n => n.id),
        tokPerSec: isGenerating ? newSimState.metrics.tps : 0,
        medianTTFT: newSimState.metrics.ttftMs / 1000,
        activeRequests: isGenerating ? 1 : 0,
        color: newSimState.metrics.perplexity < 6 ? '#a855f7' : '#3b82f6'
      }] : []
    }));
  }, []);

  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphCenter, setGraphCenter] = useState({ x: 0.33, y: 0.5 });

  useEffect(() => {
    const updateCenter = () => {
      if (graphContainerRef.current) {
        const rect = graphContainerRef.current.getBoundingClientRect();
        setGraphCenter({
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight
        });
      }
    };
    window.addEventListener('resize', updateCenter);
    updateCenter();
    return () => window.removeEventListener('resize', updateCenter);
  }, []);

  const [state, setState] = useState<ClusterState>({
    globalTopology: 'OFFLINE',
    fabric: 'OFFLINE',
    activeModels: [],
    nodes: INITIAL_NODES.map((node, i) => ({
      ...node,
      index: i,
      role: 'idle',
      assignedModelId: 'none',
      cpu_util: 0,
      gpu_util: 0,
      temp_c: 0,
      power_w: 20,
      ram_used: 0,
      ram_total: 512,
      kv_cache_pct: 0,
      rx_gbps: 0,
      tx_gbps: 0,
      tok_per_sec: 0,
      rdma_latency_us: 0,
      tb5_links: 4,
      glowColor: node.glowColor
    })),
    history: []
  });

  // During onboarding (before model loaded), show idle cluster
  // After LOADING (tour, break/fix, freeplay), cluster runs normally
  const PRE_LOAD_STEPS = ['INTRO', 'INTRO_GREETING', 'INTRO_HELP', 'INTRO_ROLE', 'INTRO_CONTROLS', 'INTRO_CLUSTER', 'PICK_MODEL', 'PICK_QUANT', 'PICK_CONTEXT', 'PICK_TOPOLOGY'];
  const isOnboarding = onboardingStep !== null && PRE_LOAD_STEPS.includes(onboardingStep);
  const displayState = useMemo<ClusterState>(() => {
    if (!isOnboarding) return state;
    return {
      ...state,
      activeModels: [],
      nodes: state.nodes.map(node => ({
        ...node,
        gpu_util: 0,
        tok_per_sec: 0,
        wired_gb: 0,
        power_w: 18,
        temp_c: 35,
        kv_cache_pct: 0,
        role: 'idle',
      })),
    };
  }, [state, isOnboarding]);

  const aggregateTps = useMemo(() => {
    return state.nodes.reduce((acc, n) => acc + n.tok_per_sec, 0);
  }, [state.nodes]);

  // Music stays in intro (ambient) throughout the entire tutorial.
  // On tutorial completion: play the celebration reward track.
  // On model switch after tutorial: switch to active (model-specific) music.
  const prevOnboardingRef = useRef<OnboardingStep>(onboardingStep);
  useEffect(() => {
    const prev = prevOnboardingRef.current;
    prevOnboardingRef.current = onboardingStep;

    if (onboardingStep === 'LOADING' && prev !== 'LOADING' && musicEnabled) {
      // EP1 model loaded — start a guru intro track (Indian lo-fi, one-shot)
      // Calm but engaging — the first music the user hears
      setMusicPhase('intro');
      setOomMute(false);
    } else if (onboardingStep === 'EXPLAIN_EP5' && prev !== 'EXPLAIN_EP5' && musicEnabled) {
      // EP5 recovery — high-tempo reward! the-full-saturation (one-shot, silence after)
      playReward(1, true);  // Slot 1: tutorial-reward-the-full-saturation
    } else if (prev && !onboardingStep && musicEnabled) {
      // Tutorial complete — bonus track (massively over the top, one-shot)
      // Phase stays intro — only switches to active when user clicks a new model card
      playReward(0, true);  // Slot 0: tutorial-bonus-this-song-extended (one-shot → silence after)
    } else if (!onboardingStep && musicEnabled && selectedModelId && !prev) {
      // Skipped onboarding or returning user — go straight to model music
      setMusicPhase('active');
    }
  }, [onboardingStep, musicEnabled, setMusicPhase, selectedModelId, playReward]);

  // OOM → mute music. Recovery → unmute.
  // During onboarding before LOADING: keep muted (silence during PICK steps)
  // After LOADING: the onboarding music triggers handle it explicitly
  // Music muting during tutorial:
  // - Before LOADING: silence (no music yet)
  // - LOADING → tour: intro track plays (unmuted)
  // - TRY_BREAK crash: mute (crash kills the music)
  // - EP5 recovery: the-full-saturation starts via playReward
  // - Post-tutorial: normal OOM muting
  const SILENT_STEPS = ['INTRO', 'INTRO_GREETING', 'INTRO_HELP', 'INTRO_ROLE', 'INTRO_CONTROLS',
    'INTRO_CLUSTER', 'PICK_MODEL', 'PICK_QUANT', 'PICK_CONTEXT', 'PICK_TOPOLOGY'];
  useEffect(() => {
    if (onboardingStep && SILENT_STEPS.includes(onboardingStep)) {
      setOomMute(true);  // Silence before model loads
    } else if (onboardingStep && simOom) {
      setOomMute(true);  // Crash during tutorial kills the music
    } else if (onboardingStep) {
      setOomMute(false);  // Music plays during working tutorial steps
    } else {
      setOomMute(simOom);  // Normal post-tutorial behaviour
    }
  }, [simOom, setOomMute, onboardingStep]);

  // OOM/Shard → periodic guru hints
  const oomHintIndexRef = useRef(0);
  useEffect(() => {
    if (!simOom) {
      oomHintIndexRef.current = 0;
      return;
    }
    const hints = oomErrorTypeRef.current === 'shard'
      ? ['OOM_HINT_SHARD']
      : ['OOM_HINT_QUANT', 'OOM_HINT_TOPOLOGY'];
    const interval = setInterval(() => {
      const hint = hints[oomHintIndexRef.current % hints.length];
      oomHintIndexRef.current++;
      guruTriggerErrorRef.current?.(hint);
    }, 18000);
    return () => clearInterval(interval);
  }, [simOom]);

  // Wire music track changes → Guruswami commentary
  useEffect(() => {
    onTrackChangeRef.current = (_trackName: string) => {
      guruMusicTrackChangeRef.current?.(trackChangeCountRef.current);
    };
    return () => { onTrackChangeRef.current = null; };
  }, [onTrackChangeRef, trackChangeCountRef]);

  // Build metrics for ClakyButton (Vestaboard)
  const clakyMetrics = useMemo((): ClakyMetrics => {
    const activeModel = state.activeModels[0];
    const totalPower = state.nodes.reduce((acc, n) => acc + (n.power_w || 0), 0);
    const nodeCount = getNodeCount(state.globalTopology);
    const modelSpec = selectedModelId ? getModel(selectedModelId) : undefined;

    return {
      modelName: modelSpec?.displayName || activeModel?.name || 'Kimi K2.5',
      totalParams: modelSpec?.totalParams || '1T',
      quantization: labQuantization || 'Q4',
      topology: state.globalTopology,
      nodeCount: nodeCount || 4,
      tps: simTps,
      ttft: simTtft,
      kvCachePercent: simKvCachePercent,
      inputTokens: inputTokens,
      outputTokens: 512,
      totalPower: Math.round(totalPower),
    };
  }, [state, simTps, simTtft, simKvCachePercent, inputTokens, selectedModelId, labQuantization]);

  // Replay frame handler
  const handleReplayFrame = useCallback((frame: ReplayFrame) => {
    const newNodes = replayFrameToNodeMetrics(frame, state.nodes);
    const newTopology = mapTopologyToClusterMode(frame.topology);

    setState(prev => ({
      ...prev,
      globalTopology: newTopology,
      nodes: newNodes,
      activeModels: prev.activeModels.map(m => ({
        ...m,
        mode: newTopology,
        tokPerSec: frame.cluster_tps,
        medianTTFT: frame.ttft_ms / 1000,
      }))
    }));
  }, [state.nodes]);

  // Replay state change handler
  const handleReplayStateChange = useCallback((replayState: ReplayState) => {
    setCurrentReplayState(replayState);
    setIsReplayActive(replayState.isPlaying || replayState.replay !== null);
  }, []);

  // Animate simulated node metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const nodeCount = prev.globalTopology === 'SINGLE' ? 1 :
          prev.globalTopology === 'EP5_SOLO' ? 5 :
          prev.globalTopology.startsWith('RING_PP') ? parseInt(prev.globalTopology.replace('RING_PP', '')) :
          prev.globalTopology === 'TP2_RDMA' ? 2 :
          prev.globalTopology === 'TP4_RDMA' ? 4 : 5;

        const baseTps = prev.activeModels[0]?.tokPerSec || 0;
        const simTps = baseTps > 0 ? Math.max(0.1, baseTps + (Math.random() - 0.5) * baseTps * 0.15) : 0;
        const perNodeTps = baseTps > 0 ? simTps / nodeCount : 0;

        return {
          ...prev,
          nodes: prev.nodes.map((node, i) => {
            const isActive = i < nodeCount && node.role !== 'idle';
            if (!isActive) return { ...node, tok_per_sec: 0 };

            return {
              ...node,
              tok_per_sec: perNodeTps + (Math.random() - 0.5) * 0.3,
              gpu_util: Math.max(20, Math.min(95, node.gpu_util + (Math.random() - 0.5) * 8)),
              power_w: Math.max(60, Math.min(180, node.power_w + (Math.random() - 0.5) * 8)),
              temp_c: Math.max(45, Math.min(85, node.temp_c + (Math.random() - 0.5) * 2)),
            };
          }),
          history: [
            ...prev.history.slice(-59),
            {
              timestamp: Date.now(),
              tokPerSec: simTps,
              ttft: prev.activeModels[0]?.medianTTFT || 0,
            }
          ],
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const cycleTopology = useCallback(() => {
    setState(prev => {
      const modes: ClusterMode[] = [
        'RING_PP2', 'RING_PP3', 'RING_PP4', 'RING_PP5',
        'TP2_RDMA', 'TP4_RDMA',
        'EP5_SOLO',
      ];
      const currentIndex = modes.indexOf(prev.globalTopology);
      const nextMode = modes[(currentIndex + 1) % modes.length];

      const getModelConfig = (mode: ClusterMode) => {
        if (mode === 'EP5_SOLO') {
          return {
            models: [
              { id: 'qwen25-32b-0', name: 'Qwen 32B', nodeIdx: 0, color: '#14b8a6' },
              { id: 'mixtral-8x7b-1', name: 'Mixtral 8x7B', nodeIdx: 1, color: '#fb923c' },
              { id: 'llama-405b-2', name: 'Llama 405B', nodeIdx: 2, color: '#3b82f6' },
              { id: 'deepseek-v3-3', name: 'DeepSeek V3', nodeIdx: 3, color: '#22c55e' },
              { id: 'kimi-k2.5-4', name: 'Kimi K2.5', nodeIdx: 4, color: '#a855f7' },
            ]
          };
        }
        return {
          models: [{
            id: 'kimi-k2.5',
            name: 'Kimi K2.5',
            color: '#a855f7'
          }]
        };
      };

      const modelConfig = getModelConfig(nextMode);

      const updatedNodes = prev.nodes.map((node, i) => {
        let role = 'compute';
        let assignedModelId = 'kimi-k2.5';

        if (nextMode === 'EP5_SOLO') {
          role = 'standalone';
          assignedModelId = modelConfig.models[i]?.id || 'none';
        } else if (nextMode.startsWith('RING_PP')) {
          const stages = parseInt(nextMode.replace('RING_PP', ''));
          role = i < stages ? 'compute' : 'idle';
          assignedModelId = i < stages ? 'kimi-k2.5' : 'none';
        } else if (nextMode === 'TP2_RDMA') {
          role = i < 2 ? 'compute' : 'idle';
          assignedModelId = i < 2 ? 'kimi-k2.5' : 'none';
        } else if (nextMode === 'TP4_RDMA') {
          role = i < 4 ? 'compute' : 'idle';
          assignedModelId = i < 4 ? 'kimi-k2.5' : 'none';
        }

        return { ...node, role, assignedModelId };
      });

      const getActiveNodeIds = (mode: ClusterMode): string[] => {
        if (mode === 'EP5_SOLO') return [];
        if (mode.startsWith('RING_PP')) {
          const stages = parseInt(mode.replace('RING_PP', ''));
          return INITIAL_NODES.slice(0, stages).map(n => n.id);
        }
        if (mode === 'TP2_RDMA') return INITIAL_NODES.slice(0, 2).map(n => n.id);
        if (mode === 'TP4_RDMA') return INITIAL_NODES.slice(0, 4).map(n => n.id);
        return INITIAL_NODES.slice(0, 4).map(n => n.id);
      };

      const TOPOLOGY_BENCHMARKS: Record<string, { tps: number; ttft: number }> = {
        RING_PP2: { tps: 8.0, ttft: 0.9 },
        RING_PP3: { tps: 11.0, ttft: 1.1 },
        RING_PP4: { tps: 13.0, ttft: 1.3 },
        RING_PP5: { tps: 15.0, ttft: 1.6 },
        TP2_RDMA: { tps: 8.5, ttft: 0.45 },
        TP4_RDMA: { tps: 15.6, ttft: 0.34 },
      };

      let updatedModels: ModelInstance[];
      if (nextMode === 'EP5_SOLO') {
        updatedModels = modelConfig.models.map((m: any) => ({
          id: m.id,
          name: m.name,
          mode: nextMode,
          nodeIds: [INITIAL_NODES[m.nodeIdx].id],
          tokPerSec: 25 + Math.random() * 10,
          medianTTFT: 0.15 + Math.random() * 0.1,
          activeRequests: Math.floor(Math.random() * 3),
          color: m.color
        }));
      } else {
        const bench = TOPOLOGY_BENCHMARKS[nextMode] || { tps: 11.5, ttft: 0.8 };
        updatedModels = [{
          id: 'kimi-k2.5',
          name: 'Kimi K2.5',
          mode: nextMode,
          nodeIds: getActiveNodeIds(nextMode),
          tokPerSec: bench.tps,
          medianTTFT: bench.ttft,
          activeRequests: Math.floor(Math.random() * 3) + 1,
          color: '#a855f7'
        }];
      }

      return { ...prev, globalTopology: nextMode, nodes: updatedNodes, activeModels: updatedModels };
    });
  }, []);

  const isMobile = breakpoint === 'mobile';

  // Mobile metrics bar data
  const mobileMetrics = useMemo((): MobileMetrics => ({
    tps: simTps,
    ttft: simTtft,
    topology: state.globalTopology,
    quantization: labQuantization || 'Q4',
    modelName: selectedModelId ? (getModel(selectedModelId)?.displayName || selectedModelId) : 'Model',
    nodeCount: state.nodes.filter(n => n.role !== 'idle').length,
    kvCachePercent: simKvCachePercent,
  }), [simTps, simTtft, state.globalTopology, labQuantization, selectedModelId, state.nodes, simKvCachePercent]);

  // Shared SimulationPanel element (used in both desktop sidebar and mobile popover)
  const simulationPanelElement = (
    <SimulationPanel
      onConfigChange={handleSimConfigChange}
      initialConfig={{ topology: state.globalTopology }}
      modelCardsGlow={modelCardsGlow}
      onParameterChange={(type, value) => guruParameterChangeRef.current?.(type, value)}
      onboardingStep={onboardingStep}
      onHelpRequest={(controlType) => guruHelpRequestRef.current?.(controlType)}
      onTriggerError={(errorId) => guruTriggerErrorRef.current?.(errorId)}
      musicEnabled={musicEnabled}
      onMusicToggle={toggleMusic}
      musicTrack={musicTrack}
      onMusicNext={musicNext}
      onMusicPrev={musicPrev}
      onMusicRandom={musicRandom}
      speechEnabled={speechEnabled}
      onSpeechEnabledChange={setSpeechEnabled}
      onOpenCodex={openHelp}
      onRestartTutorial={() => {
        localStorage.removeItem('chakra-onboarding-complete');
        window.location.reload();
      }}
      onSkipTutorial={() => {
        guruSkipOnboardingRef.current?.();
        localStorage.setItem('chakra-onboarding-complete', 'true');
      }}
    />
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#000000] text-[#e0e0e0]">
      {/* Mobile Metrics Bar — replaces TopBar on mobile */}
      {isMobile && !onboardingStep && (
        <MobileMetricsBar metrics={mobileMetrics}>
          {simulationPanelElement}
        </MobileMetricsBar>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-[1500ms] ease-out"
             style={{ opacity: dimming.mandala }}>
          <MandalaShader
            width={window.innerWidth}
            height={window.innerHeight}
            tps={isOnboarding ? 0 : simTps}
            centerX={graphCenter.x}
            centerY={graphCenter.y}
            perplexity={labPerplexity}
            modelLoaded={displayState.activeModels.length > 0}
            oomState={simOom}
          />
        </div>

        {/* Visualization Area — 66% on desktop, full width on mobile/tablet */}
        <div ref={graphContainerRef} className={`${isDesktop ? 'w-[66%]' : 'w-full'} h-full relative z-10 overflow-hidden`}>
          {/* TopBar — hidden on mobile (replaced by MobileMetricsBar), shown during onboarding on all devices */}
          {(!isMobile || onboardingStep) && (
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none transition-opacity duration-[1500ms] ease-out" style={{ opacity: dimming.topbar }}>
            <TopBar
              state={state}
              onToggleMode={cycleTopology}
              mode="SIM"
              clakyMetrics={clakyMetrics}
              onOpenClusterDetailed={() => setIsClusterDetailedOpen(true)}
              onboardingStep={onboardingStep}
              onSimulateVestaboard={handleSimulateVestaboard}
              breakpoint={breakpoint}
            />
          </div>
          )}

          {/* Simulated Vestaboard overlay */}
          {vestaGrid && (
            <VestaboardOverlay
              grid={vestaGrid}
              visible={vestaVisible}
              onDismiss={handleDismissVestaboard}
            />
          )}

          <div className="w-full h-full transition-opacity duration-[1500ms] ease-out" style={{ opacity: dimming.left }}>
            <MeshGraph
              state={displayState}
              onNodeClick={(node) => setFocusedNode(node)}
              onToggleMode={cycleTopology}
              isLive={false}
              labPerplexity={labPerplexity}
              labQuantization={labQuantization}
              estimatedTps={isOnboarding ? 0 : simTps}
              onOpenClusterDetailed={() => setIsClusterDetailedOpen(true)}
              modelLayers={simModelLayers}
              modelArchitecture={simModelArch}
              weightsPerNode={simWeightsPerNode}
              kvCachePerNode={simKvCachePerNode}
              freePerNode={simFreePerNode}
              analyserRef={analyserRef}
              compact
              onboardingStep={onboardingStep}
              isError={simOom}
            />
          </div>

          {/* ClusterTopologyCard — compact clickable gateway to detailed view */}
          <ClusterTopologyCard
            topology={displayState.globalTopology}
            tps={isOnboarding ? 0 : simTps}
            ttft={isOnboarding ? 0 : simTtft}
            nodeCount={displayState.nodes.filter(n => n.role !== 'idle').length || (isOnboarding ? 0 : 1)}
            modelName={selectedModelId}
            onClick={() => setIsClusterDetailedOpen(true)}
            history={state.history}
            totalLayers={simModelLayers}
            weightsPerNode={simWeightsPerNode}
            kvCachePerNode={simKvCachePerNode}
            freePerNode={simFreePerNode}
            highlightSection={tourHighlight}
            animTps={simTps}
            containerStyle={{ opacity: dimming.stats }}
            containerClassName="transition-opacity duration-[1500ms] ease-out"
            compactMode={!isDesktop}
          />

          {/* Guruswami — interactive tutorial guide */}
          <GuruswamiAvatar
            tps={simTps}
            perplexityPct={simPerplexityPct}
            quantization={labQuantization}
            speechEnabled={speechEnabled}
            mode="SIM"
            selectedModelId={selectedModelId}
            selectedModelName={selectedModelId ? (getModel(selectedModelId)?.displayName || selectedModelId) : undefined}
            topology={state.globalTopology}
            configComplete={!simOom && !!selectedModelId}
            onParameterChangeRef={guruParameterChangeRef}
            onHelpRequestRef={guruHelpRequestRef}
            onTriggerGuruErrorRef={guruTriggerErrorRef}
            onMusicTrackChangeRef={guruMusicTrackChangeRef}
            onSkipOnboardingRef={guruSkipOnboardingRef}
            onWelcomeDismissedRef={guruWelcomeDismissedRef}
            onModelCardsGlowChange={setModelCardsGlow}
            onOnboardingStepChange={setOnboardingStep}
            onboardingStepFromParent={onboardingStep}
            setDucking={setDucking}
            breakpoint={breakpoint}
          />

          {/* Welcome Gate — first-visit choice: onboarding or skip */}
          {onboardingStep === 'INTRO' && !welcomeGateDismissed && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center">
              <div
                className={`rounded-3xl ${isDesktop ? 'p-10' : 'p-6'} border border-white/10 flex flex-col items-center gap-6 ${isDesktop ? 'max-w-sm' : 'max-w-[90vw]'} text-center`}
                style={{ background: 'rgba(10, 8, 20, 0.85)', backdropFilter: 'blur(20px)' }}
              >
                <h2 className="text-lg font-black text-white/80 tracking-wide uppercase">
                  Welcome to Chakra
                </h2>
                <p className="text-sm text-white/40 font-mono">
                  Distributed LLM inference simulator
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => {
                      setWelcomeGateDismissed(true);
                      guruWelcomeDismissedRef.current?.();
                    }}
                    className="px-6 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-200 font-black text-sm uppercase tracking-wider hover:bg-amber-500/30 transition-all"
                  >
                    I'm new here
                  </button>
                  <button
                    onClick={() => {
                      setWelcomeGateDismissed(true);
                      guruSkipOnboardingRef.current?.();
                      localStorage.setItem('chakra-onboarding-complete', 'true');
                    }}
                    className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-sm uppercase tracking-wider hover:bg-white/10 hover:text-white/60 transition-all"
                  >
                    I know what I'm doing
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Skip tutorial moved to SimulationPanel top */}
        </div>

        {/* Simulation Panel — static sidebar on desktop, drawer on tablet, metrics bar popover on mobile */}
        {!isMobile && (
          <ResponsiveDrawer
            isOpen={drawerOpen}
            onToggle={() => setDrawerOpen(prev => !prev)}
            breakpoint={breakpoint}
          >
            {simulationPanelElement}
          </ResponsiveDrawer>
        )}

        {/* Floating Configure button — tablet only, when drawer is closed */}
        {breakpoint === 'tablet' && !drawerOpen && !onboardingStep && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-5 py-3 bg-purple-600/90 text-white rounded-2xl shadow-[0_8px_32px_rgba(99,102,241,0.4)] hover:bg-purple-500/90 active:scale-95 transition-all border border-purple-400/30"
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Configure</span>
          </button>
        )}
      </main>

      {/* Lazy-loaded modals — chunks fetched on first open */}
      <Suspense fallback={null}>
        {focusedNode && <NodeFocusView node={focusedNode} onClose={() => setFocusedNode(null)} />}
        {isClusterDetailedOpen && (
          <ClusterDetailedView
            state={state}
            onClose={() => setIsClusterDetailedOpen(false)}
            labPerplexity={labPerplexity}
            labQuantization={labQuantization}
            weightsPerNode={simWeightsPerNode}
            kvCachePerNode={simKvCachePerNode}
            freePerNode={simFreePerNode}
            modelLayers={simModelLayers}
            modelArchitecture={simModelArch}
            estimatedTps={simTps}
            estimatedTtft={simTtft}
            modelName={selectedModelId}
            isLive={false}
          />
        )}
        {isHelpOpen && <CodexPanel />}
      </Suspense>

    </div>
  );
};

const App: React.FC = () => (
  <CodexProvider>
    <AppContent />
  </CodexProvider>
);

export default App;
