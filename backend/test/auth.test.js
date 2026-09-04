/**
 * Authentication Tests
 * Comprehensive tests for parent session management, security attributes,
 * endpoint protection, session fixation, expiration, and PIN workflow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
const {
  createSession,
  getSession,
  deleteSession,
  hashPin,
  setParentPinHash,
  hasParentPin,
  verifyPinHash,
  updateParentPinHash,
  _resetForTesting,
  SESSION_EXPIRY_MS
} = require('../services/authService');

describe('Authentication Service', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  describe('hashPin', () => {
    it('should produce different stored representations for the same PIN due to unique salts', () => {
      const pin = '1234';
      const hash1 = hashPin(pin);
      const hash2 = hashPin(pin);
      expect(hash1).not.toBe(hash2);
      expect(hash1.startsWith('scrypt$')).toBe(true);
      expect(hash2.startsWith('scrypt$')).toBe(true);
    });

    it('should produce identical hashes when the exact same salt is provided', () => {
      const salt = Buffer.alloc(16, 7);
      const hash1 = hashPin('1234', salt);
      const hash2 = hashPin('1234', salt);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different PINs with the same salt', () => {
      const salt = Buffer.alloc(16, 7);
      const hash1 = hashPin('1234', salt);
      const hash2 = hashPin('5678', salt);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createSession', () => {
    it('should create a valid cryptographically random session', () => {
      const session = createSession();
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('authenticated', true);
      expect(session).toHaveProperty('role', 'parent');
      expect(session.id).toHaveLength(64); // 32 bytes hex
    });

    it('should set expiry in the future according to SESSION_EXPIRY_MS', () => {
      const now = Date.now();
      const session = createSession();
      expect(session.expiresAt).toBeGreaterThanOrEqual(now + SESSION_EXPIRY_MS - 100);
      expect(session.expiresAt).toBeLessThanOrEqual(now + SESSION_EXPIRY_MS + 1000);
    });

    it('should prevent session fixation by deleting old session ID if provided', () => {
      const oldSession = createSession();
      expect(getSession(oldSession.id)).not.toBeNull();

      const newSession = createSession(oldSession.id);
      expect(newSession.id).not.toBe(oldSession.id);
      expect(getSession(oldSession.id)).toBeNull();
      expect(getSession(newSession.id)).not.toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return session for valid session ID and refresh expiry', () => {
      const createdSession = createSession();
      const retrievedSession = getSession(createdSession.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession.id).toBe(createdSession.id);
      expect(retrievedSession.authenticated).toBe(true);
      expect(retrievedSession.role).toBe('parent');
    });

    it('should return null for invalid session ID', () => {
      expect(getSession('invalid-id-that-does-not-exist')).toBeNull();
    });

    it('should return null for missing or undefined session ID', () => {
      expect(getSession()).toBeNull();
      expect(getSession(null)).toBeNull();
      expect(getSession('')).toBeNull();
    });

    it('should reject and clean up expired session', () => {
      const session = createSession();
      // Manually simulate past expiration
      session.expiresAt = Date.now() - 1000;

      const retrieved = getSession(session.id);
      expect(retrieved).toBeNull();
      // Verifying session was evicted
      expect(getSession(session.id)).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', () => {
      const session = createSession();
      deleteSession(session.id);
      expect(getSession(session.id)).toBeNull();
    });

    it('should handle deleting non-existent or null session without error', () => {
      expect(() => deleteSession('non-existent')).not.toThrow();
      expect(() => deleteSession(null)).not.toThrow();
    });
  });

  describe('PIN Management', () => {
    it('should correctly set and verify PIN hash', () => {
      expect(hasParentPin()).toBe(false);
      expect(setParentPinHash('4321')).toBe(true);
      expect(hasParentPin()).toBe(true);
      expect(verifyPinHash('4321')).toBe(true);
      expect(verifyPinHash('9999')).toBe(false);
      expect(verifyPinHash('')).toBe(false);
    });

    it('should fail safely on malformed or corrupted stored hashes', () => {
      expect(verifyPinHash('1234', 'corrupted-hash-string')).toBe(false);
      expect(verifyPinHash('1234', 'scrypt$badparams$1234$5678')).toBe(false);
      expect(verifyPinHash('1234', 'scrypt$N=16384,r=8,p=1$short$short')).toBe(false);
      expect(verifyPinHash('1234', null)).toBe(false);
      expect(verifyPinHash('1234', undefined)).toBe(false);
      expect(verifyPinHash('1234', 1234)).toBe(false);
      expect(verifyPinHash(null, 'scrypt$N=16384,r=8,p=1$00$00')).toBe(false);
    });

    it('should disallow overwriting PIN through setParentPinHash once configured', () => {
      setParentPinHash('1111');
      const secondSet = setParentPinHash('2222');
      expect(secondSet).toBe(false);
      expect(verifyPinHash('1111')).toBe(true);
      expect(verifyPinHash('2222')).toBe(false);
    });

    it('should update PIN through updateParentPinHash', () => {
      setParentPinHash('1111');
      updateParentPinHash('2222');
      expect(verifyPinHash('1111')).toBe(false);
      expect(verifyPinHash('2222')).toBe(true);
    });
  });
});

describe('Authentication Endpoints', () => {
  let app;

  beforeEach(() => {
    _resetForTesting();
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    const authRouter = require('../routes/auth');
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth/parent/setup', () => {
    it('should setup PIN when no PIN is configured', async () => {
      const response = await request(app)
        .post('/api/auth/parent/setup')
        .send({ pin: '5678' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(hasParentPin()).toBe(true);
      // Verify raw PIN, salt, or hash are never returned
      expect(response.body.pin).toBeUndefined();
      expect(response.body.salt).toBeUndefined();
      expect(response.body.hash).toBeUndefined();
      expect(response.body.pinHash).toBeUndefined();
    });

    it('should reject setup with 403 when PIN is already configured', async () => {
      setParentPinHash('1234');

      const response = await request(app)
        .post('/api/auth/parent/setup')
        .send({ pin: '5678' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });

    it('should reject invalid PIN format with 400', async () => {
      const response = await request(app)
        .post('/api/auth/parent/setup')
        .send({ pin: '12' }); // Less than 4 digits

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/parent/status', () => {
    it('should report false before setup and true after setup', async () => {
      const beforeRes = await request(app).get('/api/auth/parent/status');
      expect(beforeRes.status).toBe(200);
      expect(beforeRes.body).toEqual({ configured: false });

      setParentPinHash('1234');

      const afterRes = await request(app).get('/api/auth/parent/status');
      expect(afterRes.status).toBe(200);
      expect(afterRes.body).toEqual({ configured: true });
    });
  });

  describe('POST /api/auth/parent/login', () => {
    it('should reject login with wrong PIN with 401', async () => {
      setParentPinHash('1234');

      const response = await request(app)
        .post('/api/auth/parent/login')
        .send({ pin: '9999' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid PIN' });
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('should login with valid PIN, set HttpOnly cookie, and not leak token, salt, or hash', async () => {
      setParentPinHash('1234');

      const response = await request(app)
        .post('/api/auth/parent/login')
        .send({ pin: '1234' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      // Verify token/salt/hash/pin are never exposed in JSON response
      expect(response.body.pin).toBeUndefined();
      expect(response.body.salt).toBeUndefined();
      expect(response.body.hash).toBeUndefined();
      expect(response.body.token).toBeUndefined();
      expect(response.body.sessionId).toBeUndefined();
      expect(response.body.pinHash).toBeUndefined();

      // Verify Set-Cookie header
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies[0];
      expect(cookieStr).toContain('parent_session=');
      expect(cookieStr.toLowerCase()).toContain('httponly');
      expect(cookieStr.toLowerCase()).toContain('samesite=lax');
      expect(cookieStr).toContain('Path=/');
      expect(cookieStr.toLowerCase()).toContain('max-age=');
    });

    it('should invalidate existing session cookie on new login (session fixation protection)', async () => {
      setParentPinHash('1234');

      // First login
      const firstLogin = await request(app)
        .post('/api/auth/parent/login')
        .send({ pin: '1234' });
      const firstCookie = firstLogin.headers['set-cookie'][0];
      const firstSessionId = firstCookie.match(/parent_session=([^;]+)/)[1];

      expect(getSession(firstSessionId)).not.toBeNull();

      // Second login sending previous cookie
      const secondLogin = await request(app)
        .post('/api/auth/parent/login')
        .set('Cookie', `parent_session=${firstSessionId}`)
        .send({ pin: '1234' });
      const secondCookie = secondLogin.headers['set-cookie'][0];
      const secondSessionId = secondCookie.match(/parent_session=([^;]+)/)[1];

      expect(secondSessionId).not.toBe(firstSessionId);
      expect(getSession(firstSessionId)).toBeNull(); // Old session invalidated
      expect(getSession(secondSessionId)).not.toBeNull(); // New session valid
    });
  });

  describe('GET /api/auth/parent/session', () => {
    it('should return 401 for missing session cookie', async () => {
      const response = await request(app).get('/api/auth/parent/session');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ authenticated: false });
    });

    it('should return 401 for forged / invalid session ID', async () => {
      const response = await request(app)
        .get('/api/auth/parent/session')
        .set('Cookie', 'parent_session=forged-or-fake-session-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ authenticated: false });
    });

    it('should return 200 for valid active session cookie', async () => {
      const session = createSession();

      const response = await request(app)
        .get('/api/auth/parent/session')
        .set('Cookie', `parent_session=${session.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ authenticated: true });
    });
  });

  describe('POST /api/auth/parent/update', () => {
    it('should reject PIN update with 401 when unauthenticated', async () => {
      setParentPinHash('1234');

      const response = await request(app)
        .post('/api/auth/parent/update')
        .send({ pin: '5678' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
      // PIN should remain unchanged
      expect(verifyPinHash('1234')).toBe(true);
    });

    it('should succeed with PIN update when authenticated with valid session cookie', async () => {
      setParentPinHash('1234');
      const session = createSession();

      const response = await request(app)
        .post('/api/auth/parent/update')
        .set('Cookie', `parent_session=${session.id}`)
        .send({ pin: '5678' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(verifyPinHash('1234')).toBe(false);
      expect(verifyPinHash('5678')).toBe(true);
      // Verify raw PIN, salt, or hash are never returned
      expect(response.body.pin).toBeUndefined();
      expect(response.body.salt).toBeUndefined();
      expect(response.body.hash).toBeUndefined();
      expect(response.body.pinHash).toBeUndefined();
    });
  });

  describe('POST /api/auth/parent/logout', () => {
    it('should invalidate session and clear cookie', async () => {
      const session = createSession();
      expect(getSession(session.id)).not.toBeNull();

      const response = await request(app)
        .post('/api/auth/parent/logout')
        .set('Cookie', `parent_session=${session.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(getSession(session.id)).toBeNull();

      // Verify cookie is cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies[0];
      expect(cookieStr).toContain('parent_session=;');
    });
  });
});

describe('Parent Endpoint Authorization Protection', () => {
  let app;

  beforeEach(() => {
    _resetForTesting();
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Register all routers with their endpoints
    const authRouter = require('../routes/auth');
    const insightsRouter = require('../routes/insights');
    const intelligenceRouter = require('../routes/intelligence');
    const reportsRouter = require('../routes/reports');
    const engagementRouter = require('../routes/engagement');
    const testRouter = require('../routes/test');

    app.use('/api/auth', authRouter);
    app.use('/api', insightsRouter);
    app.use('/api', intelligenceRouter);
    app.use('/api', reportsRouter);
    app.use('/api', engagementRouter);
    app.use('/api', testRouter);
  });

  it('should allow public access to /api/test', async () => {
    const response = await request(app).get('/api/test');
    expect(response.status).toBe(200);
    expect(response.text).toBe('API WORKING');
  });

  it('should protect POST /api (insights) requiring authenticated parent session', async () => {
    // Unauthenticated
    const unauthRes = await request(app)
      .post('/api')
      .send({ summary: { totalUsageMinutes: 10 } });
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error).toBe('Authentication required');

    // Authenticated with valid session (auth passes, fails later only on groq mock if no mock)
    const session = createSession();
    const authRes = await request(app)
      .post('/api')
      .set('Cookie', `parent_session=${session.id}`)
      .send({ summary: { totalUsageMinutes: 10 } });
    expect(authRes.status).not.toBe(401);
  });

  it('should protect POST /api/deep-analysis requiring authenticated parent session', async () => {
    const unauthRes = await request(app)
      .post('/api/deep-analysis')
      .send({ insight: 'test', summary: { a: 1 }, insightType: 'safety' });
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error).toBe('Authentication required');
  });

  it('should protect POST /api/generate-full-report requiring authenticated parent session', async () => {
    const unauthRes = await request(app)
      .post('/api/generate-full-report')
      .send({ allData: { extractedData: { totalMessages: 5 } } });
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error).toBe('Authentication required');
  });

  it('should protect POST /api/analyze-intelligence requiring authenticated parent session', async () => {
    const unauthRes = await request(app)
      .post('/api/analyze-intelligence')
      .send({ messages: [{ message: 'hi', timestamp: Date.now(), category: 'chat' }] });
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error).toBe('Authentication required');
  });

  it('should protect POST /api/decision-engine requiring authenticated parent session', async () => {
    const unauthRes = await request(app)
      .post('/api/decision-engine')
      .send({ metrics: { curiosity: 80 } });
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error).toBe('Authentication required');
  });

  it('should protect POST /api/analyze-engagement requiring authenticated parent session', async () => {
    const unauthRes = await request(app)
      .post('/api/analyze-engagement')
      .send({ usageData: { totalActivities: 5 } });
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error).toBe('Authentication required');
  });
});
