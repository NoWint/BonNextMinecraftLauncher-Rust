import { parseStructuredError } from '../api/errors';

export interface MappedError {
  type: string;
  code?: string;
  message: string;
  suggestion?: string;
  autoAction?: AutoAction;
}

export type AutoAction = 'refresh_auth';

interface ErrorCodeMapping {
  message: string;
  suggestion: string;
  autoAction?: AutoAction;
}

const ERROR_CODE_MAP: Record<string, ErrorCodeMapping> = {
  AUTH_EXPIRED: {
    message: 'Session expired',
    suggestion: 'Your login session has expired. Please re-login to continue',
    autoAction: 'refresh_auth',
  },
  RATE_LIMITED: {
    message: 'Too many requests',
    suggestion: 'The server is rate-limiting requests. Wait a moment and try again',
  },
  NETWORK_UNREACHABLE: {
    message: 'Network unreachable',
    suggestion: 'Cannot reach the server. Check your internet connection and try again',
  },
  DISK_FULL: {
    message: 'Disk is full',
    suggestion: 'Not enough disk space. Free up storage or change the game directory',
  },
  MOD_CONFLICT: {
    message: 'Mod conflict detected',
    suggestion: 'Two or more mods conflict with each other. Disable one of the conflicting mods to continue',
  },
  VERSION_INCOMPATIBLE: {
    message: 'Version incompatible',
    suggestion: 'This content is not compatible with your current game version. Try a different version',
  },
  INSTANCE_LOCKED: {
    message: 'Instance is locked',
    suggestion: 'The instance is currently in use. Stop the running game or wait for the operation to finish',
  },
  INVALID_INPUT: {
    message: 'Invalid input',
    suggestion: 'Check your input and try again',
  },
  SERVER_CONNECTION_FAILED: {
    message: 'Server connection failed',
    suggestion: 'Check the server address and your internet connection',
  },
  NETWORK_ERROR: {
    message: 'Network error',
    suggestion: 'A network error occurred. Check your internet connection and try again',
  },
  FILE_SYSTEM_ERROR: {
    message: 'File system error',
    suggestion: 'Check that the game directory is accessible and not in use by another program',
  },
  PARSE_ERROR: {
    message: 'Data parsing error',
    suggestion: 'Received invalid data from the server. Try again later',
  },
  JAVA_NOT_FOUND: {
    message: 'Java not found',
    suggestion: 'Java not found, please install or configure Java path',
  },
  VERIFICATION_FAILED: {
    message: 'File verification failed',
    suggestion: 'File corrupted, please retry download',
  },
  DOWNLOAD_FAILED: {
    message: 'Download failed',
    suggestion: 'Network error, check connection and retry',
  },
  LAUNCH_FAILED: {
    message: 'Launch failed',
    suggestion: 'The game could not be launched. Check your Java and instance settings',
  },
  GAME_CRASHED: {
    message: 'Game crashed',
    suggestion: 'The game crashed during runtime. Check the crash report for details',
  },
  AUTH_FAILED: {
    message: 'Authentication failed',
    suggestion: 'Authentication failed, please re-login',
  },
  INVALID_CONFIG: {
    message: 'Configuration error',
    suggestion: 'Check your settings for invalid values',
  },
  ARCHIVE_ERROR: {
    message: 'Archive error',
    suggestion: 'The file could not be extracted. It may be corrupted — try downloading it again',
  },
  VERSION_NOT_FOUND: {
    message: 'Version not found',
    suggestion: 'The selected Minecraft version may have been removed. Try a different version',
  },
  TERRACOTTA_NOT_INSTALLED: {
    message: 'Terracotta not installed',
    suggestion: 'Terracotta not installed, please download first',
  },
  TERRACOTTA_NOT_RUNNING: {
    message: 'Terracotta not running',
    suggestion: 'Terracotta not running, please start it first',
  },
  ASSET_NOT_FOUND: {
    message: 'Asset not found',
    suggestion: 'A required game asset is missing. Try re-downloading the version',
  },
  INSTANCE_NOT_READY: {
    message: 'Instance not ready',
    suggestion: 'The instance is not fully set up yet. Wait for setup to complete',
  },
  ENCRYPTION_ERROR: {
    message: 'Encryption error',
    suggestion: 'Failed to encrypt data. Check your security settings',
  },
  DECRYPTION_ERROR: {
    message: 'Decryption error',
    suggestion: 'Failed to decrypt data. Your credentials may need to be re-entered',
  },
  SECURITY_VALIDATION_FAILED: {
    message: 'Security validation failed',
    suggestion: 'A security check failed. Review your security settings',
  },
  SANDBOX_ERROR: {
    message: 'Sandbox error',
    suggestion: 'The sandbox could not be configured. Check sandbox settings',
  },
  INVALID_URL: {
    message: 'Invalid URL',
    suggestion: 'A URL was invalid. This may be a bug — please report it',
  },
  UNKNOWN: {
    message: 'An unexpected error occurred',
    suggestion: 'Please try again. If the problem persists, check the console for details',
  },
};

