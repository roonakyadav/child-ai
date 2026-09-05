/**
 * Structured Logger Module
 * Provides zero-dependency, structured JSON logging with strict sanitization
 * to guarantee that no sensitive child data, AI prompts, completions, PINs,
 * cookies, tokens, or secrets are ever emitted to stdout/stderr.
 */

const BLOCKED_KEYS = new Set([
  'pin',
  'pinhash',
  'hash',
  'password',
  'token',
  'sessiontoken',
  'sessionid',
  'secret',
  'cookie',
  'cookies',
  'authorization',
  'auth',
  'key',
  'apikey',
  'api_key',
  'prompt',
  'prompts',
  'message',
  'messages',
  'content',
  'generatedtext',
  'aitext',
  'usertext',
  'question',
  'childactivity',
  'body',
  'requestbody',
  'responsebody',
  'payload',
  'parentpolicies',
  'parentpolicy',
  'custominstructions'
]);

/**
 * Clean and redact any sensitive substring patterns in primitive string values
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/parent_session=[A-Za-z0-9._-]+/gi, 'parent_session=[REDACTED]')
    .replace(/(api[_-]?key)=['"]?[A-Za-z0-9._-]+['"]?/gi, '$1=[REDACTED]')
    .replace(/(pin)=['"]?\d{4,6}['"]?/gi, '$1=[REDACTED]');
}

/**
 * Recursively sanitize metadata object to omit sensitive keys and redact sensitive string values
 */
function sanitizeMeta(input, depth = 0) {
  if (depth > 4 || input === null || input === undefined) {
    return undefined;
  }

  if (typeof input !== 'object') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.slice(0, 20).map(item => sanitizeMeta(item, depth + 1));
  }

  const clean = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (BLOCKED_KEYS.has(normalizedKey)) {
      continue; // Strictly omit sensitive fields
    }

    if (value instanceof Error) {
      clean[key] = {
        name: value.name || 'Error',
        message: sanitizeString(value.message),
        code: value.code || 'UNKNOWN_ERROR'
      };
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeMeta(value, depth + 1);
    } else {
      clean[key] = sanitizeString(value);
    }
  }

  return clean;
}

// Configurable log sink (defaults to process.stdout/process.stderr)
let customWriter = null;

/**
 * Format and write a structured log entry
 */
function formatAndWrite(level, event, meta = {}) {
  const sanitized = sanitizeMeta(meta) || {};
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitized
  };

  if (typeof customWriter === 'function') {
    customWriter(entry);
    return entry;
  }

  const output = JSON.stringify(entry) + '\n';
  if (level === 'error') {
    process.stderr.write(output);
  } else {
    process.stdout.write(output);
  }
  return entry;
}

const logger = {
  info: (event, meta) => formatAndWrite('info', event, meta),
  warn: (event, meta) => formatAndWrite('warn', event, meta),
  error: (event, meta) => formatAndWrite('error', event, meta),
  log: (level, event, meta) => formatAndWrite(level, event, meta),
  
  /**
   * Set a custom destination writer for testing or redirection
   */
  setWriter: (writer) => {
    customWriter = writer;
  },

  /**
   * Reset to default stdout/stderr
   */
  resetWriter: () => {
    customWriter = null;
  },

  /**
   * Export sanitizer for testing
   */
  _sanitizeMeta: sanitizeMeta
};

module.exports = logger;
