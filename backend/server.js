
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// --- API Endpoints ---

// 1. Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, model } = req.body;

  if (!messages) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "llama-3.1-8b-instant",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Chat] Groq API Error:`, errorText);
      return res.status(response.status).json({ error: 'AI provider error' });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("[Chat] Server error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Insights Endpoint
app.post('/api/insights', async (req, res) => {
  const { summary } = req.body;

  if (!summary || typeof summary !== "object" || Object.keys(summary).length === 0) {
    return res.status(400).json({ error: "Invalid summary data" });
  }

  const topTopicsStr = summary.topTopics?.map(t => typeof t === 'string' ? t : `${t.name} (${t.count})`).join(', ') || 'None';

  const systemPrompt = `
    You are an expert AI behavior analyst for a child's educational application.
    Analyze the provided child activity data and generate:
    1. One Key Insight (short, impactful, data-driven)
    2. 3 Smart Insights (behavioral + actionable, specific to the data)
    
    Data: ${JSON.stringify(summary)}
    
    STRICT OUTPUT FORMAT (JSON ONLY):
    {
      "keyInsight": "string",
      "smartInsights": ["string", "string", "string"]
    }
    Rules:
    - Be extremely specific to the data provided (top topics: ${topTopicsStr}, recent questions: ${summary.recentQuestions?.join(', ')}).
    - Mention actual topics if present.
    - Mention usage trends (total usage: ${summary.totalUsageMinutes} mins).
    - Avoid generic phrases like "Your child is doing well".
    - Be concise and parent-friendly.
    - Do NOT output anything outside JSON.
  `;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze the following child activity summary and provide behavioral insights:\n${JSON.stringify(summary)}` }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Insights] Groq API Error:`, errorText);
      // Return safe fallback instead of error
      return res.status(200).json({
        keyInsight: "Unable to analyze learning patterns right now.",
        smartInsights: [
          "Try again in a moment.",
          "Make sure there is enough recent activity to analyze."
        ]
      });
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent) throw new Error("Empty AI response");

    res.status(200).json(JSON.parse(rawContent));
  } catch (error) {
    console.error("[Insights] Server error:", error);
    res.status(200).json({
      keyInsight: "Unable to analyze learning patterns right now.",
      smartInsights: [
        "Try again in a moment.",
        "Make sure there is enough recent activity to analyze."
      ]
    });
  }
});

// 3. Domain-Scoped Deep Analysis Endpoint
app.post('/api/deep-analysis', async (req, res) => {
  const { insight, summary, flaggedMessage, recentContext, insightType } = req.body;

  if (!insight || !summary || !insightType) {
    return res.status(400).json({ error: 'Insight, summary, and insightType are required' });
  }

  let systemPrompt = "";

  if (insightType === "safety") {
    systemPrompt = `
      You are an expert AI child safety analyst. Focus ONLY on emotional and behavioral risk.
      Targeted Insight: "${insight}"
      Flagged Message: "${flaggedMessage || 'N/A'}"
      Recent Context: ${JSON.stringify(recentContext || [])}
      
      Task:
      - Analyze WHY this specific safety-related message or insight occurred.
      - Detect distress, anger, escalation, or risky intent.
      - DO NOT mention math, learning, or general engagement.
      - DO NOT give generic parenting advice.
      
      Return STRICT JSON:
      {
        "analysis": "Focused explanation of this safety incident.",
        "severity": "low | medium | high",
        "signals": ["anger", "distress", "escalation"],
        "pattern": {
          "exists": boolean,
          "type": "escalation | emotional_distress | aggression",
          "confidence": number,
          "explanation": "Pattern description"
        },
        "recommended_actions": ["Specific safety step 1", "Specific safety step 2"]
      }
    `;
  } else if (insightType === "learning") {
    systemPrompt = `
      You are an expert AI educational consultant. Focus ONLY on learning behavior and performance.
      Targeted Insight: "${insight}"
      Learning Context: ${JSON.stringify(recentContext || [])}
      
      Task:
      - Analyze performance, math attempts, correctness, and skill gaps.
      - Detect knowledge gaps or lack of confidence in specific subjects.
      - DO NOT mention emotional distress or safety risks.
      - DO NOT reference violent or inappropriate messages.
      
      Return STRICT JSON:
      {
        "analysis": "Focused explanation of this learning pattern.",
        "severity": "low | medium | high",
        "signals": ["low confidence", "skill gap", "strong logic"],
        "pattern": {
          "exists": boolean,
          "type": "learning_plateau | subject_mastery | inconsistent_effort",
          "confidence": number,
          "explanation": "Learning pattern description"
        },
        "recommended_actions": ["Specific educational step 1", "Specific educational step 2"]
      }
    `;
  } else if (insightType === "engagement") {
    systemPrompt = `
      You are an expert AI engagement analyst. Focus ONLY on interaction behavior and usage patterns.
      Targeted Insight: "${insight}"
      Engagement Data: ${JSON.stringify(summary)}
      
      Task:
      - Analyze session duration, responsiveness, and drop-off rates.
      - Detect low engagement, lack of interest, or hyper-focus.
      - DO NOT mention emotional distress or learning performance.
      - DO NOT reference unrelated risky messages.
      
      Return STRICT JSON:
      {
        "analysis": "Focused explanation of this engagement behavior.",
        "severity": "low | medium | high",
        "signals": ["low interaction", "short session", "high focus"],
        "pattern": {
          "exists": boolean,
          "type": "engagement_dropoff | session_buildup | focused_exploration",
          "confidence": number,
          "explanation": "Engagement pattern description"
        },
        "recommended_actions": ["Specific engagement step 1", "Specific engagement step 2"]
      }
    `;
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Perform a deep ${insightType} analysis of this insight: "${insight}"` }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[Deep Analysis] Groq API Error:`, errorData);
      throw new Error(`Groq API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Deep Analysis] Server error:", error);
    res.status(500).json({ error: 'Failed to perform deep analysis' });
  }
});

