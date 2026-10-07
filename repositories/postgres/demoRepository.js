/**
 * Demo dataset storage - PostgreSQL version: bulk load, counts and metadata.
 */

const db = require('../../data/db');
const movementRepository = require('./movementRepository');

const CHUNK = 4000;

async function insertJson(table, columns, select, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.query(
      `INSERT INTO ${table} ${columns} SELECT ${select} FROM jsonb_array_elements($1::jsonb) x`,
      [JSON.stringify(rows.slice(i, i + CHUNK))]
    );
  }
}

const maxNumber = (records) => records.reduce((max, r) => Math.max(max, Number.parseInt(r.id.split('-')[1], 10) || 0), 0);

async function setSequence(name, value) {
  await db.query('SELECT setval($1::regclass, $2, $3)', [name, Math.max(value, 1), value > 0]);
}

/** Replace every table's content with the given dataset. */
async function replaceAll({ inventory, menu, orders, movements, alerts }) {
  await db.query('TRUNCATE inventory, menu, orders, movements, alerts');
  await insertJson('inventory', '(id, key, data)', "x->>'id', x->>'key', x", inventory);
  await insertJson('menu', '(id, key, data)', "x->>'id', x->>'key', x", menu);
  await insertJson('orders', '(id, business_date, channel, placed_at, data)',
    "x->>'id', x->>'business_date', COALESCE(x->>'channel', 'dine_in'), COALESCE(x->>'placed_at', x->>'createdAt'), x", orders);
  for (let i = 0; i < movements.length; i += CHUNK) await movementRepository.insertMany(movements.slice(i, i + CHUNK));
  await insertJson('alerts', '(id, type, status, created_at, data)', "x->>'id', x->>'type', x->>'status', x->>'createdAt', x", alerts);
  await setSequence('order_seq', maxNumber(orders));
  await setSequence('movement_seq', maxNumber(movements));
  await setSequence('alert_seq', maxNumber(alerts));
}

async function counts() {
  const { rows } = await db.query(`SELECT
    (SELECT count(*)::int FROM inventory) AS ingredients,
    (SELECT count(*)::int FROM menu) AS menu_items,
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM movements) AS inventory_movements,
    (SELECT count(*)::int FROM alerts WHERE status = 'ACTIVE') AS active_alerts`);
  return rows[0];
}

async function getMeta() {
  const { rows } = await db.query('SELECT data FROM demo_meta WHERE id = 1');
  return rows.length ? rows[0].data : null;
}

async function saveMeta(meta) {
  await db.query('INSERT INTO demo_meta (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [meta]);
}

module.exports = { replaceAll, counts, getMeta, saveMeta };
