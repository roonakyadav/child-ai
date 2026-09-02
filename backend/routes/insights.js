/**
 * Insights Routes
 * Handles insights and deep analysis endpoints
 */

const express = require('express');
const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimit');
const { validateBody } = require('../validation/middleware');
const { callGroqAPI } = require('../lib/groqHelper');

// POST /api/insights
router.post('/', aiLimiter, validateBody('insights'), async (req, res) => {
  const { summary } = req.body;

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
    const response = await callGroqAPI({
      endpoint: 'insights',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate insights based on this data." }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      responseFormat: { type: "json_object" },
      isSafetyEndpoint: false
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    if (error.isSafeError) {
      return res.status(200).json({
        keyInsight: "AI service temporarily unavailable",
        smartInsights: [
          "Please try again later.",
          "Insights require AI analysis."
        ]
      });
    }
    console.error("[Insights] Server error:", error.message);
    res.status(200).json({
      keyInsight: "Unable to analyze learning patterns right now.",
      smartInsights: [
        "Try again in a moment.",
        "Make sure there is enough recent activity to analyze."
      ]
    });
  }
});

// POST /api/deep-analysis
router.post('/deep-analysis', aiLimiter, validateBody('deepAnalysis'), async (req, res) => {
  const { insight, summary, flaggedMessage, recentContext, insightType } = req.body;

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
    const response = await callGroqAPI({
      endpoint: 'deep-analysis',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Perform deep analysis." }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      responseFormat: { type: "json_object" },
      isSafetyEndpoint: false
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    if (error.isSafeError) {
      return res.status(500).json({ error: error.message, code: error.code });
    }
    console.error("[Deep Analysis] Server error:", error.message);
    res.status(500).json({ error: 'Failed to perform deep analysis' });
  }
});

module.exports = router;
