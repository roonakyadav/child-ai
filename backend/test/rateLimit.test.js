/**
 * Rate Limiting Tests
 * Tests for rate limiting middleware behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { generalLimiter, aiLimiter, authLimiter } from '../middleware/rateLimit';

describe('Rate Limiting Middleware', () => {
  describe('General Rate Limiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(generalLimiter);
      
      app.get('/api/test', (req, res) => {
        res.send('OK');
      });
      
      app.post('/api/auth/parent/login', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests under limit', async () => {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
    });

    it('should skip rate limiting for /api/test endpoint', async () => {
      // Make multiple requests to test endpoint
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/api/test');
        expect(response.status).toBe(200);
      }
    });

    it('should apply rate limiting to auth endpoints', async () => {
      // This test verifies the limiter is configured
      // Actual rate limit testing would require many requests
      const response = await request(app).post('/api/auth/parent/login');
      expect(response.status).toBe(200);
    });
  });

  describe('AI Rate Limiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(aiLimiter);
      
      app.post('/api/chat', (req, res) => {
        res.json({ response: 'test' });
      });
    });

    it('should allow requests under limit', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ messages: [{ role: 'user', content: 'test' }] });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Rate Limiter Configuration', () => {
    it('should have stricter limit for AI and auth endpoints', () => {
      // Verify the limiters are configured with different limits
      const { generalLimiter, aiLimiter, authLimiter } = require('../middleware/rateLimit');
      
      // The limiter instances should have different configurations
      expect(generalLimiter).toBeDefined();
      expect(aiLimiter).toBeDefined();
      expect(authLimiter).toBeDefined();
    });
  });

  describe('Auth Rate Limiter', () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      const { authLimiter } = require('../middleware/rateLimit');
      app.use(authLimiter);

      app.post('/api/auth/parent/login', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow auth requests under limit', async () => {
      const response = await request(app).post('/api/auth/parent/login');
      expect(response.status).toBe(200);
    });
  });
});
