import { QuizData } from "@/types";

const BACKEND_API_URL = "http://localhost:3001/api/chat";
const GROQ_MODEL = "llama-3.1-8b-instant";

/**
 * Generates a structured quiz using LLM with strict JSON output.
 */
export async function generateQuiz(topic: string = "general knowledge"): Promise<QuizData | null> {
  const prompt = `You are a fun educational assistant. Generate a single Multiple Choice Question (MCQ) for a child about: ${topic}.
  
  Return ONLY a valid JSON object with this exact structure:
  {
    "question": "The question text",
    "options": [
      { "label": "A", "text": "Option 1" },
      { "label": "B", "text": "Option 2" },
      { "label": "C", "text": "Option 3" },
      { "label": "D", "text": "Option 4" }
    ],
    "correct_answer": "A"
  }
  
  Rules:
  - Return ONLY the JSON object.
  - No extra text, no markdown code blocks, no explanation.
  - Ensure correct_answer is exactly "A", "B", "C", or "D".
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
    const quiz: QuizData = JSON.parse(jsonStr);

    // Validation Layer
    if (!quiz.question || !quiz.options || quiz.options.length !== 4 || !quiz.correct_answer) {
      console.warn("[QuizService] Invalid quiz structure received", quiz);
      return null;
    }

    const validLabels = ["A", "B", "C", "D"];
    if (!validLabels.includes(quiz.correct_answer.toUpperCase())) {
      console.warn("[QuizService] Invalid correct answer label", quiz.correct_answer);
      return null;
    }

    return quiz;
  } catch (error) {
    console.error("[QuizService] Error generating quiz:", error);
    return null;
  }
}
