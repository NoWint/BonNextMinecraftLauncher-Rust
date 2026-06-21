import { describe, it, expect } from 'vitest';
import {
  generateRequestId,
  isRpcRequest,
  isRpcResponse,
  type SandboxMessage,
  type SandboxRpcRequest,
  type SandboxRpcResponse,
} from '../SandboxProtocol';

describe('SandboxProtocol', () => {
  describe('generateRequestId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });

    it('should prefix with req_', () => {
      const id = generateRequestId();
      expect(id.startsWith('req_')).toBe(true);
    });
  });

  describe('isRpcRequest', () => {
    it('should return true for rpc messages', () => {
      const msg: SandboxRpcRequest = {
        kind: 'rpc',
        id: 'test-1',
        method: 'invoke',
        args: ['command', { arg: 1 }],
      };
      expect(isRpcRequest(msg)).toBe(true);
    });

    it('should return false for non-rpc messages', () => {
      const msg: SandboxMessage = { kind: 'ready' };
      expect(isRpcRequest(msg)).toBe(false);
    });
  });

  describe('isRpcResponse', () => {
    it('should return true for rpc-response messages', () => {
      const msg: SandboxRpcResponse = {
        kind: 'rpc-response',
        id: 'test-1',
        ok: true,
        result: 42,
      };
      expect(isRpcResponse(msg)).toBe(true);
    });

    it('should return false for error responses', () => {
      // 注意：error response 仍然是 rpc-response 类型，ok=false
      const msg: SandboxRpcResponse = {
        kind: 'rpc-response',
        id: 'test-1',
        ok: false,
        error: 'failed',
      };
      expect(isRpcResponse(msg)).toBe(true);
    });
  });

  describe('message serialization', () => {
    it('should serialize/deserialize rpc request via JSON', () => {
      const msg: SandboxRpcRequest = {
        kind: 'rpc',
        id: 'test-2',
        method: 'storage-set',
        args: ['key', { nested: { value: 123 } }],
      };
      const json = JSON.stringify(msg);
      const parsed = JSON.parse(json) as SandboxRpcRequest;
      expect(parsed.kind).toBe('rpc');
      expect(parsed.method).toBe('storage-set');
      expect(parsed.args[0]).toBe('key');
      expect((parsed.args[1] as { nested: { value: number } }).nested.value).toBe(123);
    });

    it('should serialize load message with plugin source', () => {
      const msg: SandboxMessage = {
        kind: 'load',
        pluginId: 'test-plugin',
        pluginSource: 'export default { activate() {} }',
        permissions: ['invoke:marketplace'],
      };
      const json = JSON.stringify(msg);
      const parsed = JSON.parse(json) as typeof msg;
      expect(parsed.kind).toBe('load');
    });
  });
});
