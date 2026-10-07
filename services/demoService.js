/**
 * Demo controls:
 *   POST /api/demo/reset - reload the deterministic 60-day dataset
 *   GET  /api/demo       - what is loaded (seed, dates, planted stories, counts)
 *
 * After the dataset is (re)loaded, the alert checks run once at the dataset's
 * "now" (Day 60, 6:30 PM), so every reset produces exactly the same alerts.
 *
 * Storage:
 *   - In memory (default): the dataset is generated on startup and on reset.
 *   - PostgreSQL / Neon (DATABASE_URL): on the very first start the tables are
 *     created and the 60 days are loaded ONCE. Later restarts keep everything
 *     (live orders included) and the demo clock continues where it was.
 *     Only POST /api/demo/reset reloads the dataset.
 */

const { resetStore, getDemoMeta } = require('../data/store');
const db = require('../data/db');
const demoRepository = require('../repositories/demoRepository');
const alertService = require('./alertService');
const { resetRushCounter } = require('./simulationService');
const { generateDemoData } = require('../data/demo/generator');
const clock = require('../utils/clock');
const { businessDate } = require('../utils/timezone');
const AppError = require('../utils/AppError');

let readyFor = null;
let readyPromise = null;

/** Load the 60-day dataset into PostgreSQL (replacing everything) and run the alert checks. */
async function seedDatabase() {
  const { meta, ...collections } = generateDemoData();
  // Demo time = real time + offset; saved so restarts keep the same demo clock.
  meta.clock_offset_ms = new Date(meta.now).getTime() - Date.now();
  await db.transaction(async () => {
    await demoRepository.replaceAll(collections);
    await demoRepository.saveMeta(meta);
    clock.setDemoOffset(meta.clock_offset_ms);
    await alertService.checkExpirations({ now: new Date(meta.now) });
  });
  resetRushCounter();
}

async function initializeDatabase() {
  await db.ensureSchema();
  const meta = await demoRepository.getMeta();
  if (!meta) {
    console.log('Empty database: loading the 60-day demo dataset (first start only)...');
    await seedDatabase();
  } else {
    clock.setDemoOffset(meta.clock_offset_ms);
  }
}

/**
 * Makes sure the data is ready before serving. Called by a tiny middleware in
 * app.js before every request (it only does work once), so it also works when
 * the app is started without server.js (tests, Firebase Functions).
 */
function ensureReady() {
  if (db.enabled) {
    if (!readyPromise) {
      readyPromise = initializeDatabase().catch((err) => {
        readyPromise = null; // retry on the next request (e.g. Neon was waking up)
        throw err;
      });
    }
    return readyPromise;
  }
  const meta = getDemoMeta();
  if (!meta) return Promise.resolve();
  if (readyFor !== meta) {
    readyFor = meta;
    resetRushCounter(); // rush #1 after every reset is the same rush
    readyPromise = alertService.checkExpirations({ now: new Date(meta.now) });
  }
  return readyPromise;
}

async function status() {
  const { clock_offset_ms: offset, ...meta } = (await demoRepository.getMeta()) || {};
  const now = clock.now();
  return {
    dataset: meta.seed ? 'demo' : 'classic',
    storage: db.enabled ? 'postgres' : process.env.FIRESTORE_PROJECT_ID ? 'firestore' : 'memory',
    clock: { now: now.toISOString(), business_date: businessDate(now) },
    ...meta,
    counts: await demoRepository.counts(),
  };
}

async function reset() {
  if (db.enabled) {
    await db.ensureSchema();
    await seedDatabase();
    readyPromise = Promise.resolve();
    return status();
  }
  if (process.env.FIRESTORE_PROJECT_ID) {
    throw new AppError(409, 'DEMO_RESET_UNAVAILABLE', 'Demo reset is not available with Firestore storage.');
  }
  resetStore('demo');
  await ensureReady();
  return status();
}

module.exports = { reset, status, ensureReady };
