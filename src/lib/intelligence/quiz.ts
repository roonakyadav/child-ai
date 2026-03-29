import { QuizState } from "../intentStore";
import { getConfig } from "../configStore";

const config = getConfig();
const BACKEND_API_URL = `${config.api.baseUrl}${config.api.chat}`;
const GROQ_MODEL = config.api.model;

/**
 * Generates a structured quiz using LLM with strict JSON output.
 */
export async function generateQuiz(topic: string = "general knowledge"): Promise<QuizState | null> {
  const prompt = `You are a fun educational assistant. Generate a single Multiple Choice Question (MCQ) for a child about: ${topic}.
  
  Return ONLY a valid JSON object with this exact structure:
  {
    "question": "The question text",
    "options": {
      "A": "Option text 1",
      "B": "Option text 2",
      "C": "Option text 3",
      "D": "Option text 4"
    },
    "correctAnswer": "A",
    "explanation": "A very short, simple explanation of why the answer is correct for a child."
  }
  
  Rules:
  - Return ONLY the raw JSON object. 
  - DO NOT include markdown code blocks (no \`\`\`json).
  - DO NOT include any preamble or introductory text like "Here is your quiz".
  - Ensure correctAnswer is exactly "A", "B", "C", or "D".
  - Make it fun and age-appropriate.`;

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;

    // Clean markdown if AI included it
    const jsonStr = content.replace(/```json|```/g, "").trim();
    const quiz: QuizState = JSON.parse(jsonStr);

    // Validation Layer
    if (!quiz.question || !quiz.options || !quiz.correctAnswer || !quiz.explanation) {
      console.warn("[QuizService] Invalid quiz structure received", quiz);
      return null;
    }

    const validLabels = ["A", "B", "C", "D"];
    if (!validLabels.includes(quiz.correctAnswer.toUpperCase())) {
      console.warn("[QuizService] Invalid correct answer label", quiz.correctAnswer);
      return null;
    }

    return quiz;
  } catch (error) {
    console.error("[QuizService] Error generating quiz:", error);
    return null;
  }
}
