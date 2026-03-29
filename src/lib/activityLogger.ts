import { saveActivity, Activity, getCategory } from "./activity";
import { RiskResult } from "./safety";

interface LogParams {
  userMessage: string;
  aiResponse: string;
  status?: "safe" | "filtered" | "guided";
  risk?: RiskResult;
  sentimentScore?: number;
}

/**
 * Unified Activity Logger
 * Logs every interaction to the persistent activity feed
 */
export function logInteraction({ 
  userMessage, 
  aiResponse, 
  status = "safe", 
  risk, 
  sentimentScore 
}: LogParams): void {
  const category = getCategory(userMessage);
  
  const activity: Activity = {
    userText: userMessage,
    aiText: aiResponse,
    category,
    status,
    timestamp: Date.now(),
    risk,
    sentimentScore
  };

  saveActivity(activity);
  console.log(`[ActivityLogger] Logged ${category} interaction`);
}
