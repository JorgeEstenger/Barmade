/**
 * Inventory data access - PostgreSQL version (same functions as the in-memory one).
 * One row per ingredient; its batches live inside the jsonb record.
 */

const db = require('../../data/db');
const { dataOf } = require('./helpers');

async function findAll() {
  return dataOf(await db.query('SELECT data FROM inventory ORDER BY id'));
}

/** Find by ID ("ING-002") or key ("mozzarella"). */
async function findById(id) {
  const { rows } = await db.query('SELECT data FROM inventory WHERE id = $1 OR key = $1 ORDER BY (id = $1) DESC LIMIT 1', [id]);
  return rows.length ? rows[0].data : null;
}

async function findByIds(ids) {
  return dataOf(await db.query('SELECT data FROM inventory WHERE id = ANY($1) ORDER BY id', [ids]));
}

/** Append a batch to an ingredient. Returns the updated ingredient, or null if not found. */
async function addBatch(ingredientId, batch) {
  const { rows } = await db.query(
    "UPDATE inventory SET data = jsonb_set(data, '{batches}', (data->'batches') || $2::jsonb) WHERE id = $1 RETURNING data",
    [ingredientId, JSON.stringify([batch])]
  );
  return rows.length ? rows[0].data : null;
}

/**
 * Apply several batch quantity changes at once.
 * changes: [{ ingredientId, batchId, quantity }] where quantity is the NEW value.
 * Everything is validated before anything is written (and the whole request
 * runs in one transaction anyway).
 */
async function setBatchQuantities(changes) {
  const ids = [...new Set(changes.map((c) => c.ingredientId))];
  const ingredients = new Map((await findByIds(ids)).map((i) => [i.id, i]));
  for (const change of changes) {
    const ingredient = ingredients.get(change.ingredientId);
    const batch = ingredient && ingredient.batches.find((b) => b.batchId === change.batchId);
    if (!batch) throw new Error(`Batch ${change.batchId} not found for ${change.ingredientId}`);
    if (!(change.quantity >= 0)) throw new Error(`Batch ${change.batchId} cannot go negative`);
    batch.quantity = change.quantity;
  }
  for (const ingredient of ingredients.values()) {
    await db.query('UPDATE inventory SET data = $2 WHERE id = $1', [ingredient.id, ingredient]);
  }
}

module.exports = { findAll, findById, findByIds, addBatch, setBatchQuantities };
