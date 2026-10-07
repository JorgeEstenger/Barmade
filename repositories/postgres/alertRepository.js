/**
 * Alert data access - PostgreSQL version.
 */

const db = require('../../data/db');
const { dataOf } = require('./helpers');

/** Alerts matching every provided field, e.g. find({ type: 'LOW_STOCK', status: 'ACTIVE' }). */
async function find(filter = {}) {
  const match = Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined));
  return dataOf(await db.query('SELECT data FROM alerts WHERE data @> $1::jsonb ORDER BY id', [JSON.stringify(match)]));
}

/** Save a new alert and assign its ID (ALERT-001, ...). */
async function create(alert) {
  const saved = { id: await db.nextId('alert_seq', 'ALERT', 3), ...alert };
  await db.query(
    'INSERT INTO alerts (id, type, status, created_at, data) VALUES ($1, $2, $3, $4, $5)',
    [saved.id, saved.type, saved.status, saved.createdAt, saved]
  );
  return saved;
}

async function update(id, changes) {
  const { rows } = await db.query(
    `UPDATE alerts SET data = data || $2::jsonb, status = COALESCE($2::jsonb->>'status', status)
      WHERE id = $1 RETURNING data`,
    [id, JSON.stringify(changes)]
  );
  return rows.length ? rows[0].data : null;
}

module.exports = { find, create, update };
