/**
 * Reports Routes
 * Handles full report generation endpoint
 */

const express = require('express');
const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimit');
const { requireParentAuth } = require('../middleware/auth');
const { validateBody } = require('../validation/middleware');
const { callGroqAPI } = require('../lib/groqHelper');

// POST /api/generate-full-report
router.post('/generate-full-report', requireParentAuth, aiLimiter, validateBody('generateFullReport'), async (req, res) => {
  const { allData } = req.body;

  const { extractedData, childName = "Alex" } = allData;

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
    const response = await callGroqAPI({
      endpoint: 'generate-full-report',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the full developmental report." }
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
    console.error("[Full Report] Server error:", error.message);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
