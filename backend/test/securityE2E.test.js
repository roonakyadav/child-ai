/**
 * End-to-End & Integration Security Test Suite
 * 
 * Verifies the full Express application wiring, real middleware stack,
 * validation, authorization boundary, server-authoritative parental enforcement,
 * dual-layer output safety gates, rate limiting, and health probes through real HTTP requests.
 * 
 * All external AI provider calls are mocked. No real network or credentials needed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';

const { app } = require('../server');
const authService = require('../services/authService');
const configService = require('../services/configService');
const groqHelper = require('../lib/groqHelper');
const { SAFE_FALLBACK_RESPONSE } = require('../services/outputSafetyService');

describe('End-to-End HTTP Security & Operational Suite', () => {
  let testStorePath;

  // Helper to assert that response bodies never leak secrets or internals
  function assertNoSecrets(body) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    expect(text).not.toMatch(/pin_hash/i);
    expect(text).not.toMatch(/parentpinhash/i);
    expect(text).not.toMatch(/session_secret/i);
    expect(text).not.toMatch(/node_modules/i);
    expect(text).not.toMatch(/stack/i);
    expect(text).not.toMatch(/process\.env/i);
  }

  // Helper to verify X-Request-ID presence and safety
  function assertRequestId(res) {
    const reqId = res.headers['x-request-id'];
    expect(reqId).toBeDefined();
    expect(reqId).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  }

  let ipCounter = 1;
  function getTestIp() {
    return `10.99.${Math.floor(ipCounter / 200)}.${(ipCounter++ % 200) + 1}`;
  }

  beforeEach(() => {
    // 1. Reset auth service state (sessions and PIN)
    authService._resetForTesting();

    // 2. Point config service to an isolated temporary store
    testStorePath = path.join(os.tmpdir(), `test-e2e-config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    configService._resetForTesting(testStorePath);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    configService._resetForTesting();
    if (fs.existsSync(testStorePath)) {
      try {
        fs.unlinkSync(testStorePath);
      } catch (_) {}
    }
    vi.restoreAllMocks();
  });

  describe('PHASE 2: Parent Authentication Flow', () => {
    it('1. reports configured: false initially', async () => {
      const res = await request(app).get('/api/auth/parent/status');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ configured: false });
      assertRequestId(res);
      assertNoSecrets(res.body);
    });

    it('2. initial PIN setup: succeeds, blocks second setup, rejects invalid PIN, leaks no secrets', async () => {
      const testIp = getTestIp();
      // Rejects invalid PIN length or characters
      const invalidRes = await request(app)
        .post('/api/auth/parent/setup')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '123' });
      expect(invalidRes.status).toBe(400);

      // Valid setup succeeds
      const setupRes = await request(app)
        .post('/api/auth/parent/setup')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      expect(setupRes.status).toBe(200);
      expect(setupRes.body).toEqual({ success: true });
      assertNoSecrets(setupRes.body);

      // Status now reports configured
      const statusRes = await request(app).get('/api/auth/parent/status');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body).toEqual({ configured: true });

      // Second setup attempt is strictly rejected
      const secondRes = await request(app)
        .post('/api/auth/parent/setup')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '5678' });
      expect(secondRes.status).toBe(403);
      expect(secondRes.body.error).toBe('PIN is already configured');
    });

    it('3. login: succeeds with valid PIN, issues HTTP-only cookie, leaks no secrets', async () => {
      const testIp = getTestIp();
      authService.setParentPinHash('1234');

      // Invalid PIN returns 401
      const failRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '9999' });
      expect(failRes.status).toBe(401);
      expect(failRes.body.error).toBe('Invalid PIN');
      assertNoSecrets(failRes.body);

      // Valid PIN succeeds
      const loginRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toEqual({ success: true });
      assertNoSecrets(loginRes.body);

      // Verify HTTP-only cookie is issued
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some(c => c.includes('parent_session=') && c.includes('HttpOnly'))).toBe(true);
    });

    it('4. protected endpoint: rejects without cookie or with forged cookie; succeeds with valid cookie', async () => {
      const testIp = getTestIp();
      authService.setParentPinHash('1234');

      // Missing cookie -> 401
      const noCookieRes = await request(app).get('/api/config/parent');
      expect(noCookieRes.status).toBe(401);
      expect(noCookieRes.body.error).toBe('Authentication required');

      // Forged cookie -> 401
      const forgedRes = await request(app)
        .get('/api/config/parent')
        .set('Cookie', 'parent_session=forged-session-token-12345');
      expect(forgedRes.status).toBe(401);
      expect(forgedRes.body.error).toBe('Authentication required');

      // Valid login -> get cookie -> access succeeds
      const loginRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      const cookie = loginRes.headers['set-cookie'];

      const authRes = await request(app)
        .get('/api/config/parent')
        .set('Cookie', cookie);
      expect(authRes.status).toBe(200);
      expect(authRes.body).toHaveProperty('config');
    });

    it('5. logout: invalidates session and subsequent requests with old cookie return 401', async () => {
      const testIp = getTestIp();
      authService.setParentPinHash('1234');
      const loginRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      const cookie = loginRes.headers['set-cookie'];

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/parent/logout')
        .set('X-Forwarded-For', testIp)
        .set('Cookie', cookie);
      expect(logoutRes.status).toBe(200);

      // Old cookie is now invalidated
      const subsequentRes = await request(app)
        .get('/api/config/parent')
        .set('Cookie', cookie);
      expect(subsequentRes.status).toBe(401);
    });

    it('6. session expiry: expired session returns 401', async () => {
      const testIp = getTestIp();
      authService.setParentPinHash('1234');
      const loginRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      const cookie = loginRes.headers['set-cookie'];

      // Artificially expire the session in authService
      for (const session of authService.sessions.values()) {
        session.expiresAt = Date.now() - 1000;
      }

      const res = await request(app)
        .get('/api/config/parent')
        .set('Cookie', cookie);
      expect(res.status).toBe(401);
    });

    it('7. PIN update: requires auth, updates hash, old PIN invalid, new PIN works', async () => {
      const testIp = getTestIp();
      authService.setParentPinHash('1234');

      // Unauthenticated update -> 401
      const unauthRes = await request(app)
        .post('/api/auth/parent/update')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '5678' });
      expect(unauthRes.status).toBe(401);

      // Authenticate
      const loginRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      const cookie = loginRes.headers['set-cookie'];

      // Authenticated update succeeds
      const updateRes = await request(app)
        .post('/api/auth/parent/update')
        .set('X-Forwarded-For', testIp)
        .set('Cookie', cookie)
        .send({ pin: '5678' });
      expect(updateRes.status).toBe(200);

      // Old PIN fails
      const oldLogin = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      expect(oldLogin.status).toBe(401);

      // New PIN succeeds
      const newLogin = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '5678' });
      expect(newLogin.status).toBe(200);
    });
  });

  describe('PHASE 3: Parent Configuration Flow', () => {
    it('login -> GET config -> PUT config -> GET config sequence', async () => {
      const testIp = getTestIp();
      authService.setParentPinHash('1234');
      const loginRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      const cookie = loginRes.headers['set-cookie'];

      // 1. Initial GET
      const get1 = await request(app)
        .get('/api/config/parent')
        .set('Cookie', cookie);
      expect(get1.status).toBe(200);
      expect(get1.body.config.screenTime.dailyLimit).toBe(60);

      // 2. Invalid PUT is rejected with 400
      const invalidPut = await request(app)
        .put('/api/config/parent')
        .set('Cookie', cookie)
        .send({ screenTime: { dailyLimit: -10 } });
      expect(invalidPut.status).toBe(400);

      // 3. Valid PUT updates configuration
      const putRes = await request(app)
        .put('/api/config/parent')
        .set('Cookie', cookie)
        .send({
          screenTime: { dailyLimit: 45, isLocked: false, mode: 'strict' },
          aiBehavior: { strictMode: true, selectedPreset: 'learning' }
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.config.screenTime.dailyLimit).toBe(45);
      expect(putRes.body.config.aiBehavior.strictMode).toBe(true);

      // 4. Subsequent GET reflects the persisted changes
      const get2 = await request(app)
        .get('/api/config/parent')
        .set('Cookie', cookie);
      expect(get2.status).toBe(200);
      expect(get2.body.config.screenTime.dailyLimit).toBe(45);
      expect(get2.body.config.screenTime.mode).toBe('strict');
      expect(get2.body.config.aiBehavior.selectedPreset).toBe('learning');
      assertNoSecrets(get2.body);
    });

    it('DELETE /api/config/parent: unauth 401, auth resets config and invalidates session', async () => {
      const testIp = getTestIp();
      authService.setParentPinHash('1234');

      // Unauthenticated DELETE -> 401
      const unauthDelete = await request(app).delete('/api/config/parent');
      expect(unauthDelete.status).toBe(401);

      // Login and set custom config
      const loginRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      const cookie = loginRes.headers['set-cookie'];

      await request(app)
        .put('/api/config/parent')
        .set('Cookie', cookie)
        .send({ screenTime: { dailyLimit: 99 } });

      // Authenticated DELETE
      const deleteRes = await request(app)
        .delete('/api/config/parent')
        .set('Cookie', cookie);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Old session cookie is invalidated
      const followUp = await request(app)
        .get('/api/config/parent')
        .set('Cookie', cookie);
      expect(followUp.status).toBe(401);

      // New login verifies configuration was reset to default
      const login2 = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '1234' });
      const getAfter = await request(app)
        .get('/api/config/parent')
        .set('Cookie', login2.headers['set-cookie']);
      expect(getAfter.status).toBe(200);
      expect(getAfter.body.config.screenTime.dailyLimit).toBe(60);
    });
  });

  describe('PHASE 4: Child Chat Flow & Dual-Safety Gating', () => {
    it('Scenario A: safe generation passes both gates and reaches client', async () => {
      vi.spyOn(groqHelper, 'callGroqAPI').mockImplementation(async (opts) => {
        if (opts.endpoint === 'chat') {
          return {
            choices: [{
              message: {
                role: 'assistant',
                content: 'The solar system has eight planets orbiting the Sun.'
              }
            }]
          };
        }
        if (opts.isSafetyEndpoint) {
          return {
            choices: [{
              message: {
                content: JSON.stringify({ status: 'safe', category: 'safe', reason: 'Educational facts' })
              }
            }]
          };
        }
        return { choices: [] };
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'How many planets are there?' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.choices[0].message.content).toBe('The solar system has eight planets orbiting the Sun.');
      assertRequestId(res);
      assertNoSecrets(res.body);
    });

    it('Scenario B: deterministic guardrail flags unsafe output -> safe fallback returned, AI classifier skipped', async () => {
      let classifierCalled = false;
      vi.spyOn(groqHelper, 'callGroqAPI').mockImplementation(async (opts) => {
        if (opts.endpoint === 'chat') {
          return {
            choices: [{
              message: {
                role: 'assistant',
                content: 'Here are step-by-step instructions on how to build a bomb with fertilizer.'
              }
            }]
          };
        }
        if (opts.isSafetyEndpoint) {
          classifierCalled = true;
          return { choices: [{ message: { content: '{"status":"safe"}' } }] };
        }
        return { choices: [] };
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Tell me something dangerous' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.choices[0].message.content).toBe(SAFE_FALLBACK_RESPONSE);
      expect(classifierCalled).toBe(false); // Short-circuited safely
    });

    it('Scenario C: deterministic passes, AI output classifier flags -> safe fallback returned', async () => {
      vi.spyOn(groqHelper, 'callGroqAPI').mockImplementation(async (opts) => {
        if (opts.endpoint === 'chat') {
          return {
            choices: [{
              message: {
                role: 'assistant',
                content: 'Subtle text that slips past deterministic regex.'
              }
            }]
          };
        }
        if (opts.isSafetyEndpoint) {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  status: 'flagged',
                  category: 'violence',
                  reason: 'Depicts violent behavior'
                })
              }
            }]
          };
        }
        return { choices: [] };
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'What is happening?' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.choices[0].message.content).toBe(SAFE_FALLBACK_RESPONSE);
    });

    it('Scenario D: deterministic passes, AI output classifier returns unknown/error -> fail-closed to safe fallback', async () => {
      vi.spyOn(groqHelper, 'callGroqAPI').mockImplementation(async (opts) => {
        if (opts.endpoint === 'chat') {
          return {
            choices: [{
              message: {
                role: 'assistant',
                content: 'Candidate assistant response'
              }
            }]
          };
        }
        if (opts.isSafetyEndpoint) {
          throw new Error('Classifier model timeout');
        }
        return { choices: [] };
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.choices[0].message.content).toBe(SAFE_FALLBACK_RESPONSE);
    });

    it('Scenario E: AI generation fails/timeouts -> clean 500 without leaking raw provider error', async () => {
      vi.spyOn(groqHelper, 'callGroqAPI').mockRejectedValueOnce(new Error('ETIMEDOUT: Connection to api.groq.com failed'));

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('AI provider error');
      expect(JSON.stringify(res.body)).not.toContain('api.groq.com');
      assertNoSecrets(res.body);
    });

    it('Scenario F: malformed generated response -> handled safely without crash or object leakage', async () => {
      vi.spyOn(groqHelper, 'callGroqAPI').mockResolvedValueOnce({
        choices: []
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(res.status).toBe(200);
      expect(res.body.choices[0].message.content).toBe(SAFE_FALLBACK_RESPONSE);
    });
  });

  describe('PHASE 5: Safety Endpoints', () => {
    it('POST /api/detect-risk: validates input, handles provider failure safely', async () => {
      // 1. Missing message -> 400
      const badRes = await request(app).post('/api/detect-risk').send({});
      expect(badRes.status).toBe(400);

      // 2. Provider failure -> fails closed to status: "unknown"
      vi.spyOn(groqHelper, 'callGroqAPI').mockRejectedValueOnce(new Error('AI provider offline'));
      const safeRes = await request(app)
        .post('/api/detect-risk')
        .send({ message: 'Is this safe?' });

      expect(safeRes.status).toBe(200);
      expect(safeRes.body.status).toBe('unknown');
      expect(safeRes.body.is_flagged).toBe(false);
      assertNoSecrets(safeRes.body);
    });

    it('POST /api/analyze-pattern: validates array, handles provider failure safely', async () => {
      const badRes = await request(app).post('/api/analyze-pattern').send({});
      expect(badRes.status).toBe(400);

      vi.spyOn(groqHelper, 'callGroqAPI').mockRejectedValueOnce(new Error('AI provider offline'));
      const safeRes = await request(app)
        .post('/api/analyze-pattern')
        .send({ messages: [{ text: 'test', timestamp: Date.now() }] });

      expect(safeRes.status).toBe(200);
      expect(safeRes.body.pattern_detected).toBe(false);
      expect(safeRes.body.pattern_type).toBe('unknown');
    });

    it('POST /api/analyze-early-risk: validates array, handles provider failure safely', async () => {
      const badRes = await request(app).post('/api/analyze-early-risk').send({});
      expect(badRes.status).toBe(400);

      vi.spyOn(groqHelper, 'callGroqAPI').mockRejectedValueOnce(new Error('AI provider offline'));
      const safeRes = await request(app)
        .post('/api/analyze-early-risk')
        .send({ messages: [{ role: 'user', content: 'hello' }] });

      expect(safeRes.status).toBe(200);
      expect(safeRes.body.early_risk).toBe(false);
      expect(safeRes.body.risk_type).toBe('unknown');
    });

    it('POST /api/analyze-sentiment: validates message, handles provider failure safely', async () => {
      const badRes = await request(app).post('/api/analyze-sentiment').send({});
      expect(badRes.status).toBe(400);

      vi.spyOn(groqHelper, 'callGroqAPI').mockRejectedValueOnce(new Error('AI provider offline'));
      const safeRes = await request(app)
        .post('/api/analyze-sentiment')
        .send({ message: 'I am happy' });

      expect(safeRes.status).toBe(200);
      expect(safeRes.body.label).toBe('Neutral');
    });
  });

  describe('PHASE 6: Authorization Boundary Across All Protected Endpoints', () => {
    // List of every protected parent endpoint with HTTP method, path, and valid test payload
    const protectedEndpoints = [
      { method: 'post', path: '/api/auth/parent/update', body: { pin: '9876' } },
      { method: 'get', path: '/api/config/parent', body: null },
      { method: 'put', path: '/api/config/parent', body: { screenTime: { dailyLimit: 30 } } },
      { method: 'delete', path: '/api/config/parent', body: null },
      { method: 'post', path: '/api', body: { summary: { totalUsageMinutes: 10, recentQuestions: ['math'] } } },
      { method: 'post', path: '/api/deep-analysis', body: { insight: 'math progress', summary: { totalUsageMinutes: 10 }, insightType: 'learning' } },
      { method: 'post', path: '/api/analyze-intelligence', body: { messages: [{ role: 'user', content: 'why sky blue' }] } },
      { method: 'post', path: '/api/decision-engine', body: { metrics: { curiosity: 80, mathConfidence: 70, attentionSpan: 60 } } },
      { method: 'post', path: '/api/analyze-engagement', body: { usageData: { totalActivities: 4, activeDays: 2 } } },
      { method: 'post', path: '/api/generate-full-report', body: { allData: { extractedData: { topics: ['science'] } } } }
    ];

    for (const ep of protectedEndpoints) {
      it(`enforces 401 without cookie on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        const reqBuilder = request(app)[ep.method](ep.path);
        if (ep.body) reqBuilder.send(ep.body);

        const res = await reqBuilder;
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication required');
        assertNoSecrets(res.body);
      });

      it(`enforces 401 with forged cookie on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        const reqBuilder = request(app)[ep.method](ep.path)
          .set('Cookie', 'parent_session=forged-cookie-token');
        if (ep.body) reqBuilder.send(ep.body);

        const res = await reqBuilder;
        expect(res.status).toBe(401);
      });

      it(`enforces 401 with expired cookie on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        authService.setParentPinHash('1234');
        const session = authService.createSession();
        session.expiresAt = Date.now() - 1000; // Expire

        const reqBuilder = request(app)[ep.method](ep.path)
          .set('Cookie', `parent_session=${session.id}`);
        if (ep.body) reqBuilder.send(ep.body);

        const res = await reqBuilder;
        expect(res.status).toBe(401);
      });

      it(`allows access with valid session cookie on ${ep.method.toUpperCase()} ${ep.path}`, async () => {
        authService.setParentPinHash('1234');
        const session = authService.createSession();

        // Mock Groq in case endpoint invokes AI logic
        vi.spyOn(groqHelper, 'callGroqAPI').mockResolvedValue({
          choices: [{ message: { content: '{"key":"value"}' } }]
        });

        const reqBuilder = request(app)[ep.method](ep.path)
          .set('Cookie', `parent_session=${session.id}`);
        if (ep.body) reqBuilder.send(ep.body);

        const res = await reqBuilder;
        // Status should be 200 (or not 401)
        expect(res.status).not.toBe(401);
        assertNoSecrets(res.body);
      });
    }
  });

  describe('PHASE 7: Server-Authoritative Configuration Enforcement in Chat', () => {
    it('enforces parent lock: child chat blocked with 403 APP_LOCKED when isLocked is true', async () => {
      const groqSpy = vi.spyOn(groqHelper, 'callGroqAPI');

      // Parent locks the application
      configService.updateParentConfig({
        screenTime: { isLocked: true }
      });

      // Child tries to chat
      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello AI' }]
        });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'App is currently locked by parent',
        code: 'APP_LOCKED'
      });

      // AI provider must NOT be reached while locked
      expect(groqSpy).not.toHaveBeenCalled();
    });

    it('injects authoritative parent directives into messages sent to AI provider', async () => {
      let interceptedMessages = null;
      vi.spyOn(groqHelper, 'callGroqAPI').mockImplementation(async (opts) => {
        if (opts.endpoint === 'chat') {
          interceptedMessages = opts.messages;
          return {
            choices: [{ message: { role: 'assistant', content: 'I am your guide.' } }]
          };
        }
        return {
          choices: [{ message: { content: '{"status":"safe"}' } }]
        };
      });

      // Parent configures directives
      configService.updateParentConfig({
        screenTime: { isLocked: false },
        aiBehavior: {
          strictMode: true,
          customInstructions: 'Always answer like a pirate.',
          parentPolicies: ['No video games discussion']
        }
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Tell me about stars' }]
        });

      expect(res.status).toBe(200);

      // Verify server injected the authoritative policy
      const systemMessage = interceptedMessages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('[AUTHORITATIVE PARENT POLICY]');
      expect(systemMessage.content).toContain('Always answer like a pirate.');
      expect(systemMessage.content).toContain('No video games discussion');
    });
  });

  describe('PHASE 8: Rate Limiting Integration', () => {
    it('triggers 429 after repeated authentication failures', async () => {
      authService.setParentPinHash('1234');
      const testIp = '192.168.42.100'; // Unique IP for test isolation

      // Make 10 requests (auth limit is 10)
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/auth/parent/login')
          .set('X-Forwarded-For', testIp)
          .send({ pin: '0000' });
        expect(res.status).toBe(401);
      }

      // 11th request triggers rate limit 429
      const rateLimitedRes = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', testIp)
        .send({ pin: '0000' });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.error).toContain('Too many authentication attempts');
    });
  });

  describe('PHASE 9: Security Response Assertions & Headers', () => {
    it('verifies X-Request-ID and absence of internal error stacks on 404', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-route');
      expect(res.status).toBe(404);
      assertRequestId(res);
      assertNoSecrets(res.body);
    });

    it('verifies X-Request-ID and absence of stacks on bad JSON payload', async () => {
      const res = await request(app)
        .post('/api/auth/parent/login')
        .set('X-Forwarded-For', getTestIp())
        .set('Content-Type', 'application/json')
        .send('{"pin": invalid-json}');

      expect(res.status).toBe(400);
      assertRequestId(res);
      assertNoSecrets(res.body);
    });
  });

  describe('PHASE 10: Health and Readiness Probes', () => {
    it('GET /api/health returns 200 healthy without auth or calling Groq', async () => {
      const groqSpy = vi.spyOn(groqHelper, 'callGroqAPI');
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('number');
      expect(groqSpy).not.toHaveBeenCalled();
    });

    it('GET /api/ready returns 200 ready when configured, 503 unready when missing keys, and omits secrets', async () => {
      const originalKey = process.env.GROQ_API_KEY;
      try {
        process.env.GROQ_API_KEY = 'gsk-mock-production-key-12345';
        const readyRes = await request(app).get('/api/ready');
        expect(readyRes.status).toBe(200);
        expect(readyRes.body).toEqual({ status: 'ready', ready: true });
        assertNoSecrets(readyRes.body);

        delete process.env.GROQ_API_KEY;
        const unreadyRes = await request(app).get('/api/ready');
        expect(unreadyRes.status).toBe(503);
        expect(unreadyRes.body.status).toBe('unready');
        expect(unreadyRes.body.ready).toBe(false);
        expect(unreadyRes.body.missing).toContain('GROQ_API_KEY');
        assertNoSecrets(unreadyRes.body);
      } finally {
        if (originalKey) {
          process.env.GROQ_API_KEY = originalKey;
        } else {
          delete process.env.GROQ_API_KEY;
        }
      }
    });

    it('GET /api/test returns 200 API WORKING for backwards compatibility', async () => {
      const res = await request(app).get('/api/test');
      expect(res.status).toBe(200);
      expect(res.text).toBe('API WORKING');
    });
  });
});
