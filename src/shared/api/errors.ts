export interface StructuredError {
  type: string;
  code?: string;
  message: string;
  suggestion?: string;
  url?: string;
  status?: number;
}

export function parseStructuredError(error: unknown): StructuredError {
  if (error instanceof Error) {
    // Try to parse the error message as JSON (Tauri serializes errors as strings)
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object') {
        return {
          type: parsed.type || 'Unknown',
          code: parsed.code,
          message: parsed.message || error.message,
          suggestion: parsed.suggestion,
          url: parsed.url,
          status: parsed.status,
        };
      }
    } catch {
      // Not JSON, treat as plain string
    }
    return {
      type: 'Unknown',
      message: error.message,
    };
  }

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      if (parsed && typeof parsed === 'object') {
        return {
          type: parsed.type || 'Unknown',
          code: parsed.code,
          message: parsed.message || error,
          suggestion: parsed.suggestion,
          url: parsed.url,
          status: parsed.status,
        };
      }
    } catch {
      // Not JSON
    }
    return {
      type: 'Unknown',
      message: error,
    };
  }

  return {
    type: 'Unknown',
    message: String(error),
  };
}

export function formatErrorWithSuggestion(error: unknown): { message: string; suggestion?: string } {
  const structured = parseStructuredError(error);
  return {
    message: structured.message,
    suggestion: structured.suggestion,
  };
}
