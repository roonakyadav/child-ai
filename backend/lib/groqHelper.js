const axios = require('axios');

// Configuration
const GROQ_API_URL = process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_TIMEOUT_MS = parseInt(process.env.GROQ_TIMEOUT_MS || '30000'); // 30 seconds default

// Error codes
const ERROR_CODES = {
  TIMEOUT: 'AI_SERVICE_TIMEOUT',
  UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
  INTERNAL_ERROR: 'AI_INTERNAL_ERROR',
  RATE_LIMITED: 'AI_RATE_LIMITED'
};

/**
 * Centralized Groq API request helper with timeout, retry, and error handling
 * @param {Object} options - Request options
 * @param {string} options.endpoint - Endpoint name for logging
 * @param {Array} options.messages - Messages array for Groq
 * @param {string} options.model - Model name
 * @param {number} options.temperature - Temperature (optional)
 * @param {Object} options.responseFormat - Response format (optional)
 * @param {boolean} options.isSafetyEndpoint - Whether this is a safety endpoint (affects error handling)
 * @returns {Promise<Object>} Groq API response
 */
async function callGroqAPI({ endpoint, messages, model, temperature, responseFormat, isSafetyEndpoint = false }) {
  const startTime = Date.now();
  let attempt = 0;
  const maxRetries = 1;
  
  const apiKey = process.env.GROQ_API_KEY || GROQ_API_KEY;
  if (!apiKey) {
    logError(endpoint, 'CONFIGURATION_ERROR', 'GROQ_API_KEY not configured', 0);
    throw createSafeError(ERROR_CODES.INTERNAL_ERROR, 'AI service not configured');
  }

  while (attempt <= maxRetries) {
    try {
      const response = await axios.post(GROQ_API_URL, {
        model: model || "llama-3.1-8b-instant",
        messages,
        temperature: temperature || 0.1,
        ...(responseFormat && { response_format: responseFormat })
      }, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: GROQ_TIMEOUT_MS
      });

      const elapsed = Date.now() - startTime;
      logSuccess(endpoint, elapsed, response.status);

      // Validate response structure
      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        logError(endpoint, ERROR_CODES.INVALID_RESPONSE, 'Empty AI response', elapsed);
        throw createSafeError(ERROR_CODES.INVALID_RESPONSE, 'AI service returned invalid response');
      }

      return response.data;

    } catch (error) {
      const elapsed = Date.now() - startTime;
      const isLastAttempt = attempt >= maxRetries;
      
      // Categorize error
      const errorCategory = categorizeError(error);
      
      // Log the error
      logError(endpoint, errorCategory.code, errorCategory.message, elapsed, error.response?.status);

      // Don't retry on 4xx errors (except 429 rate limit)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        if (error.response.status === 429) {
          // Rate limit - could retry, but for now just return error
          throw createSafeError(ERROR_CODES.RATE_LIMITED, 'AI service rate limit exceeded');
        }
        // Other 4xx errors - don't retry
        throw createSafeError(ERROR_CODES.INTERNAL_ERROR, 'AI service request error');
      }

      // Retry on timeout, network errors, and 5xx
      if (!isLastAttempt && (errorCategory.shouldRetry || error.response?.status >= 500)) {
        attempt++;
        const delay = Math.min(1000 * attempt, 2000); // Bounded exponential backoff
        logRetry(endpoint, attempt, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Safety endpoints: throw error to trigger UNKNOWN behavior
      if (isSafetyEndpoint) {
        throw error; // Let the safety endpoint handle it with UNKNOWN state
      }

      // Normal endpoints: return safe error
      throw createSafeError(errorCategory.code, errorCategory.message);
    }
  }
}

/**
 * Categorize axios errors for appropriate handling
 */
function categorizeError(error) {
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return {
      code: ERROR_CODES.TIMEOUT,
      message: 'AI service request timed out',
      shouldRetry: true
    };
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
    return {
      code: ERROR_CODES.UNAVAILABLE,
      message: 'AI service unavailable',
      shouldRetry: true
    };
  }

  if (error.response) {
    // HTTP error from provider
    const status = error.response.status;
    if (status >= 500) {
      return {
        code: ERROR_CODES.UNAVAILABLE,
        message: 'AI service error',
        shouldRetry: true
      };
    }
    if (status === 429) {
      return {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'AI service rate limited',
        shouldRetry: true
      };
    }
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'AI service request error',
      shouldRetry: false
    };
  }

  if (error.request) {
    // Request made but no response
    return {
      code: ERROR_CODES.UNAVAILABLE,
      message: 'AI service unavailable',
      shouldRetry: true
    };
  }

  // Other errors
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'AI service internal error',
    shouldRetry: false
  };
}

/**
 * Create a safe error object without exposing internal details
 */
function createSafeError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.isSafeError = true;
  return error;
}

const logger = require('./logger');

/**
 * Log successful request
 */
function logSuccess(endpoint, elapsed, status) {
  logger.info('ai.request.completed', {
    endpoint,
    durationMs: elapsed,
    status
  });
}

/**
 * Log error
 */
function logError(endpoint, code, message, elapsed, httpStatus = null) {
  logger.error('ai.request.failed', {
    endpoint,
    code,
    durationMs: elapsed,
    httpStatus: httpStatus || undefined
  });
}

/**
 * Log retry attempt
 */
function logRetry(endpoint, attempt, delay) {
  logger.warn('ai.request.retry', {
    endpoint,
    attempt,
    maxRetries: 1,
    delayMs: delay
  });
}

module.exports = {
  callGroqAPI,
  ERROR_CODES
};
