import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';

/**
 * Anthropic APIクライアントのシングルトンインスタンス
 */
let client: Anthropic | null = null;

/**
 * Anthropic APIクライアントを取得
 */
export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * AIにメッセージを送信して応答を取得
 */
export async function sendMessage(
  systemPrompt: string,
  userMessage: string,
  model: string = 'claude-haiku-4-5-20251001',
  maxTokens: number = 2048
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  throw new Error('Unexpected response type from API');
}

/**
 * 構造化出力を使ってAIにメッセージを送信
 */
export async function sendStructuredMessage<T extends z.ZodType>(
  systemPrompt: string,
  userMessage: string,
  schema: T,
  model: string = 'claude-haiku-4-5-20251001',
  maxTokens: number = 2048
): Promise<z.infer<T>> {
  const client = getClient();

  const response = await client.beta.messages.parse({
    betas: ['structured-outputs-2025-11-13'],
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
    output_format: betaZodOutputFormat(schema),
  });

  if (response.parsed_output) {
    return response.parsed_output;
  }

  throw new Error('Failed to parse structured output from API');
}
