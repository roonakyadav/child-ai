/**
 * Safe Frontend Logger
 * 
 * Provides safe, sanitized operational logging on the client side.
 * Strictly prevents leaking child conversation text, AI prompts,
 * model completions, tokens, credentials, cookies, or raw exception stacks.
 */

export interface SafeErrorDetails {
  name?: string;
  code?: string;
  status?: number;
  requestId?: string;
}

/**
 * Extract safe operational metadata from an error without sensitive payloads
 */
export function extractSafeErrorDetails(error: unknown): SafeErrorDetails {
  if (!error) return {};

  const details: SafeErrorDetails = {};

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.name === 'string') details.name = errObj.name;
    if (typeof errObj.code === 'string') details.code = errObj.code;
    if (typeof errObj.status === 'number') details.status = errObj.status;
    if (typeof errObj.requestId === 'string') details.requestId = errObj.requestId;
  }

  return details;
}

/**
 * Log a sanitized operational error without leaking sensitive payloads or stack traces
 */
export function safeError(context: string, error?: unknown): void {
  const details = extractSafeErrorDetails(error);
  const parts = [
    `[SafeLog] ${context}`,
    details.code ? `code=${details.code}` : null,
    details.status ? `status=${details.status}` : null,
    details.requestId ? `reqId=${details.requestId}` : null,
    details.name && details.name !== 'Error' ? `type=${details.name}` : null,
  ].filter(Boolean);

  console.error(parts.join(' | '));
}

/**
 * Log a safe warning message
 */
export function safeWarn(context: string, message?: string): void {
  console.warn(`[SafeLog] ${context}${message ? `: ${message}` : ''}`);
}

/**
 * Log a safe informational message
 */
export function safeInfo(context: string, message?: string): void {
  console.info(`[SafeLog] ${context}${message ? `: ${message}` : ''}`);
}
