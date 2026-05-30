interface ServiceEntry {
  service: unknown;
  providerPluginId: string;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceEntry>();

  provide(id: string, service: unknown, providerPluginId: string): void {
    if (this.services.has(id)) {
      throw new Error(`Service "${id}" is already provided by "${this.services.get(id)!.providerPluginId}"`);
    }
    this.services.set(id, { service, providerPluginId });
  }

  consume(id: string): unknown {
    return this.services.get(id)?.service;
  }

  revoke(id: string, providerPluginId: string): void {
    const entry = this.services.get(id);
    if (!entry) return;
    if (entry.providerPluginId !== providerPluginId) {
      throw new Error(`Plugin "${providerPluginId}" is not the provider of service "${id}"`);
    }
    this.services.delete(id);
  }

  revokeAllForPlugin(pluginId: string): void {
    for (const [id, entry] of this.services) {
      if (entry.providerPluginId === pluginId) {
        this.services.delete(id);
      }
    }
  }

  isAvailable(id: string): boolean {
    return this.services.has(id);
  }
}
