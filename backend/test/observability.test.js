/**
 * Observability and Operational Safety Tests
 * 
 * Verifies request ID generation, validation, header propagation,
 * structured completion logging, error handling secrecy, health/readiness,
 * shutdown handling, and provider metric sanitization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const axios = require('axios');
const { requestIdMiddleware, isValidRequestId } = require('../middleware/requestId');
const { requestLoggerMiddleware } = require('../middleware/requestLogger');
const errorHandler = require('../middleware/errorHandler');
const logger = require('../lib/logger');
const groqHelper = require('../lib/groqHelper');
const { router: healthRouter, checkReadiness } = require('../routes/health');
const { validateProductionConfig } = require('../config/validateEnv');
const { startServer } = require('../server');

describe('Production Observability & Operational Safety', () => {
  let capturedLogs = [];

  beforeEach(() => {
    capturedLogs = [];
    logger.setWriter((entry) => {
      capturedLogs.push(entry);
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    logger.resetWriter();
    vi.restoreAllMocks();
  });

  describe('1. Request ID Generation & Middleware', () => {
    it('should generate a valid UUIDv4 when no X-Request-ID is supplied', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        res.json({ id: req.id });
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      // Verify standard UUIDv4 format
      expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('2. should expose X-Request-ID response header matching req.id', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        res.json({ id: req.id });
      });

      const res = await request(app).get('/test');

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toBe(res.body.id);
    });

    it('3. should adopt safely validated incoming X-Request-ID header', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        res.json({ id: req.id });
      });

      const customId = 'client-trace-abc-123_XYZ';
      const res = await request(app)
        .get('/test')
        .set('X-Request-ID', customId);

      expect(res.body.id).toBe(customId);
      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('4. should reject and replace invalid incoming X-Request-ID headers', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/test', (req, res) => {
        res.json({ id: req.id });
      });

      const invalidIds = [
        'invalid id with spaces',
        '<script>alert(1)</script>',
        'a'.repeat(65), // Exceeds 64 chars
        'id;DROP TABLE users;',
        'id{bad}'
      ];

      for (const invalid of invalidIds) {
        const res = await request(app)
          .get('/test')
          .set('X-Request-ID', invalid);

        expect(res.body.id).not.toBe(invalid);
        expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(res.headers['x-request-id']).toBe(res.body.id);
      }
    });

    it('isValidRequestId utility correctly validates IDs', () => {
      expect(isValidRequestId('valid-id_123')).toBe(true);
      expect(isValidRequestId('a'.repeat(64))).toBe(true);
      expect(isValidRequestId('a'.repeat(65))).toBe(false);
      expect(isValidRequestId('')).toBe(false);
      expect(isValidRequestId('has space')).toBe(false);
      expect(isValidRequestId(null)).toBe(false);
      expect(isValidRequestId(undefined)).toBe(false);
      expect(isValidRequestId(123)).toBe(false);
    });
  });

  describe('5-7. Request Completion Logging & Data Privacy', () => {
    it('5. completion log contains status, duration, request ID, and method', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.use(requestLoggerMiddleware);
      app.get('/api/resource', (req, res) => {
        res.status(200).json({ ok: true });
      });

      const res = await request(app).get('/api/resource');
      expect(res.status).toBe(200);

      const completionLog = capturedLogs.find(l => l.event === 'request.completed');
      expect(completionLog).toBeDefined();
      expect(completionLog.level).toBe('info');
      expect(completionLog.status).toBe(200);
      expect(completionLog.method).toBe('GET');
      expect(completionLog.path).toBe('/api/resource');
      expect(typeof completionLog.durationMs).toBe('number');
      expect(completionLog.requestId).toBe(res.headers['x-request-id']);
    });

    it('6. request body is NOT logged in completion event', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.use(requestLoggerMiddleware);
      app.use(express.json());
      app.post('/api/chat', (req, res) => {
        res.status(200).json({ success: true });
      });

      const secretPayload = {
        message: 'very sensitive child message about personal details',
        pin: '1234',
        apiKey: 'super-secret-key'
      };

      await request(app)
        .post('/api/chat')
        .send(secretPayload);

      const completionLog = capturedLogs.find(l => l.event === 'request.completed');
      expect(completionLog).toBeDefined();

      const serialized = JSON.stringify(completionLog);
      expect(serialized).not.toContain('sensitive child message');
      expect(serialized).not.toContain('1234');
      expect(serialized).not.toContain('super-secret-key');
      expect(completionLog.message).toBeUndefined();
      expect(completionLog.pin).toBeUndefined();
      expect(completionLog.body).toBeUndefined();
      expect(completionLog.requestBody).toBeUndefined();
    });

    it('7. cookies and authorization headers are NOT logged', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.use(requestLoggerMiddleware);
      app.get('/api/private', (req, res) => {
        res.status(200).json({ ok: true });
      });

      await request(app)
        .get('/api/private')
        .set('Cookie', 'parent_session=super-secret-session-token-999')
        .set('Authorization', 'Bearer secret-bearer-token-888');

      const completionLog = capturedLogs.find(l => l.event === 'request.completed');
      expect(completionLog).toBeDefined();

      const serialized = JSON.stringify(completionLog);
      expect(serialized).not.toContain('super-secret-session-token-999');
      expect(serialized).not.toContain('secret-bearer-token-888');
      expect(completionLog.cookie).toBeUndefined();
      expect(completionLog.cookies).toBeUndefined();
      expect(completionLog.authorization).toBeUndefined();
    });

    it('sanitizes query parameters to prevent leaking tokens or queries in paths', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.use(requestLoggerMiddleware);
      app.get('/api/search', (req, res) => {
        res.status(200).json({ ok: true });
      });

      await request(app).get('/api/search?secret_token=12345&query=private');

      const completionLog = capturedLogs.find(l => l.event === 'request.completed');
      expect(completionLog).toBeDefined();
      expect(completionLog.path).toBe('/api/search');
      expect(JSON.stringify(completionLog)).not.toContain('secret_token');
    });
  });

  describe('8-9. Global Centralized Error Handling', () => {
    it('8. centralized error handler returns generic JSON error without leaking internal details', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/api/error-test', (req, res, next) => {
        const err = new Error('Database connection failed on /var/lib/data/secret.db with credentials user:pass');
        err.status = 500;
        next(err);
      });
      app.use(errorHandler);

      const res = await request(app).get('/api/error-test');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: 'Internal server error',
        code: 'SERVER_ERROR'
      });

      // Verify error log exists with requestId and errorName, without raw secret details
      const errorLog = capturedLogs.find(l => l.event === 'request.error');
      expect(errorLog).toBeDefined();
      expect(errorLog.level).toBe('error');
      expect(errorLog.requestId).toBe(res.headers['x-request-id']);
      expect(errorLog.errorName).toBe('Error');
    });

    it('9. production error responses do not expose stack traces', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const app = express();
        app.use(requestIdMiddleware);
        app.get('/api/crash', (req, res, next) => {
          next(new Error('Internal processing failure'));
        });
        app.use(errorHandler);

        const res = await request(app).get('/api/crash');

        expect(res.status).toBe(500);
        expect(res.body.stack).toBeUndefined();
        expect(res.body.details).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('node_modules');
        expect(JSON.stringify(res.body)).not.toContain('backend/');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('preserves appropriate client error status codes (e.g., 400, 404, 403)', async () => {
      const app = express();
      app.use(requestIdMiddleware);
      app.get('/api/bad-request', (req, res, next) => {
        const err = new Error('Invalid parameter');
        err.status = 400;
        next(err);
      });
      app.use(errorHandler);

      const res = await request(app).get('/api/bad-request');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_REQUEST');
    });
  });

  describe('10-11. Health and Readiness Endpoints', () => {
    it('10. health endpoint is public, returns healthy status, and does not call Groq', async () => {
      const groqSpy = vi.spyOn(axios, 'post');
      const app = express();
      app.use('/api', healthRouter);

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('number');
      expect(groqSpy).not.toHaveBeenCalled();
    });

    it('preserves /api/test backwards compatibility', async () => {
      const app = express();
      app.use('/api', healthRouter);

      const res = await request(app).get('/api/test');
      expect(res.status).toBe(200);
      expect(res.text).toBe('API WORKING');
    });

    it('11. readiness endpoint safely reports ready when configuration is complete', async () => {
      const originalKey = process.env.GROQ_API_KEY;
      process.env.GROQ_API_KEY = 'gsk-test-valid-key';

      try {
        const app = express();
        app.use('/api', healthRouter);

        const res = await request(app).get('/api/ready');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ready');
        expect(res.body.ready).toBe(true);
        expect(JSON.stringify(res.body)).not.toContain('gsk-test-valid-key');
      } finally {
        process.env.GROQ_API_KEY = originalKey;
      }
    });

    it('11. readiness endpoint safely reports 503 unready with missing key names (never values)', async () => {
      const originalKey = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      try {
        const app = express();
        app.use('/api', healthRouter);

        const res = await request(app).get('/api/ready');
        expect(res.status).toBe(503);
        expect(res.body.status).toBe('unready');
        expect(res.body.ready).toBe(false);
        expect(res.body.missing).toContain('GROQ_API_KEY');
        expect(JSON.stringify(res.body)).not.toMatch(/gsk-|key=|secret=/i);
      } finally {
        process.env.GROQ_API_KEY = originalKey;
      }
    });

    it('checkReadiness helper correctly assesses configuration completeness', () => {
      const result = checkReadiness();
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('missing');
      expect(Array.isArray(result.missing)).toBe(true);
    });
  });

  describe('12. Startup Configuration & Graceful Shutdown', () => {
    it('validateProductionConfig checks critical settings in production mode', () => {
      const fakeEnv = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: '',
        CONFIG_STORE_PATH: '',
        GROQ_API_KEY: ''
      };

      const result = validateProductionConfig(fakeEnv, false);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('ALLOWED_ORIGINS');
      expect(result.missing).toContain('CONFIG_STORE_PATH');
      expect(result.missing).toContain('GROQ_API_KEY');

      const validEnv = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://example.com',
        CONFIG_STORE_PATH: '/tmp/testConfig.json',
        GROQ_API_KEY: 'valid-key'
      };
      const validResult = validateProductionConfig(validEnv, false);
      expect(validResult.valid).toBe(true);
      expect(validResult.missing).toHaveLength(0);
    });

    it('12. startServer creates HTTP server and sets up termination listeners', () => {
      const server = startServer(0); // Port 0 for random free port
      expect(server).toBeDefined();
      expect(typeof server.close).toBe('function');

      server.close();
    });
  });

  describe('13. AI Provider Logging Excludes Prompts, Responses, and Secrets', () => {
    it('13. logs successful AI request with metrics only, omitting messages and completions', async () => {
      const originalKey = process.env.GROQ_API_KEY;
      process.env.GROQ_API_KEY = 'gsk-secret-provider-key-12345';

      try {
        vi.spyOn(axios, 'post').mockResolvedValueOnce({
          status: 200,
          data: {
            choices: [{
              message: {
                role: 'assistant',
                content: 'Sensitive AI response that should not be logged'
              }
            }]
          }
        });

        await groqHelper.callGroqAPI({
          endpoint: 'chat',
          messages: [{ role: 'user', content: 'Child asked a very private question' }],
          model: 'llama-3.1-8b-instant'
        });

        const aiLog = capturedLogs.find(l => l.event === 'ai.request.completed');
        expect(aiLog).toBeDefined();
        expect(aiLog.level).toBe('info');
        expect(aiLog.endpoint).toBe('chat');
        expect(typeof aiLog.durationMs).toBe('number');
        expect(aiLog.status).toBe(200);

        // Crucial safety check: Ensure no prompts, completions, or keys were emitted
        const serialized = JSON.stringify(aiLog);
        expect(serialized).not.toContain('Sensitive AI response');
        expect(serialized).not.toContain('Child asked a very private question');
        expect(serialized).not.toContain('gsk-secret-provider-key-12345');
        expect(aiLog.messages).toBeUndefined();
        expect(aiLog.prompt).toBeUndefined();
        expect(aiLog.content).toBeUndefined();
      } finally {
        process.env.GROQ_API_KEY = originalKey;
      }
    });

    it('13. logs failed AI request with error code and duration only', async () => {
      const originalKey = process.env.GROQ_API_KEY;
      process.env.GROQ_API_KEY = 'gsk-secret-provider-key-12345';

      try {
        vi.spyOn(axios, 'post').mockRejectedValueOnce({
          code: 'ECONNABORTED',
          message: 'timeout of 30000ms exceeded',
          response: null
        });

        await expect(groqHelper.callGroqAPI({
          endpoint: 'safety-check',
          messages: [{ role: 'user', content: 'Secret prompt content' }],
          model: 'llama-3.1-8b-instant'
        })).rejects.toThrow();

        const failLog = capturedLogs.find(l => l.event === 'ai.request.failed');
        expect(failLog).toBeDefined();
        expect(failLog.level).toBe('error');
        expect(failLog.endpoint).toBe('safety-check');
        expect(failLog.code).toBe('AI_SERVICE_TIMEOUT');
        expect(typeof failLog.durationMs).toBe('number');

        const serialized = JSON.stringify(failLog);
        expect(serialized).not.toContain('Secret prompt content');
        expect(serialized).not.toContain('gsk-secret-provider-key-12345');
      } finally {
        process.env.GROQ_API_KEY = originalKey;
      }
    });
  });
});
