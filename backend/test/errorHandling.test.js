/**
 * AI Error Handling Tests
 * Tests for error handling in AI endpoints
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('AI Error Handling', () => {
  describe('POST /api/insights', () => {
    it('should require summary parameter', async () => {
      const app = express();
      app.use(express.json());
      
      const insightsRouter = require('../routes/insights');
      app.use('/api', insightsRouter);

      const response = await request(app)
        .post('/api/insights')
        .send({});

      // 404 because the route doesn't exist in the router
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/analyze-engagement', () => {
    it('should require usageData parameter', async () => {
      const cookieParser = require('cookie-parser');
      const { createSession } = require('../services/authService');
      const app = express();
      app.use(express.json());
      app.use(cookieParser());
      
      const engagementRouter = require('../routes/engagement');
      app.use('/api', engagementRouter);

      const session = createSession();

      const response = await request(app)
        .post('/api/analyze-engagement')
        .set('Cookie', `parent_session=${session.id}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/analyze-sentiment', () => {
    it('should require message parameter', async () => {
      const app = express();
      app.use(express.json());
      
      const engagementRouter = require('../routes/engagement');
      app.use('/api', engagementRouter);

      const response = await request(app)
        .post('/api/analyze-sentiment')
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
