import { InterventionMode } from "@/types";

const MODE_STORAGE_KEY = "ai_mode";
const MODE_METADATA_KEY = "ai_mode_metadata";

interface ModeMetadata {
  messageCount: number;
  startTime: number;
}

export function getMode(): InterventionMode {
  const mode = localStorage.getItem(MODE_STORAGE_KEY) as InterventionMode;
  return mode || "normal";
}

export function setMode(mode: InterventionMode): void {
  localStorage.setItem(MODE_STORAGE_KEY, mode);
  
  // Reset metadata when mode is set (except for normal)
  if (mode !== "normal") {
    const metadata: ModeMetadata = {
      messageCount: 0,
      startTime: Date.now(),
    };
    localStorage.setItem(MODE_METADATA_KEY, JSON.stringify(metadata));
  } else {
    localStorage.removeItem(MODE_METADATA_KEY);
  }
}

export function resetMode(): void {
  localStorage.setItem(MODE_STORAGE_KEY, "normal");
  localStorage.removeItem(MODE_METADATA_KEY);
}

/**
 * Tracks usage and auto-resets mode if limits are reached.
 * Limits: 5 messages OR 10 minutes.
 */
export function trackAndAutoReset(): void {
  const mode = getMode();
  if (mode === "normal") return;

  const storedMetadata = localStorage.getItem(MODE_METADATA_KEY);
  if (!storedMetadata) return;

  const metadata: ModeMetadata = JSON.parse(storedMetadata);
  metadata.messageCount += 1;

  const TEN_MINUTES = 10 * 60 * 1000;
  const MESSAGE_LIMIT = 5;

  const isTimeUp = Date.now() - metadata.startTime > TEN_MINUTES;
  const isMessageLimitReached = metadata.messageCount >= MESSAGE_LIMIT;

  if (isTimeUp || isMessageLimitReached) {
    resetMode();
  } else {
    localStorage.setItem(MODE_METADATA_KEY, JSON.stringify(metadata));
  }
}
