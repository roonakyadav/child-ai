/**
 * Parent AI Policy Storage
 * Manages custom AI behavior instructions via localStorage
 */

const POLICY_STORAGE_KEY = "parent_ai_policy";
const POLICIES_LIST_KEY = "parent_policies";

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

/**
 * Build the complete system prompt with parent policy and strict mode
 * @param policy - The parent's custom policy text
 * @returns Combined system prompt
 */
export function buildSystemPrompt(policy: string): string {
  const strictMode = isStrictModeEnabled();
  
  let basePrompt = "You are a safe, educational AI for children. Always be age-appropriate, helpful, and positive.";
  
  if (strictMode) {
    basePrompt += "\n\nSTRICT MODE ENABLED: You are in a highly restricted mode. You must strictly avoid any sensitive, complex, or potentially inappropriate topics. If a user asks something even slightly questionable, politely redirect them to a safe educational topic like nature or basic science. Keep answers very simple and brief.";
  }
  
  if (!policy || policy.trim() === "") {
    return basePrompt;
  }
  
  return `${basePrompt}\n\nAdditional parent instructions: ${policy}`;
}
