import type { ChatCompletionMessage, AIConfig } from '../types';

export interface PiTool {
  name: string;
  description: string;
  riskLevel: 'low' | 'high';
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface PiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface PiToolResult {
  toolCallId: string;
  toolName: string;
  content: string;
  isError: boolean;
}

export type PiEvent =
  | { type: 'agent_start' }
  | { type: 'text_delta'; content: string }
  | { type: 'text_complete' }
  | { type: 'tool_call_start'; toolCallId: string; toolName: string; args: Record<string, unknown>; isHighRisk: boolean }
  | { type: 'tool_call_end'; toolCallId: string; result: unknown; isError: boolean }
  | { type: 'agent_end' }
  | { type: 'error'; message: string };

export type PiEventHandler = (event: PiEvent) => void;

export interface PiAgentConfig {
  llmConfig: AIConfig;
  maxRounds: number;
  confirmHighRisk: boolean;
  onEvent: PiEventHandler;
  onConfirmTool?: (toolCallId: string, toolName: string, args: Record<string, unknown>) => Promise<boolean>;
}

export interface PiSessionState {
  messages: ChatCompletionMessage[];
  createdAt: number;
  updatedAt: number;
  roundCount: number;
}

export interface PiCompactionConfig {
  enabled: boolean;
  maxTokens: number;
  threshold: number;
}
