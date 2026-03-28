/**
 * Child Intelligence Engine (Production Grade)
 * Redesigned to use LLM-based semantic analysis instead of keyword counting.
 */

import { Activity } from "./activity";
import { getIntelligenceMetrics } from "./intelligence/index";
import { IntelligenceMetrics } from "./intelligence/types";
import { Alert } from "@/types";

export type { IntelligenceMetrics, Alert };

/**
 * Get the latest intelligence metrics using the production-grade engine.
 * This is an async function because it may involve LLM analysis.
 */
export async function getLatestIntelligence(): Promise<IntelligenceMetrics> {
  const activities = JSON.parse(localStorage.getItem("child_activity") || "[]") as Activity[];
  return getIntelligenceMetrics(activities);
}

/**
 * DEPRECATED: Old synchronous calculation. 
 * Use getLatestIntelligence() instead.
 */
export function calculateIntelligenceMetrics(): any {
  console.warn("calculateIntelligenceMetrics is deprecated. Use async getLatestIntelligence().");
  
  // Return a safe placeholder that will be updated once the async call completes in the UI
  return {
    curiosity: 50,
    mathConfidence: 50,
    attention: 50,
    creativity: 50,
    insights: ["Updating metrics..."]
  };
}

/**
 * Placeholder for message analysis - now handled by the intelligence engine coordination.
 */
export function analyzeMessages(messages: any[]): void {
  // Logic moved to the core intelligence engine which is triggered on demand
  // to save API costs and improve consistency.
}

/**
 * Save metrics - now handled by the engine's internal caching.
 */
export function saveIntelligenceMetrics(data: any): void {
  // No-op - metrics are calculated and cached by the engine
}
