// Anthropic Claude Provider Implementation

import { BaseAIProvider } from "./base";
import { AIGenerationOptions } from "../types";

export class AnthropicProvider extends BaseAIProvider {
  name = "anthropic";
  models = ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"];
  
  private baseURL: string;
  
  constructor(
    apiKey: string,
    defaultModel: string = "claude-3-sonnet-20240229",
    baseURL: string = "https://api.anthropic.com/v1"
  ) {
    super(apiKey, defaultModel);
    this.baseURL = baseURL;
  }
  
  protected async callAPI(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions
  ): Promise<string> {
    const response = await fetch(`${this.baseURL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: options.model || this.defaultModel,
        system: systemPrompt,
        messages: [
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
        `Anthropic API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }
    
    const data = await response.json();
    
    if (!data.content || data.content.length === 0) {
      throw new Error("No response from Anthropic");
    }
    
    // Claude returns content as an array of content blocks
    return data.content[0].text;
  }
}
