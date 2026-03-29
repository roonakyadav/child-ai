/**
 * Groq API Integration (Secure Backend Version)
 * Calls /api/chat serverless function instead of Groq directly
 */

import { buildSystemPrompt } from "@/lib/policy";
import { getMessages, addUserMessage, addAssistantMessage } from "@/lib/conversationStore";
import { logInteraction } from "@/lib/activityLogger";
import { getIntentState, setIntent } from "@/lib/intentStore";
import { getConfig } from "@/lib/configStore";

const config = getConfig();
const BACKEND_API_URL = `${config.api.baseUrl}${config.api.chat}`;
const GROQ_MODEL = config.api.model;

export interface GroqMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Call Backend API to get AI response
 * @param prompt - User's input text
 * @param intent - Optional intent tagging for context (e.g., 'joke', 'story')
 * @returns AI response text or null if error occurs
 */
export async function askGroq(prompt: string, intent?: string): Promise<string | null> {
  // 1. Update global intent state if provided
  if (intent) {
    setIntent(intent as any);
  } else {
    // Basic auto-reset: if input is a short animal or random word while in quiz/game,
    // and it's not a single letter A-D, we might want to reset intent to general.
    const intentState = getIntentState();
    const isShortWord = prompt.split(" ").length <= 2;
    const isLikelyNotAnswer = !/^[A-D]$|^[1-4]$/i.test(prompt.trim());
    
    // Do NOT reset intent if there is an active quiz
    if (intentState.currentIntent !== "general" && !intentState.activeQuiz && isShortWord && isLikelyNotAnswer) {
      if (prompt.length > 5) setIntent("general");
    }
  }

  // Build base system prompt from parent AI configuration (now includes intent, rules, and ordering)
  let systemPrompt = buildSystemPrompt();

  // Detect Ambiguity
  const words = prompt.trim().split(/\s+/);
  const isAmbiguous = words.length <= 2 && 
                     !/tell|show|explain|quiz|joke|story|fact|help|how|why|what|when|where/i.test(prompt);
  
  if (isAmbiguous && intent !== "quiz" && intent !== "game") {
    systemPrompt += `\n\n[AMBIGUITY WARNING]: The user input is very short and lacks clear intent. You MUST ask a clarifying question instead of starting a new activity.`;
  }

  // Get conversation history (last 10 messages for better context weighting)
  const history = getMessages().slice(-10);

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...history,
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Groq] Backend Error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const aiText = data.choices[0].message?.content || null;
      if (aiText) {
        // Store in global memory
        addUserMessage(prompt);
        addAssistantMessage(aiText);
        
        // Log to Activity Feed
        logInteraction({
          userMessage: prompt,
          aiResponse: aiText
        });
      }
      return aiText;
    }

    console.warn("[Groq] No choices in backend response");
    return null;
  } catch (error) {
    console.error("[Groq] Request failed:", error);
    return null;
  }
}

/**
 * Specifically for parent-level AI tasks (like guiding conversation)
 */
export async function askParentAssistant(prompt: string): Promise<string | null> {
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a senior child safety and education expert. Your goal is to help parents guide their children through difficult or risky conversations by suggesting safe, positive, and educational redirections.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("[Groq] Parent assistant call failed:", error);
    return null;
  }
}
