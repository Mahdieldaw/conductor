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

## Phase 3: Integration & Core Reliability (Current Focus) 🔄

**Goal:** Achieve a fully reliable, session-aware, and robust connection from the UI to LLM tabs, with advanced error handling and session management.

- [x] Connect UI to SidecarService: Wire PromptComposer to the refactored executePrompt service.
- [x] Implement Basic WorkflowRunner.js for single-prompt recipes.
- [x] State Management & Result Display: UI for displaying responses.
- [x] Implement TabSessionManager:
  - [x] Create `tab-manager.js` for tab tracking.
  - [x] Create `tab-session-manager.js` for per-tab session IDs using `chrome.storage.session`.
  - [x] Integrate session reset and new chat logic (`startNewChat`) across UI, service worker, and content scripts.
- [x] Refactor SidecarService and Service Worker:
  - [x] Remove "always-reload" behavior.
  - [x] Integrate getSession/resetSession logic based on UI toggle.
  - [x] Normalize all provider responses for robust error handling.
- [x] Build the Three-Stage Readiness Pipeline:
  - [x] Implement `<ReadinessGate>` UI and `useReadinessFlow` hook.
  - [x] Add service worker logic for tab readiness and recovery.
  - [x] Add readiness-detector.js content script with login/ready markers.

## Phase 4: Technical Hardening & Observability 🛡️

**Goal:** Strengthen error handling, logging, and support for more providers.

- [x] Harmonize error messages and implement error-classifier.js.
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

- **Core Services:** IntentService and WorkflowRunner are being modularized for maintainability and testability.
- **Workflow Library:** New workflow types (e.g., compare, critique) will be added as JSON contracts and tested automatically.
- **Persistent Memory:** Session history will be stored using `chrome.storage.local` to enable advanced memory features.
- **Observability:** Logging and step-by-step progress will be surfaced in the UI for transparency and debugging.
- **Testing & Infrastructure:** Automated tests and error harmonization will ensure reliability across extension and web app.
- **Metrics:** Key metrics (trust, accuracy, engagement) will be instrumented to guide product decisions.

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

---

## Next Steps

See the [Phases](#phase-3-integration--core-reliability-current-focus-) section above for the current roadmap and priorities.