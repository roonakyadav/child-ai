/**
 * Intent Store
 * Manages the current conversation intent and recent topics to prevent repetition.
 */

export type Intent = "quiz" | "game" | "story" | "learning" | "general" | "fun";

export interface QuizState {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string;
}

interface IntentState {
  currentIntent: Intent;
  lastUpdated: number;
  recentTopics: string[];
  activeQuiz?: QuizState | null;
}

// In-memory intent store for child session privacy (never persisted to localStorage)
const TOPIC_LIMIT = 10;
const INTENT_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const DEFAULT_STATE: IntentState = {
  currentIntent: "general",
  lastUpdated: Date.now(),
  recentTopics: [],
  activeQuiz: null,
};

let inMemoryIntentState: IntentState = { ...DEFAULT_STATE };

export function getIntentState(): IntentState {
  // Auto-reset intent if it's too old
  if (Date.now() - inMemoryIntentState.lastUpdated > INTENT_TIMEOUT) {
    inMemoryIntentState = { ...inMemoryIntentState, currentIntent: "general", lastUpdated: Date.now(), activeQuiz: null };
  }
  
  return {
    ...inMemoryIntentState,
    recentTopics: [...inMemoryIntentState.recentTopics],
  };
}

export function setIntent(intent: Intent): void {
  const state = getIntentState();
  const newState = {
    ...state,
    currentIntent: intent,
    lastUpdated: Date.now(),
    // Clear quiz if switching away from quiz intent
    activeQuiz: intent === "quiz" ? state.activeQuiz : null
  };
  saveState(newState);
}

export function setActiveQuiz(quiz: QuizState | null): void {
  const state = getIntentState();
  saveState({ 
    ...state, 
    activeQuiz: quiz,
    currentIntent: quiz ? "quiz" : state.currentIntent 
  });
}

export function addRecentTopic(topic: string): void {
  const state = getIntentState();
  const updatedTopics = [topic, ...state.recentTopics.filter(t => t !== topic)].slice(0, TOPIC_LIMIT);
  saveState({ ...state, recentTopics: updatedTopics });
}

export function clearIntent(): void {
  saveState({ ...DEFAULT_STATE, lastUpdated: Date.now() });
}

function saveState(state: IntentState): void {
  inMemoryIntentState = state;
}
