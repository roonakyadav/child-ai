/**
 * API Client Tests
 * 
 * Tests for the centralized API client using mocks.
 * Does not call the live backend.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, post, put, del, ApiError, getApiBaseUrl } from './apiClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Reset environment variables
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001');
    vi.stubEnv('VITE_API_TIMEOUT_MS', '30000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getApiBaseUrl', () => {
    it('should return the configured API base URL', () => {
      expect(getApiBaseUrl()).toBe('http://localhost:3001');
    });

    it('should use default URL when not configured', () => {
      vi.unstubAllEnvs();
      expect(getApiBaseUrl()).toBe('http://localhost:3001');
    });
  });

  describe('GET request', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await get<{ data: string }>('/test');
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include'
        })
      );
    });

    it('should handle non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found')
      });

      await expect(get('/test')).rejects.toThrow(ApiError);
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('invalid json')
      });

      await expect(get('/test')).rejects.toThrow(ApiError);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('')
      });

      const result = await get('/test');
      expect(result).toEqual({});
    });
  });

  describe('POST request', () => {
    it('should make successful POST request', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await post<{ success: boolean }>('/test', { data: 'test' });
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ data: 'test' })
        })
      );
    });

    it('should send JSON headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}')
      });

      await post('/test', {});
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  describe('PUT request', () => {
    it('should make successful PUT request', async () => {
      const mockResponse = { updated: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await put<{ updated: boolean }>('/test', { data: 'test' });
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });
  });

  describe('DELETE request', () => {
    it('should make successful DELETE request', async () => {
      const mockResponse = { deleted: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse))
      });

      const result = await del<{ deleted: boolean }>('/test');
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/test',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle timeout', async () => {
      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        });
      });

      // Set short timeout for test
      vi.stubEnv('VITE_API_TIMEOUT_MS', '50');

      await expect(post('/test', {})).rejects.toThrow(ApiError);
    });

    it('should handle network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      await expect(get('/test')).rejects.toThrow(ApiError);
    });

    it('should not expose sensitive error details', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Internal server error with secret key'));

      let errorThrown = false;
      try {
        await get('/test');
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).not.toContain('secret key');
      }
      expect(errorThrown).toBe(true);
    });

    it('should provide typed error codes', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      let errorThrown = false;
      try {
        await get('/test');
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe('NETWORK_ERROR');
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe('Credentials behavior', () => {
    it('should include credentials by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}')
      });

      await get('/test');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include'
        })
      );
    });

    it('should allow overriding credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}')
      });

      await get('/test', { credentials: 'same-origin' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'same-origin'
        })
      );
    });
  });

  describe('Endpoint path construction', () => {
    it('should construct correct URL with base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}')
      });

      await get('/api/test');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/test',
        expect.any(Object)
      );
    });

    it('should handle paths without leading slash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{}')
      });

      await get('api/test');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/test',
        expect.any(Object)
      );
    });
  });
});
