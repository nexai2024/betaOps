// Google Gemini Provider Implementation

import { BaseAIProvider } from "./base";
import { AIGenerationOptions } from "../types";

export class GeminiProvider extends BaseAIProvider {
  name = "gemini";
  models = [
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.0-pro",
  ];
  
  private baseURL: string;
  
  constructor(
    apiKey: string,
    defaultModel: string = "gemini-1.5-pro",
    baseURL: string = "https://generativelanguage.googleapis.com/v1beta"
  ) {
    super(apiKey, defaultModel);
    this.baseURL = baseURL;
  }
  
  protected async callAPI(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions
  ): Promise<string> {
    const model = options.model || this.defaultModel;
    
    // Gemini API endpoint
    const url = `${this.baseURL}/models/${model}:generateContent?key=${this.apiKey}`;
    
    // Combine system prompt and user prompt for Gemini
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topP: options.topP || 1.0,
          maxOutputTokens: options.maxTokens || 4000,
          responseMimeType: "application/json",
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(
        `Gemini API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }
    
    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini");
    }
    
    const candidate = data.candidates[0];
    
    // Check for safety blocks
    if (candidate.finishReason === "SAFETY") {
      throw new Error(
        "Response blocked by Gemini safety filters: " +
          JSON.stringify(candidate.safetyRatings)
      );
    }
    
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error("Invalid response structure from Gemini");
    }
    
    return candidate.content.parts[0].text;
  }
  
  /**
   * Alternative method using the REST API with streaming support
   */
  protected async callAPIStreaming(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions
  ): Promise<string> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseURL}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topP: options.topP || 1.0,
          maxOutputTokens: options.maxTokens || 4000,
          responseMimeType: "application/json",
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    // For now, collect all chunks and return the complete response
    // In a real streaming implementation, you'd handle this differently
    let fullText = "";
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error("No response body");
    }
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((line) => line.trim());
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
              fullText += json.candidates[0].content.parts[0].text;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    
    return fullText;
  }
}
