import { Activity, Session } from "./types";

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes inactivity

/**
 * Group raw activity data into sessions based on time gaps.
 */
export function groupIntoSessions(activities: Activity[]): Session[] {
  if (activities.length === 0) return [];

  // Sort activities by timestamp ascending
  const sorted = [...activities].sort((a, b) => a.timestamp - b.timestamp);
  const sessions: Session[] = [];
  
  let currentSession: Session = {
    id: `session-${sorted[0].timestamp}`,
    messages: [sorted[0]],
    startTime: sorted[0].timestamp,
    endTime: sorted[0].timestamp,
    durationMinutes: 0
  };

  for (let i = 1; i < sorted.length; i++) {
    const activity = sorted[i];
    const prevActivity = sorted[i - 1];

    if (activity.timestamp - prevActivity.timestamp > SESSION_GAP_MS) {
      // New session
      currentSession.durationMinutes = Math.round((currentSession.endTime - currentSession.startTime) / 60000);
      sessions.push(currentSession);
      
      currentSession = {
        id: `session-${activity.timestamp}`,
        messages: [activity],
        startTime: activity.timestamp,
        endTime: activity.timestamp,
        durationMinutes: 0
      };
    } else {
      // Add to current session
      currentSession.messages.push(activity);
      currentSession.endTime = activity.timestamp;
    }
  }

  // Add the last session
  currentSession.durationMinutes = Math.round((currentSession.endTime - currentSession.startTime) / 60000);
  sessions.push(currentSession);

  return sessions;
}

/**
 * Extract clean, structured message history for LLM analysis.
 */
export function extractStructuredHistory(activities: Activity[]): { message: string, timestamp: number, category: string }[] {
  return activities.map(a => ({
    message: a.userText,
    timestamp: a.timestamp,
    category: a.category
  }));
}
