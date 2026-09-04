
/**
 * Screen Time Management Utility
 * 
 * Handles real usage tracking, persistence of parent-defined limits,
 * and enforcement logic for the child's chat application.
 */

import { getConfig } from "./configStore";

export type ScreenTimeMode = "strict" | "balanced" | "learning";

export interface ScreenTimeSettings {
  dailyLimit: number; // in minutes
  isLocked: boolean;
  restrictionEnabled: boolean;
  mode: ScreenTimeMode;
}

export interface UsageSession {
  start: number; // timestamp
  end: number;   // timestamp
}

const SETTINGS_KEY = "screen_time_settings";

export const DEFAULT_SETTINGS: ScreenTimeSettings = getConfig().screenTime.defaultSettings as any;

/**
 * Get the current screen time settings from localStorage
 */
export function getScreenTimeSettings(): ScreenTimeSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error("[ScreenTime] Error reading settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save screen time settings to localStorage
 */
export function setScreenTimeSettings(settings: ScreenTimeSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("[ScreenTime] Error saving settings:", error);
  }
}

// In-memory usage sessions store for child session privacy (never persisted to localStorage)
let inMemorySessions: UsageSession[] = [];

/**
 * Get all recorded usage sessions for today from in-memory state
 */
export function getTodaySessions(): UsageSession[] {
  // Filter to only include sessions from today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTs = startOfToday.getTime();

  return inMemorySessions.filter(s => s.start >= todayTs);
}

/**
 * Calculate total used minutes for today
 */
export function getUsedMinutesToday(): number {
  const sessions = getTodaySessions();
  const totalMs = sessions.reduce((sum, s) => sum + (s.end - s.start), 0);
  return Math.round(totalMs / 60000);
}

/**
 * Record a new session segment in memory
 */
export function addUsageSession(start: number, end: number): void {
  // Keep only last 30 days of sessions in memory
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  inMemorySessions = inMemorySessions.filter(s => s.start > thirtyDaysAgo);
  inMemorySessions.push({ start, end });
}

/**
 * Clear in-memory usage sessions (for resets and testing)
 */
export function clearUsageSessions(): void {
  inMemorySessions = [];
}

/**
 * Global enforcement check
 * Returns true if the app should be blocked
 */
export function isAppBlocked(): { blocked: boolean; reason?: string } {
  const settings = getScreenTimeSettings();
  
  if (settings.isLocked) {
    return { blocked: true, reason: "App locked by parent" };
  }
  
  if (settings.restrictionEnabled) {
    const used = getUsedMinutesToday();
    if (used >= settings.dailyLimit) {
      return { blocked: true, reason: "Daily limit reached" };
    }
  }
  
  return { blocked: false };
}
