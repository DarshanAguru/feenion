# Feenion Web Dashboard

The modern, real-time developer UI for Feenion, featuring live WebSocket telemetry streaming, Trace Glimpse & Overview cards, flamegraph waterfall timelines, latency-proportional D3 mindmap trees, LLM Model Intelligence breakdown tables, and error debuggers.

## Features

- ⚛️ **Modern React 18 + Vite** architecture with TypeScript.
- 📋 **Trace Glimpse View**: High-visibility user input prompt and agent response cards with execution summary KPIs.
- ⏱️ **Flamegraph Waterfall Timeline**: Color-coded span depth and millisecond offsets.
- 🌳 **Latency-Proportional Mindmap Tree**: D3 hierarchy where connection length scales with relative execution latency.
- 🤖 **LLM Model & Framework Intelligence Breakdown**: Dedicated table of calls, prompt/completion tokens, spend ($), and unit cost per 1K tokens by model.
- ⏸️ **Live Stream Pause / Buffer**: Freeze the incoming live feed during high-throughput ingestion to inspect running traces.
- 🗑️ **Multi-Trace Selection & Batch Delete**: Select individual traces with checkboxes or purge the full database securely.

## Development Setup

```bash
cd web
npm install
npm run dev
```

The Vite dev server runs at `http://localhost:3000` and automatically proxies `/api` requests to the FastAPI backend at `http://localhost:8000`.

## Production Build

```bash
npm run build
```

The compiled production bundle is written to `web/dist`, which is automatically served by the FastAPI server at `http://localhost:8000/`.
