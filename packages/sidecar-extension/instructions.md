-----

### **Phase 1: Audit & Bootstrap – *Laying the Groundwork***

**Objective:** Create the new directory structure and move existing files without changing any logic, establishing a safe baseline.

1.  **Inventory Existing Modules:**

      * **Current Files:** The core logic is currently in `packages/sidecar-extension/src/background/`.
          * [cite\_start]`service-worker.js`: The monolithic entry point with a large `switch` statement handling all messages. [cite: 1931-1942]
          * [cite\_start]`tab-manager.js`: Handles tab tracking and discovery. [cite: 1958-1972]
          * [cite\_start]`tab-session-manager.js`: Manages per-tab session state. [cite: 1973-1994]
      * **Domain Grouping (Conceptual):**
          * **System Domain:** `PING`, `GET_AVAILABLE_TABS`.
          * **Session Domain:** `RESET_SESSION`.
          * **Prompt Domain:** `EXECUTE_PROMPT`, `BROADCAST_PROMPT`, `HARVEST_RESPONSE`.
          * [cite\_start]**Readiness Domain:** The separate `chrome.runtime.onConnect` logic for the readiness pipeline. [cite: 3051-3053]

2.  **Scaffold New Directory Structure:**

      * In `packages/sidecar-extension/src/background/`, create the new folders:
        ```
        /core
        /domains
        /domains/prompt
        /domains/session
        /domains/readiness
        /utils
        ```

3.  **Migrate Files (No-Op Move):**

      * Move `tab-manager.js` and `tab-session-manager.js` into the new `/utils` folder for now. They will be further refactored later.
      * **Crucially, leave the original `service-worker.js` untouched for this phase.**

4.  **Verification:**

      * Run the application using `pnpm dev`.
      * Use the `test-harness.html` to execute `Test Connection`, `Get Available Tabs`, and `Execute Full Flow`.
      * **Expected Outcome:** Everything should function exactly as before. This confirms the baseline is stable.

-----

### **Phase 2: Core System Extraction – *Building the New Engine***

**Objective:** Introduce the router, middleware, and error handling systems. This phase begins the actual logic migration.

1.  **Implement the Message Router:**

      * Create `packages/sidecar-extension/src/background/core/message-router.js`.
      * Implement the `createMessageRouter` function as defined in your architectural proposal. This will include the `context` object creation with a `requestId`.

2.  **Implement the Middleware System:**

      * Create `packages/sidecar-extension/src/background/core/middleware.js`.
      * Implement `createMiddleware` and add the stubs for `loggingMiddleware`, `metricsMiddleware`, and `validationMiddleware`.

3.  **Implement Centralized Error Handling:**

      * Create `packages/sidecar-extension/src/background/core/error-handler.js`.
      * [cite\_start]This directly addresses the **"Harmonize error messages"** goal from your project's Phase 4. [cite: 2817]
      * Implement the `handleError` function, including `sanitizeErrorMessage`, `isRecoverable`, and `getSuggestion`.

4.  **Activate the Router:**

      * Modify `service-worker.js`. Keep the old `onMessageExternal` listener for now, but create a new `service-worker.refactored.js` (or similar temporary name).
      * In the new file, import the `createMessageRouter` and `handleError`. Instantiate them.
      * In your `vite.config.ts`, temporarily change the service worker entry point to this new file to test the new system in isolation.
        ```js
        // vite.config.ts
        input: {
          'background/service-worker': resolve(__dirname, 'src/background/service-worker.refactored.js'), // Point to the new file
          //...
        },
        ```

5.  **Verification:**

      * In the new service worker, register a single handler (`PING`) and the `loggingMiddleware`.
      * Reload the extension and use the `test-harness.html` to send a `PING` message.
      * **Expected Outcome:** Check the service worker console. You should see the log output from `loggingMiddleware` including the `requestId`, confirming the new router and middleware pipeline is operational.

-----

### **Phase 3: Domain & Handler Realignment – *Establishing Clear Boundaries***

**Objective:** Move the business logic from the monolithic `service-worker.js` into focused, cohesive domain modules.

1.  **Migrate Atomic Handlers to Domains:**

      * Go through the `switch` statement in the original `service-worker.js`. For each message type, create a corresponding handler file in the new domain structure.
      * `domains/prompt/broadcast.js`: Contains `handleBroadcastPrompt` logic.
      * `domains/prompt/harvest.js`: Contains `handleHarvestResponse` logic.
      * `domains/session/reset.js`: Contains the `RESET_SESSION` logic.

2.  **Create Domain Orchestrators:**

      * `domains/prompt/execute.js`: Create this file to orchestrate the prompt workflow. It will import and call the `broadcast` and `harvest` functions. This replaces the old `handleExecutePrompt` function.

3.  **Create Domain `index.js` Barrels:**

      * For each domain folder (`prompt`, `session`), create an `index.js` file that exports all the handlers from that domain. This simplifies imports.
        ```js
        // packages/sidecar-extension/src/background/domains/prompt/index.js
        export { execute } from './execute.js';
        export { broadcast } from './broadcast.js';
        export { harvest } from './harvest.js';
        ```

