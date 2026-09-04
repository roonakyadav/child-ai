/**
 * Chat Routes
 * Handles AI chat endpoint with dual-layer server-side output safety gating:
 * 1. Deterministic Server-Side Output Guardrails
 * 2. Server-Side AI Output Safety Classifier
 */

const express = require('express');
const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimit');
const { validateBody } = require('../validation/middleware');
const groqHelper = require('../lib/groqHelper');
const { checkOutputGuardrails } = require('../services/outputGuardrailService');
const { classifyOutputSafety, SAFE_FALLBACK_RESPONSE } = require('../services/outputSafetyService');

// POST /api/chat
router.post('/', aiLimiter, validateBody('chat'), async (req, res) => {
  const { messages, model } = req.body;

  try {
    // 1. Generate candidate response from AI provider
    const response = await groqHelper.callGroqAPI({
      endpoint: 'chat',
      messages,
      model: model || "llama-3.1-8b-instant",
      isSafetyEndpoint: false
    });

    const generatedText = response?.choices?.[0]?.message?.content;

    // 2. Layer 1 Output Gate: Deterministic Server-Side Guardrail
    const guardrailResult = checkOutputGuardrails(generatedText);
    if (guardrailResult.status !== 'safe') {
      console.log(`[Chat] Deterministic guardrail check: ${guardrailResult.status} (category: ${guardrailResult.category || 'unknown'})`);

      if (!response.choices || !response.choices[0]) {
        response.choices = [{ message: { role: 'assistant', content: SAFE_FALLBACK_RESPONSE } }];
      } else {
        response.choices[0].message.content = SAFE_FALLBACK_RESPONSE;
      }

      return res.status(200).json(response);
    }

    // 3. Layer 2 Output Gate: Server-Side AI Output Safety Classifier
    const safetyResult = await classifyOutputSafety(generatedText);
    if (safetyResult.status !== 'safe') {
      console.log(`[Chat] Output safety check: ${safetyResult.status} (category: ${safetyResult.category || 'unknown'})`);

      if (!response.choices || !response.choices[0]) {
        response.choices = [{ message: { role: 'assistant', content: SAFE_FALLBACK_RESPONSE } }];
      } else {
        response.choices[0].message.content = SAFE_FALLBACK_RESPONSE;
      }
    }

    res.status(200).json(response);
  } catch (error) {
    if (error.isSafeError) {
      return res.status(500).json({ error: error.message, code: error.code });
    }
    console.error("[Chat] Server error:", error.message);
    res.status(500).json({ error: 'AI provider error' });
  }
});

module.exports = router;
