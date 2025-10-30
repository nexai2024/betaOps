// OpenAI Provider Implementation

import { BaseAIProvider } from "./base";
import { AIGenerationOptions } from "../types";

export class OpenAIProvider extends BaseAIProvider {
  name = "openai";
  models = ["gpt-4", "gpt-4-turbo-preview", "gpt-3.5-turbo"];
  
  private baseURL: string;
  
  constructor(
    apiKey: string,
    defaultModel: string = "gpt-4-turbo-preview",
    baseURL: string = "https://api.openai.com/v1"
  ) {
    super(apiKey, defaultModel);
    this.baseURL = baseURL;
  }
  
  protected async callAPI(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions
  ): Promise<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
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
        response_format: { type: "json_object" },
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `OpenAI API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }
    
    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI");
    }
    
    return data.choices[0].message.content;
  }
}
