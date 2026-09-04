import { InterventionMode } from "@/types";

// In-memory intervention mode store for child session privacy (never persisted to localStorage)
let inMemoryMode: InterventionMode = "normal";
let inMemoryMetadata: ModeMetadata | null = null;

interface ModeMetadata {
  messageCount: number;
  startTime: number;
}

export function getMode(): InterventionMode {
  return inMemoryMode || "normal";
}

export function setMode(mode: InterventionMode): void {
  inMemoryMode = mode;
  
  // Reset metadata when mode is set (except for normal)
  if (mode !== "normal") {
    inMemoryMetadata = {
      messageCount: 0,
      startTime: Date.now(),
    };
  } else {
    inMemoryMetadata = null;
  }
}

export function resetMode(): void {
  inMemoryMode = "normal";
  inMemoryMetadata = null;
}

/**
 * Tracks usage and auto-resets mode if limits are reached.
 * Limits: 10 messages OR 30 minutes.
 */
export function trackAndAutoReset(): void {
  const mode = getMode();
  if (mode === "normal" || !inMemoryMetadata) return;

  inMemoryMetadata.messageCount += 1;

  const THIRTY_MINUTES = 30 * 60 * 1000;
  const MESSAGE_LIMIT = 10;

  const isTimeUp = Date.now() - inMemoryMetadata.startTime > THIRTY_MINUTES;
  const isMessageLimitReached = inMemoryMetadata.messageCount >= MESSAGE_LIMIT;

  if (isTimeUp || isMessageLimitReached) {
    resetMode();
  }
}

/**
 * Get remaining time for current intervention mode in milliseconds.
 */
export function getInterventionRemainingTime(): number {
  const mode = getMode();
  if (mode === "normal" || !inMemoryMetadata) return 0;

  const THIRTY_MINUTES = 30 * 60 * 1000;
  const remaining = (inMemoryMetadata.startTime + THIRTY_MINUTES) - Date.now();
  return Math.max(0, remaining);
}
