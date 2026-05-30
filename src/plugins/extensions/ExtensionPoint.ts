export interface ExtensionPointEvent<T = unknown> {
  type: 'contribute' | 'retract';
  contribution: T;
  pluginId?: string;
}

export abstract class ExtensionPointBase<T = unknown> {
  abstract readonly id: string;
  abstract readonly name: string;
  private contributions: T[] = [];
  private listeners: Array<(event: ExtensionPointEvent<T>) => void> = [];

  onContribute(contribution: T): void {
    this.contributions.push(contribution);
    this.notify({ type: 'contribute', contribution });
  }

  onRetract(contribution: T): void {
    const idx = this.contributions.indexOf(contribution);
    if (idx !== -1) {
      this.contributions.splice(idx, 1);
    }
    this.notify({ type: 'retract', contribution });
  }

  getContributions(): T[] {
    return [...this.contributions];
  }

  addListener(listener: (event: ExtensionPointEvent<T>) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private notify(event: ExtensionPointEvent<T>): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
