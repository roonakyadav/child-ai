/**
 * Deployment Hardening & HTTP Security Configuration Tests
 * 
 * Tests:
 * 1. HTTP security headers (CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy)
 * 2. Framework fingerprint suppression (absence of X-Powered-By)
 * 3. Conditional HSTS (only on HTTPS in production)
 * 4. Production cookie attributes (HttpOnly, Secure, SameSite, Path)
 * 5. Request size limits (413 Payload Too Large)
 * 6. Proxy trust and HTTPS detection
 * 7. Production environment validation without secret leakage
 * 8. 404 catch-all JSON response
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
const { app } = require('../server');
const { validateProductionConfig } = require('../config/validateEnv');
const { getSessionCookieOptions, getClearCookieOptions } = require('../lib/cookieConfig');
const { setParentPinHash } = require('../services/authService');

describe('Production Deployment Hardening & HTTP Security', () => {
  beforeEach(() => {
    // Ensure test PIN is set
    setParentPinHash('1234');
  });

  describe('1. Security Headers & Fingerprint Suppression', () => {
    it('sets hardened security headers on standard API responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);

      // 1. MIME type sniffing defense
      expect(res.headers['x-content-type-options']).toBe('nosniff');

      // 2. Clickjacking defense
      expect(res.headers['x-frame-options']).toBe('DENY');

      // 3. Referrer policy
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

      // 4. Permissions Policy restricts sensitive APIs
      const permissions = res.headers['permissions-policy'];
      expect(permissions).toBeDefined();
      expect(permissions).toContain('camera=()');
      expect(permissions).toContain('microphone=()');
      expect(permissions).toContain('geolocation=()');

      // 5. Content Security Policy
      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: blob:");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");

      // Strictly verify no unsafe-eval
      expect(csp).not.toContain("'unsafe-eval'");

      // 6. Framework fingerprint suppression
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('sets security headers on 404 responses', async () => {
      const res = await request(app).get('/api/non-existent-route-for-headers');
      expect(res.status).toBe(404);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.body).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
    });
  });

  describe('2. Strict-Transport-Security (HSTS) Conditional Enforcement', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('does NOT set HSTS in non-production mode or over HTTP', async () => {
      process.env.NODE_ENV = 'development';
      const res = await request(app).get('/api/health');
      expect(res.headers['strict-transport-security']).toBeUndefined();
    });

    it('does NOT set HSTS in production if request was served over plain HTTP', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app).get('/api/health');
      expect(res.headers['strict-transport-security']).toBeUndefined();
    });

    it('sets HSTS when in production AND request is served over HTTPS via reverse proxy', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .get('/api/health')
        .set('X-Forwarded-Proto', 'https');

      expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    });
  });

  describe('3. Secure Cookie Hardening & Transport Policies', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalCookieSecure = process.env.COOKIE_SECURE;
    const originalCookieSameSite = process.env.COOKIE_SAME_SITE;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.COOKIE_SECURE = originalCookieSecure;
      process.env.COOKIE_SAME_SITE = originalCookieSameSite;
    });

    it('enforces secure, httpOnly, sameSite, and path in production', () => {
      process.env.NODE_ENV = 'production';
      const opts = getSessionCookieOptions();

      expect(opts.httpOnly).toBe(true);
      expect(opts.secure).toBe(true);
      expect(opts.sameSite).toBe('lax');
      expect(opts.path).toBe('/');
      expect(opts.maxAge).toBeGreaterThan(0);
    });

    it('never permits secure cookie downgrade to false in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_SECURE = 'false'; // Malicious or mistaken attempt to downgrade

      const opts = getSessionCookieOptions();
      expect(opts.secure).toBe(true);
    });

    it('automatically mandates secure=true when sameSite is none', () => {
      process.env.NODE_ENV = 'development';
      process.env.COOKIE_SAME_SITE = 'none';

      const opts = getSessionCookieOptions();
      expect(opts.sameSite).toBe('none');
      expect(opts.secure).toBe(true);
    });

    it('provides matching cleanup options for logout clearCookie', () => {
      process.env.NODE_ENV = 'production';
      const clearOpts = getClearCookieOptions();

      expect(clearOpts.httpOnly).toBe(true);
      expect(clearOpts.secure).toBe(true);
      expect(clearOpts.path).toBe('/');
      expect(clearOpts.maxAge).toBeUndefined();
    });

    it('login route issues cookie with configured production attributes', async () => {
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-Proto', 'https')
        .send({ pin: '1234' });

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const sessionCookie = cookies.find(c => c.startsWith('parent_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('Secure');
      expect(sessionCookie).toContain('SameSite=Lax');
      expect(sessionCookie).toContain('Path=/');
    });
  });

  describe('4. Request Body Size Limits & Payload Hardening', () => {
    it('accepts legitimate payloads under the 100kb limit', async () => {
      const normalPayload = { pin: '1234' };
      const res = await request(app)
        .post('/api/auth/parent/login')
        .send(normalPayload);

      expect(res.status).toBe(200);
    });

    it('rejects oversized JSON payloads exceeding 100kb with 413 Payload Too Large', async () => {
      // Create a payload larger than 100kb (~120kb string)
      const oversizedText = 'A'.repeat(125 * 1024);
      const res = await request(app)
        .post('/api/chat')
        .send({ message: oversizedText });

      expect(res.status).toBe(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
      expect(res.body.error).toBe('Payload too large');
    });
  });

  describe('5. Production Environment Validation & Zero-Leakage', () => {
    it('detects missing required production environment variables', () => {
      const emptyEnv = { NODE_ENV: 'production' };
      const result = validateProductionConfig(emptyEnv, false);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('ALLOWED_ORIGINS');
      expect(result.missing).toContain('CONFIG_STORE_PATH');
      expect(result.missing).toContain('GROQ_API_KEY');
    });

    it('flags wildcard ALLOWED_ORIGINS as unsafe in production', () => {
      const wildcardEnv = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://app.example.com, *',
        CONFIG_STORE_PATH: '/tmp/test.json',
        GROQ_API_KEY: 'secret-key-123'
      };

      const result = validateProductionConfig(wildcardEnv, false);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('ALLOWED_ORIGINS_WILDCARD_UNSAFE');
    });

    it('flags invalid session expiry or cookie configurations', () => {
      const invalidEnv = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://app.example.com',
        CONFIG_STORE_PATH: '/tmp/test.json',
        GROQ_API_KEY: 'secret-key-123',
        SESSION_EXPIRY_MS: '-500',
        COOKIE_SAME_SITE: 'invalid_value',
        PORT: '999999'
      };

      const result = validateProductionConfig(invalidEnv, false);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('SESSION_EXPIRY_MS_INVALID');
      expect(result.missing).toContain('COOKIE_SAME_SITE_INVALID');
      expect(result.missing).toContain('PORT_INVALID');
    });

    it('passes validation when all required production configurations are valid', () => {
      const validEnv = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://app.example.com, https://admin.example.com',
        CONFIG_STORE_PATH: '/tmp/test.json',
        GROQ_API_KEY: 'valid-groq-key',
        SESSION_EXPIRY_MS: '1800000',
        COOKIE_SAME_SITE: 'lax',
        PORT: '3001'
      };

      const result = validateProductionConfig(validEnv, false);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('ensures secret values are never printed in validation error lists', () => {
      const envWithSecrets = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: '*',
        CONFIG_STORE_PATH: '',
        GROQ_API_KEY: 'super-sensitive-secret-token'
      };

      const result = validateProductionConfig(envWithSecrets, false);
      const resultString = JSON.stringify(result);

      expect(resultString).not.toContain('super-sensitive-secret-token');
      expect(result.missing.every(m => typeof m === 'string' && !m.includes('secret'))).toBe(true);
    });
  });
});
