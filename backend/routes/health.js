/**
 * Health and Readiness Endpoints
 * Provides lightweight, unauthenticated operational probes for container orchestration,
 * load balancers, and monitoring systems without invoking external AI APIs or leaking secrets.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { CONFIG_STORE_PATH, allowedOrigins } = require('../config');

/**
 * Check whether critical service dependencies/configurations are present
 */
function checkReadiness() {
  const missing = [];

  // Check Groq API key configuration
  if (!process.env.GROQ_API_KEY) {
    missing.push('GROQ_API_KEY');
  }

  // Check config store accessibility
  try {
    const storePath = process.env.CONFIG_STORE_PATH || CONFIG_STORE_PATH;
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    missing.push('CONFIG_STORE_DIRECTORY');
  }

  // In production, verify CORS origins
  if (process.env.NODE_ENV === 'production' && (!allowedOrigins || allowedOrigins.length === 0)) {
    missing.push('ALLOWED_ORIGINS');
  }

  return {
    ready: missing.length === 0,
    missing
  };
}

// GET /api/health - Liveness probe (process is running and responsive)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

// GET /api/ready - Readiness probe (configuration and dependencies are valid)
router.get('/ready', (req, res) => {
  const { ready, missing } = checkReadiness();

  if (ready) {
    return res.status(200).json({
      status: 'ready',
      ready: true
    });
  }

  return res.status(503).json({
    status: 'unready',
    ready: false,
    missing
  });
});

// GET /api/test - Backward-compatible connectivity check
router.get('/test', (req, res) => {
  res.status(200).send('API WORKING');
});

module.exports = {
  router,
  checkReadiness
};
