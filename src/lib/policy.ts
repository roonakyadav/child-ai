/**
 * Parent AI Policy Storage
 * Manages custom AI behavior instructions via localStorage
 */

import { getConfig } from "./configStore";

const POLICY_STORAGE_KEY = "parent_ai_policy";
const POLICIES_LIST_KEY = "parent_policies";
const AI_CONFIG_KEY = "ai_behavior_config";

export type SafetyLevel = "soft" | "moderate" | "strict";
export type PresetMode = "kid-safe" | "learning" | "focus" | "creative";

export interface AIBehaviorConfig {
  selectedPreset: PresetMode;
  safetyLevel: SafetyLevel;
  toggles: {
    strictFiltering: boolean;
    encourageCuriosity: boolean;
    keepAnswersShort: boolean;
    allowStorytelling: boolean;
    avoidSensitiveTopics: boolean;
    useSimpleLanguage: boolean;
  };
  customInstructions: string;
}

export const DEFAULT_AI_CONFIG: AIBehaviorConfig = getConfig().ai.defaultConfig;
export const PRESETS: Record<PresetMode, Partial<AIBehaviorConfig>> = getConfig().ai.presets as any;

/**
 * Get the current AI behavior configuration
 */
export function getAIConfig(): AIBehaviorConfig {
  try {
    const data = localStorage.getItem(AI_CONFIG_KEY);
    return data ? JSON.parse(data) : DEFAULT_AI_CONFIG;
  } catch (error) {
    console.error("[Policy] Error reading AI config:", error);
    return DEFAULT_AI_CONFIG;
  }
}

/**
 * Save AI behavior configuration
 */
export function setAIConfig(config: AIBehaviorConfig): void {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("[Policy] Error saving AI config:", error);
  }
}

/**
 * Get the current AI policy from localStorage

 * @returns The stored policy text or empty string if none exists
 */
export function getPolicy(): string {
  try {
    const policy = localStorage.getItem(POLICY_STORAGE_KEY);
    const additionalPolicies = JSON.parse(localStorage.getItem(POLICIES_LIST_KEY) || "[]");
    
    let combinedPolicy = policy || "";
    if (additionalPolicies.length > 0) {
      combinedPolicy += "\n\nYou must also follow these specific rules:\n" + additionalPolicies.map((p: string) => `- ${p}`).join("\n");
    }
    
    return combinedPolicy;
  } catch (error) {
    console.error("[Policy] Error reading policy:", error);
    return "";
  }
}

/**
 * Save a new AI policy to localStorage
 * @param policy - The policy text to store
 */
export function setPolicy(policy: string): void {
  try {
    localStorage.setItem(POLICY_STORAGE_KEY, policy);
    console.log("[Policy] Policy saved successfully");
  } catch (error) {
    console.error("[Policy] Error saving policy:", error);
  }
}

import { isStrictModeEnabled } from "./auth";

import { getIntentState } from "./intentStore";
import { getMode as getInterventionMode } from "./intervention/modeService";
import { getInjections, clearInjections } from "./intervention/injectionService";
import { getSystemInstructions as getEngineInstructions } from "./modeEngine";

/**
 * Build the complete system prompt with parent policy and strict mode
 * @returns Combined system prompt
 */
export function buildSystemPrompt(): string {
  const config = getAIConfig();
  const strictMode = isStrictModeEnabled();
  const intentState = getIntentState();
  const currentInterventionMode = getInterventionMode();
  const engineInstructions = getEngineInstructions();
  const injections = getInjections();
  
  let basePrompt = "";

  // 1. Core Identity & Style (Primary Rules)
  switch (config.selectedPreset) {
    case "kid-safe":
      basePrompt = "You are a warm, bubbly, and simple companion for kids. Talk like a friendly teacher or cartoon character. Use small words and keep things happy! 🌈";
      break;
    case "learning":
      basePrompt = "You are an expert Tutor. Provide accurate, educational, and detailed explanations. Use correct terminology (e.g., 'Rayleigh scattering' for the sky). No emojis.";
      break;
    case "focus":
      basePrompt = "You are a concise assistant. Provide direct factual answers in 1-2 sentences. No filler, no emojis, no storytelling.";
      break;
    case "creative":
      basePrompt = "You are a Storyteller. Use metaphors and vivid imagery. Make every answer feel like a magical adventure.";
      break;
    default:
      basePrompt = "You are a safe, educational AI for children.";
  }

  // 2. Intelligence & Adaptive Behavior
  basePrompt += `\n\n[ADAPTIVE BEHAVIOR]:
- AMBIGUITY (STRICT RULE): If user input is ambiguous, a single word (e.g., 'banana', 'dog'), or lacks clear intent, you MUST ask a friendly clarifying question. DO NOT assume they want a quiz, story, or fact. Ask what they'd like to do with that topic.
- VARIATION: Each response must be structurally different. Switch between Q&A, stories, fun facts, or scenarios.
- REPETITION: Avoid repeating previous jokes, examples, or story themes. Introduce fresh ideas in every turn.
- QUIZ: Only evaluate answers if the current intent is 'QUIZ'. If uncertain, ask for more details.`;

  // 3. User Intent Context
  basePrompt += `\n\n[USER INTENT]: ${intentState.currentIntent.toUpperCase()}`;
  
  // 4. Constraints & Toggles
  let constraints = "\n\n[CONSTRAINTS]:";
  if (config.toggles.strictFiltering || config.safetyLevel === "strict" || strictMode) {
    constraints += "\n- SAFETY: Politely and naturally redirect unsafe or adult topics to something fun like animals or space.";
  }
  if (config.toggles.encourageCuriosity) constraints += "\n- End with a thoughtful follow-up question.";
  if (config.toggles.keepAnswersShort) constraints += "\n- Keep responses to 2-3 sentences.";
  if (config.toggles.useSimpleLanguage) constraints += "\n- Use simple, easy-to-understand words (ELI5).";
  
  basePrompt += constraints;

  // 5. Mode Engine & Intervention
  basePrompt += `\n\n[BEHAVIOR ENGINE]:\n${engineInstructions}`;
  
  if (currentInterventionMode === "support") {
    basePrompt += `\n\n[INTERVENTION: SUPPORT MODE]
- Maintain a calm, empathetic, and warm tone. Focus on emotional validation.`;
  } else if (currentInterventionMode === "strict") {
    basePrompt += `\n\n[INTERVENTION: STRICT MODE]
- Be extremely protective. Firmly redirect any sensitive topics to safe, educational subjects.`;
  }

  // 6. Direct Parent Instructions (Injections)
  if (injections.length > 0) {
    basePrompt += `\n\n[DIRECT PARENT RULES]:\n${injections.map(msg => `- ${msg}`).join("\n")}`;
    clearInjections();
  }

  // 7. Recent Topics (Anti-Repetition)
  if (intentState.recentTopics.length > 0) {
    basePrompt += `\n\n[RECENT TOPICS]: ${intentState.recentTopics.join(", ")}. Avoid focusing on these unless asked.`;
  }

  // 8. Parent Overrides
  if (config.customInstructions?.trim()) {
    basePrompt += `\n\n[PARENT GUIDELINES]: ${config.customInstructions}`;
  }

  return basePrompt;
}
