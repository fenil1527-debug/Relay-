/**
 * Error Classifier
 * 
 * Maps raw provider failures to: retryable, failover, or fatal.
 * This drives the router's retry/handoff decisions.
 * 
 * From ARCHITECTURE.md §6:
 * - 429, quota, token cap → failover
 * - 5xx, network, timeout → retryable then failover
 * - Context-length exceeded → failover (to larger window) or compress
 * - 401/403 → failover + flag
 * - 400 malformed → fatal
 * - Mid-stream disconnect → retryable
 */

export const ErrorClass = {
  RETRYABLE: 'retryable',
  FAILOVER: 'failover',
  FATAL: 'fatal',
};

/**
 * Classify a provider error into an action class.
 * @param {Error} error - The raw error from a provider adapter
 * @returns {{ class: string, reason: string, skipProvider?: boolean }}
 */
export function classifyError(error) {
  const status = error.status || error.statusCode || error.response?.status;
  const message = (error.message || '').toLowerCase();
  const code = error.code || '';

  // Rate limiting / quota
  if (status === 429 || message.includes('rate_limit') || message.includes('quota')) {
    return {
      class: ErrorClass.FAILOVER,
      reason: `Rate limited (${status || 'quota exceeded'})`,
    };
  }

  // Authentication failure — skip this provider for the session
  if (status === 401 || status === 403) {
    return {
      class: ErrorClass.FAILOVER,
      reason: `Auth failure (${status})`,
      skipProvider: true,
    };
  }

  // Context length exceeded
  if (
    message.includes('context_length') ||
    message.includes('maximum context') ||
    message.includes('too many tokens') ||
    message.includes('max_tokens')
  ) {
    return {
      class: ErrorClass.FAILOVER,
      reason: 'Context length exceeded',
    };
  }

  // Malformed request — this is an adapter bug
  if (status === 400) {
    return {
      class: ErrorClass.FATAL,
      reason: `Bad request: ${error.message?.substring(0, 200)}`,
    };
  }

  // Server errors
  if (status >= 500) {
    return {
      class: ErrorClass.RETRYABLE,
      reason: `Server error (${status})`,
    };
  }

  // Network errors
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('abort')
  ) {
    return {
      class: ErrorClass.RETRYABLE,
      reason: `Network error: ${code || message.substring(0, 100)}`,
    };
  }

  // Stream disconnect
  if (message.includes('stream') && (message.includes('disconnect') || message.includes('aborted'))) {
    return {
      class: ErrorClass.RETRYABLE,
      reason: 'Stream disconnected',
    };
  }

  // Unknown — treat as retryable
  return {
    class: ErrorClass.RETRYABLE,
    reason: `Unknown error: ${message.substring(0, 200)}`,
  };
}
