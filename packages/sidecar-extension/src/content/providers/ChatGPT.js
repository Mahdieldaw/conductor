// src/content/providers/ChatGPT.js
import { waitForElement } from '../primitives/helpers.js';
import { BaseProvider } from './BaseProvider.js';

export class ChatGPTAsk extends BaseProvider {
  constructor() {
    super({ baseTimeout: 10000 });
  }

  static async broadcast(prompt) {
    const instance = new ChatGPTAsk();
    return instance._broadcast(prompt);
  }

  async _broadcast(prompt) {
    const input = await waitForElement(
      '#prompt-textarea, p[data-placeholder="Ask anything"]',
      this.baseTimeout
    );
    
    const editableContainer = input.id === 'prompt-textarea' ? input : input.parentElement;
    editableContainer.focus();
    editableContainer.textContent = prompt;
    editableContainer.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

    await new Promise(resolve => setTimeout(resolve, 200)); // A brief, stable pause.

    // --- THE CORE FIX: SIMPLIFIED SUBMISSION ---
    // We will now prioritize the Enter key, as it's proven to be more reliable
    // than hunting for a button that might be slow to enable.
    try {
      const button = document.querySelector('button[data-testid="send-button"]');
      if (button && !button.disabled) {
        button.click();
      } else {
        throw new Error("Button not immediately available.");
      }
    } catch (e) {
      console.warn("ChatGPT button not clicked, using reliable Enter key press.");
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, shiftKey: false });
      editableContainer.dispatchEvent(enterEvent);
    }
    
    // The broadcast function's only job is to send. We will not add validation here.
    // The validation will be handled entirely by the ContentStateDetector during the harvest phase.
    // This completely eliminates the race condition.
  }
}