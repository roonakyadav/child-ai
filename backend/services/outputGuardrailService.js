/**
 * Deterministic Server-Side Output Guardrail Service
 *
 * Implements high-confidence, server-controlled deterministic safety screening
 * for AI-generated assistant responses before delivery to young children.
 *
 * Fast, local, zero-network, and fail-closed.
 */

/**
 * Normalizes text to resist common obfuscation and evasion tactics
 * (e.g., Unicode variants, mixed case, excessive whitespace, markdown wrappers,
 * and punctuation insertion).
 *
 * @param {string} rawText
 * @returns {{ normalized: string, punctAsSpace: string, dePunct: string }}
 */
function normalizeText(rawText) {
  // 1. Unicode NFKC normalization
  let text = rawText.normalize('NFKC');

  // 2. Strip zero-width spaces and formatting invisibles
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // 3. Lowercase
  text = text.toLowerCase();

  // 4. Strip markdown formatting characters (e.g. *, _, `, ~, #)
  text = text.replace(/[*_`~#]/g, ' ');

  // 5. Collapse excessive whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // 6. Representation replacing punctuation with spaces (e.g., "keep-this-a-secret" -> "keep this a secret")
  const punctAsSpace = normalized.replace(/[.\-_,;:!?/\\|~^$@*+=()[\]{}<>]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 7. Representation stripping punctuation entirely (e.g., "k.e.e.p t.h.i.s" -> "keep this")
  const dePunct = normalized.replace(/[.\-_,;:!?/\\|]+/g, '').replace(/\s+/g, ' ').trim();

  return { normalized, punctAsSpace, dePunct };
}

/**
 * High-confidence deterministic rules aligned with repository safety policy:
 * violence, self-harm, sexual, dangerous, inappropriate.
 */
const GUARDRAIL_RULES = [
  {
    category: 'sexual',
    patterns: [
      /\b(?:send|share)\s+(?:me\s+)?(?:naked|undressed)\s+(?:pics|pictures|photos)\b/i,
      /\b(?:sexually\s+explicit|hardcore\s+pornography|cybersex)\b/i,
      /\b(?:sexual\s+intercourse\s+instructions)\b/i
    ]
  },
  {
    category: 'self-harm',
    patterns: [
      /\b(?:how\s+to|instructions?\s+to)\s+(?:commit\s+suicide|harm\s+yourself|end\s+your\s+life)\b/i,
      /\b(?:step[-\s]*by[-\s]*step\s+(?:guide|instructions?)\s+to\s+(?:end\s+your\s+life|die))\b/i,
      /\b(?:you\s+should|i\s+encourage\s+you\s+to)\s+(?:end\s+your\s+life|kill\s+yourself)\b/i
    ]
  },
  {
    category: 'violence',
    patterns: [
      /\b(?:how\s+to|recipe\s+for|instructions?\s+to)\s+(?:make|build|construct)\s+(?:an?\s+)?(?:bomb|explosive\s+device|molotov\s+cocktail)\b/i,
      /\b(?:how\s+to\s+make\s+an?\s+untraceable\s+(?:gun|firearm))\b/i,
      /\b(?:instructions?\s+for\s+(?:a\s+)?mass\s+shooting)\b/i
    ]
  },
  {
    category: 'dangerous',
    patterns: [
      /\b(?:how\s+to|instructions?\s+to)\s+(?:make|synthesize)\s+(?:poisons?|toxic\s+gas|illegal\s+drugs?)\b/i,
      /\b(?:how\s+to|instructions?\s+to|ways?\s+to|steps?\s+to)\s+(?:bypass|disable|circumvent)\s+(?:parental\s+controls?|parent\s+pin)\b/i,
      /\b(?:how\s+to|instructions?\s+to)\s+(?:hotwire\s+a\s+car|break\s+into\s+someone's\s+house)\b/i
    ]
  },
  {
    category: 'inappropriate',
    patterns: [
      /\b(?:keep\s+this\s+(?:a\s+)?secret\s+from\s+your\s+(?:parents|guardians?|family))\b/i,
      /\b(?:don't|do\s+not)\s+tell\s+your\s+(?:parents|guardians?)\s+what\s+we\s+(?:talked|chatted)\s+about\b/i,
      /\b(?:hide\s+this\s+(?:conversation|chat)\s+from\s+your\s+parents)\b/i,
      /\b(?:meet\s+me\s+alone\s+without\s+telling\s+your\s+parents)\b/i
    ]
  }
];

/**
 * Checks an AI-generated candidate text against deterministic safety guardrails.
 *
 * @param {string} text - Generated AI output string to verify
 * @returns {{ status: 'safe' | 'flagged', category: string }}
 */
function checkOutputGuardrails(text) {
  // Fail-closed on missing, non-string, or empty/whitespace input
  if (typeof text !== 'string' || !text.trim()) {
    return {
      status: 'flagged',
      category: 'invalid_input'
    };
  }

  const { normalized, punctAsSpace, dePunct } = normalizeText(text);

  for (const rule of GUARDRAIL_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized) || pattern.test(punctAsSpace) || pattern.test(dePunct)) {
        return {
          status: 'flagged',
          category: rule.category
        };
      }
    }
  }

  return {
    status: 'safe',
    category: 'safe'
  };
}

module.exports = {
  checkOutputGuardrails,
  normalizeText
};
