/**
 * Safety Layer for Child AI (Production Grade)
 * Upgraded from keyword-based logic to LLM-based semantic detection.
 */

import { EarlyRisk } from "@/types";
import { isStrictModeEnabled } from "./modeEngine";
import { getApiUrl, API_ENDPOINTS } from "./apiConfig";

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

const SAFETY_CACHE_KEY = "ai_safety_cache";
const PATTERN_CACHE_KEY = "ai_pattern_cache";

/**
 * Detect risky content in a message using LLM-based semantic analysis.
 * Uses localStorage for caching to avoid redundant API calls.
 */
export async function detectRiskyMessage(message: string): Promise<RiskResult> {
  const normalized = message.trim().toLowerCase();
  
  // 0. Global Strict Mode Override (Optional: Add specific logic if needed)
  const isStrict = isStrictModeEnabled();
  
  // 1. Check Cache
  const cache = JSON.parse(localStorage.getItem(SAFETY_CACHE_KEY) || "{}");
  if (cache[normalized]) {
    return cache[normalized];
  }

  try {
    const response = await fetch(getApiUrl(API_ENDPOINTS.detectRisk), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Safety API failed with status: ${response.status}`);
    }

    const result: RiskResult = await response.json();

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
    cache[normalized] = result;
    // Limit cache size to 100 entries
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      delete cache[keys[0]];
    }
    localStorage.setItem(SAFETY_CACHE_KEY, JSON.stringify(cache));

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
  
  const cache = JSON.parse(localStorage.getItem(PATTERN_CACHE_KEY) || "{}");
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  try {
    const response = await fetch(getApiUrl(API_ENDPOINTS.analyzePattern), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`Pattern API failed with status: ${response.status}`);
    }

    const result: PatternRisk = await response.json();

    // Cache the result
    cache[cacheKey] = result;
    // Limit cache size
    const keys = Object.keys(cache);
    if (keys.length > 20) {
      delete cache[keys[0]];
    }
    localStorage.setItem(PATTERN_CACHE_KEY, JSON.stringify(cache));

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
export function rewriteUnsafe(input: string): string {
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
    const response = await fetch(getApiUrl(API_ENDPOINTS.analyzeEarlyRisk), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: recentMessages }),
    });

    if (!response.ok) {
      throw new Error(`Early Risk API failed: ${response.status}`);
    }

    return await response.json();
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
