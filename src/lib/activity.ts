/**
 * Child Activity Storage
 * Tracks real chat interactions for dashboard display
 */

import { RiskResult } from "./safety";
import { getConfig } from "./configStore";

export interface Activity {
  userText: string;
  aiText: string;
  category: string;
  status: "safe" | "filtered" | "guided";
  timestamp: number;
  risk?: RiskResult; // Added for semantic risk analysis
  sentimentScore?: number; // AI-driven sentiment score (0-100)
}

/**
 * Get activity category based on message content
 * @param text - The user's message text
 * @returns Category name
 */
export function getCategory(text: string): string {
  const lower = text.toLowerCase();
  const config = getConfig();

  // Find the first matching category from dynamic config
  for (const category of config.categories) {
    // Skip general as it's the fallback
    if (category.id === "general") continue;

    const matchesKeywords = category.keywords.some(k => lower.includes(k));
    const matchesRegex = category.regex && new RegExp(category.regex).test(lower);

    if (matchesKeywords || matchesRegex) {
      return category.label;
    }
  }

  return "General";
}

/**
 * Format timestamp to readable time string
 * @param ts - Unix timestamp
 * @returns Formatted time string
 */
export function formatTime(ts: number): string {
  const diff = Date.now() - ts;

  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + " min ago";

  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " hours ago";

  return "Yesterday";
}

export interface ChildStats {
  level: number;
  xp: number;
  nextLevelXp: number;
  badges: string[];
  streak: number;
}

/**
 * Get current child stats (Level, XP, etc.)
 */
