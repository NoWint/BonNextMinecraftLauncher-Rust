// src/plugins/core/EventBus.ts
import type { PluginEventBus } from './types';

export class EventBus implements PluginEventBus {
  private handlers = new Map<string, Set<(data: unknown) => void>>();

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(data);
      } catch (e) {
        console.error(`[EventBus] Handler error for event "${event}":`, e);
      }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}