const ERROR_TYPE_MAP: Record<string, Omit<MappedError, 'type'>> = {
  Sha1Mismatch: {
    code: 'VERIFICATION_FAILED',
    message: 'File verification failed',
    suggestion: 'File corrupted, please retry download',
  },
  DownloadFailed: {
    code: 'DOWNLOAD_FAILED',
    message: 'Download failed',
    suggestion: 'Network error, check connection and retry',
  },
  AuthFailed: {
    code: 'AUTH_FAILED',
    message: 'Authentication failed',
    suggestion: 'Authentication failed, please re-login',
  },
  AuthExpired: {
    code: 'AUTH_EXPIRED',
    message: 'Session expired',
    suggestion: 'Your login session has expired. Please re-login to continue',
    autoAction: 'refresh_auth',
  },
  RateLimited: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    suggestion: 'The server is rate-limiting requests. Wait a moment and try again',
  },
  NetworkUnreachable: {
    code: 'NETWORK_UNREACHABLE',
    message: 'Network unreachable',
    suggestion: 'Cannot reach the server. Check your internet connection and try again',
  },
  DiskSpace: {
    code: 'DISK_FULL',
    message: 'Insufficient disk space',
    suggestion: 'Insufficient disk space',
  },
  ModConflict: {
    code: 'MOD_CONFLICT',
    message: 'Mod conflict detected',
    suggestion: 'Two or more mods conflict with each other. Disable one of the conflicting mods to continue',
  },
  VersionIncompatible: {
    code: 'VERSION_INCOMPATIBLE',
    message: 'Version incompatible',
    suggestion: 'This content is not compatible with your current game version. Try a different version',
  },
  InstanceLocked: {
    code: 'INSTANCE_LOCKED',
    message: 'Instance is locked',
    suggestion: 'The instance is currently in use. Stop the running game or wait for the operation to finish',
  },
  InvalidInput: {
    code: 'INVALID_INPUT',
    message: 'Invalid input',
    suggestion: 'Check your input and try again',
  },
  ServerConnectionFailed: {
    code: 'SERVER_CONNECTION_FAILED',
    message: 'Server connection failed',
    suggestion: 'Check the server address and your internet connection',
  },
  JavaNotFound: {
    code: 'JAVA_NOT_FOUND',
    message: 'Java not found',
    suggestion: 'Java not found, please install or configure Java path',
  },
  TerracottaNotInstalled: {
    code: 'TERRACOTTA_NOT_INSTALLED',
    message: 'Terracotta not installed',
    suggestion: 'Terracotta not installed, please download first',
  },
  TerracottaNotRunning: {
    code: 'TERRACOTTA_NOT_RUNNING',
    message: 'Terracotta not running',
    suggestion: 'Terracotta not running, please start it first',
  },
  Io: {
    code: 'FILE_SYSTEM_ERROR',
    message: 'File system error',
    suggestion: 'Check that the game directory is accessible and not in use by another program',
  },
  VersionNotFound: {
    code: 'VERSION_NOT_FOUND',
    message: 'Version not found',
    suggestion: 'The selected Minecraft version may have been removed. Try a different version',
  },
  InstanceNotFound: {
    code: 'VERSION_NOT_FOUND',
    message: 'Instance not found',
    suggestion: 'The instance may have been deleted. Refresh the instance list',
  },
  ConfigError: {
    code: 'INVALID_CONFIG',
    message: 'Configuration error',
    suggestion: 'Check your settings for invalid values',
  },
  LoaderInstallFailed: {
    code: 'DOWNLOAD_FAILED',
    message: 'Loader installation failed',
    suggestion: 'The mod loader could not be installed. Check your internet connection and try again',
  },
  ZipError: {
    code: 'ARCHIVE_ERROR',
    message: 'Archive error',
    suggestion: 'The file could not be extracted. It may be corrupted — try downloading it again',
  },
  PermissionDenied: {
    code: 'FILE_SYSTEM_ERROR',
    message: 'Permission denied',
    suggestion: 'BonNext does not have permission to access this file or directory',
  },
  DiskFull: {
    code: 'DISK_FULL',
    message: 'Disk is full',
    suggestion: 'Not enough disk space. Free up storage or change the game directory',
  },
  Http: {
    code: 'NETWORK_ERROR',
    message: 'Network error',
    suggestion: 'A network error occurred. Check your internet connection and try again',
  },
  Json: {
    code: 'PARSE_ERROR',
    message: 'Data parsing error',
    suggestion: 'Received invalid data from the server. Try again later',
  },
};

