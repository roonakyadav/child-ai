/**
 * Security Headers Middleware
 * 
 * Implements production-grade HTTP security headers:
 * 1. X-Content-Type-Options: nosniff
 * 2. X-Frame-Options: DENY (clickjacking defense)
 * 3. Referrer-Policy: strict-origin-when-cross-origin
 * 4. Permissions-Policy: restricts camera, mic, geolocation, etc.
 * 5. Content-Security-Policy: tailored for the Vite React frontend
 * 6. Strict-Transport-Security: set ONLY when served over HTTPS in production
 * 7. Suppresses framework fingerprints (X-Powered-By)
 */

function securityHeadersMiddleware(req, res, next) {
  // 1. Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // 3. Prevent referrer leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 4. Disable sensitive browser features not needed by this app
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()'
  );

  // 5. Content Security Policy
  // - style-src 'self' 'unsafe-inline' is required by Radix UI, Lucide, and Framer Motion inline styles
  // - img-src 'self' data: blob: is required for avatars, canvases, and generated PDF preview blobs
  // - font-src 'self' data: is required for local fonts and canvas font rendering
  // - frame-ancestors 'none' prevents embedding in iframes
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];

  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  if (isProduction && isHttps) {
    cspDirectives.push('upgrade-insecure-requests');
  }

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // 6. Strict-Transport-Security (HSTS)
  // ONLY set when the request is actually served over HTTPS in production
  if (isProduction && isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // 7. Ensure X-Powered-By is not sent
  res.removeHeader('X-Powered-By');

  next();
}

module.exports = securityHeadersMiddleware;
