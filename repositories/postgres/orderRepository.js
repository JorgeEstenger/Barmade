/**
 * Order data access - PostgreSQL version.
 */

const db = require('../../data/db');
const { where, dataOf } = require('./helpers');

function filterSql({ date, from, to, channel } = {}) {
  return where([
    ['business_date', '=', date],
    ['business_date', '>=', from],
    ['business_date', '<=', to],
    ['channel', '=', channel],
  ]);
}

/** Newest orders first. */
async function findAll() {
  return dataOf(await db.query('SELECT data FROM orders ORDER BY placed_at DESC, id DESC'));
}

/** Filtered, paginated orders (newest first). */
async function find(filter = {}, { limit = 100, offset = 0 } = {}) {
  const { sql, params } = filterSql(filter);
  const total = await db.query(`SELECT count(*)::int AS n FROM orders ${sql}`, params);
  const page = await db.query(
    `SELECT data FROM orders ${sql} ORDER BY placed_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { total: total.rows[0].n, data: dataOf(page) };
}

async function findById(id) {
  const { rows } = await db.query('SELECT data FROM orders WHERE id = $1', [id]);
  return rows.length ? rows[0].data : null;
}

/** Light copies for reports (no `consumed` detail), oldest first. */
async function findSummaries(filter = {}) {
  const { sql, params } = filterSql(filter);
  const { rows } = await db.query(
    `SELECT id, channel, placed_at, business_date,
            COALESCE(data->'gross_total', data->'total') AS gross_total,
            COALESCE(data->'channel_fee', '0'::jsonb) AS channel_fee,
            COALESCE(data->'net_total', data->'total') AS net_total,
            (SELECT jsonb_agg(jsonb_build_object(
                'menuItemId', i->'menuItemId', 'item_id', COALESCE(i->'item_id', i->'menuItemId'),
                'name', i->'name', 'quantity', i->'quantity', 'lineTotal', i->'lineTotal'))
               FROM jsonb_array_elements(data->'items') i) AS items
       FROM orders ${sql} ORDER BY placed_at, id`,
    params
  );
  return rows;
}

/** Save a new order and assign its ID (ORD-07320, ...). */
async function create(order) {
  const saved = { id: await db.nextId('order_seq', 'ORD', 5), ...order };
  await db.query(
    'INSERT INTO orders (id, business_date, channel, placed_at, data) VALUES ($1, $2, $3, $4, $5)',
    [saved.id, saved.business_date, saved.channel, saved.placed_at, saved]
  );
  return saved;
}

module.exports = { findAll, find, findById, findSummaries, create };
