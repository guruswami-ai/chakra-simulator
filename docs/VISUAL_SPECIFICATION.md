# Chakra Cluster Dashboard - Visual Specification

This document defines the visual language, animations, and data mappings used in both LIVE and SIM dashboard versions.

---

## 1. Animation Definitions

### 1.1 Token Flow Animation

Tokens are visualized as **light yellow semi-transparent particles** flowing through network links.

| Property | Value | Notes |
|----------|-------|-------|
| Color | `#fef08a` (Yellow 200) | Warm, visible against dark backgrounds |
| Size (TB5) | 6-8px radius | Larger for high-bandwidth links |
| Size (10GbE) | 3-4px radius | Smaller for management traffic |
| Opacity | 0.4-0.8 | Varies with throughput |
| Blur | 1px filter | Soft glow effect |

**Speed Mapping (particles/second):**
```
TPS 0-5:    Slow (3s per link traversal)
TPS 5-15:   Medium (1.5s per link)
TPS 15-30:  Fast (0.6s per link)
TPS 30+:    Ludicrous (0.25s per link)
```

### 1.2 Inference Phase Animations

| Phase | Node Glow | Link Color | Particles | Description |
|-------|-----------|------------|-----------|-------------|
| **Idle** | None | Dim cyan | None | No model loaded |
| **Loaded** | Soft chakra color, 0.1 opacity | Dim cyan | None | Model in memory, not inferring |
| **Prefilling** | Amber pulse, 0.35 opacity | Amber `#f59e0b` | Orange waves | Loading prompt into KV cache (TTFT) |
| **Generating** | Green pulse, 0.5 opacity | Cyan `#22d3ee` | Yellow tokens | Active token generation |
| **Complete** | Fade to Loaded state | Dim cyan | None | Request finished |

### 1.3 Party Mode (High Throughput)

**Thresholds:**
```
Normal:     TPS < 15      Standard animations
Energetic:  TPS 15-25     Faster pulses, brighter glows
Party:      TPS 25-40     Saturated colors, rapid particles
Ludicrous:  TPS 40+       Maximum intensity, screen shake (SIM only)
```

**Visual Effects by Mode:**
| Mode | Mandala Speed | Node Pulse | Saturation Boost |
|------|---------------|------------|------------------|
| Normal | 0.03 base | 4s | 0% |
| Energetic | 0.08 | 2s | +15% |
| Party | 0.15 | 1s | +30% |
| Ludicrous | 0.28 | 0.4s | +50% |

### 1.4 Perplexity Color Shift (SIM/Educational)

Maps model "confidence" to color health:

| Perplexity | Color Palette | Interpretation |
|------------|---------------|----------------|
| 0-10 | Vibrant purple/magenta | Genius - high confidence |
| 10-25 | Purple shifting to green | Normal operation |
| 25-40 | Yellow-green | Degraded - struggling |
| 40+ | Sickly green/brown | Confused - "brain going bad" |

---

## 2. Network Topology Scenarios

### 2.1 Topology Overview

| ID | Name | Nodes | Network | Use Case |
|----|------|-------|---------|----------|
| `EP5_SOLO` | Single Node | 1 | None | Small models (<128GB) |
| `RING_PP2` | Pipeline 2-Stage | 2 | TB5 Ring | Medium models |
| `RING_PP3` | Pipeline 3-Stage | 3 | TB5 Ring | Large models |
| `RING_PP4` | Pipeline 4-Stage | 4 | TB5 Ring | Very large models |
| `RING_PP5` | Pipeline 5-Stage | 5 | TB5 Ring | Maximum context (Kimi-K2) |
| `TP2_RDMA` | Tensor Parallel 2 | 2 | TB5 RDMA Mesh | Low latency, divisible-by-2 |
| `TP4_RDMA` | Tensor Parallel 4 | 4 | TB5 RDMA Mesh | Low latency, divisible-by-4 |

### 2.2 Pipeline Parallel (PP) - Sequential Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Node 0  │───▶│ Node 1  │───▶│ Node 2  │───▶│ Node 3  │───▶│ Node 4  │
│ Layers  │    │ Layers  │    │ Layers  │    │ Layers  │    │ Layers  │
│  0-19   │    │ 20-39   │    │ 40-59   │    │ 60-79   │    │ 80-95   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │                                                            │
     └──────────────── Output returns via 10GbE ◀─────────────────┘
