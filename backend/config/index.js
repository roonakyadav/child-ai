/**
 * Configuration Module
 * Centralizes all environment variables and configuration constants
 */

require('dotenv').config();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const AI_RATE_LIMIT_MAX = parseInt(process.env.AI_RATE_LIMIT_MAX || '30', 10);
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10);

// Session configuration
const SESSION_EXPIRY_MS = parseInt(process.env.SESSION_EXPIRY_MS || '1800000', 10); // 30 minutes
const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_ACTIVE_SESSIONS || '1000', 10);

// Groq API configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TIMEOUT_MS = parseInt(process.env.GROQ_TIMEOUT_MS || '30000');

// CORS configuration
function parseAllowedOrigins() {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  
  if (!allowedOriginsEnv) {
    // Development: default to localhost Vite dev server
    if (NODE_ENV !== 'production') {
      return ['http://localhost:5173'];
    }
    // Production: fail if not configured
    return null;
  }
  
  // Split by comma and trim whitespace
  return allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
}

const allowedOrigins = parseAllowedOrigins();

// Production validation
if (NODE_ENV === 'production') {
  if (!allowedOrigins || allowedOrigins.length === 0) {
    console.error('FATAL: ALLOWED_ORIGINS environment variable must be set in production');
    console.error('Example: ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com');
    process.exit(1);
  }
}

module.exports = {
  PORT,
  NODE_ENV,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  AI_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX,
  SESSION_EXPIRY_MS,
  MAX_ACTIVE_SESSIONS,
  GROQ_API_KEY,
  GROQ_API_URL,
  GROQ_TIMEOUT_MS,
  allowedOrigins
};
