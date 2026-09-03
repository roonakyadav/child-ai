/**
 * Test Setup
 * Global test configuration and utilities
 */

import { vi } from 'vitest';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX = '100';
process.env.AI_RATE_LIMIT_MAX = '30';
process.env.GROQ_API_KEY = 'test-api-key';

// Mock timers for deterministic tests
vi.useFakeTimers();