```

**Characteristics:**
- Activations flow sequentially through nodes
- Each node holds different layers of the model
- Memory per node = Total Model Size / Node Count
- Higher latency (sequential), but supports any model size
- TB5 links: Unidirectional arrows in visualization

**Link Animation:**
- Forward: Cyan particles flowing Node 0 → Node N
- Return: Green dashed line from last node → Node 0 (output tokens)

### 2.3 Tensor Parallel (TP) - Synchronized Mesh

```
        ┌─────────┐
        │ Node 0  │
        │ Head 0  │
        └────┬────┘
           ╱│╲
          ╱ │ ╲
    ┌────╱──┼──╲────┐
    │   ╱   │   ╲   │
┌───▼──▼┐ ┌─▼─┐ ┌▼──▼───┐
│Node 1 │ │...│ │Node 3 │
│Head 1 │ │   │ │Head 3 │
└───────┘ └───┘ └───────┘
    All-Reduce Sync Every Layer
```

**Characteristics:**
- All nodes process same layer simultaneously
- Attention heads split across nodes
- Requires all-reduce sync at every transformer layer
- Lower latency (parallel), but node count must divide head count
- TB5 RDMA mesh: Bidirectional arrows in visualization

**Constraints:**
- Kimi-K2: 128 heads → TP2 or TP4 only (not TP3 or TP5)
- Node count must evenly divide attention head count

**Link Animation:**
- Bidirectional cyan particles (all-reduce traffic)
- Higher particle density than PP (more network traffic)

### 2.4 Visual Differentiation

| Aspect | Pipeline Parallel | Tensor Parallel |
|--------|-------------------|-----------------|
| Link Style | Unidirectional arrows | Bidirectional mesh |
| Link Color | Cyan (sequential) | Cyan + white core |
| Particle Flow | One direction | Both directions |
| Legend Label | "Pipeline Ring (80Gbps)" | "RDMA Mesh (80Gbps)" |
| Node Labels | "Stage 0", "Stage 1"... | "Shard 0", "Shard 1"... |

---

## 3. Model Cards

### 3.1 Required Fields

| Field | Source | Example |
|-------|--------|---------|
| `name` | HuggingFace/config | "Kimi-K2-Thinking" |
| `size_gb` | Calculated from safetensors | 614 |
| `parameters` | model config | "1T (32B active)" |
| `quantization` | File suffix / config | "4-bit" |
| `context_length` | model config | 131072 |
| `architecture` | model config | "MoE Transformer" |

### 3.2 Runtime Fields (LIVE only)

| Field | Source | Update Frequency |
|-------|--------|------------------|
| `memory_per_node` | Calculated | On load |
| `current_tps` | Inference server | 1s |
| `kv_cache_percent` | Inference server | 1s |
| `active_requests` | Inference server | 1s |

### 3.3 Display Tiers (SIM)

| Tier | RAM | Models | Visual Style |
|------|-----|--------|--------------|
| Hobby | 16-32GB | 7B-13B | Green badge |
| Pro | 64-128GB | 70B | Blue badge |
| Studio | 192-512GB | 405B | Purple badge |
| Cluster | 1TB+ | 700B+ | Gold badge |

---

## 4. Node Statistics

### 4.1 Available from mactop (port 9100)

All compute nodes expose these via Prometheus metrics:

| Metric | Prometheus Name | Unit | Update |
|--------|-----------------|------|--------|
| CPU Usage | `mactop_cpu_usage_percent` | % | 1s |
| GPU Usage | `mactop_gpu_usage_percent` | % | 1s |
| Memory Used | `mactop_memory_used_gb` | GB | 1s |
| Memory Total | `mactop_memory_total_gb` | GB | Static |
| GPU Temperature | `mactop_gpu_temp_celsius` | °C | 1s |
| Power Draw | `mactop_power_watts` | W | 1s |
| Network RX | `mactop_network_rx_bytes` | bytes/s | 1s |
| Network TX | `mactop_network_tx_bytes` | bytes/s | 1s |

### 4.2 Available from Inference Server (port 8000)

| Metric | Endpoint | Unit |
|--------|----------|------|
| Tokens/sec | `/metrics` or calculate | tok/s |
| KV Cache % | `/health` | % |
| Active Requests | `/health` | count |
| Model Loaded | `/health` | boolean |
| TTFT (last) | `/metrics` | ms |

### 4.3 Calculated/Derived Metrics

| Metric | Calculation | Notes |
|--------|-------------|-------|
| Network Gbps | `(rx + tx) * 8 / 1e9` | Convert bytes to Gbps |
| Memory % | `used / total * 100` | For progress bars |
| Cluster TPS | `sum(node_tps)` | Aggregate |
| Efficiency | `tps / power_w` | Tokens per watt |

### 4.4 Node State Machine

```
┌──────────┐
│ OFFLINE  │ ← Node unreachable
└────┬─────┘
     │ Node responds
     ▼
