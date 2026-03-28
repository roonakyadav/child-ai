import { Alert } from "@/types";
import { RiskResult } from "../safety";

const ALERTS_STORAGE_KEY = "child_ai_alerts";

// In-memory cache for performance
let cachedAlerts: Alert[] | null = null;

/**
 * Fetch all alerts from localStorage, sorted by latest first.
 */
export function getAlerts(): Alert[] {
  try {
    const stored = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!stored) {
      cachedAlerts = [];
      return [];
    }
    const alerts: Alert[] = JSON.parse(stored);
    cachedAlerts = alerts.sort((a, b) => b.timestamp - a.timestamp);
    return cachedAlerts;
  } catch (error) {
    console.error("[AlertService] Error reading alerts:", error);
    return [];
  }
}

/**
 * Save alerts array to localStorage and update cache.
 */
export function saveAlerts(alerts: Alert[]): void {
  try {
    const sortedAlerts = [...alerts].sort((a, b) => b.timestamp - a.timestamp);
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(sortedAlerts));
    cachedAlerts = sortedAlerts;
  } catch (error) {
    console.error("[AlertService] Error saving alerts:", error);
  }
}

/**
 * Create a new alert if risk is high and not a duplicate.
 */
export async function createAlert(message: string, risk: RiskResult): Promise<void> {
  // Only create alert if flagged and high severity
  if (!risk.is_flagged || risk.severity !== "high") {
    return;
  }

  const alerts = getAlerts();
  const now = Date.now();

  // Prevent duplicates: Same message within 5 seconds (user requirement)
  const isDuplicate = alerts.some(
    (a) => a.message === message && Math.abs(a.timestamp - now) < 5000
  );

  if (isDuplicate) return;

  const newAlert: Alert = {
    id: `alert-${now}-${Math.random().toString(36).substr(2, 9)}`,
    message,
    severity: risk.severity,
    category: risk.category,
    reason: risk.reason,
    timestamp: now,
    handled: false,
  };

  saveAlerts([newAlert, ...alerts]);
}

/**
 * Create an early warning alert if confidence is high.
 */
export async function createEarlyWarningAlert(message: string, risk: { 
  early_risk: boolean; 
  risk_type: string; 
  severity: "low" | "medium"; 
  confidence: number; 
  explanation: string; 
}): Promise<void> {
  // Only create alert if early risk and confidence > 70
  if (!risk.early_risk || risk.confidence <= 70) {
    return;
  }

  const alerts = getAlerts();
  const now = Date.now();

  // Prevent duplicates: same risk type within 1 minute
  const isDuplicate = alerts.some(
    (a) => a.type === "early_warning" && a.category === risk.risk_type && Math.abs(a.timestamp - now) < 60000
  );

  if (isDuplicate) return;

  const newAlert: Alert = {
    id: `early-${now}-${Math.random().toString(36).substr(2, 9)}`,
    message,
    severity: risk.severity,
    category: risk.risk_type,
    reason: risk.explanation,
    timestamp: now,
    handled: false,
    type: "early_warning",
  };

  saveAlerts([newAlert, ...alerts]);
}

/**
 * Mark a specific alert as handled/reviewed.
 */
export function markAlertHandled(alertId: string): void {
  const alerts = getAlerts();
  const updated = alerts.map((a) =>
    a.id === alertId ? { ...a, handled: true } : a
  );
  saveAlerts(updated);
}

/**
 * Get the latest unhandled alert for the global banner.
 */
export function getLatestUnhandledAlert(): Alert | null {
  const alerts = getAlerts();
  // Return the first alert where handled === false (it's already sorted latest-first)
  return alerts.find((a) => !a.handled) || null;
}
