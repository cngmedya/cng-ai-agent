

/**
 * GODMODE — Outreach Draft Output Schema (v1 minimal)
 *
 * Validates the strict JSON response returned by the LLM
 * for a single outreach opening message draft.
 *
 * Scope:
 * - 1 suggested channel
 * - 1 opening message
 * - 1 CTA
 * - optional subject (email only)
 */

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: [
    'suggested_channel',
    'opening_message',
    'cta',
    'language',
    'tone',
    'confidence_level',
  ],
  properties: {
    suggested_channel: {
      type: 'string',
      enum: ['email', 'whatsapp', 'instagram_dm'],
      description: 'Preferred entry channel for the first contact',
    },
    opening_message: {
      type: 'string',
      minLength: 40,
      maxLength: 800,
      description: 'Single opening message to send to the lead',
    },
    cta: {
      type: 'string',
      minLength: 6,
      maxLength: 140,
      description: 'Single call-to-action line (e.g., ask for a short call)',
    },
    subject: {
      anyOf: [
        { type: 'string', minLength: 6, maxLength: 140 },
        { type: 'null' },
      ],
      description: 'Email subject (null for non-email channels)',
    },
    language: {
      type: 'string',
      enum: ['tr', 'en'],
      description: 'Language code for the message',
    },
    tone: {
      type: 'string',
      enum: ['kurumsal', 'samimi', 'premium'],
      description: 'Tone guideline for the message',
    },
    personalization_hooks: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 120,
      },
      description: 'Up to 3 concrete hooks used for personalization',
    },
    confidence_level: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Confidence level of the draft based on available signals',
    },
  },
};