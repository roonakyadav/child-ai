/**
 * Global Error Handler Middleware
 * Intercepts unhandled errors, logs sanitized operational metadata with request ID,
 * and returns safe generic error responses to clients without leaking stack traces,
 * internal filesystem paths, AI prompts, or provider secrets.
 */

const logger = require('../lib/logger');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isProduction = process.env.NODE_ENV === 'production';
  let statusCode = err.status || err.statusCode || 500;
  if (typeof statusCode !== 'number' || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  // Safe path determination
  const safePath = req ? (req.baseUrl ? `${req.baseUrl}${req.path || ''}` : (req.path || '/')) : '/';

  // Log sanitized error event (never logging stack trace or sensitive body)
  logger.error('request.error', {
    requestId: req?.id,
    method: req?.method,
    path: safePath,
    status: statusCode,
    errorName: err.name || 'Error',
    code: err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST')
  });

  let clientMessage = 'Internal server error';
  let clientCode = err.code || 'SERVER_ERROR';

  if (err.isSafeError) {
    clientMessage = err.message;
    clientCode = err.code || 'ERROR';
  } else if (statusCode < 500) {
    clientMessage = isProduction ? 'Invalid request' : (err.message || 'Invalid request');
    clientCode = err.code || 'BAD_REQUEST';
  } else {
    clientMessage = 'Internal server error';
    clientCode = err.code || 'SERVER_ERROR';
  }

  res.status(statusCode).json({
    error: clientMessage,
    code: clientCode
  });
}

module.exports = errorHandler;
