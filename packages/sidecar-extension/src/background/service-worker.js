// src/background/service-worker.js

// Tab Registry to track open LLM tabs
class TabRegistry {
  constructor() {
    this.tabs = new Map();
  }

  addTab(tabId, url) {
    const hostname = new URL(url).hostname;
    if (this.isSupportedHostname(hostname)) {
      // THE FIX: getPlatformKey is already correct. No more .toLowerCase() needed.
      const platformKey = this.getPlatformKey(hostname); 
      this.tabs.set(tabId, { url, hostname, platformKey, lastActivity: Date.now() });
      console.log(`TabRegistry: Added/Updated tab ${tabId} for platform ${platformKey}`);
    }
  }

  removeTab(tabId) {
    if (this.tabs.has(tabId)) {
      this.tabs.delete(tabId);
      console.log(`TabRegistry: Removed tab ${tabId}`);
    }
  }
  
  isSupportedHostname(hostname) {
    return hostname.includes('chatgpt.com') || 
           hostname.includes('chat.openai.com') || 
           hostname.includes('claude.ai') || 
           hostname.includes('console.anthropic.com');
  }
  
  getPlatformKey(hostname) {
    if (!hostname) return 'unknown';
    if (hostname.includes('chatgpt') || hostname.includes('openai')) return 'chatgpt';
    if (hostname.includes('claude') || hostname.includes('anthropic')) return 'claude';
    return 'unknown';
  }

  getTab(tabId) {
    return this.tabs.get(tabId);
  }

  getAllTabs() {
    return Array.from(this.tabs.entries()).map(([tabId, info]) => ({
      tabId,
      ...info
    }));
  }

  findTabByPlatform(platformKey) {
    // THE FIX: Remove the internal conversion. Trust the caller to provide a clean key.
    for (const [tabId, info] of this.tabs.entries()) {
      if (info.platformKey === platformKey) {
        return { tabId, ...info };
      }
    }
    return null;
  }
}

const tabRegistry = new TabRegistry();

// +++ INTENT SERVICE +++
const IntentService = {
  async getIntentFromAPI(prompt) {
    // NOTE: Using a placeholder for the API key as per instructions.
    // In a real application, this should be handled securely.
    const API_KEY = 'YOUR_GEMINI_API_KEY_PLACEHOLDER';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const systemPrompt = `Classify the following user request into one of these categories: [Summarize, Compare, Critique, Create, Reframe]. Return only the single category name. Request: "${prompt}"`;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] }),
      });

      if (!response.ok) {
        console.error('Gemini API request failed:', response.status, response.statusText);
        return null; // Failed, so we'll use the fallback
      }

      const data = await response.json();
      const intent = data.candidates?.[0]?.content?.parts?.[0]?.text.trim();
      const validIntents = ['Summarize', 'Compare', 'Critique', 'Create', 'Reframe'];
      
      if (intent && validIntents.includes(intent)) {
        console.log(`[IntentService] API classified intent as: ${intent}`);
        return intent;
      }
      console.warn(`[IntentService] API returned invalid or no intent: ${intent}`);
      return null;
    } catch (error) {
      console.error('[IntentService] Error calling Gemini API:', error);
      return null; // Fallback on error
    }
  },

  getIntentFromKeywords(prompt) {
    const p = prompt.toLowerCase();
    if (p.startsWith('summarize')) return 'Summarize';
    if (p.startsWith('compare')) return 'Compare';
    if (p.startsWith('critique')) return 'Critique';
    if (p.startsWith('create')) return 'Create';
    if (p.startsWith('reframe')) return 'Reframe';
    console.log('[IntentService] Keyword classification found no match. Defaulting to Create.');
    return 'Create'; // Default intent
  },

  async getIntent(prompt) {
    const apiIntent = await this.getIntentFromAPI(prompt);
    if (apiIntent) {
      return apiIntent;
    }
    console.log('[IntentService] API intent failed or invalid, falling back to keywords.');
    return this.getIntentFromKeywords(prompt);
  }
};

