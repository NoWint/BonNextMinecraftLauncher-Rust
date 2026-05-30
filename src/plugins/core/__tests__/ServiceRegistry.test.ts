import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry } from '../ServiceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('should provide and consume a service', () => {
    const service = { getCurrentTheme: () => 'dark' };
    registry.provide('bonnext:theme', service, 'com.bonnext.zzz-theme');
    const consumed = registry.consume('bonnext:theme');
    expect(consumed).toBe(service);
  });

  it('should return undefined for unknown service', () => {
    expect(registry.consume('bonnext:unknown')).toBeUndefined();
  });

  it('should check service availability', () => {
    expect(registry.isAvailable('bonnext:theme')).toBe(false);
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    expect(registry.isAvailable('bonnext:theme')).toBe(true);
  });

  it('should revoke a service', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    registry.revoke('bonnext:theme', 'com.bonnext.zzz-theme');
    expect(registry.isAvailable('bonnext:theme')).toBe(false);
  });

  it('should throw when revoking with wrong provider', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    expect(() => registry.revoke('bonnext:theme', 'com.bonnext.other')).toThrow(/not the provider/);
  });

  it('should revoke all services for a plugin', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    registry.provide('bonnext:theme-rules', {}, 'com.bonnext.zzz-theme');
    registry.revokeAllForPlugin('com.bonnext.zzz-theme');
    expect(registry.isAvailable('bonnext:theme')).toBe(false);
    expect(registry.isAvailable('bonnext:theme-rules')).toBe(false);
  });

  it('should throw on duplicate service provision', () => {
    registry.provide('bonnext:theme', {}, 'com.bonnext.zzz-theme');
    expect(() => registry.provide('bonnext:theme', {}, 'com.bonnext.other')).toThrow(/already provided/);
  });
});
