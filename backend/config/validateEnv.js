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
  } else {
    // In production with credentials: true, wildcard '*' is insecure and rejected by browsers
    const origins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    if (origins.includes('*')) {
      missing.push('ALLOWED_ORIGINS_WILDCARD_UNSAFE');
    }
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

  if (env.SESSION_EXPIRY_MS) {
    const expiry = parseInt(env.SESSION_EXPIRY_MS, 10);
    if (isNaN(expiry) || expiry < 60000 || expiry > 86400000) {
      missing.push('SESSION_EXPIRY_MS_INVALID');
    }
  }

  if (env.COOKIE_SAME_SITE) {
    const s = env.COOKIE_SAME_SITE.toLowerCase().trim();
    if (!['lax', 'strict', 'none'].includes(s)) {
      missing.push('COOKIE_SAME_SITE_INVALID');
    }
  }

  if (env.PORT) {
    const portNum = parseInt(env.PORT, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      missing.push('PORT_INVALID');
    }
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