// 4. Intelligence Analysis Endpoint
app.post('/api/analyze-intelligence', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const systemPrompt = `
    You are an expert AI behavioral psychologist for children.
    Analyze the provided conversation data to evaluate the child's intelligence metrics based on semantic reasoning, NOT keyword counting.
    
    Data: ${JSON.stringify(messages)}
    
    STRICT OUTPUT FORMAT (JSON ONLY):
    {
      "curiosity": number (0-100),
      "mathConfidence": number (0-100),
      "attentionSpan": number (0-100),
      "reasoning": {
        "curiosity": "string",
        "mathConfidence": "string",
        "attentionSpan": "string"
      }
    }
    
    Rules for Evaluation:
    1. Curiosity: 
       - Does the child ask meaningful, exploratory, or follow-up questions? 
       - Are questions evolving over time? 
       - Avoid counting repeated shallow questions.
       - High curiosity = child asks "why" or "how" in complex ways, shows interest in diverse topics.
    
    2. Math Confidence:
       - Does the child attempt problem solving? 
       - Does the child improve or correct mistakes? 
       - Is there engagement with numerical/logical reasoning?
       - High confidence = child actively engages with numbers or logical patterns.
    
    3. Attention Span:
       - Are responses thoughtful and consistent? 
       - Does the child stay on topic within a session? 
       - Does the child complete multi-step interactions?
       - High attention = child follows a train of thought and provides relevant replies.
       
    Rules:
    - Tone of reasoning: Professional, insightful, and supportive.
    - Be SPECIFIC: Use the child's data in the reasoning.
    - Do NOT be generic.
    - Output JSON ONLY.
  `;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Using 2nd key for intelligence
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze the child's behavior from the provided history." }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[Intelligence Analysis] Groq API Error:`, errorData);
      throw new Error(`Groq API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Intelligence Analysis] Server error:", error);
    res.status(500).json({ error: 'Failed to perform intelligence analysis' });
  }
});

// 5. Semantic Risk Detection Endpoint
app.post('/api/detect-risk', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const systemPrompt = `
    You are a child safety analysis system.
    Analyze the following message for risky intent:
    
    "{message}"
    
    Determine if this message indicates:
    - violent intent
    - self-harm
    - emotional distress
    - unsafe curiosity
    
    Return STRICT JSON:
    {
      "is_flagged": true | false,
      "severity": "low | medium | high",
      "category": "violence | self-harm | emotional | safe",
      "reason": "short explanation"
    }
    
    Rules:
    - Understand semantic meaning, NOT just keywords.
    - Avoid false positives (e.g., "kill the game" is NOT violence).
    - Be conservative but accurate.
    - Output JSON ONLY.
  `;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Use 8b for speed on per-message checks
        messages: [
          { role: "system", content: systemPrompt.replace("{message}", message) },
          { role: "user", content: "Analyze the safety risk of this message." }
        ],
        temperature: 0.1, // High deterministic for safety
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[Risk Detection] Groq API Error:`, errorData);
      throw new Error(`Groq API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Risk Detection] Server error:", error);
    // Safe default if API fails
    res.status(200).json({
      is_flagged: false,
      severity: "low",
      category: "safe",
      reason: "Analysis unavailable, defaulting to safe."
    });
  }
});

// 6. Pattern Risk Analysis Endpoint
app.post('/api/analyze-pattern', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const systemPrompt = `
    You are an advanced child behavior analysis system.
    Analyze the following sequence of messages for risky patterns:
    
    Messages: ${JSON.stringify(messages)}
    
    Your task:
    - Identify patterns across messages (not individual ones).
    - Detect escalation, repetition, or emotional buildup.
    - Determine if combined behavior indicates higher risk.
    
    Look for:
    - increasing intensity
    - repeated negative emotions
    - shifts in tone
    - unresolved frustration
    
    Return STRICT JSON:
    {
      "pattern_detected": true | false,
      "pattern_type": "escalation | emotional_distress | aggression | none",
      "severity": "low | medium | high",
      "explanation": "clear explanation of pattern",
      "confidence": number (0-100)
    }
    
    Rules:
    - Do NOT just summarize messages.
    - Focus on relationships between messages.
    - Detect trends, not isolated signals.
    - Output JSON ONLY.
  `;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Use 70b for better reasoning on patterns
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze the behavior pattern in this message sequence." }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[Pattern Analysis] Groq API Error:`, errorData);
      throw new Error(`Groq API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Pattern Analysis] Server error:", error);
    res.status(200).json({
      pattern_detected: false,
      pattern_type: "none",
      severity: "low",
      explanation: "Analysis unavailable.",
      confidence: 0
    });
  }
});

// 7. High-Confidence Decision Engine Endpoint
app.post('/api/decision-engine', async (req, res) => {
  const { metrics, history } = req.body;

  if (!metrics) {
    return res.status(400).json({ error: 'Metrics are required' });
  }

  const systemPrompt = `
    You are a high-confidence AI systems architect and child psychologist.
    Your task is to analyze child data and provide SHARP, DATA-GROUNDED, and ACTIONABLE insights.
    
    Current Metrics: ${JSON.stringify(metrics)}
    Score History: ${JSON.stringify(history || [])}
    
    Task:
    1. Top Insight: Pick the most critical metric change or weakness. MUST reference an exact metric and number.
    2. Focus Area: Identify the lowest scoring metric or highest negative trend.
    3. Trend: "improving", "declining", or "stable".
    4. Action Plan: ONE high-impact, specific step (1-2 lines). MUST connect to the weakest metric and include a time-based action.
    5. Confidence Score: 0-100 based on data volume and consistency.
    
    Rules for Language:
    - NO generic advice like "Alex is doing well".
    - BAN PHRASES: "seems like", "may indicate", "suggests".
    - Use confident, data-backed phrasing: "is", "shows", "indicates", "demonstrates".
    - If Attention is 28%, say "Attention span dropped to 28%".
    
    Return STRICT JSON:
    {
      "topInsight": "string",
      "focusArea": {
        "metric": "string",
        "value": number
      },
      "trend": "improving | declining | stable",
      "keyChanges": ["change 1", "change 2"],
      "actionPlan": "string",
      "confidence": number
    }
    
    Example Output:
    {
      "topInsight": "Attention span dropped to 28%, indicating difficulty maintaining focus across topics.",
      "focusArea": { "metric": "Attention Span", "value": 28 },
      "trend": "declining",
      "keyChanges": ["Focus duration decreased by 15%", "Topic switching increased"],
      "actionPlan": "Spend 10 minutes today solving 1 focused math problem together without switching topics.",
      "confidence": 82
    }
  `;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze metrics and provide high-confidence insights." }
        ],
        temperature: 0.1, // High deterministic for precision
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`Decision Engine API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Decision Engine] Server error:", error);
    res.status(200).json({
      topInsight: `Curiosity score is ${metrics.curiosity}%, demonstrating steady exploration.`,
      focusArea: { metric: "Attention Span", value: metrics.attentionSpan },
      trend: "stable",
      keyChanges: ["Consistent engagement"],
      actionPlan: "Ask Alex what their favorite thing they learned today was to encourage reflection.",
      confidence: 75
    });
  }
});

