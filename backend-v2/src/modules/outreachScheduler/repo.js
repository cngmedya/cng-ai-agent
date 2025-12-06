// backend-v2/src/modules/outreachScheduler/repo.js
const { getDb } = require('../../core/db');

/**
 * sequence: [
 *  { step, type, send_after_hours, message, subject? }
 * ]
 */
async function createJobsFromSequence({ leadId, channel, sequence }) {
  const db = await getDb();
  const jobs = [];

  for (const item of sequence) {
    await db.run(
      `
      INSERT INTO outreach_sequence_jobs
        (lead_id, channel, step, type, send_after_hours, subject, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `,
      [
        leadId,
        channel,
        item.step,
        item.type,
        item.send_after_hours,
        item.subject || null,
        item.message,
      ]
    );

    const row = await db.get('SELECT last_insert_rowid() as id');
    jobs.push({
      id: row.id,
      lead_id: leadId,
      channel,
      step: item.step,
      type: item.type,
      send_after_hours: item.send_after_hours,
      subject: item.subject || null,
      message: item.message,
      status: 'pending',
    });
  }

  return jobs;
}

module.exports = {
  createJobsFromSequence,
};