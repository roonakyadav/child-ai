import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearLegacySensitiveData, SENSITIVE_STORAGE_KEYS } from "./privacyMigration";
import { saveActivity, getActivity, clearActivities } from "./activity";
import { saveAlerts, getAlerts, clearAlerts, createAlert } from "./alerts/alertService";
import { saveIntervention, getInterventions, clearInterventions } from "./intervention/interventionService";
import { addUsageSession, getTodaySessions, clearUsageSessions } from "./screen-time";
import { addUserMessage, addAssistantMessage, getMessages, clearConversation } from "./conversationStore";
import { detectRiskyMessage, analyzeBehaviorPattern, clearSafetyCaches } from "./safety";
import { getIntelligenceMetrics, clearIntelligenceCache } from "./intelligence/index";
import { gatherAllAppData } from "./reportService";

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
  },
}));

describe("Sensitive Child Data Privacy & In-Memory Isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    clearActivities();
    clearAlerts();
    clearInterventions();
    clearUsageSessions();
    clearConversation();
    clearSafetyCaches();
    clearIntelligenceCache();
    vi.clearAllMocks();
  });

  describe("Legacy Sensitive Data Migration", () => {
    it("should remove all legacy sensitive keys from localStorage", () => {
      // Populate localStorage with legacy sensitive data
      for (const key of SENSITIVE_STORAGE_KEYS) {
        localStorage.setItem(key, JSON.stringify({ sensitive: "data" }));
      }

      // Also populate non-sensitive parent configuration keys
      localStorage.setItem("parent_policies", JSON.stringify([{ id: "p1" }]));
      localStorage.setItem("screen_time_settings", JSON.stringify({ dailyLimit: 60 }));
      localStorage.setItem("ai_settings", JSON.stringify({ strictMode: true }));

      // Run migration cleanup
      clearLegacySensitiveData();

      // Verify every sensitive key is purged
      for (const key of SENSITIVE_STORAGE_KEYS) {
        expect(localStorage.getItem(key)).toBeNull();
      }

      // Verify non-sensitive parent configuration is strictly preserved
      expect(localStorage.getItem("parent_policies")).toBe(JSON.stringify([{ id: "p1" }]));
      expect(localStorage.getItem("screen_time_settings")).toBe(JSON.stringify({ dailyLimit: 60 }));
      expect(localStorage.getItem("ai_settings")).toBe(JSON.stringify({ strictMode: true }));
    });
  });

  describe("Child Activity Storage", () => {
    it("should store activities in memory and never write to localStorage", () => {
      saveActivity({
        id: "act-1",
        userText: "Hello AI",
        aiText: "Hi child!",
        category: "general",
        timestamp: Date.now(),
        status: "safe",
      });

      expect(localStorage.getItem("child_activity")).toBeNull();
      expect(getActivity()).toHaveLength(1);
      expect(getActivity()[0].userText).toBe("Hello AI");
    });

    it("should maintain max capacity in-memory without persistent storage", () => {
      for (let i = 0; i < 60; i++) {
        saveActivity({
          id: `act-${i}`,
          userText: `Question ${i}`,
          aiText: `Answer ${i}`,
          category: "general",
          timestamp: Date.now() + i,
          status: "safe",
        });
      }

      expect(localStorage.getItem("child_activity")).toBeNull();
      expect(getActivity()).toHaveLength(50);
    });
  });

  describe("Child AI Alerts Storage", () => {
    it("should store alerts in memory and never write to localStorage", async () => {
      await createAlert("dangerous query", {
        status: "flagged",
        is_flagged: true,
        severity: "high",
        category: "safety",
        reason: "risk detected",
      });

      expect(localStorage.getItem("child_ai_alerts")).toBeNull();
      const alerts = getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].message).toBe("dangerous query");
    });

    it("should save alerts array to memory without touching localStorage", () => {
      saveAlerts([
        {
          id: "a-1",
          message: "test alert",
          severity: "high",
          category: "test",
          reason: "test",
          timestamp: Date.now(),
          handled: false,
        },
      ]);

      expect(localStorage.getItem("child_ai_alerts")).toBeNull();
      expect(getAlerts()).toHaveLength(1);
    });
  });

  describe("Safety & Behavioral Pattern Caches", () => {
    it("should cache detectRiskyMessage results in memory, never in localStorage", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValueOnce({
        status: "safe",
        is_flagged: false,
        severity: "low",
        category: "none",
        reason: "safe message",
      });

      const res1 = await detectRiskyMessage("tell me a joke");
      expect(res1.status).toBe("safe");
      expect(localStorage.getItem("safety_cache")).toBeNull();
      expect(localStorage.getItem("ai_safety_cache")).toBeNull();

      // Second call should hit in-memory cache without API call
      const res2 = await detectRiskyMessage("tell me a joke");
      expect(res2.status).toBe("safe");
      expect(vi.mocked(post)).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem("safety_cache")).toBeNull();
      expect(localStorage.getItem("ai_safety_cache")).toBeNull();
    });

    it("should cache analyzeBehaviorPattern results in memory, never in localStorage", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValueOnce({
        pattern_detected: false,
        pattern_type: "none",
        severity: "low",
        explanation: "normal conversation",
        confidence: 90,
      });

      const messages = [
        { text: "msg 1", timestamp: 1000 },
        { text: "msg 2", timestamp: 2000 },
      ];

      const res1 = await analyzeBehaviorPattern(messages);
      expect(res1.pattern_detected).toBe(false);
      expect(localStorage.getItem("pattern_cache")).toBeNull();
      expect(localStorage.getItem("ai_pattern_cache")).toBeNull();

      // Second call with same last timestamp & length hits in-memory cache
      const res2 = await analyzeBehaviorPattern(messages);
      expect(res2.pattern_detected).toBe(false);
      expect(vi.mocked(post)).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem("pattern_cache")).toBeNull();
      expect(localStorage.getItem("ai_pattern_cache")).toBeNull();
    });
  });

  describe("Interventions Storage", () => {
    it("should save and retrieve interventions in memory only", () => {
      saveIntervention({
        id: "int-1",
        timestamp: Date.now(),
        type: "redirect",
        trigger: "distress",
        messages_before: [{ text: "sad", timestamp: 100 }],
        messages_after: [],
      });

      expect(localStorage.getItem("interventions")).toBeNull();
      const interventions = getInterventions();
      expect(interventions).toHaveLength(1);
      expect(interventions[0].id).toBe("int-1");
    });
  });

  describe("Usage Sessions Storage", () => {
    it("should record usage sessions in memory without writing to localStorage", () => {
      const now = Date.now();
      addUsageSession(now - 10000, now);

      expect(localStorage.getItem("usage_sessions")).toBeNull();
      const sessions = getTodaySessions();
      expect(sessions).toHaveLength(1);
    });
  });

  describe("Conversation History Store", () => {
    it("should manage conversation history in memory only", () => {
      addUserMessage("Child question");
      addAssistantMessage("AI response");

      expect(localStorage.getItem("conversation_history")).toBeNull();
      expect(localStorage.getItem("global_conversation_history")).toBeNull();

      const messages = getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Child question");
      expect(messages[1].content).toBe("AI response");

      clearConversation();
      expect(getMessages()).toHaveLength(0);
      expect(localStorage.getItem("conversation_history")).toBeNull();
      expect(localStorage.getItem("global_conversation_history")).toBeNull();
    });
  });

  describe("AI Intelligence Cache", () => {
    it("should cache intelligence metrics in memory and never in localStorage", async () => {
      const { post } = await import("./apiClient");
      vi.mocked(post).mockResolvedValue({
        curiosity: 80,
        mathConfidence: 75,
        attentionSpan: 70,
        evidence_messages: ["Why is the sky blue?"],
        reasoning: {
          curiosity: "Good curiosity",
          mathConfidence: "Good math",
          attentionSpan: "Good attention",
        },
      });

      const activities = [
        {
          id: "act-1",
          userText: "Why is the sky blue?",
          aiText: "Because of Rayleigh scattering!",
          category: "science",
          timestamp: Date.now(),
          status: "safe",
        },
      ];

      const metrics = await getIntelligenceMetrics(activities);
      expect(metrics).toBeDefined();
      expect(localStorage.getItem("ai_intelligence_cache")).toBeNull();
    });
  });

  describe("Report Service Data Gathering", () => {
    it("should gather app data from in-memory stores and not touch sensitive localStorage keys", () => {
      saveActivity({
        id: "act-1",
        userText: "help with math",
        aiText: "Sure!",
        category: "math",
        timestamp: Date.now(),
        status: "safe",
      });

      saveAlerts([
        {
          id: "a-1",
          message: "test alert",
          severity: "high",
          category: "test",
          reason: "test",
          timestamp: Date.now(),
          handled: false,
        },
      ]);

      const data = gatherAllAppData();
      expect(data.activities).toHaveLength(1);
      expect(data.alerts).toHaveLength(1);
      expect(data.growthHistory).toEqual([]);

      for (const key of SENSITIVE_STORAGE_KEYS) {
        expect(localStorage.getItem(key)).toBeNull();
      }
    });
  });
});
