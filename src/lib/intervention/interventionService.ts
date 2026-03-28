import { Intervention, InterventionOutcome } from "@/types";

const INTERVENTIONS_STORAGE_KEY = "interventions";

/**
 * Saves an intervention to localStorage.
 */
export function saveIntervention(intervention: Intervention): void {
  const interventions = getInterventions();
  localStorage.setItem(INTERVENTIONS_STORAGE_KEY, JSON.stringify([intervention, ...interventions]));
}

/**
 * Retrieves all interventions from localStorage.
 */
export function getInterventions(): Intervention[] {
  try {
    const stored = localStorage.getItem(INTERVENTIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("[InterventionService] Error reading interventions:", error);
    return [];
  }
}

/**
 * Updates an existing intervention with its outcome.
 */
export function updateInterventionOutcome(id: string, outcome: InterventionOutcome): void {
  const interventions = getInterventions();
  const updated = interventions.map((i) =>
    i.id === id ? { ...i, outcome } : i
  );
  localStorage.setItem(INTERVENTIONS_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Analyzes the outcome of an intervention by comparing messages before and after.
 */
export async function analyzeInterventionOutcome(intervention: Intervention): Promise<InterventionOutcome | null> {
  if (intervention.messages_before.length === 0 || intervention.messages_after.length === 0) {
    return null;
  }

  try {
    const response = await fetch("http://localhost:3001/api/analyze-intervention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages_before: intervention.messages_before,
        messages_after: intervention.messages_after,
      }),
    });

    if (!response.ok) {
      throw new Error(`Intervention Analysis API failed: ${response.status}`);
    }

    const outcome: InterventionOutcome = await response.json();
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
    localStorage.setItem(INTERVENTIONS_STORAGE_KEY, JSON.stringify(newInterventions));
  }
}
