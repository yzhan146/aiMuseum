# PostgreSQL integration tests

Relationship merge and data-lifecycle behavior has a dedicated real-PostgreSQL suite. It is intentionally separate from the regular Vitest run, which continues to use the in-memory store.

Run it against a disposable local database:

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_museum_test"
npm run test:integration:postgres
```

The command builds the SDK and character packages, creates a unique temporary schema, runs all migrations and the PostgreSQL relationship suite, and drops the schema afterward.

Safety rules:

- the database name must contain `test`, `testing`, `integration`, or `ci` as a separate `-`/`_` segment;
- remote hosts are rejected unless `AI_MUSEUM_ALLOW_REMOTE_TEST_DB=1` is explicitly set;
- the test process requires the generated `AI_MUSEUM_PG_TEST_SCHEMA` and refuses to use `public`;
- `TEST_DATABASE_URL` is copied to `DATABASE_URL` only in the child test process;
- missing `TEST_DATABASE_URL` prints `SKIPPED / UNVERIFIED` and exits successfully for local development;
- CI can set `AI_MUSEUM_REQUIRE_PG_INTEGRATION=1` to make a missing database fail the job.

The suite covers migration `006`, concurrent `FOR UPDATE SKIP LOCKED` outbox claims, logical-key and normalized-fingerprint deduplication, reset cutoffs, canonical reprojection, learning-event source remapping and deferred foreign keys, repeated and concurrent guest merge, claimed-outbox owner transfer, terminal memory tombstones, stale memory/recall rejection, relationship-before-thread/memory/preference/transition lock ordering, thread/account deletion, and relationship data export.
