const POLICY_REASONS = {
  LOW_SCORE: 'LOW_SCORE',
  BAND_GATED: 'BAND_GATED',
  NO_ROUTING_CHANNEL: 'NO_ROUTING_CHANNEL',
};
// backend-v2/src/modules/godmode/services/brain.service.js

/**
 * Brain Service
 * ------------------------------------------------------------
 * Sorumluluklar:
 * - FAZ 3 AI üretimleri (3A–3E)
 * - Heuristic + LLM gating
 * - ai_artifacts persist
 * - job log event’leri
 *
 * NOT:
 * - HTTP / routing içermez
 * - Queue / trigger içermez
 */

const { logJobEvent } = require('../repo');
const {
  insertAiArtifact,
} = require('../repo');

// Helpers & generators are still sourced from godmode/service.js
// Bu dosya yalnızca orchestrator tarafından çağrılır.

async function runBrainPipeline({
  job,
  targets,
  generators,
}) {
  /**
   * generators parametresi:
   * {
   *   generateLeadRanking,
   *   generateAutoSwot,
   *   generateOutreachDraft,
   *   generateSalesEntryStrategy,
   *   generateChannelStrategy,
   * }
   */

  let rankingCount = 0;
  let swotCount = 0;
  let draftCount = 0;
  let salesCount = 0;
  let channelCount = 0;

  const rankingTop = [];
  const swotTop = [];
  const draftTop = [];
  const channelTop = [];

  for (const t of targets) {
    /**
     * FAZ 3.A — Lead Ranking
     */
    const ranking = await generators.generateLeadRanking(t);
    t.ai_score_band = ranking.ai_score_band;
    t.priority_score = ranking.priority_score;
    t.why_now = ranking.why_now || null;
    t.ideal_entry_channel = ranking.ideal_entry_channel || null;
    t.suggested_channel = ranking.ideal_entry_channel || null;
    rankingCount += 1;

    if (rankingTop.length < 10) {
      rankingTop.push({
        provider: t.provider,
        provider_id: t.provider_id,
        band: ranking.ai_score_band,
        score: ranking.priority_score,
      });
    }

    logJobEvent(job.id, 'AI_LEAD_RANKED', {
      provider: t.provider,
      provider_id: t.provider_id,
      result: ranking,
    });

    /**
     * FAZ 3.B — Auto-SWOT (opsiyonel)
     */
    let swot = null;
    if (generators.generateAutoSwot) {
      swot = await generators.generateAutoSwot({
        ...t,
        ai_score_band: ranking.ai_score_band,
      });
      swotCount += 1;

      if (swotTop.length < 10) {
        swotTop.push({
          provider: t.provider,
          provider_id: t.provider_id,
          summary: swot.summary || null,
        });
      }

      logJobEvent(job.id, 'AI_AUTO_SWOT_GENERATED', {
        provider: t.provider,
        provider_id: t.provider_id,
        result: swot,
      });
    }

    /**
     * A/B band gating
     */
    if (ranking.ai_score_band !== 'A' && ranking.ai_score_band !== 'B') {
      logJobEvent(job.id, 'AI_POLICY_BLOCK', {
        provider: t.provider,
        provider_id: t.provider_id,
        reason: POLICY_REASONS.BAND_GATED,
        band: ranking.ai_score_band,
      });
      continue;
    }

    /**
     * FAZ 3.C — Outreach Draft
     */
    const draft = await generators.generateOutreachDraft({
      ...t,
      ai_score_band: ranking.ai_score_band,
      auto_swot: swot,
    });
    draftCount += 1;

    if (draftTop.length < 10) {
      draftTop.push({
        provider: t.provider,
        provider_id: t.provider_id,
        channel: t.primary_channel || t.suggested_channel || draft.channel || null,
      });
    }

    logJobEvent(job.id, 'AI_OUTREACH_DRAFT_GENERATED', {
      provider: t.provider,
      provider_id: t.provider_id,
      result: draft,
    });

    const draftPersist = insertAiArtifact({
      jobId: job.id,
      leadId: null,
      provider: t.provider,
      providerId: String(t.provider_id),
      artifactType: 'outreach_draft_v1',
      artifact: draft,
    });

    if (draftPersist && draftPersist.ok) {
      logJobEvent(job.id, 'AI_OUTREACH_DRAFT_PERSISTED', {
        provider: t.provider,
        provider_id: t.provider_id,
      });
    } else {
      logJobEvent(job.id, 'AI_OUTREACH_DRAFT_PERSIST_ERROR', {
        provider: t.provider,
        provider_id: t.provider_id,
        reason: draftPersist && draftPersist.reason ? draftPersist.reason : 'UNKNOWN',
        error: draftPersist && draftPersist.error ? draftPersist.error : null,
      });
    }

    /**
     * FAZ 3.D — Sales Entry Strategy
     */
    const sales = await generators.generateSalesEntryStrategy({
      ...t,
      ai_score_band: ranking.ai_score_band,
      auto_swot: swot,
    });
    salesCount += 1;

    logJobEvent(job.id, 'AI_SALES_ENTRY_STRATEGY_GENERATED', {
      provider: t.provider,
      provider_id: t.provider_id,
      result: sales,
    });

    const salesPersist = insertAiArtifact({
      jobId: job.id,
      leadId: null,
      provider: t.provider,
      providerId: String(t.provider_id),
      artifactType: 'sales_entry_strategy_v1',
      artifact: sales,
    });

    if (salesPersist && salesPersist.ok) {
      logJobEvent(job.id, 'AI_SALES_ENTRY_STRATEGY_PERSISTED', {
        provider: t.provider,
        provider_id: t.provider_id,
      });
    } else {
      logJobEvent(job.id, 'AI_SALES_ENTRY_STRATEGY_PERSIST_ERROR', {
        provider: t.provider,
        provider_id: t.provider_id,
        reason: salesPersist && salesPersist.reason ? salesPersist.reason : 'UNKNOWN',
        error: salesPersist && salesPersist.error ? salesPersist.error : null,
      });
    }

    /**
     * FAZ 3.E — Channel Strategy
     */
    const channel = await generators.generateChannelStrategy({
      ...t,
      ai_score_band: ranking.ai_score_band,
      auto_swot: swot,
      sales_entry_strategy: sales,
    });
    t.primary_channel = channel.primary_channel || null;
    t.channel_confidence = channel.confidence || null;
    t.routing_channel = t.primary_channel || t.suggested_channel || null;
    channelCount += 1;
    if (!t.routing_channel) {
      logJobEvent(job.id, 'AI_POLICY_BLOCK', {
        provider: t.provider,
        provider_id: t.provider_id,
        reason: POLICY_REASONS.NO_ROUTING_CHANNEL,
      });
    }

    if (channelTop.length < 10) {
      channelTop.push({
        provider: t.provider,
        provider_id: t.provider_id,
        primary_channel: channel.primary_channel,
        confidence: channel.confidence,
      });
    }

    logJobEvent(job.id, 'AI_CHANNEL_STRATEGY_GENERATED', {
      provider: t.provider,
      provider_id: t.provider_id,
      result: {
        ...channel,
        routing_channel: t.routing_channel,
      },
    });

    const channelPersist = insertAiArtifact({
      jobId: job.id,
      leadId: null,
      provider: t.provider,
      providerId: String(t.provider_id),
      artifactType: 'channel_strategy_v1',
      artifact: channel,
    });

    if (channelPersist && channelPersist.ok) {
      logJobEvent(job.id, 'AI_CHANNEL_STRATEGY_PERSISTED', {
        provider: t.provider,
        provider_id: t.provider_id,
      });
    } else {
      logJobEvent(job.id, 'AI_CHANNEL_STRATEGY_PERSIST_ERROR', {
        provider: t.provider,
        provider_id: t.provider_id,
        reason: channelPersist && channelPersist.reason ? channelPersist.reason : 'UNKNOWN',
        error: channelPersist && channelPersist.error ? channelPersist.error : null,
      });
    }
  }

  /**
   * DONE events (summary)
   */
  logJobEvent(job.id, 'AI_LEAD_RANKING_DONE', {
    count: rankingCount,
    top: rankingTop,
  });

  if (swotCount > 0) {
    logJobEvent(job.id, 'AI_AUTO_SWOT_DONE', {
      count: swotCount,
      top: swotTop,
    });
  }

  logJobEvent(job.id, 'AI_OUTREACH_DRAFT_DONE', {
    count: draftCount,
    top: draftTop,
  });

  logJobEvent(job.id, 'AI_SALES_ENTRY_STRATEGY_DONE', {
    count: salesCount,
  });

  logJobEvent(job.id, 'AI_CHANNEL_STRATEGY_DONE', {
    count: channelCount,
    top: channelTop,
  });

  return {
    rankingCount,
    swotCount,
    draftCount,
    salesCount,
    channelCount,
  };
}

module.exports = {
  runBrainPipeline,
};