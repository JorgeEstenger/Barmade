/**
 * Demo controls:
 *   POST /api/demo/reset - reload the deterministic 60-day dataset
 *   GET  /api/demo       - what is loaded (seed, dates, planted stories, counts)
 *
 * After the dataset is (re)loaded, the alert checks run once at the dataset's
 * "now" (Day 60, 6:30 PM), so every reset produces exactly the same alerts.
 *
 * Storage:
 *   - In memory (default): the 60-day dataset is generated on startup/reset.
 *   - Firestore: the compact classic fixture is created once, then inventory,
 *     orders, movements and alerts persist across Render restarts/redeploys.
 */

const { resetStore, getDemoMeta } = require('../data/store');
const demoRepository = require('../repositories/demoRepository');
const alertService = require('./alertService');
const { resetRushCounter } = require('./simulationService');
const clock = require('../utils/clock');
const { businessDate } = require('../utils/timezone');
const AppError = require('../utils/AppError');
const { persistent } = require('../data/persistence');

let readyFor = null;
let readyPromise = null;

/**
 * Makes sure the data is ready before serving. Called by a tiny middleware in
 * app.js before every request (it only does work once), so it also works when
 * the app is started without server.js (for example, in tests).
 */
function ensureReady() {
  // Firestore is initialized lazily by the first persistent service call.
  if (process.env.FIRESTORE_PROJECT_ID) return Promise.resolve();
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
  const meta = (await demoRepository.getMeta()) || {};
  const now = clock.now();
  return {
    dataset: meta.seed ? 'demo' : 'classic',
    storage: process.env.FIRESTORE_PROJECT_ID ? 'firestore' : 'memory',
    clock: { now: now.toISOString(), business_date: businessDate(now) },
    ...meta,
    counts: await demoRepository.counts(),
  };
}

async function reset() {
  if (process.env.FIRESTORE_PROJECT_ID) {
    throw new AppError(409, 'DEMO_RESET_UNAVAILABLE', 'Demo reset is not available with Firestore storage.');
  }
  resetStore('demo');
  await ensureReady();
  return status();
}

module.exports = { reset, status: persistent(status), ensureReady };
