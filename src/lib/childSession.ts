/**
 * Child Session Lifecycle & Privacy Management
 * 
 * Provides centralized, idempotent mechanisms to reset all transient in-memory
 * child data when a child session ends, a new session starts, or the parent logs out.
 * 
 * Guarantees that no sensitive child data persists across sessions.
 */

import { clearActivities } from "./activity";
import { clearConversation } from "./conversationStore";
import { clearAlerts } from "./alerts/alertService";
import { clearSafetyCaches } from "./safety";
import { clearInterventions } from "./intervention/interventionService";
import { clearInjections } from "./intervention/injectionService";
import { resetMode as resetInterventionMode } from "./intervention/modeService";
import { clearUsageSessions } from "./screen-time";
import { clearIntelligenceCache } from "./intelligence/index";
import { clearIntent } from "./intentStore";

/**
 * Centrally reset and clear all transient child-related in-memory state.
 * 
 * Clears:
 * - Activities & question history
 * - Chat conversation memory
 * - Safety alerts & early warnings
 * - Semantic safety & pattern caches
 * - Interventions & system injections
 * - Active intervention modes
 * - Usage session segments
 * - Intelligence metrics cache
 * - Conversation intent state
 * - Ephemeral child persona mode
 * 
 * Does NOT clear:
 * - Durable server-authoritative parent configuration
 * - Static application configuration
 * 
 * Operation is strictly idempotent.
 */
export function clearChildSessionData(): void {
  try {
    // 1. In-memory activities
    clearActivities();

    // 2. Conversation store
    clearConversation();

    // 3. Safety alerts
    clearAlerts();

    // 4. Safety and pattern caches
    clearSafetyCaches();

    // 5. Interventions and injections
    clearInterventions();
    clearInjections();
    resetInterventionMode();

    // 6. In-memory usage sessions
    clearUsageSessions();

    // 7. Intelligence cache
    clearIntelligenceCache();

    // 8. Intent state
    clearIntent();

    // 9. Reset ephemeral child companion persona if stored locally
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.removeItem("child_ai_mode_expiration");
        localStorage.setItem("child_ai_current_mode", "learning");
        window.dispatchEvent(new CustomEvent("ai-mode-changed", {
          detail: { mode: "learning", expiration: null }
        }));
      } catch {
        // Ignore localStorage access errors (e.g. sandbox)
      }
    }
  } catch (error) {
    console.error("[ChildSession] Error clearing session data:", error);
  }
}
