
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ClusterState, NodeMetrics, NodeVisualState } from '../types';
import InferenceCore from './InferenceCore';
import LayerStack from './LayerStack';
import ExpertFiber from './ExpertFiber';
import { CHAKRA_SYMBOLS, CHAKRA_COLORS } from '../constants';
import { Activity, HardDrive, Database, Thermometer, AlertTriangle, Wifi, WifiOff, AlertCircle, XCircle, CheckCircle, X, RefreshCw, Power, Loader2 } from 'lucide-react';
import {
  isPipelineParallel,
  isTensorParallel,
  getAnimationProfile,
  getNodeAnimationParams,
  getLinkAnimationParams,
  AnimationProfile,
  getNodeVisualState,
  getRingExpansionScale,
  getTokenFlowInterval,
  getActiveNodeIndices
} from '../simulation/simulationUtils';
import { getTpsColor, getTpsGradient, getTpsSpinDuration, useChakraTheme } from '../hooks';

interface MeshGraphProps {
  state: ClusterState;
  onNodeClick: (node: NodeMetrics) => void;
  onToggleMode?: () => void;
  isLive?: boolean;
  labPerplexity?: number;
  labQuantization?: string;
  meshBannerOpen?: boolean;
  onMeshBannerOpenChange?: (open: boolean) => void;
  estimatedTps?: number;  // Steady estimated TPS for animation (from SimulationPanel)
  onOpenClusterDetailed?: () => void;  // Callback to open Cluster Diagnostics HUD
  modelLayers?: number;      // Total transformer layers (from model catalog)
  modelArchitecture?: 'dense' | 'moe'; // Model type for expert fiber
  weightsPerNode?: number;   // Model weights GB per node
  kvCachePerNode?: number;   // KV cache GB per node
  freePerNode?: number;      // Remaining GB per node (512 - weights - kv)
  analyserRef?: React.RefObject<AnalyserNode | null>;  // Audio analyser for visual amplitude
  compact?: boolean;         // When true, hide InferenceCore left panels
  onboardingStep?: string | null;  // Current onboarding step — nodes highlight during intro
  isError?: boolean;         // Cluster in error/OOM state — nodes glow red
}

const GLASS_SPHERE_SRC = `${import.meta.env.BASE_URL}guruswami/glass_sphere.png`;

