// Local AI Provider (Ollama, LM Studio, etc.)

import { BaseAIProvider } from "./base";
import { AIGenerationOptions } from "../types";

export class LocalProvider extends BaseAIProvider {
  name = "local";
  models: string[];
  
  private baseURL: string;
  
  constructor(
    apiKey: string = "not-needed",
    defaultModel: string = "llama2",
    baseURL: string = "http://localhost:11434",
    models: string[] = ["llama2", "codellama", "mistral"]
  ) {
    super(apiKey, defaultModel);
    this.baseURL = baseURL;
    this.models = models;
  }
  
  protected async callAPI(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions
  ): Promise<string> {
    // Try Ollama format first
    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        prompt: `${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1.0,
        stream: false,
        options: {
          num_predict: options.maxTokens || 4000,
        },
      }),
    });
    
    if (!response.ok) {
      // Try OpenAI-compatible format (LM Studio, etc.)
      return this.callOpenAICompatibleAPI(prompt, systemPrompt, options);
    }
    
    const data = await response.json();
    
    if (!data.response) {
      throw new Error("No response from local model");
    }
    
    return data.response;
  }
  
  private async callOpenAICompatibleAPI(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions
  ): Promise<string> {
    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1.0,
        max_tokens: options.maxTokens || 4000,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Local AI API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from local model");
    }
    
    return data.choices[0].message.content;
  }
}
