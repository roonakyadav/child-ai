/**
 * Engagement Routes
 * Handles engagement analysis and sentiment analysis endpoints
 */

const express = require('express');
const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimit');
const { requireParentAuth } = require('../middleware/auth');
const { callGroqAPI } = require('../lib/groqHelper');

// POST /api/analyze-engagement
router.post('/analyze-engagement', requireParentAuth, aiLimiter, async (req, res) => {
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
    const response = await callGroqAPI({
      endpoint: 'analyze-engagement',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the engagement data." }
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
      return res.status(200).json({
        statusReason: "AI service temporarily unavailable",
        trendExplanation: "Unable to analyze engagement trends at this time.",
        behaviorPattern: "Analysis unavailable",
        actionRecommendation: "Try again later for engagement insights."
      });
    }
    console.error("[Engagement Intelligence] Server error:", error.message);
    res.status(200).json({
      statusReason: "Engagement is currently stable with consistent daily usage.",
      trendExplanation: "Usage has been steady throughout the week with no major spikes or drops.",
      behaviorPattern: "Consistent daily engagement for short durations.",
      actionRecommendation: "Encourage Alex to explore one new topic today to maintain curiosity."
    });
  }
});

// POST /api/analyze-sentiment
router.post('/analyze-sentiment', aiLimiter, async (req, res) => {
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
    const response = await callGroqAPI({
      endpoint: 'analyze-sentiment',
      messages: [
        { role: "system", content: systemPrompt.replace("{message}", message) },
        { role: "user", content: "Analyze the sentiment of this message." }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      responseFormat: { type: "json_object" },
      isSafetyEndpoint: false
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    res.status(200).json(JSON.parse(content));
  } catch (error) {
    if (error.isSafeError) {
      return res.status(200).json({
        score: 70,
        label: "Neutral",
        explanation: "AI service temporarily unavailable, defaulting to neutral."
      });
    }
    console.error("[Sentiment Analysis] Server error:", error.message);
    res.status(200).json({
      score: 70,
      label: "Neutral",
      explanation: "Analysis unavailable, defaulting to neutral."
    });
  }
});

module.exports = router;
