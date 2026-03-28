const INJECTION_STORAGE_KEY = "ai_system_injections";

/**
 * Injects an invisible system-level instruction for the next AI response.
 */
export function injectSystemMessage(message: string): void {
  const currentInjections = getInjections();
  localStorage.setItem(INJECTION_STORAGE_KEY, JSON.stringify([...currentInjections, message]));
}

/**
 * Retrieves all pending system injections.
 */
export function getInjections(): string[] {
  try {
    const stored = localStorage.getItem(INJECTION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("[InjectionService] Error reading injections:", error);
    return [];
  }
}

/**
 * Clears all pending system injections.
 */
export function clearInjections(): void {
  localStorage.removeItem(INJECTION_STORAGE_KEY);
}
