/**
 * Child Session & Data Retention Tests
 * 
 * Tests for clearChildSessionData, retention bounds, TTL pruning,
 * idempotence, and isolation from durable parent settings.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearChildSessionData } from "./childSession";
import { saveActivity, getActivity, clearActivities } from "./activity";
import { saveAlerts, getAlerts, clearAlerts, createAlert } from "./alerts/alertService";
import { saveIntervention, getInterventions, clearInterventions } from "./intervention/interventionService";
import { injectSystemMessage, getInjections, clearInjections } from "./intervention/injectionService";
import { setMode, getMode, resetMode } from "./intervention/modeService";
import { addUsageSession, getTodaySessions, clearUsageSessions } from "./screen-time";
import { addUserMessage, addAssistantMessage, getMessages, clearConversation } from "./conversationStore";
import { detectRiskyMessage, analyzeBehaviorPattern, clearSafetyCaches } from "./safety";
import { getIntelligenceMetrics, clearIntelligenceCache } from "./intelligence/index";
import { setIntent, addRecentTopic, setActiveQuiz, getIntentState, clearIntent } from "./intentStore";
import { logout } from "./auth";

// Mock API client
vi.mock("./apiClient", () => ({
  post: vi.fn(),
  get: vi.fn(),
  API_ENDPOINTS: {
    detectRisk: "/api/safety/detect-risk",
    analyzePattern: "/api/safety/analyze-pattern",
    earlyWarning: "/api/safety/early-warning",
    behaviorAnalysis: "/api/intelligence/behavior",
    decisionEngine: "/api/intelligence/decision",
    logout: "/api/auth/parent/logout"
  },
}));

describe("Child Session Lifecycle & Retention Controls", () => {
  beforeEach(() => {
    localStorage.clear();
    clearChildSessionData();
    vi.clearAllMocks();
  });

  describe("clearChildSessionData - Comprehensive State Reset", () => {
    it("should clear all transient in-memory child state", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({
        status: "safe",
        is_flagged: false,
        severity: "low",
        category: "none",
        reason: "safe",
        pattern_detected: false,
        pattern_type: "none",
        confidence: 90,
        explanation: "all good"
      });

      // 1. Populate activities
      saveActivity({
        id: "act-1",
        userText: "hello",
        aiText: "hi",
        category: "general",
        timestamp: Date.now(),
        status: "safe"
      });
      expect(getActivity()).toHaveLength(1);

      // 2. Populate conversation
      addUserMessage("How are you?");
      addAssistantMessage("I am great!");
      expect(getMessages()).toHaveLength(2);

      // 3. Populate alerts
      saveAlerts([{
        id: "alert-1",
        message: "test warning",
        severity: "low",
        category: "test",
        reason: "test",
        timestamp: Date.now(),
        handled: false
      }]);
      expect(getAlerts()).toHaveLength(1);

      // 4. Populate interventions & injections & mode
      saveIntervention({
        id: "int-1",
        timestamp: Date.now(),
        type: "redirect",
        trigger: "test",
        messages_before: [],
        messages_after: []
      });
      expect(getInterventions()).toHaveLength(1);

      injectSystemMessage("Be supportive");
      expect(getInjections()).toHaveLength(1);

      setMode("support");
      expect(getMode()).toBe("support");

      // 5. Populate usage sessions
      addUsageSession(Date.now() - 5000, Date.now());
      expect(getTodaySessions()).toHaveLength(1);

      // 6. Populate intent
      setIntent("quiz");
      addRecentTopic("space");
      expect(getIntentState().currentIntent).toBe("quiz");
      expect(getIntentState().recentTopics).toEqual(["space"]);

      // 7. Ephemeral persona in localStorage
      localStorage.setItem("child_ai_current_mode", "fun");
      localStorage.setItem("child_ai_mode_expiration", String(Date.now() + 60000));

      // --- EXECUTE CENTRAL RESET ---
      clearChildSessionData();

      // --- ASSERT ALL STORES ARE EMPTIED ---
      expect(getActivity()).toHaveLength(0);
      expect(getMessages()).toHaveLength(0);
      expect(getAlerts()).toHaveLength(0);
      expect(getInterventions()).toHaveLength(0);
      expect(getInjections()).toHaveLength(0);
      expect(getMode()).toBe("normal");
      expect(getTodaySessions()).toHaveLength(0);
      expect(getIntentState().currentIntent).toBe("general");
      expect(getIntentState().recentTopics).toEqual([]);
      expect(localStorage.getItem("child_ai_mode_expiration")).toBeNull();
      expect(localStorage.getItem("child_ai_current_mode")).toBe("learning");
    });

    it("should be strictly idempotent without side effects or errors", () => {
      // First call
      expect(() => clearChildSessionData()).not.toThrow();
      // Second consecutive call
      expect(() => clearChildSessionData()).not.toThrow();
      // Third consecutive call
      expect(() => clearChildSessionData()).not.toThrow();

      expect(getActivity()).toHaveLength(0);
      expect(getMessages()).toHaveLength(0);
      expect(getAlerts()).toHaveLength(0);
    });

    it("should NOT clear durable parent configuration or application settings", () => {
      localStorage.setItem("screen_time_settings", JSON.stringify({ dailyLimit: 90 }));
      localStorage.setItem("ai_behavior_config", JSON.stringify({ selectedPreset: "learning" }));
      localStorage.setItem("parent_ai_policy", "Explain math with stories");
      localStorage.setItem("parent_policies", JSON.stringify(["Be polite"]));

      clearChildSessionData();

      expect(localStorage.getItem("screen_time_settings")).toBe(JSON.stringify({ dailyLimit: 90 }));
      expect(localStorage.getItem("ai_behavior_config")).toBe(JSON.stringify({ selectedPreset: "learning" }));
      expect(localStorage.getItem("parent_ai_policy")).toBe("Explain math with stories");
      expect(localStorage.getItem("parent_policies")).toBe(JSON.stringify(["Be polite"]));
    });
  });

  describe("Memory Bounds Enforced Across Transient Stores", () => {
    it("should cap in-memory activities at MAX_ACTIVITIES (50)", () => {
      for (let i = 0; i < 65; i++) {
        saveActivity({
          id: `act-${i}`,
          userText: `Q ${i}`,
          aiText: `A ${i}`,
          category: "general",
          timestamp: Date.now() + i,
          status: "safe"
        });
      }

      const activities = getActivity();
      expect(activities).toHaveLength(50);
      // Newest activities are kept first
      expect(activities[0].id).toBe("act-64");
      expect(activities[49].id).toBe("act-15");
    });

    it("should cap in-memory alerts at MAX_ALERTS (50)", () => {
      const testAlerts = [];
      for (let i = 0; i < 60; i++) {
        testAlerts.push({
          id: `alert-${i}`,
          message: `warning ${i}`,
          severity: "low" as const,
          category: "test",
          reason: "test",
          timestamp: Date.now() + i,
          handled: false
        });
      }
      saveAlerts(testAlerts);

      const alerts = getAlerts();
      expect(alerts).toHaveLength(50);
      expect(alerts[0].id).toBe("alert-59");
    });

    it("should cap in-memory interventions at MAX_INTERVENTIONS (50)", () => {
      for (let i = 0; i < 60; i++) {
        saveIntervention({
          id: `int-${i}`,
          timestamp: Date.now() + i,
          type: "redirect",
          trigger: `trigger ${i}`,
          messages_before: [],
          messages_after: []
        });
      }

      const interventions = getInterventions();
      expect(interventions).toHaveLength(50);
    });

    it("should cap in-memory system injections at MAX_INJECTIONS (20)", () => {
      for (let i = 0; i < 30; i++) {
        injectSystemMessage(`Directive ${i}`);
      }

      const injections = getInjections();
      expect(injections).toHaveLength(20);
      expect(injections[0]).toBe("Directive 10");
      expect(injections[19]).toBe("Directive 29");
    });

    it("should cap in-memory usage sessions at MAX_USAGE_SESSIONS (100)", () => {
      const now = Date.now();
      for (let i = 0; i < 120; i++) {
        addUsageSession(now - 1000 * (120 - i), now - 1000 * (119 - i));
      }

      const sessions = getTodaySessions();
      expect(sessions.length).toBeLessThanOrEqual(100);
    });
  });

  describe("TTL Expiration & Pruning Across Transient Stores", () => {
    it("should prune activities older than 24 hours", () => {
      const now = Date.now();
      const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;

      saveActivity({
        id: "old-act",
        userText: "old",
        aiText: "old",
        category: "general",
        timestamp: twentyFiveHoursAgo,
        status: "safe"
      });

      saveActivity({
        id: "new-act",
        userText: "new",
        aiText: "new",
        category: "general",
        timestamp: now,
        status: "safe"
      });

      const activities = getActivity();
      expect(activities).toHaveLength(1);
      expect(activities[0].id).toBe("new-act");
    });

    it("should prune alerts older than 24 hours", () => {
      const now = Date.now();
      const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;

      saveAlerts([
        {
          id: "old-alert",
          message: "old alert",
          severity: "low",
          category: "test",
          reason: "test",
          timestamp: twentyFiveHoursAgo,
          handled: false
        },
        {
          id: "new-alert",
          message: "new alert",
          severity: "low",
          category: "test",
          reason: "test",
          timestamp: now,
          handled: false
        }
      ]);

      const alerts = getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe("new-alert");
    });

    it("should prune interventions older than 24 hours", () => {
      const now = Date.now();
      const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;

      saveIntervention({
        id: "old-int",
        timestamp: twentyFiveHoursAgo,
        type: "redirect",
        trigger: "old",
        messages_before: [],
        messages_after: []
      });

      saveIntervention({
        id: "new-int",
        timestamp: now,
        type: "redirect",
        trigger: "new",
        messages_before: [],
        messages_after: []
      });

      const interventions = getInterventions();
      expect(interventions).toHaveLength(1);
      expect(interventions[0].id).toBe("new-int");
    });

    it("should expire safety cache after 1 hour", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({
        status: "safe",
        is_flagged: false,
        severity: "low",
        category: "none",
        reason: "safe"
      });

      const initialTime = 1000000;
      vi.spyOn(Date, "now").mockReturnValue(initialTime);

      // 1. Initial call populates cache
      await detectRiskyMessage("test message");
      expect(vi.mocked(post)).toHaveBeenCalledTimes(1);

      // 2. Call within 1 hour hits cache
      vi.spyOn(Date, "now").mockReturnValue(initialTime + 30 * 60 * 1000); // +30m
      await detectRiskyMessage("test message");
      expect(vi.mocked(post)).toHaveBeenCalledTimes(1);

      // 3. Call after 1 hour (> 3600000 ms) expires and refetches
      vi.spyOn(Date, "now").mockReturnValue(initialTime + 61 * 60 * 1000); // +61m
      await detectRiskyMessage("test message");
      expect(vi.mocked(post)).toHaveBeenCalledTimes(2);

      vi.spyOn(Date, "now").mockRestore();
    });
  });

  describe("Integration with Parent Logout", () => {
    it("should trigger clearChildSessionData when parent logs out", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({});

      // Populate child data
      saveActivity({
        id: "act-logout",
        userText: "before logout",
        aiText: "reply",
        category: "general",
        timestamp: Date.now(),
        status: "safe"
      });
      addUserMessage("Secret question");
      expect(getActivity()).toHaveLength(1);
      expect(getMessages()).toHaveLength(1);

      // Perform logout
      await logout();

      // Child data should be completely purged
      expect(getActivity()).toHaveLength(0);
      expect(getMessages()).toHaveLength(0);
    });
  });
});
