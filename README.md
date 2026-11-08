# Chakra Cluster Simulator

Source for the interactive simulator at **[chakra.guruswami.ai](https://chakra.guruswami.ai)**.

Pick a model, a quantisation level, a context length and a topology (one node, tensor-parallel or pipeline-parallel across up to four Apple Silicon machines), and see what happens to tokens per second, time to first token, memory and perplexity, including the out-of-memory and timeout cases.

The numbers are not estimates. They come from measured runs on a five-node M3 Ultra cluster, published with their method in **[mlx-benchmarks](https://github.com/guruswami-ai/mlx-benchmarks)**. Where a model was only measured on a single node, distributed values are interpolated from measured scaling factors and labelled as interpolated.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npx tsc --noEmit   # type check
```

Built with React, TypeScript, Vite and WebGL, with a narrating Guruswami character. The large music and voice media are deployed with the site and are not stored in this repository, so a local build runs without them.

## Background

This started as a live dashboard for a home-built inference cluster. The simulator is the version anyone can use: the same visual language, driven by recorded benchmark data instead of live telemetry. Some code and docs still describe the original live mode.

Licensed under Apache 2.0.
