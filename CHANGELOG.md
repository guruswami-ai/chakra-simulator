# Dashboard Changelog

All notable changes to the Chakra Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive education documentation suite (DASHBOARD.md, SIMULATION.md, QUANTIZATION.md, TOPOLOGIES.md)
- Data provenance markers in modelCatalog.ts (✓ validated, ≈ extrapolated, ⚠ estimated)
- Inline methodology documentation for all simulation formulas
- Conventional commits guidelines in CONTRIBUTING.md

---

## [5.5.0] - 2026-01-16

### Added
- **Quantization System Expansion**: 7 quantization levels (F16, Q8, Q6, Q5, Q4, Q3, Q2)
  - Visual waveform indicators for signal fidelity
  - Quality percentage badges with color coding (green/yellow/red)
  - Per-quantization TPS factors and memory calculations
  - Data-driven quality metrics from cluster benchmarks

- **Topology Visualization Enhancements**
  - Mini topology diagrams for each parallelism mode
  - Visual node connectivity (mesh, chain, isolated)
  - Incompatibility warnings for divisibility constraints
  - Performance preview tooltips (TPS/TTFT estimates)

- **Model Catalog Expansion**
  - Kimi-K2.5 (1T MoE with MLA attention)
  - DeepSeek-V3 (671B MoE with MLA)
  - Qwen2-VL (72B multimodal)
  - Llama-3.1-8B (small model baseline)

- **Simulation Accuracy Improvements**
  - Context length scaling model (validated ±8% accuracy)
  - Batch size speedup model (validated for 1-16 batch)
  - Quantization TPS factors from MLX benchmarks
  - Memory calculation with KV cache and activation overhead

### Changed
- Refactored HelpDocumentation.tsx into 4 tabs (Hardware, Benchmarks, Intelligence, Integration)
- Updated simulation baseline to Q4 (most common production quantization)
- Improved HelpTip component with better positioning and styling

### Fixed
- Divisibility wall detection for TP modes (hidden_dim % 64×nodes)
- Memory calculation overflow for long contexts (>128K tokens)
- TPS estimation for MoE models (expert routing overhead)

---

## [5.0.0] - 2026-01-05

### Added
- **Orchestration System Integration**
  - Real-time deployment from dashboard
  - Model sync progress tracking (per-node)
  - Deployment wizard (4-step: Topology → Model → Review → Deploy)
  - State machine visualization (IDLE → CHECKING → SYNCING → CONFIGURING → LOADING → READY)

- **Benchmark Replay Mode**
  - Playback of real cluster recordings
  - Scrub timeline for performance analysis
  - Compare simulation vs actual cluster behavior

- **Fabric Efficiency Metric**
  - RDMA health visualization
  - Packet loss detection
  - Sync tax calculation (TP2: 6%, TP4: 14%)

### Changed
- Migrated from Docker to native services (ClickHouse, TensorZero, Grafana)
- WebGL mesh visualization performance optimization (60fps at 7 nodes)
- MQTT architecture refactor for lower latency (<50ms)

### Removed
- Docker Compose deployment (replaced with native LaunchDaemons)
- Legacy topology presets (replaced with dynamic generation)

---

## [4.2.0] - 2025-12-20

### Added
- **Interactive Mesh Graph** (WebGL)
  - 3D node visualization with physics simulation
  - Real-time connection state (green/yellow/red edges)
  - Click-to-select node for detailed metrics
  - Rotation, zoom, pan controls

- **Multi-Model TPS Support**
  - Track multiple concurrent models
  - Per-model TPS display in stats panel
  - Color-coded by model category

- **Cluster Metrics Repositioning**
  - Moved system metrics to dedicated panel
  - Added power consumption tracking
  - Temperature visualization per node

### Fixed
- WebSocket reconnection logic (exponential backoff)
- MQTT subscription cleanup on unmount
- Memory leak in mesh graph animation loop

---

## [4.0.0] - 2025-12-01

### Added
- **Simulation Mode**
  - Explore any model/topology/quantization combination
  - Instant feedback (no cluster deployment needed)
  - Based on real benchmark data (Jan 2026 cluster)
  - Accuracy: ±10% TPS, ±15% TTFT, exact memory

