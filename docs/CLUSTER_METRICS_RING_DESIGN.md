# Cluster Metrics Ring Visualization - Design Review

## Executive Summary

After reviewing the codebase, I **recommend proceeding with the ring repositioning** with modifications to the "optimization metric" concept. The visualization provides valuable at-a-glance cluster health information, but the metric should be **context-aware** rather than a single universal score.

## Current State Analysis

### Existing Implementation
- **Location**: Right sidebar (`App.tsx` line 710)
- **Component**: `ClusterTotals.tsx` - landscape-oriented panel with:
  - Left: Circular gauge with 3 concentric rings (SOC_UTIL, VRAM_POOL, PWR_DRAW)
  - Center: "Stability" health score (0-100)
  - Right: Metric cards with details
  - Footer: Button to open Cluster Diagnostics HUD
- **Size**: ~200px gauge in a full-width panel
- **Metrics**:
  - **SOC_UTIL**: Average GPU utilization across active nodes
  - **VRAM_POOL**: Total RAM used / total RAM available
  - **PWR_DRAW**: Total power / 2400W max (5 nodes × 480W)
  - **Stability Score**: GPU util with penalties for latency (>52µs) and temperature (>60°C)

### Cluster Architecture Context
From CLAUDE.md and benchmark docs, key insights:

1. **Hardware**: 5× M3 Ultra (512GB each) + 2× M4 Pro controllers
2. **Network**: TB5 full mesh (RDMA), 10GbE Ethernet to controllers
3. **Parallelism Strategies**:
   - **TP2/TP4**: Best for low latency (0.26s TTFT), full mesh sync
   - **PP5**: Best for memory (2.5TB pooled), but higher latency (sequential stages)
   - **TP5**: Requires dimension padding (TP5_PADDING.md), not all models supported
4. **Known Trade-offs**:
   - TP2: Only 2 nodes active, 3 idle = wasted power/capacity
   - TP4: More RDMA overhead, protection domain issues on manipura
   - PP5: Pipeline bubbles, higher TTFT, but uses all 5 nodes efficiently

## The "Optimization" Problem

### Why a Single "Optimized" Metric is Misleading

The user correctly identified the core challenge:
> "exactly what optimised looks like as it is task dependant on the specific crazy hardware I'm using"

**Optimization is multi-dimensional and context-dependent:**

| Use Case | Optimal Topology | Why | Trade-off |
|----------|------------------|-----|-----------|
| Interactive chat (7B-70B) | TP2 | Lowest TTFT (0.26s), sub-second responses | 3 nodes idle, wasted 60% capacity |
| Batch processing (405B+) | PP5 | All 5 nodes utilized, max memory pool | 5× higher latency than TP2 |
| Giant models (Kimi-K2 612GB) | PP5 or TP5 | Only configurations that fit in memory | TP5 requires padding, PP5 has bubbles |
| High throughput (many users) | TP4 or DP | Balanced parallelism | More network overhead |

**There is no "universal optimized" state** - TP2 with 3 idle nodes might be optimal for latency-critical workloads.

### Recommended Approach: Context-Aware Metrics

Instead of a single "optimization score," show **deployment-specific efficiency metrics**:

#### 1. **Utilization Efficiency** (when idle nodes are expected)
```
Metric = (Active Nodes / Total Nodes) × (Avg GPU Util / 100)
Range: 0-100%
```

- **TP2 active**: 40% = (2/5) × 100% GPU → "Good (TP2)"
- **PP5 active**: 100% = (5/5) × 100% GPU → "Excellent (PP5)"
- **All idle**: 0% → "Standby"

**Label**: "Fabric Utilization" or "Deployment Efficiency"

#### 2. **Performance vs Theoretical Max** (when throughput matters)
```
Metric = (Actual TPS / Theoretical Max TPS for this topology) × 100
Range: 0-100%
```

Theoretical max baselines (from benchmarks):
- **PP5**: 3.04 TPS/node baseline (from ClusterDetailedView.tsx)
- **TP2**: ~6-8 TPS expected (from benchmarks)
- **TP4**: ~4-5 TPS expected

**Label**: "Performance Index"

#### 3. **Power Efficiency** (watts per token/sec)
```
Metric = TPS / (Total Power Draw / 100W)
Range: Variable (display as "X.X TPS/100W")
```

