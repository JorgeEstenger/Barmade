/**
 * PostgreSQL (Neon) connection.
 *
 * Enabled when DATABASE_URL is set; otherwise the app keeps using the
 * in-memory store. Every service call runs inside ONE transaction (see
 * data/persistence.js), so an order, its stock changes, movements and alerts
 * are committed together or not at all.
 *
 * Writes are serialized with a transaction-level advisory lock: two orders can
 * never both pass the stock check and then spend the same stock.
 */

const { AsyncLocalStorage } = require('node:async_hooks');

const enabled = Boolean(process.env.DATABASE_URL);
const transactionClient = new AsyncLocalStorage();
const LOCK_KEY = 20261007;
let pool;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_SIZE || 5),
      // Neon suspends idle computes; reconnect instead of keeping stale sockets.
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));
  }
  return pool;
}

/** Run a query on the current transaction's connection (or the pool). */
function query(text, params) {
  return (transactionClient.getStore() || getPool()).query(text, params);
}

/** Run `task` in a transaction. Nested calls join the outer transaction. */
async function transaction(task) {
  if (transactionClient.getStore()) return task();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const result = await transactionClient.run(client, task);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS inventory (
  id   text PRIMARY KEY,
  key  text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS menu (
  id   text PRIMARY KEY,
  key  text,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id            text PRIMARY KEY,
  business_date text NOT NULL,
  channel       text NOT NULL,
  placed_at     text NOT NULL,
  data          jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_business_date ON orders (business_date);
CREATE TABLE IF NOT EXISTS movements (
  id            text PRIMARY KEY,
  ingredient_id text NOT NULL,
  reason        text NOT NULL,
  order_id      text,
  business_date text NOT NULL,
  change        double precision NOT NULL,
  data          jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS movements_business_date ON movements (business_date);
CREATE INDEX IF NOT EXISTS movements_ingredient ON movements (ingredient_id);
CREATE INDEX IF NOT EXISTS movements_order ON movements (order_id);
CREATE TABLE IF NOT EXISTS alerts (
  id         text PRIMARY KEY,
  type       text NOT NULL,
  status     text NOT NULL,
  created_at text NOT NULL,
  data       jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_meta (
  id   int PRIMARY KEY DEFAULT 1,
  data jsonb NOT NULL
);
CREATE SEQUENCE IF NOT EXISTS order_seq;
CREATE SEQUENCE IF NOT EXISTS movement_seq;
CREATE SEQUENCE IF NOT EXISTS alert_seq;
`;

async function ensureSchema() {
  await query(SCHEMA);
}

/** Next number of a sequence, formatted like ORD-07320 (never truncated). */
async function nextId(sequence, prefix, width) {
  const { rows } = await query(`SELECT nextval('${sequence}') AS n`);
  return `${prefix}-${String(rows[0].n).padStart(width, '0')}`;
}

async function close() {
  if (pool) await pool.end();
  pool = undefined;
}

module.exports = { enabled, query, transaction, ensureSchema, nextId, close };
