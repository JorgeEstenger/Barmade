/**
 * Demo dataset storage: record counts and metadata (seed, dates, stories).
 * In memory the dataset is loaded by data/store.js. In Firestore mode these
 * functions run inside the transaction snapshot supplied by persistence.js.
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

module.exports = { counts, getMeta };
