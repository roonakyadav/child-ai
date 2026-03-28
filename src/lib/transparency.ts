/**
 * AI Transparency Layer
 * Analyzes and explains why each AI response was generated
 */

// List of sensitive keywords that trigger filtering
const SENSITIVE_KEYWORDS = [
  "sex",
  "kill",
  "hack",
  "weapon",
  "violence",
  "drugs",
  "porn",
  "nude",
];

export interface ResponseMeta {
  status: "safe" | "filtered" | "guided";
  reason: string;
}

/**
 * Analyze user message and AI response to determine transparency metadata
 * @param userMessage - The user's input message
 * @param aiResponse - The AI's generated response
 * @param policy - The parent's custom policy (if any)
 * @returns Metadata explaining the response
 */
export function analyzeResponse(
  userMessage: string,
  aiResponse: string,
  policy: string
): ResponseMeta {
  const normalizedMessage = userMessage.toLowerCase();

  // Check for sensitive topics
  const containsSensitiveContent = SENSITIVE_KEYWORDS.some((keyword) =>
    normalizedMessage.includes(keyword)
  );

  if (containsSensitiveContent) {
    return {
      status: "filtered",
      reason: "Sensitive topic detected, response redirected safely",
    };
  }

  // Check if parent policy influenced the response
  if (policy && policy.trim() !== "") {
    return {
      status: "guided",
      reason: "Response influenced by parent AI settings",
    };
  }

  // Default safe interaction
  return {
    status: "safe",
    reason: "Normal educational interaction",
  };
}