export function getChildStats(): ChildStats {
  const activities = getActivity();
  const config = getConfig();
  const xpConfig = config.gamification.xpMultipliers;

  const baseXP = activities.length * xpConfig.base;
  const quizXP = activities.filter(a => a.status === "safe" && a.category !== "General").length * xpConfig.quiz;
  const safetyBonus = activities.filter(a => a.status === "safe").length * xpConfig.safety;
  
  const totalXP = baseXP + quizXP + safetyBonus;
  const level = Math.floor(Math.sqrt(totalXP / 50)) + 1;
  const currentLevelXP = Math.pow(level - 1, 2) * 50;
  const nextLevelXP = Math.pow(level, 2) * 50;
  
  // Dynamic badge evaluation
  const badges = config.gamification.badges
    .filter(badge => {
      if (badge.condition === "total_activities") {
        return activities.length > badge.threshold;
      }
      if (badge.condition.startsWith("category_")) {
        const categoryLabel = badge.condition.replace("category_", "").toLowerCase();
        return activities.filter(a => a.category.toLowerCase() === categoryLabel).length > badge.threshold;
      }
      return false;
    })
    .map(b => b.label);

  // Real Streak Calculation
  const getStreak = () => {
    if (activities.length === 0) return 0;
    
    const dates = activities
      .map(a => new Date(a.timestamp).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i); // Unique dates
    
    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    // Check if they were active today or yesterday to continue streak
    if (dates[0] !== today && dates[0] !== yesterday) return 0;
    
    for (let i = 0; i < dates.length - 1; i++) {
      const d1 = new Date(dates[i]);
      const d2 = new Date(dates[i+1]);
      const diff = (d1.getTime() - d2.getTime()) / 86400000;
      
      if (Math.round(diff) === 1) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak + 1; // Add 1 for the first day
  };
  
  return {
    level,
    xp: totalXP - currentLevelXP,
    nextLevelXp: nextLevelXP - currentLevelXP,
    badges,
    streak: getStreak(),
  };
}

/**
 * Save a new activity to localStorage
 * @param activity - The activity object to save
 */
export function saveActivity(activity: Activity): void {
  try {
    const existing = JSON.parse(localStorage.getItem("child_activity") || "[]");
    
    // Add new activity at the beginning (newest first)
    existing.unshift(activity);
    
    // Limit to last 50 activities for better data-driven insights
    const trimmed = existing.slice(0, 50);
    
    localStorage.setItem("child_activity", JSON.stringify(trimmed));
  } catch (error) {
    console.error("[Activity] Error saving activity:", error);
  }
}

import { getTodaySessions, getUsedMinutesToday } from "./screen-time";

export interface ActivitySummary {
  totalQuestions: number;
  topTopics: { name: string; count: number }[];
  avgMessageLength: number;
  flaggedCount: number;
  totalUsageMinutes: number;
  sessionCount: number;
  recentQuestions: string[];
  lastActive: string;
}

/**
 * Get all activities from localStorage
 * @returns Array of activities
 */
export function getActivity(): Activity[] {
  try {
    return JSON.parse(localStorage.getItem("child_activity") || "[]");
  } catch (error) {
    console.error("[Activity] Error reading activity:", error);
    return [];
  }
}

/**
 * Get a summarized view of the child's activity for AI analysis
 */
export function getActivitySummary(): ActivitySummary {
  const activities = getActivity();
  const sessions = getTodaySessions();
  
  // Ensure default values if data is missing
  const totalQuestions = activities.length || 0;
  const flaggedCount = activities.filter(a => a.status === "filtered").length || 0;
  
  const topicCounts: Record<string, number> = {};
  let totalLength = 0;
  const recentQuestions: string[] = [];
  const lastActive = activities.length > 0 ? formatTime(activities[0].timestamp) : "No activity yet";

  activities.forEach((a, i) => {
    if (a && a.category) topicCounts[a.category] = (topicCounts[a.category] || 0) + 1;
    if (a && a.userText) {
      totalLength += a.userText.length;
      if (recentQuestions.length < 5) recentQuestions.push(a.userText);
    }
  });

  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const avgMessageLength = totalQuestions > 0 ? Math.round(totalLength / totalQuestions) : 0;

  return {
    totalQuestions,
    topTopics: topTopics.length > 0 ? topTopics : [{ name: "General", count: 0 }],
    avgMessageLength,
    flaggedCount,
    totalUsageMinutes: getUsedMinutesToday() || 0,
    sessionCount: sessions.length || 0,
    recentQuestions: recentQuestions.length > 0 ? recentQuestions : ["No questions yet"],
    lastActive
  };
}

/**
 * Data Aggregation Utilities for Dashboard
 */

export function getTotalQuestions(): number {
  return getActivity().length;
}

export function getFlaggedCount(): number {
  return getActivity().filter(a => a.status === "filtered").length;
}

export function getTopInterest(): string {
  const activities = getActivity();
  if (activities.length === 0) return "N/A";

  const counts: Record<string, number> = {};
  activities.forEach(a => {
    counts[a.category] = (counts[a.category] || 0) + 1;
  });

  return Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

export function getWeeklyChange(): string {
  const activities = getActivity();
  if (activities.length === 0) return "N/A";

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  
  const lastWeek = activities.filter(a => now - a.timestamp < sevenDaysMs).length;
  const prevWeek = activities.filter(a => {
    const age = now - a.timestamp;
    return age >= sevenDaysMs && age < sevenDaysMs * 2;
  }).length;

  if (prevWeek === 0) return lastWeek > 0 ? "+100%" : "0%";
  const change = Math.round(((lastWeek - prevWeek) / prevWeek) * 100);
  return change >= 0 ? `+${change}%` : `${change}%`;
}

/**
 * Get sentiment trend for the last 7 days
 * Upgraded to use AI-driven sentiment scores.
 */
export function getSentimentTrend() {
  const activities = getActivity();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  
  const trend = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(now.getDate() - (6 - i));
    const dayName = days[d.getDay()];
    
    // Filter activities for this day (Today, Yesterday, etc.)
    const dayActivities = activities.filter(a => {
      const activityDate = new Date(a.timestamp);
      // Reset hours to compare dates only
      const comparisonDate = new Date(d);
      comparisonDate.setHours(0, 0, 0, 0);
      const activityComparisonDate = new Date(activityDate);
      activityComparisonDate.setHours(0, 0, 0, 0);
      
      return activityComparisonDate.getTime() === comparisonDate.getTime();
    });
    
    // AI-Driven Sentiment Calculation
    let score = 0;
    if (dayActivities.length > 0) {
      // Average the AI sentiment scores
      const totalSentiment = dayActivities.reduce((acc, a) => {
        // Use AI score if exists, fallback to safety ratio logic
        if (a.sentimentScore !== undefined) return acc + a.sentimentScore;
        return acc + (a.status === "safe" ? 100 : 20);
      }, 0);
      score = Math.round(totalSentiment / dayActivities.length);
    } else {
      score = 0; // Truly empty if no activity
    }
    
    return { day: dayName, score };
  });
  
  return trend;
}
