import { LLMIntelligenceResult, Session, Activity, IntelligenceMetrics } from "./types";

/**
 * Perform hybrid scoring (70% LLM + 30% Behavioral) with anti-gaming protections.
 */
export function calculateHybridMetrics(
  llmResult: LLMIntelligenceResult,
  sessions: Session[],
  activities: Activity[]
): IntelligenceMetrics {
  
  // If no activities, return null metrics
  if (activities.length === 0) {
    return {
      curiosity: null,
      mathConfidence: null,
      attentionSpan: null,
      reasoning: {
        curiosity: null,
        mathConfidence: null,
        attentionSpan: null
      },
      behavioralScore: null,
      hybridScore: null,
      lastUpdated: Date.now(),
      evidence_messages: []
    };
  }

  // 1. Behavioral Signal Calculation (30%)
  const behavioralScore = calculateBehavioralSignals(sessions, activities);

  // 2. Hybrid Scoring (70% LLM / 30% Behavioral)
  const llmAverage = (llmResult.curiosity !== null && llmResult.mathConfidence !== null && llmResult.attentionSpan !== null)
    ? (llmResult.curiosity + llmResult.mathConfidence + llmResult.attentionSpan) / 3
    : null;

  const hybridScore = (llmAverage !== null && behavioralScore !== null)
    ? Math.round(llmAverage * 0.7 + behavioralScore * 0.3)
    : null;

  // 3. Anti-Gaming Protections
  const protectedResult = applyAntiGamingProtections(llmResult, activities);

  return {
    ...protectedResult,
    behavioralScore,
    hybridScore,
    lastUpdated: Date.now()
  };
}

/**
 * Calculate 30% behavioral signal based on session length, session count, consistency, and drop-off rate.
 */
function calculateBehavioralSignals(sessions: Session[], activities: Activity[]): number | null {
  if (sessions.length === 0) return null;

  // Session Consistency: Days with at least one session in the last 7 days
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const last7Days = new Set(
    sessions
      .filter(s => now - s.startTime < 7 * dayMs)
      .map(s => new Date(s.startTime).toDateString())
  ).size;

  const consistencyScore = (last7Days / 7) * 100;

  // Session Quality: Average duration and interaction density
  const avgDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length;
  const durationScore = Math.min(100, (avgDuration / 15) * 100); // 15 mins target session

  const avgMessagesPerSession = activities.length / sessions.length;
  const densityScore = Math.min(100, (avgMessagesPerSession / 5) * 100); // 5 messages target session

  // Drop-off Rate: Are they coming back?
  const recentSessions = sessions.filter(s => now - s.startTime < 2 * dayMs).length;
  const dropOffPenalty = recentSessions === 0 ? 0.7 : 1.0;

  return Math.round((consistencyScore * 0.4 + durationScore * 0.3 + densityScore * 0.3) * dropOffPenalty);
}

/**
 * Apply anti-gaming protections (diminishing returns, spam detection, sudden unnatural spikes).
 */
function applyAntiGamingProtections(llmResult: LLMIntelligenceResult, activities: Activity[]): LLMIntelligenceResult {
  const result = { ...llmResult };
  if (result.curiosity === null || result.attentionSpan === null) return result;
  
  // Anti-Gaming: Repeated similar questions (diminishing returns)
  const uniqueQuestions = new Set(activities.map(a => a.userText.toLowerCase().trim())).size;
  const diversityRatio = uniqueQuestions / activities.length;
  
  if (diversityRatio < 0.4 && activities.length > 5) {
    // Diminishing returns if they keep asking the same thing
    result.curiosity = Math.round(result.curiosity * (0.6 + diversityRatio));
  }

  // Anti-Gaming: Spam detection (high frequency of short messages)
  const timeSpans = [];
  for (let i = 1; i < activities.length; i++) {
    timeSpans.push(activities[i].timestamp - activities[i-1].timestamp);
  }
  
  const highFrequencyCount = timeSpans.filter(t => t < 10000).length; // < 10 seconds apart
  if (highFrequencyCount > 5) {
    const spamPenalty = 1 - (highFrequencyCount / activities.length) * 0.5;
    result.attentionSpan = Math.round(result.attentionSpan * spamPenalty);
  }

  return result;
}
