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

  it('should reject unmapped commands (fail-closed)', () => {
    const v = new PermissionValidator(['invoke:marketplace']);
    expect(v.canInvoke('unknown_command')).toBe(false);
  });

  it('should accept nested namespace permissions', () => {
    const v = new PermissionValidator(['invoke:core:launch']);
    expect(v.canInvoke('launch_game')).toBe(true);
  });

  it('should accept parent namespace for child commands', () => {
    const v = new PermissionValidator(['invoke:core']);
    expect(v.canInvoke('launch_game')).toBe(true);
  });

  it('should reject mapped command when only sibling namespace granted', () => {
    const v = new PermissionValidator(['invoke:core:launch']);
    // core:config:read is a sibling, not granted
    expect(v.canInvoke('get_config')).toBe(false);
  });

  it('should grant marketplace namespace for actual modrinth command names', () => {
    const v = new PermissionValidator(['invoke:marketplace']);
    expect(v.canInvoke('get_mod_details')).toBe(true);
    expect(v.canInvoke('search_cf_mods')).toBe(true);
  });

  it('should grant core:instances:read for list_instances', () => {
    const v = new PermissionValidator(['invoke:core:instances:read']);
    expect(v.canInvoke('list_instances')).toBe(true);
    expect(v.canInvoke('create_instance')).toBe(false);
  });

  it('should grant core:world:write for backup_world', () => {
    const v = new PermissionValidator(['invoke:core:world:write']);
    expect(v.canInvoke('backup_world')).toBe(true);
    expect(v.canInvoke('restore_world')).toBe(true);
    expect(v.canInvoke('delete_world')).toBe(true);
  });

  it('should deny core:world:write commands with only core:world (read-only)', () => {
    const v = new PermissionValidator(['invoke:core:world']);
    expect(v.canInvoke('list_instance_saves')).toBe(true);
    expect(v.canInvoke('backup_world')).toBe(false);
  });

  it('should grant core:world:write via parent core:world permission', () => {
    const v = new PermissionValidator(['invoke:core:world:write']);
    // 子命名空间权限不自动授予父命名空间的所有命令
    expect(v.canInvoke('list_instance_saves')).toBe(false);
  });

  it('should grant system:plugins for install_plugin', () => {
    const v = new PermissionValidator(['invoke:system:plugins']);
    expect(v.canInvoke('install_plugin')).toBe(true);
    expect(v.canInvoke('uninstall_plugin')).toBe(true);
    expect(v.canInvoke('verify_plugin_signature_command')).toBe(true);
  });

  it('should deny system:plugins commands with invoke:core (isolation)', () => {
    const v = new PermissionValidator(['invoke:core']);
    // system:plugins 必须显式授权，invoke:core 不应自动授予
    expect(v.canInvoke('install_plugin')).toBe(false);
    expect(v.canInvoke('list_trusted_keys')).toBe(false);
  });

  it('should grant list_instance_schematics under core:content:read', () => {
    const v = new PermissionValidator(['invoke:core:content:read']);
    expect(v.canInvoke('list_instance_schematics')).toBe(true);
  });

  it('should grant list_world_backups under core:world (read)', () => {
    const v = new PermissionValidator(['invoke:core:world']);
    expect(v.canInvoke('list_world_backups')).toBe(true);
    expect(v.canInvoke('delete_world_backup')).toBe(false);
  });
});
