/**
 * Startup Environment Validation
 * Validates required production settings at process launch without logging secret values.
 */

const path = require('path');
const fs = require('fs');
const logger = require('../lib/logger');

/**
 * Validate environment configuration for production safety
 * @param {Object} env - Environment object (defaults to process.env)
 * @param {boolean} exitOnFailure - Whether to exit the process on validation failure (default: false for testability)
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateProductionConfig(env = process.env, exitOnFailure = false) {
  const isProduction = env.NODE_ENV === 'production';
  if (!isProduction) {
    return { valid: true, missing: [] };
  }

  const missing = [];

  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === '') {
    missing.push('ALLOWED_ORIGINS');
  }

  if (!env.CONFIG_STORE_PATH || env.CONFIG_STORE_PATH.trim() === '') {
    missing.push('CONFIG_STORE_PATH');
  } else {
    try {
      const dir = path.dirname(env.CONFIG_STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      missing.push('CONFIG_STORE_DIRECTORY_UNWRITABLE');
    }
  }

  if (!env.GROQ_API_KEY || env.GROQ_API_KEY.trim() === '') {
    missing.push('GROQ_API_KEY');
  }

  if (missing.length > 0) {
    logger.error('startup.validation.failed', {
      environment: 'production',
      missing
    });

    if (exitOnFailure) {
      process.exit(1);
    }
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

module.exports = {
  validateProductionConfig
};
