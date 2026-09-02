/**
 * Sentiment Analysis Engine
 * Real-time emotional and curiosity analysis for child-AI interactions.
 */

import { API_ENDPOINTS } from "./apiConfig";
import { post } from "./apiClient";

export interface SentimentResult {
  score: number;
  label: string;
  explanation: string;
}

/**
 * Call the AI backend to analyze the sentiment of a message.
 * @param message - The user's message
 * @returns SentimentResult object
 */
export async function analyzeSentiment(message: string): Promise<SentimentResult> {
  try {
    return await post<SentimentResult>(API_ENDPOINTS.analyzeSentiment, { message });
  } catch (error) {
    console.error("[Sentiment] Error during analysis:", error);
    // Safe fallback based on context (e.g., questions are generally positive)
    return {
      score: 70,
      label: "Neutral",
      explanation: "Analysis unavailable, defaulting to neutral."
    };
  }
}
