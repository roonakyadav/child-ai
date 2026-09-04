/**
 * Intelligence Routes
 * Handles intelligence analysis and decision engine endpoints
 */

const express = require('express');
const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimit');
const { requireParentAuth } = require('../middleware/auth');
const { validateBody } = require('../validation/middleware');
const { callGroqAPI } = require('../lib/groqHelper');

// POST /api/analyze-intelligence
router.post('/analyze-intelligence', requireParentAuth, aiLimiter, async (req, res) => {
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
    const response = await callGroqAPI({
      endpoint: 'analyze-intelligence',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the child's behavior from the provided history." }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
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
    console.error("[Intelligence Analysis] Server error:", error.message);
    res.status(500).json({ error: 'Failed to perform intelligence analysis' });
  }
});

// POST /api/decision-engine
router.post('/decision-engine', requireParentAuth, aiLimiter, validateBody('decisionEngine'), async (req, res) => {
  const { metrics, history } = req.body;

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
    const response = await callGroqAPI({
      endpoint: 'decision-engine',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the child's metrics and provide insights." }
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
        topInsight: "AI service temporarily unavailable",
        focusArea: { metric: "Attention Span", value: metrics.attentionSpan },
        trend: "stable",
        keyChanges: ["Consistent engagement"],
        actionPlan: "Ask Alex what their favorite thing they learned today was to encourage reflection.",
        confidence: 75
      });
    }
    console.error("[Decision Engine] Server error:", error.message);
    res.status(200).json({
      topInsight: "Unable to analyze metrics right now.",
      focusArea: { metric: "Attention Span", value: metrics.attentionSpan },
      trend: "stable",
      keyChanges: ["Consistent engagement"],
      actionPlan: "Ask Alex what their favorite thing they learned today was to encourage reflection.",
      confidence: 75
    });
  }
});

module.exports = router;
