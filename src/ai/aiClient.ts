import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

export interface AIConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  isLiveConfigured: boolean;
}

/**
 * Dual-mode OpenAI-compatible client configuration:
 * - Local developer default: Ollama (`http://localhost:11434/v1`, `qwen2.5-coder:7b`)
 * - GitHub Actions CI mode: Groq (`https://api.groq.com/openai/v1`, `llama-3.3-70b-versatile`)
 */
export function getAIConfig(): AIConfig {
  const baseURL = (process.env.AI_BASE_URL || 'http://localhost:11434/v1').trim();
  const apiKey = (process.env.AI_API_KEY || 'ollama').trim();
  const model = (process.env.AI_MODEL || 'qwen2.5-coder:7b').trim();

  const isGroq = baseURL.includes('groq.com');
  const isLiveConfigured = isGroq ? apiKey.length > 0 && apiKey !== 'ollama' : true;

  return {
    baseURL,
    apiKey: apiKey || 'ollama',
    model,
    isLiveConfigured,
  };
}

export const aiClient = new OpenAI({
  baseURL: getAIConfig().baseURL,
  apiKey: getAIConfig().apiKey,
  timeout: 20_000,
  maxRetries: 1,
});

export interface StructuredPromptOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

/**
 * Executes a JSON-enforced completion request against either Ollama or Groq,
 * stripping optional markdown code fences before parsing.
 */
export async function completeJSON<T>(options: StructuredPromptOptions): Promise<T> {
  const config = getAIConfig();
  if (!config.isLiveConfigured) {
    throw new Error(
      `AI provider (${config.baseURL}) requires a valid AI_API_KEY environment variable.`
    );
  }

  const response = await aiClient.chat.completions.create({
    model: config.model,
    temperature: options.temperature ?? 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ],
  });

  const rawContent = response.choices[0]?.message?.content?.trim() || '{}';
  const cleanedJson = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  return JSON.parse(cleanedJson) as T;
}
