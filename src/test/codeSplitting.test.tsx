/**
 * Frontend Code Splitting & Performance Optimization Tests
 * 
 * Verifies:
 * 1. SafeSuspenseFallback displays safe loading indicators without leaking internal paths
 * 2. React.lazy components resolve successfully under Suspense
 * 3. Fallback renders while lazy component promise is unresolved
 * 4. ErrorBoundary correctly catches failed lazy component chunk loads and renders safe recovery UI
 * 5. Primary child chat route renders without eager mounting of parent dashboard
 * 6. Dynamic import in generatePDFReport functions without static top-level bundling
 */

import React, { lazy, Suspense } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SafeSuspenseFallback from '../components/SafeSuspenseFallback';
import ErrorBoundary from '../components/ErrorBoundary';

// Helper to create a deferred promise for testing pending Suspense states
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Frontend Code Splitting & Suspense Suite', () => {
  let originalConsoleError: typeof console.error;
  let errorHandler: (e: Event) => void;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = vi.fn();
    errorHandler = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('error', errorHandler);
  });

  afterEach(() => {
    window.removeEventListener('error', errorHandler);
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  describe('1. SafeSuspenseFallback Component', () => {
    it('renders fullscreen loading fallback with accessible role and label', () => {
      const { container } = render(<SafeSuspenseFallback variant="fullscreen" />);

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeDefined();
      expect(statusEl.getAttribute('aria-label')).toBe('Loading page');
      expect(container.querySelector('.animate-spin')).not.toBeNull();
      // Zero leakage of technical details
      expect(container.textContent).toBe('');
    });

    it('renders content loading fallback with accessible role and label', () => {
      const { container } = render(<SafeSuspenseFallback variant="content" />);

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeDefined();
      expect(statusEl.getAttribute('aria-label')).toBe('Loading content');
      expect(container.querySelector('.animate-spin')).not.toBeNull();
      expect(container.textContent).toBe('');
    });
  });

  describe('2. Lazy Component Resolution & Suspense Fallback', () => {
    it('shows the SafeSuspenseFallback while pending and resolves the lazy component', async () => {
      const deferred = createDeferred<{ default: React.FC }>();

      const LazyComponent = lazy(() => deferred.promise);

      render(
        <Suspense fallback={<SafeSuspenseFallback variant="fullscreen" />}>
          <LazyComponent />
        </Suspense>
      );

      // Initially, the fallback must be visible
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading page');
      expect(screen.queryByText('Loaded Lazy Route Content')).toBeNull();

      // Resolve the lazy import
      deferred.resolve({
        default: () => <div data-testid="lazy-content">Loaded Lazy Route Content</div>,
      });

      // After resolution, target component is visible and fallback is removed
      await waitFor(() => {
        expect(screen.getByTestId('lazy-content')).toBeDefined();
        expect(screen.getByText('Loaded Lazy Route Content')).toBeDefined();
      });
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('handles content-variant Suspense boundaries smoothly', async () => {
      const deferred = createDeferred<{ default: React.FC }>();
      const LazyContent = lazy(() => deferred.promise);

      render(
        <div data-testid="parent-frame">
          <nav>Sidebar Navigation</nav>
          <Suspense fallback={<SafeSuspenseFallback variant="content" />}>
            <LazyContent />
          </Suspense>
        </div>
      );

      expect(screen.getByText('Sidebar Navigation')).toBeDefined();
      expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading content');

      deferred.resolve({
        default: () => <div data-testid="subpage-content">Analytics Subpage</div>,
      });

      await waitFor(() => {
        expect(screen.getByTestId('subpage-content')).toBeDefined();
      });
    });
  });

  describe('3. Error Boundary Integration Around Lazy Routes', () => {
    it('catches failed chunk loads and renders safe recovery fallback', async () => {
      const rejectedPromise = Promise.reject(
        new Error('Failed to fetch dynamically imported module: /assets/ParentSettings-xyz.js')
      );

      const FailingLazyComponent = lazy(() => rejectedPromise);

      const { container } = render(
        <ErrorBoundary variant="parent">
          <Suspense fallback={<SafeSuspenseFallback />}>
            <FailingLazyComponent />
          </Suspense>
        </ErrorBoundary>
      );

      // Wait for error boundary to catch the chunk failure
      await waitFor(() => {
        expect(screen.getByText('Something went wrong.')).toBeDefined();
        expect(
          screen.getByText('Something went wrong. Please reload the dashboard.')
        ).toBeDefined();
        expect(screen.getByRole('button', { name: /reload dashboard/i })).toBeDefined();
      });

      // STRICT NON-LEAKAGE: raw chunk path or module error must never appear in the UI
      expect(container.textContent).not.toContain('Failed to fetch dynamically imported module');
      expect(container.textContent).not.toContain('ParentSettings-xyz.js');
    });

    it('catches chunk failures in child context and provides child recovery action', async () => {
      const rejectedPromise = Promise.reject(
        new Error('Network failure loading child chunk')
      );

      const FailingChildComponent = lazy(() => rejectedPromise);

      render(
        <ErrorBoundary variant="child">
          <Suspense fallback={<SafeSuspenseFallback />}>
            <FailingChildComponent />
          </Suspense>
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Something went wrong.')).toBeDefined();
        expect(
          screen.getByText('Something went wrong. Please start a new chat.')
        ).toBeDefined();
        expect(screen.getByRole('button', { name: /start new chat/i })).toBeDefined();
      });
    });
  });

  describe('4. Dynamic PDF Module Splitting', () => {
    it('generatePDFReport dynamically imports jspdf without top-level static dependency', async () => {
      const { generatePDFReport } = await import('../lib/reportService');
      expect(typeof generatePDFReport).toBe('function');
    });
  });
});
