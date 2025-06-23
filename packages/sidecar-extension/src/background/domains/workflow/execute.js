/**
 * Workflow Execute Handler
 * 
 * Handles the execution of multi-step workflows with session tracking
 */

import { MemoryManager } from '../../memory-manager.js';
import * as promptDomain from '../prompt/index.js';

const memoryManager = new MemoryManager();
const activeWorkflows = new Map(); // Track running workflows

/**
 * Execute a workflow with multiple steps
 * @param {Object} payload - The workflow execution payload
 * @param {string} payload.workflowId - ID of the workflow to execute
 * @param {Array} payload.steps - Workflow steps to execute
 * @param {Object} payload.synthesis - Synthesis configuration
 * @param {Object} payload.options - Additional options
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Workflow execution result
 */
export async function execute(payload, context) {
  const { workflowId, steps, synthesis, options = {} } = payload;
  const sessionId = crypto.randomUUID();
  
  console.log(`[Workflow] Starting execution of workflow ${workflowId} with session ${sessionId}`);
  
  try {
    // Use the provided workflow structure directly
    const workflow = {
      id: workflowId,
      steps: steps || [],
      synthesis: synthesis || null
    };
    
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error(`No steps provided for workflow: ${workflowId}`);
    }
    
    // Create session record
    const sessionRecord = {
      sessionId,
      workflowId,
      workflow,
      startTime: Date.now(),
      status: 'running',
      steps: [],
      currentStep: 0
    };
    
    // Store in active workflows
    activeWorkflows.set(sessionId, sessionRecord);
    
    // Save initial session state
    await memoryManager.saveSession(sessionRecord);
    
    // Execute workflow steps
    const result = await executeWorkflowSteps(workflow, sessionRecord);
    
    // Update final session state
    sessionRecord.status = 'completed';
    sessionRecord.endTime = Date.now();
    sessionRecord.result = result;
    
    await memoryManager.saveSession(sessionRecord);
    activeWorkflows.delete(sessionId);
    
    return {
      sessionId,
      status: 'completed',
      result
    };
    
  } catch (error) {
    console.error(`[Workflow] Error executing workflow ${workflowId}:`, error);
    
    // Update session with error
    const sessionRecord = activeWorkflows.get(sessionId);
    if (sessionRecord) {
      sessionRecord.status = 'failed';
      sessionRecord.error = error.message;
      sessionRecord.endTime = Date.now();
      await memoryManager.saveSession(sessionRecord);
      activeWorkflows.delete(sessionId);
    }
    
    throw error;
  }
}

/**
 * Load workflow definition from shared-workflows package
 */
async function loadWorkflowDefinition(workflowId) {
  try {
    // In a real implementation, this would load from the shared-workflows package
    // For now, return a basic workflow structure
    const workflows = {
      'default-create': {
        id: 'default-create',
        name: 'Default Create Workflow',
        steps: [
          {
            id: 'step1',
            type: 'prompt',
            platform: 'chatgpt',
            template: 'Create: {{input}}'
          }
        ]
      },
      'summarize-and-refine': {
        id: 'summarize-and-refine',
        name: 'Summarize and Refine Workflow',
        steps: [
          {
            id: 'step1',
            type: 'prompt',
            platform: 'chatgpt',
            template: 'Summarize this: {{input}}'
          },
          {
            id: 'step2',
            type: 'prompt',
            platform: 'claude',
            template: 'Refine this summary: {{step1.result}}'
          }
        ]
      }
    };
    
    return workflows[workflowId];
  } catch (error) {
    console.error(`[Workflow] Error loading workflow ${workflowId}:`, error);
    return null;
  }
}

/**
 * Execute all steps in a workflow
 */
async function executeWorkflowSteps(workflow, sessionRecord) {
  const stepResults = {};
  
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    sessionRecord.currentStep = i;
    
    console.log(`[Workflow] Executing step ${step.id} (${i + 1}/${workflow.steps.length})`);
    
    try {
      // Use the prompt directly from the step (no template processing for now)
      const prompt = step.prompt || '';
      
      // Execute the step
      const stepResult = await executeStep(step, prompt, sessionRecord);
      
      // Store step result
      stepResults[step.id] = { result: stepResult };
      sessionRecord.steps.push({
        stepId: step.id,
        platform: step.platform,
        prompt,
        result: stepResult,
        timestamp: Date.now()
      });
      
      // Save intermediate state
      await memoryManager.saveSession(sessionRecord);
      
    } catch (error) {
      console.error(`[Workflow] Error in step ${step.id}:`, error);
      throw new Error(`Step ${step.id} failed: ${error.message}`);
    }
  }
  
  return stepResults;
}

/**
 * Execute a single workflow step
 */
async function executeStep(step, prompt, sessionRecord) {
  if (step.type === 'prompt') {
    // Use the existing prompt domain to execute the step
    const result = await promptDomain.execute({
      platform: step.platform,
      prompt
    }, { requestId: `${sessionRecord.sessionId}-${step.id}` });
    
    return result;
  }
  
  throw new Error(`Unknown step type: ${step.type}`);
}

/**
 * Process template with variable substitution
 */
function processTemplate(template, variables) {
  let processed = template;
  
  // Replace {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(pattern, typeof value === 'object' ? value.result : value);
  }
  
  return processed;
}

/**
 * Get active workflow status
 */
export function getActiveWorkflows() {
  return Array.from(activeWorkflows.values());
}