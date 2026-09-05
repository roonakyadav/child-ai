/**
 * Frontend Resilience & Safe Error Handling Tests
 * 
 * Verifies:
 * 1. Root Error Boundary catches render crashes and renders safe, non-leaking fallbacks
 * 2. Child fallback ("Something went wrong. Please start a new chat.") vs Parent fallback ("Something went wrong. Please reload the dashboard.")
 * 3. Zero leakage of stack traces, raw error messages, tokens, or provider internals in the DOM
 * 4. Error Boundary recovery mechanism resets state and invokes onReset
 * 5. Safe Logger sanitizes operational logs without exposing sensitive payloads
 * 6. API Client normalizes errors into typed ApiError with safe user-facing messages and request correlation
 * 7. getSafeErrorMessage guarantees zero internal leakage on arbitrary errors
 */

import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import { safeError, safeWarn, safeInfo, extractSafeErrorDetails } from '../lib/safeLogger';
import { ApiError, getSafeErrorMessage, getSafeUserMessage } from '../lib/apiClient';
import * as childSession from '../lib/childSession';

// Problematic component that intentionally throws on render
const CrashingComponent: React.FC<{ shouldCrash: boolean; secretErrorMessage?: string }> = ({
  shouldCrash,
  secretErrorMessage = 'Fatal server failure at internal/db: connection password=SECRET_TOKEN_123',
}) => {
  if (shouldCrash) {
    throw new Error(secretErrorMessage);
  }
  return <div data-testid="healthy-component">All systems normal</div>;
};

// Component that allows testing stateful recovery
export const RecoverableComponent: React.FC = () => {
  const [hasCrashed, setHasCrashed] = useState(true);

  if (hasCrashed) {
    return (
      <div>
        <button data-testid="fix-button" onClick={() => setHasCrashed(false)}>
          Fix State
        </button>
        <CrashingComponent shouldCrash={true} secretErrorMessage="Sensitive internal exception stack trace" />
      </div>
    );
  }

  return <div data-testid="recovered-component">System successfully recovered</div>;
};