- **TP2 @ 800W, 8 TPS**: 1.0 TPS/100W
- **PP5 @ 2000W, 15 TPS**: 0.75 TPS/100W

**Label**: "Power Efficiency"

#### 4. **Latency vs Target** (for interactive workloads)
```
Metric = (Target TTFT / Actual TTFT) × 100
Range: 0-200% (>100% = better than target)
```

Target TTFT by topology (from benchmarks):
- **TP2**: 0.26s target
- **TP4**: 0.35s target
- **PP5**: 1.0s target

**Label**: "Responsiveness"

### Proposed Solution: **Adaptive "Fabric Health" Metric**

Instead of "optimization," show **Fabric Health** which adapts based on cluster state:

```typescript
function calculateFabricHealth(nodes, topology, activeModels) {
  // Base: Current "Stability" score (GPU util - latency penalty - thermal penalty)
  const stabilityScore = calculateStability(nodes);
  
  // Context-aware adjustment based on deployment
  if (activeModels.length === 0) {
    // Idle state: Health = power efficiency (low power = healthy idle)
    const avgPowerPerNode = totalPower / nodes.length;
    const idleBonus = Math.max(0, (150 - avgPowerPerNode) / 150 * 20); // +20 if <150W/node
    return Math.min(100, stabilityScore + idleBonus);
  }
  
  // Active inference: Health = performance vs expected
  const expectedTps = getExpectedTPS(topology, modelSize);
  const actualTps = activeModels[0].tokPerSec;
  const performancePct = (actualTps / expectedTps) * 100;
  
  // Blend stability and performance
  return (stabilityScore * 0.6) + (performancePct * 0.4);
}
```

**Display in center of ring**:
- **Number**: Fabric Health (0-100)
- **Label**: Context-aware status badge
  - Idle: "Standby" (white/gray)
  - Active + healthy: "Optimal" (green) or "Nominal" (cyan)
  - Active + degraded: "Thermal" (orange) or "Congested" (yellow)

**Hover tooltip** shows breakdown:
```
Fabric Health: 87/100
├─ Stability: 92 (GPU util, latency, thermal)
├─ Performance: 105% of TP2 baseline
├─ Utilization: 40% (2/5 nodes, expected for TP2)
└─ Power: 1.2 TPS/100W
```

**Click** opens Cluster Diagnostics HUD with full details.

## Implementation Plan

### 1. Create `ClusterMetricsRing.tsx` Component

**Props**:
```typescript
interface ClusterMetricsRingProps {
  nodes: NodeMetrics[];
  topology: string;
  activeModels: ModelInstance[];
  onOpenDetailed: () => void;
}
```

**Features**:
- **Compact size**: 120-150px diameter (vs current 200px)
- **Positioned**: Absolute overlay on MeshGraph canvas
  - X: ~70% of canvas width (right side)
  - Y: ~20% of canvas height (above SVADHISTHANA node at top position)
- **Visual states**:
  - Idle: Subtle glow, white/gray
  - Active: Color-coded by health (green/cyan/orange/red), pulsing glow
- **Interactions**:
  - Hover: Tooltip with metric breakdown (use lucide-react tooltip or custom)
  - Click: Call `onOpenDetailed()` to open ClusterDetailedView

