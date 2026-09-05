/**
 * Privacy Policy and Data Retention Specification
 * 
 * Defines explicit data lifecycles, memory bounds, and retention guarantees
 * for child-ai to ensure privacy-by-design and compliance with COPPA/GDPR-K.
 */

export const RETENTION_POLICY = {
  /**
   * 1. Child Conversational & Activity Data
   * - Storage: Client volatile memory only (RAM).
   * - Scope: Active interactive child session.
   * - Maximum Retention: Cleared upon child session end, parent logout, or tab close.
   * - Persistence: Strictly NEVER written to browser localStorage, IndexedDB, or server disk.
   */
  CHILD_ACTIVITY: {
    storage: "memory-only",
    maxItems: 50,
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours max lifetime
    persisted: false,
  },
  CONVERSATION_HISTORY: {
    storage: "memory-only",
    maxItems: 20,
    persisted: false,
  },
  
  /**
   * 2. Safety, Risk, and Behavioral Analysis Caches
   * - Storage: Volatile in-memory LRU/bounded maps.
   * - Maximum Retention: Pruned on TTL expiry or session cleanup.
   * - Persistence: Strictly NEVER written to persistent storage.
   */
  SAFETY_CACHE: {
    storage: "memory-only",
    maxItems: 100,
    ttlMs: 60 * 60 * 1000, // 1 hour TTL
    persisted: false,
  },
  PATTERN_CACHE: {
    storage: "memory-only",
    maxItems: 20,
    ttlMs: 60 * 60 * 1000, // 1 hour TTL
    persisted: false,
  },
  ALERTS: {
    storage: "memory-only",
    maxItems: 50,
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours TTL
    persisted: false,
  },
  INTERVENTIONS: {
    storage: "memory-only",
    maxItems: 50,
    ttlMs: 24 * 60 * 60 * 1000,
    persisted: false,
  },
  USAGE_SESSIONS: {
    storage: "memory-only",
    maxItems: 100,
    ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days in-memory
    persisted: false,
  },

  /**
   * 3. Parent Configuration
   * - Storage: Server-authoritative persistent atomic file store.
   * - Retention: Durable until explicitly updated or deleted/reset by authenticated parent.
   * - Security: Only accessible via parent-authenticated endpoints with HTTP-only cookies.
   */
  PARENT_CONFIGURATION: {
    storage: "server-atomic-file",
    persisted: true,
  },

  /**
   * 4. Parent Authentication & Session State
   * - Storage: Server-side in-memory session Map with HTTP-only secure cookies.
   * - Expiry: 30-minute idle TTL, max 1000 concurrent sessions.
   * - Invalidation: Revoked on explicit logout or parent data reset.
   */
  PARENT_AUTH_SESSION: {
    storage: "server-memory",
    ttlMs: 30 * 60 * 1000, // 30 minutes
    maxSessions: 1000,
    persisted: false,
  }
} as const;
