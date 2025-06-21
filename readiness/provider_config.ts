// src/config/providers.ts
import type { ProviderConfig } from '../types';

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  { 
    id: 'chatgpt', 
    name: 'ChatGPT', 
    logoColor: '#10A37F',
    url: 'https://chat.openai.com'
  },
  { 
    id: 'claude', 
    name: 'Claude', 
    logoColor: '#D97706',
    url: 'https://claude.ai'
  },
  { 
    id: 'perplexity', 
    name: 'Perplexity', 
    logoColor: '#6B7280',
    url: 'https://perplexity.ai'
  },
  { 
    id: 'gemini', 
    name: 'Gemini', 
    logoColor: '#4F46E5',
    url: 'https://gemini.google.com'
  },
];

export const getProviderConfig = (id: string): ProviderConfig | undefined => {
  return PROVIDER_CONFIGS.find(config => config.id === id);
};