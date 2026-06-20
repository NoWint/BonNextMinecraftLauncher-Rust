export interface AIConfig {
  api_url: string;
  api_key: string;
  model: string;
  enabled: boolean;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  api_url: 'http://127.0.0.1:7860/v1/chat/completions',
  api_key: 'sk-1293552f2335a1260689c84c55a7b4ee74cf74ef186b2422',
  model: '',
  enabled: true,
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  commands: ParsedCommand[];
  timestamp: number;
  isStreaming?: boolean;
  toolCallId?: string;
}

export interface ParsedCommand {
  id: string;
  command: string;
  params: Record<string, unknown>;
  risk_level: 'low' | 'high';
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Task {
  id: string;
  command: string;
  params: Record<string, unknown>;
  riskLevel: 'low' | 'high';
  status: 'pending' | 'confirmed' | 'executing' | 'completed' | 'failed';
  result?: CommandResult;
  messageId: string;
  createdAt: number;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
}

export type ChatCompletionMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
}

export interface StreamChunk {
  id: string;
  object: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export interface ModpackPlan {
  plan_id: string;
  theme: string;
  game_version: string;
  loader: { loader_type: string; version: string };
  mods: Array<{
    slug: string;
    name: string;
    version_id: string;
    source: string;
    category: string;
    required: boolean;
  }>;
  jvm_config: { max_memory_mb: number; min_memory_mb: number; jvm_args: string };
  estimated_size_mb: number;
  warnings: Array<{ warning_type: string; message: string }>;
}

export interface CompatibilityReport {
  conflicts: Array<{ mod_a: string; mod_b: string; reason: string; severity: string }>;
  missing_deps: Array<{ mod_slug: string; required_by: string }>;
  warnings: Array<{ mod_slug: string; issue: string }>;
  score: number;
}