function tryParseStructuredError(
  raw: string,
): { type?: string; code?: string; message?: string; suggestion?: string } | null {
  const structured = parseStructuredError(raw);
  if (structured.type !== 'Unknown' || structured.code || structured.suggestion) {
    return { type: structured.type, code: structured.code, message: structured.message, suggestion: structured.suggestion };
  }
  return null;
}

function inferTypeFromMessage(raw: string): string | null {
  const patterns: Array<[RegExp, string]> = [
    [/JavaNotFound|java.*not found|No such file or directory.*java/i, 'JavaNotFound'],
    [/DownloadFailed|download.*failed|connection refused|timed out/i, 'DownloadFailed'],
    [/Sha1Mismatch|hash.*mismatch|checksum.*fail/i, 'Sha1Mismatch'],
    [/AuthExpired|token.*expired|session.*expired/i, 'AuthExpired'],
    [/AuthFailed|auth.*failed|invalid.*token/i, 'AuthFailed'],
    [/RateLimited|rate.?limit|too many requests|429/i, 'RateLimited'],
    [/NetworkUnreachable|network.*unreachable|connection.*refused|ECONNREFUSED/i, 'NetworkUnreachable'],
    [/DiskFull|no space left/i, 'DiskSpace'],
    [/ModConflict|mod.*conflict/i, 'ModConflict'],
    [/VersionIncompatible|version.*incompatible/i, 'VersionIncompatible'],
    [/InstanceLocked|instance.*locked/i, 'InstanceLocked'],
    [/InvalidInput|invalid.*input/i, 'InvalidInput'],
    [/ServerConnectionFailed|server.*connection.*failed/i, 'ServerConnectionFailed'],
    [/VersionNotFound|version.*not found/i, 'VersionNotFound'],
    [/InstanceNotFound|instance.*not found/i, 'InstanceNotFound'],
    [/PermissionDenied|permission.*denied/i, 'PermissionDenied'],
    [/Io\(Os/i, 'Io'],
    [/ConfigError|config.*invalid/i, 'ConfigError'],
    [/LoaderInstallFailed|loader.*failed/i, 'LoaderInstallFailed'],
    [/ZipError|zip.*invalid|archive.*corrupt/i, 'ZipError'],
    [/TerracottaNotInstalled/i, 'TerracottaNotInstalled'],
    [/TerracottaNotRunning/i, 'TerracottaNotRunning'],
  ];
  for (const [pattern, errorType] of patterns) {
    if (pattern.test(raw)) return errorType;
  }
  return null;
}

function extractRawMessage(error: unknown): string {
  if (error == null) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    try {
      const json = JSON.stringify(obj);
      if (json && json !== '{}') return json;
    } catch {
      /* empty */
    }
  }
  if (typeof (error as Record<string, unknown>)?.toString === 'function') {
    const str = (error as Record<string, unknown>).toString;
    if (typeof str === 'function') {
      const result = str.call(error);
      if (typeof result === 'string' && result !== '[object Object]') return result;
    }
  }
  return '';
}

