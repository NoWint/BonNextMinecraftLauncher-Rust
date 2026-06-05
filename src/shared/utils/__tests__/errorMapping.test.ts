import { mapError, formatError, friendlyError } from '../errorMapping';

describe('mapError', () => {
  it('maps structured JSON error with known type', () => {
    const input = JSON.stringify({ type: 'JavaNotFound', message: 'Java not found' });
    const result = mapError(input);
    expect(result.type).toBe('JavaNotFound');
    expect(result.message).toBe('Java not found');
    expect(result.suggestion).toContain('Java');
  });

  it('maps structured JSON error with unknown type', () => {
    const input = JSON.stringify({ type: 'CustomError', message: 'Something went wrong' });
    const result = mapError(input);
    expect(result.type).toBe('CustomError');
    expect(result.message).toBe('Something went wrong');
  });

  it('maps object with type field', () => {
    const input = { type: 'DownloadFailed', message: 'Connection timeout' };
    const result = mapError(input);
    expect(result.type).toBe('DownloadFailed');
    expect(result.message).toBe('Connection timeout');
    expect(result.suggestion).toBeDefined();
  });

  it('maps object with type field but no message', () => {
    const input = { type: 'AuthFailed' };
    const result = mapError(input);
    expect(result.type).toBe('AuthFailed');
  });

  it('infers type from error message string', () => {
    const result = mapError('JavaNotFound: no java binary');
    expect(result.type).toBe('JavaNotFound');
  });

  it('infers DownloadFailed from message', () => {
    const result = mapError('DownloadFailed: connection refused');
    expect(result.type).toBe('DownloadFailed');
  });

  it('infers Sha1Mismatch from message', () => {
    const result = mapError('Sha1Mismatch: hash mismatch detected');
    expect(result.type).toBe('Sha1Mismatch');
  });

  it('infers AuthFailed from message', () => {
    const result = mapError('AuthFailed: invalid token');
    expect(result.type).toBe('AuthFailed');
  });

  it('infers DiskSpace from message', () => {
    const result = mapError('DiskFull: no space left on device');
    expect(result.type).toBe('DiskSpace');
  });

  it('returns Unknown for unrecognized errors', () => {
    const result = mapError('Something completely unexpected');
    expect(result.type).toBe('Unknown');
  });

  it('handles null input', () => {
    const result = mapError(null);
    expect(result.type).toBe('Unknown');
  });

  it('handles undefined input', () => {
    const result = mapError(undefined);
    expect(result.type).toBe('Unknown');
  });

  it('handles Error instance', () => {
    const result = mapError(new Error('Test error message'));
    expect(result.type).toBe('Unknown');
    expect(result.message).toContain('Test error message');
  });

  it('handles empty string', () => {
    const result = mapError('');
    expect(result.type).toBe('Unknown');
  });

  it('cleans LauncherError prefix from message', () => {
    const result = mapError('LauncherError(something broke)');
    expect(result.type).toBe('Unknown');
    expect(result.message).toContain('something broke');
  });

  it('cleans Error: prefix from message', () => {
    const result = mapError('Error: something failed');
    expect(result.type).toBe('Unknown');
    expect(result.message).toContain('something failed');
  });

  it('preserves structured message over mapped default', () => {
    const input = JSON.stringify({ type: 'DownloadFailed', message: 'Custom download message' });
    const result = mapError(input);
    expect(result.message).toBe('Custom download message');
  });

  it('maps all known error types', () => {
    const knownTypes = [
      'Sha1Mismatch',
      'DownloadFailed',
      'AuthFailed',
      'DiskSpace',
      'JavaNotFound',
      'TerracottaNotInstalled',
      'TerracottaNotRunning',
      'Io',
      'VersionNotFound',
      'Http',
      'Json',
    ];
    for (const type of knownTypes) {
      const result = mapError({ type, message: `Test ${type}` });
      expect(result.type).toBe(type);
      expect(result.suggestion).toBeDefined();
    }
  });
});

describe('formatError', () => {
  it('returns message only when no suggestion', () => {
    const result = formatError('Random error');
    expect(result).toBe('Random error');
  });

  it('returns message with suggestion for known errors', () => {
    const result = formatError({ type: 'JavaNotFound', message: 'Java not found' });
    expect(result).toContain('Java not found');
    expect(result).toContain('Java');
  });

  it('handles structured JSON string', () => {
    const input = JSON.stringify({ type: 'AuthFailed', message: 'Token expired' });
    const result = formatError(input);
    expect(result).toContain('Authentication failed');
    expect(result).toContain('re-login');
  });
});

describe('friendlyError', () => {
  it('returns message and suggestion for known errors', () => {
    const result = friendlyError(JSON.stringify({ type: 'JavaNotFound', message: 'Java not found' }));
    expect(result.message).toContain('Java not found');
    expect(result.suggestion).toContain('Java');
  });

  it('returns empty suggestion for unknown errors', () => {
    const result = friendlyError('Random error');
    expect(result.suggestion).toBe('');
  });

  it('returns message for structured errors without suggestion', () => {
    const result = friendlyError(JSON.stringify({ type: 'CustomError', message: 'Custom msg' }));
    expect(result.message).toBe('Custom msg');
    expect(result.suggestion).toBe('');
  });
});
