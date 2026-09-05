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
const logger = require('../lib/logger');
const { checkOutputGuardrails } = require('../services/outputGuardrailService');
const { classifyOutputSafety, SAFE_FALLBACK_RESPONSE } = require('../services/outputSafetyService');
const configService = require('../services/configService');

// POST /api/chat
router.post('/', aiLimiter, validateBody('chat'), async (req, res) => {
  const { messages, model } = req.body;

  try {
    // 0. Enforce server-authoritative parental controls
    const parentConfig = configService.getParentConfig();
    if (parentConfig?.screenTime?.isLocked) {
      return res.status(403).json({
        error: 'App is currently locked by parent',
        code: 'APP_LOCKED'
      });
    }

    // Enforce server-authoritative safety constraints and parent guidelines
    let enrichedMessages = messages;
    if (parentConfig?.aiBehavior) {
      const directives = [];
      const { strictMode, safetyLevel, toggles, customInstructions, parentPolicies } = parentConfig.aiBehavior;
      if (strictMode || safetyLevel === 'strict' || toggles?.strictFiltering) {
        directives.push('SAFETY: Politely and naturally redirect unsafe or adult topics to safe educational subjects.');
      }
      if (customInstructions && customInstructions.trim()) {
        directives.push(`PARENT GUIDELINES: ${customInstructions.trim()}`);
      }
      if (Array.isArray(parentPolicies) && parentPolicies.length > 0) {
        directives.push(`PARENT RULES:\n${parentPolicies.map(p => `- ${p}`).join('\n')}`);
      }

      if (directives.length > 0) {
        const directiveBlock = `\n\n[AUTHORITATIVE PARENT POLICY]:\n${directives.join('\n')}`;
        enrichedMessages = messages.map((m, idx) => {
          if (idx === 0 && m.role === 'system') {
            return { ...m, content: `${m.content}${directiveBlock}` };
          }
          return m;
        });
        if (!enrichedMessages.some(m => m.role === 'system')) {
          enrichedMessages = [
            { role: 'system', content: `You are a safe, educational AI for children.${directiveBlock}` },
            ...enrichedMessages
          ];
        }
      }
    }

    // 1. Generate candidate response from AI provider
    const response = await groqHelper.callGroqAPI({
      endpoint: 'chat',
      messages: enrichedMessages,
      model: model || "llama-3.1-8b-instant",
      isSafetyEndpoint: false
    });

    const generatedText = response?.choices?.[0]?.message?.content;

    // 2. Layer 1 Output Gate: Deterministic Server-Side Guardrail
    const guardrailResult = checkOutputGuardrails(generatedText);
    if (guardrailResult.status !== 'safe') {
      logger.info('chat.guardrail.checked', {
        requestId: req.id,
        status: guardrailResult.status,
        category: guardrailResult.category || 'unknown'
      });

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
      logger.info('chat.output_safety.checked', {
        requestId: req.id,
        status: safetyResult.status,
        category: safetyResult.category || 'unknown'
      });

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
    logger.error('chat.request.failed', {
      requestId: req.id,
      errorName: error.name || 'Error'
    });
    res.status(500).json({ error: 'AI provider error' });
  }
});

module.exports = router;
