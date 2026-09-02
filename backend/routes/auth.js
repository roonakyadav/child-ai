/**
 * Authentication Routes
 * Handles parent login, session verification, and logout
 */

const express = require('express');
const router = express.Router();
const { generalLimiter } = require('../middleware/rateLimit');
const { validateBody } = require('../validation/middleware');
const { createSession, getSession, deleteSession, hashPin, SESSION_EXPIRY_MS } = require('../services/authService');

// POST /api/auth/parent/login
router.post('/parent/login', generalLimiter, validateBody('login'), async (req, res) => {
  const { pin, storedPinHash } = req.body;

  // Hash the PIN for comparison (same as frontend)
  const pinHash = hashPin(pin);

  if (pinHash !== storedPinHash) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // Create session
  const session = createSession();

  // Set HTTP-only cookie
  res.cookie('parent_session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_MS,
    path: '/'
  });

  res.status(200).json({ success: true });
});

// GET /api/auth/parent/session
router.get('/parent/session', generalLimiter, (req, res) => {
  const sessionId = req.cookies.parent_session;

  if (!sessionId) {
    return res.status(401).json({ authenticated: false });
  }

  const session = getSession(sessionId);

  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  res.status(200).json({ authenticated: true });
});

// POST /api/auth/parent/logout
router.post('/parent/logout', generalLimiter, (req, res) => {
  const sessionId = req.cookies.parent_session;

  if (sessionId) {
    deleteSession(sessionId);
  }

  res.clearCookie('parent_session', { path: '/' });
  res.status(200).json({ success: true });
});

module.exports = router;
