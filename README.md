# Hybrid Thinking OS

A powerful workflow automation system that combines a web-based Control Panel with a browser extension Sidecar to execute multi-step AI workflows on live LLM websites like ChatGPT and Claude.

## 🚀 Features

### Phase 5: Workflow Engine & Memory Management

- **Multi-Step Workflow Execution**: Define and execute complex workflows with multiple prompts
- **Intelligent Memory Management**: Tiered storage system with hot cache and cold storage
- **Real-time Workflow Monitoring**: Track workflow progress and status in real-time
- **Session History**: Browse and analyze past workflow executions
- **Error Handling & Recovery**: Robust error handling with detailed logging
- **Tab Management**: Execute workflows on specific browser tabs

### Core Components

- **Control Panel**: React-based web application for workflow management
- **Sidecar Extension**: Browser extension for executing workflows on LLM websites
- **Shared Messaging**: Common message types and communication protocols
- **Memory System**: Dual-tier storage for workflow sessions and results

A system composed of two primary components:

1. **The Control Panel**: A web application where users can define, manage, and execute multi-step AI workflows (called "recipes")
2. **The Sidecar Extension**: A browser extension that acts as a local "API" to execute workflow steps on live LLM websites (like ChatGPT and Claude)

## Project Structure

This is a pnpm monorepo with the following packages:

```
hybrid-thinking-os/
├── packages/
│   ├── shared-messaging/          # @hybrid-thinking/messaging
│   │   ├── index.js              # Message type constants
│   │   └── package.json
│   ├── sidecar-extension/         # @hybrid-thinking/sidecar-extension
│   │   └── package.json          # Browser extension (placeholder)
│   └── web-app/                   # @hybrid-thinking/web-app
│       └── package.json          # Control panel web app (placeholder)
├── package.json                   # Root package with workspace scripts
├── pnpm-workspace.yaml           # Workspace configuration
└── pnpm-lock.yaml                # Lockfile
```

## Development Setup

### Prerequisites
- Node.js (v18 or higher)
- pnpm (v9.1.0 or higher)

### Installation
```bash
pnpm install
```

### Available Scripts
- `pnpm dev` - Run all packages in development mode
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code using Prettier
- `pnpm clean` - Clean all node_modules and build artifacts

## Phase 0: Foundation & Monorepo Setup ✅

**Status: COMPLETED**

- [x] Initialize the monorepo with pnpm workspaces
- [x] Create shared messaging package with message type constants
- [x] Set up placeholder packages for web-app and sidecar-extension
- [x] Configure workspace dependencies and scripts
- [x] Verify package linking and exports

## Phase 1: Sidecar Extension Core 🚀

**Status: COMPLETED**

- [x] Scaffold extension with Vite and web-extension plugin
- [x] Integrate Provider and Detector logic
- [x] Implement ServiceWorker.js and content.js
- [x] Create test harness for validation
- [x] Implement robust tab registry and message routing
- [x] Normalize broadcast and harvest response structures with metadata

## Phase 2: Web App (Control Panel) 🖥️

**Status: COMPLETED**

- [x] Scaffold with React, Vite, and Tailwind CSS
- [x] Implement SidecarService.js for extension communication
- [x] Build main interface and provider selection
- [x] Add prompt composer, template bar, and results display
- [x] Implement parallel prompt execution and robust state management
- [x] Add error handling and retry logic for individual providers

## Phase 3: Resilient Core Engine (Completed) 🚀

**Goal:** Overhauled the core execution engine for robustness, resilience, and performance, creating a stable substrate for all future development.

This phase implemented the **Unified Sidecar v2.0** architecture:
- [x] **Configuration-Driven Foundation**: Decoupled all provider-specific logic (selectors, URLs) into external JSON configs.
- [x] **Resilient Resource Management**: Replaced legacy tab managers with a robust `TabPool` for managing the lifecycle of worker tabs (creation, reuse, discovery, health checks).
- [x] **Flight Control System**: Implemented a `FlightManager` to track every request from launch to completion, managing state and concurrency.
- [x] **Hybrid Harvesting Orchestration**: Built a high-performance harvesting system using a `Promise.race` between high-speed network sniffing and a reliable DOM observation fallback.

## Phase 4: Technical Hardening & Observability (Current Focus) 🛡️

**Goal:** Strengthen error handling, logging, and support for more providers.

- [ ] Centralize messaging constants and implement end-to-end error propagation.
- [ ] Harmonize error messages and implement error-classifier.js.
- [ ] Implement a logging bus for key events and step progress.
- [ ] Surface "Step X of N" progress in UI.
- [ ] Add support for more LLM providers (e.g., Gemini, Perplexity).
- [ ] UI/UX polish for readiness and error states.
- [ ] Advanced error recovery and retry strategies.
- [ ] Add analytics and detailed logging.
- [ ] Prepare for public release.

## Phase 5: Persistent Memory & Advanced Workflows 🧠

**Goal:** Enable multi-step workflows and persistent session history.

- [ ] Implement persistent memory (chrome.storage.local) for session history.
- [ ] Enhance WorkflowRunner.js for multi-step workflows.
- [ ] Add new workflow types (compare, critique) as JSON contracts.
- [ ] Automate contract testing for workflows.
- [ ] Lay groundwork for advanced memory layers.

## Phase 6: Extension Infrastructure & Metrics 📊

**Goal:** Automate testing and instrument key metrics.

- [ ] Automate extension reload and end-to-end workflow tests.
- [ ] Instrument dashboard for trust, accuracy, engagement, etc.
- [ ] Use metrics to guide product decisions.

## Phase 7: Advanced Memory & Provider Abstraction (Future) 🚀

**Goal:** Build scalable memory and plugin architecture.

- [ ] Implement cold storage and vector indexing for semantic search.
- [ ] Develop plugin architecture for content-script and API-based providers.

---


## Technical Implementation Notes

- **Sidecar v2.0 Engine**: The core of the extension is now a resilient, configuration-driven engine that manages resources (`TabPool`) and in-flight requests (`FlightManager`) for maximum stability.
- **Hybrid Harvesting**: The system prioritizes high-speed network interception for harvesting results, with a seamless fallback to DOM observation, ensuring both speed and reliability.
- **Workflow Library:** New workflow types (e.g., compare, critique) will be added as JSON contracts and tested automatically.
- **Persistent Memory:** Session history will be stored using `chrome.storage.local` to enable advanced memory features.
- **Observability:** Logging and step-by-step progress will be surfaced in the UI for transparency and debugging.

### Shared Messaging Package

The `@hybrid-thinking/messaging` package exports the following message type constants:

- `PING` - Health check message
- `EXECUTE_PROMPT` - Execute a prompt on an LLM platform
- `HARVEST_RESPONSE` - Harvest the latest response from a provider
- `BROADCAST_PROMPT` - Send a prompt without harvesting
- `TASK_COMPLETE` - Indicates a task has finished
- `GET_AVAILABLE_TABS` - List all detected LLM tabs
- `RESET_SESSION` - Reset session for a provider/tab
- `START_NEW_CHAT` - Trigger new chat in content script
- `STREAM_DONE` - Indicates a network stream harvest has completed
- `DOM_HARVEST_DONE` - Indicates a DOM fallback harvest has completed
- `PROMPT_ERROR` - Propagates an error from the content script during execution

---

## Next Steps

See the [Phases](#phase-3-integration--core-reliability-current-focus-) section above for the current roadmap and priorities.