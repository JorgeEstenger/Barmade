/**
 * Menu data access - PostgreSQL version.
 */

const db = require('../../data/db');
const { dataOf } = require('./helpers');

async function findAll() {
  return dataOf(await db.query('SELECT data FROM menu ORDER BY id'));
}

async function findById(id) {
  const { rows } = await db.query('SELECT data FROM menu WHERE id = $1', [id]);
  return rows.length ? rows[0].data : null;
}

module.exports = { findAll, findById };
