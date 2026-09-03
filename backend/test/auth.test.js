/**
 * Authentication Tests
 * Tests for session management and authentication endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createSession, getSession, deleteSession, hashPin } from '../services/authService';

describe('Authentication Service', () => {
  beforeEach(() => {
    // Clear sessions before each test
    const sessions = require('../services/authService');
    if (sessions.sessions) {
      sessions.sessions.clear();
    }
  });

  describe('hashPin', () => {
    it('should hash PIN consistently', () => {
      const pin = '1234';
      const hash1 = hashPin(pin);
      const hash2 = hashPin(pin);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different PINs', () => {
      const hash1 = hashPin('1234');
      const hash2 = hashPin('5678');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createSession', () => {
    it('should create a valid session', () => {
      const session = createSession();
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('authenticated', true);
      expect(session.id).toHaveLength(64); // 32 bytes * 2 (hex)
    });

    it('should set expiry in the future', () => {
      const session = createSession();
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('getSession', () => {
    it('should return session for valid session ID', () => {
      const createdSession = createSession();
      const retrievedSession = getSession(createdSession.id);
      expect(retrievedSession).toEqual(createdSession);
    });

    it('should return null for invalid session ID', () => {
      const session = getSession('invalid-id');
      expect(session).toBeNull();
    });

    it('should return null for missing session ID', () => {
      const session = getSession();
      expect(session).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', () => {
      const session = createSession();
      deleteSession(session.id);
      const retrievedSession = getSession(session.id);
      expect(retrievedSession).toBeNull();
    });

    it('should handle deleting non-existent session', () => {
      expect(() => deleteSession('non-existent')).not.toThrow();
    });

    it('should handle deleting with null session ID', () => {
      expect(() => deleteSession(null)).not.toThrow();
    });
  });
});

describe('Authentication Endpoints', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // Import and use auth router
    const authRouter = require('../routes/auth');
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth/parent/login', () => {
    it('should login with valid PIN', async () => {
      const pin = '1234';
      const storedPinHash = hashPin(pin);

      const response = await request(app)
        .post('/api/auth/parent/login')
        .send({ pin, storedPinHash });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /api/auth/parent/session', () => {
    it('should return unauthenticated for missing session', async () => {
      const response = await request(app)
        .get('/api/auth/parent/session');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ authenticated: false });
    });
  });

  describe('POST /api/auth/parent/logout', () => {
    it('should handle logout without session', async () => {
      const response = await request(app)
        .post('/api/auth/parent/logout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });
});
