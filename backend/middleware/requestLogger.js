/**
 * Request Completion Logger Middleware
 * Logs a single structured operational event upon request completion.
 * Excludes query parameters, headers, bodies, cookies, and responses to prevent
 * leaking any child data, tokens, or credentials.
 */

const logger = require('../lib/logger');

/**
 * Determine a safe route path without query parameters or hash
 */
function getSafePath(req) {
  if (req.baseUrl || req.path) {
    return `${req.baseUrl || ''}${req.path || ''}`;
  }
  if (req.originalUrl) {
    return req.originalUrl.split('?')[0];
  }
  return req.url ? req.url.split('?')[0] : '/';
}

/**
 * Middleware that tracks request execution time and logs completion
 */
function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();

  // Guard against double-logging if registered or triggered multiple times
  let logged = false;

  res.on('finish', () => {
    if (logged) return;
    logged = true;

    const durationMs = Date.now() - startTime;
    const safePath = getSafePath(req);

    logger.info('request.completed', {
      requestId: req.id,
      method: req.method,
      path: safePath,
      status: res.statusCode,
      durationMs
    });
  });

  next();
}

module.exports = {
  requestLoggerMiddleware,
  getSafePath
};
