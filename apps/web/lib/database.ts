import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
export const databaseEnabled = Boolean(connectionString && !process.env.VITEST);

const globalDatabase = globalThis as typeof globalThis & {
  __museumPool?: Pool;
  __museumSchemaReady?: Promise<void>;
};

export function databasePool() {
  if (!databaseEnabled || !connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }
  return (globalDatabase.__museumPool ??= new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  }));
}

async function findMigrationsDirectory() {
  const candidates = [
    path.resolve(process.cwd(), "infra", "migrations"),
    path.resolve(process.cwd(), "..", "..", "infra", "migrations"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // The working directory differs between local npm workspaces and Render.
    }
  }
  throw new Error("Database migrations directory was not found");
}

async function migrateDatabase() {
  const client = await databasePool().connect();
  const migrationLockId = 1_945_062_025;
  try {
    await client.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const migrationsDirectory = await findMigrationsDirectory();
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const applied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE name=$1",
        [file],
      );
      if (applied.rowCount) continue;
      const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
          file,
        ]);
        await client.query("COMMIT");
        console.info(`Applied database migration ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [migrationLockId]);
    } finally {
      client.release();
    }
  }
}

export async function ensureDatabaseSchema() {
  if (!databaseEnabled) return;
  globalDatabase.__museumSchemaReady ??= migrateDatabase().catch((error) => {
    globalDatabase.__museumSchemaReady = undefined;
    throw error;
  });
  await globalDatabase.__museumSchemaReady;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  await ensureDatabaseSchema();
  return databasePool().query<T>(text, values);
}

export async function transaction<T>(
  work: (client: PoolClient) => Promise<T>,
) {
  await ensureDatabaseSchema();
  const client = await databasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
