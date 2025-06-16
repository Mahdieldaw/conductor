// src/content/providers/Claude.js
import { waitForElement } from '../primitives/helpers.js';
import { BaseProvider } from './BaseProvider.js';

export class ClaudeAsk extends BaseProvider {
  constructor() {
    super({ baseTimeout: 10000 });
  }

  // The static broadcast method now directly calls the instance method. No retry.
  static async broadcast(prompt) {
    const instance = new ClaudeAsk();
    return instance._broadcast(prompt);
  }

  async _broadcast(prompt) {
    const input = await waitForElement('div.ProseMirror', this.baseTimeout);
    input.focus();

    // --- ATOMIC FIX ---
    // Using selectAll and delete ensures the input is clean before inserting.
    document.execCommand('selectAll', false, undefined);
    document.execCommand('delete', false, undefined);
    document.execCommand('insertText', false, prompt);

    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Use the robust try/catch fallback for submission
    try {
      const button = await waitForElement('button[aria-label*="Send message" i]:not(:disabled)', 3000);
      button.click();
    } catch (e) {
      console.warn("Could not click send button on Claude, falling back to Enter key press.");
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, shiftKey: false });
      input.dispatchEvent(enterEvent);
    }
  }
}