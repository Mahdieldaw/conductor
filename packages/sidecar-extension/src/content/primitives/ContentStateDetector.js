// src/content/primitives/ContentStateDetector.js
export class ContentStateDetector {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      checkInterval: config.checkInterval || 500,
      ...config
    };
  }

  async waitForCompletion(hostname) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.config.timeout) {
      if (await this.isResponseComplete(hostname)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, this.config.checkInterval));
    }
    
    throw new Error(`Response completion not detected within ${this.config.timeout}ms`);
  }

  async isResponseComplete(hostname) {
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
      return this.isChatGPTComplete();
    } else if (hostname.includes('claude.ai') || hostname.includes('console.anthropic.com')) {
      return this.isClaudeComplete();
    }
    
    return false;
  }

  isChatGPTComplete() {
    // Check if ChatGPT is still generating (look for stop button or streaming indicators)
    const stopButton = document.querySelector('button[data-testid="stop-button"]');
    const streamingIndicator = document.querySelector('[data-testid="streaming"]');
    const thinkingIndicator = document.querySelector('[data-testid="thinking"]');
    
    // If no stop button and no streaming indicators, response is likely complete
    return !stopButton && !streamingIndicator && !thinkingIndicator;
  }

  isClaudeComplete() {
    // Check if Claude is still generating
    const stopButton = document.querySelector('button[aria-label*="Stop" i]');
    const streamingText = document.querySelector('[data-is-streaming="true"]');
    
    // Look for the typical "thinking" or generating states
    const thinkingIndicator = document.querySelector('.animate-pulse');
    
    return !stopButton && !streamingText && !thinkingIndicator;
  }

  async harvest(hostname) {
    // Wait for completion first
    await this.waitForCompletion(hostname);
    
    // Then extract the latest response
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
      return this.harvestChatGPT();
    } else if (hostname.includes('claude.ai') || hostname.includes('console.anthropic.com')) {
      return this.harvestClaude();
    }
    
    throw new Error(`No harvester available for hostname: ${hostname}`);
  }

  harvestChatGPT() {
    // Get the latest assistant message
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (messages.length === 0) {
      throw new Error('No assistant messages found');
    }
    
    const latestMessage = messages[messages.length - 1];
    return latestMessage.textContent.trim();
  }

  harvestClaude() {
    // Get the latest Claude response
    const messages = document.querySelectorAll('[data-is-streaming], .font-claude-message');
    if (messages.length === 0) {
      // Fallback: look for any message-like content
      const messageContainers = document.querySelectorAll('div[class*="message"], div[class*="response"]');
      if (messageContainers.length === 0) {
        throw new Error('No Claude messages found');
      }
      const latestMessage = messageContainers[messageContainers.length - 1];
      return latestMessage.textContent.trim();
    }
    
    const latestMessage = messages[messages.length - 1];
    return latestMessage.textContent.trim();
  }
}