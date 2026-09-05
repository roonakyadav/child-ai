const MAX_INJECTIONS = 20;

// In-memory injection store for child session privacy (never persisted to localStorage)
let inMemoryInjections: string[] = [];

/**
 * Injects an invisible system-level instruction for the next AI response.
 */
export function injectSystemMessage(message: string): void {
  inMemoryInjections.push(message);
  if (inMemoryInjections.length > MAX_INJECTIONS) {
    inMemoryInjections = inMemoryInjections.slice(-MAX_INJECTIONS);
  }
}

/**
 * Retrieves all pending system injections.
 */
export function getInjections(): string[] {
  return [...inMemoryInjections];
}

/**
 * Clears all pending system injections.
 */
export function clearInjections(): void {
  inMemoryInjections = [];
}
