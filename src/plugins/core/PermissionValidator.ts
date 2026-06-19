// src/plugins/core/PermissionValidator.ts
export class PermissionValidator {
  private httpDomains = new Set<string>();
  private fsReadScopes = new Set<string>();
  private fsWriteScopes = new Set<string>();
  private invokeNamespaces = new Set<string>();
  private canListenEvents = false;
  private canEmitEvents = false;

  constructor(permissions: string[]) {
    for (const perm of permissions) {
      if (perm.startsWith('http:')) {
        this.httpDomains.add(perm.slice(5));
      } else if (perm.startsWith('fs:read:')) {
        this.fsReadScopes.add(perm.slice(8));
      } else if (perm.startsWith('fs:write:')) {
        this.fsWriteScopes.add(perm.slice(9));
      } else if (perm.startsWith('invoke:')) {
        this.invokeNamespaces.add(perm.slice(7));
      } else if (perm === 'events:listen') {
        this.canListenEvents = true;
      } else if (perm === 'events:emit') {
        this.canEmitEvents = true;
      }
    }
  }

  canHttp(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      for (const domain of this.httpDomains) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  canInvoke(command: string): boolean {
    // Core commands (no namespace) require invoke:core
    if (!command.includes(':')) {
      return this.invokeNamespaces.has('core');
    }
    // Namespaced commands require invoke:<namespace>
    const namespace = command.split(':')[0];
    return this.invokeNamespaces.has(namespace);
  }

  canFsRead(scope: string): boolean {
    return this.fsReadScopes.has('global') || this.fsReadScopes.has(scope);
  }

  canFsWrite(scope: string): boolean {
    return this.fsWriteScopes.has('global') || this.fsWriteScopes.has(scope);
  }

  canListenEvents(): boolean {
    return this.canListenEvents;
  }

  canEmitEvents(): boolean {
    return this.canEmitEvents;
  }
}
