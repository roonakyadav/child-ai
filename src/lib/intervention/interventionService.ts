import { Intervention, InteractionOutcome } from "@/types";
import { post } from "../apiClient";

// In-memory intervention store for child session privacy (never persisted to localStorage)
let inMemoryInterventions: Intervention[] = [];

/**
 * Saves an intervention to in-memory store.
 */
export function saveIntervention(intervention: Intervention): void {
  inMemoryInterventions = [intervention, ...inMemoryInterventions];
}

/**
 * Retrieves all interventions from in-memory store.
 */
export function getInterventions(): Intervention[] {
  return [...inMemoryInterventions];
}

/**
 * Clear in-memory interventions (for resets and testing)
 */
export function clearInterventions(): void {
  inMemoryInterventions = [];
}

/**
 * Updates an existing intervention with its outcome.
 */
export function updateInterventionOutcome(id: string, outcome: InteractionOutcome): void {
  inMemoryInterventions = inMemoryInterventions.map((i) =>
    i.id === id ? { ...i, outcome } : i
  );
}

/**
 * Analyzes the outcome of an intervention by comparing messages before and after.
 */
export async function analyzeInterventionOutcome(intervention: Intervention): Promise<InteractionOutcome | null> {
  if (intervention.messages_before.length === 0 || intervention.messages_after.length === 0) {
    return null;
  }

  try {
    const outcome: InteractionOutcome = await post<InteractionOutcome>('/api/analyze-intervention', {
      messages_before: intervention.messages_before,
      messages_after: intervention.messages_after,
    });
    updateInterventionOutcome(intervention.id, outcome);
    return outcome;
  } catch (error) {
    console.error("[InterventionService] Error analyzing outcome:", error);
    return null;
  }
}

/**
 * Tracks and manages post-intervention messages.
 */
export function addMessageToActiveInterventions(text: string): void {
  const interventions = getInterventions();
  const now = Date.now();
  
  let updated = false;
  const newInterventions = interventions.map(i => {
    // Only track for interventions that happened in the last 30 mins and have less than 5 messages after
    if (!i.outcome && i.messages_after.length < 5 && (now - i.timestamp < 30 * 60 * 1000)) {
      updated = true;
      const updatedIntervention = {
        ...i,
        messages_after: [...i.messages_after, { text, timestamp: now }]
      };
      
      // Trigger analysis if we've collected enough messages (3-5 as per requirement)
      if (updatedIntervention.messages_after.length >= 3) {
        analyzeInterventionOutcome(updatedIntervention);
      }
      
      return updatedIntervention;
    }
    return i;
  });

  if (updated) {
    inMemoryInterventions = newInterventions;
  }
}
