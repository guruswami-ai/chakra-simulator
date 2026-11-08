# Node Visualization States

## Overview

Each node in the Chakra dashboard has multiple visual states that communicate its current operational status. The visualization uses a layered approach with the node's chakra SVG at the center.

## Visual Elements

### 1. Center Circle (Node Core)
- **Black circle**: Base node representation
- Contains the chakra SVG symbol for each node

### 2. Outer Colored Circle (Status Ring)
- Surrounds the black center circle
- Color corresponds to chakra (muladhara=red, svadhisthana=orange, etc.)
- **Size changes** based on model loading state
- **Animation** indicates inference activity

### 3. Node Label
- Node name (e.g., VISHUDDHA)
- Current state (e.g., IDLE, STANDBY, COMPUTE)

## Node States

### 1. OFFLINE (Darkened)
**Condition**: Node not responding to ping or not publishing to MQTT

**Visual**:
- Entire node element darkened/grayed out
- No colored ring visible
- SVG symbol dimmed
- Label shows: `{NODE_NAME} - OFFLINE`

**Dashboard Data**:
```json
{
  "power_w": 0,
  "role": "offline",
  "warnings": [{"type": "offline", "msg": "Node not responding"}]
}
```

### 2. ONLINE (Idle - No Model)
**Condition**: Node online, reporting metrics, no model loaded

**Visual**:
- Node brightens from darkened state
- Small colored ring around black center (minimal expansion)
- SVG symbol at normal brightness
- Label shows: `{NODE_NAME} - IDLE`

**Dashboard Data**:
```json
{
  "power_w": 20-35,
  "gpu_util": 0,
  "wired_gb": 5-10,
  "role": "idle"
}
```

### 3. STANDBY (Model Loaded, Not Active)
**Condition**: Part of inference topology, model loaded in RAM, not actively generating

**Visual**:
- Colored ring **expanded** proportionally to RAM usage
- Ring expansion shows model size (wired_gb relative to ram_total)
- SVG symbol static (not spinning)
- Ring steady (not pulsing)
- Label shows: `{NODE_NAME} - STANDBY`

**Dashboard Data**:
```json
{
  "power_w": 25-40,
  "gpu_util": 0,
  "wired_gb": 100-200,  // Model loaded
  "role": "standby"
}
```

**Ring Expansion Formula**:
```javascript
ringScale = 1.0 + (wired_gb / ram_total) * 0.5  // 50% max expansion at full RAM
```

### 4. COMPUTE (Active Inference)
**Condition**: Actively generating tokens as part of inference

**Visual**:
- Colored ring **pulsing/glowing** animation
- SVG chakra symbol **spinning** clockwise
- Ring at expanded size (model loaded)
- Brighter glow effect around ring
- Label shows: `{NODE_NAME} - COMPUTE`

**Dashboard Data**:
```json
{
  "power_w": 100-180,
  "gpu_util": 80-100,
  "wired_gb": 100-200,
  "role": "compute"
}
```

**Animation Specs**:
- Ring pulse: 0.5s ease-in-out, opacity 0.6 → 1.0
- SVG spin: 360° rotation over 2s, linear, continuous
- Glow intensity: Proportional to gpu_util

### 5. WARNING States
**Condition**: Node has alerts that need attention

**Visual Overlay**:
- Warning icon appears on node
- Ring color shifts to amber/yellow for warnings
- Ring color shifts to red for critical alerts

**Warning Types**:

| Type | Trigger | Visual |
|------|---------|--------|
| `memory_leak` | GPU idle but wired_gb > 50 | Amber ring pulse |
| `thermal` | temp_c > 95 | Red ring, thermometer icon |
| `power` | Idle power > 60W | Amber ring |
| `tb5_down` | TB5 links unreachable | Connection broken icon |
| `offline` | No metrics for >10s | Darkened with X icon |

## State Transitions

```
OFFLINE ──[ping OK + MQTT data]──> IDLE
IDLE ──[model loaded, wired_gb increases]──> STANDBY
STANDBY ──[gpu_util > 5%]──> COMPUTE
COMPUTE ──[gpu_util drops to 0]──> STANDBY
STANDBY ──[model unloaded, wired_gb drops]──> IDLE
ANY ──[no data for 10s]──> OFFLINE
```

## Node Detail Panel (Right 1/3)

When a node is selected, the detail panel shows:

### Header
- Node name with colored indicator
- Current role badge (IDLE/STANDBY/COMPUTE/OFFLINE)
- Connection status (TB5/10GbE indicator)

### Metrics Section
```
┌─────────────────────────────────────┐
│ GPU Load     ████████░░░░  75%      │
│ SOC Load     ███░░░░░░░░░  25%      │
│ Temperature  52°C                    │
│ Power        145W                    │
│ VRAM Used    185.2 / 512 GB (36%)   │
│ KV Cache     0%                      │
└─────────────────────────────────────┘
```

### Network Section
```
┌─────────────────────────────────────┐
│ TB5 Status   ● HEALTHY (4/4 links)  │
│ TB5 Latency  0.4ms                  │
│ 10GbE        ● Connected            │
│ RDMA         ● Active               │
└─────────────────────────────────────┘
```

### Alerts Section
```
┌─────────────────────────────────────┐
│ ⚠️ Memory Leak Detected             │
│    GPU idle but 185GB wired memory  │
│    Action: Run GPU reset procedure  │
│                                     │
│ ✓ No thermal warnings               │
│ ✓ Power consumption normal          │
└─────────────────────────────────────┘
```

## Implementation Notes

### State Detection Logic

```typescript
function getNodeState(node: NodeData): NodeState {
  if (!node.power_w || node.power_w < 5) {
    return 'offline';
  }

  if (node.role === 'controller' || node.role === 'mcp') {
    return node.role; // Management nodes
  }

  if (node.gpu_util > 5) {
    return 'compute';
  }

  if (node.wired_gb > 50) { // Model likely loaded
    return 'standby';
  }

  return 'idle';
}
```

### Ring Animation CSS

```css
@keyframes pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.node-ring.compute {
  animation: pulse 0.5s ease-in-out infinite;
}

.node-svg.compute {
  animation: spin 2s linear infinite;
}
```

### WebSocket Events to Handle

| Event | Action |
|-------|--------|
| `node_update` | Update node metrics, recalculate state |
| `inference_status` | Update which nodes are in active topology |
| `node_alert` | Show warning indicator on node |

## Data Fields Required

From bridge `/metrics/cluster-status`:

```json
{
  "nodes": [{
    "name": "muladhara",
    "role": "standby",
    "power_w": 145.2,
    "gpu_util": 0,
    "wired_gb": 185.2,
    "ram_total": 512,
    "temp_c": 52.5,
    "tb5_status": "healthy",
    "tb5_reachable": 2,
    "warnings": []
  }],
  "activeNodes": ["muladhara", "svadhisthana", "manipura", "anahata"]
}
```
