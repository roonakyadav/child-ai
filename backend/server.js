
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// --- API Endpoints ---

// 0. Test Endpoint
app.get('/api/test', (req, res) => {
  res.send("API WORKING");
});

// 1. Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, model } = req.body;

  if (!messages) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  try {
    const response = await axios.post(GROQ_API_URL, {
      model: model || "llama-3.1-8b-instant",
      messages,
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("[Chat] Server error:", error.response?.data || error.message);
    res.status(500).json({ error: 'AI provider error' });
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
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze the following child activity summary and provide behavioral insights:\n${JSON.stringify(summary)}` }
      ],
      temperature: 0.4,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const rawContent = response.data?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty AI response");

    res.status(200).json(JSON.parse(rawContent));
  } catch (error) {
    console.error("[Insights] Server error:", error.response?.data || error.message);
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
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Perform a deep ${insightType} analysis of this insight: "${insight}"` }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Deep Analysis] Server error:", error.response?.data || error.message);
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
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the child's behavior from the provided history." }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Intelligence Analysis] Server error:", error.response?.data || error.message);
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
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt.replace("{message}", message) },
        { role: "user", content: "Analyze the safety risk of this message." }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Risk Detection] Server error:", error.response?.data || error.message);
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
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the behavior pattern in this message sequence." }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Pattern Analysis] Server error:", error.response?.data || error.message);
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
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze metrics and provide high-confidence insights." }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Decision Engine] Server error:", error.response?.data || error.message);
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
    Analyze the provided usage data to generate sharp, behavior-driven engagement intelligence.
    
    Usage Data: ${JSON.stringify(usageData)}
    Session Summary: ${JSON.stringify(sessionSummary || {})}
    
    CRITICAL RULES:
    1. NEVER use the phrase "Low engagement". If activity is high but consistency is low, call it "High activity in a single session".
    2. DO NOT make assumptions about duration or intent. Focus on what actually happened.
    3. Use a neutral, informative, and behavior-driven tone. Avoid judgment words.
    
    Task:
    1. Status Reason: Explain what happened in one short line.
       - IF burst usage (many activities in 1 session), USE: "High activity concentrated in a single session. Consistency is still developing."
    2. Trend Explanation: Explain the usage data (1-2 lines).
       - IF burst usage, USE: "All ${usageData.totalActivities} interactions occurred within a single session. No activity was recorded on other days."
    3. Behavior Pattern: Identify the core behavioral pattern.
       - IF burst usage, USE: "High activity in a single session"
    4. Action Recommendation: ONE specific, realistic, and short action for the parent to improve engagement today.
    5. Activity Level: "High" | "Medium" | "Low" (Based on total activities: 10+ is High, 5-9 is Medium, <5 is Low)
    6. Consistency Level: "High" | "Medium" | "Low" (Based on active days/sessions: 4+ days is High, 2-3 days is Medium, 1 day is Low)
    
    Rules:
    - NO generic advice.
    - Be data-grounded.
    - Keep it short and impactful.
    - Output JSON ONLY.
  `;

  try {
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze engagement data and provide intelligence." }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Engagement Intelligence] Server error:", error.response?.data || error.message);
    res.status(200).json({
      statusReason: "Engagement is currently stable with consistent daily usage.",
      trendExplanation: "Usage has been steady throughout the week with no major spikes or drops.",
      behaviorPattern: "Consistent daily engagement for short durations.",
      actionRecommendation: "Encourage Alex to explore one new topic today to maintain curiosity."
    });
  }
});

// 9. Sentiment Analysis Endpoint
app.post('/api/analyze-sentiment', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const systemPrompt = `
    You are an AI sentiment analyzer for a child's educational app.
    Analyze the emotional tone and curiosity of the following message:
    
    "{message}"
    
    Assign a sentiment score from 0 to 100 where:
    - 90-100: Extremely positive, high curiosity, eager to learn.
    - 70-89: Positive, friendly, general engagement.
    - 50-69: Neutral, simple questions, basic facts.
    - 30-49: Negative, frustrated, confused, or low engagement.
    - 0-29: High risk, angry, distressed, or unsafe intent.
    
    Return STRICT JSON:
    {
      "score": number,
      "label": "string (e.g., Eager, Curious, Neutral, Frustrated, Distressed)",
      "explanation": "short explanation"
    }
    
    Rules:
    - Focus on child-appropriate emotional cues.
    - High curiosity = Higher score.
    - Blocked/unsafe intent = Very low score (0-20).
    - Output JSON ONLY.
  `;

  try {
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt.replace("{message}", message) },
        { role: "user", content: "Analyze the sentiment of this message." }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Sentiment Analysis] Server error:", error.response?.data || error.message);
    res.status(200).json({
      score: 70,
      label: "Neutral",
      explanation: "Analysis unavailable, defaulting to neutral."
    });
  }
});

// 10. Early Risk Analysis Endpoint (Crucial for Predictive Alerts)
app.post('/api/analyze-early-risk', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const systemPrompt = `
    You are an expert AI child safety and behavioral analyst.
    Analyze the following recent messages (last 5-10) for early warning signs of emotional distress, frustration, or behavioral drift.
    
    Messages: ${JSON.stringify(messages)}
    
    Your task:
    - Identify early signs of distress, anger, or confusion before they become critical risks.
    - Determine if the combined behavior indicates a need for parent intervention.
    
    Return STRICT JSON:
    {
      "early_risk": true | false,
      "risk_type": "emotional_build_up | frustration | confusion | suspicious | none",
      "severity": "low | medium | high",
      "confidence": number (0-100),
      "explanation": "clear explanation of the early warning"
    }
    
    Rules:
    - Focus on PREDICTIVE signals.
    - If the child is getting increasingly frustrated, mark as true.
    - Output JSON ONLY.
  `;

  try {
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the early risk in this message sequence." }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Early Risk Analysis] Server error:", error.response?.data || error.message);
    res.status(200).json({
      early_risk: false,
      risk_type: "none",
      severity: "low",
      confidence: 0,
      explanation: "Predictive analysis unavailable."
    });
  }
});

// 11. Full Report Generation Endpoint
app.post('/api/generate-full-report', async (req, res) => {
  console.log("✅ HIT generate-full-report");
  const { allData } = req.body;

  if (!allData) {
    return res.status(400).json({ error: 'Data is required' });
  }

  const { extractedData, childName = "Alex" } = allData;
  console.log("[Report] Generating from structured data:", JSON.stringify(extractedData));

  const systemPrompt = `
    You are a world-class AI child development specialist and behavioral psychologist.
    Your task is to generate a 4-page detailed, professional, and data-driven developmental report for parents.
    
    STRICT DATA SOURCE: You MUST use the following extracted metrics for ALL sections. 
    Extracted Data: ${JSON.stringify(extractedData)}
    
    REPORT STRUCTURE & CONTENT RULES:
    
    1. Executive Overview:
       - MUST reference total interactions: ${extractedData?.totalMessages || 0}.
       - Mention main topics explored (Math: ${extractedData?.topics?.math}%, Science: ${extractedData?.topics?.science}%, etc.).
       - Explicitly state presence/absence of emotional signals (Sad: ${extractedData?.emotions?.sad}) or unsafe interactions (Self-Harm: ${extractedData?.unsafe?.selfHarm}, Violence: ${extractedData?.unsafe?.violence}, Inappropriate: ${extractedData?.unsafe?.inappropriate}).
       - ZERO generic filler. If data exists, describe it exactly as it is.
       - Use "Low interaction volume, insights may be approximate" if total messages < 5.
    
    2. Key Performance Metrics:
       - Use the provided metrics summary: ${JSON.stringify(allData.intelligence || {})}.
       - For EACH metric (Curiosity, Math Confidence, Attention Span), provide a 1-line explanation based on ACTUAL behavior from extractedData.
       - Example: "Math confidence is 40% due to limited math engagement (${extractedData?.topics?.math}% of total topics)."
       - Emotional Stability: ${extractedData?.emotionalStability}. (Logic: selfHarm > 0 = Unstable, sadness > 0 = Needs Attention, else Stable).
    
    3. Behavioral Analysis:
       - Use actual emotional counts: ${JSON.stringify(extractedData?.emotions)}.
       - Use unsafe counts: ${JSON.stringify(extractedData?.unsafe)}.
       - Use rude count: ${extractedData?.rude}.
       - If sadness/distress > 0, mention specific emotional signals detected.
       - If self-harm > 0, mark as CRITICAL priority.
       - If violence > 0, mention safety concerns without exaggeration.
       - If inappropriate (curiosity-based like "nuke") > 0, categorize as "Unsafe Curiosity" rather than violent intent.
       - Do NOT use template text like "Alex seems well adjusted" unless data supports it.
    
    4. Educational Progress:
       - MUST use topic distribution: Math ${extractedData?.topics?.math}%, Science ${extractedData?.topics?.science}%, Stories ${extractedData?.topics?.stories}%.
       - Connect high scores to specific curiosity in that domain.
       - If a topic is 0%, mention it as an opportunity for growth.
    
    5. Safety & Risk Report:
       - Based ONLY on unsafe counts: ${JSON.stringify(extractedData?.unsafe)} and rude: ${extractedData?.rude}.
       - Rules: 
         - 1 unsafe instance (any category) -> "Needs attention"
         - 2+ unsafe (violence/inappropriate) -> "Moderate concern"
         - Any self-harm -> "High concern" (if repeated, "Critical priority")
         - Rude messages -> separate communication category.
       - Do NOT mix emotional signals (sadness) with dangerous intent (unsafe).
       - AVOID exaggerated language like "violent behavior risk" unless multiple violence signals exist.
    
    6. Parent Recommendations:
       - MUST be generated from detected issues in the data.
       - Low math % -> suggest specific math activities.
       - Any self-harm -> suggest immediate professional consultation/support.
       - High sadness -> suggest emotional check-ins.
       - Low engagement (follow-ups: ${extractedData?.engagement?.followUps}) -> suggest interactive activities.
    
    STRICT OUTPUT FORMAT (JSON ONLY):
    {
      "title": "Full Developmental & Safety Report",
      "childName": "${childName}",
      "date": "${new Date().toLocaleDateString()}",
      "sections": [
        {
          "heading": "string",
          "subheading": "string",
          "content": "string (Long, detailed paragraphs - at least 300 words per section. Use real data points throughout)",
          "key_takeaways": ["string", "string", "string"]
        }
      ],
      "metrics_summary": {
        "curiosity": number,
        "mathConfidence": number,
        "attentionSpan": number,
        "overall_stability": "${extractedData?.emotionalStability}"
      }
    }
    
    Rules:
    - NO "data is limited", "cannot assess", or "insufficient information".
    - Use the provided data to build a narrative of what was ACTUALLY observed.
    - Professional, supportive, and data-grounded tone.
    - Output JSON ONLY.
  `;

  try {
    const response = await axios.post(GROQ_API_URL, {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the full developmental report based on the provided extracted data metrics." }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    console.error("[Full Report Analysis] Server error:", error.response?.data || error.message);
    res.status(500).json({ error: `Failed to generate report: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
});
