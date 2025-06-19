\# Hybrid Thinking OS

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

## Phase 3: Integration & Workflow Execution 🔄

**Status: IN PROGRESS**

- [x] Connect UI to SidecarService
- [x] Implement WorkflowRunner.js for recipe execution
- [x] Add state management and result display
- [ ] Add advanced workflow features (multi-step, branching, etc.)
- [ ] Enhance UX for long-running and partial results
- [ ] Add persistent settings and provider configuration

## Phase 4: Technical Hardening & Observability 🛡️

**Status: PLANNED**

- [ ] Add detailed logging and analytics (Observability & Traceability)
- [ ] Implement advanced error recovery and retry strategies
- [ ] Add support for additional LLM providers
- [ ] Polish UI/UX and accessibility
- [ ] Prepare for public release
- [ ] Implement a simple logging bus for capturing intermediate outputs and step-by-step status
- [ ] Surface “step X of N” progress in the UI to improve transparency and user trust
- [ ] Harmonize error messages between the sidecar extension and the UI for a seamless user experience

## Phase 5: Persistent Memory & Advanced Workflows 🧠

**Status: PLANNED**

- [ ] Implement persistent memory using chrome.storage.local to cache the last 10 sessions, including prompts, outputs, and trace logs
- [ ] Lay groundwork for a more advanced memory layer in future phases
- [ ] Add advanced workflow features (multi-step, branching, etc.)
- [ ] Add new workflow types (e.g., “compare”, “critique”) as JSON contracts
- [ ] Automate contract testing for each workflow to prevent regressions and ensure reliability

## Phase 6: Extension Infrastructure & Metrics 📊

**Status: PLANNED**

- [ ] Automate extension reload and end-to-end workflow tests in a headless browser
- [ ] Instrument a dashboard to track key metrics (trust score, MVI accuracy, time-to-first-synthesis, engagement, retention, adoption rate)
- [ ] Use these metrics to guide further technical and product decisions

## Phase 7: Advanced Memory & Provider Abstraction (Future) 🚀

**Status: FUTURE**

- [ ] Build a Phase 3 memory layer with cold storage and vector indexing for semantic search
- [ ] Develop a plugin architecture for supporting both content-script and API-based providers

---

## Technical Implementation Roadmap (Summary)

1. **Isolate & Harden Core Services**
   - Refactor IntentService and WorkflowRunner out of the monolithic service worker into dedicated, unit-tested modules.
   - Define a versioned intent schema to ensure consistent interpretation of user intent.
   - This reduces the risk of service worker bloat and misinterpretation in the Model-View-Intent (MVI) engine.
2. **Expand & Validate Workflow Library**
   - Add new workflow types (e.g., “compare”, “critique”) as JSON contracts.
   - Automate contract testing for each workflow to prevent regressions and ensure reliability.
3. **Implement Persistent Memory**
   - Use chrome.storage.local to cache the last 10 sessions, including prompts, outputs, and trace logs.
   - Lays the groundwork for a more advanced memory layer in future phases.
4. **Observability & Traceability**
   - Implement a simple logging bus for capturing intermediate outputs and step-by-step status.
   - Surface “step X of N” progress in the UI to improve transparency and user trust.
5. **Robust Extension & Testing Infrastructure**
   - Automate extension reload and end-to-end workflow tests in a headless browser.
   - Harmonize error messages between the sidecar extension and the UI for a seamless user experience.
6. **Advanced Memory & Provider Abstraction (Future)**
   - Build a Phase 3 memory layer with cold storage and vector indexing for semantic search.
   - Develop a plugin architecture for supporting both content-script and API-based providers.
7. **Metrics & Risk Mitigation**
   - Instrument a dashboard to track key metrics (trust score, MVI accuracy, time-to-first-synthesis, engagement, retention, adoption rate).
   - Use these metrics to guide further technical and product decisions.

### Immediate Next Steps

- Refactor IntentService and WorkflowRunner as standalone modules.
- Build a demo of the synthesis loop for marketing and user onboarding.
- Set up the KPI dashboard before beta launch.
- Launch the insider beta and collect real user feedback to iterate on technical and UX issues.

**In summary:**
The technical roadmap is tightly coupled to user experience goals, with a focus on modularizing core logic, expanding and testing workflows, adding persistent memory, improving observability, and building robust infrastructure for future growth and risk mitigation.

### Shared Messaging Package

The `@hybrid-thinking/messaging` package exports the following message type constants:

- `PING` - Health check message
- `EXECUTE_PROMPT` - Execute a prompt on an LLM platform
- `TASK_COMPLETE` - Indicates a task has finished

## Next Steps

### Phase 1: Building the Sidecar Extension
- Scaffold the extension with Vite and web-extension plugin
- Integrate salvaged Provider and Detector logic from Conductor AI
- Implement ServiceWorker.js and content.js
- Create test harness for validation

### Phase 2: Building the Web App (Control Panel)
- Scaffold with SvelteKit and Tailwind CSS
- Implement SidecarService.js for extension communication
- Build Settings page and main interface

### Phase 3: Integration & Workflow Execution
- Connect UI to SidecarService
- Implement WorkflowRunner.js for recipe execution
- Add state management and result display