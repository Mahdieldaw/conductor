// src/content/providers/ProviderFactory.js
import { ChatGPTAsk } from './ChatGPT.js';
import { ClaudeAsk } from './Claude.js';

export class ProviderFactory {
  static getProvider(hostname) {
    // This map provides a single place to manage which domains map to which provider classes.
    const providerMap = {
      'chat.openai.com': ChatGPTAsk,
      'chatgpt.com': ChatGPTAsk,
      'claude.ai': ClaudeAsk,
      'console.anthropic.com': ClaudeAsk
    };

    // Find a match based on the hostname including the key.
    const matchingKey = Object.keys(providerMap).find(key => hostname.includes(key));
    const Provider = providerMap[matchingKey];

    if (!Provider) {
      throw new Error(`No provider found for hostname: ${hostname}`);
    }

    return Provider;
  }

  static async broadcast(hostname, prompt) {
    const Provider = this.getProvider(hostname);
    // The static broadcast method on the provider will handle creating an instance and running.
    return Provider.broadcast(prompt);
  }
}