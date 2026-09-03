/**
 * CORS Tests
 * Tests for CORS middleware behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import corsMiddleware from '../middleware/cors';

describe('CORS Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(corsMiddleware);
    app.get('/api/test', (req, res) => {
      res.send('OK');
    });
  });

  describe('Origin Validation', () => {
    it('should allow requests from allowed origin', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should reject requests from unknown origin', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://evil.com');

      expect(response.status).not.toBe(200);
    });

    it('should allow requests without Origin header', async () => {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
    });
  });

  describe('Credentials Behavior', () => {
    it('should set credentials header to true', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Wildcard Prevention', () => {
    it('should not use wildcard in CORS header', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });
  });
});