- **Comprehensive Help System**
  - HelpDocumentation.tsx modal with 30+ sections
  - Anchored navigation for deep-linking
  - Hardware specs, benchmarks, model architectures
  - Inline HelpTip component for contextual help

- **Parallelism Illustrator**
  - Visual representation of TP/PP/EP distribution
  - Layer assignment visualization
  - Node utilization charts

### Changed
- Dashboard layout refactor (left panel controls, center 3D graph, right metrics)
- Switched from REST API to WebSocket for live metrics
- Model selection from dropdown to card-based catalog

### Breaking Changes
- **API Change**: Old `/api/deploy` endpoint replaced with orchestration workflow
- **Config Format**: Model specs now use `ModelSpec` interface (see types.ts)

---

## [3.5.0] - 2025-11-15

### Added
- TensorZero integration for LLM gateway
- Recovery manager UI (L1/L2/L3 escalation)
- Dashboard bridge (Flask) for cross-origin WebSocket

### Fixed
- Dashboard loading failure when cluster offline
- MQTT connection timeout on slow networks

---

## [3.0.0] - 2025-11-01

### Added
- Initial dashboard release
- Basic topology selection (TP2, TP4, PP2-5)
- Real-time TPS/TTFT display via MQTT
- Node health monitoring
- Grafana embedding for system metrics

---

## Version History

| Version | Date | Key Features |
|---------|------|--------------|
| 5.5.0 | 2026-01-16 | Quantization expansion, topology diagrams, education docs |
| 5.0.0 | 2026-01-05 | Orchestration system, deployment wizard, benchmark replay |
| 4.2.0 | 2025-12-20 | WebGL mesh graph, multi-model TPS |
| 4.0.0 | 2025-12-01 | Simulation mode, help system, parallelism illustrator |
| 3.5.0 | 2025-11-15 | TensorZero integration, recovery manager |
| 3.0.0 | 2025-11-01 | Initial release |

---

## Upgrade Notes

### 5.0.0 → 5.5.0
- No breaking changes
- New quantization levels automatically available
- Model catalog expanded (no action needed)
- Recommendation: Read new education docs (docs/dashboard/)

### 4.2.0 → 5.0.0
- **Action Required**: Update model catalog entries to include quantization specs
- **Action Required**: Implement orchestration state endpoints if self-hosting
- Old `/api/deploy` endpoint deprecated (use `/api/orchestration/deploy`)

### 3.5.0 → 4.0.0
- **Breaking**: Model config format changed (use `ModelSpec` interface)
- **Breaking**: REST API replaced with WebSocket for live data
- Migration guide: See docs/dashboard/MIGRATION-4.0.md (if exists)

---

## Contribution Recognition

Major contributors to dashboard features:

- **v5.5 Education System**: guruswami-ai (comprehensive documentation)
- **v5.0 Orchestration**: guruswami-ai (deployment automation)
- **v4.2 WebGL Mesh**: guruswami-ai (3D visualization)
- **v4.0 Simulation**: guruswami-ai (simulator engine)

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for how to contribute.

---

## Future Roadmap

### Planned for v6.0 (Q2 2026)
- [ ] Interactive tutorial system (guided walkthrough)
- [ ] AI assistant for configuration recommendations
- [ ] Topology optimizer (suggest best config for constraints)
- [ ] Real-time calibration (ML-based correction)
- [ ] Mobile-responsive layout

### Planned for v5.6 (Q1 2026)
- [ ] Quantization comparison tool (side-by-side diff)
- [ ] MoE+EP benchmarking (expert parallel validation)
- [ ] Expanded MLA model support (DeepSeek-V3, Kimi-K2.5)
- [ ] Thermal throttling simulation

### Ideas (No ETA)
- [ ] Multi-cluster support (compare different hardware)
- [ ] Export simulation results to PDF
- [ ] Saved configurations (bookmark favorite setups)
- [ ] Community benchmarks (share your results)
- [ ] Dark/light theme toggle

---

**Last Updated**: February 12, 2026  
**Dashboard Version**: 5.5.0  
**Simulator Accuracy**: ±10% TPS, ±15% TTFT (validated Jan 2026)
