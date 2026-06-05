import type { ChatCompletionMessage } from '../types';
import type { PiSessionState } from './types';
import { PiAgent } from './agent';
import type { PiAgentConfig } from './types';

const pendingConfirmations = new Map<string, (approved: boolean) => void>();

export function requestConfirmation(toolCallId: string): Promise<boolean> {
  return new Promise((resolve) => {
    pendingConfirmations.set(toolCallId, resolve);
  });
}

export function resolveConfirmation(toolCallId: string, approved: boolean): void {
  const resolver = pendingConfirmations.get(toolCallId);
  if (!resolver) return;
  pendingConfirmations.delete(toolCallId);
  resolver(approved);
}

export interface PiSessionHandle {
  agent: PiAgent;
  getState(): PiSessionState;
  dispose(): void;
}

export function createPiSession(
  agentConfig: PiAgentConfig,
  existingMessages?: ChatCompletionMessage[],
): PiSessionHandle {
  const agent = new PiAgent(agentConfig, existingMessages);
  const createdAt = Date.now();

  return {
    agent,
    getState(): PiSessionState {
      return {
        messages: agent.getMessages(),
        createdAt,
        updatedAt: Date.now(),
        roundCount: 0,
      };
    },
    dispose() {
      agent.abort();
    },
  };
}
