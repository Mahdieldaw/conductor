# Hybrid Thinking OS

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

## Architecture Overview

The system uses a message-passing architecture where:

1. The **Web App** sends commands to the **Sidecar Extension** via `chrome.runtime.sendMessage`
2. The **Sidecar Extension** executes these commands on live LLM websites using content scripts
3. Results are returned back to the **Web App** for display and further processing

The **Shared Messaging** package ensures consistent message types across both components.