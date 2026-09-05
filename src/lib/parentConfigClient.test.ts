/**
 * Parent Config Client Tests
 * Tests for parentConfigClient utilities and legacy migration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchServerParentConfig,
  updateServerParentConfig,
  migrateLegacyConfigToServer
} from './parentConfigClient';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Parent Configuration Client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorage.clear();
  });

  describe('fetchServerParentConfig', () => {
    it('should fetch and return authoritative parent config', async () => {
      const mockConfig = {
        version: 1,
        updatedAt: 123456789,
        screenTime: { dailyLimit: 60, isLocked: false, restrictionEnabled: true, mode: 'balanced' },
        aiBehavior: {
          selectedPreset: 'kid-safe',
          safetyLevel: 'strict',
          strictMode: false,
          toggles: { strictFiltering: true },
          customInstructions: '',
          parentPolicies: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ config: mockConfig }))
      });

      const result = await fetchServerParentConfig();
      expect(result).toEqual(mockConfig);
    });

    it('should return null when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ error: 'Authentication required' }))
      });

      const result = await fetchServerParentConfig();
      expect(result).toBeNull();
    });
  });

  describe('updateServerParentConfig', () => {
    it('should send PUT request and return updated config', async () => {
      const updatedConfig = {
        version: 1,
        updatedAt: 123456789,
        screenTime: { dailyLimit: 45, isLocked: true, restrictionEnabled: true, mode: 'strict' },
        aiBehavior: {
          selectedPreset: 'learning',
          safetyLevel: 'strict',
          strictMode: true,
          toggles: { strictFiltering: true },
          customInstructions: '',
          parentPolicies: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, config: updatedConfig }))
      });

      const result = await updateServerParentConfig({ screenTime: { dailyLimit: 45, isLocked: true } });
      expect(result).toEqual(updatedConfig);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/config/parent',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ screenTime: { dailyLimit: 45, isLocked: true } })
        })
      );
    });
  });

  describe('migrateLegacyConfigToServer', () => {
    it('should return false if no legacy data exists in localStorage', async () => {
      const migrated = await migrateLegacyConfigToServer();
      expect(migrated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should extract legacy keys and post them to migration endpoint', async () => {
      localStorage.setItem('screen_time_settings', JSON.stringify({ dailyLimit: 90, isLocked: false }));
      localStorage.setItem('parent_ai_policy', 'Be very helpful');
      localStorage.setItem('parent_policies', JSON.stringify(['Rule 1']));
      localStorage.setItem('ai_settings', JSON.stringify({ strictMode: true }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, migrated: true }))
      });

      const migrated = await migrateLegacyConfigToServer();
      expect(migrated).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/config/parent/migrate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"dailyLimit":90')
        })
      );
    });
  });

  describe('deleteServerParentConfig', () => {
    it('should issue DELETE request to parent config endpoint and return true on success', async () => {
      const { deleteServerParentConfig } = await import('./parentConfigClient');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true, message: 'Parent configuration successfully reset' }))
      });

      const success = await deleteServerParentConfig();
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/config/parent',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });

    it('should return false on failure or network error', async () => {
      const { deleteServerParentConfig } = await import('./parentConfigClient');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve(JSON.stringify({ error: 'Server error' }))
      });

      const success = await deleteServerParentConfig();
      expect(success).toBe(false);
    });
  });
});

