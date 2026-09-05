/**
 * Parent Configuration & Persistence Tests
 * Verifies server-authoritative persistence, authorization controls,
 * schema validation, disk durability across restarts, legacy migration,
 * and server-side enforcement in /api/chat.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { createSession, _resetForTesting: resetAuth } = require('../services/authService');
const configService = require('../services/configService');
const configRouter = require('../routes/config');
const chatRouter = require('../routes/chat');
const groqHelper = require('../lib/groqHelper');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/config', configRouter);
  app.use('/api/chat', chatRouter);
  return app;
}

describe('Server-Authoritative Parent Configuration', () => {
  let app;
  let testStorePath;

  beforeEach(() => {
    resetAuth();
    testStorePath = path.join(os.tmpdir(), `test-parent-config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    configService._resetForTesting(testStorePath);
    app = createApp();
  });

  afterEach(() => {
    configService._resetForTesting();
    if (fs.existsSync(testStorePath)) {
      try {
        fs.unlinkSync(testStorePath);
      } catch (_) {}
    }
  });

  describe('Authorization: GET /api/config/parent', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/config/parent');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('should reject forged session cookie with 401', async () => {
      const res = await request(app)
        .get('/api/config/parent')
        .set('Cookie', 'parent_session=invalid-or-forged-token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('should return default authoritative configuration for authenticated parent', async () => {
      const session = createSession();
      const res = await request(app)
        .get('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('config');
      expect(res.body.config.screenTime).toMatchObject({
        dailyLimit: 60,
        isLocked: false,
        restrictionEnabled: true,
        mode: 'balanced'
      });
      expect(res.body.config.aiBehavior).toMatchObject({
        selectedPreset: 'kid-safe',
        safetyLevel: 'strict',
        strictMode: false
      });

      // Ensure no credentials, PINs, or internal secrets are exposed
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toMatch(/pin/i);
      expect(bodyStr).not.toMatch(/password/i);
      expect(bodyStr).not.toMatch(/hash/i);
      expect(bodyStr).not.toMatch(/secret/i);
    });
  });

  describe('Authorization & Validation: PUT /api/config/parent', () => {
    it('should reject unauthenticated write with 401', async () => {
      const res = await request(app)
        .put('/api/config/parent')
        .send({ screenTime: { dailyLimit: 30 } });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('should reject empty update payload with 400 Bad Request', async () => {
      const session = createSession();
      const res = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should reject invalid dailyLimit (< 0) with 400', async () => {
      const session = createSession();
      const res = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({ screenTime: { dailyLimit: -5 } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should reject invalid dailyLimit (> 1440) with 400', async () => {
      const session = createSession();
      const res = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({ screenTime: { dailyLimit: 2000 } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should reject unrecognized screen time mode with 400', async () => {
      const session = createSession();
      const res = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({ screenTime: { mode: 'unlimited_hack' } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should reject unknown extra properties with 400 (strict schema)', async () => {
      const session = createSession();
      const res = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({
          screenTime: { dailyLimit: 45 },
          maliciousField: 'bypass'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('should successfully update screenTime configuration for authenticated parent', async () => {
      const session = createSession();
      const res = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({
          screenTime: {
            dailyLimit: 45,
            isLocked: true,
            mode: 'strict'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config.screenTime).toMatchObject({
        dailyLimit: 45,
        isLocked: true,
        mode: 'strict',
        restrictionEnabled: true
      });
    });

    it('should successfully update aiBehavior and parent policies', async () => {
      const session = createSession();
      const res = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({
          aiBehavior: {
            selectedPreset: 'learning',
            safetyLevel: 'strict',
            strictMode: true,
            customInstructions: 'Always explain math with visual metaphors.',
            parentPolicies: ['No bedtime questions after 8 PM']
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.config.aiBehavior.selectedPreset).toBe('learning');
      expect(res.body.config.aiBehavior.strictMode).toBe(true);
      expect(res.body.config.aiBehavior.customInstructions).toBe('Always explain math with visual metaphors.');
      expect(res.body.config.aiBehavior.parentPolicies).toEqual(['No bedtime questions after 8 PM']);
    });
  });

  describe('Durable Persistence Across Process Restarts', () => {
    it('should persist configuration to disk atomically and restore on re-read', async () => {
      const session = createSession();

      // 1. Update config
      const updateRes = await request(app)
        .put('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`)
        .send({
          screenTime: { dailyLimit: 90, isLocked: true }
        });
      expect(updateRes.status).toBe(200);

      // Verify file was written to disk
      expect(fs.existsSync(testStorePath)).toBe(true);
      const fileContents = JSON.parse(fs.readFileSync(testStorePath, 'utf8'));
      expect(fileContents.screenTime.dailyLimit).toBe(90);
      expect(fileContents.screenTime.isLocked).toBe(true);

      // 2. Simulate server restart by wiping in-memory cache
      configService._resetForTesting(testStorePath);

      // 3. Read config again
      const getRes = await request(app)
        .get('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.config.screenTime.dailyLimit).toBe(90);
      expect(getRes.body.config.screenTime.isLocked).toBe(true);
    });
  });

  describe('POST /api/config/parent/migrate - Legacy Migration', () => {
    it('should reject unauthenticated migration request with 401', async () => {
      const res = await request(app)
        .post('/api/config/parent/migrate')
        .send({
          screenTime: { dailyLimit: 60 }
        });

      expect(res.status).toBe(401);
    });

    it('should reject invalid legacy payload with 400', async () => {
      const session = createSession();
      const res = await request(app)
        .post('/api/config/parent/migrate')
        .set('Cookie', `parent_session=${session.id}`)
        .send({
          screenTime: { dailyLimit: 'not-a-number' }
        });

      expect(res.status).toBe(400);
    });

    it('should migrate legacy localStorage data into server store cleanly', async () => {
      const session = createSession();
      const legacyData = {
        screenTime: {
          dailyLimit: 40,
          isLocked: false,
          restrictionEnabled: true,
          mode: 'balanced'
        },
        parentPolicy: 'Help with homework patiently',
        parentPolicies: ['Be polite', 'Encourage reading'],
        strictMode: true
      };

      const res = await request(app)
        .post('/api/config/parent/migrate')
        .set('Cookie', `parent_session=${session.id}`)
        .send(legacyData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.migrated).toBe(true);
      expect(res.body.config.screenTime.dailyLimit).toBe(40);
      expect(res.body.config.aiBehavior.strictMode).toBe(true);
      expect(res.body.config.aiBehavior.customInstructions).toBe('Help with homework patiently');
      expect(res.body.config.aiBehavior.parentPolicies).toEqual(['Be polite', 'Encourage reading']);
    });
  });

  describe('DELETE /api/config/parent - Reset & Invalidation', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).delete('/api/config/parent');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('should reject forged session cookie with 401', async () => {
      const res = await request(app)
        .delete('/api/config/parent')
        .set('Cookie', 'parent_session=fake-session-id');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('should reset config to defaults, delete session, and clear cookie', async () => {
      const session = createSession();

      // First, update config to non-default values
      configService.updateParentConfig({
        screenTime: { dailyLimit: 120, isLocked: true },
        aiBehavior: { strictMode: true, customInstructions: 'Custom instructions here' }
      });

      // Verify custom values are active
      let current = configService.getParentConfig();
      expect(current.screenTime.dailyLimit).toBe(120);
      expect(current.screenTime.isLocked).toBe(true);

      // Perform DELETE
      const res = await request(app)
        .delete('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Parent configuration successfully reset');

      // Verify cookie was cleared
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie.some(c => c.includes('parent_session=;') || c.includes('parent_session=deleted') || c.includes('parent_session=;'))).toBe(true);

      // Verify config was reset in memory and on disk
      current = configService.getParentConfig();
      expect(current.screenTime.dailyLimit).toBe(60);
      expect(current.screenTime.isLocked).toBe(false);
      expect(current.aiBehavior.strictMode).toBe(false);
      expect(current.aiBehavior.customInstructions).toBe('');

      const diskConfig = JSON.parse(fs.readFileSync(testStorePath, 'utf8'));
      expect(diskConfig.screenTime.dailyLimit).toBe(60);
      expect(diskConfig.screenTime.isLocked).toBe(false);

      // Verify previous session was invalidated in authService
      const followUp = await request(app)
        .get('/api/config/parent')
        .set('Cookie', `parent_session=${session.id}`);
      expect(followUp.status).toBe(401);
    });
  });

  describe('Server-Side Enforcement in Child Chat Route', () => {
    it('should reject child chat with 403 APP_LOCKED when app is locked by parent', async () => {
      // Mock Groq API
      const groqSpy = vi.spyOn(groqHelper, 'callGroqAPI');

      // 1. Lock app via authoritative parent config
      configService.updateParentConfig({
        screenTime: { isLocked: true }
      });

      // 2. Child attempts to chat
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

      // Groq AI API should never be reached while locked
      expect(groqSpy).not.toHaveBeenCalled();

      groqSpy.mockRestore();
    });

    it('should append authoritative parent directives to chat messages sent to Groq', async () => {
      // Mock Groq API to return safe response and inspect sent messages
      let interceptedMessages = null;
      const groqSpy = vi.spyOn(groqHelper, 'callGroqAPI').mockImplementation(async (opts) => {
        if (!opts.isSafetyEndpoint) {
          interceptedMessages = opts.messages;
          return {
            choices: [{ message: { role: 'assistant', content: 'Hello! I am your safe guide.' } }]
          };
        }
        return {
          choices: [{ message: { role: 'assistant', content: '{"status":"safe","category":"safe","reason":"all good"}' } }]
        };
      });

      // Configure parent guidelines
      configService.updateParentConfig({
        screenTime: { isLocked: false },
        aiBehavior: {
          strictMode: true,
          customInstructions: 'Do not discuss violent video games.',
          parentPolicies: ['Limit gaming talk']
        }
      });

      const res = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'system', content: 'Base kid prompt.' },
            { role: 'user', content: 'Tell me about Fortnite' }
          ]
        });

      expect(res.status).toBe(200);
      expect(groqSpy).toHaveBeenCalled();

      // Verify the system message contains the authoritative parent policy
      const systemMessage = interceptedMessages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('[AUTHORITATIVE PARENT POLICY]');
      expect(systemMessage.content).toContain('Do not discuss violent video games.');
      expect(systemMessage.content).toContain('Limit gaming talk');
      expect(systemMessage.content).toContain('SAFETY: Politely and naturally redirect');

      groqSpy.mockRestore();
    });
  });
});
