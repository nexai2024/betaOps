// AI Provider Factory

import { AIProvider } from "./types";
import { OpenAIProvider, AnthropicProvider, LocalProvider } from "./providers";

export type ProviderType = "openai" | "anthropic" | "local";

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  defaultModel?: string;
  baseURL?: string;
}

export class AIProviderFactory {
  private static providers: Map<ProviderType, AIProvider> = new Map();
  
  static createProvider(config: ProviderConfig): AIProvider {
    const { type, apiKey, defaultModel, baseURL } = config;
    
    // Check cache first
    if (this.providers.has(type)) {
      return this.providers.get(type)!;
    }
    
    let provider: AIProvider;
    
    switch (type) {
      case "openai":
        if (!apiKey) {
          throw new Error("OpenAI API key is required");
        }
        provider = new OpenAIProvider(
          apiKey,
          defaultModel || "gpt-4-turbo-preview",
          baseURL
        );
        break;
        
      case "anthropic":
        if (!apiKey) {
          throw new Error("Anthropic API key is required");
        }
        provider = new AnthropicProvider(
          apiKey,
          defaultModel || "claude-3-sonnet-20240229",
          baseURL
        );
        break;
        
      case "local":
        provider = new LocalProvider(
          apiKey || "not-needed",
          defaultModel || "llama2",
          baseURL || "http://localhost:11434"
        );
        break;
        
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
    
    // Cache provider
    this.providers.set(type, provider);
    
    return provider;
  }
  
  static getProvider(type: ProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }
  
  static clearCache(): void {
    this.providers.clear();
  }
}

// Helper to get default provider from environment
export function getDefaultProvider(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || "openai") as ProviderType;
  
  const config: ProviderConfig = {
    type: providerType,
    apiKey: process.env.AI_API_KEY,
    defaultModel: process.env.AI_DEFAULT_MODEL,
    baseURL: process.env.AI_BASE_URL,
  };
  
  return AIProviderFactory.createProvider(config);
}
