/**
 * Parent Configuration Service
 * Provides server-authoritative persistence for parental controls, screen-time settings,
 * and AI safety behaviors using an atomic file-backed store.
 */

const fs = require('fs');
const path = require('path');
const { CONFIG_STORE_PATH } = require('../config');

const DEFAULT_PARENT_CONFIG = {
  version: 1,
  updatedAt: Date.now(),
  screenTime: {
    dailyLimit: 60,
    isLocked: false,
    restrictionEnabled: true,
    mode: 'balanced'
  },
  aiBehavior: {
    selectedPreset: 'kid-safe',
    safetyLevel: 'strict',
    strictMode: false,
    toggles: {
      strictFiltering: true,
      encourageCuriosity: true,
      keepAnswersShort: true,
      allowStorytelling: true,
      avoidSensitiveTopics: true,
      useSimpleLanguage: true
    },
    customInstructions: '',
    parentPolicies: []
  }
};

let cachedConfig = null;
let currentStorePath = CONFIG_STORE_PATH;

/**
 * Resolve current storage file path
 */
function getStorePath() {
  return currentStorePath;
}

/**
 * Ensure the directory for the store exists
 */
function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge updates into base configuration safely
 */
function mergeConfig(base, updates = {}) {
  const merged = deepClone(base);

  if (updates.screenTime) {
    merged.screenTime = {
      ...merged.screenTime,
      ...updates.screenTime
    };
  }

  if (updates.aiBehavior) {
    const aiUpdates = updates.aiBehavior;
    merged.aiBehavior = {
      ...merged.aiBehavior,
      ...aiUpdates,
      toggles: {
        ...merged.aiBehavior.toggles,
        ...(aiUpdates.toggles || {})
      },
      parentPolicies: Array.isArray(aiUpdates.parentPolicies)
        ? [...aiUpdates.parentPolicies]
        : merged.aiBehavior.parentPolicies
    };
  }

  if (typeof updates.version === 'number') {
    merged.version = updates.version;
  }

  merged.updatedAt = Date.now();
  return merged;
}

/**
 * Load configuration from disk, falling back to defaults
 */
function loadFromDisk() {
  const filePath = getStorePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return mergeConfig(DEFAULT_PARENT_CONFIG, parsed);
    }
  } catch (error) {
    const logger = require('../lib/logger');
    logger.warn('config.read.fallback', { errorName: error.name || 'Error' });
  }
  return deepClone(DEFAULT_PARENT_CONFIG);
}

/**
 * Atomically write configuration to disk
 */
function saveToDisk(config) {
  const filePath = getStorePath();
  ensureDirExists(filePath);

  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
    throw new Error(`Failed to persist configuration to disk: ${error.message}`);
  }
}

/**
 * Get the current server-authoritative parent configuration
 */
function getParentConfig() {
  if (!cachedConfig) {
    cachedConfig = loadFromDisk();
  }
  return deepClone(cachedConfig);
}

/**
 * Update the server-authoritative parent configuration
 */
function updateParentConfig(updates) {
  const current = getParentConfig();
  const updated = mergeConfig(current, updates);
  saveToDisk(updated);
  cachedConfig = updated;
  return deepClone(cachedConfig);
}

/**
 * Migrate legacy configuration from client localStorage
 */
function migrateLegacyConfig(legacyPayload) {
  const current = getParentConfig();
  const updates = {};

  if (legacyPayload.screenTime) {
    updates.screenTime = legacyPayload.screenTime;
  }

  if (legacyPayload.aiBehavior || legacyPayload.parentPolicy || legacyPayload.parentPolicies || legacyPayload.strictMode !== undefined) {
    const ai = legacyPayload.aiBehavior || {};
    updates.aiBehavior = {
      selectedPreset: ai.selectedPreset || current.aiBehavior.selectedPreset,
      safetyLevel: ai.safetyLevel || current.aiBehavior.safetyLevel,
      strictMode: legacyPayload.strictMode !== undefined ? Boolean(legacyPayload.strictMode) : current.aiBehavior.strictMode,
      toggles: {
        ...current.aiBehavior.toggles,
        ...(ai.toggles || {})
      },
      customInstructions: legacyPayload.parentPolicy !== undefined
        ? String(legacyPayload.parentPolicy)
        : (ai.customInstructions || current.aiBehavior.customInstructions),
      parentPolicies: Array.isArray(legacyPayload.parentPolicies)
        ? legacyPayload.parentPolicies
        : (Array.isArray(ai.parentPolicies) ? ai.parentPolicies : current.aiBehavior.parentPolicies)
    };
  }

  return updateParentConfig(updates);
}

/**
 * Reset parent configuration to defaults and persist atomically
 */
function resetParentConfig() {
  const resetConfig = deepClone(DEFAULT_PARENT_CONFIG);
  resetConfig.updatedAt = Date.now();
  saveToDisk(resetConfig);
  cachedConfig = resetConfig;
  return deepClone(cachedConfig);
}

/**
 * Reset service state (for unit testing)
 */
function _resetForTesting(testPath = null) {
  if (testPath) {
    currentStorePath = testPath;
  } else {
    currentStorePath = process.env.CONFIG_STORE_PATH || path.join(__dirname, '../data/parentConfig.json');
  }
  cachedConfig = null;
}

module.exports = {
  DEFAULT_PARENT_CONFIG,
  getParentConfig,
  updateParentConfig,
  migrateLegacyConfig,
  resetParentConfig,
  _resetForTesting
};
