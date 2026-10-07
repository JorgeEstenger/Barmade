/**
 * Entry point: runs the initial alert checks on the loaded data, then starts listening.
 */

const app = require('./app');
const alertService = require('./services/alertService');
const demoService = require('./services/demoService');

const PORT = process.env.PORT || 3000;

async function start() {
  if (process.env.RENDER && !process.env.DATABASE_URL && !process.env.FIRESTORE_PROJECT_ID) {
    console.warn('Persistence is disabled: set DATABASE_URL (Neon PostgreSQL) to keep orders across restarts.');
  }
  // Demo dataset: alert checks at the dataset's "now" (deterministic).
  await demoService.ensureReady();
  // Generate EXPIRING_SOON / EXPIRED / LOW_STOCK / PREDICTED_RUNOUT alerts for the current inventory.
  const { created } = await alertService.checkExpirations();
  const demo = await demoService.status();
  console.log(`Loaded ${demo.dataset} dataset (${demo.storage}): ${demo.counts.orders} orders, ${demo.counts.inventory_movements} movements, ${demo.counts.active_alerts} active alert(s).`);
  if (created.length) console.log(`Startup check created ${created.length} alert(s).`);

  app.listen(PORT, () => {
    console.log(`BarMade API running at http://localhost:${PORT} (business date ${demo.clock.business_date})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
