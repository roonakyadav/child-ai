/**
 * Safety Layer for Child AI (Production Grade)
 * Upgraded from keyword-based logic to LLM-based semantic detection.
 */

import { EarlyRisk } from "@/types";
import { isStrictModeEnabled } from "./modeEngine";
import { API_ENDPOINTS } from "./apiConfig";
import { post } from "./apiClient";

export interface RiskResult {
  status: "safe" | "flagged" | "unknown";
  is_flagged: boolean;
  severity: "low" | "medium" | "high" | "unknown";
  category: "violence" | "self-harm" | "emotional" | "safe" | "unknown";
  reason: string;
}

export interface PatternRisk {
  pattern_detected: boolean;
  pattern_type: "escalation" | "emotional_distress" | "aggression" | "none" | "unknown";
  severity: "low" | "medium" | "high" | "unknown";
  explanation: string;
  confidence: number;
}

// In-memory safety and pattern caches for child session privacy (never persisted to localStorage)
const safetyCache: Record<string, RiskResult> = {};
const patternCache: Record<string, PatternRisk> = {};

/**
 * Clear in-memory safety caches (for resets and testing)
 */
export function clearSafetyCaches(): void {
  for (const key of Object.keys(safetyCache)) {
    delete safetyCache[key];
  }
  for (const key of Object.keys(patternCache)) {
    delete patternCache[key];
  }
}

/**
 * Detect risky content in a message using LLM-based semantic analysis.
 * Uses an in-memory cache to avoid redundant API calls.
 */
export async function detectRiskyMessage(message: string): Promise<RiskResult> {
  const normalized = message.trim().toLowerCase();
  
  // 0. Global Strict Mode Override (Optional: Add specific logic if needed)
  const isStrict = isStrictModeEnabled();
  
  // 1. Check Cache
  if (safetyCache[normalized]) {
    return safetyCache[normalized];
  }

  try {
    const result: RiskResult = await post<RiskResult>(API_ENDPOINTS.detectRisk, { message });

    // Ensure status field is present (for backward compatibility with old backend responses)
    if (!result.status) {
      result.status = result.is_flagged ? "flagged" : "safe";
    }

    // If Strict Mode is enabled, we lower the threshold for flagging
    if (isStrict && result.severity === "low") {
      result.is_flagged = true;
      result.status = "flagged";
      result.reason = `[Strict Mode Override] ${result.reason}`;
    }

    // 2. Store in Cache
    safetyCache[normalized] = result;
    // Limit cache size to 100 entries
    const keys = Object.keys(safetyCache);
    if (keys.length > 100) {
      delete safetyCache[keys[0]];
    }

    return result;
  } catch (error) {
    console.error("[Safety] Error during risk detection:", error);
    // Fail-closed: return UNKNOWN when analysis is unavailable
    return {
      status: "unknown",
      is_flagged: false,
      severity: "unknown",
      category: "unknown",
      reason: "Analysis unavailable - safety status could not be determined"
    };
  }
}

/**
 * Analyze a sequence of messages for behavioral patterns like escalation or buildup.
 */
export async function analyzeBehaviorPattern(messages: { text: string; timestamp: number; risk?: RiskResult }[]): Promise<PatternRisk> {
  if (messages.length < 2) {
    return {
      pattern_detected: false,
      pattern_type: "none",
      severity: "low",
      explanation: "Not enough data for pattern analysis.",
      confidence: 0
    };
  }

  // Create a cache key based on the last message timestamp and count
  const lastMsg = messages[messages.length - 1];
  const cacheKey = `pattern-${messages.length}-${lastMsg.timestamp}`;
  
  if (patternCache[cacheKey]) {
    return patternCache[cacheKey];
  }

  try {
    const result: PatternRisk = await post<PatternRisk>(API_ENDPOINTS.analyzePattern, { messages });

    // Cache the result
    patternCache[cacheKey] = result;
    // Limit cache size
    const keys = Object.keys(patternCache);
    if (keys.length > 20) {
      delete patternCache[keys[0]];
    }

    return result;
  } catch (error) {
    console.error("[Safety] Error during pattern analysis:", error);
    // Fail-closed: return UNKNOWN when analysis is unavailable
    return {
      pattern_detected: false,
      pattern_type: "unknown",
      severity: "unknown",
      explanation: "Pattern analysis unavailable - pattern could not be determined",
      confidence: 0
    };
  }
}
/**
 * Safe fallback message for flagged content
 */
export function rewriteUnsafe(_input: string): string {
  return "That topic isn't something I can help with, but we can still explore something fun and safe together! 😊 How about learning how the human body grows, or how games are made?";
}

/**
 * Predictive Risk Engine: Analyzes recent messages for early warning signs.
 */
export async function analyzeEarlyRisk(messages: { text: string; timestamp: number }[]): Promise<EarlyRisk> {
  if (messages.length < 3) {
    return {
      early_risk: false,
      risk_type: "none",
      severity: "low",
      confidence: 0,
      explanation: "Not enough messages for predictive analysis."
    };
  }

  // Use last 5-10 messages ONLY as per requirement
  const recentMessages = messages.slice(-10);

  try {
    const result: EarlyRisk = await post<EarlyRisk>(API_ENDPOINTS.analyzeEarlyRisk, { messages: recentMessages });
    return result;
  } catch (error) {
    console.error("[Safety] Error during early risk analysis:", error);
    // Fail-closed: return UNKNOWN when analysis is unavailable
    return {
      early_risk: false,
      risk_type: "unknown",
      severity: "unknown",
      confidence: 0,
      explanation: "Predictive analysis unavailable - risk could not be determined"
    };
  }
}
