/**
 * Validation Tests
 * Tests for request validation middleware
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Validation Middleware', () => {
  describe('Login Validation', () => {
    it('should accept valid login payload', async () => {
      const app = express();
      app.use(express.json());
      
      const authRouter = require('../routes/auth');
      app.use('/api/auth', authRouter);

      const { hashPin } = require('../services/authService');
      const pin = '1234';
      const storedPinHash = hashPin(pin);

      const response = await request(app)
        .post('/api/auth/parent/login')
        .send({ pin, storedPinHash });

      expect(response.status).toBe(200);
    });
  });

  describe('Chat Validation', () => {
    it('should accept valid chat payload', async () => {
      const app = express();
      app.use(express.json());
      
      const chatRouter = require('../routes/chat');
      app.use('/api/chat', chatRouter);

      const response = await request(app)
        .post('/api/chat')
        .send({ 
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'llama-3.1-8b-instant'
        });

      // Will fail due to Groq API call, but should pass validation
      expect(response.status).not.toBe(400);
    });
  });
});
