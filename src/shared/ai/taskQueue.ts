import type { Task, CommandResult } from './types';
import { getCommand } from './commands';

type TaskListener = (task: Task) => void;

class TaskQueue {
  private queue: Task[] = [];
  private running = false;
  private listeners: Set<TaskListener> = new Set();

  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(task: Task) {
    this.listeners.forEach((fn) => fn({ ...task }));
  }

  enqueue(task: Task): void {
    this.queue.push(task);
    this.notify(task);
    this.processNext();
  }

  confirm(taskId: string): void {
    const task = this.queue.find((t) => t.id === taskId);
    if (task && task.status === 'pending' && task.riskLevel === 'high') {
      task.status = 'confirmed';
      this.notify(task);
      this.processNext();
    }
  }

  cancel(taskId: string): void {
    const idx = this.queue.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
    }
  }

  getTask(taskId: string): Task | undefined {
    return this.queue.find((t) => t.id === taskId);
  }

  getPendingHighRiskTasks(): Task[] {
    return this.queue.filter((t) => t.status === 'pending' && t.riskLevel === 'high');
  }

  private async processNext(): Promise<void> {
    if (this.running) return;

    const task = this.queue.find((t) => t.status === 'confirmed' || (t.status === 'pending' && t.riskLevel === 'low'));

    if (!task) return;

    this.running = true;
    task.status = 'executing';
    this.notify(task);

    try {
      const cmd = getCommand(task.command);
      if (!cmd) {
        task.status = 'failed';
        task.result = { success: false, error: `Unknown command: ${task.command}` };
      } else {
        const result: CommandResult = await cmd.execute(task.params);
        task.status = result.success ? 'completed' : 'failed';
        task.result = result;
      }
    } catch (e) {
      task.status = 'failed';
      task.result = { success: false, error: e instanceof Error ? e.message : 'Execution failed' };
    }

    this.notify(task);

    const idx = this.queue.indexOf(task);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
    }

    this.running = false;
    this.processNext();
  }
}

export const taskQueue = new TaskQueue();