4.  **Rewire the Router to Use Domains:**

      * In your `service-worker.refactored.js`, remove the individual handler imports and use the new domain imports. Map the message types to the domain functions.
        ```js
        // In service-worker.refactored.js
        import * as promptDomain from './domains/prompt/index.js';
        import * as sessionDomain from './domains/session/index.js';

        const router = createMessageRouter({
          EXECUTE_PROMPT: promptDomain.execute,
          BROADCAST_PROMPT: promptDomain.broadcast,
          HARVEST_RESPONSE: promptDomain.harvest,
          RESET_SESSION: sessionDomain.reset,
          // ... other handlers
        }, { /* ... */ });
        ```

5.  **Verification:**

      * Reload the extension. Use the `test-harness.html` to test the `EXECUTE_PROMPT` and `RESET_SESSION` flows.
      * **Expected Outcome:** The workflows should execute successfully, but now they are running through the new, fully-decoupled domain structure. You have effectively dismantled the old monolith.

-----

### **Phase 4: Utility Consolidation – *Refining Dependencies***

**Objective:** Abstract shared, reusable logic into pure utility modules to improve decoupling and testability.

1.  **Consolidate `tabManager` Logic:**

      * Create `utils/tab-finder.js`. Move the `findTabByPlatform` logic into this new utility.
      * Refactor the domain handlers in `domains/prompt/` and `domains/session/` to import from `utils/tab-finder.js` instead of directly using the `tabManager` instance.

2.  **Create `script-executor.js`:**

      * In `utils/script-executor.js`, create the `executeContentScript` function from your architectural design. This function will wrap `chrome.scripting.executeScript` and include timeout handling.
      * Refactor all domain handlers that call `chrome.scripting.executeScript` to use this new, more robust utility.

3.  **Introduce Unit Testing (Optional but Recommended):**

      * This is the perfect time to set up a testing framework (like Jest).
      * Write your first unit tests for the pure functions in `utils/tab-finder.js` and `utils/script-executor.js`. [cite\_start]This aligns with the **"Testing & Infrastructure"** goals. [cite: 2835]

4.  **Verification:**

      * Perform a full end-to-end smoke test using the Web App UI. Execute prompts and reset sessions.
      * **Expected Outcome:** The application remains fully functional. The domain logic is now cleaner and no longer has direct dependencies on `chrome.*` APIs or the original `tab-manager.js`.

-----

### **Phase 5: Readiness Pipeline Integration – *Unifying Entry Points***

**Objective:** Migrate the separate, port-based readiness check into the new domain-driven architecture. [cite\_start]This is a key task from your project's Phase 3. [cite: 2813-2815]

1.  **Populate `domains/readiness/`:**

      * [cite\_start]The existing `executeReadinessPipeline` logic in `service-worker.js` should be broken down and moved. [cite: 3057-3067]
      * Create `domains/readiness/check.js` to handle the core logic of checking tab status via `window.hybrid.checkReadiness`.
      * Create `domains/readiness/recover.js` (initially it can be a stub) for future recovery actions like auto-login.
      * Add new message types to `shared-messaging` (e.g., `CHECK_READINESS`, `ATTEMPT_RECOVERY`).

2.  **Wire into the Main Router:**

      * Register the new `CHECK_READINESS` message type in the main `message-router.js`, pointing it to `readiness.check`.
      * **Deprecate the Port Listener:** The `chrome.runtime.onConnect` listener for `readiness-pipeline` should now be completely removed from the service worker. All communication now flows through the single `onMessageExternal` listener and the message router.

3.  **Update UI (`ReadinessGate.tsx`):**

      * Refactor the `ReadinessGate.tsx` component in the `web-app`. Instead of using `chrome.runtime.connect`, it should now use the `sidecarService` to send a single `CHECK_READINESS` message. This will require updating `SidecarService.js` to handle this new message type.

4.  **Verification:**

      * Launch the `web-app`. Select a provider.
      * **Expected Outcome:** The readiness gate in the UI should function as before, but the underlying communication now uses the unified message router, demonstrating a cleaner and more consistent architecture.

-----

### **Phase 6: Finalization & Hardening – *Achieving Production Readiness***

**Objective:** Finalize the refactor, enable full observability, and document the new architecture. [cite\_start]This completes the transition to your project's Phase 4. [cite: 2816]

1.  **Activate Full Observability:**

      * [cite\_start]In the service worker, enable the `metricsMiddleware` and `validationMiddleware` that were created in Phase 2. This directly addresses the **"Add analytics and detailed logging"** goal. [cite: 2821]

2.  **Cleanup and Final Switch:**

      * Delete the original `service-worker.js`.
      * Rename `service-worker.refactored.js` to `service-worker.js`.
      * Update `vite.config.ts` to point to the final, clean service worker file.

3.  **Documentation (`CONTRIBUTING.md`):**

      * Create a `CONTRIBUTING.md` file in `packages/sidecar-extension/`.
      * Document the new architecture: explain the role of `core`, `domains`, and `utils`.
      * Provide a clear recipe for adding a new message handler or a new domain, as outlined in your roadmap.

4.  **Verification:**

      * Run your linter and any CI checks.
      * Perform a final, exhaustive test of all application features from the web app UI.
      * **Expected Outcome:** The system is fully migrated, stable, and observable. The codebase is now significantly easier to reason about, maintain, and extend for future phases.