// +++ WORKFLOW RUNNER +++
const WorkflowRunner = {
  async runWorkflow(workflowId, input) {
    console.log(`[WorkflowRunner] Starting workflow: ${workflowId}`);
    const workflowUrl = chrome.runtime.getURL(`../shared-workflows/${workflowId}.json`);
    const response = await fetch(workflowUrl);
    if (!response.ok) {
      throw new Error(`Failed to load workflow: ${workflowId}`);
    }
    const workflow = await response.json();
    console.log('[WorkflowRunner] Workflow definition loaded:', workflow);

    const outputs = {};

    for (const step of workflow.steps) {
      console.log(`[WorkflowRunner] Executing step: ${step.id}`);
      let promptForStep = step.prompt;

      // Replace placeholders
      promptForStep = promptForStep.replace(/{{input.prompt}}/g, input.prompt);
      promptForStep = promptForStep.replace(/{{input.text}}/g, input.text || ''); // Handle optional text
      for (const key in outputs) {
        promptForStep = promptForStep.replace(new RegExp(`{{outputs.${key}}}`, 'g'), outputs[key]);
      }

      console.log(`[WorkflowRunner] Prompt for step ${step.id}:`, promptForStep);

      // Execute the step
      const result = await handleExecutePrompt({ prompt: promptForStep, platform: step.provider });
      outputs[step.id] = result;
      console.log(`[WorkflowRunner] Output for step ${step.id}:`, result);
    }

    // Final Synthesis Step
    if (workflow.synthesis) {
      console.log('[WorkflowRunner] Executing synthesis step...');
      let synthesisPrompt = workflow.synthesis.prompt;
      synthesisPrompt = synthesisPrompt.replace(/{{input.prompt}}/g, input.prompt);
      synthesisPrompt = synthesisPrompt.replace(/{{input.text}}/g, input.text || '');
      for (const key in outputs) {
        synthesisPrompt = synthesisPrompt.replace(new RegExp(`{{outputs.${key}}}`, 'g'), outputs[key]);
      }

      console.log('[WorkflowRunner] Prompt for synthesis:', synthesisPrompt);
      const finalResult = await handleExecutePrompt({ prompt: synthesisPrompt, platform: workflow.synthesis.provider });
      console.log('[WorkflowRunner] Workflow completed. Final result:', finalResult);
      return finalResult;
    }

    // If no synthesis, return the output of the last step
    const lastStepId = workflow.steps[workflow.steps.length - 1].id;
    console.log('[WorkflowRunner] Workflow completed. Returning last step output.');
    return outputs[lastStepId];
  }
};


// Initialize registry on startup
chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
        if(tab.url) tabRegistry.addTab(tab.id, tab.url);
    });
});

// Listen for tab updates to maintain registry
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    tabRegistry.addTab(tabId, tab.url);
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  tabRegistry.removeTab(tabId);
});

// Routing table for intents to workflows
const intentToWorkflowMap = new Map([
  ['Summarize', 'summarize-and-refine'],
  ['Compare', 'default-create'], // Placeholder, can be a specific compare workflow
  ['Critique', 'default-create'], // Placeholder
  ['Create', 'default-create'],
  ['Reframe', 'default-create'] // Placeholder
]);

// Handle messages from the web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch (message.type) {
        case 'EXECUTE_PROMPT':
          // The new entry point for user prompts
          const intent = await IntentService.getIntent(message.payload.prompt);
          const workflowId = intentToWorkflowMap.get(intent) || 'default-create';
          const result = await WorkflowRunner.runWorkflow(workflowId, message.payload);
          sendResponse({ success: true, data: result });
          break;
        
        case 'HARVEST_RESPONSE':
          const harvestResult = await handleHarvestResponse(message.payload);
          sendResponse({ success: true, data: harvestResult });
          break;
          
        case 'BROADCAST_PROMPT':
          const broadcastResult = await handleBroadcastPrompt(message.payload);
          sendResponse({ success: true, data: broadcastResult });
          break;

        case 'GET_AVAILABLE_TABS':
          const tabs = tabRegistry.getAllTabs();
          sendResponse({ success: true, data: tabs });
          break;
          
        case 'PING':
          sendResponse({ success: true, data: 'pong' });
          break;
          
        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('Sidecar Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  handleAsync();
  return true; // Keep the message channel open for async response
});

