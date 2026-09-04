/**
 * Global Conversation Store
 * Manages shared memory across all chat features (Quiz, Jokes, Stories, Input)
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// In-memory conversation store for child session privacy (never persisted to localStorage)
let inMemoryMessages: Message[] = [];
const MAX_HISTORY = 20;

export function getMessages(): Message[] {
  return [...inMemoryMessages];
}

export function addUserMessage(content: string): void {
  const updated = [...inMemoryMessages, { role: "user" as const, content }];
  inMemoryMessages = updated.slice(-MAX_HISTORY);
}

export function addAssistantMessage(content: string): void {
  const updated = [...inMemoryMessages, { role: "assistant" as const, content }];
  inMemoryMessages = updated.slice(-MAX_HISTORY);
}

export function clearConversation(): void {
  inMemoryMessages = [];
}
