/**
 * Cookie Configuration Utility
 * 
 * Centralizes production-safe cookie settings for session management.
 * Enforces httpOnly, secure transport, proper path, and samesite policies.
 */

const { SESSION_EXPIRY_MS } = require('../services/authService');

const VALID_SAME_SITE_VALUES = ['lax', 'strict', 'none'];

/**
 * Get options for setting the parent_session cookie
 * @param {import('express').Request} [req] - Express request object for HTTPS detection
 * @returns {import('express').CookieOptions}
 */
function getSessionCookieOptions(req) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = Boolean(
    req && (req.secure || req.headers?.['x-forwarded-proto'] === 'https')
  );

  // In production, secure is ALWAYS true and cannot be silently downgraded
  // In development/test, secure is true if request is HTTPS or COOKIE_SECURE is explicitly true
  let secure = isProduction || isHttps || (process.env.COOKIE_SECURE === 'true');

  let sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!VALID_SAME_SITE_VALUES.includes(sameSite)) {
    sameSite = 'lax';
  }

  // SameSite=None requires Secure=true in all modern browsers
  if (sameSite === 'none') {
    secure = true;
  }

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: SESSION_EXPIRY_MS,
    path: '/'
  };
}

/**
 * Get options for clearing the parent_session cookie on logout
 * @param {import('express').Request} [req]
 * @returns {import('express').CookieOptions}
 */
function getClearCookieOptions(req) {
  const options = getSessionCookieOptions(req);
  delete options.maxAge;
  return options;
}

module.exports = {
  getSessionCookieOptions,
  getClearCookieOptions,
  VALID_SAME_SITE_VALUES
};
