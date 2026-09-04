/**
 * Authentication Routes
 * Handles parent login, session verification, logout, and PIN setup/update
 */

const express = require('express');
const router = express.Router();
const { generalLimiter, authLimiter } = require('../middleware/rateLimit');
const { requireParentAuth } = require('../middleware/auth');
const { validateBody } = require('../validation/middleware');
const {
  createSession,
  getSession,
  deleteSession,
  setParentPinHash,
  hasParentPin,
  verifyPinHash,
  updateParentPinHash,
  SESSION_EXPIRY_MS
} = require('../services/authService');

// POST /api/auth/parent/setup
// Initial setup of parent PIN (only allowed if PIN is not yet configured)
router.post('/parent/setup', authLimiter, validateBody('login'), async (req, res) => {
  const { pin } = req.body;

  if (hasParentPin()) {
    return res.status(403).json({ error: 'PIN is already configured' });
  }

  // Store PIN hash on server
  const success = setParentPinHash(pin);
  if (!success) {
    return res.status(403).json({ error: 'PIN is already configured' });
  }

  res.status(200).json({ success: true });
});

// GET /api/auth/parent/status
// Check whether parent PIN is configured
router.get('/parent/status', generalLimiter, (req, res) => {
  const pinConfigured = hasParentPin();
  res.status(200).json({ configured: pinConfigured });
});

// POST /api/auth/parent/update
// Update parent PIN (strictly requires authenticated parent session)
router.post('/parent/update', authLimiter, requireParentAuth, validateBody('login'), async (req, res) => {
  const { pin } = req.body;

  // Update PIN hash on server
  updateParentPinHash(pin);

  res.status(200).json({ success: true });
});

// POST /api/auth/parent/login
// Login with PIN, creates a new session and sets HTTP-only cookie
router.post('/parent/login', authLimiter, validateBody('login'), async (req, res) => {
  const { pin } = req.body;

  // Verify PIN against server-stored hash
  const isValid = verifyPinHash(pin);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // Session fixation defense: invalidate any prior session cookie before creating fresh session
  const oldSessionId = req.cookies ? req.cookies.parent_session : null;
  const session = createSession(oldSessionId);

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
// Check if current session cookie is valid
router.get('/parent/session', generalLimiter, (req, res) => {
  const sessionId = req.cookies ? req.cookies.parent_session : null;

  if (!sessionId) {
    return res.status(401).json({ authenticated: false });
  }

  const session = getSession(sessionId);

  if (!session || !session.authenticated) {
    return res.status(401).json({ authenticated: false });
  }

  res.status(200).json({ authenticated: true });
});

// POST /api/auth/parent/logout
// Terminate session and clear cookie
router.post('/parent/logout', generalLimiter, (req, res) => {
  const sessionId = req.cookies ? req.cookies.parent_session : null;

  if (sessionId) {
    deleteSession(sessionId);
  }

  res.clearCookie('parent_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  res.status(200).json({ success: true });
});

module.exports = router;
