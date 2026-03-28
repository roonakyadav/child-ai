import { Alert } from "@/types";

export interface Activity {
  userText: string;
  aiText: string;
  category: string;
  status: "safe" | "filtered" | "guided";
  timestamp: number;
}

export interface Session {
  id: string;
  messages: Activity[];
  startTime: number;
  endTime: number;
  durationMinutes: number;
}

export interface LLMIntelligenceResult {
  curiosity: number | null;
  mathConfidence: number | null;
  attentionSpan: number | null;
  reasoning: {
    curiosity: string | null;
    mathConfidence: string | null;
    attentionSpan: string | null;
  };
  evidence_messages?: string[]; // 2-3 real messages that justify these metrics
}

export interface DecisionEngineData {
  topInsight: string | null;
  focusArea: {
    metric: string;
    value: number;
  } | null;
  trend: "improving" | "declining" | "stable" | null;
  keyChanges: string[];
  actionPlan: string | null;
  confidence: number;
}

export interface IntelligenceMetrics extends LLMIntelligenceResult {
  behavioralScore: number | null;
  hybridScore: number | null;
  lastUpdated: number;
  previousScore?: number; // Score from the previous session for comparison
  decisionEngine?: DecisionEngineData;
}

export interface CachedIntelligence {
  data: IntelligenceMetrics;
  activityCount: number;
  timestamp: number;
  history: { score: number; timestamp: number }[]; // For trend calculation
}
