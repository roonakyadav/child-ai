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
  "ai_intent_state",
  "intent_state",
  "current_intent_state",
  "ai_system_injections",
  "injection_storage",
  "ai_mode",
  "mode_storage",
  "ai_mode_metadata",
  "mode_metadata",
  "ai_insights_cache",
  "ai_insights_activity_count",
  "parent_actions",
  "child_ai_screen_time",
  "child_ai_policy",
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
