/**
 * Inventory movement data access - PostgreSQL version. Append-only.
 */

const db = require('../../data/db');
const { where, dataOf } = require('./helpers');

const COLUMNS = `(id, ingredient_id, reason, order_id, business_date, change, data)
  SELECT x->>'id', x->>'ingredient_id', x->>'reason', x->>'order_id', x->>'business_date', (x->>'change')::float8, x
    FROM jsonb_array_elements($1::jsonb) x`;

/** Insert already-numbered movements (used when seeding). */
async function insertMany(movements) {
  if (movements.length) await db.query(`INSERT INTO movements ${COLUMNS}`, [JSON.stringify(movements)]);
}

/** Save several movements at once, assigning IDs (MOV-000001, ...). */
async function createMany(movements) {
  if (movements.length === 0) return [];
  const { rows } = await db.query("SELECT nextval('movement_seq') AS n FROM generate_series(1, $1)", [movements.length]);
  const saved = movements.map((m, i) => ({ id: `MOV-${String(rows[i].n).padStart(6, '0')}`, ...m }));
  await insertMany(saved);
  return saved;
}

function filterSql(f) {
  return where([
    ['ingredient_id', '=', f.ingredientId],
    ['reason', '=', f.reason],
    ['order_id', '=', f.orderId],
    ['business_date', '=', f.date],
    ['business_date', '>=', f.from],
    ['business_date', '<=', f.to],
  ]);
}

/** Filtered, paginated movements, newest first, plus a total per reason. */
async function find(filter = {}, { limit = 100, offset = 0 } = {}) {
  const { sql, params } = filterSql(filter);
  const grouped = await db.query(
    `SELECT reason, count(*)::int AS count, sum(change) AS change FROM movements ${sql} GROUP BY reason`, params);
  const byReason = {};
  let total = 0;
  for (const r of grouped.rows) {
    byReason[r.reason] = { count: r.count, change: r.change };
    total += r.count;
  }
  const page = await db.query(
    `SELECT data FROM movements ${sql} ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { total, byReason, data: dataOf(page) };
}

/** Units consumed per ingredient between two business dates (inclusive). Map id -> amount. */
async function sumConsumption({ from, to, reasons }) {
  const { rows } = await db.query(
    `SELECT ingredient_id, -sum(change) AS amount FROM movements
      WHERE business_date >= $1 AND business_date <= $2 AND reason = ANY($3)
      GROUP BY ingredient_id`,
    [from, to, reasons]
  );
  return new Map(rows.map((r) => [r.ingredient_id, r.amount]));
}

module.exports = { createMany, insertMany, find, sumConsumption };
