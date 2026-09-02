/**
 * Rate Limiting Middleware
 * Configures rate limiting for general and AI-intensive endpoints
 */

const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AI_RATE_LIMIT_MAX } = require('../config');

// General rate limiter for authentication endpoints
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for test endpoint
    return req.path === '/api/test';
  }
});

// Stricter rate limiter for AI-intensive endpoints
const aiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AI_RATE_LIMIT_MAX,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  aiLimiter
};
