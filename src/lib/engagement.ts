import { Activity, Session } from "./intelligence/types";
import { groupIntoSessions } from "./intelligence/aggregator";

export interface EngagementIntelligence {
  status: "High Engagement" | "Moderate Engagement" | "Developing Engagement";
  statusReason: string;
  problems: string[];
  trendExplanation: string;
  behaviorPattern: string;
  actionRecommendation: string;
  activityLevel: "High" | "Medium" | "Low";
  consistencyLevel: "High" | "Medium" | "Low";
}

/**
 * Calculate deep engagement intelligence based on activity and session data.
 */
export async function getEngagementIntelligence(activities: Activity[]): Promise<EngagementIntelligence> {
  const sessions = groupIntoSessions(activities);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // 1. Calculate Core Metrics
  const last7DaysSessions = sessions.filter(s => now - s.startTime < 7 * dayMs);
  const activeDays = new Set(last7DaysSessions.map(s => new Date(s.startTime).toDateString())).size;
  const avgSessionLength = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length 
    : 0;

  // 2. Detect Problems
  const problems: string[] = [];
  if (activeDays < 3) problems.push(`${activeDays} active day${activeDays !== 1 ? 's' : ''} this week (Target: 4+)`);
  if (avgSessionLength < 5) problems.push(`Average session length is too low (${Math.round(avgSessionLength)} min)`);
  if (sessions.length > 0 && (now - sessions[0].endTime > 2 * dayMs)) problems.push("Inactive for more than 48 hours");

  // 3. Determine Status
  let status: EngagementIntelligence["status"] = "Moderate Engagement";
  if (activeDays >= 5 && avgSessionLength >= 10) status = "High Engagement";
  else if (activeDays < 3 || avgSessionLength < 4) status = "Developing Engagement";

  // 4. Call LLM for Deep Intelligence
  try {
    const response = await fetch("http://localhost:3001/api/analyze-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usageData: {
          activeDays,
          totalSessions: sessions.length,
          avgSessionLength,
          totalActivities: activities.length
        },
        sessionSummary: sessions.slice(0, 5).map(s => ({
          duration: s.durationMinutes,
          messageCount: s.messages.length,
          timestamp: s.startTime
        }))
      }),
    });

    if (!response.ok) throw new Error("Engagement API failed");
    const aiData = await response.json();

    return {
      status,
      problems: problems.length > 0 ? problems : ["No critical engagement problems detected."],
      statusReason: aiData.statusReason,
      trendExplanation: aiData.trendExplanation,
      behaviorPattern: aiData.behaviorPattern,
      actionRecommendation: aiData.actionRecommendation,
      activityLevel: aiData.activityLevel || (activities.length > 10 ? "High" : activities.length > 5 ? "Medium" : "Low"),
      consistencyLevel: aiData.consistencyLevel || (activeDays >= 4 ? "High" : activeDays >= 2 ? "Medium" : "Low")
    };
  } catch (error) {
    console.error("[Engagement Intelligence] Error:", error);
    return {
      status,
      problems: problems.length > 0 ? problems : ["Consistent engagement patterns."],
      statusReason: status === "Developing Engagement" ? "Usage is starting to build with initial sessions." : "Usage patterns are stable.",
      trendExplanation: "Usage has been fluctuating over the last few days.",
      behaviorPattern: "Initial interaction sessions.",
      actionRecommendation: "Encourage a consistent 5-minute daily check-in to build a learning habit.",
      activityLevel: activities.length > 10 ? "High" : activities.length > 5 ? "Medium" : "Low",
      consistencyLevel: activeDays >= 4 ? "High" : activeDays >= 2 ? "Medium" : "Low"
    };
  }
}
