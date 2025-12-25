

/**
 * GODMODE — AI Lead Ranking Output Schema (v1 minimal)
 *
 * This schema validates the strict JSON response returned by the LLM.
 * Any deviation should be treated as a hard error.
 */

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: [
    'ai_score_band',
    'priority_score',
    'why_now',
    'ideal_entry_channel',
  ],
  properties: {
    ai_score_band: {
      type: 'string',
      enum: ['A', 'B', 'C'],
      description: 'Priority band of the lead',
    },
    priority_score: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Numeric priority score aligned with the band',
    },
    why_now: {
      type: 'string',
      minLength: 5,
      maxLength: 240,
      description: 'Concrete reason why the lead should be contacted now',
    },
    ideal_entry_channel: {
      type: 'string',
      enum: ['email', 'whatsapp', 'instagram', 'phone'],
      description: 'Most realistic first contact channel',
    },
  },
};