import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react';
import type { ChatMessage as ChatMessageType, AIConfig, Task, ChatCompletionMessage, ToolCall } from '../ai/types';
import { DEFAULT_AI_CONFIG } from '../ai/types';
import { streamChatCompletion } from '../ai/api';
import { buildOpenAITools, buildSystemPrompt, parseToolCallsToCommands, getCommand } from '../ai/commands';
import { taskQueue } from '../ai/taskQueue';

interface AIAssistantState {
  messages: ChatMessageType[];
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  config: AIConfig;
  tasks: Record<string, Task>;
}

type AIAssistantAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessageType }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<ChatMessageType> }
  | { type: 'SET_OPEN'; isOpen: boolean }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_CONFIG'; config: AIConfig }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'CLEAR_MESSAGES' };

const STORAGE_KEY = 'bonnext_ai_config';

function loadStoredConfig(): AIConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_AI_CONFIG, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_AI_CONFIG;
}

function saveConfigToStorage(config: AIConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

let messageIdCounter = 0;
function nextMessageId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

const initialState: AIAssistantState = {
  messages: [],
  isOpen: false,
  isLoading: false,
  error: '',
  config: loadStoredConfig(),
  tasks: {},
};

export function aiAssistantReducer(state: AIAssistantState, action: AIAssistantAction): AIAssistantState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.id ? { ...m, ...action.updates } : m)),
      };
    case 'SET_OPEN':
      return { ...state, isOpen: action.isOpen };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_CONFIG': {
      saveConfigToStorage(action.config);
      return { ...state, config: action.config };
    }
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: { ...state.tasks, [action.task.id]: action.task },
      };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    default:
      return state;
  }
}

