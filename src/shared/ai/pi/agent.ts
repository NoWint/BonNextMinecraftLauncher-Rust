import type { ChatCompletionMessage, ToolCall, OpenAITool } from '../types';
import { streamChatCompletion } from '../api';
import { buildOpenAITools, buildSystemPrompt } from '../commands';
import { piToolMap } from './tools';
import type { PiAgentConfig, PiToolResult } from './types';

export class PiAgent {
  private config: PiAgentConfig;
  private messages: ChatCompletionMessage[];
  private aborted = false;
  private running = false;
  private openaiTools: OpenAITool[];
  private abortController: AbortController | null = null;

  constructor(config: PiAgentConfig, existingMessages?: ChatCompletionMessage[]) {
    this.config = config;
    this.openaiTools = buildOpenAITools();
    if (existingMessages && existingMessages.length > 0) {
      this.messages = [...existingMessages];
    } else {
      this.messages = [{ role: 'system', content: buildSystemPrompt() }];
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  getMessages(): ChatCompletionMessage[] {
    return [...this.messages];
  }

  async run(userText: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.aborted = false;
    this.abortController = new AbortController();

    this.messages.push({ role: 'user', content: userText });
    this.config.onEvent({ type: 'agent_start' });

    try {
      for (let round = 0; round < this.config.maxRounds; round++) {
        if (this.aborted) break;

        const result = await this.callLLM();
        if (this.aborted) break;

        if (result.toolCalls.length > 0 && result.finishReason === 'tool_calls') {
          this.messages.push({
            role: 'assistant',
            content: result.content || null,
            tool_calls: result.toolCalls,
          });
        } else {
          this.messages.push({ role: 'assistant', content: result.content });
        }

        this.config.onEvent({ type: 'text_complete' });

        if (result.toolCalls.length === 0 || result.finishReason !== 'tool_calls') {
          break;
        }

        const toolResults = await this.executeTools(result.toolCalls);
        for (const tr of toolResults) {
          this.messages.push({
            role: 'tool',
            content: tr.content,
            tool_call_id: tr.toolCallId,
          });
        }

        if (this.aborted) break;
      }
    } catch (e) {
      if (!this.aborted) {
        let msg = e instanceof Error ? e.message : 'Agent error';
        if (msg === 'Failed to fetch' || msg.includes('ERR_CONNECTION_REFUSED')) {
          msg = 'Cannot connect to AI service. Please check your API URL and key in Settings.';
        }
        this.config.onEvent({ type: 'error', message: msg });
      }
    } finally {
      this.running = false;
      this.config.onEvent({ type: 'agent_end' });
    }
  }

  abort(): void {
    this.aborted = true;
    this.abortController?.abort();
  }

  clearHistory(): void {
    this.messages = [{ role: 'system', content: buildSystemPrompt() }];
  }

  private async callLLM(): Promise<{ content: string; toolCalls: ToolCall[]; finishReason: string }> {
    let fullContent = '';
    const result = await streamChatCompletion(
      this.config.llmConfig,
      this.messages,
      this.openaiTools,
      (delta) => {
        fullContent += delta;
        this.config.onEvent({ type: 'text_delta', content: fullContent });
      },
    );
    return { content: fullContent, toolCalls: result.toolCalls, finishReason: result.finishReason };
  }

  private async executeTools(toolCalls: ToolCall[]): Promise<PiToolResult[]> {
    const results: PiToolResult[] = [];

    for (const tc of toolCalls) {
      if (this.aborted) break;

      const toolName = tc.function.name;
      const toolCallId = tc.id;
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

      const tool = piToolMap.get(toolName);
      if (!tool) {
        const content = JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
        results.push({ toolCallId, toolName, content, isError: true });
        this.config.onEvent({ type: 'tool_call_end', toolCallId, result: `Unknown tool: ${toolName}`, isError: true });
        continue;
      }

      const isHighRisk = tool.riskLevel === 'high';
      this.config.onEvent({ type: 'tool_call_start', toolCallId, toolName, args, isHighRisk });

      if (isHighRisk && this.config.confirmHighRisk && this.config.onConfirmTool) {
        const approved = await this.config.onConfirmTool(toolCallId, toolName, args);
        if (!approved) {
          const content = JSON.stringify({ success: false, error: 'User denied this operation' });
          results.push({ toolCallId, toolName, content, isError: true });
          this.config.onEvent({ type: 'tool_call_end', toolCallId, result: 'User denied this operation', isError: true });
          continue;
        }
      }

      try {
        const execResult = await tool.execute(args);
        const content = JSON.stringify(execResult);
        results.push({ toolCallId, toolName, content, isError: false });
        this.config.onEvent({ type: 'tool_call_end', toolCallId, result: execResult, isError: false });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Tool execution failed';
        const content = JSON.stringify({ success: false, error: errMsg });
        results.push({ toolCallId, toolName, content, isError: true });
        this.config.onEvent({ type: 'tool_call_end', toolCallId, result: errMsg, isError: true });
      }
    }

    return results;
  }
}
