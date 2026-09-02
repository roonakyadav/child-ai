/**
 * Configuration Module
 * Centralizes all environment variables and configuration constants
 */

require('dotenv').config();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100');
const AI_RATE_LIMIT_MAX = parseInt(process.env.AI_RATE_LIMIT_MAX || '30');

// Session configuration
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

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
  SESSION_EXPIRY_MS,
  GROQ_API_KEY,
  GROQ_API_URL,
  GROQ_TIMEOUT_MS,
  allowedOrigins
};
