

/**
 * GODMODE — Auto-SWOT Output Schema (v1 minimal)
 *
 * Validates the strict JSON response returned by the LLM
 * for lightweight, sales-oriented SWOT snapshots.
 */

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: [
    'strengths',
    'weaknesses',
    'opportunities',
    'threats',
    'sales_angle',
    'confidence_level',
  ],
  properties: {
    strengths: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 120,
      },
      description: 'Key internal strengths relevant for sales positioning',
    },
    weaknesses: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 120,
      },
      description: 'Key internal weaknesses impacting outreach',
    },
    opportunities: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 120,
      },
      description: 'External opportunities that can be leveraged',
    },
    threats: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 120,
      },
      description: 'External risks or threats affecting conversion',
    },
    sales_angle: {
      type: 'string',
      minLength: 10,
      maxLength: 240,
      description: 'One-sentence guidance on how to approach the lead',
    },
    confidence_level: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Confidence level of the SWOT snapshot',
    },
  },
};