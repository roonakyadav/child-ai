/**
 * Authentication Middleware
 * Validates HTTP-only parent session cookie and attaches authenticated context
 */

const { getSession } = require('../services/authService');

/**
 * Require valid parent session
 * Rejects unauthenticated requests with 401
 */
function requireParentAuth(req, res, next) {
  const sessionId = req.cookies ? req.cookies.parent_session : null;

  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = getSession(sessionId);

  if (!session || !session.authenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Attach authenticated parent context to request
  req.parent = {
    role: session.role || 'parent',
    authenticated: true
  };

  next();
}

module.exports = {
  requireParentAuth
};
