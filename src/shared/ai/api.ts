import type {
  AIConfig,
  ChatCompletionMessage,
  ChatCompletionResponse,
  ToolCall,
  StreamChunk,
  OpenAITool,
} from './types';

export interface StreamResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string;
}

export async function chatCompletion(
  config: AIConfig,
  messages: ChatCompletionMessage[],
  tools: OpenAITool[],
): Promise<ChatCompletionResponse> {
  const body: Record<string, unknown> = {
    model: config.model || undefined,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    stream: false,
  };

  const response = await fetch(config.api_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI API error: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`);
  }

  return response.json();
}

export async function streamChatCompletion(
  config: AIConfig,
  messages: ChatCompletionMessage[],
  tools: OpenAITool[],
  onContent: (text: string) => void,
): Promise<StreamResult> {
  const body: Record<string, unknown> = {
    model: config.model || undefined,
    messages,
    tools: tools.length > 0 ? tools : undefined,
    stream: true,
  };

  const response = await fetch(config.api_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI API error: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let finishReason = '';
  const toolCallMap = new Map<number, ToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const chunk: StreamChunk = JSON.parse(trimmed.slice(6));
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        if (choice.delta?.content) {
          fullContent += choice.delta.content;
          onContent(choice.delta.content);
        }

        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallMap.has(idx)) {
              toolCallMap.set(idx, {
                id: tc.id || '',
                type: 'function',
                function: { name: '', arguments: '' },
              });
            }
            const existing = toolCallMap.get(idx)!;
            if (tc.id) existing.id = tc.id;
            if (tc.type) existing.type = tc.type as 'function';
            if (tc.function?.name) existing.function.name += tc.function.name;
            if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  const toolCalls = Array.from(toolCallMap.values()).filter((tc) => tc.id && tc.function.name);

  return { content: fullContent, toolCalls, finishReason };
}

export async function testConnection(config: AIConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(config.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        model: config.model || undefined,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      }),
    });

    if (response.ok) {
      return { ok: true, message: 'Connection successful' };
    }
    const text = await response.text().catch(() => '');
    return { ok: false, message: `HTTP ${response.status}: ${text.slice(0, 100)}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
  }
}
