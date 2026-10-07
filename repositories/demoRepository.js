/**
 * Demo dataset storage: record counts and metadata (seed, dates, stories).
 * In memory the dataset is loaded by data/store.js; with PostgreSQL see
 * repositories/postgres/demoRepository.js.
 */

const { store, getDemoMeta } = require('../data/store');

async function counts() {
  return {
    ingredients: store.inventory.length,
    menu_items: store.menu.length,
    orders: store.orders.length,
    inventory_movements: store.movements.length,
    active_alerts: store.alerts.filter((a) => a.status === 'ACTIVE').length,
  };
}

async function getMeta() {
  return getDemoMeta();
}

const memory = { counts, getMeta };
module.exports = require('../data/db').enabled ? require('./postgres/demoRepository') : memory;
