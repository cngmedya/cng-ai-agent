

module.exports = {
  type: 'object',
  additionalProperties: false,
  required: [
    'ideal_channel',
    'tone',
    'quick_wins',
    'red_flags',
    'next_steps'
  ],
  properties: {
    ideal_channel: {
      type: 'string',
      enum: ['email', 'whatsapp', 'instagram', 'phone'],
      description: 'Best initial sales contact channel'
    },
    tone: {
      type: 'string',
      enum: ['kurumsal', 'samimi', 'premium'],
      description: 'Recommended communication tone'
    },
    quick_wins: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 160
      },
      description: 'Immediate value opportunities to mention'
    },
    red_flags: {
      type: 'array',
      minItems: 0,
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 160
      },
      description: 'Potential risks or objections to watch out for'
    },
    next_steps: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'string',
        minLength: 3,
        maxLength: 160
      },
      description: 'Concrete follow-up steps for the sales process'
    }
  }
};