┌──────────┐
│  IDLE    │ ← Online, no model
└────┬─────┘
     │ Model loading
     ▼
┌──────────┐
│ LOADING  │ ← Transferring weights
└────┬─────┘
     │ Load complete
     ▼
┌──────────┐
│ STANDBY  │ ← Model ready, no requests
└────┬─────┘
     │ Request received
     ▼
┌──────────┐
│ COMPUTE  │ ← Actively inferring
└────┬─────┘
     │ Request complete
     ▼
   STANDBY
```

---

## 5. Color Palette

### 5.1 Network Fabric Colors

| Element | Hex | Tailwind | Usage |
|---------|-----|----------|-------|
| TB5 RDMA | `#22d3ee` | cyan-400 | High-speed compute links |
| 10GbE Ethernet | `#3b82f6` | blue-500 | Management/API traffic |
| Token Particles | `#fef08a` | yellow-200 | Data flow visualization |
| Output Return | `#22c55e` | green-500 | PP output path |

### 5.2 Node State Colors

| State | Hex | Meaning |
|-------|-----|---------|
| Active/Compute | `#34d399` | Green - processing |
| Standby/Loaded | `#60a5fa` | Blue - ready |
| Loading | `#f59e0b` | Amber - transitioning |
| Idle | `#6b7280` | Gray - inactive |
| Error | `#ef4444` | Red - problem |

### 5.3 Chakra Node Colors

| Node | Color | Hex |
|------|-------|-----|
| Muladhara | Red | `#ef4444` |
| Svadhisthana | Orange | `#f97316` |
| Manipura | Yellow | `#eab308` |
| Anahata | Green | `#22c55e` |
| Vishuddha | Blue | `#3b82f6` |
| Ajna | Indigo | `#6366f1` |
| Sahasrara | Violet | `#a855f7` |

---

## 6. Data Sources (LIVE Mode)

### 6.1 mactop Prometheus Metrics (port 9100)

Available on all 7 nodes. Version 2.0.5 (custom fork).

**Power Metrics:**
| Metric | Prometheus Name | Unit |
|--------|-----------------|------|
| CPU Power | `mactop_power_cpu_watts` | W |
| GPU Power | `mactop_power_gpu_watts` | W |
| ANE Power | `mactop_power_ane_watts` | W |
| DRAM Power | `mactop_power_dram_watts` | W |
| System Power | `mactop_power_system_watts` | W |
| Total Power | `mactop_power_total_watts` | W |

**Temperature Metrics:**
| Metric | Prometheus Name | Unit |
|--------|-----------------|------|
| CPU Temp | `mactop_temp_cpu_celsius` | °C |
| GPU Temp | `mactop_temp_gpu_celsius` | °C |
| SoC Temp | `mactop_temp_soc_celsius` | °C |

**Memory Metrics:**
| Metric | Prometheus Name | Unit |
|--------|-----------------|------|
| Total Memory | `mactop_memory_total_gb` | GB |
| Used Memory | `mactop_memory_used_gb` | GB |
| Available | `mactop_memory_available_bytes` | bytes |

**Utilization Metrics:**
| Metric | Prometheus Name | Unit |
|--------|-----------------|------|
| CPU Usage | `mactop_cpu_usage_percent` | % |
| GPU Usage | `mactop_gpu_usage_percent` | % |

**Network Metrics:**
| Metric | Prometheus Name | Labels |
|--------|-----------------|--------|
| RX Bytes | `mactop_network_rx_bytes` | aggregate |
| TX Bytes | `mactop_network_tx_bytes` | aggregate |
| Interface RX | `mactop_interface_rx_bytes` | `interface=enX` |
| Interface TX | `mactop_interface_tx_bytes` | `interface=enX` |

**JACCL/RDMA Link Metrics (M3 Ultra nodes only):**
| Metric | Prometheus Name | Labels |
|--------|-----------------|--------|
| Link RX | `mactop_jaccl_link_rx_gbps` | `peer=hostname` |
| Link TX | `mactop_jaccl_link_tx_gbps` | `peer=hostname` |
| Link Status | `mactop_jaccl_link_status` | `peer=hostname` (1=up, 0=down) |

