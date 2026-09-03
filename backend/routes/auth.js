/**
 * Authentication Routes
 * Handles parent login, session verification, logout, and PIN setup
 */

const express = require('express');
const router = express.Router();
const { generalLimiter } = require('../middleware/rateLimit');
const { validateBody } = require('../validation/middleware');
const { createSession, getSession, deleteSession, hashPin, setParentPinHash, hasParentPin, verifyPinHash, updateParentPinHash, SESSION_EXPIRY_MS } = require('../services/authService');

// POST /api/auth/parent/setup
router.post('/parent/setup', generalLimiter, validateBody('login'), async (req, res) => {
  const { pin } = req.body;

  // Validate PIN format (4-6 digits)
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  }

  // Store PIN hash on server
  setParentPinHash(pin);

  res.status(200).json({ success: true });
});

// GET /api/auth/parent/status
router.get('/parent/status', generalLimiter, (req, res) => {
  const pinConfigured = hasParentPin();
  res.status(200).json({ configured: pinConfigured });
});

// POST /api/auth/parent/update
router.post('/parent/update', generalLimiter, validateBody('login'), async (req, res) => {
  const { pin } = req.body;

  // Validate PIN format (4-6 digits)
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  }

  // Update PIN hash on server
  updateParentPinHash(pin);

  res.status(200).json({ success: true });
});

// POST /api/auth/parent/login
router.post('/parent/login', generalLimiter, validateBody('login'), async (req, res) => {
  const { pin } = req.body;

  // Verify PIN against server-stored hash
  const isValid = verifyPinHash(pin);

  if (!isValid) {
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
