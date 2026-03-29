/**
 * Global Conversation Store
 * Manages shared memory across all chat features (Quiz, Jokes, Stories, Input)
 */

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const STORAGE_KEY = "global_conversation_history";
const MAX_HISTORY = 20;

export function getMessages(): Message[] {
  try {
    const history = localStorage.getItem(STORAGE_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error("[ConvStore] Error reading history:", error);
    return [];
  }
}

export function addUserMessage(content: string): void {
  const messages = getMessages();
  const updated = [...messages, { role: "user" as const, content }];
  saveMessages(updated.slice(-MAX_HISTORY));
}

export function addAssistantMessage(content: string): void {
  const messages = getMessages();
  const updated = [...messages, { role: "assistant" as const, content }];
  saveMessages(updated.slice(-MAX_HISTORY));
}

export function clearConversation(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function saveMessages(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error("[ConvStore] Error saving history:", error);
  }
}
