/**
 * Request ID Middleware
 * Assigns a cryptographically secure request ID to every incoming HTTP request.
 * Safely validates incoming X-Request-ID headers before adoption, falling back
 * to a fresh UUIDv4 to prevent header injection or trace corruption.
 */

const crypto = require('crypto');

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validate incoming request ID
 * @param {any} headerVal
 * @returns {boolean}
 */
function isValidRequestId(headerVal) {
  if (typeof headerVal !== 'string') {
    return false;
  }
  const trimmed = headerVal.trim();
  return SAFE_REQUEST_ID_REGEX.test(trimmed);
}

/**
 * Request ID middleware
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];

  let requestId;
  if (isValidRequestId(incomingId)) {
    requestId = incomingId.trim();
  } else {
    requestId = crypto.randomUUID();
  }

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}

module.exports = {
  requestIdMiddleware,
  isValidRequestId
};