// This function remains the "atomic" one for executing a prompt and harvesting the result.
async function handleExecutePrompt({ prompt, platform }) {
  const platformKey = platform.toLowerCase();
  const targetTab = tabRegistry.findTabByPlatform(platformKey);
  if (!targetTab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }

  // 1. Broadcast
  const broadcastResults = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: (p) => window.sidecar.broadcast(p),
    args: [prompt],
  });

  if (!broadcastResults || broadcastResults.length === 0) {
    throw new Error("Broadcast script execution failed to return a result object.");
  }

  const [broadcastResult] = broadcastResults;
  if (broadcastResult.error) {
    throw new Error(broadcastResult.error.message);
  }
  // Check the normalized broadcast result
  if (broadcastResult.result && broadcastResult.result.success === false) {
    const meta = broadcastResult.result.meta ? ` (meta: ${JSON.stringify(broadcastResult.result.meta)})` : '';
    throw new Error(`Broadcast failed: ${broadcastResult.result.error}${meta}`);
  }

  // 2. Harvest
  console.log(`[Service Worker] Initiating harvest for ${platformKey}...`);

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: () => window.sidecar.harvest(),
  });

  if (!results || results.length === 0) {
    throw new Error("Script execution failed to return a result object.");
  }

  const [firstResult] = results;

  if (firstResult.error) {
    throw new Error(`Content script unhandled error: ${firstResult.error.message}`);
  }

  const normalizedResponse = firstResult.result;

  if (normalizedResponse && normalizedResponse.success) {
    console.log(`[Service Worker] ✅ Harvest successful for ${platformKey}. Method: ${normalizedResponse.meta.method}, Duration: ${normalizedResponse.meta.duration.toFixed(0)}ms`);
    return normalizedResponse.data;
  } else {
    console.error(`[Service Worker] ❌ Harvest failed for ${platformKey}. Method: ${normalizedResponse.meta.method}, Error: ${normalizedResponse.error}`);
    throw new Error(normalizedResponse.error || "An unknown harvest error occurred.");
  }
}

// This new function handles harvesting a response independently.
async function handleHarvestResponse({ platform }) {
  if (!platform) {
    throw new Error("Payload must include 'platform'.");
  }
  // THE FIX: Convert to lowercase here, and ONLY here.
  const platformKey = platform.toLowerCase();
  const targetTab = tabRegistry.findTabByPlatform(platformKey);
  if (!targetTab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: () => window.sidecar.harvest(),
  });
  if (!results || !results[0]) throw new Error('Script execution failed.');
  if (results[0].error) throw new Error(`Content script error: ${results[0].error.message}`);
  if (results[0].result === null || results[0].result === undefined) throw new Error('Content script returned null/undefined.');
  return results[0].result;
}

// Add the new handler function:
async function handleBroadcastPrompt({ prompt, platform }) {
  if (!platform) {
    throw new Error("Payload must include 'platform'.");
  }
  const platformKey = platform.toLowerCase();
  const targetTab = tabRegistry.findTabByPlatform(platformKey);
  if (!targetTab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: (promptToBroadcast) => window.sidecar.broadcast(promptToBroadcast),
    args: [prompt]
  });
  if (!results || !results[0]) throw new Error('Script execution failed for broadcast.');
  if (results[0].error) throw new Error(`Content script error during broadcast: ${results[0].error.message}`);
  return "Prompt broadcasted successfully.";
}

console.log('Hybrid Thinking OS Sidecar Extension - Service Worker loaded and ready.');