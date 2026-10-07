# Persistent data with Cloud Firestore

The Express API runs on Render and stores its live demo state in Cloud
Firestore project `barmade1-7be2b`. Inventory, menu items, orders, inventory
movements and alerts survive browser refreshes, Render restarts and redeploys.

The browser talks to the Render API, not directly to Firestore. Firebase user
Authentication is therefore not required for this demo.

## Firebase setup

1. Create the Firestore database in project `barmade1-7be2b`.
2. In **Project settings > Service accounts**, generate a private key.
3. Keep the downloaded JSON private; never commit it.
4. Deploy the checked-in rules with:

   ```bash
   npx firebase-tools deploy --only firestore
   ```

The rules deny all direct client access. Firebase Admin on the trusted Render
backend bypasses client rules.

## Render setup

Configure these environment variables on the `barmade-api` service:

```text
NODE_ENV=production
NODE_VERSION=24
FIRESTORE_PROJECT_ID=barmade1-7be2b
FIREBASE_SERVICE_ACCOUNT_JSON={complete service-account JSON}
```

Paste the complete JSON object as the value of
`FIREBASE_SERVICE_ACCOUNT_JSON`. Do not add quotes around the whole object.
The included `render.yaml` marks this value `sync: false`, so Render requests
the secret without storing it in Git.

Build and start commands:

```text
npm ci && npm test
npm start
```

## Behavior and limits

- The first Firestore-backed request initializes the compact classic fixture.
- Every service operation runs in a Firestore transaction.
- Orders, stock deductions, movements and alerts commit atomically.
- Firestore retries conflicting transactions, preventing concurrent stock
  updates from spending the same inventory twice.
- `POST /api/demo/reset` is disabled in Firestore mode so a public demo cannot
  erase the shared persistent state.
- The generated 60-day dataset remains available in memory and as the separate
  synthetic-data export. It is intentionally not loaded into this transaction-
  based Firestore demo store because it contains more than 70,000 movements.

For local development without Firestore variables, the API uses the generated
in-memory dataset and tests never contact the cloud database.
