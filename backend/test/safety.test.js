/**
 * AI Safety Tests
 * Tests for safety analysis endpoints and fail-closed behavior
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('AI Safety Endpoints', () => {
  describe('POST /api/detect-risk', () => {
    it('should require message parameter', async () => {
      const app = express();
      app.use(express.json());
      
      const safetyRouter = require('../routes/safety');
      app.use('/api', safetyRouter);

      const response = await request(app)
        .post('/api/detect-risk')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should require messages array for pattern analysis', async () => {
      const app = express();
      app.use(express.json());
      
      const safetyRouter = require('../routes/safety');
      app.use('/api', safetyRouter);

      const response = await request(app)
        .post('/api/analyze-pattern')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should require messages array for early risk analysis', async () => {
      const app = express();
      app.use(express.json());
      
      const safetyRouter = require('../routes/safety');
      app.use('/api', safetyRouter);

      const response = await request(app)
        .post('/api/analyze-early-risk')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('Fail-Closed Behavior', () => {
    it('safety endpoints return UNKNOWN on error', async () => {
      const app = express();
      app.use(express.json());
      
      const safetyRouter = require('../routes/safety');
      app.use('/api', safetyRouter);

      // These will fail due to missing GROQ_API_KEY, but should return UNKNOWN
      const response = await request(app)
        .post('/api/detect-risk')
        .send({ message: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('unknown');
    });
  });
});