const AIAssistantContext = createContext<{
  state: AIAssistantState;
  sendMessage: (text: string) => Promise<void>;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  updateConfig: (config: AIConfig) => void;
  confirmTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  clearMessages: () => void;
} | null>(null);

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(aiAssistantReducer, initialState);
  const tasksRef = useRef(state.tasks);
  tasksRef.current = state.tasks;

  const togglePanel = useCallback(() => {
    dispatch({ type: 'SET_OPEN', isOpen: !state.isOpen });
  }, [state.isOpen]);

  const setPanelOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_OPEN', isOpen: open });
  }, []);

  const updateConfig = useCallback((config: AIConfig) => {
    dispatch({ type: 'SET_CONFIG', config });
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const confirmTask = useCallback((taskId: string) => {
    const task = tasksRef.current[taskId];
    if (!task) return;

    const cmd = getCommand(task.command);
    if (!cmd) return;

    dispatch({
      type: 'UPDATE_TASK',
      task: { ...task, status: 'executing' },
    });

    cmd
      .execute(task.params)
      .then((result) => {
        const current = tasksRef.current[taskId] || task;
        dispatch({
          type: 'UPDATE_TASK',
          task: { ...current, status: result.success ? 'completed' : 'failed', result },
        });
        const resultMessage: ChatMessageType = {
          id: nextMessageId(),
          role: 'assistant',
          content: result.success
            ? result.message || `"${task.command}" completed`
            : result.error || `"${task.command}" failed`,
          commands: [],
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: resultMessage });
      })
      .catch((e: unknown) => {
        const current = tasksRef.current[taskId] || task;
        const errorResult = { success: false, error: e instanceof Error ? e.message : 'Execution failed' };
        dispatch({
          type: 'UPDATE_TASK',
          task: { ...current, status: 'failed', result: errorResult },
        });
        const resultMessage: ChatMessageType = {
          id: nextMessageId(),
          role: 'assistant',
          content: errorResult.error,
          commands: [],
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: resultMessage });
      });
  }, []);

  const cancelTask = useCallback((taskId: string) => {
    const existing = tasksRef.current[taskId];
    if (existing) {
      dispatch({
        type: 'UPDATE_TASK',
        task: { ...existing, status: 'failed', result: { success: false, error: 'Cancelled by user' } },
      });
    }
  }, []);

  const retryTask = useCallback((taskId: string) => {
    const existing = tasksRef.current[taskId];
    if (!existing) return;
    const cmd = getCommand(existing.command);
    if (!cmd) return;

    dispatch({
      type: 'UPDATE_TASK',
      task: { ...existing, status: 'executing' },
    });

    cmd
      .execute(existing.params)
      .then((result) => {
        const current = tasksRef.current[taskId] || existing;
        dispatch({
          type: 'UPDATE_TASK',
          task: { ...current, status: result.success ? 'completed' : 'failed', result },
        });
        const resultMessage: ChatMessageType = {
          id: nextMessageId(),
          role: 'assistant',
          content: result.success
            ? result.message || `"${existing.command}" completed`
            : result.error || `"${existing.command}" failed`,
          commands: [],
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: resultMessage });
      })
      .catch((e: unknown) => {
        const current = tasksRef.current[taskId] || existing;
        const errorResult = { success: false, error: e instanceof Error ? e.message : 'Execution failed' };
        dispatch({
          type: 'UPDATE_TASK',
          task: { ...current, status: 'failed', result: errorResult },
        });
        const resultMessage: ChatMessageType = {
          id: nextMessageId(),
          role: 'assistant',
          content: errorResult.error,
          commands: [],
          timestamp: Date.now(),
        };
        dispatch({ type: 'ADD_MESSAGE', message: resultMessage });
      });
  }, []);

  const executeToolCalls = useCallback(
    async (toolCalls: ToolCall[], assistantMessageId: string): Promise<ChatCompletionMessage[]> => {
      const toolMessages: ChatCompletionMessage[] = [];
      const commands = parseToolCallsToCommands(toolCalls);

      dispatch({
        type: 'UPDATE_MESSAGE',
        id: assistantMessageId,
        updates: { commands },
      });

      for (const tc of toolCalls) {
        const cmd = getCommand(tc.function.name);
        if (!cmd) {
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify({ success: false, error: `Unknown tool: ${tc.function.name}` }),
            tool_call_id: tc.id,
          });
          continue;
        }

        let params: Record<string, unknown>;
        try {
          params = JSON.parse(tc.function.arguments || '{}');
        } catch {
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify({ success: false, error: 'Invalid arguments' }),
            tool_call_id: tc.id,
          });
          continue;
        }

        const task: Task = {
          id: tc.id,
          command: tc.function.name,
          params,
          riskLevel: cmd.riskLevel,
          status: 'confirmed',
          messageId: assistantMessageId,
          createdAt: Date.now(),
        };
        dispatch({ type: 'UPDATE_TASK', task });

        try {
          dispatch({
            type: 'UPDATE_TASK',
            task: { ...task, status: 'executing' },
          });
          const result = await cmd.execute(params);
          dispatch({
            type: 'UPDATE_TASK',
            task: { ...task, status: result.success ? 'completed' : 'failed', result },
          });
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
          });
        } catch (e) {
          const errorResult = { success: false, error: e instanceof Error ? e.message : 'Execution failed' };
          dispatch({
            type: 'UPDATE_TASK',
            task: { ...task, status: 'failed', result: errorResult },
          });
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify(errorResult),
            tool_call_id: tc.id,
          });
        }
      }

      return toolMessages;
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || state.isLoading) return;
      if (!state.config.enabled) {
        dispatch({ type: 'SET_ERROR', error: 'AI Assistant is disabled. Enable it in Settings.' });
        return;
      }

      dispatch({ type: 'SET_ERROR', error: '' });

      const userMessage: ChatMessageType = {
        id: nextMessageId(),
        role: 'user',
        content: text.trim(),
        commands: [],
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_MESSAGE', message: userMessage });
      dispatch({ type: 'SET_LOADING', isLoading: true });

      const tools = buildOpenAITools();
      const systemPrompt = buildSystemPrompt();

      const apiMessages: ChatCompletionMessage[] = [
        { role: 'system', content: systemPrompt },
        ...[...state.messages, userMessage]
          .filter((m) => m.role !== 'system')
          .map((m) => {
            if (m.role === 'tool') {
              return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId || '' };
            }
            return { role: m.role as 'user' | 'assistant', content: m.content };
          }),
      ];

      const assistantMessageId = nextMessageId();
      const assistantMessage: ChatMessageType = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        commands: [],
        timestamp: Date.now(),
        isStreaming: true,
      };
      dispatch({ type: 'ADD_MESSAGE', message: assistantMessage });

      try {
        let accumulatedContent = '';

        let result = await streamChatCompletion(state.config, apiMessages, tools, (content) => {
          accumulatedContent += content;
          dispatch({
            type: 'UPDATE_MESSAGE',
            id: assistantMessageId,
            updates: { content: accumulatedContent },
          });
        });

        dispatch({
          type: 'UPDATE_MESSAGE',
          id: assistantMessageId,
          updates: { content: accumulatedContent || result.content, isStreaming: false },
        });

        // Multi-round tool execution loop: keep calling the model until it stops returning tool calls
        let maxRounds = 5;
        while (result.toolCalls.length > 0 && maxRounds > 0) {
          maxRounds--;
          apiMessages.push({
            role: 'assistant',
            content: result.content || null,
            tool_calls: result.toolCalls,
          });

          const toolResults = await executeToolCalls(result.toolCalls, assistantMessageId);
          apiMessages.push(...toolResults);

          // Ask the model to continue with the tool results
          let followUpContent = '';
          result = await streamChatCompletion(state.config, apiMessages, tools, (content) => {
            followUpContent += content;
          });

          // Only add a follow-up message if there's actual content or more tool calls
          if (followUpContent || result.content || result.toolCalls.length > 0) {
            const followUpId = nextMessageId();
            dispatch({
              type: 'ADD_MESSAGE',
              message: {
                id: followUpId,
                role: 'assistant',
                content: followUpContent || result.content || '',
                commands: [],
                timestamp: Date.now(),
                isStreaming: result.toolCalls.length === 0,
              },
            });

            // If no more tool calls, mark as final
            if (result.toolCalls.length === 0) {
              dispatch({
                type: 'UPDATE_MESSAGE',
                id: followUpId,
                updates: { isStreaming: false },
              });
            }
          }
        }
      } catch (e) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          id: assistantMessageId,
          updates: {
            content: 'Sorry, I encountered an error connecting to the AI service.',
            isStreaming: false,
          },
        });
        dispatch({
          type: 'SET_ERROR',
          error: e instanceof Error ? e.message : 'Failed to get AI response',
        });
      }

      dispatch({ type: 'SET_LOADING', isLoading: false });
    },
    [state.config, state.isLoading, state.messages, executeToolCalls],
  );

  React.useEffect(() => {
    const unsubscribe = taskQueue.subscribe((task) => {
      dispatch({ type: 'UPDATE_TASK', task });
    });
    return unsubscribe;
  }, []);

  const contextValue = useMemo(
    () => ({
      state,
      sendMessage,
      togglePanel,
      setPanelOpen,
      updateConfig,
      confirmTask,
      cancelTask,
      retryTask,
      clearMessages,
    }),
    [state, sendMessage, togglePanel, setPanelOpen, updateConfig, confirmTask, cancelTask, retryTask, clearMessages],
  );

  return <AIAssistantContext.Provider value={contextValue}>{children}</AIAssistantContext.Provider>;
}

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) throw new Error('useAIAssistant must be used within AIAssistantProvider');
  return ctx;
}
