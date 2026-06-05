import type { ChatCompletionMessage } from '../types';

const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 120000;
const DEFAULT_THRESHOLD = 0.8;

export function estimateTokens(messages: ChatCompletionMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += (msg.content?.length || 0) + 4;
    if ('tool_calls' in msg && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        totalChars += tc.function.name.length + tc.function.arguments.length;
      }
    }
  }
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

export function shouldCompact(
  messages: ChatCompletionMessage[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
  threshold: number = DEFAULT_THRESHOLD,
): boolean {
  return estimateTokens(messages) > maxTokens * threshold;
}

export function compactMessages(
  messages: ChatCompletionMessage[],
  keepRecent: number = 6,
): ChatCompletionMessage[] {
  if (messages.length <= keepRecent + 1) return messages;

  const system = messages[0];
  if (system?.role !== 'system') return messages;

  const toCompact = messages.slice(1, -(keepRecent));
  const recent = messages.slice(-(keepRecent));

  let summary = '[Earlier conversation summary]\n';
  for (const msg of toCompact) {
    if (msg.role === 'user') {
      summary += `User: ${(msg.content || '').slice(0, 100)}\n`;
    } else if (msg.role === 'assistant' && msg.content) {
      summary += `Assistant: ${msg.content.slice(0, 150)}\n`;
    } else if (msg.role === 'tool') {
      summary += `Tool result: ${(msg.content || '').slice(0, 80)}\n`;
    }
  }

  return [
    system,
    { role: 'user' as const, content: `[System: Previous context compacted]\n${summary}` },
    ...recent,
  ];
}