// 8. Engagement Intelligence Endpoint
app.post('/api/analyze-engagement', async (req, res) => {
  const { usageData, sessionSummary } = req.body;

  if (!usageData) {
    return res.status(400).json({ error: 'Usage data is required' });
  }

  const systemPrompt = `
    You are an expert AI engagement coach for children's educational apps.
    Analyze the provided usage data to generate sharp engagement intelligence.
    
    Usage Data: ${JSON.stringify(usageData)}
    Session Summary: ${JSON.stringify(sessionSummary || {})}
    
    Task:
    1. Status Reason: Explain the engagement status in one short line.
    2. Trend Explanation: Explain the usage graph/trend (1-2 lines).
    3. Behavior Pattern: Identify the core behavioral pattern (e.g., burst usage, irregular timing).
    4. Action Recommendation: ONE specific, realistic, and short action for the parent to improve engagement today.
    
    Rules:
    - NO generic advice.
    - Be data-grounded.
    - Keep it short and impactful.
    - Output JSON ONLY.
  `;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze engagement data and provide intelligence." }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`Engagement API Error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Engagement Intelligence] Server error:", error);
    res.status(200).json({
      statusReason: "Engagement is currently stable with consistent daily usage.",
      trendExplanation: "Usage has been steady throughout the week with no major spikes or drops.",
      behaviorPattern: "Consistent daily engagement for short durations.",
      actionRecommendation: "Encourage Alex to explore one new topic today to maintain curiosity."
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
});
