/**
 * Health Endpoint Tests
 * Tests for the /api/test health endpoint
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Health Endpoint', () => {
  it('should return API WORKING without calling Groq', async () => {
    const app = express();
    
    const testRouter = require('../routes/test');
    app.use('/api', testRouter);

    const response = await request(app).get('/api/test');

    expect(response.status).toBe(200);
    expect(response.text).toBe('API WORKING');
  });

  it('should not require authentication', async () => {
    const app = express();
    
    const testRouter = require('../routes/test');
    app.use('/api', testRouter);

    const response = await request(app).get('/api/test');

    expect(response.status).toBe(200);
  });

  it('should not require rate limiting', async () => {
    const app = express();
    
    const testRouter = require('../routes/test');
    app.use('/api', testRouter);

    // Make multiple requests
    for (let i = 0; i < 10; i++) {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
    }
  });
});