**Node Metadata:**
| Metric | Prometheus Name | Labels |
|--------|-----------------|--------|
| Node Info | `cluster_node_info` | `node, role, chip, ram_gb` |

### 6.2 Inference Server Metrics (muladhara:8000)

**Endpoints:**
| Endpoint | Purpose | Update |
|----------|---------|--------|
| `/health` | Model status, backend | 2s |
| `/metrics` | Prometheus inference stats | 1s |
| `/v1/models` | Loaded model info | On demand |

**Prometheus Metrics from `/metrics`:**
| Metric | Prometheus Name | Labels |
|--------|-----------------|--------|
| Total Requests | `chakra_inference_requests_total` | `model, status` |
| Active Requests | `chakra_inference_active_requests` | - |
| Prompt Tokens | `chakra_inference_tokens_total` | `type=prompt` |
| Completion Tokens | `chakra_inference_tokens_total` | `type=completion` |
| Duration Histogram | `chakra_inference_duration_seconds` | `model`, buckets |

**Health Response:**
```json
{
  "status": "ok",
  "model": "/opt/models/MODEL_NAME",
  "backend": "ring|jaccl"
}
```

### 6.3 TensorZero Gateway (sahasrara:3000)

TensorZero logs to ClickHouse for inference telemetry.

**Health Endpoint:** `GET /health`
```json
{
  "gateway": "ok",
  "clickhouse": "ok",
  "postgres": "ok"
}
```

**ClickHouse Tables (default database):**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `ModelInference` | Per-request telemetry | `input_tokens, output_tokens, response_time_ms, ttft_ms, model_name` |
| `ChatInference` | Chat completions | `inference_id, timestamp` |
| `CumulativeUsageView` | Aggregated usage | Computed totals |

**ModelInference Schema (key fields):**
```sql
id              UUID
inference_id    UUID
model_name      LowCardinality(String)
input_tokens    Nullable(UInt32)
output_tokens   Nullable(UInt32)
response_time_ms Nullable(UInt32)
ttft_ms         Nullable(UInt32)  -- Time To First Token!
finish_reason   Enum8('stop','length','tool_call',...)
timestamp       DateTime
```

### 6.4 WebSocket Aggregator Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dashboard (React)                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WebSocket Client (ws://sahasrara:8080/cluster/stream)   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              WebSocket Aggregator (sahasrara:8080)               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │  Poller:   │  │  Poller:   │  │  Poller:   │                 │
│  │  mactop    │  │  inference │  │  ClickHouse│                 │
│  │  (1s)      │  │  (1s)      │  │  (5s)      │                 │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                 │
│        │               │               │                         │
│        └───────────────┼───────────────┘                         │
│                        ▼                                         │
│              ┌─────────────────┐                                 │
│              │   State Store   │                                 │
│              │  (in-memory)    │                                 │
│              └────────┬────────┘                                 │
│                       │                                          │
│              ┌────────▼────────┐                                 │
│              │  JSON Broadcast │  → All connected clients        │
│              │  (100ms debounce)│                                │
│              └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ mactop          │  │ chakra_server   │  │ ClickHouse      │
│ :9100 x7 nodes  │  │ :8000           │  │ :8123           │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**WebSocket Message Schema:**
```typescript
interface ClusterUpdate {
  type: 'cluster_state';
  timestamp: number;
  nodes: {
    [hostname: string]: {
      // mactop metrics
      power: { cpu: number; gpu: number; total: number };
      temp: { cpu: number; gpu: number };
      memory: { used_gb: number; total_gb: number; percent: number };
      cpu_percent: number;
      gpu_percent: number;
      network: { rx_gbps: number; tx_gbps: number };
      jaccl_links?: { [peer: string]: { rx_gbps: number; tx_gbps: number; up: boolean } };
    };
  };
  inference: {
    status: 'idle' | 'prefilling' | 'generating';
    model: string;
    backend: 'ring' | 'jaccl';
    active_requests: number;
    tokens_generated: number;
    current_tps: number;
    avg_ttft_ms: number;
  };
  cluster: {
    total_power_watts: number;
    total_memory_gb: number;
    used_memory_gb: number;
    nodes_online: number;
  };
}
```

### 6.5 Polling Endpoints Summary

