Development Brief: Hybrid Thinking OS - UI for Parallel Prompt Execution
1. Mission: Evolve the Control Panel
The primary objective is to transform the Web App Control Panel from a simple prompt broadcaster into a robust, real-time execution and results management interface. The backend Sidecar extension is stable and proven; this initiative completes the prompt-to-result lifecycle by building a comprehensive frontend capable of orchestrating and displaying parallel, multi-provider AI responses. This is a critical prerequisite for all future workflow development.

2. Core Architecture
2.1. System Context
Backend Engine: The Sidecar browser extension is fully operational. It reliably handles provider discovery, prompt broadcasting, and response harvesting.

Frontend Gap: The current Control Panel UI can initiate prompts but lacks the state management and components to handle the asynchronous, multi-provider responses returned by the Sidecar.

2.2. State Management: The Single Source of Truth
The UI will be driven by a central state object. The proposed Map structure is architecturally sound and must be implemented as the single source of truth for all response data.

File: PromptCanvas.tsx
State Object: promptState.responses
Data Structure:

// Map<providerId: string, Response>
Map<string, {
  status: 'pending' | 'completed' | 'error';
  data?: string;   // The full response text on success
  error?: string;  // The error message on failure
}>


3. Technical Implementation Plan
3.1. Execution Logic Refactor: handlePromptExecution
The core execution logic in PromptCanvas.tsx must be refactored to handle parallel requests robustly and update the UI state efficiently.

Architectural Mandate: Use Promise.allSettled
We will use Promise.allSettled for executing prompts against multiple providers. This is the optimal approach because it guarantees that the overall operation will not fail even if one or more individual provider requests fail. It returns a comprehensive status for every single promise, which is exactly what our multi-provider UI requires.

Optimized Implementation (PromptCanvas.tsx):

const handlePromptExecution = async () => {
  const targets = promptState.targetProviders;
  if (targets.length === 0) return;

  // 1. Initialize UI state for all targets to 'pending'.
  // This provides immediate user feedback that work has started.
  const initialResponses = new Map(
    targets.map(id => [id, { status: 'pending' }])
  );
  updatePromptState({ status: 'executing', responses: initialResponses });

  // 2. Create an array of execution promises.
  const executionPromises = targets.map(providerId =>
    sidecarService.executePrompt(providerId, promptState.text)
  );

  // 3. Await all results using Promise.allSettled for maximum robustness.
  const results = await Promise.allSettled(executionPromises);

  // 4. Reconcile all results back into the state map.
  // This is a single, efficient batch update to prevent multiple re-renders.
  const finalResponses = new Map(initialResponses); // Start from a clean slate
  results.forEach((result, index) => {
    const providerId = targets[index];
    if (result.status === 'fulfilled') {
      finalResponses.set(providerId, { status: 'completed', data: result.value });
    } else {
      // Capture the error message for display in the UI.
      finalResponses.set(providerId, { status: 'error', error: result.reason.message });
    }
  });

  updatePromptState({ status: 'completed', responses: finalResponses });
};


3.2. Component Spec Sheet
Two new components must be created to visualize the results.

Component 1: ResultsDisplay.tsx

Responsibility: Orchestrates the visualization of all responses. Acts as the container for the ResponseCard components.

Props:

responses: Map<string, Response>

providers: Provider[] (To look up provider metadata like name/logo)

Behavior:

Should render null or nothing if the responses map is empty.

Must render its contents within a responsive two-column grid (grid grid-cols-1 md:grid-cols-2 gap-4).

Iterates over responses.entries() and renders one ResponseCard for each entry, passing the required props.

Component 2: ResponseCard.tsx

Responsibility: Displays the result from a single AI provider.

Props:

provider: Provider (Contains name, logo, theme color, etc.)

responseState: Response (The object with status, data, or error)

UI States & Elements:

Container: A visually distinct card with padding and rounded corners.

Header: Displays the provider's Name and Logo/Color.

Status Indicator:

pending: A spinner/loading animation.

completed: A success icon (e.g., a checkmark).

error: An error icon (e.g., a cross or warning sign).

Content Body:

If status is completed, display the data in a pre-formatted block. The text must be user-selectable and easily copyable.

If status is error, display the error message clearly.

3.3. UX Feedback Enhancement: ExecutionController.tsx
To provide a clear summary of a batch operation, the ExecutionController must be enhanced.

Trigger Condition: When promptState.status is 'completed'.

Logic: Check if every value in the promptState.responses map has a status of 'completed'.

Display: If the condition is met, render a prominent success message: "✅ All responses received successfully."

4. Acceptance Criteria & Deliverables
4.1. Acceptance Criteria
Functional: A user can select multiple providers, enter a prompt, and see a distinct response card for each provider.

Robustness: A failure from one provider (e.g., API error) does not prevent results from other providers from being displayed.

Stateful: Each response card correctly displays its current state: pending (with a spinner), completed (with data), or error (with a message).

Usability: Generated response text is selectable and can be copied to the clipboard.

UX: The UI provides a clear "all successful" message when appropriate.

Layout: Response cards are displayed in a responsive side-by-side grid on larger screens.

4.2. Summary of Deliverables
| Feature | File(s) to Modify/Create | Action Required |
| Execution Logic | PromptCanvas.tsx | Refactor handlePromptExecution to use Promise.allSettled and update state. |
| Results Container | ResultsDisplay.tsx (New) | Create the grid-based component to render the list of response cards. |
| Result Card UI | ResponseCard.tsx (New) | Create the card component for displaying individual provider results and status. |
| Success Feedback | ExecutionController.tsx | Add logic to display a confirmation message upon 100% successful completion. |