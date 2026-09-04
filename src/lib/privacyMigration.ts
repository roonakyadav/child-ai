/**
 * Privacy Migration Utility
 * 
 * Cleans up legacy sensitive child data from browser localStorage
 * while strictly preserving non-sensitive parent configuration.
 */

export const SENSITIVE_STORAGE_KEYS = [
  "child_activity",
  "child_ai_alerts",
  "ai_intelligence_cache",
  "safety_cache",
  "ai_safety_cache",
  "pattern_cache",
  "ai_pattern_cache",
  "interventions",
  "usage_sessions",
  "conversation_history",
  "global_conversation_history",
  "child_ai_growth_history",
] as const;

/**
 * One-time cleanup for legacy sensitive localStorage keys
 */
export function clearLegacySensitiveData(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    for (const key of SENSITIVE_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error("[PrivacyMigration] Error clearing legacy sensitive data:", error);
  }
}
