import { groupIntoSessions, extractStructuredHistory } from "./aggregator";
import { analyzeChildBehavior, getDecisionInsights } from "./analyzer";
import { calculateHybridMetrics } from "./scorer";
import { Activity, IntelligenceMetrics, CachedIntelligence } from "./types";

// In-memory cache for intelligence analysis (never persisted to localStorage)
let inMemoryIntelligenceCache: CachedIntelligence | null = null;
const ANALYSIS_DEBOUNCE_MS = 10 * 1000; // 10 seconds debounce

/**
 * Coordination of the production-grade intelligence engine.
 * - Cache LLM results in memory
 * - Only re-run analysis when new messages are added
 * - Debounce analysis calls
 * - Perform hybrid scoring and anti-gaming logic
 */
export async function getIntelligenceMetrics(activities: Activity[]): Promise<IntelligenceMetrics> {
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

  // 1. Check cache for valid analysis
  const cachedObj = inMemoryIntelligenceCache;
  let history: { score: number; timestamp: number }[] = [];
  
  if (cachedObj) {
    history = cachedObj.history || [];
    
    // Only use cache if activity count hasn't changed OR if it's within the debounce window
    if (cachedObj.activityCount === activities.length || (Date.now() - cachedObj.timestamp < ANALYSIS_DEBOUNCE_MS)) {
      return cachedObj.data;
    }
  }

  // 2. Data Extraction & Aggregation
  const sessions = groupIntoSessions(activities);
  const structuredHistory = extractStructuredHistory(activities);

  // 3. LLM-Based Semantic Analysis
  const llmResult = await analyzeChildBehavior(structuredHistory);

  // 4. Hybrid Scoring & Anti-Gaming Logic
  const metrics = calculateHybridMetrics(llmResult, sessions, activities);

  // 5. Decision Engine Analysis
  const decisionData = await getDecisionInsights(metrics, history);
  metrics.decisionEngine = decisionData;
  
  // Get previous score for comparison
  if (history.length > 0) {
    metrics.previousScore = history[history.length - 1].score;
  }

  // 6. Update history and cache the results
  const updatedHistory = [...history, { score: metrics.hybridScore, timestamp: Date.now() }].slice(-10); // Keep last 10 snapshots
  
  const cacheData: CachedIntelligence = {
    data: metrics,
    activityCount: activities.length,
    timestamp: Date.now(),
    history: updatedHistory
  };
  inMemoryIntelligenceCache = cacheData;

  return metrics;
}

/**
 * Get current in-memory cached intelligence (e.g. for reports or testing)
 */
export function getCachedIntelligence(): CachedIntelligence | null {
  return inMemoryIntelligenceCache;
}

/**
 * Clear in-memory intelligence cache (for resets and testing)
 */
export function clearIntelligenceCache(): void {
  inMemoryIntelligenceCache = null;
}
