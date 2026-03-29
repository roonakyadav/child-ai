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

const STORAGE_KEY = "ai_intent_state";
const TOPIC_LIMIT = 10;
const INTENT_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const DEFAULT_STATE: IntentState = {
  currentIntent: "general",
  lastUpdated: Date.now(),
  recentTopics: [],
  activeQuiz: null,
};

export function getIntentState(): IntentState {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return DEFAULT_STATE;
    
    const state: IntentState = JSON.parse(data);
    
    // Auto-reset intent if it's too old
    if (Date.now() - state.lastUpdated > INTENT_TIMEOUT) {
      return { ...state, currentIntent: "general", lastUpdated: Date.now(), activeQuiz: null };
    }
    
    return state;
  } catch (error) {
    return DEFAULT_STATE;
  }
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
  saveState(DEFAULT_STATE);
}

function saveState(state: IntentState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
