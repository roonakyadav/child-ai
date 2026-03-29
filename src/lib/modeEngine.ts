import { AIMode, MODES, ModeConfig } from "./modes";

const CURRENT_MODE_KEY = "child_ai_current_mode";
const STRICT_MODE_KEY = "child_ai_strict_mode";
const MODE_EXPIRATION_KEY = "child_ai_mode_expiration";
const STRICT_MODE_EXPIRATION_KEY = "child_ai_strict_mode_expiration";

const MODE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get the current active mode from localStorage.
 * Automatically reverts to 'learning' if expired.
 */
export function getCurrentMode(): AIMode {
  const expiration = localStorage.getItem(MODE_EXPIRATION_KEY);
  const now = Date.now();

  if (expiration && now > parseInt(expiration)) {
    // Mode has expired, revert to default
    localStorage.removeItem(MODE_EXPIRATION_KEY);
    localStorage.setItem(CURRENT_MODE_KEY, "learning");
    return "learning";
  }

  const mode = localStorage.getItem(CURRENT_MODE_KEY) as AIMode;
  return mode || "learning";
}

/**
 * Get the full configuration for the current active mode.
 */
export function getCurrentModeConfig(): ModeConfig {
  const mode = getCurrentMode();
  return MODES[mode];
}

/**
 * Set the current active mode and persist to localStorage with a 30-min expiration.
 */
export function setCurrentMode(mode: AIMode): void {
  const expiration = Date.now() + MODE_DURATION_MS;
  
  localStorage.setItem(CURRENT_MODE_KEY, mode);
  localStorage.setItem(MODE_EXPIRATION_KEY, expiration.toString());
  
  // Dispatch custom event for instant UI updates
  window.dispatchEvent(new CustomEvent("ai-mode-changed", { detail: { mode, expiration } }));
}

/**
 * Get remaining time for the current mode in milliseconds.
 */
export function getModeRemainingTime(): number {
  const expiration = localStorage.getItem(MODE_EXPIRATION_KEY);
  if (!expiration) return 0;
  
  const remaining = parseInt(expiration) - Date.now();
  return Math.max(0, remaining);
}

/**
 * Check if global Strict Mode is enabled.
 * Reverts to false if expired.
 */
export function isStrictModeEnabled(): boolean {
  const expiration = localStorage.getItem(STRICT_MODE_EXPIRATION_KEY);
  const now = Date.now();

  if (expiration && now > parseInt(expiration)) {
    localStorage.removeItem(STRICT_MODE_EXPIRATION_KEY);
    localStorage.setItem(STRICT_MODE_KEY, "false");
    return false;
  }

  return localStorage.getItem(STRICT_MODE_KEY) === "true";
}

/**
 * Toggle global Strict Mode with 30-min expiration.
 */
export function setStrictMode(enabled: boolean): void {
  localStorage.setItem(STRICT_MODE_KEY, String(enabled));
  
  if (enabled) {
    const expiration = Date.now() + MODE_DURATION_MS;
    localStorage.setItem(STRICT_MODE_EXPIRATION_KEY, expiration.toString());
  } else {
    localStorage.removeItem(STRICT_MODE_EXPIRATION_KEY);
  }
  
  window.dispatchEvent(new CustomEvent("strict-mode-changed", { detail: enabled }));
}

/**
 * Get remaining time for Strict Mode in milliseconds.
 */
export function getStrictModeRemainingTime(): number {
  const expiration = localStorage.getItem(STRICT_MODE_EXPIRATION_KEY);
  if (!expiration) return 0;
  
  const remaining = parseInt(expiration) - Date.now();
  return Math.max(0, remaining);
}

/**
 * Get the dynamic system instructions based on current mode and strict mode.
 */
export function getSystemInstructions(): string {
  const config = getCurrentModeConfig();
  const strict = isStrictModeEnabled();

  let instructions = config.system_instructions;

  if (strict) {
    instructions += "\n\n[GLOBAL OVERRIDE: STRICT MODE ACTIVE]";
    instructions += "\n- Aggressively block any potentially unsafe or sensitive topics.";
    instructions += "\n- If a user asks something risky, refuse firmly and redirect to a safe, educational topic.";
    instructions += "\n- Maintain a formal, protective tone. No playful distractions or jokes.";
    instructions += "\n- Prioritize safety over all other mode instructions.";
  }

  return instructions;
}
