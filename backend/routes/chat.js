/**
 * Chat Routes
 * Handles AI chat endpoint
 */

const express = require('express');
const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimit');
const { validateBody } = require('../validation/middleware');
const { callGroqAPI } = require('../lib/groqHelper');

// POST /api/chat
router.post('/', aiLimiter, validateBody('chat'), async (req, res) => {
  const { messages, model } = req.body;

  try {
    const response = await callGroqAPI({
      endpoint: 'chat',
      messages,
      model: model || "llama-3.1-8b-instant",
      isSafetyEndpoint: false
    });

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
