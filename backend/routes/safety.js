/**
 * Safety Routes
 * Handles safety analysis endpoints (detect-risk, analyze-pattern, analyze-early-risk)
 */

const express = require('express');
const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimit');
const groqHelper = require('../lib/groqHelper');

// POST /api/detect-risk
router.post('/detect-risk', aiLimiter, async (req, res) => {
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
    const response = await groqHelper.callGroqAPI({
      endpoint: 'detect-risk',
      messages: [
        { role: "system", content: systemPrompt.replace("{message}", message) },
        { role: "user", content: "Analyze the safety risk of this message." }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      responseFormat: { type: "json_object" },
      isSafetyEndpoint: true
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    const parsed = JSON.parse(content);
    
    // Validate AI response structure
    if (typeof parsed.is_flagged !== 'boolean' ||
        !['low', 'medium', 'high'].includes(parsed.severity) ||
        !['violence', 'self-harm', 'emotional', 'safe'].includes(parsed.category)) {
      throw new Error("Invalid AI response structure");
    }
    
    // Add explicit status field
    parsed.status = parsed.is_flagged ? "flagged" : "safe";
    
    res.status(200).json(parsed);
  } catch (error) {
    console.error("[Risk Detection] Server error:", error.message);
    // Fail-closed: return UNKNOWN when analysis is unavailable
    res.status(200).json({
      status: "unknown",
      is_flagged: false,
      severity: "unknown",
      category: "unknown",
      reason: "Analysis unavailable - safety status could not be determined"
    });
  }
});

// POST /api/analyze-pattern
router.post('/analyze-pattern', aiLimiter, async (req, res) => {
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
    const response = await groqHelper.callGroqAPI({
      endpoint: 'analyze-pattern',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the behavior pattern in this message sequence." }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      responseFormat: { type: "json_object" },
      isSafetyEndpoint: true
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    const parsed = JSON.parse(content);
    
    // Validate AI response structure
    if (typeof parsed.pattern_detected !== 'boolean' ||
        !['escalation', 'emotional_distress', 'aggression', 'none'].includes(parsed.pattern_type) ||
        !['low', 'medium', 'high'].includes(parsed.severity) ||
        typeof parsed.confidence !== 'number') {
      throw new Error("Invalid AI response structure");
    }
    
    res.status(200).json(parsed);
  } catch (error) {
    console.error("[Pattern Analysis] Server error:", error.message);
    // Fail-closed: return UNKNOWN when analysis is unavailable
    res.status(200).json({
      pattern_detected: false,
      pattern_type: "unknown",
      severity: "unknown",
      explanation: "Analysis unavailable - pattern could not be determined",
      confidence: 0
    });
  }
});

// POST /api/analyze-early-risk
router.post('/analyze-early-risk', aiLimiter, async (req, res) => {
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
    const response = await groqHelper.callGroqAPI({
      endpoint: 'analyze-early-risk',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the early risk in this message sequence." }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      responseFormat: { type: "json_object" },
      isSafetyEndpoint: true
    });

    const content = response?.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    
    const parsed = JSON.parse(content);
    
    // Validate AI response structure
    if (typeof parsed.early_risk !== 'boolean' ||
        !['emotional_build_up', 'frustration', 'confusion', 'suspicious', 'none'].includes(parsed.risk_type) ||
        !['low', 'medium', 'high'].includes(parsed.severity) ||
        typeof parsed.confidence !== 'number') {
      throw new Error("Invalid AI response structure");
    }
    
    res.status(200).json(parsed);
  } catch (error) {
    console.error("[Early Risk Analysis] Server error:", error.message);
    // Fail-closed: return UNKNOWN when analysis is unavailable
    res.status(200).json({
      early_risk: false,
      risk_type: "unknown",
      severity: "unknown",
      confidence: 0,
      explanation: "Predictive analysis unavailable - risk could not be determined"
    });
  }
});

module.exports = router;