const MeshGraph: React.FC<MeshGraphProps> = ({ state, onNodeClick, onToggleMode, isLive = false, labPerplexity, labQuantization, meshBannerOpen, onMeshBannerOpenChange, estimatedTps, onOpenClusterDetailed, modelLayers, modelArchitecture, weightsPerNode, kvCachePerNode, freePerNode, analyserRef, compact, onboardingStep, isError }) => {
  const meshHealth: any = undefined; // Stripped for SIM-only mode
  const { nodes, activeModels, globalTopology } = state;
  const width = 2200;
  const height = 1600;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 520;

  const [hoveredNode, setHoveredNode] = useState<NodeMetrics | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  // Use props for banner visibility, fallback to internal state if not provided
  const [internalBannerOpen, setInternalBannerOpen] = useState(true);
  const isBannerOpen = meshBannerOpen ?? internalBannerOpen;
  const setBannerOpen = (open: boolean) => {
    if (onMeshBannerOpenChange) {
      onMeshBannerOpenChange(open);
    } else {
      setInternalBannerOpen(open);
    }
  };

  // Reset banner state when mesh becomes healthy
  useEffect(() => {
    if (meshHealth?.healthy && meshHealth?.rdma) {
      setBannerOpen(true); // Auto-show banner (will show success briefly)
      setIsRecovering(false);
      setRecoveryAttempts(0);
    }
  }, [meshHealth?.healthy, meshHealth?.rdma]);

  // Handle mesh repair actions
  const handleMeshRepair = async (action: 'soft' | 'hard' | 'reboot') => {
    setIsRecovering(true);
    setRecoveryAttempts(prev => prev + 1);

    try {
      // Send repair command via bridge API
      const response = await fetch('/api/mesh/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        console.error('Mesh repair request failed');
      }
    } catch (error) {
      console.error('Failed to send repair command:', error);
    }

    // Recovery will be detected via meshHealth updates
    // Set a timeout to clear recovering state if no response
    setTimeout(() => {
      if (!meshHealth?.healthy) {
        setIsRecovering(false);
      }
    }, 120000); // 2 minute timeout
  };

  // Get cluster TPS for audio and color effects
  const clusterTps = activeModels[0]?.tokPerSec || 0;

  // For animation: use estimatedTps if provided, otherwise use clusterTps, with fallback to 15
  const effectiveEstimatedTps = estimatedTps ?? (clusterTps > 0 ? clusterTps : 15);

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAKRA THEME - Centralized visual state from quantization + metrics
  // ═══════════════════════════════════════════════════════════════════════════
  const theme = useChakraTheme(nodes, labQuantization, globalTopology, clusterTps);
  const shouldApplyDissonance = theme.isDissonant;

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME TOKEN PARTICLE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  // Tokens spawn at actual TPS rate (e.g., 13 TPS = 1 token every ~77ms)
  // Each particle travels along a link and fades out after reaching destination
  interface TokenParticle {
    id: number;
    linkIndex: number;
    progress: number;      // 0-1, position along link
    startTime: number;
    duration: number;      // ms for full traversal
  }
  const [tokenParticles, setTokenParticles] = useState<TokenParticle[]>([]);
  const particleIdRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);

  // Get animation profile for current topology
  const animationProfile = useMemo(() => getAnimationProfile(globalTopology), [globalTopology]);

  // PP animation duration — must match ClusterTopologyCard's ppScan timing exactly
  const ppAnimDuration = useMemo(() => {
    if (!isPipelineParallel(globalTopology) || effectiveEstimatedTps <= 0) return 0;
    return Math.max(0.8, 4 - (effectiveEstimatedTps / 20) * 3.2);
  }, [globalTopology, effectiveEstimatedTps]);

  // PP active node indices — only these nodes participate in the pipeline wave
  const ppActiveIndices = useMemo(() => {
    if (!isPipelineParallel(globalTopology)) return [];
    return getActiveNodeIndices(globalTopology);
  }, [globalTopology]);

  // Onboarding intro node highlight — nodes light up sequentially during INTRO_GREETING
  const introHighlightStart = useRef<number>(0);
  const isIntroHighlight = onboardingStep === 'INTRO_GREETING' || onboardingStep === 'INTRO_HELP';
  useEffect(() => {
    if (onboardingStep === 'INTRO_GREETING') {
      introHighlightStart.current = Date.now();
    }
  }, [onboardingStep]);

  // Update time offset for animations (only in sim mode for performance)
  useEffect(() => {
    if (isLive) return;
    const interval = setInterval(() => {
      setTimeOffset(Date.now());
    }, 50); // 20fps for smooth animations
    return () => clearInterval(interval);
  }, [isLive]);

  const nodePositions = useMemo(() => {
    return nodes.map((node, i) => {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return { ...node, x, y, angle };
    });
  }, [nodes, centerX, centerY, radius]);

  // ═══════════════════════════════════════════════════════════════════════════
  // NETWORK FABRIC COLORS
  // ═══════════════════════════════════════════════════════════════════════════
  // TB5 (Thunderbolt 5): Bright cyan with white core - looks like lightning
  // 10GbE Ethernet: Blue like physical ethernet cables - dashed for distinction
  // Tokens: Light yellow semi-transparent blobs flowing through links
  const RDMA_COLOR = '#22d3ee';    // Cyan 400 - TB5 RDMA (lightning blue)
  const ETHERNET_COLOR = '#3b82f6'; // Blue 500 - 10GbE Ethernet (cable blue)
  const TOKEN_COLOR = '#fef08a';    // Yellow 200 - Tokens (light yellow)

  // 1. COMPUTE FABRIC LINKS (TB5)
  const computeLinks = useMemo(() => {
    const l: any[] = [];
    const addComputeLink = (n1: any, n2: any, bidirectional: boolean = true) => {
      // Only skip if node is truly offline (no power) - use visual state logic
      // Don't skip based on role field from MQTT (it's unreliable)
      // Threshold lowered from 5W to 1W for idle M4 Pro support (~3W idle)
      const n1Offline = !n1.power_w || n1.power_w < 1;
      const n2Offline = !n2.power_w || n2.power_w < 1;
      if (n1Offline || n2Offline) return;

      const combinedGbps = (n1.rx_gbps + n1.tx_gbps + n2.rx_gbps + n2.tx_gbps) / 4;
      const intensity = Math.max(0.01, Math.min(1.0, combinedGbps / 15));
      l.push({ n1, n2, intensity, bidirectional });
    };

    // No TB5 compute links when offline or any EP mode (nodes are independent)
    if (globalTopology === 'OFFLINE' || globalTopology === 'SINGLE' || globalTopology.startsWith('EP')) {
      return l;
    }

    // RING/PIPELINE topologies: sequential chain, bidirectional TB5
    // Forward: activations flow 0→1→2→...→N (layer processing)
    // Reverse: output tokens return N→...→1→0 (same TB5 links)
    if (globalTopology.startsWith('RING_PP')) {
      const stages = parseInt(globalTopology.replace('RING_PP', ''));
      for (let i = 0; i < stages - 1; i++) {
        if (nodePositions[i] && nodePositions[i+1]) {
          addComputeLink(nodePositions[i], nodePositions[i + 1], true);
        }
      }
    }
    // RING_TP5: 5-node ring topology (like PP but closed loop)
    else if (globalTopology === 'RING_TP5') {
      for (let i = 0; i < 5; i++) {
        const next = (i + 1) % 5;
        if (nodePositions[i] && nodePositions[next]) {
          addComputeLink(nodePositions[i], nodePositions[next], false);
        }
      }
    }
    // FULL_MESH_TP5: All 5 nodes fully connected (bidirectional)
    else if (globalTopology === 'FULL_MESH_TP5') {
      const activeOnes = nodePositions.filter(n => n.role !== 'idle');
      for (let i = 0; i < activeOnes.length; i++) {
        for (let j = i + 1; j < activeOnes.length; j++) {
          addComputeLink(activeOnes[i], activeOnes[j], true);
        }
      }
    }
    // TP2_RDMA/TP4_RDMA: Full mesh tensor parallelism over TB5 RDMA
    // Kimi-K2: Only TP2 and TP4 are valid (128 heads divisible by 2, 4)
    // Node 0 (muladhara) is always included as API + compute
    else if (globalTopology.startsWith('TP') && globalTopology.includes('RDMA')) {
      const match = globalTopology.match(/TP(\d+)_RDMA/);
      const tpDegree = match ? parseInt(match[1]) : 4;
      const meshNodes = nodePositions.slice(0, tpDegree);  // Nodes 0 to N-1
      // Full mesh: every node connected to every other (bidirectional all-reduce)
      for (let i = 0; i < meshNodes.length; i++) {
        for (let j = i + 1; j < meshNodes.length; j++) {
          addComputeLink(meshNodes[i], meshNodes[j], true);
        }
      }
    }
    // Legacy HYBRID_TP modes (backwards compatibility)
    else if (globalTopology.startsWith('HYBRID_TP')) {
      const match = globalTopology.match(/HYBRID_TP(\d+)/);
      const tpDegree = match ? parseInt(match[1]) : 4;
      const meshNodes = nodePositions.slice(0, tpDegree);
      for (let i = 0; i < meshNodes.length; i++) {
        for (let j = i + 1; j < meshNodes.length; j++) {
          addComputeLink(meshNodes[i], meshNodes[j], true);
        }
      }
    }
    // EP5_SOLO: No TB5 compute links - all 5 nodes are independent
    // Each node talks directly to controller via 10GbE only
    // (Management links already show this)

    return l;
  }, [nodePositions, globalTopology]);

  const managementLinks = useMemo(() => {
    return nodePositions.map(node => ({
      n1: node,
      n2: { x: centerX, y: centerY },
      intensity: 0.15 + (node.cpu_util / 200)
    }));
  }, [nodePositions, centerX, centerY]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN PARTICLE SPAWNING - Real-time based on actual TPS
  // Works in both live mode (real TPS) and simulation mode (simulated TPS)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Clear particles when TPS is zero (no inference happening)
    if (clusterTps <= 0.1) {
      setTokenParticles([]);
      return;
    }

    const spawnInterval = getTokenFlowInterval(clusterTps);
    if (spawnInterval <= 0) return;

    const spawnToken = () => {
      const now = Date.now();
      if (now - lastSpawnTimeRef.current < spawnInterval * 0.8) return;
      lastSpawnTimeRef.current = now;

      const linkCount = computeLinks.length;
      if (linkCount === 0) return;

      const isPP = isPipelineParallel(globalTopology);

      if (isPP) {
        // PP: spawn a token on EVERY link simultaneously — they cascade through
        // the pipeline stages in sync with the ppScan wave animation.
        // Each link gets a staggered start so the token appears to flow stage-by-stage.
        const perLinkDuration = Math.max(150, 600 / (clusterTps / 10));
        setTokenParticles(prev => {
          const newParticles = prev.length > 50 ? prev.slice(-40) : prev;
          const batch = Array.from({ length: linkCount }, (_, i) => ({
            id: particleIdRef.current++,
            linkIndex: i,
            progress: 0,
            startTime: now + i * (perLinkDuration * 0.7), // Stagger: next link starts before previous finishes
            duration: perLinkDuration,
          }));
          return [...newParticles, ...batch];
        });
      } else {
        // TP/EP: tokens flow on random mesh links (all-reduce pattern)
        const linkIndex = Math.floor(Math.random() * linkCount);
        const baseDuration = isTensorParallel(globalTopology) ? 300 : 500;
        const duration = Math.max(100, baseDuration / (clusterTps / 10));
        setTokenParticles(prev => {
          const newParticles = prev.length > 50 ? prev.slice(-40) : prev;
          return [...newParticles, {
            id: particleIdRef.current++,
            linkIndex,
            progress: 0,
            startTime: now,
            duration
          }];
        });
      }
    };

    // Update particles and spawn new ones at ~60fps
    const animationFrame = () => {
      spawnToken();
      setTokenParticles(prev => {
        const now = Date.now();
        return prev
          .map(p => ({
            ...p,
            progress: Math.min(1, Math.max(0, (now - p.startTime) / p.duration))
          }))
          .filter(p => p.progress < 1);
      });
    };

    const frameId = setInterval(animationFrame, 16);
    return () => clearInterval(frameId);
  }, [clusterTps, globalTopology, computeLinks.length]);

  // Determine mesh health status for display
  // Only show degraded status in live mode - sim mode should not show warnings
  // Only show degraded when we have confirmed data (last_update is set by real MQTT messages)
  // Prevents phantom "DEGRADED" banner on fresh page load when defaults are {healthy: false}
  const isMeshDegraded = isLive && meshHealth?.last_update && (!meshHealth.healthy || !meshHealth.rdma);
  const isRecoveryFailed = isLive && meshHealth?.recovery_failed;

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
      {/* ═══════════════════════════════════════════════════════════════════════
          MESH HEALTH BANNER - Prominent alert when cluster is degraded
          Shows at top of visualization when RDMA or mesh health is compromised
          Dismissable with collapsed indicator, includes repair action buttons
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* Collapsed Warning Indicator (when banner is dismissed) */}
      {isMeshDegraded && !isBannerOpen && (
        <button
          onClick={() => setBannerOpen(true)}
          className={`absolute top-4 right-4 z-[100] flex items-center gap-2 px-4 py-2 rounded-xl border shadow-lg transition-all hover:scale-105 ${
            isRecovering
              ? 'bg-amber-950/90 border-amber-500/50'
              : isRecoveryFailed
                ? 'bg-red-950/90 border-red-500/50'
                : 'bg-amber-950/90 border-amber-500/50'
          }`}
        >
          {isRecovering ? (
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          ) : (
            <AlertTriangle className={`w-4 h-4 ${isRecoveryFailed ? 'text-red-400' : 'text-amber-400'}`} />
          )}
          <span className={`text-[10px] font-black uppercase tracking-wider ${
            isRecoveryFailed ? 'text-red-300' : 'text-amber-300'
          }`}>
            {isRecovering ? 'Recovering...' : 'Mesh Degraded'}
          </span>
        </button>
      )}

      {/* Full Mesh Health Banner */}
      {isMeshDegraded && isBannerOpen && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top duration-500">
          <div className={`flex flex-col gap-4 px-6 py-5 rounded-2xl border shadow-2xl min-w-[500px] ${
            isRecovering
              ? 'bg-amber-950/95 border-amber-500/50'
              : isRecoveryFailed
                ? 'bg-red-950/95 border-red-500/50'
                : 'bg-amber-950/95 border-amber-500/50'
          }`}>
            {/* Header Row with Close Button */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Alert Icon */}
                <div className={`flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 ${
                  isRecovering ? 'bg-amber-500/20' : isRecoveryFailed ? 'bg-red-500/20' : 'bg-amber-500/20'
                }`}>
                  {isRecovering ? (
                    <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                  ) : isRecoveryFailed ? (
                    <XCircle className="w-7 h-7 text-red-400" />
                  ) : (
                    <AlertTriangle className="w-7 h-7 text-amber-400" />
                  )}
                </div>

                {/* Status Text */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black uppercase tracking-wider ${
                      isRecovering ? 'text-amber-300' : isRecoveryFailed ? 'text-red-300' : 'text-amber-300'
                    }`}>
                      {isRecovering
                        ? 'Auto-Recovery In Progress'
                        : isRecoveryFailed
                          ? 'Mesh Recovery Failed'
                          : 'Cluster Degraded'}
                    </span>
                    {!meshHealth?.rdma && !isRecovering && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-500/30 text-red-300">
                        RDMA Offline
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-white/60">
                    {isRecovering
                      ? 'Attempting to restore TB5 mesh connectivity... This may take 60-90 seconds.'
                      : !meshHealth?.rdma
                        ? 'TB5 RDMA fabric unavailable • Inference severely degraded'
                        : !meshHealth?.healthy
                          ? 'TB5 mesh connectivity issues detected'
                          : 'Unknown mesh issue'}
                  </span>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setBannerOpen(false)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                title="Dismiss (warning will remain in corner)"
              >
                <X className="w-4 h-4 text-white/40 group-hover:text-white/60" />
              </button>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-6 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${meshHealth?.healthy ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-mono text-white/50 uppercase">Mesh: {meshHealth?.healthy ? 'OK' : 'FAIL'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${meshHealth?.rdma ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-mono text-white/50 uppercase">RDMA: {meshHealth?.rdma ? 'OK' : 'FAIL'}</span>
              </div>
              {recoveryAttempts > 0 && (
                <span className="text-[10px] font-mono text-white/40 uppercase">
                  Attempts: {recoveryAttempts}
                </span>
              )}
            </div>

            {/* Action Buttons */}
            {!isRecovering && (
              <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                {/* Soft Recovery - always available */}
                <button
                  onClick={() => handleMeshRepair('soft')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-105"
                >
                  <RefreshCw className="w-4 h-4" />
                  Quick Fix
                </button>

                {/* Hard Recovery - show after 1 failed attempt or if recovery_failed */}
                {(recoveryAttempts >= 1 || isRecoveryFailed) && (
                  <button
                    onClick={() => handleMeshRepair('hard')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-105"
                  >
                    <Wifi className="w-4 h-4" />
                    Full Reset
                  </button>
                )}

                {/* Nuclear Option - show after 2 failed attempts */}
                {recoveryAttempts >= 2 && (
                  <button
                    onClick={() => {
                      if (confirm('⚠️ This will reboot all compute nodes.\n\nThis is the nuclear option and should only be used if other recovery methods have failed.\n\nProceed?')) {
                        handleMeshRepair('reboot');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-105"
                  >
                    <Power className="w-4 h-4" />
                    Reboot Nodes
                  </button>
                )}

                <div className="flex-1" />
                <span className="text-[10px] font-mono text-white/30">
                  {recoveryAttempts >= 2
                    ? 'All options available'
                    : recoveryAttempts >= 1
                      ? 'More options after next attempt'
                      : 'Try Quick Fix first'}
                </span>
              </div>
            )}

            {/* Recovery Progress */}
            {isRecovering && (
              <div className="flex items-center gap-4 pt-2 border-t border-white/10">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500/60 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
                <span className="text-[10px] font-mono text-amber-400/80">~60-90s remaining</span>
              </div>
            )}
          </div>
        </div>
      )}

      <InferenceCore
        tps={clusterTps}
        estimatedTps={effectiveEstimatedTps}
        color={activeModels[0]?.color || '#a855f7'}
        perplexity={labPerplexity}
        quantization={labQuantization}
        modelName={activeModels[0]?.name}
        nodeCount={activeModels[0]?.nodeIds?.length || 1}
        weightsPerNode={weightsPerNode}
        kvCachePerNode={kvCachePerNode}
        freePerNode={freePerNode}
        analyserRef={analyserRef}
        compact={compact}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          ENHANCED NODE HOVER HUD
          Shows how this node contributes to distributed inference:
          - PP: Which layers it processes (stage in pipeline)
          - TP: Its tensor shard (fraction of each layer)
          - Processing flow visualization
          - Rich metrics (GPU, RDMA, TB5 health)
      ═══════════════════════════════════════════════════════════════════════ */}
      {hoveredNode && (() => {
        const isPP = isPipelineParallel(globalTopology);
        const isTP = isTensorParallel(globalTopology);
        const activeCount = nodes.filter(n => n.role === 'compute' || n.role === 'standalone').length || 1;
        const nIdx = hoveredNode.index;
        const chakraKey = hoveredNode.name.toLowerCase();
        const chakraData = (CHAKRA_COLORS as any)[chakraKey] || { base: '#fff', label: '', element: '' };
        const nodeColor = chakraData.base;
        const layers = modelLayers || 0;

        // PP layer range for this node
        const ppLayersPerNode = layers > 0 ? Math.ceil(layers / activeCount) : 0;
        const ppStart = nIdx * ppLayersPerNode;
        const ppEnd = Math.min(ppStart + ppLayersPerNode, layers);

        // TP shard info
        const tpFraction = activeCount > 0 ? activeCount : 1;

        // Wired memory for model size context
        const wiredGB = hoveredNode.wired_gb || 0;
        const isComputing = hoveredNode.tok_per_sec > 0.1;

        // TB5 info
        const tb5Status = hoveredNode.tb5_status ?? 'unknown';
        const tb5Peers = hoveredNode.tb5_reachable ?? 0;
        const tb5Healthy = tb5Status === 'healthy' || tb5Peers >= 2;

        // Node colors for TP shard bar
        const shardColors = [
          CHAKRA_COLORS.muladhara.base,
          CHAKRA_COLORS.svadhisthana.base,
          CHAKRA_COLORS.manipura.base,
          CHAKRA_COLORS.anahata.base,
          CHAKRA_COLORS.vishuddha.base,
        ];

        return (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none animate-in fade-in zoom-in duration-500 scale-90">
            <div
              className="absolute w-[600px] h-[600px] rounded-full blur-[140px] transition-all duration-700 opacity-25"
              style={{ backgroundColor: nodeColor }}
            />

            <div
              className="relative w-[520px] h-[520px] rounded-full bg-black/95 border-2 flex flex-col items-center justify-center p-12 shadow-[0_0_120px_rgba(0,0,0,1)] transition-colors duration-500 overflow-hidden"
              style={{ borderColor: `${nodeColor}60` }}
            >
              {/* ── Header: Symbol + Name + Role ── */}
              <div className="flex flex-col items-center gap-1.5 mb-4">
                <div className="w-16 h-16 flex items-center justify-center" style={{ color: nodeColor }}>
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_currentColor]">
                    {CHAKRA_SYMBOLS[chakraKey]}
                  </svg>
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none break-all">{hoveredNode.name}</h2>
                <p className="text-[10px] font-mono font-black text-white/30 uppercase tracking-[0.3em]">
                  {isPP
                    ? `STAGE ${nIdx + 1} OF ${activeCount} • PIPELINE`
                    : isTP
                      ? `RANK ${nIdx} OF ${activeCount} • TENSOR SHARD`
                      : `NODE ${nIdx + 1} • ${hoveredNode.role.toUpperCase()}`
                  }
                </p>
              </div>

              {/* ── Layer / Shard Visualization ── */}
              {layers > 0 && (isPP || isTP) && (
                <div className="flex flex-col items-center gap-2 mb-4 w-full max-w-[320px]">
                  {isPP ? (
                    /* PP: Wide bar showing this node's layer range */
                    <div className="w-full">
                      <div className="relative w-full h-7 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                        {/* Fill bar — proportional to total layers */}
                        <div
                          className="absolute inset-y-0 left-0 rounded-lg"
                          style={{
                            width: `${((ppEnd - ppStart) / layers) * 100}%`,
                            marginLeft: `${(ppStart / layers) * 100}%`,
                            backgroundColor: nodeColor,
                            opacity: isComputing ? 0.6 : 0.25,
                          }}
                        />
                        {/* Activity sweep */}
                        {isComputing && (
                          <div className="absolute inset-y-0 w-8 bg-white/15 rounded-lg animate-[shimmer_2s_ease-in-out_infinite]"
                            style={{
                              left: `${(ppStart / layers) * 100}%`,
                              animation: `shimmer 2s ease-in-out infinite`,
                            }}
                          />
                        )}
                        {/* Layer range text */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[11px] font-black font-mono text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                            L{ppStart}–{ppEnd - 1}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between mt-1.5 px-1">
                        <span className="text-[10px] font-mono font-black text-white/25 uppercase tracking-wider">
                          {ppEnd - ppStart} of {layers} layers
                        </span>
                        <span className="text-[10px] font-mono font-black uppercase tracking-wider" style={{ color: nodeColor, opacity: 0.6 }}>
                          {nIdx === 0 ? 'Input Stage' : nIdx === activeCount - 1 ? 'Output Stage' : `Stage ${nIdx + 1}`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* TP: Shard bar — N segments, this node highlighted */
                    <div className="w-full">
                      <div className="relative w-full h-7 bg-white/5 rounded-lg overflow-hidden border border-white/10 flex gap-0.5 p-0.5">
                        {Array.from({ length: Math.min(activeCount, 5) }).map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-md transition-all"
                            style={{
                              backgroundColor: shardColors[i] || '#666',
                              opacity: i === nIdx ? (isComputing ? 0.7 : 0.35) : 0.06,
                              border: i === nIdx ? `1.5px solid ${shardColors[i]}80` : '1px solid rgba(255,255,255,0.03)',
                            }}
                          />
                        ))}
                        {/* Centered label */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[11px] font-black font-mono text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                            {layers}L × 1/{tpFraction}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between mt-1.5 px-1">
                        <span className="text-[10px] font-mono font-black text-white/25 uppercase tracking-wider">
                          All layers, tensor shard
                        </span>
                        <span className="text-[10px] font-mono font-black uppercase tracking-wider" style={{ color: nodeColor, opacity: 0.6 }}>
                          RDMA All-Reduce
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TPS Hero ── */}
              <div className="flex flex-col items-center gap-0.5 mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black font-mono text-emerald-400 tabular-nums drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    {hoveredNode.tok_per_sec.toFixed(1)}
                  </span>
                  <span className="text-xs font-black text-white/20 uppercase tracking-widest font-mono">T/S</span>
                </div>
              </div>

              {/* ── Metrics Grid ── */}
              <div className="grid grid-cols-4 gap-4 w-full max-w-[360px] border-t border-white/5 pt-4">
                <div className="flex flex-col items-center gap-0.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-400 opacity-50" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">VRAM</span>
                  <span className="text-base font-mono font-black text-white tabular-nums">
                    {((hoveredNode.ram_used / hoveredNode.ram_total) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400 opacity-50" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">KV$</span>
                  <span className="text-base font-mono font-black text-cyan-400 tabular-nums">
                    {hoveredNode.kv_cache_pct.toFixed(0)}%
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Thermometer className="w-3.5 h-3.5 text-red-400 opacity-50" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">TEMP</span>
                  <span className="text-base font-mono font-black text-white tabular-nums">
                    {hoveredNode.temp_c.toFixed(0)}°
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400 opacity-50" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">GPU</span>
                  <span className="text-base font-mono font-black text-purple-400 tabular-nums">
                    {hoveredNode.gpu_util.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* ── Secondary Metrics (Wired Memory + RDMA) ── */}
              <div className="flex items-center gap-4 mt-3 px-4">
                {wiredGB > 0 && (
                  <span className="text-[10px] font-mono font-black text-white/25 uppercase tracking-wider">
                    Model: {wiredGB.toFixed(0)}GB wired
                  </span>
                )}
                {hoveredNode.rdma_latency_us > 0 && (
                  <span className="text-[10px] font-mono font-black text-cyan-400/40 uppercase tracking-wider">
                    RDMA: {hoveredNode.rdma_latency_us.toFixed(0)}μs
                  </span>
                )}
              </div>

              {/* ── TB5 Status Bar ── */}
              {hoveredNode.tb5_links > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${tb5Healthy ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                  <span className={`text-[10px] font-mono font-black uppercase tracking-wider ${tb5Healthy ? 'text-emerald-400/50' : 'text-red-400/50'}`}>
                    TB5: {tb5Peers}/{hoveredNode.tb5_links} peers
                    {hoveredNode.tb5_latency_ms > 0 && ` • ${hoveredNode.tb5_latency_ms.toFixed(1)}ms`}
                  </span>
                </div>
              )}

              <div className="absolute bottom-10 text-[10px] font-mono text-white/10 uppercase tracking-[0.6em] font-black">
                CLICK FOR WAVEFORM
              </div>
            </div>
          </div>
        );
      })()}

      {/* Centered Bottom Copyright Between Anahata and Manipura */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto opacity-30 hover:opacity-100 transition-opacity">
        <a href="http://guruswami.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono font-black text-white tracking-[0.5em] uppercase text-center block whitespace-nowrap">
          © 2026 guruswami.com
        </a>
      </div>

      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible relative z-10">
        <defs>
          <filter id="tb5Glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Dissonance Filter — digital distortion for Q2 or high KV pressure */}
          <filter id="dissonance-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" seed="42" result="turbulence">
              <animate attributeName="baseFrequency" values="0.8;0.95;0.8" dur="0.3s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="8" xChannelSelector="R" yChannelSelector="G" result="displacement">
              <animate attributeName="scale" values="8;12;8" dur="0.5s" repeatCount="indefinite" />
            </feDisplacementMap>
            <feColorMatrix in="displacement" type="saturate" values="1.5" result="saturated" />
            <feBlend in="SourceGraphic" in2="saturated" mode="screen" />
          </filter>

          {/* Circular clip to trim glass sphere to node boundary */}
          <clipPath id="sphereClip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
        </defs>

        {/*
          ═══════════════════════════════════════════════════════════════════════
          MANAGEMENT FABRIC (10GbE ETHERNET)
          ═══════════════════════════════════════════════════════════════════════

          The management plane connects the Cluster Controller (sahasrara) to all
          compute nodes via 10 Gigabit Ethernet. This network handles:

          OUTBOUND (Controller → Nodes):
          • Tokenized prompts sent to the first pipeline stage (PP) or all nodes (TP)
          • Orchestration commands (model loading, health checks)
          • Configuration updates

          INBOUND (Nodes → Controller):
          • Generated tokens streamed back from last pipeline stage (PP) or any node (TP)
          • Metrics and telemetry data
          • Health status updates

          The animation shows:
          • ORANGE particles going OUT = prompt tokens being dispatched
          • WHITE particles coming IN = generated tokens returning

          This separation keeps heavy TB5 RDMA traffic (inter-node tensor sync)
          isolated from user-facing API traffic.
          ═══════════════════════════════════════════════════════════════════════
        */}
        <g id="management-fabric">
          {managementLinks.map((link, i) => {
            const { n1, n2, intensity } = link;
            const node = n1 as NodeMetrics;
            const isActiveNode = node.role === 'compute' || node.role === 'standalone';
            const isInferring = node.tok_per_sec > 0.1;

            // In the Chakra architecture, muladhara (Node 0) is ALWAYS the API endpoint
            // for multi-node distributed inference. This is because:
            // 1. muladhara has the fastest NVMe for model loading
            // 2. It's the natural "rank 0" for mlx.launch coordination
            // 3. Single entry point simplifies monitoring and debugging
            //
            // Token flow by topology:
            // - PP: Prompts enter at Node 0, activations flow 0→1→2→3→4, output returns via Ethernet
            // - TP: All nodes process simultaneously, Node 0 coordinates all-reduce
            // - Solo/DP: Each node is independent (multiple API endpoints possible)
            //
            // For multi-model deployments, TensorZero on sahasrara routes to the appropriate
            // backend based on function name (reasoning, coding, fast, judge).
            const getApiNodeIndex = (): number => {
              // EP/SINGLE/DP modes: Each active node runs independently
              if (globalTopology === 'SINGLE' || globalTopology.startsWith('EP') || globalTopology === 'DP5_REPLICATED') return -1;
              // All distributed modes: muladhara (Node 0) is the API endpoint
              return 0;
            };

            const apiNodeIndex = getApiNodeIndex();
            const isApiNode = apiNodeIndex === -1 ? true : (node.index === apiNodeIndex);
            const isSoloMode = globalTopology === 'SINGLE' || globalTopology.startsWith('EP') || globalTopology === 'DP5_REPLICATED';

            // PP mode: last stage returns output tokens via its management link
            const isPP = globalTopology.startsWith('RING_PP');
            const ppStages = isPP ? parseInt(globalTopology.replace('RING_PP', '')) : 0;
            const isLastPPStage = isPP && i === ppStages - 1;
            const isFirstPPStage = isPP && i === 0;

            // Management link visibility:
            // - Node 0 / EP active: Strong (carries token traffic)
            // - Other active nodes: Visible (connected but no token traffic)
            // - Idle nodes: Very faint
            const linkOpacity = (isApiNode || (isSoloMode && isActiveNode)) ? 0.3 : isActiveNode ? 0.15 : 0.05;
            const linkWidth = (isApiNode || (isSoloMode && isActiveNode)) ? 2 : isActiveNode ? 1.5 : 1;

            // Particle speeds:
            // - Outbound (prompts): Steady flow to API node
            // - Inbound (tokens): Fast, proportional to cluster TPS
            const outboundSpeed = 3.0;
            const inboundSpeed = isInferring
              ? Math.max(0.4, 2.0 - (clusterTps / 20)) // Based on cluster TPS
              : 5.0;

            // Token traffic on management links:
            // - TP/PP: Only node 0 (prompts in, tokens out — all via TB5 internally)
            // - EP/SINGLE: Each active node (independent — no TB5 involved)
            const showTokenTraffic = isSoloMode ? isInferring : (isApiNode && clusterTps > 0);
            const showPromptFlow = isSoloMode ? isActiveNode : (isApiNode && clusterTps > 0);

            return (
              <g key={`mgmt-${i}`}>
                {/* ═══════════════════════════════════════════════════════════════════
                    10GbE ETHERNET LINK - Blue dashed line (like physical ethernet cable)
                    Thinner than TB5 links, dashed pattern for visual distinction
                ═══════════════════════════════════════════════════════════════════ */}
                <line
                  x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y}
                  stroke={ETHERNET_COLOR}
                  strokeWidth={linkWidth}
                  strokeOpacity={linkOpacity}
                  strokeDasharray="4,4"
                  strokeLinecap="round"
                />

                {/* ═══════════════════════════════════════════════════════════════════
                    MANAGEMENT LINK PARTICLES
                    Token flow is via TB5 — management links show:
                    - Node 0 (all modes): prompts in (amber), tokens out (white)
                    - EP/SINGLE active nodes: both directions (independent)
                    - Other active nodes: small blue heartbeat dots
                ═══════════════════════════════════════════════════════════════════ */}

                {/* PROMPTS IN: amber dots from center → node (prompts being dispatched) */}
                {/* Node 0 for TP/PP, each active node for EP/SINGLE */}
                {showPromptFlow && (
                  <circle r={isSoloMode ? 3.5 : 4} fill="#f59e0b" fillOpacity={0.8}>
                    <animateMotion
                      dur={`${outboundSpeed}s`}
                      repeatCount="indefinite"
                      path={`M ${n2.x} ${n2.y} L ${n1.x} ${n1.y}`}
                    />
                  </circle>
                )}

                {/* TOKENS OUT: white dots from node → center (generated tokens returning) */}
                {/* Node 0 for TP/PP (aggregated), each active node for EP/SINGLE */}
                {showTokenTraffic && (
                  <>
                    <circle r={isSoloMode ? 4 : 5} fill="white" fillOpacity={0.9}>
                      <animateMotion
                        dur={`${inboundSpeed}s`}
                        repeatCount="indefinite"
                        path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`}
                      />
                    </circle>
                    <circle r={isSoloMode ? 3 : 4} fill="white" fillOpacity={0.5}>
                      <animateMotion
                        dur={`${inboundSpeed}s`}
                        repeatCount="indefinite"
                        begin={`${inboundSpeed / 2}s`}
                        path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`}
                      />
                    </circle>
                  </>
                )}

                {/* HEARTBEAT: small blue dots on other active nodes (health/metrics) */}
                {isActiveNode && !showTokenTraffic && !showPromptFlow && (
                  <circle r={1.5} fill={ETHERNET_COLOR} fillOpacity={0.4}>
                    <animateMotion
                      dur="5s"
                      repeatCount="indefinite"
                      path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}

          {/* PP output return: handled via management links (last stage → center) */}

          {/*
            ═══════════════════════════════════════════════════════════════════
            CLUSTER CONTROLLER (sahasrara)
            ═══════════════════════════════════════════════════════════════════

            The central hub represents the M4 Pro Mac Mini running:
            • TensorZero Gateway (API endpoint, A/B testing, routing)
            • Open WebUI (user interface)
            • Metrics aggregation (VictoriaMetrics, Grafana)

            Visual indicators:
            • Outer ring: Controller online status
            • Middle pulse: Active request processing
            • Inner core: Heartbeat (always pulsing when online)

            The controller does NOT hold model weights - it orchestrates the
            compute fabric and handles tokenization/detokenization.
            ═══════════════════════════════════════════════════════════════════
          */}
          <g transform={`translate(${centerX}, ${centerY})`}>
            {/* Outer status ring - blue ethernet color */}
            <circle r={35} fill="#050505" stroke={ETHERNET_COLOR} strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="4,2" />

            {/* Request processing pulse - expands when cluster is active */}
            <circle r={15} fill={ETHERNET_COLOR} fillOpacity={0.15}>
              <animate
                attributeName="r"
                values={clusterTps > 0 ? "12;22;12" : "12;16;12"}
                dur={clusterTps > 0 ? "1.5s" : "5s"}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values={clusterTps > 0 ? "0.15;0.35;0.15" : "0.15;0.2;0.15"}
                dur={clusterTps > 0 ? "1.5s" : "5s"}
                repeatCount="indefinite"
              />
            </circle>

            {/* Active inference indicator - yellow token color when generating */}
            {clusterTps > 0 && (
              <circle r={8} fill={TOKEN_COLOR} fillOpacity={0.4}>
                <animate attributeName="r" values="6;10;6" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Core heartbeat */}
            <circle r={5} fill={ETHERNET_COLOR} fillOpacity={clusterTps > 0 ? 0.8 : 0.5} />

            {/* Center labels removed — guru avatar occupies this space */}
          </g>
        </g>

        <g id="compute-fabric" style={{ transition: 'opacity 0.5s ease' }}>
          {computeLinks.map((link, i) => {
            const { n1, n2, intensity, bidirectional } = link;

            // Get animation parameters from profile
            const linkParams = getLinkAnimationParams(
              animationProfile,
              n1.index || 0,
              n2.index || 0,
              timeOffset
            );

            // Don't render if link should be hidden (e.g., swarm mode)
            if (!linkParams.showLink) return null;

            // Combine base intensity with profile-driven intensity
            const effectiveIntensity = isLive
              ? intensity
              : linkParams.intensity * (0.7 + intensity * 0.3);

            // Profile-driven particle speed
            const particleSpeed = isLive
              ? (isTensorParallel(globalTopology) ? 0.25 : isPipelineParallel(globalTopology) ? 0.6 : 0.4)
              : linkParams.particleSpeed;

            // ═══════════════════════════════════════════════════════════════════
            // FABRIC TENSION (#47) — link stress from RDMA throughput
            // Tension = combinedGbps / 80Gbps (TB5 peak). >90% = vibrate
            // ═══════════════════════════════════════════════════════════════════
            const TB5_PEAK_GBPS = 80;
            const fabricTension = Math.min(1, intensity * 15 / TB5_PEAK_GBPS * 100);
            const isHighTension = fabricTension > 0.9;
            const tensionWidth = isHighTension ? 2 : 0; // Extra stroke for stressed links

            // Link visual properties using profile colors
            const linkColor = isLive ? RDMA_COLOR : animationProfile.linkColor; // Amber during prefill
            const baseWidth = 6 + effectiveIntensity * 4 + tensionWidth;
            const glowWidth = baseWidth * 4;
            const baseOpacity = 0.3 + effectiveIntensity * 0.5;

            // Particle sizing from profile
            const forwardParticleSize = animationProfile.particleSize;
            const reverseParticleSize = animationProfile.particleSize - 1;
            const particleColor = isLive ? 'white' : animationProfile.particleColor;

            return (
              <g key={`comp-${i}`} filter={shouldApplyDissonance ? 'url(#dissonance-filter)' : undefined}>
                {/* ═══════════════════════════════════════════════════════════════════
                    THUNDERBOLT 5 LINK - Solid blue with white core (lightning effect)
                    Thicker than ethernet, solid line, high-bandwidth RDMA mesh
                ═══════════════════════════════════════════════════════════════════ */}

                {/* Link glow effect — expands when fabric tension is high */}
                <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={linkColor} strokeWidth={glowWidth} strokeOpacity={baseOpacity * (isHighTension ? 0.4 : 0.2)} filter="url(#tb5Glow)" />
                {/* Main link line */}
                <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={linkColor} strokeWidth={baseWidth} strokeOpacity={baseOpacity} strokeLinecap="round">
                  {/* Fabric tension vibration — link "hums" when near saturation */}
                  {isHighTension && (
                    <animate attributeName="stroke-width" values={`${baseWidth};${baseWidth + 3};${baseWidth}`} dur="0.15s" repeatCount="indefinite" />
                  )}
                </line>
                {/* Highlight core - white center like lightning */}
                <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={isHighTension ? '#fbbf24' : 'white'} strokeWidth={isHighTension ? 3 : 2} strokeOpacity={0.95} strokeLinecap="round">
                  {isHighTension && (
                    <animate attributeName="stroke-opacity" values="0.95;0.6;0.95" dur="0.2s" repeatCount="indefinite" />
                  )}
                </line>

                {/* ═══════════════════════════════════════════════════════════════════
                    TOKEN PARTICLES - Light yellow semi-transparent blobs
                    Larger than ethernet tokens to match thicker TB5 links
                ═══════════════════════════════════════════════════════════════════ */}

                {/* Forward direction token - primary flow */}
                {linkParams.showParticles && (
                  <circle r={forwardParticleSize + 1} fill={TOKEN_COLOR} fillOpacity={0.75} filter="blur(1px)">
                    <animateMotion dur={`${particleSpeed}s`} repeatCount="indefinite" path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`} />
                  </circle>
                )}

                {/* Reverse direction token (when bidirectional all-reduce) */}
                {linkParams.showParticles && (bidirectional || animationProfile.linkBidirectional) && (
                  <circle r={reverseParticleSize + 1} fill={TOKEN_COLOR} fillOpacity={0.6} filter="blur(1px)">
                    <animateMotion dur={`${particleSpeed * 0.9}s`} repeatCount="indefinite" path={`M ${n2.x} ${n2.y} L ${n1.x} ${n1.y}`} />
                  </circle>
                )}

                {/* Secondary staggered tokens for high-bandwidth visualization */}
                {linkParams.showParticles && (
                  <>
                    <circle r={forwardParticleSize - 1} fill={TOKEN_COLOR} fillOpacity={0.4}>
                      <animateMotion dur={`${particleSpeed}s`} repeatCount="indefinite" begin={`${particleSpeed / 3}s`} path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`} />
                    </circle>
                    <circle r={forwardParticleSize - 1} fill={TOKEN_COLOR} fillOpacity={0.4}>
                      <animateMotion dur={`${particleSpeed}s`} repeatCount="indefinite" begin={`${particleSpeed * 2 / 3}s`} path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`} />
                    </circle>
                  </>
                )}

                {/* MoE Router: Extra spark particles for chaotic effect */}
                {animationProfile.scenario === 'moe_router' && linkParams.showParticles && (
                  <>
                    <circle r={3} fill={animationProfile.linkSecondaryColor} filter="blur(1px)" opacity={0.7}>
                      <animateMotion dur={`${particleSpeed * 0.7}s`} repeatCount="indefinite" begin={`${particleSpeed * 0.3}s`} path={`M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`} />
                    </circle>
                    <circle r={2} fill={TOKEN_COLOR} filter="blur(1px)" opacity={0.5}>
                      <animateMotion dur={`${particleSpeed * 1.1}s`} repeatCount="indefinite" begin={`${particleSpeed * 0.6}s`} path={`M ${n2.x} ${n2.y} L ${n1.x} ${n1.y}`} />
                    </circle>
                  </>
                )}
              </g>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════════
              REAL-TIME TOKEN PARTICLES - Spawn at actual TPS rate
              Each particle represents one actual token being generated
              Works in both live mode (real TPS) and sim mode (simulated TPS)
          ═══════════════════════════════════════════════════════════════════ */}
          {tokenParticles.map(particle => {
            const link = computeLinks[particle.linkIndex];
            if (!link) return null;

            const { n1, n2 } = link;
            // Interpolate position along link
            const x = n1.x + (n2.x - n1.x) * particle.progress;
            const y = n1.y + (n2.y - n1.y) * particle.progress;
            // Fade out as particle approaches destination
            const opacity = 0.9 - particle.progress * 0.5;

            return (
              <circle
                key={particle.id}
                cx={x}
                cy={y}
                r={6 + (1 - particle.progress) * 2}
                fill={TOKEN_COLOR}
                fillOpacity={opacity}
                filter="blur(1px)"
              />
            );
          })}
        </g>

        {/* ═══ OUTER GLOW LAYER — rendered behind all nodes so glow extends beyond spheres ═══ */}
        <g id="node-outer-glows">
          {nodePositions.map((node, nodeIndex) => {
            const chakraData = (CHAKRA_COLORS as any)[node.name.toLowerCase()] || { base: '#fff' };
            const chakraColor = chakraData.base;
            const isOffline = (!node.power_w || node.power_w < 1);
            const hasModel = node.role === 'compute' || node.role === 'standalone';
            const isComputing = node.tok_per_sec > 0.1;

            // During error: nodes in the active topology get red glow
            // (even though crash sets their role to idle)
            const activeIndices = getActiveNodeIndices(globalTopology);
            const isInTopology = activeIndices.includes(nodeIndex);
            const showErrorGlow = isError && isInTopology;

            // Compute inner glow params so outer glow stays in sync
            const ppIdx = ppActiveIndices.indexOf(nodeIndex);
            const inPipeline = ppIdx >= 0;
            let innerGlowOpacity = 0;
            if (ppAnimDuration > 0 && inPipeline) {
              const stageCount = ppActiveIndices.length;
              const basePhase = ((timeOffset / (ppAnimDuration * 1000)) % 1);
              const wavePhase = ((basePhase - ppIdx / stageCount) % 1 + 1) % 1;
              innerGlowOpacity = wavePhase < 0.16
                ? 0.25 + 0.55 * Math.sin((wavePhase / 0.16) * Math.PI)
                : 0.12;
            } else if (isComputing || hasModel) {
              const params = getNodeAnimationParams(animationProfile, nodeIndex, timeOffset, nodes.length, effectiveEstimatedTps);
              innerGlowOpacity = params.glowOpacity;
            }

            const outerGlowColor = showErrorGlow ? '#ef4444' : chakraColor;
            const outerGlowOpacity = showErrorGlow
              ? 0.45 + 0.15 * Math.sin((timeOffset / 800) * Math.PI)
              : isComputing
                ? 0.1 + innerGlowOpacity * 0.4  // Synced with inner glow
                : hasModel
                  ? 0.06
                  : 0;

            if (outerGlowOpacity <= 0.01 || isOffline) return null;
            const outerR = showErrorGlow ? 88 + 55 : 88 + 45;  // 88 = node sphere radius

            return (
              <g key={`glow-${node.id}`}>
                <defs>
                  <radialGradient id={`outerGlow-${node.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={outerGlowColor} stopOpacity={outerGlowOpacity * 2} />
                    <stop offset="30%" stopColor={outerGlowColor} stopOpacity={outerGlowOpacity * 1.2} />
                    <stop offset="60%" stopColor={outerGlowColor} stopOpacity={outerGlowOpacity * 0.4} />
                    <stop offset="100%" stopColor={outerGlowColor} stopOpacity={0} />
                  </radialGradient>
                </defs>
                <circle cx={node.x} cy={node.y} r={outerR} fill={`url(#outerGlow-${node.id})`} />
              </g>
            );
          })}
        </g>

        {nodePositions.map((node, nodeIndex) => {
          const chakraData = (CHAKRA_COLORS as any)[node.name.toLowerCase()] || { base: '#fff' };
          const chakraColor = chakraData.base;
          const isHovered = hoveredNode?.id === node.id;

          // ═══════════════════════════════════════════════════════════════════
          // NODE VISUAL STATE - Based on actual metrics (live mode)
          // ═══════════════════════════════════════════════════════════════════
          // OFFLINE: power_w < 1 → darkened, no glow (threshold lowered for idle M4 Pro)
          // IDLE: online, no model → normal brightness, minimal ring
          // STANDBY: model loaded (wired_gb > 50), gpu_util < 5% → colored ring
          // COMPUTE: gpu_util > 5% → pulsing ring, spinning SVG, bright glow
          const visualState: NodeVisualState = isLive
            ? getNodeVisualState(node)
            : (node.role === 'idle' ? 'idle' : node.tok_per_sec > 0.1 ? 'compute' : 'standby');

          const isOffline = visualState === 'offline';
          const isIdle = visualState === 'idle';
          const isStandby = visualState === 'standby';
          const isComputing = visualState === 'compute';
          const hasModelLoaded = isStandby || isComputing;

          // Ring expansion based on wired memory (in live mode)
          const ringScale = isLive && node.wired_gb
            ? getRingExpansionScale(node)
            : 1.0;
          const baseRingRadius = 88;
          const ringRadius = baseRingRadius * ringScale;

          // Get animation parameters from profile (in sim mode)
          // PP mode: sync node glow with ClusterTopologyCard ppScan wave
          // Only active PP nodes get the wave — inactive nodes stay dim
          const ppStageIndex = ppActiveIndices.indexOf(nodeIndex);
          const isInPipeline = ppStageIndex >= 0;
          const nodeAnimParams = !isLive
            ? (ppAnimDuration > 0
              ? (() => {
                  if (!isInPipeline) {
                    // Node not in pipeline — no glow animation
                    return { glowOpacity: 0, pulsePhase: 0, glowRadius: 95 };
                  }
                  const stageCount = ppActiveIndices.length;
                  const basePhase = ((timeOffset / (ppAnimDuration * 1000)) % 1);
                  // Use ppStageIndex (pipeline position) not nodeIndex for sequential wave
                  // Subtract so wave propagates 0→1→2→...→N (node 0 peaks first)
                  const wavePhase = ((basePhase - ppStageIndex / stageCount) % 1 + 1) % 1;
                  // Match ppScan keyframe: brightness peaks at 0-16% of cycle
                  // PP wave: visible glow within sphere, peaks at 0-16% of cycle
                  const brightness = wavePhase < 0.16
                    ? 0.25 + 0.55 * Math.sin((wavePhase / 0.16) * Math.PI)
                    : 0.12;
                  return {
                    glowOpacity: brightness,
                    pulsePhase: wavePhase,
                    glowRadius: 95,
                  };
                })()
              : getNodeAnimationParams(animationProfile, nodeIndex, timeOffset, nodes.length, effectiveEstimatedTps))
            : null;

          // Animation speed based on activity (or profile in sim mode)
          // COMPUTE: Fast pulsing proportional to TPS
          // PP mode: match ppScan cycle duration for synced ring pulse
          const pulseDuration = !isLive && nodeAnimParams
            ? (ppAnimDuration > 0 ? `${ppAnimDuration}s` : `${animationProfile.nodePulseSpeed}s`)
            : isComputing
              ? `${Math.max(0.3, 1.5 / (node.tok_per_sec + 0.1))}s`
              : hasModelLoaded ? '4s' : '8s';

          // Ring color: colored if model loaded, node's chakra color (dimmed) if idle, dark if offline
          const ringColor = isOffline
            ? 'rgba(255,255,255,0.03)'
            : hasModelLoaded ? chakraColor : chakraColor;  // Use node color even when idle
          const ringStrokeWidth = isComputing ? 6 : (hasModelLoaded ? 4 : (isIntroHighlight ? 3 : 2));
          let ringOpacity = isOffline ? 0.1 : isComputing ? 0.9 : (hasModelLoaded ? 0.5 : 0.3);

          // Glow intensity: modulated by theme state (REFERENCE=bright, DISSONANCE=dim)
          const nodeTheme = theme.nodeThemes[node.name.toLowerCase()];
          const themeGlowMod = nodeTheme?.glowIntensity ?? 1;
          let glowOpacity = isOffline ? 0 : (!isLive && nodeAnimParams
            ? nodeAnimParams.glowOpacity * themeGlowMod
            : isComputing ? 0.5 * themeGlowMod : (hasModelLoaded ? 0.15 * themeGlowMod : 0));
          let glowRadius = !isLive && nodeAnimParams
            ? nodeAnimParams.glowRadius
            : isComputing ? 95 : 90;

          // Onboarding intro highlight: nodes light up one-by-one then pulse together
          // "five Apple computers" — each node flashes in sequence so user sees them
          if (isIntroHighlight && introHighlightStart.current > 0) {
            const elapsed = timeOffset - introHighlightStart.current;
            const nodeRevealTime = nodeIndex * 600; // 0, 600, 1200, 1800, 2400ms
            const timeSinceReveal = elapsed - nodeRevealTime;
            if (timeSinceReveal < 0) {
              // Not revealed yet — dim
              glowOpacity = 0;
              ringOpacity = 0.15;
            } else if (timeSinceReveal < 800) {
              // Reveal: gradient glow within sphere
              const t = timeSinceReveal / 800;
              glowOpacity = 0.6 * Math.sin(t * Math.PI);
              glowRadius = 95;
              ringOpacity = 0.5 + 0.4 * Math.sin(t * Math.PI);
            } else {
              // Steady breathing glow — all revealed nodes breathe together
              const breathe = 0.2 + 0.15 * Math.sin((elapsed - nodeRevealTime) / 1200 * Math.PI);
              glowOpacity = breathe;
              glowRadius = 95;
              ringOpacity = 0.5;
            }
          }

          // TB5 status indicator
          // Note: tb5_status might be null/undefined from MQTT - treat as unknown
          const tb5Status = node.tb5_status ?? 'unknown';
          // Consider healthy if status is 'healthy' OR at least 2 TB5 peers reachable
          const tb5Healthy = tb5Status === 'healthy' || (node.tb5_reachable ?? 0) >= 2;

          return (
            <g
              key={node.id}
              className={isIntroHighlight ? '' : 'cursor-pointer'}
              onClick={isIntroHighlight ? undefined : () => onNodeClick(node)}
              onMouseEnter={isIntroHighlight ? undefined : () => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{
                // OFFLINE dimming: reduce overall opacity
                opacity: isOffline ? 0.35 : 1,
                transition: 'opacity 0.5s ease'
              }}
            >
              {/* Glass sphere background — dark core */}
              <circle cx={node.x} cy={node.y} r={ringRadius} fill={isOffline ? '#030303' : '#080808'} />
              {/* Rim light — edge pick up from the outer glow, suggests glass refraction */}
              {(() => {
                const activeIndices = getActiveNodeIndices(globalTopology);
                const showErrorRim = isError && activeIndices.includes(nodeIndex);
                return (
                  <circle
                    cx={node.x} cy={node.y} r={ringRadius}
                    fill="none"
                    stroke={showErrorRim ? '#ef4444' : chakraColor}
                    strokeOpacity={isOffline ? 0.03 : (showErrorRim ? 0.35 : (hasModelLoaded ? 0.1 + glowOpacity * 0.25 : 0.05))}
                    strokeWidth={showErrorRim ? 2 : 1.5}
                  />
                );
              })()}

              {/* Inner glow — radial gradient INSIDE the glass sphere */}
              {/* Rendered after background, before glass overlay = light shining from within */}
              {hasModelLoaded && !isOffline && glowOpacity > 0.01 && (
                <>
                  <defs>
                    <radialGradient id={`nodeGlow-${node.id}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={chakraColor} stopOpacity={Math.min(1, glowOpacity * 2.5)} />
                      <stop offset="40%" stopColor={chakraColor} stopOpacity={glowOpacity * 1.2} />
                      <stop offset="80%" stopColor={chakraColor} stopOpacity={glowOpacity * 0.3} />
                      <stop offset="100%" stopColor={chakraColor} stopOpacity={0} />
                    </radialGradient>
                  </defs>
                  <circle
                    cx={node.x} cy={node.y}
                    r={ringRadius - 4}
                    fill={`url(#nodeGlow-${node.id})`}
                  />
                </>
              )}

              {/* Chakra symbol as background - brightness, color, and spin based on TPS */}
              {(() => {
                // Calculate opacity based on state and TPS
                // IDLE: 0.15 (dim), STANDBY: 0.35 (visible), COMPUTE: 0.4-0.8 based on TPS
                const baseOpacity = isOffline ? 0.03
                  : isIdle ? 0.15
                  : isStandby ? 0.35
                  : 0.4 + Math.min(0.4, node.tok_per_sec / 40); // COMPUTE: 0.4-0.8

                // Calculate spin speed based on TPS using utility function
                const spinDuration = isOffline || isIdle ? 0
                  : isStandby ? 20
                  : getTpsSpinDuration(node.tok_per_sec);

                // Symbol always uses the node's own chakra color
                // Brightness increases with TPS — dim when idle, vivid when computing
                const tpsColor = isOffline ? '#333' : chakraColor;

                // Glow effect on the symbol at high TPS
                const glowIntensity = Math.min(1, clusterTps / 80);
                const glowColor = chakraData.glow || `${chakraColor}4d`;

                return (
                  <g
                    transform={`translate(${node.x - 70}, ${node.y - 70})`}
                    opacity={baseOpacity}
                    style={{ transition: 'opacity 0.3s ease, filter 0.3s ease' }}
                    filter={clusterTps > 10 ? `drop-shadow(0 0 ${8 + glowIntensity * 12}px ${glowColor})` : undefined}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      width="140"
                      height="140"
                      style={{
                        color: tpsColor,
                        transformOrigin: '70px 70px',
                        animation: spinDuration > 0 ? `spin ${spinDuration}s linear infinite` : 'none',
                        transition: 'color 0.5s ease'
                      }}
                    >
                      {CHAKRA_SYMBOLS[node.name.toLowerCase()]}
                    </svg>
                  </g>
                );
              })()}

              {/* Glass sphere overlay — fills the node circle, creates glass illusion */}
              {!isOffline && (
                <image
                  href={GLASS_SPHERE_SRC}
                  x={node.x - ringRadius}
                  y={node.y - ringRadius}
                  width={ringRadius * 2}
                  height={ringRadius * 2}
                  opacity={0.45}
                  clipPath="url(#sphereClip)"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* TB5 status indicator (top-right corner) */}
              {isLive && node.tb5_links > 0 && (
                <g transform={`translate(${node.x + 60}, ${node.y - 60})`}>
                  <circle r={10} fill={tb5Healthy ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={tb5Healthy ? '#22c55e' : '#ef4444'}
                    fontSize="10"
                    fontWeight="900"
                  >
                    {tb5Healthy ? '⚡' : '!'}
                  </text>
                </g>
              )}

              {/* Node name - centered over chakra symbol */}
              {/* DISSONANCE: chromatic aberration via offset red/cyan text layers */}
              {theme.chromaticAberration && !isOffline && (
                <>
                  <text x={node.x + 2} y={node.y - 8} textAnchor="middle" dominantBaseline="middle" fill="#ff00c1" fillOpacity={0.4} fontSize={node.name.length > 10 ? 13 : 15} fontWeight="900" fontFamily="Orbitron, sans-serif" letterSpacing="0.15em" className="uppercase" style={{ pointerEvents: 'none' }}>{node.name}</text>
                  <text x={node.x - 2} y={node.y - 8} textAnchor="middle" dominantBaseline="middle" fill="#00fff9" fillOpacity={0.4} fontSize={node.name.length > 10 ? 13 : 15} fontWeight="900" fontFamily="Orbitron, sans-serif" letterSpacing="0.15em" className="uppercase" style={{ pointerEvents: 'none' }}>{node.name}</text>
                </>
              )}
              <text
                x={node.x}
                y={node.y - 8}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isOffline ? 'rgba(255,255,255,0.15)' : hasModelLoaded ? 'white' : 'rgba(255,255,255,0.7)'}
                fontSize={node.name.length > 10 ? 13 : 15}
                fontWeight="900"
                fontFamily="Orbitron, sans-serif"
                letterSpacing="0.15em"
                className="uppercase"
                style={{
                  textShadow: isIdle
                    ? `0 2px 8px rgba(0,0,0,0.9), 0 0 10px ${chakraColor}40`
                    : '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)',
                  transition: 'fill 0.3s ease'
                }}
              >
                {node.name}
              </text>

              {/* State indicator below name - shows visual state */}
              <text
                x={node.x}
                y={node.y + 18}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={
                  isOffline ? 'rgba(239, 68, 68, 0.5)' :
                  isComputing ? '#34d399' :
                  isStandby ? 'rgba(250,204,21,0.6)' :
                  'rgba(255,255,255,0.5)'
                }
                fontSize={9}
                fontWeight="900"
                fontFamily="'Source Code Pro', monospace"
                letterSpacing="0.25em"
                className="uppercase"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              >
                {visualState.toUpperCase()}
              </text>

              {/* Layer Stack — transformer layers sharded across this node */}
              {modelLayers && modelLayers > 0 && hasModelLoaded && !isOffline && (
                <LayerStack
                  cx={node.x}
                  cy={node.y}
                  nodeIndex={nodeIndex}
                  nodeName={node.name}
                  totalLayers={modelLayers}
                  topology={globalTopology}
                  activeNodeCount={nodes.filter(n => n.role === 'compute' || n.role === 'standalone').length || 1}
                  isComputing={isComputing}
                  gpuUtil={node.gpu_util}
                />
              )}

            </g>
          );
        })}

        {/* ═══════════════════════════════════════════════════════════════════════
            EXPERT FIBER — MoE expert routing flashes (only for MoE models)
        ═══════════════════════════════════════════════════════════════════════ */}
        {modelArchitecture === 'moe' && (
          <ExpertFiber
            centerX={centerX}
            centerY={centerY}
            nodePositions={nodePositions}
            isActive={clusterTps > 0.1}
            tps={clusterTps}
          />
        )}

        {/* ClusterMetricsRing moved to TopBar — hover dropdown for detail */}
      </svg>

      {/* Educational Info Box moved to right sidebar - see App.tsx */}
    </div>
  );
};

export default MeshGraph;