| Data | Endpoint | Method | Frequency |
|------|----------|--------|-----------|
| Node Metrics | `http://{node}:9100/metrics` | GET | 1s |
| Cluster Health | `http://muladhara:8000/health` | GET | 2s |
| Inference Stats | `http://muladhara:8000/metrics` | GET | 1s |
| Model Info | `http://muladhara:8000/v1/models` | GET | On load |
| TensorZero Health | `http://sahasrara:3000/health` | GET | 5s |
| ClickHouse Stats | SQL via HTTP | POST | 5s |

### 6.6 Alternative: MQTT Architecture

For even lower latency, metrics can flow through Mosquitto MQTT:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   mactop    │    │ inference   │    │ ClickHouse  │
│   agent     │    │   server    │    │   exporter  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              Mosquitto MQTT Broker                   │
│                 sahasrara:1883                       │
│                                                      │
│  Topics:                                             │
│  chakra/nodes/{hostname}/metrics                     │
│  chakra/inference/state                              │
│  chakra/inference/events                             │
│  chakra/cluster/stats                                │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│           MQTT-to-WebSocket Bridge                   │
│                 sahasrara:8080                       │
└─────────────────────────────────────────────────────┘
       │
       ▼
    Dashboard

---

## 7. Responsive Behavior

### 7.1 Breakpoints

| Size | Width | Layout |
|------|-------|--------|
| Desktop | 1920px+ | Full mesh + sidebar |
| Laptop | 1280-1919px | Compact mesh + collapsible sidebar |
| Tablet | 768-1279px | Stacked layout |
| Mobile | <768px | Not supported (show message) |

### 7.2 Performance Modes

| Mode | Animation FPS | Particles | Shaders |
|------|---------------|-----------|---------|
| Full | 60 | All | Mandala active |
| Reduced | 30 | Limited | Mandala static |
| Minimal | 15 | None | No shaders |

---

## 8. Quantization Visualization: Signal-Degradation Waveform

### 8.1 Design Concept

Quantization reduces the precision of neural network weights from 16-bit floats to fewer bits. This is mathematically identical to reducing the **sample rate** of a signal — the same tradeoff an audio engineer makes between CD quality and a telephone codec.

The dashboard visualizes this with a **sine wave that degrades as bit-depth decreases**:

```
F16 (Reference)     Q4 (Standard)      Q2 (Experimental)

  ╭─╮                 ╭╮                  ┌┐
 ╱   ╲               ╱  ╲               ┌┘└┐
╱     ╲─────        ╱    ╲───          ┌┘  └──
        ╲   ╱            ╲  ╱          │      │
         ╰─╯              ╰╯          └┘      └┘

Smooth sine wave    Visible stepping    Blocky square wave
32 sample points    10 sample points    3 sample points
```

**Why a sine wave?** A sine is the fundamental building block of all signals (Fourier decomposition). When you quantize a neural network, you're effectively reducing the resolution with which the model can represent nuance — just as reducing sample points on a sine wave introduces aliasing artifacts. The visual is immediately intuitive: smooth = faithful, blocky = lossy.

### 8.2 The Precision Spectrum

Each quantization level maps to an instrument-panel label rather than a subjective quality word:

| Level | Steps | Diamond | Label | Rationale |
|-------|-------|---------|-------|-----------|
| **F16** | 32 | ◆◆ | Reference | Original weights — the ground truth |
| **Q8** | 24 | ◆ | Hi-Fi | Near-lossless, like FLAC audio |
| **Q6** | 18 | ◆ | Precise | Measurably close, marginal quality cost |
| **Q5** | 14 | ◇ | Balanced | Sweet spot for memory-constrained setups |
| **Q4** | 10 | ◇ | Standard | Community default, most benchmarks use this |
| **Q3** | 6 | ⬦ | Lossy | Visible degradation on reasoning tasks |
| **Q2** | 3 | ⬦ | Experiment | Research only — output becomes incoherent |

The **diamond symbols** (◆◆ → ◆ → ◇ → ⬦) provide a secondary at-a-glance quality indicator, following the convention of filled = high fidelity, hollow = reduced, thin = experimental.

### 8.3 Implementation: QuantWaveform Component

**File:** `services/dashboard/components/SimulationPanel.tsx`

The `QuantWaveform` React component generates an inline SVG:

```tsx
<QuantWaveform steps={32} color="#a855f7" />  // F16: smooth sine
<QuantWaveform steps={10} color="#22d3ee" />  // Q4: visible aliasing
<QuantWaveform steps={3}  color="#ef4444" />  // Q2: blocky square wave
```

**Algorithm:**
1. Sample a sine wave at `steps` evenly-spaced points across one full period (2π)
2. For `steps ≤ 6` (Q3, Q2): render as a **staircase** — each sample holds its previous Y value before jumping to the new one, creating the characteristic "stepped" waveform of a low-resolution DAC
3. For `steps > 6`: render as a smooth polyline connecting the sample points
4. A faint baseline reference line at y=0 provides visual grounding

**Stroke weight** adapts to step count: thinner (1.2px) for dense smooth waves, thicker (1.6px) for the few bold steps of Q2/Q3.

### 8.4 Perplexity-Driven Quality Feedback

The quantization level feeds a **perplexity percentage** into the rest of the dashboard:

```
User selects Q2 (68% quality)
       │
       ├──▶ QuantWaveform: blocky 3-step square wave
       ├──▶ Tile shows "68%" in red text
       ├──▶ ChatSimulator: text corruption begins (gibberish injection)
       ├──▶ Status badge: "STREAMING" → "DEGRADED" → "HALLUCINATING"
       ├──▶ Chat border: pulses red
       └──▶ MandalaShader: shifts from vibrant purple to sickly green
```

**Corruption thresholds:**

| Quality % | Visual Effect | Chat Behavior |
|-----------|---------------|---------------|
| ≥ 97% | Purple/violet waveform | Normal coherent output |
| 93–96% | Green waveform | Normal output |
| 85–92% | Cyan waveform, "Noticeable quality degradation" warning | Mostly normal |
| 80–84% | Amber waveform, warning | Occasional odd substitutions |
| 70–79% | Red text, "DEGRADED" badge, red border | Progressive gibberish |
| < 70% | Red waveform, "HALLUCINATING" badge | Heavy corruption, incoherent |

The `corruptText()` function in `ChatSimulator.tsx` progressively replaces words with gibberish tokens (`blorp`, `znark`, `∆∆∆`, `[ERROR]`, `NaN`) at a rate proportional to `(80 - qualityPct) / 40`.

### 8.5 Per-Model Quantization Data

Each model in the catalog carries a `QuantizationSpec` for every available quantization level:

```ts
interface QuantizationSpec {
  memoryGB: number;       // Size at this quantization
  available: boolean;     // Does this quant exist for this model?
  perplexityPct: number;  // % of F16 quality (100 = reference)
  tpsFactor: number;      // TPS multiplier vs F16 (>1 = faster)
}
```

This enables the UI to:
- **Grey out** unavailable quantizations (N/A)
- **Show OOM** when memory exceeds node capacity
- **Display per-model quality** (a 27B model degrades faster at Q2 than a 1T MoE)
- **Adjust TPS** based on quantization (lower bits = less memory bandwidth = faster)

### 8.6 Educational Value

The waveform visualization teaches three concepts simultaneously:

1. **Quantization = sampling**: Fewer bits means fewer levels to represent a value, just as fewer sample points on a waveform means less fidelity. Users see this directly — the smooth wave becoming a staircase.

2. **Quality isn't binary**: The 7-level spectrum (F16 → Q2) shows that quantization isn't "full quality or broken" — it's a continuous tradeoff. Q4 is often "good enough" while Q2 is experimental.

3. **Quality depends on model size**: The same Q4 quantization yields 94% quality on a 405B model but only 92% on a 27B model. Larger models have more redundancy to absorb the precision loss.

---

| Term | Definition |
|------|------------|
| **TPS** | Tokens Per Second - inference throughput |
| **TTFT** | Time To First Token - latency measure |
| **KV Cache** | Key-Value cache for attention |
| **PP** | Pipeline Parallel - sequential layer split |
| **TP** | Tensor Parallel - head/dimension split |
| **RDMA** | Remote Direct Memory Access |
| **TB5** | Thunderbolt 5 (80Gbps) |
| **Shard** | Portion of model on one node |
| **All-Reduce** | Synchronization operation in TP |
| **Quantization** | Reducing weight precision (F16→Q2) to save memory |
| **Perplexity** | Measure of model uncertainty; lower = better |
| **QuantWaveform** | SVG signal-degradation icon for quantization levels |

---

*Last updated: 2026-02-12*
*Version: 1.1 — Added quantization waveform visualization (§8)*
