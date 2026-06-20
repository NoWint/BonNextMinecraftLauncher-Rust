// src/plugins/core/__tests__/PermissionValidator.test.ts
import { describe, it, expect } from 'vitest';
import { PermissionValidator } from '../PermissionValidator';

describe('PermissionValidator', () => {
  it('should grant http permission for exact domain', () => {
    const v = new PermissionValidator(['http:modrinth.com']);
    expect(v.canHttp('https://modrinth.com/api/search')).toBe(true);
  });

  it('should deny http permission for unlisted domain', () => {
    const v = new PermissionValidator(['http:modrinth.com']);
    expect(v.canHttp('https://evil.com/api')).toBe(false);
  });

  it('should grant http for subdomain when parent domain permitted', () => {
    const v = new PermissionValidator(['http:modrinth.com']);
    expect(v.canHttp('https://api.modrinth.com/v2/search')).toBe(true);
  });

  it('should grant invoke:core permission', () => {
    const v = new PermissionValidator(['invoke:core']);
    expect(v.canInvoke('list_instances')).toBe(true);
  });

  it('should grant invoke:<namespace> for namespaced commands', () => {
    const v = new PermissionValidator(['invoke:marketplace']);
    expect(v.canInvoke('marketplace:search')).toBe(true);
  });

  it('should deny invoke without permission', () => {
    const v = new PermissionValidator([]);
    expect(v.canInvoke('list_instances')).toBe(false);
  });

  it('should grant fs:read:instances permission', () => {
    const v = new PermissionValidator(['fs:read:instances']);
    expect(v.canFsRead('instances')).toBe(true);
    expect(v.canFsRead('global')).toBe(false);
  });

  it('should grant fs:read:global for all scopes', () => {
    const v = new PermissionValidator(['fs:read:global']);
    expect(v.canFsRead('instances')).toBe(true);
    expect(v.canFsRead('config')).toBe(true);
  });
});
