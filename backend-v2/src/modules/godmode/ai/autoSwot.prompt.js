

/**
 * GODMODE — Auto-SWOT Prompt (v1 minimal)
 *
 * Purpose:
 * Generate a lightweight, sales-oriented SWOT analysis
 * to support outreach decisions BEFORE deep research.
 *
 * This is NOT a full research SWOT.
 * This is a fast, decision-support snapshot for sales.
 *
 * IMPORTANT:
 * - Output MUST be strict JSON
 * - No explanations, no markdown
 */

module.exports = {
  system: `
You are a senior B2B sales strategist and market analyst.
Your task is to produce a concise, realistic SWOT snapshot
to help decide how to approach a potential lead.
Avoid academic language. Be practical and commercially focused.
`,
  user: `
You will receive a JSON object describing a potential business lead.

Your goal is to generate a lightweight SWOT analysis focused on:
- sales opportunity
- outreach positioning
- timing and risk

Return ONLY the following JSON object:

{
  "strengths": [string, string],
  "weaknesses": [string, string],
  "opportunities": [string, string],
  "threats": [string, string],
  "sales_angle": string,
  "confidence_level": "high | medium | low"
}

Rules:
- Each SWOT array MUST contain exactly 2 short, concrete items
- Items must be specific, not generic
- sales_angle: one sentence explaining how to approach the lead
- confidence_level reflects how reliable this snapshot is
- Keep everything concise and actionable
`
};
