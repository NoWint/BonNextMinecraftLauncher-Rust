import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react';
import type { ChatMessage as ChatMessageType, AIConfig, Task } from '../ai/types';
import { DEFAULT_AI_CONFIG } from '../ai/types';
import { getCommand } from '../ai/commands';
import { taskQueue } from '../ai/taskQueue';
import { workflowApi } from '../api/workflow';
import type { WorkflowProgressEvent, WorkflowErrorEvent, WorkflowCompleteEvent, CrashDetectedEvent } from '../api/types';
import { PiAgent } from '../ai/pi/agent';
import { requestConfirmation } from '../ai/pi/session';
import type { PiEvent } from '../ai/pi/types';

interface AIAssistantState {
  messages: ChatMessageType[];
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  config: AIConfig;
  tasks: Record<string, Task>;
  activeWorkflows: Record<string, { id: string; step: number; totalSteps: number; stepName: string }>;
  crashAlert: { instanceId: string; crashReportPath: string; severity: string } | null;
  piAgent: PiAgent | null;
}

type AIAssistantAction =
  | { type: 'ADD_MESSAGE'; message: ChatMessageType }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<ChatMessageType> }
  | { type: 'SET_OPEN'; isOpen: boolean }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_CONFIG'; config: AIConfig }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'UPDATE_WORKFLOW'; payload: { id: string; step: number; totalSteps: number; stepName: string } }
  | { type: 'REMOVE_WORKFLOW'; id: string }
  | { type: 'SET_CRASH_ALERT'; payload: { instanceId: string; crashReportPath: string; severity: string } | null }
  | { type: 'SET_PI_AGENT'; agent: PiAgent | null };

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
  activeWorkflows: {},
  crashAlert: null,
  piAgent: null,
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
    case 'UPDATE_WORKFLOW':
      return {
        ...state,
        activeWorkflows: { ...state.activeWorkflows, [action.payload.id]: action.payload },
      };
    case 'REMOVE_WORKFLOW': {
      const { [action.id]: _, ...rest } = state.activeWorkflows;
      return { ...state, activeWorkflows: rest };
    }
    case 'SET_CRASH_ALERT':
      return { ...state, crashAlert: action.payload };
    case 'SET_PI_AGENT':
      return { ...state, piAgent: action.agent };
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
  dismissCrashAlert: () => void;
  abortWorkflow: (workflowId: string) => void;
  abortAgent: () => void;
} | null>(null);

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(aiAssistantReducer, initialState);
  const tasksRef = useRef(state.tasks);
  tasksRef.current = state.tasks;
  const currentStreamMsgIdRef = useRef<string | null>(null);

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
    if (state.piAgent) {
      state.piAgent.clearHistory();
    }
  }, [state.piAgent]);

  const dismissCrashAlert = useCallback(() => {
    dispatch({ type: 'SET_CRASH_ALERT', payload: null });
  }, []);

  const abortWorkflow = useCallback(async (workflowId: string) => {
    try { await workflowApi.abortWorkflow(workflowId); dispatch({ type: 'REMOVE_WORKFLOW', id: workflowId }); } catch { /* ignore */ }
  }, []);

  const abortAgent = useCallback(() => {
    if (state.piAgent) {
      state.piAgent.abort();
    }
  }, [state.piAgent]);

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

  const sendMessageViaPi = useCallback(
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

      currentStreamMsgIdRef.current = null;

      const agent = new PiAgent({
        llmConfig: state.config,
        maxRounds: 15,
        confirmHighRisk: true,
        onEvent: (event: PiEvent) => {
          switch (event.type) {
            case 'agent_start':
              dispatch({ type: 'SET_LOADING', isLoading: true });
              break;
            case 'text_delta': {
              const existingId = currentStreamMsgIdRef.current;
              if (existingId) {
                dispatch({ type: 'UPDATE_MESSAGE', id: existingId, updates: { content: event.content } });
              } else {
                const newId = nextMessageId();
                currentStreamMsgIdRef.current = newId;
                dispatch({
                  type: 'ADD_MESSAGE',
                  message: {
                    id: newId, role: 'assistant', content: event.content,
                    commands: [], timestamp: Date.now(), isStreaming: true,
                  },
                });
              }
              break;
            }
            case 'text_complete': {
              const streamId = currentStreamMsgIdRef.current;
              if (streamId) {
                dispatch({ type: 'UPDATE_MESSAGE', id: streamId, updates: { isStreaming: false } });
                currentStreamMsgIdRef.current = null;
              }
              break;
            }
              case 'tool_call_start':
                dispatch({
                  type: 'UPDATE_TASK',
                  task: {
                    id: event.toolCallId,
                    command: event.toolName,
                    params: event.args,
                    riskLevel: event.isHighRisk ? 'high' : 'low',
                    status: 'executing',
                    messageId: '',
                    createdAt: Date.now(),
                  },
                });
                break;
              case 'tool_call_end': {
                const taskResult = event.isError
                  ? { success: false, error: String(event.result) }
                  : { success: true, data: event.result, message: '' };
                dispatch({
                  type: 'UPDATE_TASK',
                  task: {
                    id: event.toolCallId,
                    command: '',
                    params: {},
                    riskLevel: 'low',
                    status: event.isError ? 'failed' : 'completed',
                    result: taskResult,
                    messageId: '',
                    createdAt: Date.now(),
                  },
                });
                break;
              }
              case 'agent_end':
                dispatch({ type: 'SET_LOADING', isLoading: false });
                break;
              case 'error':
                dispatch({ type: 'SET_ERROR', error: event.message });
                dispatch({ type: 'SET_LOADING', isLoading: false });
                break;
            }
          },
          onConfirmTool: async (toolCallId, toolName, args) => {
            dispatch({
              type: 'UPDATE_TASK',
              task: {
                id: toolCallId, command: toolName, params: args,
                riskLevel: 'high', status: 'pending', messageId: '', createdAt: Date.now(),
              },
            });
            window.dispatchEvent(new CustomEvent('ai:confirm-required', {
              detail: { taskId: toolCallId, toolName, args },
            }));
            return requestConfirmation(toolCallId);
          },
        });

      try {
        await agent.run(text.trim());
      } catch (e) {
        dispatch({ type: 'SET_PI_AGENT', agent: null });
        dispatch({
          type: 'SET_ERROR',
          error: e instanceof Error ? e.message : 'Pi Agent failed',
        });
      }
    },
    [state.config, state.isLoading, state.piAgent],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      return sendMessageViaPi(text);
    },
    [sendMessageViaPi],
  );

  React.useEffect(() => {
    const unsubscribe = taskQueue.subscribe((task) => {
      dispatch({ type: 'UPDATE_TASK', task });
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      const u1 = await workflowApi.onWorkflowProgress((e: WorkflowProgressEvent) => {
        dispatch({ type: 'UPDATE_WORKFLOW', payload: { id: e.workflow_id, step: e.step, totalSteps: e.total_steps, stepName: e.step_name } });
      });
      unlisteners.push(u1);
      const u2 = await workflowApi.onWorkflowComplete((e: WorkflowCompleteEvent) => {
        dispatch({ type: 'REMOVE_WORKFLOW', id: e.workflow_id });
        dispatch({ type: 'ADD_MESSAGE', message: { id: nextMessageId(), role: 'assistant', content: e.result === 'success' ? `✅ Workflow completed!${e.instance_id ? ` Instance: ${e.instance_id}` : ''}` : '⚠️ Workflow finished with issues', commands: [], timestamp: Date.now() } });
      });
      unlisteners.push(u2);
      const u3 = await workflowApi.onWorkflowError((e: WorkflowErrorEvent) => {
        dispatch({ type: 'ADD_MESSAGE', message: { id: nextMessageId(), role: 'assistant', content: `❌ Workflow error (${e.step}): ${e.error}${e.recoverable ? ' — can retry' : ''}`, commands: [], timestamp: Date.now() } });
      });
      unlisteners.push(u3);
      const u4 = await workflowApi.onCrashDetected((e: CrashDetectedEvent) => {
        dispatch({ type: 'SET_CRASH_ALERT', payload: { instanceId: e.instance_id, crashReportPath: e.crash_report_path, severity: e.severity } });
      });
      unlisteners.push(u4);
    })();
    return () => { unlisteners.forEach((fn) => fn()); };
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
      dismissCrashAlert,
      abortWorkflow,
      abortAgent,
    }),
    [state, sendMessage, togglePanel, setPanelOpen, updateConfig, confirmTask, cancelTask, retryTask, clearMessages, dismissCrashAlert, abortWorkflow, abortAgent],
  );

  return <AIAssistantContext.Provider value={contextValue}>{children}</AIAssistantContext.Provider>;
}

export function useAIAssistant() {
  const ctx = useContext(AIAssistantContext);
  if (!ctx) throw new Error('useAIAssistant must be used within AIAssistantProvider');
  return ctx;
}
