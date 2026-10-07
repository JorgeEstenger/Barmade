# Persistent data with Neon (PostgreSQL)

Set `DATABASE_URL` and the API stores everything in PostgreSQL: inventory, menu, orders,
inventory movements, alerts and the demo metadata. Orders and stock changes survive restarts
and redeploys. Without `DATABASE_URL` the API runs fully in memory (the default for local
development and for the tests).

The API itself still runs on Render (Neon only hosts the database).

## Setup

1. Create a free project at [neon.tech](https://neon.tech). Pick the region closest to your
   Render service (for example *AWS US East (Ohio)* if Render is in Ohio). Every query crosses
   that distance, so a matching region makes the API noticeably faster.
2. In Neon, copy the connection string from **Connect**. It looks like
   `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`.
3. In Render, open the service, go to **Environment**, add `DATABASE_URL` with that value,
   and save. Remove `FIRESTORE_PROJECT_ID` / `FIREBASE_SERVICE_ACCOUNT_JSON` if present.
4. Deploy. On the first start the API creates its tables and loads the 60-day demo dataset
   (takes a few seconds). The log shows:

   ```
   Empty database: loading the 60-day demo dataset (first start only)...
   Loaded demo dataset (postgres): 7319 orders, 71569 movements, 3 active alert(s).
   ```

   Later restarts skip this step and keep all data.

Keep the connection string secret: never commit it. For local runs, put it in a `.env` file
(already in `.gitignore`):

```
DATABASE_URL=postgresql://...
```

and start with `npm run dev`, which loads `.env` automatically.

## Behavior

- **Tables:** `inventory`, `menu`, `orders`, `movements`, `alerts`, `demo_meta`. Each row keeps the full
  record in a `data` jsonb column, plus plain columns for filtering (business date, channel,
  ingredient, reason, ...). They are created automatically (`CREATE TABLE IF NOT EXISTS`).
- **One transaction per request.** An order, its stock deductions, its movements and its
  alerts commit together. If anything fails, nothing is saved.
- **No double spending.** Writes are serialized with a PostgreSQL advisory lock, so two
  simultaneous orders can't both use the last mozzarella.
- **Reports are computed in SQL** where it matters (usage per ingredient, movement totals),
  and the 60-day order history is never held in memory.
- **`POST /api/demo/reset`** empties the tables and reloads the same deterministic 60 days.
  This deletes every live order: use it before a presentation, not by accident.
- **Demo clock:** after a reset the demo starts on Day 60 at 6:30 PM and runs in real time.
  The clock is saved in the database, so it keeps moving across restarts. After a few real days
  the "today" dashboard moves past Day 60 and only shows new orders. Reset to start over.

## Code

- [data/db.js](data/db.js): connection pool, transactions, schema.
- [repositories/postgres/](repositories/postgres/): the same repository functions as the in-memory
  ones, implemented with SQL. Each `repositories/*Repository.js` picks the PostgreSQL version
  when `DATABASE_URL` is set. Services, controllers and routes are identical in both modes.
- [services/demoService.js](services/demoService.js): first-start loading and reset.

## Firestore (legacy)

The earlier Firestore persistence (`FIRESTORE_PROJECT_ID`) is still in the code but is no longer
recommended. It only holds the small original fixture, because the 60-day dataset is too large for it.
`DATABASE_URL` takes priority when both are set.
