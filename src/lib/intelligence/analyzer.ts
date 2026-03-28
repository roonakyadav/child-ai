import { LLMIntelligenceResult } from "./types";

const ANALYZE_API_URL = "http://localhost:3001/api/analyze-intelligence";

/**
 * Perform LLM-based semantic analysis of child behavior using reasoning.
 */
export async function analyzeChildBehavior(messages: { message: string, timestamp: number, category: string }[]): Promise<LLMIntelligenceResult> {
  if (messages.length === 0) {
    return {
      curiosity: null,
      mathConfidence: null,
      attentionSpan: null,
      reasoning: {
        curiosity: null,
        mathConfidence: null,
        attentionSpan: null
      },
      evidence_messages: []
    };
  }

  try {
    const response = await fetch(ANALYZE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`Analysis API failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract 2-3 real evidence messages if not provided by backend
    // (Ideally backend should provide them, let's assume it does now or we pick them)
    if (!data.evidence_messages) {
      data.evidence_messages = messages.slice(-3).map(m => m.message);
    }

    return data as LLMIntelligenceResult;
  } catch (error) {
    console.error("[Intelligence Analyzer] Error during LLM analysis:", error);
    // Safe return on failure - no data
    return {
      curiosity: null,
      mathConfidence: null,
      attentionSpan: null,
      reasoning: {
        curiosity: "Temporary analysis failure",
        mathConfidence: "Temporary analysis failure",
        attentionSpan: "Temporary analysis failure"
      },
      evidence_messages: []
    };
  }
}

/**
 * Call the Decision Engine to generate prioritized insights and action plans.
 */
export async function getDecisionInsights(metrics: any, history: any[]): Promise<any> {
  // If no hybrid score, we have no real data to base decisions on
  if (!metrics.hybridScore) {
    return {
      topInsight: null,
      trend: null,
      keyChanges: [],
      actionPlan: null,
      focusArea: null,
      confidence: 0
    };
  }

  try {
    const response = await fetch("http://localhost:3001/api/decision-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics, history }),
    });

    if (!response.ok) throw new Error("Decision engine failed");
    return await response.json();
  } catch (error) {
    console.error("[Decision Engine] Error:", error);
    return {
      topInsight: null,
      trend: null,
      keyChanges: [],
      actionPlan: null,
      focusArea: null,
      confidence: 0
    };
  }
}
