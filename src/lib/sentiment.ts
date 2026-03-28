/**
 * Sentiment Analysis Engine
 * Real-time emotional and curiosity analysis for child-AI interactions.
 */

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
    const response = await fetch("http://localhost:3001/api/analyze-sentiment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Sentiment API failed with status: ${response.status}`);
    }

    return await response.json();
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