describe('Frontend Resilience & Safe Error Handling Suite', () => {
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleInfo: typeof console.info;

  let errorHandler: (e: Event) => void;

  beforeEach(() => {
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalConsoleInfo = console.info;
    // Suppress React's default console error logging for expected caught boundary errors
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();

    errorHandler = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('error', errorHandler);

    // Mock location.reload to prevent JSDOM navigation error
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        pathname: '/',
        reload: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    window.removeEventListener('error', errorHandler);
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
    vi.restoreAllMocks();
  });

  describe('1. Root Error Boundary - Child Variant', () => {
    it('renders the child-safe fallback message when a child component crashes', () => {
      const { container } = render(
        <ErrorBoundary variant="child">
          <CrashingComponent shouldCrash={true} />
        </ErrorBoundary>
      );

      // Verify safe child-facing UI message
      expect(screen.getByText('Something went wrong.')).toBeDefined();
      expect(screen.getByText('Something went wrong. Please start a new chat.')).toBeDefined();
      expect(screen.getByRole('button', { name: /start new chat/i })).toBeDefined();

      // STRICT CHECK: Zero leakage of sensitive error details or stack trace
      expect(container.textContent).not.toContain('SECRET_TOKEN_123');
      expect(container.textContent).not.toContain('Fatal server failure');
      expect(container.textContent).not.toContain('internal/db');
      expect(container.textContent).not.toContain('Error:');
      expect(container.textContent).not.toContain('stack');
    });

    it('clears child session data and resets boundary on child recovery action', () => {
      const clearSpy = vi.spyOn(childSession, 'clearChildSessionData');
      const onReset = vi.fn();

      render(
        <ErrorBoundary variant="child" onReset={onReset}>
          <CrashingComponent shouldCrash={true} />
        </ErrorBoundary>
      );

      const recoveryButton = screen.getByRole('button', { name: /start new chat/i });
      fireEvent.click(recoveryButton);

      // Child session data must be cleared to prevent poisoned transient state
      expect(clearSpy).toHaveBeenCalled();
      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('2. Root Error Boundary - Parent Variant', () => {
    it('renders the parent-safe fallback message when a parent component crashes', () => {
      const { container } = render(
        <ErrorBoundary variant="parent">
          <CrashingComponent
            shouldCrash={true}
            secretErrorMessage="Database connection timeout: groq_api_key=gsk_secret12345"
          />
        </ErrorBoundary>
      );

      // Verify safe parent-facing UI message
      expect(screen.getByText('Something went wrong.')).toBeDefined();
      expect(screen.getByText('Something went wrong. Please reload the dashboard.')).toBeDefined();
      expect(screen.getByRole('button', { name: /reload dashboard/i })).toBeDefined();

      // STRICT CHECK: Zero leakage of credentials or internals
      expect(container.textContent).not.toContain('gsk_secret12345');
      expect(container.textContent).not.toContain('groq_api_key');
      expect(container.textContent).not.toContain('Database connection timeout');
    });

    it('triggers onReset callback on recovery button click', () => {
      const onReset = vi.fn();

      render(
        <ErrorBoundary variant="parent" onReset={onReset}>
          <CrashingComponent shouldCrash={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: /reload dashboard/i });
      fireEvent.click(reloadButton);

      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('3. Root Error Boundary - Auto Variant Routing Context', () => {
    it('automatically defaults to parent message when window location is under /parent', () => {
      const originalPathname = window.location.pathname;
      try {
        Object.defineProperty(window, 'location', {
          value: { ...window.location, pathname: '/parent/dashboard', reload: vi.fn() },
          writable: true,
        });

        render(
          <ErrorBoundary variant="auto">
            <CrashingComponent shouldCrash={true} />
          </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong. Please reload the dashboard.')).toBeDefined();
        expect(screen.getByRole('button', { name: /reload dashboard/i })).toBeDefined();
      } finally {
        Object.defineProperty(window, 'location', {
          value: { ...window.location, pathname: originalPathname },
          writable: true,
        });
      }
    });

    it('automatically defaults to child message when window location is root /', () => {
      const originalPathname = window.location.pathname;
      try {
        Object.defineProperty(window, 'location', {
          value: { ...window.location, pathname: '/', reload: vi.fn() },
          writable: true,
        });

        render(
          <ErrorBoundary variant="auto">
            <CrashingComponent shouldCrash={true} />
          </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong. Please start a new chat.')).toBeDefined();
        expect(screen.getByRole('button', { name: /start new chat/i })).toBeDefined();
      } finally {
        Object.defineProperty(window, 'location', {
          value: { ...window.location, pathname: originalPathname },
          writable: true,
        });
      }
    });

    it('supports custom function fallback with reset capability', () => {
      render(
        <ErrorBoundary
          fallback={({ resetErrorBoundary }) => (
            <div>
              <p>Custom Minimal Fallback</p>
              <button data-testid="custom-reset" onClick={resetErrorBoundary}>
                Retry Custom
              </button>
            </div>
          )}
        >
          <CrashingComponent shouldCrash={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Minimal Fallback')).toBeDefined();
      expect(screen.getByTestId('custom-reset')).toBeDefined();
    });
  });

  describe('4. Safe Frontend Logger (Zero Leakage)', () => {
    it('extracts only safe operational metadata without payload bodies or stacks', () => {
      const unsafeError = {
        name: 'ApiError',
        code: 'NETWORK_ERROR',
        status: 503,
        requestId: 'req-abc-789',
        message: 'Internal SQL query failed with child message: I hate my school',
        stack: 'Error at /backend/routes/chat.js:10:5',
        prompt: 'System prompt containing internal rules',
        payload: { pin: '1234' },
      };

      const details = extractSafeErrorDetails(unsafeError);

      expect(details).toEqual({
        name: 'ApiError',
        code: 'NETWORK_ERROR',
        status: 503,
        requestId: 'req-abc-789',
      });

      expect(details).not.toHaveProperty('message');
      expect(details).not.toHaveProperty('stack');
      expect(details).not.toHaveProperty('prompt');
      expect(details).not.toHaveProperty('payload');
    });

    it('logs sanitized messages to console without sensitive substrings', () => {
      const mockConsoleError = vi.fn();
      console.error = mockConsoleError;

      const apiErr = new ApiError(
        'Database query failed: leaked-child-prompt-12345',
        500,
        'SERVER_ERROR',
        'req-xyz-999'
      );

      safeError('Chat submission failure', apiErr);

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      const loggedString = mockConsoleError.mock.calls[0][0];

      expect(loggedString).toContain('[SafeLog] Chat submission failure');
      expect(loggedString).toContain('code=SERVER_ERROR');
      expect(loggedString).toContain('status=500');
      expect(loggedString).toContain('reqId=req-xyz-999');
      expect(loggedString).not.toContain('leaked-child-prompt-12345');
      expect(loggedString).not.toContain('Database query failed');
    });

    it('safeWarn and safeInfo do not crash on undefined or empty values', () => {
      const mockWarn = vi.fn();
      const mockInfo = vi.fn();
      console.warn = mockWarn;
      console.info = mockInfo;

      safeWarn('Session check');
      safeWarn('Session check', 'User refreshed');
      safeInfo('App startup');
      safeInfo('App startup', 'Ready');

      expect(mockWarn).toHaveBeenCalledWith('[SafeLog] Session check');
      expect(mockWarn).toHaveBeenCalledWith('[SafeLog] Session check: User refreshed');
      expect(mockInfo).toHaveBeenCalledWith('[SafeLog] App startup');
      expect(mockInfo).toHaveBeenCalledWith('[SafeLog] App startup: Ready');
    });
  });

  describe('5. API Error Normalization & User-Facing Safety', () => {
    it('returns appropriate safe user messages for all ApiErrorCodes', () => {
      expect(getSafeUserMessage('NETWORK_ERROR')).toBe(
        'Unable to connect to the server. Please check your internet connection and try again.'
      );
      expect(getSafeUserMessage('TIMEOUT')).toBe(
        'The request took too long to complete. Please try again.'
      );
      expect(getSafeUserMessage('UNAUTHORIZED')).toBe(
        'Authentication required. Please sign in again.'
      );
      expect(getSafeUserMessage('FORBIDDEN')).toBe(
        'Access is restricted or the application is currently locked by a parent.'
      );
      expect(getSafeUserMessage('NOT_FOUND')).toBe(
        'The requested resource could not be found.'
      );
      expect(getSafeUserMessage('RATE_LIMITED')).toBe(
        'Too many requests. Please wait a moment before trying again.'
      );
      expect(getSafeUserMessage('SERVICE_UNAVAILABLE')).toBe(
        'Service is temporarily unavailable. Please try again shortly.'
      );
      expect(getSafeUserMessage('INVALID_JSON')).toBe(
        'Received an unexpected response from the server. Please try again.'
      );
      expect(getSafeUserMessage('SERVER_ERROR')).toBe(
        'An unexpected server error occurred. Please try again.'
      );
      expect(getSafeUserMessage('CLIENT_ERROR')).toBe(
        'An unexpected error occurred. Please try again.'
      );
      expect(getSafeUserMessage('UNKNOWN_ERROR')).toBe(
        'An unexpected error occurred. Please try again.'
      );
    });

    it('getSafeErrorMessage maps ApiError instances to safeMessage', () => {
      const apiError = new ApiError(
        'Leaked internal backend stack trace: token expired at GroqAdapter',
        429,
        'RATE_LIMITED',
        'req-rate-1'
      );

      const message = getSafeErrorMessage(apiError);
      expect(message).toBe('Too many requests. Please wait a moment before trying again.');
      expect(message).not.toContain('GroqAdapter');
      expect(message).not.toContain('stack trace');
    });

    it('getSafeErrorMessage falls back to generic safe message for arbitrary errors', () => {
      const rawError = new Error('Raw unhandled TypeError: undefined is not a function at line 42');
      expect(getSafeErrorMessage(rawError)).toBe('An unexpected error occurred. Please try again.');

      expect(getSafeErrorMessage('Random string exception')).toBe(
        'An unexpected error occurred. Please try again.'
      );
      expect(getSafeErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
      expect(getSafeErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
      expect(getSafeErrorMessage({ custom: 'object' })).toBe('An unexpected error occurred. Please try again.');
    });

    it('ApiError preserves correlation requestId from server headers', () => {
      const err = new ApiError(
        'Bad Request',
        400,
        'CLIENT_ERROR',
        'req-corr-456'
      );

      expect(err.requestId).toBe('req-corr-456');
      expect(err.status).toBe(400);
      expect(err.code).toBe('CLIENT_ERROR');
    });
  });
});
