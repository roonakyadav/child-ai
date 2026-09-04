/**
 * Rate Limiting Middleware
 * Configures rate limiting for general, authentication, and AI-intensive endpoints
 */

const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AI_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX } = require('../config');

// General rate limiter for non-sensitive endpoints
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

// Stricter rate limiter for authentication endpoints (PIN brute-force defense)
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
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
  authLimiter,
  aiLimiter
};
