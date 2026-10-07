const fs = require('node:fs');
const path = require('node:path');
const { generateDemoData } = require('../data/demo/generator');

const outputDir = path.resolve(process.argv[2] || 'exports/barmade-synthetic-data');
const dataset = generateDemoData();
const collections = ['inventory', 'menu', 'orders', 'movements', 'alerts'];

fs.mkdirSync(outputDir, { recursive: true });

for (const name of collections) {
  fs.writeFileSync(
    path.join(outputDir, `${name}.json`),
    `${JSON.stringify(dataset[name], null, 2)}\n`,
    'utf8',
  );
}

const metadata = {
  exportedAt: new Date().toISOString(),
  synthetic: true,
  generator: 'BarMade deterministic demo generator',
  ...dataset.meta,
  counts: Object.fromEntries(collections.map((name) => [name, dataset[name].length])),
};

fs.writeFileSync(
  path.join(outputDir, 'metadata.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
  'utf8',
);

const readme = `# BarMade synthetic dataset

This archive contains deterministic, entirely synthetic restaurant data.
It contains no customer information, credentials, or production records.

Files:

- inventory.json: ingredients, batches, quantities and expiration dates
- menu.json: menu items, recipes and modifiers
- orders.json: synthetic orders and sales channels
- movements.json: inventory consumption, deliveries and adjustments
- alerts.json: generated stock and expiration alerts
- metadata.json: generator settings, scenario details and record counts

All files are UTF-8 JSON arrays except metadata.json, which is a JSON object.
`;

fs.writeFileSync(path.join(outputDir, 'README.md'), readme, 'utf8');

console.log(JSON.stringify(metadata.counts));
