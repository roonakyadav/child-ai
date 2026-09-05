/**
 * Parent Configuration API Client
 * 
 * Provides typed methods for interacting with the server-authoritative
 * parent configuration and legacy migration endpoints.
 */

import { get, put, post, del } from './apiClient';
import { API_ENDPOINTS } from './apiConfig';
import { safeError } from './safeLogger';

export type ScreenTimeMode = 'strict' | 'balanced' | 'learning';
export type SafetyLevel = 'soft' | 'moderate' | 'strict';
export type PresetMode = 'kid-safe' | 'learning' | 'focus' | 'creative';

export interface ScreenTimeConfig {
  dailyLimit: number;
  isLocked: boolean;
  restrictionEnabled: boolean;
  mode: ScreenTimeMode;
}

export interface AIBehaviorConfigData {
  selectedPreset: PresetMode;
  safetyLevel: SafetyLevel;
  strictMode: boolean;
  toggles: {
    strictFiltering: boolean;
    encourageCuriosity: boolean;
    keepAnswersShort: boolean;
    allowStorytelling: boolean;
    avoidSensitiveTopics: boolean;
    useSimpleLanguage: boolean;
  };
  customInstructions: string;
  parentPolicies: string[];
}

export interface ServerParentConfig {
  version: number;
  updatedAt: number;
  screenTime: ScreenTimeConfig;
  aiBehavior: AIBehaviorConfigData;
}

/**
 * Fetch the authoritative parent configuration from the server
 */
export async function fetchServerParentConfig(): Promise<ServerParentConfig | null> {
  try {
    const data = await get<{ config: ServerParentConfig }>(API_ENDPOINTS.parentConfig);
    return data.config;
  } catch (error) {
    safeError('ParentConfigClient failed to fetch server config', error);
    return null;
  }
}

/**
 * Update the authoritative parent configuration on the server
 */
export async function updateServerParentConfig(
  updates: Partial<{
    screenTime: Partial<ScreenTimeConfig>;
    aiBehavior: Partial<AIBehaviorConfigData>;
  }>
): Promise<ServerParentConfig | null> {
  try {
    const data = await put<{ success: boolean; config: ServerParentConfig }>(
      API_ENDPOINTS.parentConfig,
      updates
    );
    return data.config;
  } catch (error) {
    safeError('ParentConfigClient failed to update server config', error);
    throw error;
  }
}

/**
 * One-time migration of legacy localStorage configuration to server
 */
export async function migrateLegacyConfigToServer(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  const legacyPayload: Record<string, unknown> = {};
  let hasLegacyData = false;

  const rawScreenTime = localStorage.getItem('screen_time_settings');
  if (rawScreenTime) {
    try {
      legacyPayload.screenTime = JSON.parse(rawScreenTime);
      hasLegacyData = true;
    } catch {
      // Ignore parse failure on invalid legacy data
    }
  }

  const rawAiConfig = localStorage.getItem('ai_behavior_config');
  if (rawAiConfig) {
    try {
      legacyPayload.aiBehavior = JSON.parse(rawAiConfig);
      hasLegacyData = true;
    } catch {
      // Ignore parse failure on invalid legacy data
    }
  }

  const rawPolicy = localStorage.getItem('parent_ai_policy');
  if (rawPolicy) {
    legacyPayload.parentPolicy = rawPolicy;
    hasLegacyData = true;
  }

  const rawPoliciesList = localStorage.getItem('parent_policies');
  if (rawPoliciesList) {
    try {
      legacyPayload.parentPolicies = JSON.parse(rawPoliciesList);
      hasLegacyData = true;
    } catch {
      // Ignore parse failure on invalid legacy data
    }
  }

  const rawAiSettings = localStorage.getItem('ai_settings');
  if (rawAiSettings) {
    try {
      const parsed = JSON.parse(rawAiSettings);
      if (typeof parsed.strictMode === 'boolean') {
        legacyPayload.strictMode = parsed.strictMode;
        hasLegacyData = true;
      }
    } catch {
      // Ignore parse failure on invalid legacy data
    }
  }

  if (!hasLegacyData) {
    return false;
  }

  try {
    const res = await post<{ success: boolean; migrated: boolean; config: ServerParentConfig }>(
      API_ENDPOINTS.migrateConfig,
      legacyPayload
    );

    if (res?.success) {
      // Successfully migrated to authoritative server store
      return true;
    }
    return false;
  } catch (error) {
    safeError('ParentConfigClient migration failed', error);
    return false;
  }
}

/**
 * Reset parent configuration to defaults on the server and invalidate session
 */
export async function deleteServerParentConfig(): Promise<boolean> {
  try {
    const res = await del<{ success: boolean; message: string }>(API_ENDPOINTS.parentConfig);
    return res?.success === true;
  } catch (error) {
    safeError('ParentConfigClient failed to reset server config', error);
    return false;
  }
}
