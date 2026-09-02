/**
 * Authentication Service
 * Handles server-side session management for parent authentication
 */

const crypto = require('crypto');
const { SESSION_EXPIRY_MS } = require('../config');

// In-memory session storage
const sessions = new Map();

// Clean expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

/**
 * Generate cryptographically secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session
 */
function createSession() {
  const sessionId = generateSessionToken();
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
    authenticated: true
  };

  sessions.set(sessionId, session);
  return session;
}

/**
 * Get session by ID
 */
function getSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check expiry
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  // Refresh session expiry
  session.expiresAt = Date.now() + SESSION_EXPIRY_MS;
  sessions.set(sessionId, session);

  return session;
}

/**
 * Delete session by ID
 */
function deleteSession(sessionId) {
  if (sessionId) {
    sessions.delete(sessionId);
  }
}

/**
 * Hash PIN for comparison
 */
function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  hashPin,
  SESSION_EXPIRY_MS
};
