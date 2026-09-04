/**
 * Authentication Service
 * Handles server-side session management and PIN storage for parent authentication
 */

const crypto = require('crypto');
const { SESSION_EXPIRY_MS, MAX_ACTIVE_SESSIONS } = require('../config');

// In-memory session storage (bounded)
const sessions = new Map();

// In-memory PIN hash storage (single parent PIN for this application)
let parentPinHash = null;

// Clean expired sessions periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes

// Unref timer so it does not block process exit or test teardown
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Evict expired sessions, and if still at/over capacity, evict the oldest session
 */
function enforceSessionCapacity() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
  while (sessions.size >= MAX_ACTIVE_SESSIONS) {
    const oldestKey = sessions.keys().next().value;
    if (!oldestKey) break;
    sessions.delete(oldestKey);
  }
}

/**
 * Generate cryptographically secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session
 * If a prior session ID is provided, it is invalidated to prevent session fixation
 */
function createSession(oldSessionId = null) {
  if (oldSessionId) {
    deleteSession(oldSessionId);
  }

  if (sessions.size >= MAX_ACTIVE_SESSIONS) {
    enforceSessionCapacity();
  }

  const sessionId = generateSessionToken();
  const now = Date.now();
  const session = {
    id: sessionId,
    createdAt: now,
    expiresAt: now + SESSION_EXPIRY_MS,
    authenticated: true,
    role: 'parent'
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

// Scrypt configuration for slow, memory-hard PIN derivation
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost (2^14)
  r: 8,     // Block size
  p: 1,     // Parallelization parameter
  maxmem: 32 * 1024 * 1024 // 32 MB
};
const SALT_LENGTH = 16; // 128-bit cryptographically random salt
const KEY_LENGTH = 32;  // 256-bit derived key length

/**
 * Hash PIN using Node's crypto.scryptSync with a unique cryptographically random salt
 * Encodes parameters, salt, and derived key into a self-describing string format:
 * scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>
 */
function hashPin(pin, customSalt = null) {
  const salt = customSalt || crypto.randomBytes(SALT_LENGTH);
  const derivedKey = crypto.scryptSync(pin, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Set parent PIN hash on server (only if not already configured)
 */
function setParentPinHash(pin) {
  if (parentPinHash !== null) {
    return false;
  }
  parentPinHash = hashPin(pin);
  return true;
}

/**
 * Get parent PIN hash status (whether PIN is configured)
 */
function hasParentPin() {
  return parentPinHash !== null;
}

/**
 * Verify PIN against server-stored hash using constant-time comparison
 * @param {string} pin - Raw candidate PIN
 * @param {string} [storedHash] - Optional specific hash to verify against (defaults to server parentPinHash)
 */
function verifyPinHash(pin, storedHash = null) {
  const target = storedHash !== null ? storedHash : parentPinHash;
  if (!target || typeof target !== 'string' || typeof pin !== 'string') {
    return false;
  }

  try {
    const parts = target.split('$');
    const isPrefixed = parts[0] === '';
    const scheme = isPrefixed ? parts[1] : parts[0];
    const paramsStr = isPrefixed ? parts[2] : parts[1];
    const saltHex = isPrefixed ? parts[3] : parts[2];
    const hashHex = isPrefixed ? parts[4] : parts[3];

    if (scheme !== 'scrypt' || !paramsStr || !saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(hashHex, 'hex');

    if (salt.length !== SALT_LENGTH || expectedKey.length !== KEY_LENGTH) {
      return false;
    }

    const paramPairs = Object.fromEntries(
      paramsStr.split(',').map(pair => pair.split('='))
    );

    const cost = {
      N: parseInt(paramPairs.N, 10) || SCRYPT_PARAMS.N,
      r: parseInt(paramPairs.r, 10) || SCRYPT_PARAMS.r,
      p: parseInt(paramPairs.p, 10) || SCRYPT_PARAMS.p,
      maxmem: 32 * 1024 * 1024
    };

    const actualKey = crypto.scryptSync(pin, salt, expectedKey.length, cost);

    return crypto.timingSafeEqual(expectedKey, actualKey);
  } catch {
    return false;
  }
}

/**
 * Update parent PIN hash on server
 */
function updateParentPinHash(newPin) {
  parentPinHash = hashPin(newPin);
  return true;
}

/**
 * Reset service state for clean test isolation
 */
function _resetForTesting() {
  sessions.clear();
  parentPinHash = null;
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  hashPin,
  setParentPinHash,
  hasParentPin,
  verifyPinHash,
  updateParentPinHash,
  _resetForTesting,
  sessions,
  SESSION_EXPIRY_MS
};