function resolveFromCode(code: string): MappedError | null {
  const mapping = ERROR_CODE_MAP[code];
  if (!mapping) return null;
  return { type: 'CodeMapped', code, ...mapping };
}

export function mapError(error: unknown): MappedError {
  const raw = extractRawMessage(error);

  const structured = tryParseStructuredError(raw);
  if (structured?.code) {
    const codeMapped = resolveFromCode(structured.code);
    if (codeMapped) {
      return {
        ...codeMapped,
        type: structured.type || codeMapped.type,
        message: structured.message || codeMapped.message,
        suggestion: structured.suggestion || codeMapped.suggestion,
      };
    }
  }

  if (structured?.type) {
    const mapped = ERROR_TYPE_MAP[structured.type];
    if (mapped) {
      return {
        ...mapped,
        type: structured.type,
        message: structured.message || mapped.message,
        suggestion: structured.suggestion || mapped.suggestion,
      };
    }
    return {
      type: structured.type,
      code: structured.code,
      message: structured.message || structured.type,
      suggestion: structured.suggestion,
    };
  }

  if (typeof error === 'object' && error !== null && !(error instanceof Error)) {
    const obj = error as Record<string, unknown>;
    const backendSuggestion = typeof obj.suggestion === 'string' ? obj.suggestion : undefined;
    if (typeof obj.code === 'string') {
      const codeMapped = resolveFromCode(obj.code);
      if (codeMapped) {
        return {
          ...codeMapped,
          type: typeof obj.type === 'string' ? obj.type : codeMapped.type,
          message: typeof obj.message === 'string' ? obj.message : codeMapped.message,
          suggestion: backendSuggestion || codeMapped.suggestion,
        };
      }
    }
    if (typeof obj.type === 'string') {
      const mapped = ERROR_TYPE_MAP[obj.type];
      if (mapped) {
        return {
          ...mapped,
          type: obj.type,
          message: typeof obj.message === 'string' ? obj.message : mapped.message,
          suggestion: backendSuggestion || mapped.suggestion,
        };
      }
      return {
        type: obj.type,
        message: typeof obj.message === 'string' ? obj.message : obj.type,
        suggestion: backendSuggestion,
      };
    }
  }

  const inferredType = inferTypeFromMessage(raw);
  if (inferredType) {
    const mapped = ERROR_TYPE_MAP[inferredType];
    if (mapped) {
      return { type: inferredType, ...mapped };
    }
  }

  const cleaned = raw
    .replace(/^Error:\s*/i, '')
    .replace(/^LauncherError\(/, '')
    .replace(/\)$/, '')
    .trim();

  if (cleaned.length > 0 && cleaned.length < 120) {
    return { type: 'Unknown', code: 'UNKNOWN', message: cleaned };
  }

  return {
    type: 'Unknown',
    code: 'UNKNOWN',
    message: 'An unexpected error occurred',
    suggestion: 'Please try again. If the problem persists, check the console for details',
  };
}

export function friendlyError(raw: string): { message: string; suggestion: string } {
  const result = mapError(raw);
  return { message: result.message, suggestion: result.suggestion || '' };
}

export function formatError(raw: unknown): string {
  const { message, suggestion } = mapError(raw);
  return suggestion ? `${message}. ${suggestion}` : message;
}

export function isAuthExpired(error: unknown): boolean {
  const mapped = mapError(error);
  return mapped.code === 'AUTH_EXPIRED';
}

export async function handleAuthExpired(error: unknown): Promise<boolean> {
  if (!isAuthExpired(error)) return false;
  try {
    const { api } = await import('../api');
    const newToken = await api.refreshAuthToken();
    return newToken !== null;
  } catch {
    return false;
  }
}
