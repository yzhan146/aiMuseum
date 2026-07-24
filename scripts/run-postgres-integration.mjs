import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const requireIntegration = process.env.AI_MUSEUM_REQUIRE_PG_INTEGRATION === "1";

if (!testDatabaseUrl) {
  const message =
    "PostgreSQL integration tests were not run: set TEST_DATABASE_URL to a disposable database whose name contains test, integration, or ci.";
  if (requireIntegration) {
    console.error(`[UNVERIFIED] ${message}`);
    process.exit(2);
  }
  console.warn(`[SKIPPED / UNVERIFIED] ${message}`);
  process.exit(0);
}

const parsedUrl = new URL(testDatabaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
const safeDatabaseName = /(?:^|[-_])(test|testing|integration|ci)(?:$|[-_])/i;
if (!databaseName || !safeDatabaseName.test(databaseName)) {
  console.error(
    `[REFUSED] TEST_DATABASE_URL database "${databaseName || "<empty>"}" is not explicitly test-named.`,
  );
  process.exit(2);
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (
  !localHosts.has(parsedUrl.hostname) &&
  process.env.AI_MUSEUM_ALLOW_REMOTE_TEST_DB !== "1"
) {
  console.error(
    `[REFUSED] Remote PostgreSQL host "${parsedUrl.hostname}" requires AI_MUSEUM_ALLOW_REMOTE_TEST_DB=1.`,
  );
  process.exit(2);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const schema = `ai_museum_it_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const adminPool = new pg.Pool({ connectionString: testDatabaseUrl, max: 1 });

function runNode(args, env = process.env, cwd = repositoryRoot) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

let exitCode = 1;
try {
  const identity = await adminPool.query(
    "SELECT current_database() AS database_name,current_user AS database_user",
  );
  if (identity.rows[0]?.database_name !== databaseName) {
    throw new Error(
      `Connected database ${identity.rows[0]?.database_name ?? "<unknown>"} does not match TEST_DATABASE_URL.`,
    );
  }
  await adminPool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);

  const integrationUrl = new URL(testDatabaseUrl);
  const existingOptions = integrationUrl.searchParams.get("options")?.trim();
  integrationUrl.searchParams.set(
    "options",
    [existingOptions, `-c search_path=${schema},public`]
      .filter(Boolean)
      .join(" "),
  );

  const integrationEnv = {
    ...process.env,
    DATABASE_URL: integrationUrl.toString(),
    AI_MUSEUM_PG_INTEGRATION: "1",
    AI_MUSEUM_PG_TEST_SCHEMA: schema,
  };
  const typescriptBin = path.join(
    repositoryRoot,
    "node_modules",
    "typescript",
    "bin",
    "tsc",
  );
  const vitestBin = path.join(
    repositoryRoot,
    "node_modules",
    "vitest",
    "vitest.mjs",
  );

  exitCode = runNode([
    typescriptBin,
    "-p",
    path.join(repositoryRoot, "packages", "sdk", "tsconfig.json"),
  ]);
  if (exitCode === 0) {
    exitCode = runNode([
      typescriptBin,
      "-p",
      path.join(repositoryRoot, "packages", "characters", "tsconfig.json"),
    ]);
  }
  if (exitCode === 0) {
    exitCode = runNode(
      [
        vitestBin,
        "run",
        "lib/postgres-relationship.integration.test.ts",
      ],
      integrationEnv,
      path.join(repositoryRoot, "apps", "web"),
    );
  }
} catch (error) {
  console.error(
    "[FAILED] PostgreSQL integration harness could not run:",
    error instanceof Error ? error.message : error,
  );
  exitCode = 1;
} finally {
  try {
    await adminPool.query(
      `DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`,
    );
  } catch (error) {
    console.error(
      `[WARNING] Could not remove integration schema ${schema}:`,
      error instanceof Error ? error.message : error,
    );
    exitCode = 1;
  } finally {
    await adminPool.end();
  }
}

process.exit(exitCode);
