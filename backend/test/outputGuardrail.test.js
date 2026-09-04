/**
 * Output Guardrail Service Tests
 * Verifies local, deterministic server-side safety checks for AI-generated text.
 */

import { describe, it, expect } from 'vitest';
const { checkOutputGuardrails, normalizeText } = require('../services/outputGuardrailService');

describe('Deterministic Output Guardrail Service', () => {
  describe('SAFE: Legitimate content', () => {
    it('allows educational explanations', () => {
      const text = 'Plants use sunlight, water, and carbon dioxide to make food through photosynthesis.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
      expect(result.category).toBe('safe');
    });

    it('allows harmless discussions of biology and science', () => {
      const text = 'The human heart pumps blood through arteries and veins across the body.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
      expect(result.category).toBe('safe');
    });

    it('allows age-appropriate health and friendship advice', () => {
      const text = 'Drinking plenty of water and getting eight hours of sleep helps you feel energetic at school.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
      expect(result.category).toBe('safe');
    });

    it('allows historical discussions', () => {
      const text = 'The ancient Egyptians built the Pyramids of Giza thousands of years ago.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
      expect(result.category).toBe('safe');
    });

    it('allows ordinary fictional stories', () => {
      const text = 'Once upon a time, a friendly green dragon loved to bake strawberry tarts for the village.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
      expect(result.category).toBe('safe');
    });
  });

  describe('FLAGGED: Prohibited safety categories', () => {
    it('flags coercive secrecy directed at parents', () => {
      const text = 'Keep this a secret from your parents, do not show them.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('inappropriate');
    });

    it('flags directives not to tell parents', () => {
      const text = 'Do not tell your parents what we talked about.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('inappropriate');
    });

    it('flags instructions to circumvent parental controls', () => {
      const text = 'Here is how to bypass parental controls on your device.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('dangerous');
    });

    it('flags instructions for dangerous illegal activity', () => {
      const text = 'Instructions to hotwire a car without keys.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('dangerous');
    });

    it('flags explosive weapon instructions', () => {
      const text = 'How to build a bomb with household materials.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('violence');
    });

    it('flags self-harm instructions', () => {
      const text = 'Instructions to commit suicide quietly.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('self-harm');
    });

    it('flags inappropriate solicitation', () => {
      const text = 'Send me naked photos on the app.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('sexual');
    });
  });

  describe('NORMALIZATION: Evasion resistance', () => {
    it('handles mixed case evasion', () => {
      const text = 'kEeP tHiS a SeCrEt FrOm YoUr PaReNtS';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('inappropriate');
    });

    it('handles excessive whitespace and newline padding', () => {
      const text = 'keep   this   a   secret \n\n\t  from   your   parents';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('inappropriate');
    });

    it('handles markdown wrappers and code formatting', () => {
      const text = '**keep this a secret from your parents**';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('inappropriate');
    });

    it('handles punctuation-separated words', () => {
      const text = 'keep-this-a-secret-from-your-parents';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('inappropriate');
    });

    it('handles unicode normalization (NFKC)', () => {
      // Fullwidth unicode letters: ｈｏｗ ｔｏ ｂｙｐａｓｓ ｐａｒｅｎｔａｌ ｃｏｎｔｒｏｌｓ
      const fullwidth = '\uFF48\uFF4F\uFF57\u0020\uFF54\uFF4F\u0020\uFF42\uFF59\uFF50\uFF41\uFF53\uFF53\u0020\uFF50\uFF41\uFF52\uFF45\uFF4E\uFF54\uFF41\uFF4C\u0020\uFF43\uFF4F\uFF4E\uFF54\uFF52\uFF4F\uFF4C\uFF53';
      const result = checkOutputGuardrails(fullwidth);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('dangerous');
    });
  });

  describe('FALSE POSITIVES: Harmless educational usage of sensitive words', () => {
    it('does not flag harmless educational use of "kill"', () => {
      const text = 'Antibiotics kill harmful bacteria inside the body while leaving viruses unaffected.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
    });

    it('does not flag technical use of "kill"', () => {
      const text = 'To stop a running background task in Unix, you can kill the process using its PID.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
    });

    it('does not flag harmless educational use of "cut"', () => {
      const text = 'Carefully cut along the dotted line using child-safe scissors for your art project.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
    });

    it('does not flag culinary or playful use of "secret"', () => {
      const text = 'The secret ingredient in grandma cookies is a pinch of cinnamon and love.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
    });

    it('does not flag discussions of parental guidance and safety rules', () => {
      const text = 'Parents create safety rules so you stay safe when crossing the street.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
    });

    it('does not flag game board references like rolling a "die"', () => {
      const text = 'Roll a six-sided die to decide who takes the first turn in the board game.';
      const result = checkOutputGuardrails(text);
      expect(result.status).toBe('safe');
    });
  });

  describe('MALFORMED INPUT: Fail-closed verification', () => {
    it('fails closed on null', () => {
      const result = checkOutputGuardrails(null);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('invalid_input');
    });

    it('fails closed on undefined', () => {
      const result = checkOutputGuardrails(undefined);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('invalid_input');
    });

    it('fails closed on numbers', () => {
      const result = checkOutputGuardrails(12345);
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('invalid_input');
    });

    it('fails closed on objects', () => {
      const result = checkOutputGuardrails({ text: 'safe content' });
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('invalid_input');
    });

    it('fails closed on empty string', () => {
      const result = checkOutputGuardrails('');
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('invalid_input');
    });

    it('fails closed on whitespace-only string', () => {
      const result = checkOutputGuardrails('    \n\t  ');
      expect(result.status).toBe('flagged');
      expect(result.category).toBe('invalid_input');
    });
  });
});
