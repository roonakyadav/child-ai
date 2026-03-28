/**
 * Groq API Integration (Secure Backend Version)
 * Calls /api/chat serverless function instead of Groq directly
 */

import { getPolicy, buildSystemPrompt } from "@/lib/policy";
import { getMode as getInterventionMode } from "@/lib/intervention/modeService";
import { getInjections, clearInjections } from "@/lib/intervention/injectionService";
import { getSystemInstructions as getEngineInstructions } from "@/lib/modeEngine";

const BACKEND_API_URL = "http://localhost:3001/api/chat";
const GROQ_MODEL = "llama-3.1-8b-instant";

export interface GroqMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Call Backend API to get AI response
 * @param prompt - User's input text
 * @returns AI response text or null if error occurs
 */
export async function askGroq(prompt: string): Promise<string | null> {
  // Get parent policy and build system prompt
  const policy = getPolicy();
  
  // Get parent actions
  const actions = JSON.parse(localStorage.getItem("parent_actions") || "[]");
  const activeActions = actions.map((a: any) => a.type);
  
  // Build base system prompt
  let systemPrompt = buildSystemPrompt(policy);

  // Add Mode Engine Instructions (Learning, Fun, Exploration, Focus + Global Strict Mode)
  systemPrompt += `\n\n[CURRENT AI BEHAVIOR MODE]:\n${getEngineInstructions()}`;

  // Add Multi-step Interaction Handling
  systemPrompt += `\n\n[INTERACTION CONTEXT]:
- If the user is answering a quiz or MCQ, interpret short inputs like 'A', 'B', 'C', 'D' (or '1', '2', etc.) as answers to your previous question.
- Evaluate correctness based on the context of the conversation.
- If you just asked a question, expect the next message to be an answer.`;

  // Add Intervention Mode instructions (Parental override)
  const currentInterventionMode = getInterventionMode();
  if (currentInterventionMode === "support") {
    systemPrompt += `\n\n[PARENT INTERVENTION: SUPPORT MODE ACTIVE]
- Maintain a calm, empathetic, and warm tone.
- Focus on emotional validation and helping the child process their feelings.
- Avoid logic-heavy explanations or being overly academic.
- Prioritize the child's emotional well-being over information delivery.`;
  } else if (currentInterventionMode === "strict") {
    systemPrompt += `\n\n[PARENT INTERVENTION: STRICT MODE ACTIVE]
- Be extremely cautious and protective.
- Aggressively block any topics that could be remotely unsafe or sensitive.
- If the conversation drifts toward risky territory, immediately and firmly redirect to safe, educational, or fun topics (like science, art, or friendly stories).
- Do not engage with any emotional distress; instead, provide a safe and structured environment.`;
  }

  // Add injected system messages
  const injections = getInjections();
  if (injections.length > 0) {
    systemPrompt += `\n\n[DIRECT PARENT INSTRUCTIONS]:\n`;
    systemPrompt += injections.map(msg => `- ${msg}`).join("\n");
    // Clear injections after use
    clearInjections();
  }
  
  // Add parent action modes if any are active
  if (activeActions.length > 0) {
    systemPrompt += `\n\nParent has enabled the following learning support modes:\n`;
    systemPrompt += activeActions.map((type: string) => `- ${type}`).join("\n");
    systemPrompt += `\n\nAdjust your responses accordingly:`;
    
    if (activeActions.includes("attention_support")) {
      systemPrompt += `\n- Use shorter, clearer responses`;
      systemPrompt += `\n- Ask engaging questions to maintain focus`;
      systemPrompt += `\n- Break complex topics into smaller steps`;
    }
    
    if (activeActions.includes("math_support")) {
      systemPrompt += `\n- Provide step-by-step explanations for math topics`;
      systemPrompt += `\n- Use concrete examples and real-world applications`;
      systemPrompt += `\n- Encourage problem-solving approach`;
    }
    
    if (activeActions.includes("curiosity_boost")) {
      systemPrompt += `\n- Encourage exploration and questions`;
      systemPrompt += `\n- Connect topics to broader concepts`;
      systemPrompt += `\n- Foster natural curiosity`;
    }
    
    if (activeActions.includes("creativity_encouragement")) {
      systemPrompt += `\n- Use imaginative language and metaphors`;
      systemPrompt += `\n- Encourage creative thinking`;
      systemPrompt += `\n- Support storytelling and expression`;
    }
    
    if (activeActions.includes("general_support")) {
      systemPrompt += `\n- Be supportive and encouraging`;
      systemPrompt += `\n- Adapt to child's learning style`;
    }
  }

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
      return data.choices[0].message?.content || null;
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
