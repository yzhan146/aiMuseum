import { Pool, type PoolClient, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
export const databaseEnabled = Boolean(connectionString && !process.env.VITEST);

const globalDatabase = globalThis as typeof globalThis & { __museumPool?: Pool };

export function databasePool() {
  if (!databaseEnabled || !connectionString) throw new Error("DATABASE_URL is not configured");
  return globalDatabase.__museumPool ??= new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return databasePool().query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
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