**Ring structure** (same 3 rings as current):
- Outer: SOC_UTIL (GPU utilization) - emerald (#10b981)
- Middle: VRAM_POOL (memory) - cyan (#06b6d4)
- Inner: PWR_DRAW (power) - yellow (#eab308)

**Center display**:
- Top: Small label "Fabric Health" (8px font)
- Middle: Large number 0-100 (36-40px font)
- Bottom: Status badge (smaller than current implementation)

### 2. Position on MeshGraph

In `MeshGraph.tsx`, add after node rendering (around line 1265):

```tsx
{/* Cluster Metrics Ring - Positioned above-right of center */}
<foreignObject 
  x={centerX + radius * 0.5} 
  y={centerY - radius * 0.8}
  width={150} 
  height={150}
>
  <ClusterMetricsRing
    nodes={nodes}
    topology={globalTopology}
    activeModels={activeModels}
    onOpenDetailed={/* Pass down from App.tsx */}
  />
</foreignObject>
```

**Positioning rationale**:
- SVADHISTHANA is at angle `-π/2 + (1 * 2π/5)` = top-right position
- Ring placed above and right of center to be near SVADHISTHANA without obscuring it
- `foreignObject` allows rendering React component inside SVG

### 3. Remove from Sidebar

In `App.tsx` line 710, remove:
```tsx
<ClusterTotals nodes={state.nodes} onOpenDetailed={() => setIsClusterDetailedOpen(true)} />
```

Keep `ClusterDetailedView` modal accessible via ring click.

### 4. Update Fabric Health Calculation

In `ClusterTotals.tsx` (or new utility), enhance health calculation:
- Current: `finalHealth = GPU util - latency penalty - thermal penalty`
- New: Add context-aware adjustments based on topology and inference state

## Visual Design Guidelines

### Color States (matching node aesthetic)
- **Idle**: `rgba(255, 255, 255, 0.2)` - subtle white glow
- **Healthy (>80)**: `rgba(16, 185, 129, 0.4)` - emerald glow
- **Nominal (60-80)**: `rgba(34, 211, 238, 0.4)` - cyan glow
- **Warning (40-60)**: `rgba(251, 191, 36, 0.4)` - amber glow
- **Degraded (<40)**: `rgba(239, 68, 68, 0.4)` - red glow

### Animation
- **Idle**: Static, no pulse
- **Active**: Gentle pulse (2s duration) using `drop-shadow` filter
- **High TPS (>10)**: Faster pulse (1s duration), matching node animation

### Typography
- Center number: `font-mono font-black` (consistent with dashboard style)
- Status badge: `text-[8px] uppercase tracking-widest` (consistent with ClusterTotals)

## Alternatives Considered

### Alternative 1: Model-Specific Optimization Score
**Idea**: Calculate optimal topology for the current model, show deviation from optimal
**Rejected**: Too complex, requires model metadata (heads, layers, size) not always available

### Alternative 2: Multiple Mini-Rings (One Per Metric)
**Idea**: Show 4 small rings (utilization, performance, power, latency) instead of one
**Rejected**: Too cluttered for at-a-glance view, defeats purpose of simplicity

### Alternative 3: Simple Traffic Light (Red/Yellow/Green)
**Idea**: Single color indicator without numeric score
**Rejected**: Loses granularity, users want a number they can track

## Risks and Mitigations

### Risk 1: Ring Obscures Important UI Elements
**Mitigation**: 
- Make ring semi-transparent background
- Allow drag-to-reposition (future enhancement)
- Provide toggle to hide (future enhancement)

### Risk 2: Metric Confusion ("What does 73 mean?")
**Mitigation**:
- Clear "Fabric Health" label
- Comprehensive hover tooltip
- Help documentation in ClusterDetailedView

### Risk 3: Metric Feels Arbitrary
**Mitigation**:
- Show breakdown on hover (transparency)
- Document calculation in code comments
- Link to benchmark docs in help panel

## Success Criteria

1. **Visual**: Ring visible and styled consistently with node glow aesthetic
2. **Positioning**: Positioned above-right of SVADHISTHANA without obscuring critical elements
3. **Interaction**: Hover tooltip works, click opens ClusterDetailedView
4. **Performance**: No lag when animating (React.memo, useMemo for calculations)
5. **Clarity**: Metric meaning clear from label + tooltip, not confusing

## Future Enhancements

1. **Draggable positioning**: Allow user to drag ring to preferred location
2. **Expand/collapse**: Double-click to expand to full ClusterTotals panel view
3. **Historical trend**: Small sparkline inside ring showing health over time
4. **Alerts**: Red border pulse when health drops below threshold
5. **Custom metrics**: User-configurable metric (pick from dropdown)

## Conclusion

**Recommendation: Proceed with modified design**

The ring visualization is valuable for at-a-glance cluster monitoring. The key insight is that **"optimization" is context-dependent**, so the metric should be:

1. **Labeled as "Fabric Health"** (not "optimization" or "efficiency")
2. **Context-aware**: Adapts based on deployment state (idle vs active, topology)
3. **Transparent**: Hover tooltip shows breakdown
4. **Actionable**: Click opens full diagnostics for deeper investigation

This approach acknowledges the complexity of the hardware without oversimplifying to a misleading "optimized" score.
