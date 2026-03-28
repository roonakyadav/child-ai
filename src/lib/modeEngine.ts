import { AIMode, MODES, ModeConfig } from "./modes";

const CURRENT_MODE_KEY = "child_ai_current_mode";
const STRICT_MODE_KEY = "child_ai_strict_mode";

/**
 * Get the current active mode from localStorage.
 * Defaults to 'learning'.
 */
export function getCurrentMode(): AIMode {
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
 * Set the current active mode and persist to localStorage.
 */
export function setCurrentMode(mode: AIMode): void {
  localStorage.setItem(CURRENT_MODE_KEY, mode);
  // Dispatch custom event for instant UI updates if needed
  window.dispatchEvent(new CustomEvent("ai-mode-changed", { detail: mode }));
}

/**
 * Check if global Strict Mode is enabled.
 */
export function isStrictModeEnabled(): boolean {
  return localStorage.getItem(STRICT_MODE_KEY) === "true";
}

/**
 * Toggle global Strict Mode.
 */
export function setStrictMode(enabled: boolean): void {
  localStorage.setItem(STRICT_MODE_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent("strict-mode-changed", { detail: enabled }));
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
