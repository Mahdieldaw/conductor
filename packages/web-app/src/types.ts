// Describes the static configuration for an AI provider
export interface ProviderConfig {
  id: string;
  name: string;
  logoColor: string;
}

// Describes the live status of a provider, including its static config
export interface Provider extends ProviderConfig {
  status: 'ready' | 'offline' | 'busy' | 'error';
}

// Describes the state of a response from a single provider
export interface ResponseState {
  status: 'pending' | 'completed' | 'error';
  data?: string;
  error?: string;
}

// Describes the entire state of the prompt and its execution
export interface PromptState {
  text: string;
  targetProviders: string[];
  status: 'composing' | 'executing' | 'completed' | 'error';
  responses: Map<string, ResponseState>;
}
